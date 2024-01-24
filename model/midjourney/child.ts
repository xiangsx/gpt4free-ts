import { ComChild, DestroyOptions } from '../../utils/pool';
import {
  Account,
  GatewayDHello,
  GatewayDMessageCreate,
  GatewayDMessageUpdate,
  GatewayEventName,
  GatewayEventPayload,
  GatewayEvents,
  GatewayHandler,
  GatewayMessageType,
  ImagineCommand,
  InteractionPayload,
  InteractionType,
  MessageSubComponent,
  MJApplicationID,
} from './define';
import { CreateNewAxios, WSS } from '../../utils/proxyAgent';
import { AxiosInstance } from 'axios';
import { randomNonce, randomStr } from '../../utils';
import moment from 'moment';

export class Child extends ComChild<Account> {
  private ws!: WSS;
  private heartbeat_itl: NodeJS.Timeout | null = null;
  private last_heartbeat_ack: number = 1;
  private event_map: Partial<Record<GatewayEvents, GatewayHandler>> = {
    [GatewayEvents.Hello]: this.handleHello.bind(this),
  };
  private client!: AxiosInstance;
  private session_id: string = randomStr(32);
  private event_wait_map: Partial<
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

  sendEvent(e: GatewayEventPayload) {
    this.ws.send(JSON.stringify(e));
  }

  async interact(d: InteractionPayload<InteractionType>) {
    return this.client.post('/interactions', d);
  }

  async doComponent(
    message_id: string,
    info: MessageSubComponent,
    options: {
      onStart: (msg: GatewayDMessageCreate) => void;
      onUpdate: (msg: GatewayDMessageUpdate) => void;
      onEnd: (msg: GatewayDMessageCreate) => void;
      onError: (error: Error) => void;
    },
  ) {
    const nonce = randomNonce(19);
    await this.interact({
      type: InteractionType.MESSAGE_COMPONENT,
      nonce: nonce,
      guild_id: this.info.server_id,
      channel_id: this.info.channel_id,
      message_flags: 0,
      message_id: message_id,
      application_id: MJApplicationID,
      session_id: this.session_id,
      data: {
        component_type: info.component_type,
        custom_id: info.custom_id,
      },
    });
    const { onStart, onError, onEnd, onUpdate } = options;
    const mCreate = await this.waitGatewayEventNameAsync(
      GatewayEventName.MESSAGE_CREATE,
      (e: GatewayEventPayload<GatewayDMessageCreate>) => e.d.nonce === nonce,
      {},
    );
    onStart(mCreate.d);
    await this.waitGatewayEventName(
      GatewayEventName.MESSAGE_UPDATE,
      (e: GatewayEventPayload<GatewayDMessageUpdate>) =>
        e.d.type === GatewayMessageType.REPLY &&
        e.d.message_reference.message_id === message_id,
      {
        onEvent: (e) => onUpdate(e.d),
        onTimeout: () => onError(new Error(`Midjourney component timeout...`)),
      },
    );
    const removeEnd = await this.waitGatewayEventName(
      GatewayEventName.MESSAGE_CREATE,
      (e: GatewayEventPayload<GatewayDMessageCreate>) =>
        e.d.type === GatewayMessageType.REPLY &&
        e.d.message_reference.message_id === message_id,
      {
        onTimeout: () => {
          onError(new Error(`Midjourney component timeout...`));
        },
        onEvent: (e) => {
          onEnd(e.d);
          removeEnd();
        },
      },
    );
  }

  async imagine(
    prompt: string,
    options: {
      onStart: (msg: GatewayDMessageCreate) => void;
      onUpdate: (msg: GatewayDMessageUpdate) => void;
      onEnd: (msg: GatewayDMessageCreate) => void;
      onError: (error: Error) => void;
    },
  ) {
    const nonce = randomNonce(19);
    await this.interact({
      type: InteractionType.APPLICATION_COMMAND,
      application_id: MJApplicationID,
      guild_id: this.info.server_id,
      channel_id: this.info.channel_id,
      session_id: this.session_id,
      data: {
        version: ImagineCommand.version,
        id: ImagineCommand.id,
        name: ImagineCommand.name,
        type: ImagineCommand.type,
        options: [{ type: 3, name: 'prompt', value: prompt }],
        application_command: ImagineCommand,
        attachments: [],
      },
      nonce,
      analytics_location: 'slash_ui',
    });
    const { onStart, onError, onEnd, onUpdate } = options;
    const mCreate = await this.waitGatewayEventNameAsync(
      GatewayEventName.MESSAGE_CREATE,
      (e: GatewayEventPayload<GatewayDMessageCreate>) => e.d.nonce === nonce,
      {},
    );
    if (mCreate.d.embeds?.length) {
      onError(
        new Error(
          `### ${mCreate.d.embeds?.[0].title}\n\n ${mCreate.d.embeds?.[0].description}`,
        ),
      );
      return;
    }
    onStart(mCreate.d);
    const removeUpdate = await this.waitGatewayEventName(
      GatewayEventName.MESSAGE_UPDATE,
      (e: GatewayEventPayload<GatewayDMessageUpdate>) =>
        e.d.id === mCreate.d.id,
      {
        onEvent: (e) => onUpdate(e.d),
      },
    );
    const removeEnd = await this.waitGatewayEventName(
      GatewayEventName.MESSAGE_CREATE,
      (e: GatewayEventPayload<GatewayDMessageCreate>) =>
        e.d.content.indexOf(prompt) > -1 && !e.d.interaction,
      {
        timeout: 2 * 60 * 1000,
        onTimeout: () => {
          removeUpdate();
          onError(new Error(`Midjourney create image timeout...`));
        },
        onEvent: (e) => {
          onEnd(e.d);
          removeUpdate();
          removeEnd();
        },
      },
    );
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
    const { timeout = 3 * 60 * 1000, onEvent, onTimeout = () => {} } = options;
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

  initHeartbeat(heatBeatInterval: number) {
    this.identify();
    if (this.heartbeat_itl) {
      clearInterval(this.heartbeat_itl);
    }
    this.heartbeat_itl = setInterval(
      () => this.sendHeartBeat(),
      heatBeatInterval,
    );
  }

  handleHello(e: GatewayEventPayload<GatewayDHello>) {
    this.initHeartbeat(e.d.heartbeat_interval);
  }

  listenEvent(e: GatewayEventPayload<any>) {
    this.logger.info(JSON.stringify(e));
    this.event_map[e.op]?.(e);
    if (e.t) {
      const wait_map = this.event_wait_map[e.t];
      if (wait_map) {
        for (const [, v] of Object.entries(wait_map)) {
          if (v.condition(e)) {
            v.cb(e);
          }
        }
      }
    }
  }

  initWS() {
    this.ws = new WSS('wss://gateway.discord.gg/?v=10&encoding=json', {
      onOpen: () => {},
      onMessage: (v: string) => {
        this.listenEvent(JSON.parse(v));
      },
      onClose: () => {
        this.destroy({ delFile: false, delMem: true });
      },
      onError: () => {
        this.destroy({ delFile: false, delMem: true });
      },
    });
    this.client = CreateNewAxios(
      {
        baseURL: 'https://discord.com/api/v9/',
        headers: {
          Authorization: this.info.token,
        },
      },
      { proxy: 'http://192.168.0.160:10811' },
    );
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
    if (this.heartbeat_itl) {
      clearInterval(this.heartbeat_itl);
    }
    this.ws.close();
  }

  async init(): Promise<void> {
    this.initWS();
    for (const v of Object.values(GatewayEventName)) {
      this.event_wait_map[v as GatewayEventName] = {};
    }
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}
