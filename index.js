import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
const app = express();
const PORT = process.env.PORT || 3000;

let browser;
let page;

// Boot up a single background browser session
async function initBrowser() {
  try {
    const autoChromePath = puppeteer.executablePath();
    browser = await puppeteer.launch({
      headless: true, // Required for Render environments
      executablePath: autoChromePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,800',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    
    console.log("Stealth mirror browser context initialized.");
  } catch (err) {
    console.error("Browser launch failed:", err);
  }
}

initBrowser();

app.all('*', async (req, res) => {
  if (!page) {
    return res.status(500).send("Proxy engine starting up. Please refresh in a moment.");
  }

  try {
    const targetUrl = `https://openfront.io${req.url}`;
    
    // 1. If hitting the core landing page or HTML frames, scrape via the Stealth Browser
    if (req.url === '/' || req.url.endsWith('.html') || !req.url.includes('.')) {
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Inject patches to hide headless automation variables from Cloudflare
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      const HTMLContent = await page.content();
      res.setHeader('Content-Type', 'text/html');
      return res.send(HTMLContent);
    } 
    
    // 2. ABSOLUTE FIX: Fetch all secondary media/scripts internally instead of redirecting
    else {
      const assetResponse = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
          'Referer': 'https://openfront.io/'
        }
      });

      const contentType = assetResponse.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);

      // Convert asset data to an array buffer and send raw binary data (images, js, css)
      const dataBuffer = await assetResponse.arrayBuffer();
      return res.send(Buffer.from(dataBuffer));
    }

  } catch (error) {
    console.error("Asset Stream Error:", error);
    return res.status(500).send(`Mirror stream broken: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Stealth Asset Mirror running live on port ${PORT}`);
});
