[English](README.md)

<p>你可以加入 <a href="https://discord.gg/bbH68Kzm">discord.gg/gptgod<a>获取最新的项目进展. <a href="https://discord.gg/bbH68Kzm"><img align="center" alt="gpt4free Discord" width="22px" src="https://raw.githubusercontent.com/peterthehan/peterthehan/master/assets/discord.svg" /></a></p>

## 示例项目 [GPTGOD](http://gptgod.site)

### GPTGOD 现已支持

- [x] Midjourney 史上最强的AI画图
- [x] Stable Diffusion 史上最强的开源AI画图
- [x] Claude 仅次于gpt4的AI语言模型
- [x] Chatgpt 都知道
- [x] Chatgpt with internet 联网的chatgpt
- [x] 以上所有功能，都能在网站中，一个步骤集成到微信机器人中

GPTGOD 会在稳定之后，完全开源，如果你感兴趣的话请关注我

## 目标

拼命更新中，期待您的PR....

下面是已经可以转成api的网站:
如果你发现你的网站在此列表，并且不想他出现，请联系我去除
|model|support|status|active time|
|--|--|--|--|
|[ai.mcbbs.gq](https://ai.mcbbs.gq)|gpt3.5|![Active](https://img.shields.io/badge/Active-brightgreen)|after 2023-06-03|
|[forefront.ai](https://chat.forefront.ai)|GPT-4/gpt3.5|![Active](https://img.shields.io/badge/Active-brightgreen)|after 2023-06-03|
|[aidream](http://aidream.cloud)|GPT-3.5|![Active](https://img.shields.io/badge/Active-brightgreen)|after 2023-05-12|
|[you.com](you.com)|GPT-3.5|![Active](https://img.shields.io/badge/Active-brightgreen)|after 2023-05-12
|[phind.com](https://www.phind.com/)|GPT-4 / Internet / good search|![Active](https://img.shields.io/badge/Active-grey)|
|[bing.com/chat](bing.com/chat)|GPT-4/3.5||
|[poe.com](poe.com)| GPT-4/3.5||
|[writesonic.com](writesonic.com)| GPT-3.5 / Internet||
|[t3nsor.com](t3nsor.com)|GPT-3.5||

## 本地运行

```shell
# install module
yarn
# start server
yarn start
```

## 使用Docker运行

### 1. 首先创建环境文件 `.env`

```env
http_proxy=http://host:port
# 如果你使用forefront的话，`rapid_api_key` 必填
# 这里获取 https://rapidapi.com/calvinloveland335703-0p6BxLYIH8f/api/temp-mail44
# 这里获取 https://rapidapi.com/Privatix/api/temp-mail
rapid_api_key=xxxxxxxxxx
# 临时邮箱类型 `temp-email44:不需要绑定信用卡，但是每天限死100条调用` `temp-email: 需要绑定信用卡，每天免费100条，之后付费` 
EMAIL_TYPE=temp-email44
DEBUG=0 # 目前仅forefront用到 默认是0 一般本地运行可以设置成1，可以看到网站运行过程
POOL_SIZE=3 # 目前仅forefront用到 启用线程数，默认3 即代表同时可以进行3个会话
```

### 2. 运行

```
docker run -p 3000:3000 --env-file .env xiangsx/gpt4free-ts:latest
```

## 使用`docker-compose`部署

### 1. 参照 docker步骤创建 `.env`文件

### 2. 部署

```
docker-compose up --build -d
```

## 使用Sealos详细部署教程

[详细教程](https://icloudnative.io/posts/completely-free-to-use-gpt4/)

## API使用说明

### 参数介绍

#### 1. 通用参数

```typescript
interface query {
    prompt: string; // 有些网站不需要    
    model: string; // 必填
}
```

#### 2. 各个网站特有参数

##### forefront(默认使用gpt4,其他模型需要修改代码)

无

##### mcbbs

```typescript
interface Message {
    role: string;
    content: string;
}

interface options {
    parse: string;
    messages: string; // attattion messages is Message[] json string
    temperature: number;
}

```

### 开始使用

普通API，等待整个会话结束才返回

```shell
# 使用 mcbbs

curl '127.0.0.1:3000/ask?messages=[{"role":"system","content":"IMPORTANT: You are a virtual assistant powered by the gpt-3.5-turbo model, now time is 2023/6/3 13:42:27}"},{"role":"user","content":"你好\n"},{"role":"assistant","content":"你好！有什么我可以帮助你的吗？"},{"role":"user","content":"写个冒泡排序\n"}]&prompt=test&model=mcbbs&parse=false'

# 使用 chat.forefront Default,use gpt4
curl "http://127.0.0.1:3000/ask?prompt=hello&model=forefront"
```

stream类型，会不停地返回，不同网站返回的内容格式有所不同，后面目标是统一返回

```shell
# test model mcbbs
curl '127.0.0.1:3000/ask/stream?messages=[{"role":"system","content":"IMPORTANT: You are a virtual assistant powered by the gpt-3.5-turbo model, now time is 2023/6/3 13:42:27}"},{"role":"user","content":"你好\n"},{"role":"assistant","content":"你好！有什么我可以帮助你的吗？"},{"role":"user","content":"写个冒泡排序\n"}]&prompt=test&model=mcbbs&parse=false'

# test model forefront, 返回的是eventstreaam 包含三个事件 data(数据流) error(错误事件) done(会话完成，这个里面会携带完整的数据，这个里面的markdown格式是没有错乱的，data里面的格式可能会有问题)
curl "http://127.0.0.1:3000/ask/stream?prompt=hello&model=forefront"

# test you
curl "http://127.0.0.1:3000/ask/stream?prompt=hello&model=you"
```

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=xiangsx/gpt4free-ts&type=Date)](https://star-history.com/#xiangsx/gpt4free-ts&&type=Date)

<p>You may join our discord: <a href="https://discord.com/invite/gpt4free">discord.gg/gpt4free<a> for further updates. <a href="https://discord.gg/gpt4free"><img align="center" alt="gpt4free Discord" width="22px" src="https://raw.githubusercontent.com/peterthehan/peterthehan/master/assets/discord.svg" /></a></p>


<img alt="gpt4free logo" src="https://user-images.githubusercontent.com/98614666/233799515-1a7cb6a3-b17f-42c4-956d-8d2a0664466f.png">

## Legal Notice <a name="legal-notice"></a>

This repository is _not_ associated with or endorsed by providers of the APIs contained in this GitHub repository. This
project is intended **for educational purposes only**. This is just a little personal project. Sites may contact me to
improve their security or request the removal of their site from this repository.

Please note the following:

1. **Disclaimer**: The APIs, services, and trademarks mentioned in this repository belong to their respective owners.
   This project is _not_ claiming any right over them nor is it affiliated with or endorsed by any of the providers
   mentioned.

2. **Responsibility**: The author of this repository is _not_ responsible for any consequences, damages, or losses
   arising from the use or misuse of this repository or the content provided by the third-party APIs. Users are solely
   responsible for their actions and any repercussions that may follow. We strongly recommend the users to follow the
   TOS of the each Website.

3. **Educational Purposes Only**: This repository and its content are provided strictly for educational purposes. By
   using the information and code provided, users acknowledge that they are using the APIs and models at their own risk
   and agree to comply with any applicable laws and regulations.

4. **Copyright**: All content in this repository, including but not limited to code, images, and documentation, is the
   intellectual property of the repository author, unless otherwise stated. Unauthorized copying, distribution, or use
   of any content in this repository is strictly prohibited without the express written consent of the repository
   author.

5. **Indemnification**: Users agree to indemnify, defend, and hold harmless the author of this repository from and
   against any and all claims, liabilities, damages, losses, or expenses, including legal fees and costs, arising out of
   or in any way connected with their use or misuse of this repository, its content, or related third-party APIs.

6. **Updates and Changes**: The author reserves the right to modify, update, or remove any content, information, or
   features in this repository at any time without prior notice. Users are responsible for regularly reviewing the
   content and any changes made to this repository.

By using this repository or any code related to it, you agree to these terms. The author is not responsible for any
copies, forks, or reuploads made by other users. This is the author's only account and repository. To prevent
impersonation or irresponsible actions, you may comply with the GNU GPL license this Repository uses.
