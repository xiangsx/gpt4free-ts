## 1. 项目接口介绍

- /supports 查询项目支持哪些站点和哪些model
- /ask 简化后的请求和返回参数格式，后面会说明参数格式，等整个对话完成再返回
- /ask/stream 简化后的请求和返回参数格式，流式返回
- /:site/v1/chat/completions 和openai一致的请求和返回格式，需要把`:site`更换成`/supports`查询出来的`site`和`model`

## 2. 环境变量以及配置文件详细解释

### 2.1 环境变量
`.env`，运行之前需要删掉所有注释，不然会有问题，这里为了方便直接写在字段后面了,注意如果使用`docker-compose` 请直接把环境变量写到`docker-compose.yaml`中
```
http_proxy=http://127.0.0.1:7890 #这里改为你的代理地址
RETRY=1 # 请求失败自动重试1次
rapid_api_key=${rapid_api_key} # 临时邮箱需要的key
EMAIL_TYPE=tempmail-lol # 使用的临时邮箱类型

COPILOT_POOL_SIZE=0 # copilot 账号数目
POE_POOL_SIZE=0 # 同上
# 多个用|分割
POE_PB=xxxxx|xxxxxx # poe的登录pb
#是否使用免费账号 1：不会校验账号是否是会员直接使用
POE_ALLOW_FREE=1
#是否忽略剩余数直接使用，1: 不论剩余多少都会尝试发送消息 0：剩余0之后就不发送了
POE_USE_IGNORE_LEFT=1

OEPNPROMPT_POOL_SIZE=0

#perplexity 需要的配置是下面3个
CHROME_PATH=google-chrome # 如果在容器中运行固定配置这个，不用修改
PERPLEXITY_POOL_SIZE=0
# 多个用|分割
PERPLEXITY_TOKEN=xxxxxx|xxxxxxx  

# sincode站点相关变量，注意email和password要一一对应，多个用|分割
SINCODE_EMAIL=xxx|xxx|xxx
SINCODE_PASSWORD=xxx|xxx|xxx
SINCODE_POOL_SIZE=4
```

### 2.2 配置文件解释
run/config.json 负载均衡配置文件，需要把docker文件映射出来, 映射示例 `./run:/usr/src/app/run`，**此文件可以在运行时修改，修改会实时生效**
配置好之后，接口site的值传auto
配置文件示例：
```
{
  "site_map": {
    "gpt-4": [
      {
        "site": "poe",
        "priority": 20
      },
      {
        "site": "perplexity",
        "priority": 20
      }
    ],
    "gpt-3.5-turbo": [
      {
        "site": "bai",
        "priority": 50
      },
      {
        "site": "copilot",
        "priority": 0
      },
      {
        "site": "pweb",
        "priority": 0
      },
      {
        "site": "chur",
        "priority": 10
      },
      {
        "site": "poe",
        "priority": 20
      },
      {
        "site": "chatbase",
        "priority": 30
      }
    ],
    "gpt-3.5-turbo-16k": [
      {
        "site": "chur",
        "priority": 20
      },
      {
        "site": "openprompt",
        "priority": 30
      },
      {
        "site": "poe",
        "priority": 30
      }
    ]
  }
}
```




## 3. 部署教程

### 3.1 Docker 
### 3.2 Docker Compose（推荐）

安装docker-compose 自行寻找教程安装

私人镜像需要运行命令
```shell
docker login
# 输入用户名密码
```
以使用poe为例,首先创建`docker-compose.yaml`文件
```
version: "3.9"
services:
  gpt4free:
    image: gpt4freets/gpt4free-ts:v0.0.46-private
    ports:
      - "3000:3000"
    restart: always
    volumes:
      - ./run:/usr/src/app/run
    environment:
      - http_proxy=http://127.0.0.1:7890
      - POE_PB=xxxxxxx|xxxxxxxxxxxxx
      - POE_POOL_SIZE=1
```
在`docker-compose.yaml`同级目录下，使用命令
```
docker-compose up -d
```
成功运行！访问 `服务地址:3000/poe/v1/chat/completions` 即可使用api

### 3.3 Sealos
### 3.4 Windows 版本docker

## 4. 接口参数说明

## 5. 接入其他平台教程

### 5.1 接入one api平台
### 5.2 接入沉浸式翻译

