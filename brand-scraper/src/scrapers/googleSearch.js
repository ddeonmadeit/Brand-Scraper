/**
 * Google web search for clothing brand websites.
 * Uses a rotating set of queries to surface brand own-sites.
 * Google blocks heavily so results are treated as a bonus on top of DDG/Bing.
 */

const cheerio = require('cheerio');
const axios = require('axios');
const { delay } = require('../siteScraper');
const { ProxyRotator } = require('../proxyRotator');
const config = require('../config');

const rotator = new ProxyRotator();

const TEMPLATES = [
  '"{type}" clothing brand {country} contact email',
  '"{type}" fashion label {country} official website contact',
  'independent {type} clothing brand {country} email',
  'emerging {type} brand {country} contact us',
  '{type} apparel brand {country} wholesale enquiry email',
  'small {type} clothing brand {country} founder contact',
];

function buildQuery(brandType, country, round) {
  const tpl = TEMPLATES[round % TEMPLATES.length];
  return tpl.replace(/\{type\}/g, brandType).replace(/\{country\}/g, country);
}

async function searchGoogle(brandType, country, page = 1) {
  const query = buildQuery(brandType, country, page - 1);
  const start = (page - 1) * 10;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&num=10`;

  try {
    const res = await axios.get(url, {
      headers: {
        ...rotator.getHeaders(),
        'Referer': 'https://www.google.com/'
      },
      timeout: 15000
    });

    const $ = cheerio.load(res.data);
    const results = [];

    // Google result containers
    $('div.g, div[data-sokoban-container], .tF2Cxc').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h3').first().text().trim();
      const link  = $el.find('a').first().attr('href') || '';

      if (title && link && link.startsWith('http') && isBrandSite(link)) {
        results.push({ companyName: title, website: link, source: 'google' });
      }
    });

    return results;
  } catch {
    return [];
  }
}

function isBrandSite(url) {
  if (!url || !url.startsWith('http')) return false;
  return !config.BLACKLISTED_DOMAINS.some(d => url.includes(d));
}

async function scrapeSearchGoogle(brandType, country, rounds = 4) {
  const results = [];
  for (let i = 1; i <= rounds; i++) {
    const found = await searchGoogle(brandType, country, i);
    results.push(...found);
    if (found.length === 0) break;
    await delay(config.SEARCH_DELAY_MIN + Math.random() * (config.SEARCH_DELAY_MAX - config.SEARCH_DELAY_MIN));
  }
  return results;
}

module.exports = { scrapeSearchGoogle };
