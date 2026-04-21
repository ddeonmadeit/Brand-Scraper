const axios = require('axios');
const cheerio = require('cheerio');
const config = require('./config');
const { ProxyRotator } = require('./proxyRotator');
const { isValidEmail, emailBelongsToSite } = require('./qualityScorer');

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

/**
 * Extract emails from mailto: href links — most reliable signal.
 * Brands that hide emails from copy-paste still use mailto: links.
 */
function extractMailtoEmails($) {
  const emails = [];
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const email = href.replace(/^mailto:/i, '').split('?')[0].toLowerCase().trim();
    if (email) emails.push(email);
  });
  return emails;
}

/**
 * Extract emails via regex from raw HTML text.
 */
function extractRegexEmails(html) {
  const emails = [];
  const matches = html.match(EMAIL_REGEX) || [];
  for (const m of matches) {
    emails.push(m.toLowerCase().trim());
  }
  return emails;
}

/**
 * Extract emails from JSON-LD structured data.
 */
function extractJsonLdEmails(html) {
  const emails = [];
  const blocks = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const inner = block.replace(/<script[^>]*>|<\/script>/gi, '');
    try {
      const json = JSON.parse(inner);
      const text = JSON.stringify(json);
      const matches = text.match(EMAIL_REGEX) || [];
      emails.push(...matches.map(e => e.toLowerCase().trim()));
    } catch {}
  }
  return emails;
}

/**
 * Collect and deduplicate all emails from a page, preferring mailto: links.
 * Filters to brand-owned domain emails only.
 */
function extractBrandEmailsFromHtml(html, websiteUrl) {
  const $ = cheerio.load(html);
  const all = [
    ...extractMailtoEmails($),
    ...extractJsonLdEmails(html),
    ...extractRegexEmails(html)
  ];
  const unique = [...new Set(all)];
  return unique.filter(e => isValidEmail(e) && emailBelongsToSite(e, websiteUrl));
}

function extractOwnerName(html, $) {
  const candidates = [
    $('meta[name="author"]').attr('content'),
    $('[class*="founder"] [class*="name"]').first().text(),
    $('[class*="owner"] [class*="name"]').first().text(),
    $('[class*="team"] [class*="founder"]').first().text(),
    $('[itemprop="name"]').first().text(),
  ];
  for (const p of candidates) {
    const s = (p || '').trim();
    if (s.length > 2 && s.length < 60 && /\s/.test(s)) return s;
  }
  return '';
}

/**
 * Scrape a brand website for contact emails.
 * Tries contact/about pages first (most likely to have email), then homepage.
 */
async function scrapeSite(websiteUrl) {
  const results = [];

  try {
    const baseUrl = normaliseUrl(websiteUrl);
    if (!baseUrl) return results;

    // Contact pages first — homepage last as fallback
    const paths = [...config.CONTACT_PATHS, ''];
    const visited = new Set();

    for (const p of paths) {
      const url = baseUrl.replace(/\/$/, '') + p;
      if (visited.has(url)) continue;
      visited.add(url);

      try {
        const html = await fetchWithRetry(url, 1, 10000);
        const $ = cheerio.load(html);
        const emails = extractBrandEmailsFromHtml(html, baseUrl);
        const ownerName = extractOwnerName(html, $);

        for (const email of emails) {
          results.push({ email, ownerName, website: baseUrl });
        }

        if (results.length > 0) break;
      } catch {
        // Try next path
      }

      await delay(config.SITE_DELAY_MIN + Math.random() * (config.SITE_DELAY_MAX - config.SITE_DELAY_MIN));
    }
  } catch {
    // Skip failed sites silently
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

module.exports = { scrapeSite, fetchWithRetry, delay, extractBrandEmailsFromHtml };
