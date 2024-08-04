import { Chat, ChatRequest, ModelType, Site } from '../base';
import { CreateNewAxios } from '../../utils/proxyAgent';
import {
  FluxPrompt,
  PredictionsReq,
  PredictionsRes,
  ResultRes,
} from './define';
import {
  Event,
  EventStream,
  extractJSON,
  MessageData,
  retryFunc,
  sleep,
  ThroughEventStream,
} from '../../utils';
import { chatModel } from '../index';
import { Config } from '../../utils/config';

export class Flux extends Chat {
  get client() {
    return CreateNewAxios({ baseURL: 'https://flux1.ai/api' }, { proxy: true });
  }

  async chat(messages: string) {
    return (await this.client.post<{ data: string }>('/chat', { messages }))
      .data;
  }

  async predictions(req: PredictionsReq) {
    return (await this.client.post<PredictionsRes>('/predictions', req)).data;
  }

  async result(id: string) {
    return (await this.client.get<ResultRes>(`/result/${id}`)).data;
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.Flux:
        return 1000;
      default:
        return 0;
    }
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const auto = chatModel.get(Site.Auto);
    let old = '';
    const pt = new ThroughEventStream(
      (event, data) => {
        stream.write(event, data);
        if ((data as MessageData).content) {
          old += (data as MessageData).content;
        }
      },
      async () => {
        try {
          await retryFunc(
            async () => {
              stream.write(Event.message, { content: '\n\n' });
              const action = extractJSON<PredictionsReq>(old);
              if (!action) {
                stream.write(Event.message, {
                  content: 'Generate action failed',
                });
                stream.write(Event.done, { content: '' });
                stream.end();
                return;
              }
              const pRes = await this.predictions(action);
              stream.write(Event.message, { content: `\n\n> 生成中` });
              for (let i = 0; i < 10; i++) {
                try {
                  const task = await this.result(pRes.replicateId);
                  if (task.status === 1) {
                    stream.write(Event.message, {
                      content: `✅\n\n![${task.imgAfterSrc}](${task.imgAfterSrc})`,
                    });
                    break;
                  }
                  stream.write(Event.message, { content: '.' });
                } catch (e: any) {
                  this.logger.error(`get task list failed, err: ${e.message}`);
                }
                await sleep(2 * 1000);
              }
            },
            Config.config.luma?.retry_times || 3,
            { label: 'luma gen video', delay: 100 },
          );
        } catch (e: any) {
          this.logger.error(e.message);
          stream.write(Event.message, {
            content: `生成失败: ${
              e.message
            }\nReason:\n\`\`\`json\n${JSON.stringify(
              e.response?.data,
              null,
              2,
            )}\n\`\`\`\n`,
          });
          stream.write(Event.done, { content: '' });
          stream.end();
        }
      },
    );
    req.messages = [{ role: 'system', content: FluxPrompt }, ...req.messages];
    await auto?.askStream(
      {
        ...req,
        model: Config.config.flux?.model || ModelType.GPT4oMini,
      } as ChatRequest,
      pt,
    );
  }
}
