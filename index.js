import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
const app = express();
const PORT = process.env.PORT || 8080;

let browser;
let currentProxyTargetOrigin = 'https://html.duckduckgo.com';

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
    console.log("Global Interception Proxy Engine initialized successfully.");
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

// 1. PRIMARY PROXY GATEWAY ROUTE
app.get('/proxy', async (req, res) => {
  const rawUrlLine = req.originalUrl; 
  const urlMarker = '/proxy?url=';
  
  if (!rawUrlLine.includes(urlMarker)) {
    return res.status(400).send('Error: Missing "url" query parameter.');
  }

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

    await page.evaluateOnNewDocument(() => {
      delete window.navigator.__proto__.serviceWorker;
    });

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    let renderedContent = await page.content();
    await page.close();

    const proxyOrigin = `https://${req.headers.host}`;
    const urlObj = new URL(targetUrl);
    currentProxyTargetOrigin = urlObj.origin;

    const universalInterceptor = `
      <script>
        (function() {
          const PROXY_ORIGIN = "${proxyOrigin}";
          const TARGET_ORIGIN = "${currentProxyTargetOrigin}";

          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
              for(let registration of registrations) { registration.unregister(); }
            });
          }

          function wrapUrl(url) {
            if (!url || typeof url !== 'string') return url;
            if (url.startsWith(PROXY_ORIGIN)) return url;
            
            let absoluteUrl = url;
            if (url.startsWith('//')) {
              absoluteUrl = window.location.protocol + url;
            } else if (url.startsWith('/') || !url.startsWith('http')) {
              absoluteUrl = new URL(url, TARGET_ORIGIN).href;
            }
            
            return PROXY_ORIGIN + '/proxy?url=' + encodeURIComponent(absoluteUrl);
          }

          window.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link && link.href) {
              const hrefValue = link.getAttribute('href');
              if (hrefValue && !hrefValue.startsWith('javascript:') && !hrefValue.startsWith('#') && !link.href.includes('/proxy?url=')) {
                e.preventDefault();
                window.location.href = wrapUrl(link.href);
              }
            }
          }, true);
        })();
      </script>
    `;
    
    if (renderedContent.includes('<head>')) {
      renderedContent = renderedContent.replace('<head>', `<head>${universalInterceptor}`);
    } else if (renderedContent.includes('<html>')) {
      renderedContent = renderedContent.replace('<html>', `<html><head>${universalInterceptor}</head>`);
    }

    res.setHeader('Content-Type', 'text/html');
    return res.send(renderedContent);

  } catch (error) {
    if (page) await page.close();
    return res.status(500).send(`Proxy Error: Details: ${error.message}`);
  }
});

// 2. INTERACTIVE MAIN HUB PAGE (Two-Box Format Restored)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>🌐 Stealth Portal</title>
      <style>
        body { font-family: sans-serif; background-color: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { text-align: center; background: #1e293b; padding: 40px; border-radius: 12px; max-width: 550px; width: 100%; box-sizing: border-box; }
        h2 { margin-bottom: 8px; color: #38bdf8; }
        p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
        .section-label { text-align: left; font-size: 12px; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; margin: 15px 0 5px 0; }
        .input-group { display: flex; gap: 10px; margin-bottom: 15px; }
        input { flex: 1; padding: 12px 16px; border-radius: 6px; border: 1px solid #475569; background: #334155; color: #fff; font-size: 16px; outline: none; }
        input:focus { border-color: #38bdf8; }
        button { padding: 12px 24px; border-radius: 6px; border: none; background: #0284c7; color: #fff; font-size: 16px; font-weight: bold; cursor: pointer; }
        button:hover { background: #0369a1; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🌐 Stealth Gateway Portal</h2>
        <p>Browse or search the web securely without breaking the proxy tunnel context.</p>
        
        <div class="section-label">Option 1: Direct URL Router</div>
        <div class="input-group">
          <input type="text" id="urlInput" placeholder="https://wikipedia.org" onkeydown="if(event.key==='Enter') launchUrl()">
          <button onclick="launchUrl()">Go</button>
        </div>

        <div class="section-label">Option 2: Unblocked Web Search</div>
        <div class="input-group">
          <input type="text" id="searchInput" placeholder="Type anything to search..." onkeydown="if(event.key==='Enter') launchSearch()">
          <button onclick="launchSearch()" style="background: #10b981;">Search</button>
        </div>
      </div>

      <script>
        function launchUrl() {
          let target = document.getElementById('urlInput').value.trim();
          if (!target) return;
          if (!target.startsWith('http://') && !target.startsWith('https://')) {
            target = 'https://' + target;
          }
          window.location.href = window.location.origin + '/proxy?url=' + encodeURIComponent(target);
        }

        function launchSearch() {
          let query = document.getElementById('searchInput').value.trim();
          if (!query) return;
          let cleanSearchUrl = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
          window.location.href = window.location.origin + '/proxy?url=' + encodeURIComponent(cleanSearchUrl);
        }
      </script>
    </body>
    </html>
  `);
});

// 3. MULTI-DOMAIN INTELLIGENT FALLBACK ASSET ROUTER
app.get('*', async (req, res) => {
  let cleanRequestPath = req.originalUrl;
  if (!cleanRequestPath.startsWith('/')) {
    cleanRequestPath = '/' + cleanRequestPath;
  }

  // THE FIXED TRANSLATION MAP: Detect core design sheets and map them directly to the main server domain
  let assetOrigin = currentProxyTargetOrigin;
  if (cleanRequestPath.startsWith('/s/') || cleanRequestPath.startsWith('/d/') || cleanRequestPath.startsWith('/t/') || assetOrigin.includes('duckduckgo.com')) {
    assetOrigin = 'https://duckduckgo.com';
  }

  const fullDestAssetUrl = `${assetOrigin}${cleanRequestPath}`;
  
  try {
    const assetResponse = await fetch(fullDestAssetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
    });
    
    const contentType = assetResponse.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    
    const arrayBuffer = await assetResponse.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error("Asset pipe error:", error.message);
    return res.status(404).send('Asset not found');
  }
});

app.listen(PORT, () => {
  console.log(`Proxy listening natively on port ${PORT}`);
});
