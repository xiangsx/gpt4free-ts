import { ComChild } from '../../utils/pool';
import {
  Account,
  ActionRequest,
  BlendRequest,
  ComReturn,
  DiscordProperties,
  ImagineRequest,
  SwapFaceRequest,
  Task,
} from './define';
import { AxiosInstance } from 'axios';
import { CreateNewAxios } from '../../utils/proxyAgent';
import moment from 'moment/moment';

export class Child extends ComChild<Account> {
  client!: AxiosInstance;
  async init(): Promise<void> {
    if (!this.info.base_url) {
      throw new Error('base_url is required');
    }
    if (!this.info.api_key) {
      throw new Error('api_key is required');
    }
    this.client = CreateNewAxios({
      baseURL: this.info.base_url,
      headers: {
        Authorization: this.info.api_key,
      },
    });
  }

  use() {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }

  async fetchTask(id: string): Promise<Task> {
    const res: { data: any } = await this.client.get(`/mj/task/${id}/fetch`);
    if (res.data.code > 1) {
      throw new Error(res.data.description);
    }
    return res.data;
  }

  async imagine(req: ImagineRequest): Promise<ComReturn<DiscordProperties>> {
    const res: { data: ComReturn } = await this.client.post(
      '/mj/submit/imagine',
      req,
    );
    if (res.data.code > 1) {
      throw new Error(res.data.description);
    }
    return res.data;
  }

  async blend(req: BlendRequest): Promise<ComReturn<DiscordProperties>> {
    const res: { data: ComReturn } = await this.client.post(
      '/mj/submit/blend',
      req,
    );
    if (res.data.code > 1) {
      throw new Error(res.data.description);
    }
    return res.data;
  }

  async action(req: ActionRequest): Promise<ComReturn<DiscordProperties>> {
    const res: { data: ComReturn } = await this.client.post(
      '/mj/submit/action',
      req,
    );
    if (res.data.code > 1) {
      throw new Error(res.data.description);
    }
    return res.data;
  }

  async swapFace(req: SwapFaceRequest): Promise<ComReturn<DiscordProperties>> {
    const res: { data: ComReturn } = await this.client.post(
      '/mj/insight-face/swap',
      req,
    );
    if (res.data.code > 1) {
      throw new Error(res.data.description);
    }
    return res.data;
  }
}
