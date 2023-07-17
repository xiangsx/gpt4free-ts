## 1. 项目接口介绍

- /supports 查询项目支持哪些站点和哪些model
- /ask 简化后的请求和返回参数格式，后面会说明参数格式，等整个对话完成再返回
- /ask/stream 简化后的请求和返回参数格式，流式返回
- /:site/v1/chat/completions 和openai一致的请求和返回格式，需要把`:site`更换成`/supports`查询出来的`site`和`model`

## 2. 项目环境变量参数说明

注意一下参数都不是必须，按需配置，不需要可以直接删除整行

- `http_proxy`: 国内使用的代理，国外的机器不需要填
- `POE_PB`: poe的p-b,登录poe之后F12看一下cookie中有个p-b字段，复制下来填入，如果有多个使用|分割 比如 xxxxxxxxx|xxxxxxxxxxx
- `POE_POOL_SIZE`: 默认0， poe默认使用的线程数目，不能大于POE_PB填的数量


## 3. 部署教程

### 3.1 Docker 
### 3.2 Docker Compose
### 3.3 Sealos
### 3.4 Windows 版本docker

## 4. 接口参数说明

## 5. 接入其他平台教程

### 5.1 接入one api平台
### 5.2 接入沉浸式翻译
