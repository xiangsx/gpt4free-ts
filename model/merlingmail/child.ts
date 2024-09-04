import { Child } from '../merlin/child';
import { CreateNewPage } from '../../utils/proxyAgent';
import { sleep } from '../../utils';
import moment from 'moment/moment';
import { loginGoogle } from '../../utils/puppeteer';

export class MerlinGmailChild extends Child {
  async init(): Promise<void> {
    let page = await CreateNewPage('https://accounts.google.com', {
      recognize: true,
    });
    await sleep(5000);
    await loginGoogle(page, this.info.email, this.info.password);
    await sleep(5000);
    await page.goto('https://app.getmerlin.in/login');
    const frame = page.mainFrame();
    await sleep(10 * 60 * 1000);
    await page.waitForSelector('body > div > div > button:nth-child(2)');
    await page.click('body > div > div > button:nth-child(2)');
    await sleep(1000);
    await page.waitForSelector('main > div > div > div > div > button');
    await page.click('main > div > div > div > div > button');
    await sleep(20000);
    this.logger.info('get loginToken ...');
    const loginStatus = await this.getLoginStatus(page);
    if (!loginStatus || !loginStatus.token) {
      throw new Error('get login status failed');
    }
    if (!loginStatus.left || loginStatus.left < 10) {
      this.update({ left: loginStatus.left || 0 });
      throw new Error(`left size:${loginStatus.left} < 10`);
    }
    await sleep(2000);
    this.logger.info('get session ...');
    await this.getSession(loginStatus.token);
    this.update({
      left: loginStatus.left,
      tokenGotTime: moment().unix(),
    });
    this.page
      ?.browser()
      .close()
      .catch((err) => this.logger.error(err.message));
  }
}
