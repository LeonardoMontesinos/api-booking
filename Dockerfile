# --- Dockerfile ---
FROM node:18-alpine

# Directorio de trabajo
WORKDIR /app

# Copiamos manifests primero para cachear deps
COPY package*.json ./

# Instala dependencias determinísticamente (solo producción)
# (si tu npm es viejo, puedes usar: RUN npm install --omit=dev)
RUN npm ci --omit=dev

# Copiamos el resto del código
COPY . .

# Variables útiles
ENV NODE_ENV=production \
    PORT=3000

# Usuario no root
USER node

# Exponer el puerto (informativo)
EXPOSE 3000

# Arranque: server.js vive en src/
CMD ["node", "src/server.js"]
