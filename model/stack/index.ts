import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import {
  Event,
  EventStream,
  getRandomOne,
  parseJSON,
  randomStr,
  sleep,
} from '../../utils';
import {
  ChildOptions,
  ComChild,
  ComInfo,
  DestroyOptions,
  Pool,
} from '../../utils/pool';
import { Config } from '../../utils/config';
import { CreateAxiosProxy, CreateNewPage } from '../../utils/proxyAgent';
import moment from 'moment/moment';
import { v4 } from 'uuid';
import { Page } from 'puppeteer';
import { AxiosInstance } from 'axios';
import es from 'event-stream';
import { CreateEmail } from '../../utils/emailFactory';
import { verify } from 'crypto';

interface Account extends ComInfo {
  email: string;
  password: string;
  token: string;
  expire_time: number;
  flow_id: string;
  left: number;
  use_out_time: number;
}
class Child extends ComChild<Account> {
  public client: AxiosInstance;
  public page?: Page;
  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://merlin-uam-yak3s7dv3a-ue.a.run.app',
      },
      false,
    );
  }
  async init(): Promise<void> {
    try {
      if (this.info.token) {
        if (this.info.left <= 0) {
          this.update({ left: 1000 });
        }
        return;
      } else {
        throw new Error('token is empty');
      }
      const page = await CreateNewPage('https://www.stack-ai.com/');
      this.page = page;

      await page.waitForSelector(
        'nav > div:nth-child(5) > button:nth-child(2)',
      );
      await page.click('nav > div:nth-child(5) > button:nth-child(2)');
      const mailbox = CreateEmail(Config.config.stack.mail_type);
      await page.waitForSelector(`input[type="email"]`);
      await page.click(`input[type="email"]`);
      const email = await mailbox.getMailAddress();
      await page.keyboard.type(email);

      await page.waitForSelector(`input[type="password"]`);
      await page.click(`input[type="password"]`);
      const password = randomStr(20);
      await page.keyboard.type(password);
      await page.waitForSelector(`button[type="submit"]`);
      await page.click(`button[type="submit"]`);
      let verify;
      for (const v of await mailbox.waitMails()) {
        verify = v.content.match(/href="([^“]*)/i)?.[1] || '';
        if (verify) {
          break;
        }
      }
      if (!verify) {
        throw new Error('verify code not found');
      }
      verify = verify.replace(/&amp;/g, '&');
      await page.goto(verify);
      this.update({ email, password });

      await page.waitForNavigation();
      await sleep(1000);
      await page.goto('https://www.stack-ai.com/dashboard');
      await sleep(2000);
      await this.closeWelcome(page);
      await page.waitForSelector(
        '.fixed > .no-scrollbar > .container > .flex > .rounded-md',
      );
      await page.click(
        '.fixed > .no-scrollbar > .container > .flex > .rounded-md',
      );
      await page.waitForSelector(
        'div:nth-child(2) > .relative > .min-w-\\[8rem\\] > .group > .relative',
      );
      await page.click(
        'div:nth-child(2) > .relative > .min-w-\\[8rem\\] > .group > .relative',
      );
      await sleep(5000);
      const flow_id = page.url().split('tab_id=')[1];
      if (!flow_id) {
        throw new Error('flowID is empty');
      }
      this.update({ flow_id });
      await this.getToken(page);
      this.update({ left: 100 });
      page.browser().close();
    } catch (e) {
      this.page?.browser().close();
      throw e;
    }
  }

  async closeWelcome(page: Page) {
    try {
      await page.waitForSelector('button[data-highlight="Dismiss"]');
      await page.click('button[data-highlight="Dismiss"]');
      this.logger.info('close welcome ok');
    } catch (e) {
      this.logger.error('close welcome failed', e);
    }
  }

  //cookie {supabase-auth-token:["token",,,]}
  async getToken(page: Page) {
    const cookies = await page.cookies('https://www.stack-ai.com');
    let token = '';
    for (const cookie of cookies) {
      if (cookie.name === 'supabase-auth-token') {
        const str = decodeURIComponent(cookie.value);
        const [token] = parseJSON<string[]>(str, []);
        if (!token) {
          throw new Error('token is empty');
        }
        this.update({ token, expire_time: cookie.expires });
        return;
      }
    }
    throw new Error('token is empty');
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
    this.page?.browser()?.close();
  }

  initFailed() {
    this.page?.browser()?.close();
    this.options?.onInitFailed({ delFile: true, delMem: true });
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}

export class Stack extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.stack.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.token) {
        return false;
      }
      if (!v.left && moment.unix(v.use_out_time).isSame(moment(), 'day')) {
        return false;
      }
      return true;
    },
    {
      delay: 3000,
      serial: () => Config.config.stack.serial || 1,
      preHandleAllInfos: async (allInfos) => {
        const oldMap: Record<string, Account> = {};
        for (const v of allInfos) {
          oldMap[v.email] = v;
        }
        const result: Account[] = [];
        for (const v of Config.config.stack.accounts) {
          if (oldMap[v.email]) {
            Object.assign(oldMap[v.email], v);
            result.push(oldMap[v.email]);
            continue;
          }
          result.push({
            id: v4(),
            ready: false,
            ...v,
            left: 1000,
          } as Account);
        }
        return result;
      },
      needDel: (account) => {
        return !Config.config.stack.accounts.find(
          (v) => v.email === account.email,
        );
      },
    },
  );
  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 5000;
      case ModelType.GPT3p5Turbo:
        return 2500;
      case ModelType.GPT4_32k:
        return 30000;
      default:
        return 0;
    }
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    return super.preHandle(req, {
      token: true,
      countPrompt: true,
      forceRemove: true,
    });
  }
  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    if (!child) {
      stream.write(Event.error, { error: 'No valid connections', status: 429 });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    try {
      child.update({ left: child.info.left - 1 });
      const res = await child.client.post(
        `https://www.stack-inference.com/run_flow?flow_id=${child.info.flow_id}`,
        {
          nodes: [
            {
              targetPosition: 'left',
              sourcePosition: 'right',
              position: {
                x: 0,
                y: 0,
              },
              positionAbsolute: {
                x: 0,
                y: 0,
              },
              selected: false,
            },
            {
              width: 532,
              height: 237,
              id: 'out-0',
              type: 'out',
              position: {
                x: 1350,
                y: 200,
              },
              data: {
                name: 'Output',
                key: 'out-0',
                type: 'out',
                flow_mode: 'fwd',
                flow_id: child.info.flow_id,
                input_edges: [
                  {
                    id: 'reactflow__edge-llm-0output-out-0',
                    source: 'llm-0',
                    target: 'out-0',
                  },
                ],
                output_edges: [],
                is_running: false,
                text: 'Hello! How may I assist you with your financial needs today?',
                output: '',
                latency: 0.0009050369262695312,
              },
              selected: false,
              positionAbsolute: {
                x: 1350,
                y: 200,
              },
              dragging: false,
            },
            {
              width: 388,
              height: 175,
              id: 'in-0',
              type: 'in',
              position: {
                x: -75,
                y: 200,
              },
              data: {
                name: 'Input',
                text: req.prompt,
                key: 'in-0',
                type: 'in',
                flow_mode: 'fwd',
                flow_id: child.info.flow_id,
                input_edges: [],
                output_edges: [
                  {
                    id: 'context',
                    source: 'in-0',
                    target: 'llm-0',
                  },
                ],
                is_running: false,
                latency: 0.002287626266479492,
              },
              selected: true,
              positionAbsolute: {
                x: -75,
                y: 200,
              },
              dragging: false,
            },
            {
              width: 709,
              height: 739,
              id: 'llm-0',
              type: 'llm',
              position: {
                x: 525,
                y: -50,
              },
              data: {
                name: 'OpenAI',
                params: {
                  temperature: 1,
                  top_p: 1,
                  n: 1,
                  stream: true,
                  prompt_stop_token: '\n\n###\n\n',
                  stop: null,
                  max_tokens: null,
                  frequency_penalty: 0,
                  presence_penalty: 0,
                  logit_bias: {},
                  user: '',
                },
                provider: 'OpenAI',
                model: req.model,
                system: '你是openai创造的AI机器人, 基于GPT-4模型',
                prompt: 'Answer {in-0}',
                key: 'llm-0',
                type: 'llm',
                flow_mode: 'fwd',
                flow_id: child.info.flow_id,
                input_edges: [
                  {
                    id: 'context',
                    source: 'in-0',
                    target: 'llm-0',
                  },
                ],
                output_edges: [
                  {
                    id: 'output',
                    source: 'llm-0',
                    target: 'out-0',
                  },
                ],
                is_running: false,
                latency: 2.4142861366271973,
                formatted_prompt:
                  "system:\nYou are a helpful financial assistant. You use a professional tone, but answer in a cheerful way. Be concise. If you don't know the answer, say that you don't know.\n\nprompt:\nAnswer Hello!",
              },
              selected: false,
              positionAbsolute: {
                x: 525,
                y: -50,
              },
              dragging: false,
            },
          ],
          edges: [
            {
              type: 'smoothstep',
              markerEnd: {
                type: 'arrowclosed',
              },
              animated: true,
              style: {
                strokeWidth: 4,
              },
              selected: false,
            },
            {
              type: 'custom',
              markerEnd: {
                type: 'arrowclosed',
              },
              animated: true,
              style: {
                strokeWidth: 4,
              },
              source: 'in-0',
              sourceHandle: null,
              target: 'llm-0',
              targetHandle: 'context',
              id: 'reactflow__edge-in-0-llm-0context',
            },
            {
              type: 'custom',
              markerEnd: {
                type: 'arrowclosed',
              },
              animated: true,
              style: {
                strokeWidth: 4,
              },
              source: 'llm-0',
              sourceHandle: 'output',
              target: 'out-0',
              targetHandle: null,
              id: 'reactflow__edge-llm-0output-out-0',
            },
          ],
          viewport: {
            x: 310.44815588803203,
            y: 190.99686854921356,
            zoom: 0.625,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${child.info.token}`,
            accept: '*/*',
            'accept-language': 'zh-CN,zh;q=0.9',
            'cache-control': 'no-cache',
            pragma: 'no-cache',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            Referer: 'https://www.stack-ai.com/',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 Edg/118.0.2088.46`,
            Origin: 'https://www.stack-ai.com',
          },
          responseType: 'stream',
        },
      );
      let old = '';
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map((chunk: any) => {
          try {
            const data = chunk.toString().replace('data: ', '');
            if (!data) {
              return;
            }
            const v = parseJSON<{
              nodes: { type: string; data: { text: string } }[];
            }>(data, {} as any);
            for (const node of v.nodes) {
              if (node.type !== 'out') {
                continue;
              }
              if (node.data.text.length > old.length) {
                stream.write(Event.message, {
                  content: node.data.text.substring(old.length),
                });
                old = node.data.text;
              }
            }
          } catch (e) {
            this.logger.error('parse data failed, ', e);
          }
        }),
      );
      res.data.on('close', () => {
        this.logger.info('Msg recv ok');
        stream.write(Event.done, { content: '' });
        stream.end();
        if (child.info.left <= 0) {
          child.update({ use_out_time: moment().unix() });
          child.destroy({ delFile: false, delMem: true });
        }
      });
    } catch (e: any) {
      this.logger.error(`${child.info.email}ask failed, `, e.message);
      stream.write(Event.error, e);
      stream.write(Event.done, { content: '' });
      stream.end();
      if (e.response.status === 401) {
        this.logger.warn('token expired');
        child.update({ use_out_time: moment().unix(), left: 0 });
        child.destroy({ delFile: false, delMem: true });
        return;
      }
      if (child.info.left <= 0) {
        child.update({ use_out_time: moment().unix() });
        child.destroy({ delFile: false, delMem: true });
      }
    }
  }
}
