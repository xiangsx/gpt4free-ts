import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Event, EventStream, parseJSON, randomStr } from '../../utils';
import {
  ChildOptions,
  ComChild,
  ComInfo,
  DestroyOptions,
  Pool,
} from '../../utils/pool';
import { Config } from '../../utils/config';
import { CreateNewPage, WebFetchWithPage } from '../../utils/proxyAgent';
import moment from 'moment/moment';
import { v4 } from 'uuid';
import { Page } from 'puppeteer';

import es from 'event-stream';

interface MessageContent {
  content_type: string;
  parts: string[];
}

interface Author {
  role: string;
  name: null | string;
  metadata: Record<string, any>;
}

interface Metadata {
  message_type: string;
  model_slug: string;
  parent_id: string;
}

interface Message {
  id: string;
  author: Author;
  create_time: number;
  update_time: null | number;
  content: MessageContent;
  status: string;
  end_turn: null | any;
  weight: number;
  metadata: Metadata;
  recipient: string;
}

interface Conversation {
  message: Message;
  conversation_id: string;
  error: null | any;
}

interface Account extends ComInfo {
  session_key: string;
  client_sha: string;
  client_version: string;
  org_id: string;
  banned: boolean;
}

class Child extends ComChild<Account> {
  public client!: WebFetchWithPage;
  public page!: Page;
  public closeDelay!: NodeJS.Timeout;

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
  }

  extractOrgId(url: string): string | null {
    const regex = /organizations\/([a-f\d-]+)\/chat_conversations/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  async updateOrg() {
    const page = this.page;
    await page.waitForSelector(`div[data-value="new chat"]`);
    const promise = page.waitForResponse(
      (res) => res.url().indexOf('/api/organizations') > -1,
    );
    await page.click(`div[data-value="new chat"]`);
    const res = await promise;
    const data = (await res.json()) as {};
    const headers = res.request().headers();
    const client_sha = headers['anthropic-client-sha'];
    const client_version = headers['anthropic-client-version'];
    const org_id = this.extractOrgId(res.url());
    if (!org_id || !client_sha || !client_version) {
      throw new Error('org_id or client_sha or client_version is empty');
    }
    this.update({ client_sha, client_version, org_id });
  }

  async init(): Promise<void> {
    if (!this.info.session_key) {
      throw new Error('session_key is empty');
    }

    try {
      const page = await CreateNewPage('https://claude.ai/', {
        cookies: [
          {
            name: 'sessionKey',
            value: this.info.session_key,
            domain: 'claude.ai',
            url: 'https://claude.ai/',
          },
        ],
      });
      this.page = page;
      await page.waitForSelector(`div[data-value="new chat"]`, {
        timeout: 30 * 1000,
      });
      this.logger.info('login ok');
      await this.updateOrg();
      this.client = new WebFetchWithPage(page);
    } catch (e) {
      await this.page.screenshot({ path: `run/error-${randomStr(20)}.png` });
      this.page?.browser().close();
      this.logger.error(`init failed, email:${this.info.session_key}`);
      throw e;
    }
  }

  async newChat(): Promise<string> {
    const body = { uuid: v4(), name: '' };
    const result = (await this.page.evaluate(
      (body, client_sha, client_version, org_id) => {
        return new Promise((resolve, reject) => {
          fetch(
            `https://claude.ai/api/organizations/${org_id}/chat_conversations`,
            {
              headers: {
                accept: '*/*',
                'accept-language': 'en-US,en;q=0.9',
                'anthropic-client-sha': client_sha,
                'anthropic-client-version': client_version,
                'content-type': 'application/json',
              },
              referrer: 'https://claude.ai/chats',
              referrerPolicy: 'strict-origin-when-cross-origin',
              body: JSON.stringify(body),
              method: 'POST',
              mode: 'cors',
              credentials: 'include',
            },
          )
            .then((res) => res.json())
            .then(resolve)
            .catch(reject);
        });
      },
      body,
      this.info.client_sha,
      this.info.client_version,
      this.info.org_id,
    )) as { name: string; uuid: string };
    if (!result.uuid) {
      throw new Error('newChat failed');
    }
    return body.uuid;
  }

  async destroy(options?: DestroyOptions) {
    super.destroy(options);
    if (this.closeDelay) {
      this.closeDelay.refresh();
      return false;
    }
    this.closeDelay = setTimeout(() => {
      this.page?.browser().close();
    }, 8 * 60 * 1000);
    return true;
  }

  initFailed() {
    this.page?.browser()?.close();
    this.options?.onInitFailed({ delFile: false, delMem: true });
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}

export class ClaudeChat extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.claudechat.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.session_key) {
        return false;
      }
      if (v.banned) {
        return false;
      }
      return true;
    },
    {
      delay: 1000,
      serial: () => Config.config.claudechat.serial || 1,
      needDel: (v) => !v.session_key,
      preHandleAllInfos: async (infos) => {
        const emailSet = new Map(infos.map((v) => [v.session_key, v]));
        for (const v of Config.config.claudechat.sessions_keys) {
          if (emailSet.has(v)) {
            continue;
          }
          const newA = {
            id: v4(),
            session_key: v,
          } as Account;
          emailSet.set(v, newA);
          infos.push(newA);
        }
        return infos;
      },
    },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.Claude2:
        return 80000;
      default:
        return 0;
    }
  }

  async preHandle(
    req: ChatRequest,
    options?: {
      token?: boolean;
      countPrompt?: boolean;
      forceRemove?: boolean;
      stream?: EventStream;
    },
  ): Promise<ChatRequest> {
    const reqH = await super.preHandle(req, {
      token: true,
      countPrompt: false,
      forceRemove: false,
    });
    reqH.prompt =
      reqH.messages
        .map(
          (v) =>
            `\n\n${v.role === 'assistant' ? 'Assistant' : 'Human'}: ${
              v.content
            }`,
        )
        .join() + '\n\nAssistant:';
    return reqH;
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    try {
      const body = {
        prompt: req.prompt,
        timezone: 'Asia/Shanghai',
        model: 'claude-2.1',
        attachments: [],
      };
      const organ_id = child.info.org_id;
      const conversation_uuid = await child.newChat();
      const pt = await child.client.fetch(
        `https://claude.ai/api/organizations/${organ_id}/chat_conversations/${conversation_uuid}/completion`,
        {
          headers: {
            accept: 'text/event-stream, text/event-stream',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/json',
            'sec-ch-ua':
              '" Not;A Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
          },
          referrer: `https://claude.ai/chat/${conversation_uuid}`,
          referrerPolicy: 'strict-origin-when-cross-origin',
          body: JSON.stringify(body),
          method: 'POST',
          mode: 'cors',
          credentials: 'include',
        },
      );
      let old = '';
      pt.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          let [, dataStr] = chunk.split('\n');
          dataStr = dataStr.replace('data: ', '');
          const data = parseJSON<{
            completion: string;
            stop_reason: string | null;
          }>(dataStr, {} as any);
          if (data.stop_reason) {
            if (
              data.completion.indexOf(
                'Your account has been disabled after an automatic review of your recent activities that violate our Terms of Service.',
              ) > -1
            ) {
              this.logger.error('account has been banned');
              pt.destroy();
              stream.write(Event.error, {
                error: 'account has been disabled',
              });
              stream.end();
              child.update({ banned: true });
              child.destroy({ delFile: false, delMem: true });
              return;
            }
            this.logger.info('Recv msg ok');
            pt.destroy();
            stream.write(Event.done, { content: '' });
            stream.end();
            return;
          }
          if (!data.completion) {
            return;
          }
          old += data.completion;
          stream.write(Event.message, {
            content: data.completion,
          });
        }),
      );
    } catch (e: any) {
      this.logger.error('ask failed, ', e.message);
      stream.write(Event.error, e);
      stream.write(Event.done, { content: '' });
      stream.end();
      child.destroy({ delFile: false, delMem: true });
    }
  }
}
