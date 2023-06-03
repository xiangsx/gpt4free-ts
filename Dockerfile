FROM node:18.16.0

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
        libasound2

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

RUN apt-get update && apt install gnupg wget -y && \
  wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
  sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
  apt-get update && \
  apt install google-chrome-stable -y --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

USER 1000

WORKDIR /usr/src/app

COPY --chown=1000 package.json /usr/src/app/

RUN npm i --registry=https://registry.npm.taobao.org

COPY --chown=1000 . /usr/src/app

EXPOSE 3000

CMD npm start
