import { ComChild } from '../../utils/pool';
import { Account, GenerationResponse, GenRequestOptions } from './define';
import { AxiosInstance } from 'axios';
import { CreateNewAxios, CreateNewPage } from '../../utils/proxyAgent';
import FormData from 'form-data';
import { Page, Protocol, Puppeteer } from 'puppeteer';
import moment from 'moment';

export class Child extends ComChild<Account> {
  private client!: AxiosInstance;
  private page!: Page;

  async init() {
    if (!this.info.token) {
      throw new Error('token is empty');
    }
    const cookies: Protocol.Network.CookieParam[] = [];
    for (const v in this.info.cookies) {
      cookies.push({
        name: v,
        value: this.info.cookies[v],
        domain: 'pika.art',
      });
    }
    const page = await CreateNewPage('https://pika.art/my-library/', {
      simplify: true,
      cookies,
    });
    this.page = page;
    this.client = CreateNewAxios(
      {
        baseURL: 'https://api.pika.art/',
        headers: {
          Authorization: `Bearer ${this.info.token}`,
        },
      },
      { proxy: true },
    );
  }

  use() {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }

  async generate(prompt: string) {
    const formData = new FormData();
    const options: GenRequestOptions = {
      aspectRatio: 1.7777777777777777,
      frameRate: 24,
      camera: {},
      parameters: {
        guidanceScale: 12,
        motion: 1,
        negativePrompt: '',
      },
      extend: false,
    };

    formData.append('promptText', prompt);
    formData.append('options', JSON.stringify(options));
    formData.append('userId', 'd20e3cd4-dd23-474e-88b5-75e0a0e950af');
    const res: { data: GenerationResponse } = await this.client.post(
      '/generate',
      formData,
      { ...formData.getHeaders() },
    );
    if (res.data.data.generation.id) {
    }
    return this.info.id + '|' + res.data.data.generation.id;
  }

  async fetchVideo(id: string) {
    return await this.page.evaluate((id) => {
      const selectors = document.querySelectorAll('video > source');
      // @ts-ignore
      const src_list = [];
      selectors.forEach((v) => {
        src_list.push(v.getAttribute('src'));
      });
      // @ts-ignore
      return src_list.find((v) => v.indexOf(id) !== -1);
    }, id);
  }
}
