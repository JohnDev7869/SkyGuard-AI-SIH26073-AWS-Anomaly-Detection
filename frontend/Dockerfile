FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

# We will rely on volume mounting for live reload during demo
COPY . .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
