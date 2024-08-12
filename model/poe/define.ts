import { ModelType } from '../base';
import { Config, PoeModelConfig } from '../../utils/config';
import { Page } from 'puppeteer';
import { PoeAuto } from '../poeauto';
import winston from 'winston';
export const InputSelector = 'textarea';
export const ClearSelector = 'footer > div > div > div > button > svg';
export const defaultModelConfig: Map<ModelType, PoeModelConfig> = new Map([
  [
    ModelType.Llama370BT,
    { context_tokens: 2400, key_name: 'Llama-3-70B-T', points: 75 },
  ],
  [ModelType.GPT4, { context_tokens: 2400, key_name: 'GPT-4', points: 350 }],
  [ModelType.GPT4o, { context_tokens: 2400, key_name: 'GPT-4o', points: 300 }],
  [
    ModelType.FluxDev,
    {
      context_tokens: 2400,
      key_name: 'FLUX-schnell',
      points: 1500,
      image: true,
    },
  ],
  [
    ModelType.FluxDev,
    { context_tokens: 2400, key_name: 'FLUX-dev', points: 1500, image: true },
  ],
  [
    ModelType.DallE3,
    { context_tokens: 2400, key_name: 'DALL-E-3', points: 1500, image: true },
  ],
  [
    ModelType.ClaudeInstant_100k,
    { context_tokens: 50000, key_name: 'Claude-instant-100k', points: 75 },
  ],
  [
    ModelType.ClaudeInstant,
    { context_tokens: 4000, key_name: 'Claude-instant', points: 30 },
  ],
  [
    ModelType.GPT3p5Turbo,
    { context_tokens: 2420, key_name: 'ChatGPT', points: 20 },
  ],
  [
    ModelType.GPT3p5TurboInstruct,
    { context_tokens: 2400, key_name: 'GPT-3.5-Turbo-Instruct', points: 20 },
  ],
  [
    ModelType.Llama_2_7b,
    { context_tokens: 3000, key_name: 'Llama-2-7b', points: 5 },
  ],
  [
    ModelType.Llama_2_13b,
    { context_tokens: 3000, key_name: 'Llama-2-13b', points: 15 },
  ],
  [
    ModelType.Llama_2_70b,
    { context_tokens: 3000, key_name: 'Llama-2-70b', points: 50 },
  ],
  [ModelType.Sage, { context_tokens: 4000, key_name: 'Assistant', points: 20 }],
  [
    ModelType.Claude3Sonnet,
    { context_tokens: 8000, key_name: 'Claude-3-Sonnet', points: 150 },
  ],
  [
    ModelType.GooglePalm,
    { context_tokens: 4000, key_name: 'Google-PaLM', points: 50 },
  ],
  [
    ModelType.Code_Llama_34b,
    { context_tokens: 16000, key_name: 'Code-Llama-34b', points: 20 },
  ],
  [
    ModelType.Code_Llama_13b,
    { context_tokens: 16000, key_name: 'Code-Llama-13b', points: 20 },
  ],
  [
    ModelType.Code_Llama_7b,
    { context_tokens: 16000, key_name: 'Code-Llama-7b', points: 15 },
  ],
  [
    ModelType.StableDiffusion,
    {
      context_tokens: 2000,
      key_name: 'StableDiffusionXL',
      points: 80,
      image: true,
    },
  ],
  [
    ModelType.Fw_mistral_7b,
    { context_tokens: 8000, key_name: 'fw-mistral-7b', points: 5 },
  ],
  [
    ModelType.Solar_0_70b,
    { context_tokens: 8000, key_name: 'Solar-0-70b', points: 1 },
  ],
  [
    ModelType.PlaygroundV2,
    {
      context_tokens: 2000,
      key_name: 'Playground-v2',
      points: 40,
      image: true,
    },
  ],
  [
    ModelType.GeminiPro,
    { context_tokens: 24000, key_name: 'Gemini-1.0-Pro', points: 40 },
  ],
  [
    ModelType.Qwen72bChat,
    { context_tokens: 8000, key_name: 'Qwen-72b-Chat', points: 15 },
  ],
  [
    ModelType.Mixtral8x7BChat,
    { context_tokens: 8000, key_name: 'Mixtral-8x7B-Chat', points: 20 },
  ],
  [
    ModelType.Claude3Haiku,
    { context_tokens: 6000, key_name: 'Claude-3-Haiku', points: 30 },
  ],
  [
    ModelType.Claude3Haiku200k,
    { context_tokens: 6000, key_name: 'Claude-3-Haiku-200k', points: 200 },
  ],
  [
    ModelType.Claude3Haiku20240307,
    { context_tokens: 6000, key_name: 'Claude-3-Haiku-200k', points: 200 },
  ],
  [
    ModelType.MistralMedium,
    { context_tokens: 24000, key_name: 'Mistral-Medium', points: 165 },
  ],
  [
    ModelType.Gemma7bFW,
    { context_tokens: 8000, key_name: 'Gemma-7b-FW', points: 5 },
  ],
  [
    ModelType.Claude2,
    { context_tokens: 80000, key_name: 'Claude-2-100k', points: 750 },
  ],
  [
    ModelType.GPT3p5_16k,
    { context_tokens: 10000, key_name: 'ChatGPT-16k', points: 120 },
  ],
  [
    ModelType.GPT4_32k,
    { context_tokens: 20000, key_name: 'GPT-4-32k', points: 2500 },
  ],
  [
    ModelType.Claude3Opus,
    { context_tokens: 8000, key_name: 'Claude-3-Opus', points: 750 },
  ],
  [
    ModelType.Claude3Opus200k,
    { context_tokens: 80000, key_name: 'Claude-3-Opus-200k', points: 1875 },
  ],
  [
    ModelType.Claude3Sonnet200k,
    { context_tokens: 80000, key_name: 'Claude-3-Sonnet-200k', points: 375 },
  ],
  [
    ModelType.Claude3p5Sonnet,
    { context_tokens: 8000, key_name: 'Claude-3.5-Sonnet', points: 200 },
  ],
  [
    ModelType.DeepSeekLLM67BT,
    { context_tokens: 5000, key_name: 'DeepSeek-LLM-67B-T', points: 30 },
  ],
  [
    ModelType.DeepSeekCoder33BT,
    { context_tokens: 5000, key_name: 'DeepSeek-Coder-33B-T', points: 110 },
  ],
  [
    ModelType.Llama370BGroq,
    { context_tokens: 5000, key_name: 'Llama-3-70B-Groq', points: 75 },
  ],
  [
    ModelType.PlaygroundV2_5,
    {
      context_tokens: 5000,
      key_name: 'Playground-V2.5',
      points: 200,
      image: true,
    },
  ],
  [
    ModelType.StableDiffusion3_2B,
    {
      context_tokens: 5000,
      key_name: 'Stable-Diffusion-3-2B',
      points: 10,
      image: true,
    },
  ],
]);

export function getModelConfig(model: ModelType) {
  const config =
    Config.config.poeauto.model_config?.[model] ||
    defaultModelConfig.get(model);
  if (!config) {
    throw new Error(`Model ${model} not found in model config`);
  }
  return config;
}

export function getModelPoints(model: ModelType) {
  return getModelConfig(model).points;
}

export function getModelName(model: ModelType) {
  return getModelConfig(model).key_name;
}

export function getModelContextTokens(model: ModelType) {
  return getModelConfig(model).context_tokens;
}

export function extractModelName(input: string): string {
  return input.replace('messages', '').trim();
}

export function isMsg(msg: string): boolean {
  if (msg === 'pong') return false;
  if (/xx.+xx/.test(msg)) return false;
  if (msg.indexOf('id-update-sincode_live') > -1) return false;
  if (msg.startsWith('h search-update')) return false;
  if (/^i\s\d+$/.test(msg)) return false;
  return true;
}

export class Poe {
  logger!: winston.Logger;
  page!: Page;
  setPage(page: Page) {
    this.page = page;
  }
  setLogger(logger: winston.Logger) {
    this.logger = logger;
  }

  async getCurrentModelName() {
    // document.querySelector("header > div > div > div > div > p").textContent
    return this.page.evaluate(
      () =>
        // @ts-ignore
        document
          .querySelector('header > div > div > div > div > p')
          ?.textContent?.trim?.() || '',
    );
  }
  async closeSub() {
    try {
      await this.page.waitForSelector(`button[aria-label="close modal"]`, {
        timeout: 3000,
      });
      await this.page.click(`button[aria-label="close modal"]`);
      this.logger.info('close sub modal ok');
    } catch (e) {
      this.logger.info('no sub modal');
    }
  }

  async gotoModel(page: Page, model: ModelType) {
    try {
      const curr = await this.getCurrentModelName();
      const target = getModelName(model);
      if (curr !== target) {
        this.logger.info(`poe now in ${curr}, target:${target}`);
        await this.page?.goto(`https://poe.com/${target}`);
        this.logger.info(`poe go to ${target} ok`);
      }
    } catch (e: any) {
      this.logger.error(`gotoModel failed, err:${e.message}`);
    }
  }

  async clearContext() {
    await this.page.waitForSelector(ClearSelector, { timeout: 10 * 60 * 1000 });
    await this.page.click(ClearSelector);
  }

  extractRemaining(text: string): { daily: number; monthly: number } {
    const dailyMatch = text.match(
      /Daily \(free\)(\d*|Not currently available) left/,
    );
    const monthlyMatch = text.match(/Monthly \(subscription\)([\d,]+) left/);

    const dailyRemaining =
      dailyMatch && dailyMatch[1] !== 'Not currently available'
        ? parseInt(dailyMatch[1], 10)
        : 0;
    const monthlyRemaining = monthlyMatch
      ? parseInt(monthlyMatch[1].replace(/,/g, ''), 10)
      : 0;

    return { daily: dailyRemaining, monthly: monthlyRemaining };
  }

  async isLogin() {
    try {
      await this.page.waitForSelector(
        `textarea[placeholder='Start a new chat']`,
        {
          timeout: 5 * 1000,
        },
      );
      return true;
    } catch (e: any) {
      return false;
    }
  }
}

export function extractPoeImageUrl(input: string): string | null {
  const regex = /!\[.*?\]\((https?:\/\/[^\s]+)\)/;
  const match = input.match(regex);
  return match ? match[1] : null;
}
