FROM node:erbium
LABEL maintainer="Automattic"

WORKDIR /app

ENV NODE_ENV=production

COPY . /app

RUN npm install

CMD ["node", "auto-update-server"]
