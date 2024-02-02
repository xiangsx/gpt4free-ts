import { ComChild, DestroyOptions } from '../../utils/pool';
import {
  Account,
  ApplicationCommandAttachment,
  ApplicationCommandOptionType,
  BlendCommand,
  DimensionsList,
  DimensionsType,
  GatewayDHello,
  GatewayDMessageCreate,
  GatewayDMessageUpdate,
  GatewayEventName,
  GatewayEventPayload,
  GatewayEvents,
  GatewayHandler,
  GatewayMessageType,
  getProgress,
  getPrompt,
  ImagineCommand,
  InfoCommand,
  InteractionPayload,
  InteractionType,
  MessageSubComponent,
  MJApplicationID,
  MJProfileInfo,
  parseMJProfile,
  UploadedFileData,
  UploadFileInfo,
} from './define';
import { CreateNewAxios, WSS } from '../../utils/proxyAgent';
import { AxiosInstance } from 'axios';
import { downloadFile, parseJSON, randomNonce, randomStr } from '../../utils';
import moment from 'moment';
import fs from 'fs';

export class Child extends ComChild<Account> {
  private ws!: WSS;
  private heartbeat_itl: NodeJS.Timeout | null = null;
  private last_heartbeat_ack: number = 1;
  private event_map: Partial<Record<GatewayEvents, GatewayHandler>> = {};
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

  async upload(url: string) {
    const { file_size, file_name, outputFilePath } = await downloadFile(url);
    const res: { data: { attachments: UploadedFileData[] } } =
      await this.client.post(`/channels/${this.info.channel_id}/attachments`, {
        files: [
          {
            file_size,
            filename: file_name,
            id: `${Math.floor(Math.random() * 9999999)}`,
            is_clip: false,
          } as UploadFileInfo,
        ],
      });
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
    const content = getPrompt(mCreate.d.content) || '';
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
        e.d.content.indexOf(content) > -1 && !e.d.interaction,
      {
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

  async blend(
    image_urls: string[],
    options: {
      dimensions?: string;
      onStart: (msg: GatewayDMessageCreate) => void;
      onUpdate: (msg: GatewayDMessageUpdate) => void;
      onEnd: (msg: GatewayDMessageCreate) => void;
      onError: (error: Error) => void;
    },
  ) {
    const { onStart, onError, onEnd, onUpdate, dimensions } = options;
    const nonce = randomNonce(19);
    const data: InteractionPayload<InteractionType.APPLICATION_COMMAND> = {
      type: InteractionType.APPLICATION_COMMAND,
      application_id: MJApplicationID,
      guild_id: this.info.server_id,
      channel_id: this.info.channel_id,
      session_id: this.session_id,
      data: {
        version: BlendCommand.version,
        id: BlendCommand.id,
        name: BlendCommand.name,
        type: BlendCommand.type,
        options: [],
        application_command: BlendCommand,
        attachments: [],
      },
      nonce,
      analytics_location: 'slash_ui',
    };
    const files = await Promise.all(image_urls.map((v) => this.upload(v)));
    data.data.options.push(
      ...files.map((v, idx) => ({
        type: ApplicationCommandOptionType.ATTACHMENT,
        name: `image${idx + 1}`,
        value: idx,
      })),
    );
    data.data.attachments!.push(
      ...files.map(
        (v, idx) =>
          ({
            id: `${idx}`,
            filename: v.file_name,
            uploaded_filename: v.upload_filename,
          } as ApplicationCommandAttachment),
      ),
    );
    if (dimensions) {
      data.data.options.push({
        type: ApplicationCommandOptionType.STRING,
        name: 'dimensions',
        value: DimensionsList.includes(dimensions as DimensionsType)
          ? dimensions
          : DimensionsType.Square,
      });
    }
    await this.interact(data);
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
    const prompt = getPrompt(mCreate.d.content) || '';
    const removeUpdate = await this.waitGatewayEventName(
      GatewayEventName.MESSAGE_UPDATE,
      (e: GatewayEventPayload<GatewayDMessageUpdate>) =>
        e.d.id === mCreate.d.id && e.d.content.indexOf(prompt) > -1,
      {
        onEvent: (e) => onUpdate(e.d),
      },
    );
    const removeEnd = await this.waitGatewayEventName(
      GatewayEventName.MESSAGE_CREATE,
      (e: GatewayEventPayload<GatewayDMessageCreate>) =>
        e.d.content.indexOf(prompt) > -1,
      {
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

  async getInfo(): Promise<MJProfileInfo | undefined> {
    const nonce = randomNonce(19);
    const data: InteractionPayload<InteractionType.APPLICATION_COMMAND> = {
      type: InteractionType.APPLICATION_COMMAND,
      application_id: MJApplicationID,
      guild_id: this.info.server_id,
      channel_id: this.info.channel_id,
      session_id: this.session_id,
      data: {
        version: InfoCommand.version,
        id: InfoCommand.id,
        name: InfoCommand.name,
        type: InfoCommand.type,
        options: [],
        application_command: InfoCommand,
        attachments: [],
      },
      nonce,
      analytics_location: 'slash_ui',
    };
    try {
      await this.interact(data);
      const mCreate = await this.waitGatewayEventNameAsync(
        GatewayEventName.MESSAGE_CREATE,
        (e: GatewayEventPayload<GatewayDMessageCreate>) => e.d.nonce === nonce,
        {
          timeout: 10 * 1000,
        },
      );
      const update = await this.waitGatewayEventNameAsync(
        GatewayEventName.MESSAGE_UPDATE,
        (e: GatewayEventPayload<GatewayDMessageUpdate>) =>
          e.d.id === mCreate.d.id,
        {
          timeout: 10 * 1000,
        },
      );
      return parseMJProfile(update.d.embeds?.[0].description);
    } catch (e: any) {
      this.logger.error(e.message);
      return undefined;
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

  async updateInfo() {
    const info = await this.getInfo();
    if (!info) {
      this.destroy({ delFile: false, delMem: true });
      return;
    }
    this.logger.info(`got profile info: ${JSON.stringify(info)}`);
    this.update({ profile: info });
    if (this.info.mode !== 'relax' && info.fastTimeRemainingMinutes === 0) {
      this.destroy({ delFile: false, delMem: true });
      throw new Error('fast time remaining 0');
    }
    this.logger.info('update info ok');
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
    for (const v of Object.values(GatewayEventName)) {
      this.event_wait_map[v as GatewayEventName] = {};
    }
    this.client = CreateNewAxios(
      {
        baseURL: 'https://discord.com/api/v9/',
        headers: {
          Authorization: this.info.token,
        },
      },
      { proxy: true },
    );
    await this.initWS();
    await this.updateInfo();
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}
