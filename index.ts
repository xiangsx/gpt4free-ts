import Koa, { Context, Middleware, Next } from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import { ChatModelFactory } from './model';
import dotenv from 'dotenv';
import {
  ChatRequest,
  ChatResponse,
  Message,
  ModelType,
  Site,
} from './model/base';
import {
  ClaudeEventStream,
  ComError,
  Event,
  EventStream,
  getTokenCount,
  OpenaiEventStream,
  parseJSON,
  randomStr,
  ThroughEventStream,
} from './utils';
import moment from 'moment';
import { Config } from './utils/config';
import { initLog } from './utils/log';
import cluster from 'cluster';

process.setMaxListeners(1000); // 将限制提高到20个

dotenv.config();
initLog();
Config.load();
Config.watchFile();

if (cluster.isPrimary) {
  console.log(`Master ${process.pid} is running`);
  const workers = +(process.env.WORKERS || 1);

  // Fork workers.
  for (let i = 0; i < workers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
    console.log('Forking a new process...');
    cluster.fork(); // Fork a new process if a worker dies
  });
} else {
  require('./router').registerApp();
}

(async () => {
  process.on('uncaughtException', (e) => {
    console.error('uncaught exception, exit after 5s! err=', e);
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  });
})();
