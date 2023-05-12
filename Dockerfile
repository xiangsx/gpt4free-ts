FROM node:18.16.0

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY package.json /usr/src/app/

RUN npm i --registry=https://registry.npm.taobao.org

RUN apt update && \
    DEBIAN_FRONTEND=noninteractive apt install -y \
        libnss3 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY . /usr/src/app

EXPOSE 3000

CMD npm start
