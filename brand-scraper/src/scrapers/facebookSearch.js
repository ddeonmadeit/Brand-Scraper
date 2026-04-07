/**
 * Facebook brand discovery via search engines.
 *
 * Facebook Pages for clothing brands are publicly indexed by Google/Bing.
 * We search for brand pages, extract their website link (brands almost always
 * list their site on their FB page), then scrape that site for emails.
 */

const cheerio = require('cheerio');
const axios = require('axios');
const { delay } = require('../siteScraper');
const { ProxyRotator } = require('../proxyRotator');
const config = require('../config');

const rotator = new ProxyRotator();

const BRAND_TYPE_QUERIES = {
  'streetwear':       ['streetwear clothing brand page', 'urban streetwear brand page'],
  'luxury':           ['luxury fashion brand page', 'high end designer clothing page'],
  'sustainable':      ['sustainable fashion brand page', 'ethical clothing brand page'],
  'activewear':       ['activewear brand page', 'athletic apparel brand page'],
  'workwear':         ['workwear clothing brand page'],
  'vintage':          ['vintage clothing brand page', 'retro fashion brand page'],
  'swimwear':         ['swimwear brand page', 'beach wear brand page'],
  'denim':            ['denim brand page', 'jeans clothing brand page'],
  'minimalist':       ['minimalist clothing brand page', 'minimal fashion page'],
  'sportswear':       ['sportswear brand page', 'sports clothing brand page'],
  'kids':             ['kids clothing brand page', 'children apparel brand page'],
  'accessories':      ['fashion accessories brand page'],
  'formal / tailoring': ['tailoring clothing brand page', 'formal wear brand page'],
  'indie / independent': ['independent clothing brand page', 'indie fashion brand page', 'boutique clothing brand page']
};

function getQueries(brandType, country) {
  const base = BRAND_TYPE_QUERIES[brandType.toLowerCase()] ||
    [`${brandType} clothing brand page`, `${brandType} fashion brand`];
  return base.map(q => `${q} ${country} site:facebook.com`);
}

async function searchFacebookBrands(brandType, country, page = 1) {
  const queries = getQueries(brandType, country);
  const query = queries[(page - 1) % queries.length];
  const offset = Math.floor((page - 1) / queries.length) * 10;

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

      if (link && isFacebookPage(link)) {
        const pageSlug = extractFacebookSlug(link);
        if (pageSlug) {
          results.push({
            companyName: cleanTitle(title),
            facebookUrl: `https://www.facebook.com/${pageSlug}/`,
            facebookSlug: pageSlug,
            snippet,
            source: 'facebook'
          });
        }
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

function isFacebookPage(url) {
  if (!url.includes('facebook.com')) return false;
  // Exclude non-page paths
  const skip = ['/login', '/signup', '/groups/', '/events/', '/marketplace', '/watch', '/gaming', '/help'];
  return !skip.some(s => url.includes(s));
}

function extractFacebookSlug(url) {
  try {
    const match = url.match(/facebook\.com\/([a-zA-Z0-9_.]+)\/?/);
    if (!match) return null;
    const slug = match[1];
    const skip = ['pages', 'groups', 'events', 'login', 'home', 'photo', 'video', 'watch', 'marketplace'];
    if (skip.includes(slug.toLowerCase())) return null;
    return slug;
  } catch {
    return null;
  }
}

function cleanTitle(title) {
  return title
    .replace(/\s*[-|·•]\s*facebook.*/i, '')
    .replace(/\s*on facebook.*/i, '')
    .replace(/\s*\|\s*facebook/i, '')
    .trim();
}

/**
 * Attempt to extract the website link from a Facebook Page's public HTML.
 * Facebook Pages often embed their website in og:see_also or structured data.
 */
async function getWebsiteFromFacebook(slug) {
  try {
    const url = `https://www.facebook.com/${slug}/`;
    const res = await axios.get(url, {
      headers: {
        ...rotator.getHeaders(),
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': 'https://www.google.com/'
      },
      timeout: 12000
    });

    const html = res.data;

    // Try various patterns Facebook uses
    const patterns = [
      /og:see_also"[^>]*content="(https?:\/\/(?!(?:www\.)?facebook\.com)[^"]+)"/,
      /"website":"(https?:\/\/[^"]+)"/,
      /external_url":"(https?:\/\/[^"]+)"/,
      /"url":"(https?:\/\/(?!(?:www\.)?facebook\.com)[^"]+)"/
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const site = match[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
        if (site && site.startsWith('http') && !site.includes('facebook.com')) {
          return site;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function scrapeFacebook(brandType, country, rounds = 6) {
  const results = [];
  const seenSlugs = new Set();

  for (let i = 1; i <= rounds; i++) {
    const found = await searchFacebookBrands(brandType, country, i);

    for (const brand of found) {
      if (seenSlugs.has(brand.facebookSlug)) continue;
      seenSlugs.add(brand.facebookSlug);

      const website = await getWebsiteFromFacebook(brand.facebookSlug);
      results.push({ ...brand, website: website || '' });

      await delay(800 + Math.random() * 1200);
    }

    if (found.length === 0) break;
    await delay(config.SEARCH_DELAY_MIN + Math.random() * (config.SEARCH_DELAY_MAX - config.SEARCH_DELAY_MIN));
  }

  return results;
}

module.exports = { scrapeFacebook };
