import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
const app = express();
const PORT = process.env.PORT || 3000;

let browser;
let page;

async function initBrowser() {
  try {
    // Simplified launch relies entirely on our local project cache configuration file
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,800',
        '--disable-web-security'
      ]
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    console.log("Deep Stealth Engine initialized successfully.");
  } catch (err) {
    console.error("Engine failed to boot:", err);
  }
}
initBrowser();

// 1. WEBSOCKET ROUTING INTERCEPT: Seamlessly tunnel real-time multiplayer connections through Render
const wsProxy = createProxyMiddleware({
  target: 'https://openfront.io',
  changeOrigin: true,
  ws: true, // Enables proxying for WebSocket traffic
  logLevel: 'debug'
});

app.all('*', async (req, res) => {
  if (!page) {
    return res.status(500).send("Proxy engine starting up. Please refresh in a moment.");
  }

  // Automatically detect whatever Render address you are currently using
  const RENDER_DOMAIN = req.headers.host;
  const targetUrl = `https://openfront.io${req.url}`;

  try {
    // 2. SCRAPE & REWRITE BASE DOCUMENTS (HTML/JS/CSS)
    if (req.url === '/' || req.url.endsWith('.html') || req.url.endsWith('.js') || req.url.endsWith('.css') || !req.url.includes('.')) {
      
      let rawData;
      if (req.url === '/' || req.url.endsWith('.html') || !req.url.includes('.')) {
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        rawData = await page.content();
      } else {
        // Fetch raw asset scripts inside Render server natively
        const assetRes = await fetch(targetUrl, { headers: { 'Referer': 'https://openfront.io' } });
        rawData = await assetRes.text();
      }

      // THE FIX: Intercept the document text data and force change internal references to your Render proxy link
      let patchedData = rawData
        .replace(/openfront\.io/g, RENDER_DOMAIN)
        .replace(/wss:\/\/openfront\.io/g, `wss://${RENDER_DOMAIN}`);

      // Apply appropriate browser rendering headers
      if (req.url.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
      else if (req.url.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
      else res.setHeader('Content-Type', 'text/html');

      return res.send(patchedData);
    } 
    
    // 3. PASSTHROUGH ROUTING FOR BINARY ASSETS (Images, Audio, Icons)
    else {
      const mediaResponse = await fetch(targetUrl, { headers: { 'Referer': 'https://openfront.io' } });
      const contentType = mediaResponse.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);

      const arrayBuffer = await mediaResponse.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }

  } catch (error) {
    return res.status(500).send(`Mirror link broken: ${error.message}`);
  }
});

// Start the core web listener
const server = app.listen(PORT);

// Tunnel real-time websocket upgrade queries directly through Render server
server.on('upgrade', (request, socket, head) => {
  wsProxy.upgrade(request, socket, head);
});
