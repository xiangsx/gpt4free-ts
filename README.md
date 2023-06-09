<div align="center">

# GPT4Free TypeScript Version 🆓
###### Providing a free OpenAI GPT-4 API!
English | [中文](README_zh.md)

[![Discord Server](https://discordapp.com/api/guilds/1115852499535020084/widget.png?style=banner2&count=true)](https://discord.gg/bbH68Kzm)
<p>You can join our discord: <a href="https://discord.gg/bbH68Kzm">discord.gg/gptgod<a> for further updates. <a href="https://discord.gg/bbH68Kzm"><img align="center" alt="gpt4free Discord" width="22px" src="https://raw.githubusercontent.com/peterthehan/peterthehan/master/assets/discord.svg" /></a></p>
</div>


## 👍 GPT4 Website Base on this project [GPTGOD](http://gptgod.site)
<details>
<summary><strong>Website Feature(Click to expand)</strong></summary>

### GPTGOD Support

- [x] Midjourney The Most Powerful AI Drawing System in History.
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
|[aidream](http://aidream.cloud)|GPT-3.5|![Active](https://img.shields.io/badge/Active-brightgreen)|after 2023-05-12|
|[you.com](you.com)|GPT-3.5|![Active](https://img.shields.io/badge/Active-brightgreen)|after 2023-05-12
|[phind.com](https://www.phind.com/)|GPT-4 / Internet / good search|![Active](https://img.shields.io/badge/Active-grey)|
|[bing.com/chat](bing.com/chat)|GPT-4/3.5||
|[poe.com](poe.com)| GPT-4/3.5||
|[writesonic.com](writesonic.com)| GPT-3.5 / Internet||
|[t3nsor.com](t3nsor.com)|GPT-3.5||

## 🏃‍♂️ Run

First of all, you should create file `.env`. 
> ***All operation methods require this step.***

```env
http_proxy=http://host:port
rapid_api_key=xxxxxxxxxx
EMAIL_TYPE=temp-email44
DEBUG=0
POOL_SIZE=3
```

- `http_proxy`: config your proxy if you can not access target website directly
- `rapid_api_key`: you should config this if you use forefront api, this apikey is used for receive register email, get api key here
- `EMAIL_TYPE`: temp email type includes `temp-email` `temp-email44` `tempmail-lol`
    - [temp-email](https://rapidapi.com/Privatix/api/temp-mail): soft limit 100req/days, if over use money, need bind credit card! Very Stable!
    - [temp-email44](https://rapidapi.com/calvinloveland335703-0p6BxLYIH8f/api/temp-mail44): hard limit 100req/days! Stable!
    - [tempmail-lol](): nothing need, limit 25request/5min. Not Stable.
- `DEBUG`: Valid when use `forefront` You can set =1 when you run local. show reverse process
- `POOL_SIZE`: `forefront` concurrency size. You can engage in {POOL_SIZE} conversations concurrently. More pool size, More conversation can be done simultaneously, But use more RAM

### Run local 🖥️ 

```shell
# install module
yarn
# start server
yarn start
```

### Run with docker 🐳 

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

> Return when chat complete http://127.0.0.1:3000/ask?prompt=***&model=***

> Return with eventstream http://127.0.0.1:3000/ask/stream?prompt=***&model=***

 ### Common parameters📝 
- `prompt`: your question
- `model`: target web site include:`forefront` `you` `mcbbs`

 ### WebSite Unique parameters🔒
- mcbbs
    - `messages`: For example `[{"role":"system","content":"IMPORTANT: You are a virtual assistant powered by the gpt-3.5-turbo model, now time is 2023/6/3 13:42:27}"},{"role":"user","content":"你好\n"},{"role":"assistant","content":"你好！有什么我可以帮助你的吗？"},{"role":"user","content":"写个冒泡排序\n"}]`
    - `temperature`: 0~1

### Example💡
- `forefront`
    - http://127.0.0.1:3000/ask?prompt=whoareyou&model=forefront
    - http://127.0.0.1:3000/ask/stream?prompt=whoareyou&model=forefront
- `mcbbs`
    - [http://127.0.0.1:3000/ask?prompt=nothing&model=mcbbs&messages=[{"role":"system","content":"IMPORTANT: You are a virtual assistant powered by the gpt-3.5-turbo model, now time is 2023/6/3 13:42:27}"},{"role":"user","content":"你好\n"},{"role":"assistant","content":"你好！有什么我可以帮助你的吗？"},{"role":"user","content":"写个冒泡排序\n"}]](http://127.0.0.1:3000/ask?prompt=nothing&model=mcbbs&messages=[{%22role%22:%22system%22,%22content%22:%22IMPORTANT:%20You%20are%20a%20virtual%20assistant%20powered%20by%20the%20gpt-3.5-turbo%20model,%20now%20time%20is%202023/6/3%2013:42:27}%22},{%22role%22:%22user%22,%22content%22:%22%E4%BD%A0%E5%A5%BD\n%22},{%22role%22:%22assistant%22,%22content%22:%22%E4%BD%A0%E5%A5%BD%EF%BC%81%E6%9C%89%E4%BB%80%E4%B9%88%E6%88%91%E5%8F%AF%E4%BB%A5%E5%B8%AE%E5%8A%A9%E4%BD%A0%E7%9A%84%E5%90%97%EF%BC%9F%22},{%22role%22:%22user%22,%22content%22:%22%E5%86%99%E4%B8%AA%E5%86%92%E6%B3%A1%E6%8E%92%E5%BA%8F\n%22}])
- `you`
    - http://127.0.0.1:3000/ask?prompt=whoareyou&model=you
    - http://127.0.0.1:3000/ask/stream?prompt=whoareyou&model=you




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
