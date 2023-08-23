import axios, { AxiosInstance } from 'axios';
import { sleep } from './index';
import sharp from 'sharp';
import svg2png from 'svg2png';
import { CreateAxiosProxy } from './proxyAgent';

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

      await sleep(5000);
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
    const captchaId = await solver.sendCaptcha(
      await svgBase64ToPngBase64(base64),
    );
    const captchaResult = await solver.getCaptchaResult(captchaId);
    console.log('Captcha result:', captchaResult);
    return captchaResult;
  } catch (error: any) {
    console.error('Error:', error.message);
    return '';
  }
}

async function svgBase64ToPngBase64(svgBase64: string): Promise<string> {
  // Decode the SVG Base64 to a buffer
  const svgBuffer: Buffer = Buffer.from(svgBase64.split(',')[1], 'base64');

  // Convert SVG buffer to PNG buffer
  const pngBuffer: Buffer = await svg2png(svgBuffer);

  // Optionally, use sharp for any additional processing or resizing
  const processedPngBuffer: Buffer = await sharp(pngBuffer)
    //.resize(256, 256)  // for example, resize to 256x256 pixels
    .toBuffer();

  // Convert the PNG buffer back to Base64
  const pngBase64: string = processedPngBuffer.toString('base64');

  return pngBase64;
}
