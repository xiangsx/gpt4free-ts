import path from 'path';
import winston, { Logger } from 'winston';
import { colorLabel } from './index';
// @ts-ignore
import Transport from 'winston-transport';
import { Socket } from 'dgram';
import * as dgram from 'dgram';

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
    const node = process.env.LOG_ELK_NODE || '';
    if (!host) {
      throw new Error('LOG_ELK_HOST is required');
    }
    console.log(`init winston elk ${host} ${port} ${node}`);
    transports.push(
      new UDPTransport({
        host,
        port,
        format: winston.format((info, opts) => {
          info.node = node;
          return info;
        })(),
      }),
    );
  }
  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info', // 从环境变量中读取日志等级，如果没有设置，则默认为 'info'
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // 添加时间戳
      winston.format.prettyPrint(), // 打印整个日志对象
      winston.format.splat(), // 支持格式化的字符串
      winston.format.printf(({ level, message, timestamp, site }) => {
        const labelStr = site ? ` [${colorLabel(site)}]` : '';
        return `${timestamp} ${level}:${labelStr} ${message}`; // 自定义输出格式
      }),
    ),
    transports: transports,
  });
  replaceConsoleWithWinston();
};

function replaceConsoleWithWinston(): void {
  const logger: Logger = newLogger();

  // 替换所有 console 方法
  console.log = (...msg) =>
    logger.info(`${msg.map((v) => v.toString()).join(' ')}`);
  console.error = (...msg) =>
    logger.error(`${msg.map((v) => v.toString()).join(' ')}`);
  console.warn = (...msg) =>
    logger.warn(`${msg.map((v) => v.toString()).join(' ')}`);
  console.debug = (...msg) =>
    logger.debug(`${msg.map((v) => v.toString()).join(' ')}`);
}

export function newLogger(site?: string) {
  return logger.child({ site });
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
    const buffer: Buffer = Buffer.from(JSON.stringify(info));
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
