git pull origin master
yarn
# 执行 tsc 编译
/www/server/nodejs/v16.1.0/bin/tsc
pm2 delete gpt4free
pm2 start ecosystem.config.js 