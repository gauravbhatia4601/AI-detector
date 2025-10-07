FROM node:18-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
EXPOSE 8083
CMD ["node", "--loader", "ts-node/esm", "src/main.ts"]
