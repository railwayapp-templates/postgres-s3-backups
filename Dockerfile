FROM alpine:3.14 AS build

WORKDIR /root

RUN apk add --update --no-cache nodejs npm

COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

RUN npm install
RUN npm run build
RUN npm prune --production

FROM alpine:3.14

WORKDIR /root

COPY --from=build /root/node_modules ./node_modules
COPY --from=build /root/dist ./dist

RUN apk add --update --no-cache postgresql-client nodejs npm

ENTRYPOINT ["node", "dist/index.js"]
