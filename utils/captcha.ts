import { AxiosInstance } from 'axios';
import { randomStr, sleep } from './index';
import { CreateAxiosProxy } from './proxyAgent';
import { Page } from 'puppeteer';
import CDP from 'chrome-remote-interface';
import { Config } from './config';
import fs from 'fs';
import puppeteer from 'puppeteer-extra';
import { closeOtherPages } from './puppeteer';

class CaptchaSolver {
  private readonly apiKey: string;
  private client: AxiosInstance;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = CreateAxiosProxy({ baseURL: 'http://2captcha.com' }, false);
  }

  async sendCaptcha(base64Image: string): Promise<string> {
    const response = await this.client.post(`/in.php`, {
      method: 'base64',
      key: this.apiKey,
      body: base64Image,
      json: 1,
      phrase: 1,
      min_len: 6,
      max_len: 6,
      regsense: 1,
      textinstructions:
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    });

    const data = response.data;

    if (data.status !== 1) {
      throw new Error(`Failed to send captcha: ${data.request}`);
    }

    return data.request; // This will return the captcha ID
  }

  async getCaptchaResult(captchaId: string): Promise<string> {
    let attempts = 0;

    while (attempts < 10) {
      // for example, trying 10 times before giving up
      const response = await this.client.get(`/res.php`, {
        params: {
          key: this.apiKey,
          action: 'get',
          id: captchaId,
          json: 1,
        },
      });

      const data = response.data;

      if (data.status === 1) {
        return data.request;
      }

      if (data.request !== 'CAPCHA_NOT_READY') {
        throw new Error(`Failed to retrieve captcha result: ${data.request}`);
      }

      await sleep(10000);
      attempts++;
    }

    throw new Error('Max attempts reached.');
  }
}

export async function getCaptchaCode(base64: string) {
  if (!process.env.CAPTCHA2_APIKEY) {
    throw new Error('not config CAPTCHA2_APIKEY in env');
  }
  const solver = new CaptchaSolver(process.env.CAPTCHA2_APIKEY);
  try {
    const captchaId = await solver.sendCaptcha(base64);
    const captchaResult = await solver.getCaptchaResult(captchaId);
    return captchaResult.replace(/[^a-zA-Z0-9]/g, '');
  } catch (error: any) {
    console.error('Error:', error.message);
    return '';
  }
}

export async function ifCF(page: Page) {
  try {
    await page.waitForSelector('#challenge-stage > div, #turnstile-wrapper', {
      timeout: 3 * 1000,
    });
    return true;
  } catch (e) {
    console.log('no cf');
    return false;
  }
}

export async function handleCF(
  page: Page,
  debug: boolean = false,
): Promise<Page> {
  if (!(await ifCF(page))) {
    return page;
  }
  const browser = page.browser();
  const url = page.url();
  const pageIdx = (await browser.pages()).findIndex((v) => v === page);
  const wsEndpoint = browser.wsEndpoint();
  browser.disconnect();
  console.log('handle cf start');
  const client: CDP.Client = await CDP({
    target: wsEndpoint,
  });
  try {
    const targets = await client.Target.getTargets();
    await sleep(5000);
    const target = targets.targetInfos.find((v) => v.url.indexOf(url) > -1);
    if (!target) {
      throw new Error('not found target');
    }
    const { sessionId } = await client.Target.attachToTarget({
      targetId: target.targetId,
      flatten: true,
    });

    // 设置页面尺寸
    await client.Page.enable(sessionId);
    await client.Runtime.enable(sessionId);
    await client.DOM.enable(sessionId);
    let x = 0;
    let y = 0;
    const { result } = await client.Runtime.evaluate(
      {
        expression: `
            const element = document.querySelector("#challenge-stage > div, #turnstile-wrapper");
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2 - 120; 
            const centerY = rect.top + rect.height / 2;
const redBox = document.createElement("div");
redBox.style.position = "absolute";
redBox.style.width = "32px";
redBox.style.height = "32px";
redBox.style.backgroundColor = "red";
redBox.style.left = centerX+'px';
redBox.style.top = centerY+'px';
// document.body.appendChild(redBox);
            ({centerX, centerY});
        `,
        returnByValue: true,
      },
      sessionId,
    );
    const { centerX, centerY } = (result.value as any) || {};
    if (!centerY || !centerX) {
      throw new Error('center not found');
    }
    x = centerX;
    y = centerY;

    await client.Input.dispatchMouseEvent(
      {
        type: 'mousePressed',
        x,
        y,
        button: 'left',
        clickCount: 1,
      },
      sessionId,
    );
    await client.Input.dispatchMouseEvent(
      {
        type: 'mouseReleased',
        x,
        y,
        button: 'left',
        clickCount: 1,
      },
      sessionId,
    );
    await sleep(5000);
  } catch (e) {
    await client.Browser.close();
    throw e;
  }

  console.log('handle cf end');
  const newB = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
  return (await newB.pages()).find(
    (v) => v.url().indexOf('blank') === -1,
  ) as Page;
}

export async function fuckCF(target: Page) {
  let page = target;
  for (let i = 0; i < 5; i++) {
    page = await handleCF(page);
    const gotCf = await ifCF(page);
    if (!gotCf) {
      return page;
    }
  }
  throw new Error('fuck cf');
}
