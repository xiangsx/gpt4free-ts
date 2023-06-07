// pm2 配置
module.exports = {
  apps: [
    {
      name: "gpt4free",
      script: "./dist/src/app.js",
      args: "",
      instances: 1,
      autorestart: true,
      watch: true,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
