import { Context } from 'koa';
import { TraceLogger } from './utils/log';

declare module 'koa' {
  interface Context {
    logger?: TraceLogger;
  }
}
