FROM node:20-alpine

WORKDIR /app

# Kopiuj package files
COPY package*.json ./

# Zainstaluj zależności
RUN npm install

# Kopiuj źródła
COPY . .

# Zbuduj aplikację
RUN npm run build

# Expose port
EXPOSE 3001

# Start aplikacji
CMD ["npm", "run", "start:prod"]
