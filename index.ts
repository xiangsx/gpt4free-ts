import dotenv from 'dotenv';
import { Config } from './utils/config';
import { initLog } from './utils/log';
import cluster from 'cluster';
import { initCache } from './utils/cache';

process.setMaxListeners(1000); // 将限制提高到20个

dotenv.config();
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
