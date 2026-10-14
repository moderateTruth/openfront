import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
const app = express();
const PORT = process.env.PORT || 8080; // Defaulting to Railway's container port

let browser;

async function initBrowser() {
  try {
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
    console.log("Global Web Proxy Engine initialized successfully.");
  } catch (err) {
    console.error("Failed to launch proxy browser:", err);
  }
}
initBrowser();

// Main proxy route: format as http://your-proxy.app
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Error: Missing "url" query parameter. Usage: /proxy?url=https://example.com');
  }

  if (!browser) {
    return res.status(500).send('Proxy engine is starting up. Please refresh in a moment.');
  }

  let page;
  try {
    // Open a fresh sandboxed page tab for this specific request
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    // Load the destination URL requested by your Chromebook
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Strip automation variables so anti-bot WAF layers treat it like a human browser
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // Capture the completely processed HTML page structure
    const renderedContent = await page.content();
    await page.close();

    res.setHeader('Content-Type', 'text/html');
    return res.send(renderedContent);

  } catch (error) {
    if (page) await page.close();
    console.error(`Proxy failed to fetch ${targetUrl}:`, error.message);
    return res.status(500).send(`Proxy Error: Unable to fetch target resource. Details: ${error.message}`);
  }
});

// Fallback landing instructions page
app.get('*', (req, res) => {
  const host = req.headers.host;
  res.send(`
    <div style="font-family: sans-serif; padding: 40px; text-align: center;">
      <h2>🌐 Your Self-Built Web Proxy is Online</h2>
      <p>To view an unblocked site, append the target address to your proxy link like this:</p>
      <code style="background: #f4f4f4; padding: 10px; display: inline-block; border-radius: 4px; margin: 10px 0;">
        https://${host}/proxy?url=https://example.com
      </code>
    </div>
  `);
});

app.listen(PORT, () => {
  console.log(`Proxy listening natively on port ${PORT}`);
});
