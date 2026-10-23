FROM node:22-bookworm-slim

# O Prisma precisa do OpenSSL para falar com o PostgreSQL.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# O prisma.config.ts exige DATABASE_URL até para gerar o client; este valor só vale no build.
# Em execução, o Compose define a URL real.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Aplica as migrations e inicia a API. O banco nasce vazio, sem dados de exemplo.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]