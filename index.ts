import { initLog } from './utils/log';

require('dotenv').config();
require('elastic-apm-node').start({
  serverUrl: process.env['apm.serverUrl'],
  serviceName: process.env['apm.serviceName'],
  environment: process.env['apm.environment'],
  transactionSampleRate: parseInt(
    process.env['apm.transactionSampleRate'] || '1',
  ),
});
import 'heapdump';
import cluster from 'node:cluster';
import { Config } from './utils/config';
import { initCache } from './utils/cache';

process.setMaxListeners(1000); // 将限制提高到20个
initLog();
Config.load();
Config.watchFile();
initCache();

if (cluster.isPrimary) {
  console.log(`Master ${process.pid} is running`);
  const workers = +(process.env.WORKERS || 1);

  // Fork workers.
  for (let i = 0; i < workers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died,sig: ${signal}`);
    console.log('Forking a new process...');
    cluster.fork(); // Fork a new process if a worker dies
  });
} else {
  require('./router').registerApp();
}
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  setTimeout(() => process.exit(1), 5000); // It's up to you whether to exit here or not
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at ', promise, `reason: ${reason}`);
  setTimeout(() => process.exit(1), 5000); // It's up to you whether to exit here or not
});
