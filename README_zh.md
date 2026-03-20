<div align="center">

# GPT4Free TypeScript Version 🆓
###### 提供免费的GPT4 API
[English](README.md) | 中文 | [日本語](README_ja.md)

[![Discord Server](https://discordapp.com/api/guilds/1115852499535020084/widget.png?style=banner2&count=true)](https://discord.gg/cYUU8mCDMd)
<p>你可以加入discord: <a href="https://discord.gg/cYUU8mCDMd">discord.gg/gptgod<a> 以获取项目最新进展. <a href="https://discord.gg/cYUU8mCDMd"><img align="center" alt="gpt4free Discord" width="22px" src="https://raw.githubusercontent.com/peterthehan/peterthehan/master/assets/discord.svg" /></a></p>
</div>

## 🆓 免费OpenAI key

如果你不想部署，直接用下面的key

官网: [https://gptgod.online](https://gptgod.online)

API Base URL: `https://api.gptgod.online`

Api Key: `sk-OsMMq65tXdfOIlTUYtocSL7NCsmA7CerN77OkEv29dODg1EA`

Support Models: `gpt-4-all`,`gpt-3.5-turbo`,`gpt-3.5-turbo-16k`,`net-gpt-3.5-turbo`,`net-gpt-3.5-turbo-16k`,`claude-1-100k`,`google-palm`,`llama-2-70b`,`llama-2-13b`,`llama-2-7b`,`code-llama-34b`,`code-llama-13b`,`code-llama-7b`,`qwen-72b`,`stable-diffusion`,`mixtral-8x7b`,`mistral-medium`

## 👍 基于此项目的最强网站 [GPTGOD](http://gptgod.online)

### GPTGOD Support

下面所有功能可以直接在网站内使用，也可创建api调用，并且可以直接扫码集成到微信机器人上
- [x] Midjourney 史上最强AI画图
- [x] Stable Diffusion 史上最强开源AI画图
- [x] Claude 仅次于GPT4的AI对话模型
- [x] gpt3.5-turbo 都知道
- [x] gpt4 都知道
- [x] gpt-4-32k 都知道
- [x] claude-2-100k 无敌的上下文
- [x] Chatgpt with internet 联网版本GPT
- [x] 🔥 GPT-4-All alltools版本，集成识图、画图、联网和code interpreter
- [x] 🔥 GPTS 可以使用openai的所有的GPTs

在未来的一段时间GPTGOD将开源，进入网站左下角有入群二维码，入群时刻关注最新动态

## 🚩 Reverse target

仍在努力保持更新,使用人数太多， 更新赶不上封的速度
现不公开部分站点了

⭐最新站点支持，部分站点未公开，加群获取, 点击展开⭐

这里是已经实现转换成api的网站列表以及支持的对话模型，如果你不幸发现你的网站也在其中，请联系我，我会立刻下线

***Update At 2023-09-10***

| Site     | Models                                            |
|----------|---------------------------------------------------|
| you      | gpt-3.5-turbo                                     |
| phind    | net-gpt-3.5-turbo                                 |
| forefront| gpt-3.5-turbo, claude                             |
| mcbbs    | gpt-3.5-turbo, gpt-3.5-turbo-16k                  |
| chatdemo | gpt-3.5-turbo, gpt-3.5-turbo-16k                  |
| vita     | gpt-3.5-turbo                                     |
| skailar  | gpt-4                                             |
| fakeopen | gpt-3.5-turbo, gpt-3.5-turbo-16k, gpt-4           |
| easychat | gpt-4                                             |
| better   | gpt-3.5-turbo, gpt-3.5-turbo-16k, gpt-4           |
| pweb     | gpt-3.5-turbo, gpt-3.5-turbo-16k                  |
| bai      | gpt-3.5-turbo                                     |
| gra      | gpt-3.5-turbo, gpt-3.5-turbo-16k                  |
| magic    | gpt-3.5-turbo, gpt-4, claude-instance, claude, claude-100k  |
| chim     | gpt-3.5-turbo, gpt-3.5-turbo-16k, gpt-4           |
| ram      | gpt-3.5-turbo-16k                                 |
| chur     | gpt-3.5-turbo, gpt-3.5-turbo-16k                  |
| xun      | gpt-3.5-turbo, gpt-3.5-turbo-16k                  |
| vvm      | gpt-3.5-turbo, gpt-3.5-turbo-16k, gpt-4           |
| poef     |                                                   |
| claude   | claude-2-100k                                     |
| cursor   | gpt-3.5-turbo, gpt-4                              |
| chatbase | gpt-3.5-turbo                                     |
| ails     | gpt-3.5-turbo                                     |
| sincode  | gpt-3.5-turbo, gpt-4                              |
| openai   | too much                              |
| jasper   | gpt-3.5-turbo, gpt-4                              |
| pap      |                                                   |
| acytoo   | gpt-3.5-turbo                                     |
| google   | search                                            |
| www      | url                                               |
| ddg      | search                                            |
| minimax  | MiniMax-M2.7, MiniMax-M2.5, MiniMax-M2.5-highspeed |

## 🏃‍♂️ 运行

首先，你需要创建环境变量文件 `.env`.
> ***所有运行部署方式都需要这个步骤，包括运行在本地.***

```env
http_proxy=http://host:port

rapid_api_key=xxxxxxxxxx
EMAIL_TYPE=temp-email44
DEBUG=0
POOL_SIZE=0

PHIND_POOL_SIZE=3
```

- `http_proxy`: 你的本地代理，目前仅支持http协议，如果是国外的机器不需要配置此行，直接删除；如果是国内的，必须配置，请务必注意。
- 使用`forefront`才需要配置的env(该站点已被移除，下面可以不用配置):
    - `rapid_api_key`: 如果你使用forefront，这个必填，为了接收临时邮箱
    - `EMAIL_TYPE`: `forefront`临时邮箱类型 `temp-email` `temp-email44` `tempmail-lol`
        - [temp-email](https://rapidapi.com/Privatix/api/temp-mail): 软限制 免费100请求/days 如果超过了 每条收0.0038$ 具体查看下方网站，官方api非常稳定
        - [temp-email44](https://rapidapi.com/calvinloveland335703-0p6BxLYIH8f/api/temp-mail44): 硬限制 免费100req/days! 超过就会报错，也很稳定
        - [tempmail-lol](): 什么都不需要配置 硬限制 25request/5min. 不怎么稳定.
    - `DEBUG`: `forefront`专属配置 设置成1，会显示运行过程
    - `POOL_SIZE`: 默认配置成1，修改之前确定你可以运行成功，并且知道此值的含义！！！`forefront` 可以同时进行的对话数目，数值越大，同时进行的对话数越多，但是使用的内存越大，如果个人使用设置1即可
- 使用`phind`才需要的配置
    - `PHIND_POOL_SIZE`: 默认配置成=3，`phind` 可以同时进行的对话数目，数值越大，同时进行的对话数越多，但是使用的内存越大，如果个人使用设置1即可

### 本地运行 🖥️

```shell
# install module
yarn
# start server
yarn start
```

### 使用Docker运行 🐳

```
docker run -p 3000:3000 --env-file .env xiangsx/gpt4free-ts:latest
```

### 使用 docker-compose 运行 🎭

```
docker-compose up --build -d
```

### 一站式整合clash+one-api+gpt4free-ts 无脑一键启动 😮

该项目整合了onapi(开箱即用的api售卖平台) + clash(项目运行所需代理) + upma(项目监控) + gpt4free-ts(项目本体)

[gpt4free-ts-deploy](https://github.com/xiangsx/gpt4free-ts-deploy)

### 使用Sealos详细部署教程 🌐

[详细教程](https://icloudnative.io/posts/completely-free-to-use-gpt4/)

## 🚀 Let's Use GPT4

> 查看目前支持的site以及model http://127.0.0.1:3000/supports [GET]

> 和openai一致的返回格式 http://127.0.0.1:3000/:site/v1/chat/completions [POST]
>
> 和openai一致的返回格式 http://127.0.0.1:3000/v1/chat/completions?site=xxx [POST]

> 会话完成之后返回示例 http://127.0.0.1:3000/ask?prompt=***&model=***&site=*** [POST/GET]

> 以stream模式返回示例 http://127.0.0.1:3000/ask/stream?prompt=***&model=***&site=*** [POST/GET]

### 请求参数，请放在query里 📝

- `prompt`: 你的问题，类型是`string` 或者 `jsonstr`.
    - `jsonstr`:包含上下文的json字符串，例如：`[{"role":"user","content":"你好\n"},{"role":"assistant","content":"你好！有什么我可以帮助你的吗？"},{"role":"user","content":"你是谁"}]`
    - `string`: 单次对话 例如：`你是谁`
- `model`: 默认 `gpt3.5-turbo`. 模型:`gpt4` `gpt3.5-turbo`
- `site`: 默认 `you`. 目标网站 `fakeopen` `better` `forefront` `you` `chatdemo`

### 网站支持模型类型 🧩

查询当前支持的站点和模型 `127.0.0.1:3000/supports` 站点随时会更新，加微信群吧

```json
[
  {
    "site": "you",
    "models": [
      "gpt-3.5-turbo"
    ]
  },
  {
    "site": "phind",
    "models": [
      "net-gpt3.5-turbo"
    ]
  },
  {
    "site": "mcbbs",
    "models": [
      "gpt-3.5-turbo",
      "gpt-3.5-turbo-16k"
    ]
  },
  {
    "site": "chatdemo",
    "models": [
      "gpt-3.5-turbo"
    ]
  },
  {
    "site": "vita",
    "models": [
      "gpt-3.5-turbo"
    ]
  },
  {
    "site": "fakeopen",
    "models": [
      "gpt-3.5-turbo-16k"
    ]
  },
  {
    "site": "better",
    "models": [
      "gpt-3.5-turbo",
      "gpt-3.5-turbo-16k",
      "gpt-4"
    ]
  },
  {
    "site": "xun",
    "models": [
      "gpt-3.5-turbo",
      "gpt-3.5-turbo-16k"
    ]
  }
]
```

### 返回参数 🔙

当对话结束时返回参数(/ask):

```typescript
interface ChatResponse {
    content: string;
    error?: string;
}
```

stream模式返回参数示例Suggest!!(/ask/stream):

```
event: message
data: {"content":"I"}

event: done
data: {"content":"'m"}

event: error
data: {"error":"some thind wrong"}
```

### 真实请求示例💡

1. 请求you.com, 包含上下文

req:

[127.0.0.1:3000/ask?site=you&prompt=[{"role":"user","content":"hello"},{"role":"assistant","content":"Hi there! How can I assist you today?"},{"role":"user","content":"who are you"}]]()

res:

```json
{
  "content": "Hi there! How can I assist you today?"
}
```

[127.0.0.1:3000/ask?site=you&prompt=[{"role":"user","content":"你好\n"},{"role":"assistant","content":"你好！有什么我可以帮助你的吗？"},{"role":"user","content":"你是谁"}]]()

2. 以stream模式请求you.com

req:

[127.0.0.1:3000/ask/stream?site=you&prompt=who are you]()

res:
```
event: message
data: {"content":"I"}

event: message
data: {"content":"'m"}

event: message
data: {"content":" a"}

event: message
data: {"content":" search"}

event: message
data: {"content":" assistant"}
........
event: done
data: {"content":"done"}
```
## 👥 加群细聊

<image src="https://github.com/xiangsx/gpt4free-ts/assets/29322721/311ba62d-e611-4aed-98f6-b34cf115866a" width=240 />

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=xiangsx/gpt4free-ts&type=Date)](https://star-history.com/#xiangsx/gpt4free-ts&&type=Date)

<p>You may join our discord: <a href="https://discord.com/invite/gpt4free">discord.gg/gpt4free<a> for further updates. <a href="https://discord.gg/gpt4free"><img align="center" alt="gpt4free Discord" width="22px" src="https://raw.githubusercontent.com/peterthehan/peterthehan/master/assets/discord.svg" /></a></p>

This is a replication project for the typescript version of [gpt4free](https://github.com/xtekky/gpt4free)

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
