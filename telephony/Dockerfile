# Ultaura Telephony Backend Dockerfile

FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Start the server
CMD ["node", "dist/server.js"]
