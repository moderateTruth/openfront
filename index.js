import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let browser;
let currentProxyTargetOrigin = 'https://duckduckgo.com';

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
    console.log("Global Proxy Engine Active.");
  } catch (err) {
    console.error("Browser launch failed:", err);
  }
}
initBrowser();

const visualOverrideStyles = `
  <style>
    body { 
      background-color: #0f172a !important; 
      color: #f8fafc !important; 
      font-family: sans-serif !important; 
      padding: 30px !important; 
      margin: 0 !important;
    }
    .links_main, .result, tr, table, .nav-link, .links { 
      display: block !important; 
      max-width: 800px !important; 
      margin: 16px 0 !important; 
      padding: 16px !important; 
      background: #1e293b !important; 
      border-radius: 8px !important; 
      border: none !important;
    }
    td { display: block !important; border: none !important; }
    a, .result__url, .result__title { 
      color: #38bdf8 !important; 
      text-decoration: none !important; 
      font-size: 18px !important; 
      font-weight: bold !important; 
    }
    a:hover { text-decoration: underline !important; }
    p, .result-snippet, .result__snippet { 
      color: #94a3b8 !important; 
      font-size: 14px !important; 
    }
    form { 
      background: #1e293b !important; 
      padding: 20px !important; 
      border-radius: 8px !important; 
      display: flex !important;
      gap: 10px !important;
      max-width: 800px !important;
    }
    input[type="text"] { 
      flex: 1 !important;
      padding: 10px !important; 
      background: #334155 !important; 
      color: #fff !important; 
      border: 1px solid #475569 !important; 
      border-radius: 4px !important; 
    }
    input[type="submit"], button { 
      padding: 10px 20px !important; 
      background: #0284c7 !important; 
      color: #fff !important; 
      border: none !important; 
      border-radius: 4px !important; 
      cursor: pointer !important; 
    }
    select, .nav-menu { display: none !important; }
  </style>
`;

async function handleProxyExtraction(targetUrl, req, res) {
  if (!browser) return res.status(500).send('Starting up engine...');

  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...');

    await page.evaluateOnNewDocument(() => {
      delete window.navigator.__proto__.serviceWorker;
    });

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

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

          function wrapUrl(url) {
            if (!url || typeof url !== 'string') return url;
            if (url.startsWith(PROXY_ORIGIN)) return url;
            let abs = url;
            if (url.startsWith('//')) abs = window.location.protocol + url;
            else if (url.startsWith('/') || !url.startsWith('http')) abs = new URL(url, TARGET_ORIGIN).href;
            return PROXY_ORIGIN + '/proxy?url=' + encodeURIComponent(abs);
          }

          window.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link && link.href && !link.href.includes('/proxy?url=')) {
              e.preventDefault();
              window.location.href = wrapUrl(link.href);
            }
          }, true);
        })();
      </script>
    `;
    
    if (renderedContent.includes('<head>')) {
      renderedContent = renderedContent.replace('<head>', `<head>${universalInterceptor}${visualOverrideStyles}`);
    } else {
      renderedContent = renderedContent.replace('<html>', `<html><head>${universalInterceptor}${visualOverrideStyles}</head>`);
    }

    res.setHeader('Content-Type', 'text/html');
    return res.send(renderedContent);
  } catch (error) {
    if (page) await page.close();
    return res.status(500).send(`Proxy connection error: ${error.message}`);
  }
}

app.get('/proxy', async (req, res) => {
  const rawUrlLine = req.originalUrl; 
  const urlMarker = '/proxy?url=';
  if (!rawUrlLine.includes(urlMarker)) return res.status(400).send('Missing URL');
  const targetUrl = decodeURIComponent(rawUrlLine.substring(rawUrlLine.indexOf(urlMarker) + urlMarker.length));
  return handleProxyExtraction(targetUrl, req, res);
});

app.all(['/html', '/html/'], async (req, res) => {
  let queryTerm = req.query.q || req.body.q;
  if (!queryTerm) return res.redirect('/');
  const targetUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(queryTerm)}`;
  return handleProxyExtraction(targetUrl, req, res);
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🌐 Stealth Portal</title>
      <style>
        body { font-family: sans-serif; background-color: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { text-align: center; background: #1e293b; padding: 40px; border-radius: 12px; max-width: 550px; width: 100%; box-sizing: border-box; }
        h2 { color: #38bdf8; margin-bottom: 20px; }
        .section-label { text-align: left; font-size: 12px; color: #38bdf8; font-weight: bold; margin: 15px 0 5px 0; }
        .input-group { display: flex; gap: 10px; margin-bottom: 15px; }
        input { flex: 1; padding: 12px; border-radius: 6px; border: 1px solid #475569; background: #334155; color: #fff; outline: none; }
        button { padding: 12px 24px; border-radius: 6px; border: none; background: #0284c7; color: #fff; font-weight: bold; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🌐 Stealth Gateway Portal</h2>
        <div class="section-label">Option 1: Direct URL Router</div>
        <div class="input-group">
          <input type="text" id="urlInput" placeholder="https://wikipedia.org" onkeydown="if(event.key==='Enter') launchUrl()">
          <button onclick="launchUrl()">Go</button>
        </div>
        <div class="section-label">Option 2: Unblocked Web Search</div>
        <div class="input-group">
          <input type="text" id="searchInput" placeholder="Type to search..." onkeydown="if(event.key==='Enter') launchSearch()">
          <button onclick="launchSearch()" style="background: #10b981;">Search</button>
        </div>
      </div>
      <script>
        function launchUrl() {
          let target = document.getElementById('urlInput').value.trim();
          if (!target) return;
          if (!target.startsWith('http://') && !target.startsWith('https://')) target = 'https://' + target;
          window.location.href = window.location.origin + '/proxy?url=' + encodeURIComponent(target);
        }
        function launchSearch() {
          let query = document.getElementById('searchInput').value.trim();
          if (!query) return;
          let cleanSearchUrl = 'https://duckduckgo.com/html/?q=' + encodeURIComponent(query);
          window.location.href = window.location.origin + '/proxy?url=' + encodeURIComponent(cleanSearchUrl);
        }
      </script>
    </body>
    </html>
  `);
});

app.get('*', async (req, res) => {
  let assetOrigin = currentProxyTargetOrigin.includes('duckduckgo.com') ? 'https://duckduckgo.com' : currentProxyTargetOrigin;
  let cleanRequestPath = req.originalUrl.startsWith('/') ? req.originalUrl : '/' + req.originalUrl;
  try {
    const assetResponse = await fetch(`${assetOrigin}${cleanRequestPath}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...' }
    });
    const contentType = assetResponse.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const arrayBuffer = await assetResponse.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    return res.status(404).send('Not found');
  }
});

app.listen(PORT);
