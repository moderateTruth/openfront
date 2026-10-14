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

# Expose the master lobby port and all 20 multiplayer match ports
EXPOSE 3000
EXPOSE 3001-3020

# Start the reverse proxy service
CMD ["node", "index.js"]
