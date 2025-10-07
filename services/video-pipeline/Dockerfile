FROM node:18-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
EXPOSE 8091
CMD ["npm", "run", "start"]
