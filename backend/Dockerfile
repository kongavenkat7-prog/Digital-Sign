FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

RUN npm ci --only=production

EXPOSE 3001

CMD ["node", "dist/server.js"]
