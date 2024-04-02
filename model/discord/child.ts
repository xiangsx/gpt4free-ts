import { ComChild, DestroyOptions } from '../../utils/pool';
import {
  DiscordAccount,
  GatewayDHello,
  GatewayEventName,
  GatewayEventPayload,
  GatewayEvents,
  GatewayHandler,
  GatewayMessage,
  InteractionPayload,
  InteractionType,
  UploadedFileData,
  UploadFileInfo,
} from './define';
import { CreateNewAxios, WSS } from '../../utils/proxyAgent';
import { AxiosInstance } from 'axios';
import { downloadFile, parseJSON, randomStr } from '../../utils';
import moment from 'moment';
import fs from 'fs';

export class DiscordChild<
  T extends DiscordAccount = DiscordAccount,
> extends ComChild<T> {
  protected ws!: WSS;
  protected heartbeat_itl: NodeJS.Timeout | null = null;
  protected last_heartbeat_ack: number = 1;
  protected event_map: Partial<Record<GatewayEvents, GatewayHandler>> = {};
  protected client!: AxiosInstance;
  protected session_id: string = randomStr(32);
  protected application_id!: string;
  protected event_wait_map: Partial<
    Record<
      GatewayEventName,
      Record<
        string,
        {
          condition: (e: GatewayEventPayload) => boolean;
          cb: (e: GatewayEventPayload) => void;
        }
      >
    >
  > = {};
  protected his_messages!: GatewayMessage[];
  protected msg_updater!: NodeJS.Timer;

  sendEvent(e: GatewayEventPayload) {
    this.ws.send(JSON.stringify(e));
  }

  async interact(d: InteractionPayload<InteractionType>) {
    try {
      await this.client.post('/interactions', d);
    } catch (e: any) {
      const errMsg = `interact error: ${e.message} req:${JSON.stringify(
        d,
      )} res:${JSON.stringify(e.response.data)}`;
      throw new Error(errMsg);
    }
  }

  async upload(url: string) {
    const { file_size, file_name, outputFilePath } = await downloadFile(url);
    const res: {
      data: {
        attachments: UploadedFileData[];
      };
    } = await this.client.post(
      `/channels/${this.info.channel_id}/attachments`,
      {
        files: [
          {
            file_size,
            filename: file_name,
            id: `${Math.floor(Math.random() * 9999999)}`,
            is_clip: false,
          } as UploadFileInfo,
        ],
      },
    );
    if (!res.data.attachments.length) {
      throw new Error('upload failed');
    }
    const file = res.data.attachments[0];
    const filestream = fs.createReadStream(outputFilePath);
    await this.client.put(file.upload_url, filestream, {
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });
    return { file_name, upload_filename: file.upload_filename };
  }

  async getMessages() {
    try {
      const res = await this.client.get(
        `/channels/${this.info.channel_id}/messages?limit=50`,
      );
      return res.data as GatewayMessage[];
    } catch (e) {
      return this.his_messages || [];
    }
  }

  async waitGatewayEventName<T>(
    t: GatewayEventName,
    condition: (e: GatewayEventPayload<T>) => boolean,
    options: {
      onEvent: (e: GatewayEventPayload<T>) => void;
      timeout?: number;
      onTimeout?: () => void;
    },
  ): Promise<() => void> {
    const { timeout = 5 * 60 * 1000, onEvent, onTimeout = () => {} } = options;
    const itl = setTimeout(() => {
      delete this.event_wait_map[t]![id];
      onTimeout();
    }, timeout);
    const id = randomStr(32);
    this.event_wait_map[t]![id] = {
      condition,
      cb: (e) => {
        onEvent?.(e);
        itl.refresh();
      },
    };
    return () => {
      delete this.event_wait_map[t]![id];
    };
  }

  async waitGatewayEventNameAsync<T>(
    t: GatewayEventName,
    condition: (e: GatewayEventPayload<T>) => boolean,
    options: {
      timeout?: number;
    },
  ): Promise<GatewayEventPayload<T>> {
    return new Promise(async (resolve, reject) => {
      const remove = await this.waitGatewayEventName<T>(t, condition, {
        ...options,
        onEvent: (e) => {
          resolve(e);
          remove();
        },
        onTimeout: () => {
          reject(new Error('timeout'));
          remove();
        },
      });
    });
  }

  identify() {
    this.sendEvent({
      op: GatewayEvents.Identify,
      d: {
        token: this.info.token,
        capabilities: 16381,
        properties: {
          os: 'Mac OS X',
          browser: 'Chrome',
          device: '',
          system_locale: 'zh-CN',
          browser_user_agent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
          browser_version: '120.0.0.0',
          os_version: '10.15.7',
          referrer: '',
          referring_domain: '',
          referrer_current: '',
          referring_domain_current: '',
          release_channel: 'stable',
          client_build_number: 260292,
          client_event_source: null,
        },
        presence: {
          status: 'online',
          since: 0,
          activities: [],
          afk: false,
        },
        compress: false,
        client_state: {
          guild_versions: {},
          highest_last_message_id: '0',
          read_state_version: 0,
          user_guild_settings_version: -1,
          private_channels_version: '0',
          api_code_version: 0,
        },
      },
    });
    this.logger.info('identify ok');
  }

  sendHeartBeat() {
    this.sendEvent({
      op: GatewayEvents.Heartbeat,
      d: this.last_heartbeat_ack++,
    });
  }

  initHello(heatBeatInterval: number) {
    this.identify();
    if (this.heartbeat_itl) {
      clearInterval(this.heartbeat_itl);
    }
    this.heartbeat_itl = setInterval(() => this.sendHeartBeat(), 20 * 1000);
    this.logger.info('init hello ok');
  }

  async handleHello(e: GatewayEventPayload<GatewayDHello>) {
    this.initHello(e.d.heartbeat_interval);
  }

  listenEvent(e: GatewayEventPayload<any>) {
    this.event_map[e.op]?.(e);
    if (e.t) {
      const wait_map = this.event_wait_map[e.t];
      if (wait_map) {
        this.logger.info(JSON.stringify(e));
        for (const [, v] of Object.entries(wait_map)) {
          if (v.condition(e)) {
            v.cb(e);
          }
        }
      }
    }
  }

  initWS() {
    return new Promise((resolve, reject) => {
      this.ws = new WSS('wss://gateway.discord.gg/?v=10&encoding=json', {
        onOpen: () => {},
        onMessage: (v: string) => {
          const e = parseJSON<GatewayEventPayload<any> | undefined>(
            v,
            undefined,
          );
          if (!e) {
            return;
          }
          this.listenEvent(e);
          if (e.op === GatewayEvents.Hello) {
            this.handleHello(e as GatewayEventPayload<GatewayDHello>)
              .then(resolve)
              .catch(reject);
          }
        },
        onClose: () => {
          reject(new Error('ws closed'));
          this.destroy({ delFile: false, delMem: true });
        },
        onError: () => {},
      });
    });
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
    if (this.heartbeat_itl) {
      clearInterval(this.heartbeat_itl);
    }
    this.ws?.close();
  }

  async init(): Promise<void> {
    if (!this.info.channel_id || !this.info.token || !this.info.server_id) {
      this.destroy({ delFile: true, delMem: true });
      throw new Error('invalid info');
    }
    if (!this.application_id) {
      throw new Error('invalid application_id');
    }
    for (const v of Object.values(GatewayEventName)) {
      this.event_wait_map[v as GatewayEventName] = {};
    }
    this.client = CreateNewAxios(
      {
        baseURL: 'https://discord.com/api/v9/',
        headers: {
          Authorization: this.info.token,
        },
        timeout: 10 * 1000,
      },
      { proxy: true },
    );
    await this.initWS();
    // this.msg_updater = setInterval(async () => {
    //   this.his_messages = await this.getMessages();
    // }, 3000);
  }

  initFailed(e?: Error) {
    super.initFailed();
    if ((e as any)?.response?.status === 401) {
      this.update({ auth_failed: true } as Partial<T>);
    }
    this.logger.info(`${this.info.channel_id}: init failed`);
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    } as Partial<T>);
  }
}
