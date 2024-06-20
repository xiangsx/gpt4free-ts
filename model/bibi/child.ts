import { ComChild } from '../../utils/pool';
import {
  Account,
  ChapterSummaryReq,
  ChapterSummaryRes,
  ChatReq,
  ChatRes,
  ExpressReq,
  ExpressRes,
  PageData,
  StatusData,
  SubtitleReq,
  SubtitleRes,
  SummaryReq,
  SummaryRes,
  VisionReq,
  VisionRes,
} from './define';
import { CreateNewAxios } from '../../utils/proxyAgent';
import moment from 'moment/moment';
import { AxiosInstance } from 'axios';

export class Child extends ComChild<Account> {
  client!: AxiosInstance;

  async init(): Promise<void> {
    this.client = CreateNewAxios(
      {
        baseURL: `https://bibigpt.co/api/open/${this.info.api_key}`,
        timeout: 5 * 60 * 1000,
      },
      {
        errorHandler: (e) => {
          this.logger.error(`axios failed: ${e.message}`);
        },
      },
    );
  }

  async summary(req: SummaryReq) {
    req.limitation = { maxDuration: 60 * 60 };
    const res: { data: SummaryRes } = await this.client.post('/', req);
    // 如果最后一行包含有bibigpt链接，则去掉最后一行
    const lastLine = res.data.summary.split('\n').pop();
    delete res.data.htmlUrl;
    if (lastLine && lastLine.includes('bibigpt')) {
      res.data.summary = res.data.summary.split('\n').slice(0, -1).join('\n');
    }
    return res.data as SummaryRes;
  }

  async chapterSummary(req: ChapterSummaryReq) {
    const res = await this.client.get('/chapter-summary', { params: req });
    delete res.data.htmlUrl;
    return res.data as ChapterSummaryRes;
  }

  async subtitle(req: SubtitleReq) {
    const res = await this.client.get('/subtitle', { params: req });
    return res.data as SubtitleRes;
  }

  async chat(req: ChatReq) {
    const res = await this.client.get('/chat', { params: req });
    return res.data as ChatRes;
  }

  async express(req: ExpressReq) {
    const res = await this.client.get('/express', { params: req });
    return res.data as ExpressRes;
  }

  async vision(req: VisionReq) {
    const res = await this.client.get('/express', { params: req });
    return res.data as VisionRes;
  }

  use() {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}
