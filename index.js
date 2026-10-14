import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Create a proxy targeting the game's actual web address
const gameProxy = createProxyMiddleware({
  target: 'https://openfront.io',
  changeOrigin: true,
  ws: true, // CRITICAL: This enables WebSocket proxying for real-time game traffic
  logLevel: 'debug',
  on: {
    proxyReq: (proxyReq, req, res) => {
      // Disguise Render's server traffic with standard browser headers
      proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      proxyReq.setHeader('Referer', 'https://openfront.io/');
    },
    proxyRes: (proxyRes, req, res) => {
      // Clear security headers that might cause blocking on your Chromebook
      delete proxyRes.headers['x-frame-options'];
      delete proxyRes.headers['content-security-policy'];
    }
  }
});

// Route all incoming traffic on your proxy app directly into the game proxy
app.use('/', gameProxy);

const server = app.listen(PORT, () => {
  console.log(`OpenFront Proxy active on port ${PORT}`);
});

// 2. Attach WebSocket upgrading so real-time multiplayer connections flow through your proxy
server.on('upgrade', (request, socket, head) => {
  gameProxy.upgrade(request, socket, head);
});
