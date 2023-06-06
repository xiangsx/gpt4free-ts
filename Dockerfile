FROM ghcr.io/puppeteer/puppeteer:20.5.0

USER root

WORKDIR /usr/src/app

COPY --chown=pptruser package.json /usr/src/app/

RUN npm i --registry=https://registry.npm.taobao.org

COPY --chown=pptruser . /usr/src/app

VOLUME [ "/usr/src/app/run" ]

EXPOSE 3000

CMD npm start
