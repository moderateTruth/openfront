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

const wsProxy = createProxyMiddleware({
  target: 'https://openfront.io',
  changeOrigin: true,
  ws: true,
  logLevel: 'debug'
});

app.all('*', async (req, res) => {
  if (!page) {
    return res.status(500).send("Proxy engine starting up. Please refresh in a moment.");
  }

  const RENDER_DOMAIN = req.headers.host;
  const targetUrl = `https://openfront.io${req.url}`;

  try {
    // 1. MATCH CORE DOCUMENT LAYERS (HTML structure and frames)
    if (req.url === '/' || req.url.endsWith('.html') || !req.url.includes('.')) {
      // THE FIX: Switch from 'networkidle2' to 'domcontentloaded' to stop the infinite browser tab loading circle
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      let rawData = await page.content();
      
      // Patch strings directly inside memory
      let patchedData = rawData
        .replace(/openfront\.io/g, RENDER_DOMAIN)
        .replace(/wss:\/\/openfront\.io/g, `wss://${RENDER_DOMAIN}`);

      res.setHeader('Content-Type', 'text/html');
      return res.send(patchedData);
    } 
    
    // 2. FORWARD SCRIPTS AND STYLES DIRECTLY THROUGH THE SERVER PIPELINE
    else if (req.url.endsWith('.js') || req.url.endsWith('.css')) {
      const assetRes = await fetch(targetUrl, { headers: { 'Referer': 'https://openfront.io' } });
      const rawText = await assetRes.text();

      let patchedText = rawText
        .replace(/openfront\.io/g, RENDER_DOMAIN)
        .replace(/wss:\/\/openfront\.io/g, `wss://${RENDER_DOMAIN}`);

      if (req.url.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
      else res.setHeader('Content-Type', 'text/css');

      return res.send(patchedText);
    }
    
    // 3. PASSTHROUGH STREAM FOR IMAGES, TEXTURES AND AUDIO
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

const server = app.listen(PORT);

server.on('upgrade', (request, socket, head) => {
  wsProxy.upgrade(request, socket, head);
});
