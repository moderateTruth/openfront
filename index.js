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
    console.log("Global Interception Proxy Engine initialized successfully.");
  } catch (err) {
    console.error("Failed to launch proxy browser:", err);
  }
}
initBrowser();

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

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    let renderedContent = await page.content();
    await page.close();

    const proxyOrigin = `https://${req.headers.host}`;
    const urlObj = new URL(targetUrl);
    const targetOrigin = urlObj.origin;

    // THE DEFINITIVE FIXED INTERCEPTOR: Overrides History API, Fetch, AJAX, Forms, and URL mutations
    const universalInterceptor = `
      <script>
        (function() {
          const PROXY_ORIGIN = "${proxyOrigin}";
          const TARGET_ORIGIN = "${targetOrigin}";

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

          // 1. FIXED THE HOMEPAGE KICK-OUT: Override the History API to intercept background path changes
          const originalPushState = history.pushState;
          history.pushState = function(state, title, url) {
            if (url && !url.includes('/proxy?url=')) {
              // Force browser context redirection instead of allowing clean path updates
              window.location.href = wrapUrl(url);
              return;
            }
            return originalPushState.apply(this, arguments);
          };

          const originalReplaceState = history.replaceState;
          history.replaceState = function(state, title, url) {
            if (url && !url.includes('/proxy?url=')) {
              window.location.href = wrapUrl(url);
              return;
            }
            return originalReplaceState.apply(this, arguments);
          };

          // 2. Intercept Native Fetch Calls
          const originalFetch = window.fetch;
          window.fetch = function(input, init) {
            if (typeof input === 'string') {
              input = wrapUrl(input);
            } else if (input instanceof Request) {
              input = new Request(wrapUrl(input.url), input);
            }
            return originalFetch.apply(this, arguments);
          };

          // 3. Intercept Native XMLHttpRequests
          const originalOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url) {
            if (typeof url === 'string') url = wrapUrl(url);
            return originalOpen.apply(this, arguments);
          };

          // 4. Intercept Form Submit Methods
          const originalSubmit = HTMLFormElement.prototype.submit;
          HTMLFormElement.prototype.submit = function() {
            if (this.action && !this.action.includes('/proxy?url=')) {
              this.action = wrapUrl(this.action);
            }
            return originalSubmit.apply(this, arguments);
          };

          // 5. Intercept Click Events and Form Actions
          window.addEventListener('submit', function(e) {
            const form = e.target;
            if (form && form.action && !form.action.includes('/proxy?url=')) {
              form.action = wrapUrl(form.action);
            }
          }, true);

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
    console.error(`Proxy failed to fetch:`, error.message);
    return res.status(500).send(`Proxy Error: Details: ${error.message}`);
  }
});

// Interactive Front Page Layout Dashboard
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
