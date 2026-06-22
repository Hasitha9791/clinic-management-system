FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all project files (except those in .gitignore)
COPY . .

# Expose the default Hugging Face port
EXPOSE 7860
ENV PORT=7860

# Start the Express server
CMD ["node", "server.js"]
