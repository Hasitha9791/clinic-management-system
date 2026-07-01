FROM node:22-slim

# Install system dependencies for Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer environment variables
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

COPY . .

# Build the React frontend
RUN cd frontend && npm install && npm run build

# Create necessary directories and set correct permissions for Hugging Face UID 1000
RUN mkdir -p /app/.wwebjs_auth /app/frontend/public && \
    chown -R 1000:1000 /app && \
    chmod -R 777 /app

# Expose the default Hugging Face port
EXPOSE 7860
ENV PORT=7860

# Run as user 1000
USER 1000

# Start the Express server
CMD ["node", "server.js"]
