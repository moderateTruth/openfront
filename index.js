import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
const app = express();
const PORT = process.env.PORT || 8080;

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

// Main proxy route processing requests
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Error: Missing "url" query parameter.');
  }

  if (!browser) {
    return res.status(500).send('Proxy engine is starting up. Please refresh in a moment.');
  }

  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

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

// Interactive Front Page with Unblocked Input Dashboard
app.get('*', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>🌐 Stealth Portal</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #0f172a;
          color: #f8fafc;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          text-align: center;
          background: #1e293b;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          max-width: 500px;
          width: 100%;
          box-sizing: border-box;
        }
        h2 { margin-bottom: 8px; color: #38bdf8; }
        p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
        .input-group {
          display: flex;
          gap: 10px;
        }
        input {
          flex: 1;
          padding: 12px 16px;
          border-radius: 6px;
          border: 1px solid #475569;
          background: #334155;
          color: #fff;
          font-size: 16px;
          outline: none;
        }
        input:focus { border-color: #38bdf8; }
        button {
          padding: 12px 24px;
          border-radius: 6px;
          border: none;
          background: #0284c7;
          color: #fff;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: background 0.2s;
        }
        button:hover { background: #0369a1; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🌐 Stealth Gateway Portal</h2>
        <p>Enter a destination web link address below to browse securely.</p>
        
        <div class="input-group">
          <input type="text" id="urlInput" placeholder="https://example.com" onkeydown="if(event.key==='Enter') launchProxy()">
          <button onclick="launchProxy()">Go</button>
        </div>
      </div>

      <script>
        function launchProxy() {
          let target = document.getElementById('urlInput').value.trim();
          if (!target) return;
          
          // Auto-format shorthand inputs like 'google.com' to standard browser protocols
          if (!target.startsWith('http://') && !target.startsWith('https://')) {
            target = 'https://' + target;
          }
          
          // Navigate seamlessly via the local proxy path context
          window.location.href = window.location.origin + '/proxy?url=' + encodeURIComponent(target);
        }
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Proxy listening natively on port ${PORT}`);
});
