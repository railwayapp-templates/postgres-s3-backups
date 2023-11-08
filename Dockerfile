FROM alpine:3.18 AS build

WORKDIR /root

RUN apk add --update --no-cache nodejs npm

COPY package*.json tsconfig.json ./
COPY src ./src

RUN npm install && \
    npm run build && \
    npm prune --production

FROM alpine:3.18

WORKDIR /root

COPY --from=build /root/node_modules ./node_modules
COPY --from=build /root/dist ./dist

ARG PG_VERSION='16'

RUN apk add --update --no-cache postgresql${PG_VERSION}-client --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main && \
    apk add --update --no-cache nodejs npm

CMD pg_isready --dbname=$BACKUP_DATABASE_URL && \
    pg_dump --version && \
    node dist/index.js