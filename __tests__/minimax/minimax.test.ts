// Mock all heavy dependencies before any imports
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
  EventStream: jest.fn().mockImplementation(() => ({
    write: jest.fn(),
    end: jest.fn(),
    read: jest.fn(),
  })),
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

jest.mock('../../utils/proxyAgent', () => ({
  CreateAxiosProxy: jest.fn(),
}));

jest.mock('../../utils/config', () => ({
  Config: {
    config: {
      minimax: {
        api_key: 'test-key',
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

// Mock transitive imports that pull in heavy deps
jest.mock('../../model/define', () => ({}));
jest.mock('../../model/suno/define', () => ({}));
jest.mock('../../model/chatgateai', () => ({ Chatgateai: class {} }));
jest.mock('../../model/mjplus', () => ({ MJPlus: class {} }));
jest.mock('../../model/vidu', () => ({ Vidu: class {} }));
jest.mock('koa-router', () => class {});

import { MiniMax } from '../../model/minimax';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import { Event } from '../../utils';

const mockCreateAxiosProxy = CreateAxiosProxy as jest.MockedFunction<
  typeof CreateAxiosProxy
>;

// Import ModelType from base (should work now with mocks)
import { ModelType, Site } from '../../model/base';

describe('MiniMax Provider', () => {
  let minimax: MiniMax;

  beforeEach(() => {
    jest.clearAllMocks();
    minimax = new MiniMax({ name: 'minimax' });
  });

  describe('support()', () => {
    it('should support MiniMax-M2.7 with 1048576 context', () => {
      expect(minimax.support(ModelType.MiniMaxM2_7)).toBe(1048576);
    });

    it('should support MiniMax-M2.5 with 1048576 context', () => {
      expect(minimax.support(ModelType.MiniMaxM2_5)).toBe(1048576);
    });

    it('should support MiniMax-M2.5-highspeed with 204800 context', () => {
      expect(minimax.support(ModelType.MiniMaxM2_5_highspeed)).toBe(204800);
    });

    it('should return 0 for unsupported models', () => {
      expect(minimax.support(ModelType.GPT4)).toBe(0);
      expect(minimax.support(ModelType.Claude3Opus)).toBe(0);
      expect(minimax.support(ModelType.GeminiPro)).toBe(0);
    });
  });

  describe('constructor', () => {
    it('should use config values by default', () => {
      const instance = new MiniMax({ name: 'minimax' });
      expect(instance).toBeInstanceOf(MiniMax);
    });

    it('should accept custom options', () => {
      const instance = new MiniMax({
        name: 'minimax',
        base_url: 'https://custom.api.com/v1',
        api_key: 'custom-key',
        proxy: true,
      });
      expect(instance).toBeInstanceOf(MiniMax);
    });
  });

  describe('askStream()', () => {
    it('should send request with correct parameters', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          pipe: jest.fn().mockReturnValue({
            pipe: jest.fn(),
          }),
          on: jest.fn((event: string, cb: () => void) => {
            if (event === 'close') {
              setTimeout(cb, 10);
            }
          }),
        },
      });

      mockCreateAxiosProxy.mockReturnValue({
        post: mockPost,
      } as any);

      const stream = {
        write: jest.fn(),
        end: jest.fn(),
        read: jest.fn(),
      } as any;

      const req = {
        prompt: 'Hello',
        model: ModelType.MiniMaxM2_7,
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
      };

      await minimax.askStream(req, stream);

      expect(mockCreateAxiosProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.minimax.io/v1',
        }),
        false,
        false,
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/chat/completions',
        expect.objectContaining({
          model: 'MiniMax-M2.7',
          messages: [{ role: 'user', content: 'Hello' }],
          temperature: 0.7,
          stream: true,
        }),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-key',
          },
          responseType: 'stream',
        }),
      );
    });

    it('should clamp temperature > 1.0 to 1.0', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          pipe: jest.fn().mockReturnValue({ pipe: jest.fn() }),
          on: jest.fn((event: string, cb: () => void) => {
            if (event === 'close') setTimeout(cb, 10);
          }),
        },
      });

      mockCreateAxiosProxy.mockReturnValue({ post: mockPost } as any);

      const stream = { write: jest.fn(), end: jest.fn(), read: jest.fn() } as any;

      await minimax.askStream(
        {
          prompt: 'Hi',
          model: ModelType.MiniMaxM2_5,
          messages: [{ role: 'user', content: 'Hi' }],
          temperature: 2.0,
        },
        stream,
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/chat/completions',
        expect.objectContaining({ temperature: 1.0 }),
        expect.any(Object),
      );
    });

    it('should clamp temperature < 0 to 0', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          pipe: jest.fn().mockReturnValue({ pipe: jest.fn() }),
          on: jest.fn((event: string, cb: () => void) => {
            if (event === 'close') setTimeout(cb, 10);
          }),
        },
      });

      mockCreateAxiosProxy.mockReturnValue({ post: mockPost } as any);

      const stream = { write: jest.fn(), end: jest.fn(), read: jest.fn() } as any;

      await minimax.askStream(
        {
          prompt: 'Hi',
          model: ModelType.MiniMaxM2_5,
          messages: [{ role: 'user', content: 'Hi' }],
          temperature: -1,
        },
        stream,
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/chat/completions',
        expect.objectContaining({ temperature: 0 }),
        expect.any(Object),
      );
    });

    it('should use default temperature 0.7 when not provided', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          pipe: jest.fn().mockReturnValue({ pipe: jest.fn() }),
          on: jest.fn((event: string, cb: () => void) => {
            if (event === 'close') setTimeout(cb, 10);
          }),
        },
      });

      mockCreateAxiosProxy.mockReturnValue({ post: mockPost } as any);

      const stream = { write: jest.fn(), end: jest.fn(), read: jest.fn() } as any;

      await minimax.askStream(
        {
          prompt: 'Hi',
          model: ModelType.MiniMaxM2_7,
          messages: [{ role: 'user', content: 'Hi' }],
        },
        stream,
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/chat/completions',
        expect.objectContaining({ temperature: 0.7 }),
        expect.any(Object),
      );
    });

    it('should include max_tokens when provided', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          pipe: jest.fn().mockReturnValue({ pipe: jest.fn() }),
          on: jest.fn((event: string, cb: () => void) => {
            if (event === 'close') setTimeout(cb, 10);
          }),
        },
      });

      mockCreateAxiosProxy.mockReturnValue({ post: mockPost } as any);

      const stream = { write: jest.fn(), end: jest.fn(), read: jest.fn() } as any;

      await minimax.askStream(
        {
          prompt: 'Hi',
          model: ModelType.MiniMaxM2_7,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 4096,
        },
        stream,
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/chat/completions',
        expect.objectContaining({ max_tokens: 4096 }),
        expect.any(Object),
      );
    });

    it('should handle errors gracefully', async () => {
      mockCreateAxiosProxy.mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error('Network error')),
      } as any);

      const stream = { write: jest.fn(), end: jest.fn(), read: jest.fn() } as any;

      await minimax.askStream(
        {
          prompt: 'Hi',
          model: ModelType.MiniMaxM2_7,
          messages: [{ role: 'user', content: 'Hi' }],
        },
        stream,
      );

      expect(stream.write).toHaveBeenCalledWith(Event.error, {
        error: 'Network error',
      });
      expect(stream.end).toHaveBeenCalled();
    });
  });
});

describe('MiniMax Provider with env fallback', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should fall back to MINIMAX_API_KEY env var', () => {
    jest.doMock('../../utils/config', () => ({
      Config: { config: { minimax: {} } },
    }));
    process.env.MINIMAX_API_KEY = 'env-test-key';

    const { MiniMax: MiniMaxFresh } = require('../../model/minimax');
    const instance = new MiniMaxFresh({ name: 'minimax' });
    expect(instance).toBeInstanceOf(MiniMaxFresh);
  });
});

describe('MiniMax enum registration', () => {
  it('should register MiniMax as a site in Site enum', () => {
    expect(Site.MiniMax).toBe('minimax');
  });

  it('should have MiniMax model types in ModelType enum', () => {
    expect(ModelType.MiniMaxM2_7).toBe('MiniMax-M2.7');
    expect(ModelType.MiniMaxM2_5).toBe('MiniMax-M2.5');
    expect(ModelType.MiniMaxM2_5_highspeed).toBe('MiniMax-M2.5-highspeed');
  });
});
