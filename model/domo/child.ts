import {
  Account,
  AnimateCommand,
  DomoApplicationID,
  DomoProfileInfo,
  GenCommand,
  InfoCommand,
  parseMJProfile,
  VideoCommand,
} from './define';
import { randomNonce } from '../../utils';
import { DiscordChild } from '../discord/child';
import {
  ApplicationCommandOptionType,
  GatewayDInteractionSuccess,
  GatewayDMessageCreate,
  GatewayDMessageUpdate,
  GatewayEventName,
  GatewayEventPayload,
  getAllComponents,
  InteractionPayload,
  InteractionType,
  MessageSubComponent,
} from '../discord/define';

export class Child extends DiscordChild<Account> {
  protected application_id = DomoApplicationID;

  async doComponent(message_id: string, info: MessageSubComponent) {
    const nonce = randomNonce(19);
    await this.interact({
      type: InteractionType.MESSAGE_COMPONENT,
      nonce: nonce,
      guild_id: this.info.server_id,
      channel_id: this.info.channel_id,
      message_flags: 64,
      message_id: message_id,
      application_id: this.application_id,
      session_id: this.session_id,
      data: {
        type: info.type,
        values: info.values,
        component_type: info.type,
        custom_id: info.custom_id,
      },
    });
    await this.waitGatewayEventNameAsync<GatewayDInteractionSuccess>(
      GatewayEventName.INTERACTION_SUCCESS,
      (v) => v.d.nonce === nonce,
      {},
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

  async animate(image_url: string) {
    const nonce = randomNonce(19);
    const data: InteractionPayload<InteractionType.APPLICATION_COMMAND> = {
      type: InteractionType.APPLICATION_COMMAND,
      application_id: this.application_id,
      guild_id: this.info.server_id,
      channel_id: this.info.channel_id,
      session_id: this.session_id,
      data: {
        version: AnimateCommand.version,
        id: AnimateCommand.id,
        name: AnimateCommand.name,
        type: AnimateCommand.type,
        options: [],
        application_command: AnimateCommand,
        attachments: [],
      },
      nonce,
      analytics_location: 'slash_ui',
    };
    const file = await this.upload(image_url);
    data.data.options.push({
      type: ApplicationCommandOptionType.ATTACHMENT,
      name: `image`,
      value: 0,
    });
    data.data.attachments!.push({
      id: `0`,
      filename: file.file_name,
      uploaded_filename: file.upload_filename,
    });
    await this.interact(data);
    const mCreate = await this.waitGatewayEventNameAsync(
      GatewayEventName.MESSAGE_CREATE,
      (e: GatewayEventPayload<GatewayDMessageCreate>) => e.d.nonce === nonce,
      {},
    );
    return await this.waitGatewayEventNameAsync(
      GatewayEventName.MESSAGE_UPDATE,
      (e: GatewayEventPayload<GatewayDMessageCreate>) =>
        e.d.id === mCreate.d.id,
      {},
    );
  }

  async video(video_url: string, prompt: string) {
    const nonce = randomNonce(19);
    const data: InteractionPayload<InteractionType.APPLICATION_COMMAND> = {
      type: InteractionType.APPLICATION_COMMAND,
      application_id: this.application_id,
      guild_id: this.info.server_id,
      channel_id: this.info.channel_id,
      session_id: this.session_id,
      data: {
        version: VideoCommand.version,
        id: VideoCommand.id,
        name: VideoCommand.name,
        type: VideoCommand.type,
        options: [],
        application_command: VideoCommand,
        attachments: [],
      },
      nonce,
      analytics_location: 'slash_ui',
    };
    const file = await this.upload(video_url);
    data.data.options.push(
      {
        type: ApplicationCommandOptionType.ATTACHMENT,
        name: `video`,
        value: 0,
      },
      {
        type: ApplicationCommandOptionType.STRING,
        name: 'prompt',
        value: prompt,
      },
    );
    data.data.attachments!.push({
      id: `0`,
      filename: file.file_name,
      uploaded_filename: file.upload_filename,
    });
    await this.interact(data);
    const mCreate = await this.waitGatewayEventNameAsync(
      GatewayEventName.MESSAGE_CREATE,
      (e: GatewayEventPayload<GatewayDMessageCreate>) => e.d.nonce === nonce,
      {},
    );
    return await this.waitGatewayEventNameAsync(
      GatewayEventName.MESSAGE_UPDATE,
      (e: GatewayEventPayload<GatewayDMessageCreate>) =>
        e.d.id === mCreate.d.id,
      {},
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
    if (
      this.info.mode !== 'relax' &&
      info.subscriptionCreditsBalance + info.paidCreditsBalance === 0
    ) {
      this.destroy({ delFile: false, delMem: true });
      throw new Error('fast time remaining 0');
    }
    this.logger.info('update info ok');
  }

  async init(): Promise<void> {
    await super.init();
    await this.updateInfo();
  }

  async createVideo(options: { image_url?: string; video_url?: string }) {
    const { image_url, video_url } = options || {};
    if (!image_url && !video_url) {
      throw new Error('no image_url or video_url');
    }
    if (image_url) {
      const msg1 = await this.animate(image_url);
      const componentStyle = getAllComponents(msg1.d.components).find((v) =>
        v.label?.includes('Intensity: low'),
      );
      if (!componentStyle) {
        throw new Error('no component');
      }
      await this.doComponent(msg1.d.id, componentStyle);
      const componentTime = getAllComponents(msg1.d.components).find((v) =>
        v.label?.includes('Gen 5s'),
      );
      if (!componentTime) {
        throw new Error('no component');
      }
      await this.doComponent(msg1.d.id, componentTime);
      const componentStart = getAllComponents(msg1.d.components).find((v) =>
        v.label?.includes('Start'),
      );
      if (!componentStart) {
        throw new Error('no component');
      }
      await this.doComponent(msg1.d.id, componentStart);
      const placeholder = msg1.d.attachments?.[0].placeholder;
      const msg2 = await this.waitGatewayEventNameAsync<GatewayDMessageCreate>(
        GatewayEventName.MESSAGE_UPDATE,
        (v) => {
          this.logger.info('======', v.d.attachments?.[1]?.placeholder);
          return v.d.attachments?.[1]?.placeholder === placeholder;
        },
        { timeout: 10 * 60 * 1000 },
      );
      return msg2;
    }
  }
}
