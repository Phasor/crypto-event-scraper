import { chromium } from 'playwright';
import axios from 'axios';
import fs from 'fs';

const webhook = process.env.N8N_WEBHOOK_URL;
const base = 'https://cryptonomads.org';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/?filter=conference`, { waitUntil: 'networkidle' });

await page.waitForSelector('text=Main Events');

// Get all event detail page links
const eventLinks = await page.$$eval('a[href^="/e/"]', anchors =>
  anchors.map(a => new URL(a.getAttribute('href'), base).toString())
);

const results = [];

for (const link of eventLinks) {
  const eventPage = await browser.newPage();
  await eventPage.goto(link, { waitUntil: 'networkidle' });

  const externalLink = await eventPage.$$eval('a[href^="http"]', anchors =>
    anchors
      .filter(a =>
        a.innerText.includes('🌐') ||
        a.title.toLowerCase().includes('website') ||
        a.getAttribute('aria-label')?.toLowerCase().includes('website')
      )
      .map(a => a.href)
  );

  if (externalLink.length > 0) {
    results.push({
      eventPage: link,
      officialWebsite: externalLink[0]
    });
  }

  await eventPage.close();
}

await browser.close();

// 📝 Save to local output.json
try {
  fs.writeFileSync('output.json', JSON.stringify(results, null, 2));
  console.log(`💾 Saved ${results.length} events to output.json`);
} catch (err) {
  console.error('❌ Failed to write output.json:', err.message);
}

if (webhook && results.length > 0) {
  try {
    await axios.post(webhook, results);
    console.log(`✅ Posted ${results.length} events to webhook.`);
  } catch (error) {
    console.error('❌ Failed to post to webhook:', error.message);
    process.exit(1);
  }
} else {
  console.log(`ℹ️ Scraped ${results.length} events. No webhook provided or nothing to send.`);
}
