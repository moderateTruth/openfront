# Use the official pre-configured Puppeteer container image
FROM ghcr.io/puppeteer/puppeteer:24.0.0

# Establish the secure system directory for the app code
WORKDIR /app

# Copy your standard project files
COPY package*.json ./

# Install project dependencies under the root module cache
RUN npm install

# Copy your proxy application logic files
COPY . .

# Expose Render's standard web channel listener port
EXPOSE 3000

# Start the reverse proxy service
CMD ["node", "index.js"]
