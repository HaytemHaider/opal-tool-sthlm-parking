# syntax=docker/dockerfile:1

FROM node:22-slim AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json .
COPY .eslintrc.cjs .
COPY src ./src

RUN npm run build
RUN npm prune --omit=dev

FROM node:22-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
