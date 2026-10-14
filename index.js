import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';

puppeteer.use(StealthPlugin());
const app = express();
const PORT = process.env.PORT || 3000;

let browser;
let page;

// Explicitly set a local cache path configuration
const localChromeFolder = path.join(process.cwd(), 'node_modules', '.cache', 'puppeteer');

async function initBrowser() {
  try {
    console.log("Launching core automation instance...");

    browser = await puppeteer.launch({
      headless: true, // Render requires headless mode to run
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
    
    console.log("Stealth engine browser context initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize core browser configuration:", err);
  }
}

// Start the browser immediately
initBrowser();

app.all('*', async (req, res) => {
  if (!page) {
    return res.status(500).send("Proxy engine starting up. Please refresh in a moment.");
  }

  try {
    const targetUrl = `https://openfront.io${req.url}`;
    
    if (req.url === '/' || req.url.endsWith('.html')) {
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      const HTMLContent = await page.content();
      res.setHeader('Content-Type', 'text/html');
      return res.send(HTMLContent);
    } else {
      res.redirect(targetUrl);
    }

  } catch (error) {
    console.error("Session Exception:", error);
    return res.status(500).send(`Verification bypass failed: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Stealth Session Reflector running live on port ${PORT}`);
});
