/**
 * Bing web search for clothing brand websites.
 * Uses varied query templates to surface brand own-sites.
 */

const cheerio = require('cheerio');
const axios = require('axios');
const { delay } = require('../siteScraper');
const { ProxyRotator } = require('../proxyRotator');
const config = require('../config');

const rotator = new ProxyRotator();

const BRAND_SEARCH_TEMPLATES = [
  '"{type}" clothing brand {country} contact email',
  '"{type}" fashion label {country} official site',
  '{type} apparel brand {country} email contact us',
  'independent {type} clothing brand {country}',
  'emerging {type} brand {country} contact',
  '{type} fashion brand {country} wholesale enquiry',
];

function buildQuery(brandType, country, round) {
  const template = BRAND_SEARCH_TEMPLATES[round % BRAND_SEARCH_TEMPLATES.length];
  return template
    .replace(/\{type\}/g, brandType)
    .replace(/\{country\}/g, country);
}

async function searchBing(brandType, country, page = 1) {
  const query = buildQuery(brandType, country, page - 1);
  const offset = (page - 1) * 10;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${offset + 1}&count=10`;

  try {
    const res = await axios.get(url, {
      headers: rotator.getHeaders(),
      timeout: 15000
    });

    const $ = cheerio.load(res.data);
    const results = [];

    $('#b_results .b_algo').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h2 a').first().text().trim();
      const link = $el.find('h2 a').first().attr('href') || '';
      const snippet = $el.find('.b_caption p').first().text().trim();

      if (title && link && isBrandSite(link)) {
        results.push({ companyName: title, website: link, snippet, source: 'bing' });
      }
    });

    return results;
  } catch {
    return [];
  }
}

function isBrandSite(url) {
  if (!url || !url.startsWith('http')) return false;
  const excluded = [
    ...config.BLACKLISTED_DOMAINS,
    'yellowpages', 'truelocal', 'hotfrog', 'yelp', 'tripadvisor',
    'wikipedia', 'wikihow', 'quora', 'pinterest', 'tumblr'
  ];
  return !excluded.some(d => url.includes(d));
}

async function scrapeSearchBing(brandType, country, rounds = 6) {
  const results = [];
  for (let i = 1; i <= rounds; i++) {
    const found = await searchBing(brandType, country, i);
    results.push(...found);
    if (found.length === 0) break;
    await delay(config.SEARCH_DELAY_MIN + Math.random() * (config.SEARCH_DELAY_MAX - config.SEARCH_DELAY_MIN));
  }
  return results;
}

module.exports = { scrapeSearchBing };
