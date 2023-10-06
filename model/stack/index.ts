import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Event, EventStream, parseJSON, randomStr, sleep } from '../../utils';
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

interface Account extends ComInfo {
  email: string;
  password: string;
  token: string;
  expire_time: number;
  flow_id: string;
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
      if (
        this.info.token &&
        this.info.expire_time &&
        this.info.expire_time > moment().unix()
      ) {
        return;
      }
      const page = await CreateNewPage('https://www.stack-ai.com/');
      await page.waitForSelector('nav > div:nth-child(5) > button');
      await page.click('nav > div:nth-child(5) > button');

      await page.waitForSelector(
        '#auth-sign-in > .supabase-ui-auth_ui-container > .supabase-ui-auth_ui-container > div > .c-cpTgHx-bBzSYw-type-default',
      );
      await page.click(
        '#auth-sign-in > .supabase-ui-auth_ui-container > .supabase-ui-auth_ui-container > div > .c-cpTgHx-bBzSYw-type-default',
      );
      await page.keyboard.type(this.info.email);

      await page.waitForSelector(
        '#auth-sign-in > .supabase-ui-auth_ui-container > .supabase-ui-auth_ui-container > div > .c-cpTgHx-kowJZS-type-password',
      );
      await page.click(
        '#auth-sign-in > .supabase-ui-auth_ui-container > .supabase-ui-auth_ui-container > div > .c-cpTgHx-kowJZS-type-password',
      );
      await page.keyboard.type(this.info.password);

      await page.waitForSelector(
        '.container > div > #auth-sign-in > .supabase-ui-auth_ui-container > .supabase-ui-auth_ui-button',
      );
      await page.click(
        '.container > div > #auth-sign-in > .supabase-ui-auth_ui-container > .supabase-ui-auth_ui-button',
      );
      await sleep(3000);
      await page.goto('https://www.stack-ai.com/dashboard');
      await sleep(1000);
      await page.waitForSelector(
        '.fixed > .no-scrollbar > .container > .flex > .rounded-md',
      );
      await page.click(
        '.fixed > .no-scrollbar > .container > .flex > .rounded-md',
      );
      await page.keyboard.press('Enter');
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
      page.browser().close();
    } catch (e) {
      this.page?.browser().close();
      throw e;
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
      if (!v.email || !v.password) {
        return false;
      }
      return true;
    },
    {
      delay: 1000,
      serial: () => Config.config.stack.serial || 1,
      preHandleAllInfos: async (infos) => {
        const emailSet = new Set(infos.map((v) => v.email));
        for (const v of Config.config.stack.accounts) {
          if (emailSet.has(v.email)) {
            continue;
          }
          emailSet.add(v.email);
          infos.push({
            id: v4(),
            email: v.email,
            password: v.password,
          } as Account);
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
      case ModelType.GPT4:
        return 5800;
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
      if (child.info.expire_time < moment().unix()) {
        child.destroy({ delFile: true, delMem: true });
        throw new Error('token expired');
      }
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
      });
    } catch (e: any) {
      this.logger.error('ask failed, ', e);
      stream.write(Event.error, e);
      stream.write(Event.done, { content: '' });
      stream.end();
    }
  }
}
