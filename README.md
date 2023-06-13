<div align="center">

# GPT4Free TypeScript Version 🆓
###### Providing a free OpenAI GPT-4 API!
English | [中文](README_zh.md) | [日本語](README_ja.md)

[![Discord Server](https://discordapp.com/api/guilds/1115852499535020084/widget.png?style=banner2&count=true)](https://discord.gg/bbH68Kzm)
<p>You can join our discord: <a href="https://discord.gg/bbH68Kzm">discord.gg/gptgod<a> for further updates. <a href="https://discord.gg/bbH68Kzm"><img align="center" alt="gpt4free Discord" width="22px" src="https://raw.githubusercontent.com/peterthehan/peterthehan/master/assets/discord.svg" /></a></p>
</div>


## 👍 GPT4 Website Base on this project [GPTGOD](http://gptgod.site)
<details>
<summary><strong>Website Feature (Click to expand)</strong></summary>

### GPTGOD Support

- [x] Midjourney The Most Powerful AI Drawing System in History
- [x] Stable Diffusion
- [x] Claude
- [x] Chatgpt
- [x] Chatgpt with internet
- [x] Create wechat ai robot for yourself, just need one step

In the next two weeks, I will open source all the code for GPTGOD. If you need, Please watch this project or follow me
to receive notifications.

Why now? because there are stil some secret config should be removed from that project.
</details>

## 🚩 Reverse target

Still striving to keep updating.

Have implemented models here:
If you do not want your website to appear here, please raise an issue and I will remove it immediately.
|model|support|status|active time|
|--|--|--|--|
|[ai.mcbbs.gq](https://ai.mcbbs.gq)|gpt3.5|![Active](https://img.shields.io/badge/Active-brightgreen)|after 2023-06-03|
|[forefront.ai](https://chat.forefront.ai)|👍GPT-4/gpt3.5|![Active](https://img.shields.io/badge/Active-brightgreen)|after 2023-06-03|
|[you.com](https://you.com)|GPT-3.5|![Active](https://img.shields.io/badge/Active-brightgreen)|after 2023-05-12
|[phind.com](https://www.phind.com/)|GPT-4 / Internet / good search|![Active](https://img.shields.io/badge/Active-grey)|
|[bing.com/chat](https://bing.com/chat)|GPT-4/3.5||
|[poe.com](https://poe.com)| GPT-4/3.5||
|[writesonic.com](https://writesonic.com)| GPT-3.5 / Internet||
|[t3nsor.com](https://t3nsor.com)|GPT-3.5||

## 🏃‍♂️ Run

First of all, you should create file `.env`. 
> ***All operation methods require this step.***

```env
http_proxy=http://host:port
rapid_api_key=xxxxxxxxxx
EMAIL_TYPE=temp-email44
DEBUG=0
POOL_SIZE=1
```

- `http_proxy`: config your proxy if you can not access target website directly
- `rapid_api_key`: you should config this if you use forefront api, this apikey is used for receive register email, get api key here
- `EMAIL_TYPE`: temp email type includes `temp-email` `temp-email44` `tempmail-lol`
    - [temp-email](https://rapidapi.com/Privatix/api/temp-mail): soft limit 100req/days, if over use money, need bind credit card! Very Stable!
    - [temp-email44](https://rapidapi.com/calvinloveland335703-0p6BxLYIH8f/api/temp-mail44): hard limit 100req/days! Stable!
    - [tempmail-lol](): nothing need, limit 25request/5min. Not Stable.
- `DEBUG`: Valid when use `forefront` You can set =1 when you run local. show reverse process
- `POOL_SIZE`: `forefront` concurrency size. Keep set=1 until you run it successfully!!! You can engage in {POOL_SIZE} conversations concurrently. More pool size, More conversation can be done simultaneously, But use more RAM

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

## 🚀 Let's Use GPT4

> Return when chat complete http://127.0.0.1:3000/ask?prompt=***&model=***&site=***

> Return with eventstream http://127.0.0.1:3000/ask/stream?prompt=***&model=***&site=***

### Request Params 📝

- `prompt`: your question. It can be a `string` or `jsonstr`.
  - example `jsonstr`:`[{"role":"user","content":"hello\n"},{"role":"assistant","content":"Hi there! How can I assist you today?"},{"role":"user","content":"who are you"}]`
  - example `string`: `who are you`
- `model`: default `gpt3.5-turbo`. model include:`gpt4` `gpt3.5-turbo`
- `site`: default `you`. target site, include `forefront` `you` `mcbbs`

### Response Params 🔙

Response when chat end(/ask):

```typescript
interface ChatResponse {
    content: string;
    error?: string;
}
```

Response with stream like(/ask/stream):

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
<image src="https://github.com/xiangsx/gpt4free-ts/assets/29322721/0a788688-ab0b-4e95-8438-20af4e7a5362" width=240 />
<image src="https://github.com/xiangsx/gpt4free-ts/assets/29322721/399549fa-34b9-4611-873f-f539d2dca04a" width=240 />


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
