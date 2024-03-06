import {
  Account,
  BlendCommand,
  DimensionsList,
  DimensionsType,
  getPrompt,
  ImagineCommand,
  InfoCommand,
  MJApplicationID,
  MJProfileInfo,
  parseMJProfile,
} from './define';
import { randomNonce } from '../../utils';
import { DiscordChild } from '../discord/child';
import {
  ApplicationCommandAttachment,
  ApplicationCommandOptionType,
  GatewayDMessageCreate,
  GatewayDMessageUpdate,
  GatewayEventName,
  GatewayEventPayload,
  GatewayMessageType,
  InteractionPayload,
  InteractionType,
  MessageSubComponent,
} from '../discord/define';

export class Child extends DiscordChild<Account> {
  protected application_id = MJApplicationID;
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
      const error = `### ${mCreate.d.embeds?.[0].title}\n\n ${mCreate.d.embeds?.[0].description}`;
      onError(new Error(error));
      if (
        error.toLowerCase().includes('blocked') ||
        error.toLowerCase().includes('subscription required')
      ) {
        this.update({ blocked: true });
        this.destroy({ delFile: false, delMem: true });
      }
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
      application_id: this.application_id,
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
        onTimeout: () => onError(new Error(`do component timeout...`)),
      },
    );
    const removeEnd = await this.waitGatewayEventName(
      GatewayEventName.MESSAGE_CREATE,
      (e: GatewayEventPayload<GatewayDMessageCreate>) =>
        e.d.type === GatewayMessageType.REPLY &&
        e.d.message_reference.message_id === message_id,
      {
        onTimeout: () => {
          onError(new Error(`do component timeout...`));
        },
        onEvent: (e) => {
          onEnd(e.d);
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

  async getInfo(): Promise<MJProfileInfo> {
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
  }

  async updateInfo() {
    const info = await this.getInfo();
    this.logger.info(`got profile info: ${JSON.stringify(info)}`);
    this.update({ profile: info });
    if (this.info.mode !== 'relax' && info.fastTimeRemainingMinutes === 0) {
      this.destroy({ delFile: false, delMem: true });
      throw new Error('fast time remaining 0');
    }
    this.logger.info('update info ok');
  }

  async init(): Promise<void> {
    await super.init();
    await this.updateInfo();
  }
}
