#!/usr/bin/env bash
# exit on error
set -o errexit

# Install standard project dependencies
npm install

# Download and install a stable Chromium binary inside Render's environment
echo "...Installing Puppeteer Chromium Dependencies..."
npx puppeteer browsers install chrome
