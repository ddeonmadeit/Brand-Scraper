const axios = require('axios');
const cheerio = require('cheerio');
const config = require('./config');
const { ProxyRotator } = require('./proxyRotator');
const { isValidEmail } = require('./qualityScorer');

const rotator = new ProxyRotator();

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

async function fetchWithRetry(url, retries = 2, timeout = 12000) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await axios.get(url, {
        headers: rotator.getHeaders(),
        timeout,
        maxRedirects: 5
      });
      return res.data;
    } catch (err) {
      if (i === retries) throw err;
      await delay(1500 * (i + 1));
    }
  }
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function extractEmailsFromHtml(html) {
  const emails = [];
  const matches = html.match(EMAIL_REGEX) || [];
  for (const m of matches) {
    const clean = m.toLowerCase().trim();
    if (isValidEmail(clean)) emails.push(clean);
  }
  return [...new Set(emails)];
}

function extractOwnerName(html, $) {
  const patterns = [
    // Common founder/owner meta patterns
    $('meta[name="author"]').attr('content'),
    $('[class*="founder"] [class*="name"]').first().text(),
    $('[class*="owner"] [class*="name"]').first().text(),
    $('[class*="team"] [class*="founder"]').first().text(),
  ];

  for (const p of patterns) {
    if (p && p.trim().length > 2 && p.trim().length < 60) {
      return p.trim();
    }
  }
  return '';
}

/**
 * Scrape a brand's website for contact emails.
 * Returns array of { email, ownerName, website }
 */
async function scrapeSite(websiteUrl) {
  const results = [];

  try {
    const baseUrl = normaliseUrl(websiteUrl);
    if (!baseUrl) return results;

    // Try contact/about pages first, then homepage
    const paths = ['', ...config.CONTACT_PATHS];
    const visited = new Set();

    for (const p of paths) {
      const url = baseUrl.replace(/\/$/, '') + p;
      if (visited.has(url)) continue;
      visited.add(url);

      try {
        const html = await fetchWithRetry(url, 1, 10000);
        const $ = cheerio.load(html);
        const emails = extractEmailsFromHtml(html);
        const ownerName = extractOwnerName(html, $);

        for (const email of emails) {
          results.push({ email, ownerName, website: baseUrl });
        }

        if (results.length > 0) break; // Stop once we have emails
      } catch {
        // Try next path
      }

      await delay(config.SITE_DELAY_MIN + Math.random() * (config.SITE_DELAY_MAX - config.SITE_DELAY_MIN));
    }
  } catch {
    // Silently skip failed sites
  }

  return results;
}

function normaliseUrl(url) {
  try {
    if (!url) return null;
    if (!url.startsWith('http')) url = 'https://' + url;
    const u = new URL(url);
    return u.origin;
  } catch {
    return null;
  }
}

module.exports = { scrapeSite, fetchWithRetry, delay };
