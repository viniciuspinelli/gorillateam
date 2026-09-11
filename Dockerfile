# Stage 1: instalar dependências de produção
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: imagem final mínima
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache ca-certificates

# Copiar apenas o necessário
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health',(r)=>{process.exit(r.statusCode===200?0:1)})"

CMD ["node", "app.js"]
