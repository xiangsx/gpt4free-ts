import {
  Account,
  DomoApplicationID,
  GenCommand,
  InfoCommand,
  DomoProfileInfo,
  parseMJProfile,
} from './define';
import { randomNonce } from '../../utils';
import { DiscordChild } from '../discord/child';
import {
  ApplicationCommandOptionType,
  GatewayDMessageCreate,
  GatewayDMessageUpdate,
  GatewayEventName,
  GatewayEventPayload,
  InteractionPayload,
  InteractionType,
  MessageSubComponent,
} from '../discord/define';

export class Child extends DiscordChild<Account> {
  protected application_id = DomoApplicationID;
  async doComponent(
    prompt: string,
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
      (e: GatewayEventPayload<GatewayDMessageCreate>) =>
        e.d.content.indexOf(prompt) > -1,
      {},
    );
    onStart(mCreate.d);
    const removeEnd = await this.waitGatewayEventName(
      GatewayEventName.MESSAGE_UPDATE,
      (e: GatewayEventPayload<GatewayDMessageCreate>) =>
        e.d.content.indexOf(prompt) > -1,
      {
        onTimeout: () => {
          removeEnd();
          onError(new Error(`do component timeout...`));
        },
        onEvent: (e) => {
          removeEnd();
          onEnd(e.d);
        },
      },
    );
  }

  async gen(
    prompt: string,
    options: {
      image_url?: string;
      model?: number;
      onStart: (msg: GatewayDMessageCreate) => void;
      onEnd: (msg: GatewayDMessageCreate) => void;
      onError: (error: Error) => void;
    },
  ) {
    const { onStart, onError, onEnd, model, image_url } = options;
    const nonce = randomNonce(19);
    const data: InteractionPayload<InteractionType.APPLICATION_COMMAND> = {
      type: InteractionType.APPLICATION_COMMAND,
      application_id: this.application_id,
      guild_id: this.info.server_id,
      channel_id: this.info.channel_id,
      session_id: this.session_id,
      data: {
        version: GenCommand.version,
        id: GenCommand.id,
        name: GenCommand.name,
        type: GenCommand.type,
        options: [{ type: 3, name: 'prompt', value: prompt }],
        application_command: GenCommand,
        attachments: [],
      },
      nonce,
      analytics_location: 'slash_ui',
    };
    if (model) {
      data.data.options.push({
        type: ApplicationCommandOptionType.INTEGER,
        name: `model`,
        value: model,
      });
    }
    if (image_url) {
      const file = await this.upload(image_url);
      data.data.options.push({
        type: ApplicationCommandOptionType.ATTACHMENT,
        name: `img2img`,
        value: 0,
      });
      data.data.attachments!.push({
        id: `0`,
        filename: file.file_name,
        uploaded_filename: file.upload_filename,
      });
    }
    await this.interact(data);
    const mCreate = await this.waitGatewayEventNameAsync(
      GatewayEventName.MESSAGE_CREATE,
      (e: GatewayEventPayload<GatewayDMessageCreate>) =>
        e.d.content.indexOf(prompt) > -1,
      {},
    );
    onStart(mCreate.d);
    const removeEnd = await this.waitGatewayEventName(
      GatewayEventName.MESSAGE_UPDATE,
      (e: GatewayEventPayload<GatewayDMessageCreate>) =>
        e.d.content.indexOf(prompt) > -1,
      {
        onTimeout: () => {
          onError(new Error(`Midjourney create image timeout...`));
        },
        onEvent: (e) => {
          onEnd(e.d);
          removeEnd();
        },
      },
    );
  }

  async getInfo(): Promise<DomoProfileInfo> {
    const nonce = randomNonce(19);
    const data: InteractionPayload<InteractionType.APPLICATION_COMMAND> = {
      type: InteractionType.APPLICATION_COMMAND,
      application_id: this.application_id,
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
    if (this.info.mode !== 'relax' && info.subscriptionCreditsBalance === 0) {
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
