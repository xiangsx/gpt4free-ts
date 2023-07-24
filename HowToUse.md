## 1. 项目接口介绍

- /supports 查询项目支持哪些站点和哪些model
- /ask 简化后的请求和返回参数格式，后面会说明参数格式，等整个对话完成再返回
- /ask/stream 简化后的请求和返回参数格式，流式返回
- /:site/v1/chat/completions 和openai一致的请求和返回格式，需要把`:site`更换成`/supports`查询出来的`site`和`model`

## 2. 项目环境变量参数说明

注意一下参数都不是必须，按需配置，不需要可以直接删除整行

- `http_proxy`: 国内使用的代理，国外的机器不需要填
- `POE_PB`: poe的p-b,登录poe之后F12看一下cookie中有个p-b字段，复制下来填入，如果有多个使用|分割 比如 xxxxxxxxx|xxxxxxxxxxx, 运行之后该字段的值会被保存在run/account_poe.json中，为了防止容器更新丢失，请映射到本地，映射规则       `./run:/usr/src/app/run`
- `POE_POOL_SIZE`: 默认0， poe默认使用的线程数目，不能大于POE_PB填的数量


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
    image: gpt4freets/gpt4free-ts:0.0.46-private
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
