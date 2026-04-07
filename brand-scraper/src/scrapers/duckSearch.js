/**
 * DuckDuckGo web search for clothing brand websites.
 * Targets brand's own websites (Shopify stores, brand sites, etc.)
 * rather than directories.
 */

const cheerio = require('cheerio');
const axios = require('axios');
const { delay } = require('../siteScraper');
const { ProxyRotator } = require('../proxyRotator');
const config = require('../config');

const rotator = new ProxyRotator();

const BRAND_SEARCH_TEMPLATES = [
  '{type} clothing brand {country} contact',
  '{type} fashion label {country} email',
  '{type} apparel brand {country} independent',
  'independent {type} brand {country} wholesale contact',
  '{type} clothing designer {country} enquiries',
  'emerging {type} brand {country} contact email',
  '{type} streetwear label {country} official site contact',
  'australian {type} clothing brand email contact', // kept for AU specificity if applicable
];

function buildQuery(brandType, country, round) {
  const template = BRAND_SEARCH_TEMPLATES[round % BRAND_SEARCH_TEMPLATES.length];
  return template
    .replace('{type}', brandType)
    .replace('{country}', country)
    .replace(/australian /i, country.toLowerCase() === 'australia' ? 'australian ' : '');
}

async function searchDuckDuckGo(brandType, country, page = 1) {
  const query = buildQuery(brandType, country, page - 1);
  const offset = (page - 1) * 30;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${offset}`;

  try {
    const res = await axios.get(url, {
      headers: {
        ...rotator.getHeaders(),
        'Referer': 'https://duckduckgo.com/'
      },
      timeout: 15000
    });

    const $ = cheerio.load(res.data);
    const results = [];

    $('.result, .web-result, [class*="result"]').each((_, el) => {
      const $el = $(el);
      const title = $el.find('.result__title, .result__a, h2').first().text().trim();
      const rawLink = $el.find('a[href]').first().attr('href') || '';
      const snippet = $el.find('.result__snippet, [class*="snippet"]').first().text().trim();

      const link = extractCleanUrl(rawLink);

      if (title && link && isBrandSite(link)) {
        results.push({ companyName: title, website: link, snippet, source: 'duckduckgo' });
      }
    });

    return results;
  } catch {
    return [];
  }
}

function extractCleanUrl(href) {
  try {
    if (!href) return '';
    const match = href.match(/uddg=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
    if (href.startsWith('http')) return href;
    return '';
  } catch {
    return '';
  }
}

function isBrandSite(url) {
  if (!url || !url.startsWith('http')) return false;
  // Exclude social media, directories, and aggregators
  const excluded = [
    ...config.BLACKLISTED_DOMAINS,
    'yellowpages', 'truelocal', 'hotfrog', 'yelp', 'tripadvisor',
    'wikipedia', 'wikihow', 'quora', 'pinterest', 'tumblr'
  ];
  return !excluded.some(d => url.includes(d));
}

async function scrapeSearchDuck(brandType, country, rounds = 6) {
  const results = [];
  for (let i = 1; i <= rounds; i++) {
    const found = await searchDuckDuckGo(brandType, country, i);
    results.push(...found);
    if (found.length === 0) break;
    await delay(config.SEARCH_DELAY_MIN + Math.random() * (config.SEARCH_DELAY_MAX - config.SEARCH_DELAY_MIN));
  }
  return results;
}

module.exports = { scrapeSearchDuck };
