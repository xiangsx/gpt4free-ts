/**
 * Integration tests for MiniMax provider.
 * These tests call the real MiniMax API and require MINIMAX_API_KEY env var.
 * Run with: MINIMAX_API_KEY=your-key node node_modules/jest/bin/jest.js __tests__/minimax/minimax.integration.test.ts --forceExit
 */

// Mock heavy dependencies that break in test env
jest.mock('../../utils', () => ({
  ComError: class ComError extends Error {
    static Status = {
      InternalServerError: 500,
      NotFound: 404,
      RequestTooLarge: 413,
    };
    constructor(msg: string, status?: number) {
      super(msg);
    }
  },
  Event: {
    message: 'message',
    done: 'done',
    error: 'error',
  },
  EventStream: jest.fn().mockImplementation(() => {
    const listeners: { fn: Function; doneFn: Function }[] = [];
    return {
      write: jest.fn(function (this: any, event: string, data: any) {
        listeners.forEach((l) => l.fn(event, data));
      }),
      end: jest.fn(function (this: any) {
        listeners.forEach((l) => l.doneFn());
      }),
      read: jest.fn(function (this: any, fn: Function, doneFn: Function) {
        listeners.push({ fn, doneFn });
      }),
    };
  }),
  parseJSON: (str: string, def: any) => {
    try {
      return JSON.parse(str);
    } catch {
      return def;
    }
  },
  getRandomOne: (arr: any[]) => arr[0],
  extractHttpFileURLs: () => [],
  extractHttpImageFileURLs: () => [],
  getTokenCount: () => 0,
  MessageData: {},
  ErrorData: {},
  removeRandomChars: (s: string) => s,
}));

// Use real axios for integration tests
jest.mock('../../utils/proxyAgent', () => {
  const axios = require('axios');
  return {
    CreateAxiosProxy: (config: any) => axios.create(config),
  };
});

jest.mock('../../utils/config', () => ({
  Config: {
    config: {
      minimax: {
        api_key: process.env.MINIMAX_API_KEY || '',
        base_url: 'https://api.minimax.io/v1',
        proxy: false,
      },
    },
  },
}));

jest.mock('../../utils/log', () => ({
  newLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../../model/define', () => ({}));
jest.mock('../../model/suno/define', () => ({}));
jest.mock('../../model/chatgateai', () => ({ Chatgateai: class {} }));
jest.mock('../../model/mjplus', () => ({ MJPlus: class {} }));
jest.mock('../../model/vidu', () => ({ Vidu: class {} }));
jest.mock('koa-router', () => class {});

import { MiniMax } from '../../model/minimax';
import { ModelType } from '../../model/base';
import { Event, EventStream } from '../../utils';

const API_KEY = process.env.MINIMAX_API_KEY;
const describeIfKey = API_KEY ? describe : describe.skip;

describeIfKey('MiniMax Integration Tests (requires MINIMAX_API_KEY)', () => {
  it(
    'should stream a response from MiniMax-M2.7',
    async () => {
      const minimax = new MiniMax({ name: 'minimax' });
      const stream = new (EventStream as any)();
      let content = '';
      let done = false;

      const resultPromise = new Promise<string>((resolve, reject) => {
        stream.read(
          (event: string, data: any) => {
            if (event === Event.message) {
              content += data.content || '';
            } else if (event === Event.done) {
              done = true;
            } else if (event === Event.error) {
              reject(new Error(data.error));
            }
          },
          () => {
            resolve(content);
          },
        );
      });

      await minimax.askStream(
        {
          prompt: 'Say hello in one word',
          model: ModelType.MiniMaxM2_7,
          messages: [{ role: 'user', content: 'Say hello in one word' }],
          temperature: 0.1,
          max_tokens: 32,
        },
        stream,
      );

      const result = await resultPromise;
      expect(result.length).toBeGreaterThan(0);
      expect(done).toBe(true);
    },
    30000,
  );

  it(
    'should stream a response from MiniMax-M2.5-highspeed',
    async () => {
      const minimax = new MiniMax({ name: 'minimax' });
      const stream = new (EventStream as any)();
      let content = '';
      let done = false;

      const resultPromise = new Promise<string>((resolve, reject) => {
        stream.read(
          (event: string, data: any) => {
            if (event === Event.message) {
              content += data.content || '';
            } else if (event === Event.done) {
              done = true;
            } else if (event === Event.error) {
              reject(new Error(data.error));
            }
          },
          () => {
            resolve(content);
          },
        );
      });

      await minimax.askStream(
        {
          prompt: 'What is 2+2? Reply with only the number.',
          model: ModelType.MiniMaxM2_5_highspeed,
          messages: [
            {
              role: 'user',
              content: 'What is 2+2? Reply with only the number.',
            },
          ],
          temperature: 0.1,
          max_tokens: 32,
        },
        stream,
      );

      const result = await resultPromise;
      expect(result.length).toBeGreaterThan(0);
      expect(result).toMatch(/4/);
    },
    30000,
  );

  it(
    'should handle multi-turn conversation',
    async () => {
      const minimax = new MiniMax({ name: 'minimax' });
      const stream = new (EventStream as any)();
      let content = '';

      const resultPromise = new Promise<string>((resolve, reject) => {
        stream.read(
          (event: string, data: any) => {
            if (event === Event.message) {
              content += data.content || '';
            } else if (event === Event.error) {
              reject(new Error(data.error));
            }
          },
          () => {
            resolve(content);
          },
        );
      });

      await minimax.askStream(
        {
          prompt: 'My name is Bob',
          model: ModelType.MiniMaxM2_5_highspeed,
          messages: [
            { role: 'user', content: 'My name is Bob.' },
            { role: 'assistant', content: 'Nice to meet you, Bob!' },
            {
              role: 'user',
              content: 'What is my name? Reply with just the name.',
            },
          ],
          temperature: 0.1,
          max_tokens: 32,
        },
        stream,
      );

      const result = await resultPromise;
      expect(result.toLowerCase()).toContain('bob');
    },
    30000,
  );
});
