import { ComChild } from '../../utils/pool';
import { Account } from './define';
import { Page } from 'puppeteer';
import { CreateNewPage, WSS } from '../../utils/proxyAgent';
import { v4 } from 'uuid';
import { randomStr } from '../../utils';
import moment from 'moment';

export class Child extends ComChild<Account> {
  private page!: Page;
  private wss!: WSS;

  async init(): Promise<void> {
    const page = await CreateNewPage('https://www.bing.com/chat');
    this.page = page;
    await this.createConversation();
  }

  async getIP(): Promise<string> {
    const ipInfo: any = await this.page.evaluate(
      () =>
        new Promise((resolve, reject) =>
          fetch('https://api.ipify.org?format=json')
            .then((res) => res.json().then(resolve).catch(reject))
            .catch(reject),
        ),
    );
    return ipInfo.ip;
  }

  async createConversation() {
    const res = await this.fetch<{
      data: {
        conversationId: string;
        clientId: string;
        result: { value: string; message: null | string };
      };
      sign: string;
    }>('/turing/conversation/create?bundleVersion=1.1573.3');
    return res;
  }

  async createMessage(
    conversationId: string,
    clientId: string,
    prompt: string,
  ) {
    const requestId = v4();
    return `{"arguments":[{"source":"cib","optionsSets":["nlu_direct_response_filter","deepleo","disable_emoji_spoken_text","responsible_ai_policy_235","enablemm","dv3sugg","iyxapbing","iycapbing","galileo","saharagenconv5","bicfluxv3","langdtwb","papynoapi","gndlogcf","gndbfptlw","eredirecturl"],"allowedMessageTypes":["ActionRequest","Chat","ConfirmationCard","Context","InternalSearchQuery","InternalSearchResult","Disengaged","InternalLoaderMessage","Progress","RenderCardRequest","RenderContentRequest","AdsQuery","SemanticSerp","GenerateContentQuery","SearchQuery","GeneratedCode"],"sliceIds":["sappbcbt","rankcf","291encacheas","designer2cf","defred","cmcpupsalltf","cdxsyddp2","0209bicv3","130memrevs0","116langwb","etlogcf","0131onthda","0208papynoa","sapsgrds0","0131gndbfpr","enter4nlcf","exptone","cacfastapis"],"verbosity":"verbose","scenario":"SERP","plugins":[],"traceId":"${randomStr(
      32,
    )}","conversationHistoryOptionsSets":["autosave","savemem","uprofupd","uprofgen"],"isStartOfSession":true,"requestId":"${requestId}","message":{"locale":"en-US","market":"en-US","region":"US","location":"lat:47.639557;long:-122.128159;re=1000m;","locationHints":[{"SourceType":1,"RegionType":2,"Center":{"Latitude":40.75849914550781,"Longitude":-111.88809967041016},"Radius":24902,"Name":"Salt Lake City, Utah","Accuracy":24902,"FDConfidence":0.5,"CountryName":"United States","CountryConfidence":8,"Admin1Name":"Utah","PopulatedPlaceName":"Salt Lake City","PopulatedPlaceConfidence":5,"PostCodeName":"84189","UtcOffset":-7,"Dma":770}],"userIpAddress":"23.142.200.157","timestamp":"${new Date().toString()}","author":"user","inputMethod":"Keyboard","text":"${prompt}","messageType":"Chat","requestId":"${requestId}","messageId":"${requestId}"},"tone":"Balanced","spokenTextMode":"None","conversationId":"${conversationId}","participant":{"id":"${clientId}"}}],"invocationId":"5","target":"chat","type":4}`;
  }

  async fetch<T>(url: string): Promise<T> {
    return (await this.page.evaluate(
      (url) =>
        new Promise((resolve, reject) => {
          fetch(`https://www.bing.com${url}`, {
            headers: {
              accept: 'application/json',
              'accept-language': 'en-US,en;q=0.9',
              'cache-control': 'no-cache',
              pragma: 'no-cache',
              preferanonymous: '1',
              // 'x-edge-shopping-flag': '0',
              // 'x-ms-client-request-id': '3dca6648-4808-4f6e-a624-460bd6f0b87c',
              // 'x-ms-useragent':
              //   'azsdk-js-api-client-factory/1.0.0-beta.1 core-rest-pipeline/1.12.3 OS/macOS',
            },
            referrer: 'https://www.bing.com/chat?q=Bing+AI&FORM=hpcodx',
            referrerPolicy: 'origin-when-cross-origin',
            body: null,
            method: 'GET',
            mode: 'cors',
            credentials: 'include',
          })
            .then((res) =>
              res
                .json()
                .then((v) =>
                  resolve({
                    data: v,
                    sign: res.headers.get(
                      'X-Sydney-Encryptedconversationsignature',
                    ),
                  }),
                )
                .catch(reject),
            )
            .catch(reject);
        }),
      url,
    )) as T;
  }

  use() {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}
