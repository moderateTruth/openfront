import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
const app = express();
const PORT = process.env.PORT || 3000;

app.all('*', async (req, res) => {
  let browser;
  try {
    // Dynamically look up the exact folder Puppeteer downloaded chrome into
    const autoChromePath = puppeteer.executablePath();

    // Launch a stealth browser instance natively supported by Render's environment
    browser = await puppeteer.launch({
      headless: true,
      executablePath: autoChromePath, // Solves path mismatch automatically
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();
    
    // Mimic a standard desktop window and real User Agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Route to the game and wait for the security scripts to finish running
    const targetUrl = `https://openfront.io${req.url}`;
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    
    // Extract the fully rendered game HTML page after the challenge clears
    const content = await page.content();
    await browser.close();

    res.setHeader('Content-Type', 'text/html');
    return res.send(content);

  } catch (error) {
    if (browser) await browser.close();
    console.error("Stealth Error:", error);
    return res.status(500).send(`Verification bypass failed: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Stealth Engine active on port ${PORT}`);
});
