# Imagen base oficial de Node
FROM node:18

# Crear directorio de la app
WORKDIR /usr/src/app

# Copiar package.json y package-lock.json primero
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el resto del código
COPY . .

# Exponer el puerto (usa el mismo que en app.js o .env, normalmente 3000)
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD [ "node", "app.js" ]
