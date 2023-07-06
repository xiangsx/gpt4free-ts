FROM ghcr.io/puppeteer/puppeteer:20.5.0

USER root

WORKDIR /usr/src/build

COPY --chown=pptruser package.json /usr/src/build/

RUN npm i --registry=https://registry.npm.taobao.org

COPY --chown=pptruser . /usr/src/build

RUN npm run build

RUN mkdir /usr/src/app/
RUN cp ./dist/* /usr/src/app/ -r
RUN cp ./node_modules /usr/src/app/ -r
RUN rm /usr/src/build -rf
WORKDIR /usr/src/app

VOLUME [ "/usr/src/app/run" ]

EXPOSE 3000

CMD ["node", "index.js"]
