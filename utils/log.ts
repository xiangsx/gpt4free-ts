import path from 'path';
import winston, { Logger } from 'winston';
// @ts-ignore
import Transport from 'winston-transport';
import { Socket } from 'dgram';
import * as dgram from 'dgram';
import { format } from 'util';
import moment from 'moment';
import { Config } from './config';
import { ecsFields, ecsFormat } from '@elastic/ecs-winston-format';
import { colorLabel } from './index';
import { ChatRequest } from '../model/base';
import * as net from 'node:net';

let logger: Logger;

export const initLog = () => {
  const logDir = path.join(process.cwd(), 'run/logs');

  const transports: any[] = [];
  if (process.env.LOG_CONSOLE !== '0') {
    transports.push(
      new winston.transports.Console({
        format: winston.format.colorize(),
      }),
    );
  }
  if (process.env.LOG_FILE !== '0') {
    transports.push(
      // 写入所有日志记录到 `combined.log`
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
      }),
      // 写入所有级别为 error 的日志记录和以下到 `error.log`
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'warn',
      }),
    );
  }
  if (process.env.LOG_ELK === '1') {
    const port = +(process.env.LOG_ELK_PORT || 28777);
    const host = process.env.LOG_ELK_HOST || '';
    if (!host) {
      throw new Error('LOG_ELK_HOST is required');
    }
    console.log(`init winston elk ${host} ${port}`);
    transports.push(
      new UDPTransport({
        host,
        port,
        format: ecsFields(),
      }),
    );
  }
  winston.exceptions.handle(
    new winston.transports.Console({
      format: winston.format.colorize(),
    }),
  );
  winston.exitOnError = false;
  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info', // 从环境变量中读取日志等级，如果没有设置，则默认为 'info'
    format: winston.format.combine(
      ecsFormat(),
      winston.format((info, opts) => {
        info.sn = info['trace.id'];
        return info;
      })(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // 添加时间戳
      winston.format.prettyPrint(), // 打印整个日志对象
      winston.format.splat(), // 支持格式化的字符串
      winston.format.printf(({ level, message, timestamp, site, sn }) => {
        const labelStr = site ? ` [${colorLabel(site)}]` : '';
        return `${timestamp} ${level} ${
          sn ? `[${sn}]` : ''
        }:${labelStr} ${message}`; // 自定义输出格式
      }),
    ),
    transports: transports,
  });
  replaceConsoleWithWinston();
};

function replaceConsoleWithWinston(): void {
  const logger: Logger = newLogger();

  // 替换所有 console 方法
  console.log = (...msg) => logger.info(format(...msg));

  console.error = (...msg) => logger.error(format(...msg));

  console.warn = (...msg) => logger.warn(format(...msg));

  console.debug = (...msg) => logger.debug(format(...msg));
}

export function newLogger(site?: string, extra?: Record<string, string>) {
  const log = logger.child({ site, ...extra });
  log.exitOnError = false;
  return log;
}

export class TraceLogger {
  private logger: Logger;
  // ms 时间戳
  private start_time: number = moment().valueOf();

  constructor() {
    this.logger = logger.child({ trace_type: 'request' });
    logger.exitOnError = false;
  }

  info(msg: string, meta: any) {
    if (!Config.config.global.trace) {
      return;
    }
    this.logger.info(msg, meta, {
      time_label: moment().valueOf() - this.start_time,
    });
  }
}

interface UDPTransportOptions extends Transport.TransportStreamOptions {
  port: number;
  host: string;
}

export class UDPTransport extends Transport {
  private client: Socket;
  private options: { port: number; host: string };

  constructor(options: UDPTransportOptions) {
    super(options as Transport.TransportStreamOptions);
    this.options = {
      host: options.host,
      port: options.port,
    };

    this.client = dgram.createSocket('udp4');
    this.client.unref();
  }

  log(
    info: any,
    callback: (error: Error | null, bytes: number | boolean) => void,
  ): void {
    this.sendLog(info, (err: Error | null) => {
      this.emit('logged', !err);
      callback(err, !err);
    });
  }

  close(): void {
    this.client.disconnect();
  }

  private sendLog(
    info: any,
    callback: (error: Error | null, bytes?: number | boolean) => void,
  ): void {
    let buffer: Buffer = Buffer.from(JSON.stringify(info));

    // 设置UDP数据包的最大长度
    const MAX_UDP_SIZE = 5000; // 这个值根据您的网络环境可能需要调整

    // 如果数据包大小超过最大长度，则截取
    if (buffer.length > MAX_UDP_SIZE) {
      buffer = buffer.slice(0, MAX_UDP_SIZE);
    }

    /* eslint-disable @typescript-eslint/no-empty-function */
    this.client.send(
      buffer,
      0,
      buffer.length,
      this.options.port,
      this.options.host,
      callback || function () {},
    );
    /* eslint-enable @typescript-eslint/no-empty-function */
  }
}

let client: net.Socket | undefined;

export async function SaveMessagesToLogstash(
  msg: ChatRequest,
  other: { [key: string]: any } = {},
) {
  const { enable = false, host, port } = Config.config.global?.msg_saver || {};
  if (!enable || !port || !host) {
    return;
  }
  if (!client) {
    client = new net.Socket();
    client.connect(port, host, () => {
      console.log('Connected to Logstash via TCP');
    });

    client.on('error', (err) => {
      console.error(`TCP connection error: ${err.message}`);
      client?.destroy();
      client = undefined;
    });
  }
  return new Promise((resolve, reject) => {
    const message =
      JSON.stringify({
        ...msg,
        prompt: undefined,
        type: 'chat',
        '@timestamp': new Date().toISOString(),
      }) + '\n';
    client?.write(message, 'utf8', (err) => {
      if (err) {
        console.error(`Failed to send log: ${err.message}`);
        client?.destroy();
        client = undefined;
      }
      resolve(null);
    });
  });
}
