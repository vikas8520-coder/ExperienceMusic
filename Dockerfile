FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN NODE_ENV=production APP_ENV=production VITE_MODE=production node --import tsx script/build.ts

ENV NODE_ENV=production
ENV APP_ENV=production
ENV VITE_MODE=production

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
