import { chromium } from 'playwright';
import axios from 'axios';

const webhook = process.env.N8N_WEBHOOK_URL;
const base = 'https://cryptonomads.org';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/?filter=conference`, { waitUntil: 'networkidle' });

await page.waitForSelector('text=Main Events');

const eventLinks = await page.$$eval('a[href^="/e/"]', anchors =>
  anchors.map(a => new URL(a.getAttribute('href'), 'https://cryptonomads.org').toString())
);

const results = [];

for (const link of eventLinks) {
  const eventPage = await browser.newPage();
  await eventPage.goto(link, { waitUntil: 'networkidle' });

  const externalLink = await eventPage.$$eval('a[href^="http"]', anchors => {
    return anchors
      .filter(a => a.innerText.includes('🌐') || a.title.toLowerCase().includes('website'))
      .map(a => a.href);
  });

  if (externalLink.length) {
    results.push({
      eventPage: link,
      officialWebsite: externalLink[0]
    });
  }

  await eventPage.close();
}

await browser.close();

if (webhook && results.length) {
  await axios.post(webhook, results);
  console.log(`Posted ${results.length} events to webhook.`);
} else {
  console.log(`Scraped ${results.length} events. Webhook not set.`);
}
