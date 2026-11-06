FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
COPY scripts/docker-start.mjs ./scripts/docker-start.mjs
COPY scripts ./scripts

RUN npx prisma generate

EXPOSE 5000

CMD ["node", "scripts/docker-start.mjs"]
