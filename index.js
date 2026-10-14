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
    console.log("Deep Rewrite Proxy Engine initialized successfully.");
  } catch (err) {
    console.error("Failed to launch proxy browser:", err);
  }
}
initBrowser();

function cleanUrl(target, baseOrigin) {
  if (!target) return target;
  if (target.startsWith('//')) return 'https:' + target;
  if (target.startsWith('/') || !target.startsWith('http')) {
    return new URL(target, baseOrigin).href;
  }
  return target;
}

app.get('/proxy', async (req, res) => {
  // THE FIX: Rebundle parameters that were broken apart by search engine forms
  const rawUrlLine = req.originalUrl; 
  const urlMarker = '/proxy?url=';
  
  if (!rawUrlLine.includes(urlMarker)) {
    return res.status(400).send('Error: Missing "url" query parameter.');
  }

  // Extract everything after '/proxy?url=' in its raw, un-split form
  const rawTargetUrl = rawUrlLine.substring(rawUrlLine.indexOf(urlMarker) + urlMarker.length);
  const targetUrl = decodeURIComponent(rawTargetUrl);

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

    let renderedContent = await page.content();
    await page.close();

    const proxyOrigin = `https://${req.headers.host}`;
    const urlObj = new URL(targetUrl);
    const targetOrigin = urlObj.origin;

    // Rewrite click links
    renderedContent = renderedContent.replace(/href=["']([^"']+)["']/g, (match, p1) => {
      if (p1.startsWith('javascript:') || p1.startsWith('#')) return match;
      const absoluteUrl = cleanUrl(p1, targetOrigin);
      return `href="${proxyOrigin}/proxy?url=${encodeURIComponent(absoluteUrl)}"`;
    });

    // Rewrite form actions
    renderedContent = renderedContent.replace(/action=["']([^"']+)["']/g, (match, p1) => {
      const absoluteUrl = cleanUrl(p1, targetOrigin);
      return `action="${proxyOrigin}/proxy?url=${encodeURIComponent(absoluteUrl)}"`;
    });

    // Javascript form interception script
    const injectionScript = `
      <script>
        window.addEventListener('submit', function(e) {
          const form = e.target;
          if (form && form.action && !form.action.includes('/proxy?url=')) {
            e.preventDefault();
            const absoluteUrl = new URL(form.getAttribute('action'), "${targetOrigin}").href;
            
            // Build form inputs manually into the URL query parameters
            const formData = new FormData(form);
            const params = new URLSearchParams(formData).toString();
            let finalUrl = absoluteUrl;
            if (params) {
              finalUrl += (absoluteUrl.includes('?') ? '&' : '?') + params;
            }
            
            window.location.href = window.location.origin + '/proxy?url=' + encodeURIComponent(finalUrl);
          }
        }, true);
      </script>
    `;
    
    if (renderedContent.includes('</head>')) {
      renderedContent = renderedContent.replace('</head>', `${injectionScript}</head>`);
    }

    res.setHeader('Content-Type', 'text/html');
    return res.send(renderedContent);

  } catch (error) {
    if (page) await page.close();
    console.error(`Proxy failed to fetch:`, error.message);
    return res.status(500).send(`Proxy Error: Details: ${error.message}`);
  }
});

// Interactive Front Page
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
        .input-group { display: flex; gap: 10px; }
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
          <input type="text" id="urlInput" placeholder="https://google.com" onkeydown="if(event.key==='Enter') launchProxy()">
          <button onclick="launchProxy()">Go</button>
        </div>
      </div>
      <script>
        function launchProxy() {
          let target = document.getElementById('urlInput').value.trim();
          if (!target) return;
          if (!target.startsWith('http://') && !target.startsWith('https://')) {
            target = 'https://' + target;
          }
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
