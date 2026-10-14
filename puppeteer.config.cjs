const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Overrides the cache globally to sit securely inside your Node directory
  cacheDirectory: join(__dirname, 'node_modules', '.cache', 'puppeteer'),
};
