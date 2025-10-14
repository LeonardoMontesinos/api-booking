# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Instalar dependencias (solo producción)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar código
COPY . .

# Modo producción
ENV NODE_ENV=production

# Usuario no root
USER node

# Exponer 3000
EXPOSE 3000

# Entry point (ajústalo si usas otro archivo)
CMD ["node", "src/server.js"]
