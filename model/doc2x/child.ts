import { ComChild } from '../../utils/pool';
import { Account, PageData, StatusData } from './define';
import { CreateNewAxios } from '../../utils/proxyAgent';
import moment from 'moment/moment';
import { Event, EventStream, parseJSON } from '../../utils';
import es from 'event-stream';
import FormData from 'form-data';
import { AxiosInstance } from 'axios';

export class Child extends ComChild<Account> {
  client!: AxiosInstance;
  async init(): Promise<void> {
    this.client = CreateNewAxios(
      {
        baseURL: 'https://api.doc2x.noedgeai.com',
        headers: { Authorization: `Bearer ${this.info.apikey}` },
      },
      {
        errorHandler: (err) => {
          this.logger.error(
            `client error:${JSON.stringify({
              message: err.message,
              data: err?.response?.data,
              status: err.status,
            })}`,
          );
        },
      },
    );
  }

  async pdfToStream(form: FormData, stream: EventStream) {
    const res = await this.client.post('/api/v1/pdf', form, {
      headers: { ...form.getHeaders(), Accept: 'text/event-stream' },
      responseType: 'stream',
    });
    return res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
      es.map(async (chunk: any, cb: any) => {
        const dataStr = chunk.replace('data: ', '');
        if (!dataStr) {
          return;
        }
        if (dataStr === '[DONE]') {
          return;
        }
        const data = parseJSON<StatusData>(dataStr, {} as any);
        cb(null, data);
      }),
    );
  }

  async pdfToMDStream(form: FormData, stream: EventStream) {
    const pt = await this.pdfToStream(form, stream);
    pt.on('data', (data: StatusData) => {
      if (data.code) {
        stream.write(Event.message, { content: `${data.code}:${data.msg}` });
        stream.write(Event.done, { content: '' });
        stream.end();
        pt.destroy();
        return;
      }
      if (data.status === 'pages limit exceeded') {
        stream.write(Event.error, { error: 'pages limit exceeded' });
        stream.write(Event.done, { content: '' });
        stream.end();
        pt.destroy();
        return;
      }
      if (data.status !== 'success') {
        stream.write(Event.message, { content: '' });
        return;
      }
      const page = data.data.pages as PageData[];
      stream.write(Event.message, { content: page.map((v) => v.md).join('') });
      stream.write(Event.done, { content: '' });
      stream.end();
      pt.destroy();
    });
  }

  async pdfToMDWithProgressStream(form: FormData, stream: EventStream) {
    const pt = await this.pdfToStream(form, stream);
    pt.on('data', (data: StatusData) => {
      if (data.code) {
        stream.write(Event.message, { content: `${data.code}:${data.msg}` });
        stream.write(Event.done, { content: '' });
        stream.end();
        pt.destroy();
        return;
      }
      if (data.status === 'pages limit exceeded') {
        stream.write(Event.error, { error: 'pages limit exceeded' });
        stream.write(Event.done, { content: '' });
        stream.end();
        pt.destroy();
        return;
      }
      if (data.status !== 'success') {
        stream.write(Event.message, {
          content: `- 进度 ***${Math.floor(data.data.progress)}***\n`,
        });
        return;
      }
      const page = data.data.pages as PageData[];
      stream.write(Event.message, { content: page.map((v) => v.md).join('') });
      stream.write(Event.done, { content: '' });
      stream.end();
      pt.destroy();
    });
  }

  async pdfToJSONStream(form: FormData, stream: EventStream) {
    const pt = await this.pdfToStream(form, stream);
    pt.on('data', (data: StatusData) => {
      if (data.code) {
        stream.write(Event.message, { content: `${data.code}:${data.msg}` });
        stream.write(Event.done, { content: '' });
        stream.end();
        pt.destroy();
        return;
      }
      stream.write(Event.message, { content: JSON.stringify(data) });
      stream.write(Event.done, { content: '' });
      stream.end();
      pt.destroy();
    });
  }

  use() {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}
