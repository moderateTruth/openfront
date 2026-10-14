import express from 'express';
import { executablePath } from 'puppeteer'; // CRITICAL: Import core path resolution natively
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
const app = express();
const PORT = process.env.PORT || 3000;

let browser;
let page;

// Initialize a single persistent browser instance when the server starts
async function initBrowser() {
  try {
    // This accurately looks up the real binary file location in Render's global cache folder
    const realChromePath = executablePath(); 
    console.log(`Launching Chrome from verified path: ${realChromePath}`);

    browser = await puppeteer.launch({
      headless: true, // Render requires headless mode to run
      executablePath: realChromePath, // Solves path mismatch permanently
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,800',
        '--disable-web-security', // Bypasses cross-origin blocking layers
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Explicit modern browser components to mimic an authentic user session
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
    
    // Evaluate if the resource is a core document asset or internal media
    if (req.url === '/' || req.url.endsWith('.html')) {
      // Force navigation, overriding the automation-detection signatures
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Inject script straight into the window environment to strip residual tracking metrics
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      const HTMLContent = await page.content();
      res.setHeader('Content-Type', 'text/html');
      return res.send(HTMLContent);
    } else {
      // Direct stream proxying for styling files, map configurations, and scripts
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
