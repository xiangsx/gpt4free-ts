<div align="center">
  
# GPT4Free TypeScript Version 🆓
###### Providing a free OpenAI GPT-4 API!
English | [中文](README_zh.md) | [日本語](README_ja.md)

[![Discord Server](https://discordapp.com/api/guilds/1115852499535020084/widget.png?style=banner2&count=true)](https://discord.gg/cYUU8mCDMd)
<p>You can join our discord: <a href="https://discord.gg/cYUU8mCDMd">discord.gg/gptgod<a> for further updates. <a href="https://discord.gg/cYUU8mCDMd"><img align="center" alt="gpt4free Discord" width="22px" src="https://raw.githubusercontent.com/peterthehan/peterthehan/master/assets/discord.svg" /></a></p>
</div>

## 🚩 Reverse target

I suggest you fork this project first. Some websites may go offline at any time.

Still striving to keep updating.

Have implemented models here:
If you do not want your website to appear here, please raise an issue and I will remove it immediately. Unfortunately, most of the sites here are no longer available.

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

## 🏃‍♂️ Run

First of all, you should create file `.env`. 
> ***All operation methods require this step.***

```env
http_proxy=http://host:port
rapid_api_key=xxxxxxxxxx
EMAIL_TYPE=temp-email44
DEBUG=0
POOL_SIZE=0
PHIND_POOL_SIZE=0
```

- `http_proxy`: config your proxy if you can not access target website directly; If you dont need proxy, delete this line;
- `forefront` use env(this site has been removed): 
  - `rapid_api_key`: you should config this if you use forefront api, this apikey is used for receive register email, get api key here
  - `EMAIL_TYPE`: temp email type includes `temp-email` `temp-email44` `tempmail-lol`
      - [temp-email](https://rapidapi.com/Privatix/api/temp-mail): soft limit 100req/days, if over use money, need bind credit card! Very Stable!
      - [temp-email44](https://rapidapi.com/calvinloveland335703-0p6BxLYIH8f/api/temp-mail44): hard limit 100req/days! Stable!
      - [tempmail-lol](): nothing need, limit 25request/5min. Not Stable.
  - `DEBUG`: Valid when use `forefront` You can set =1 when you run local. show reverse process
  - `POOL_SIZE`: `forefront` concurrency size. Keep set=1 until you run it successfully!!! You can engage in {POOL_SIZE} conversations concurrently. More pool size, More conversation can be done simultaneously, But use more RAM
- `phind` use env:
  - `PHIND_POOL_SIZE`: `phind` concurrency size.You can engage in {POOL_SIZE} conversations concurrently. More pool size, More conversation can be done simultaneously, But use more RAM

### Run local 🖥️ 

```shell
# install module
yarn
# start server
yarn start
```

### Run with docker(Suggest!) 🐳 

```
docker run -p 3000:3000 --env-file .env xiangsx/gpt4free-ts:latest
```

### Deploy with docker-compose 🎭 

first, you should create file .env; Follow step "Run with docker

deploy

```
docker-compose up --build -d
```

### Clash+one-api+gpt4free-ts Start with one command 😮

[gpt4free-ts-deploy](https://github.com/xiangsx/gpt4free-ts-deploy)

## 🚀 Let's Use GPT4

> Find supports model and site http://127.0.0.1:3000/supports [GET] 

> The same as openai http://127.0.0.1:3000/:site/v1/chat/completions [POST]

> The same as openai http://127.0.0.1:3000/v1/chat/completions?site=xxx [POST]

> Return when chat complete http://127.0.0.1:3000/ask?prompt=***&model=***&site=*** [POST/GET]

> Return with eventstream http://127.0.0.1:3000/ask/stream?prompt=***&model=***&site=*** [POST/GET]

### Request Params 📝

- `prompt`: your question. It can be a `string` or `jsonstr`.
  - example `jsonstr`:`[{"role":"user","content":"hello\n"},{"role":"assistant","content":"Hi there! How can I assist you today?"},{"role":"user","content":"who are you"}]`
  - example `string`: `who are you`
- `model`: default `gpt3.5-turbo`. model include:`gpt4` `gpt3.5-turbo` `net-gpt3.5-turbo` `gpt-3.5-turbo-16k`
- `site`: default `you`. target site, include `fakeopen` `better` `forefront` `you` `chatdemo` `phind` `vita`

### Site Support Model 🧩

query supports site and models with api `127.0.0.1:3000/supports`

```json
[
  {
    "site": "you",
    "models": [
      "gpt-3.5-turbo"
    ]
  },
  ...
]
```

### Response Params 🔙

Response when chat end(/ask):

```typescript
interface ChatResponse {
    content: string;
    error?: string;
}
```

Response with stream like, Suggest!!(/ask/stream):

```
event: message
data: {"content":"I"}

event: done
data: {"content":"'m"}

event: error
data: {"error":"some thind wrong"}
```

### Example💡

1. request to site you with history

req:

[127.0.0.1:3000/ask?site=you&prompt=[{"role":"user","content":"hello"},{"role":"assistant","content":"Hi there! How can I assist you today?"},{"role":"user","content":"who are you"}]]()

res:

```json
{
  "content": "Hi there! How can I assist you today?"
}
```

[127.0.0.1:3000/ask?site=you&prompt=[{"role":"user","content":"你好\n"},{"role":"assistant","content":"你好！有什么我可以帮助你的吗？"},{"role":"user","content":"你是谁"}]]()

2. request to site you with stream return

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

## 👥 Wechat Group

<image src="https://github.com/xiangsx/gpt4free-ts/assets/29322721/8ca34ced-27f2-4e68-80c2-0eecdf6f7d71" width=240 />
<image src="https://github.com/xiangsx/gpt4free-ts/assets/29322721/d13f194e-5faf-496c-a6da-8d94e8309116" width=240 />

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
