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
    console.log("Launching core containerized browser engine...");
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

// 1. DYNAMIC API & WEBSOCKET GATEWAY: Handles background matchmaking requests natively
const gameProxy = createProxyMiddleware({
  target: 'https://openfront.io',
  changeOrigin: true,
  ws: true, // Crucial for real-time game traffic
  logLevel: 'debug',
  router: (req) => {
    // If the game scripts try to contact the backend API endpoint, route them directly to the API server
    if (req.headers.host && req.headers.host.startsWith('api-')) {
      return 'https://api.openfront.io';
    }
    return 'https://openfront.io';
  }
});

app.all('*', async (req, res) => {
  if (!page) {
    return res.status(500).send("Proxy engine starting up. Please refresh in a moment.");
  }

  const RENDER_DOMAIN = req.headers.host;

  try {
    // 2. SCRAPE & PATCH CORE WEB DOCUMENTS
    if (req.url === '/' || req.url.endsWith('.html') || !req.url.includes('.')) {
      const targetUrl = `https://openfront.io${req.url}`;
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      let rawData = await page.content();
      
      // DEEP PATCH: Converts text markers to use custom routed addresses inside Render
      let patchedData = rawData
        .replace(/api\.openfront\.io/g, `api-${RENDER_DOMAIN}`)
        .replace(/openfront\.io/g, RENDER_DOMAIN)
        .replace(/wss:\/\/api\.openfront\.io/g, `wss://api-${RENDER_DOMAIN}`)
        .replace(/wss:\/\/openfront\.io/g, `wss://${RENDER_DOMAIN}`);

      res.setHeader('Content-Type', 'text/html');
      return res.send(patchedData);
    } 
    
    // 3. INTERCEPT AND PATCH MAIN COMPILED WEBPACK SCRIPTS
    else if (req.url.endsWith('.js') || req.url.endsWith('.css')) {
      // Handle requests pointing to our dynamic custom API route mapping
      const targetHost = req.headers.host && req.headers.host.startsWith('api-') ? 'https://api.openfront.io' : 'https://openfront.io';
      const targetUrl = `${targetHost}${req.url}`;

      const assetRes = await fetch(targetUrl, { headers: { 'Referer': 'https://openfront.io/' } });
      const rawText = await assetRes.text();

      // Intercept compiled game loops and bend them away from the school block
      let patchedText = rawText
        .replace(/api\.openfront\.io/g, `api-${RENDER_DOMAIN}`)
        .replace(/openfront\.io/g, RENDER_DOMAIN)
        .replace(/wss:\/\/api\.openfront\.io/g, `wss://api-${RENDER_DOMAIN}`)
        .replace(/wss:\/\/openfront\.io/g, `wss://${RENDER_DOMAIN}`);

      if (req.url.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
      else res.setHeader('Content-Type', 'text/css');

      return res.send(patchedText);
    }
    
    // 4. PASSTHROUGH ROUTING FOR BINARY RENDER ASSETS
    else {
      const targetHost = req.headers.host && req.headers.host.startsWith('api-') ? 'https://api.openfront.io' : 'https://openfront.io';
      const targetUrl = `${targetHost}${req.url}`;

      const mediaResponse = await fetch(targetUrl, { headers: { 'Referer': 'https://openfront.io/' } });
      const contentType = mediaResponse.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);

      const arrayBuffer = await mediaResponse.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }

  } catch (error) {
    return res.status(500).send(`Mirror connection broken: ${error.message}`);
  }
});

const server = app.listen(PORT);

// Direct WebSocket routing upgrades traffic cleanly through your custom endpoint
server.on('upgrade', (request, socket, head) => {
  gameProxy.upgrade(request, socket, head);
});
