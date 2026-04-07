/**
 * Instagram brand discovery via DuckDuckGo/Bing search.
 *
 * We can't scrape Instagram directly (auth walls + bot detection),
 * but we can find brand Instagram pages via search engines and then
 * extract their website link which they almost always list in bio.
 * We then scrape that website for contact emails.
 */

const cheerio = require('cheerio');
const axios = require('axios');
const { delay } = require('../siteScraper');
const { ProxyRotator } = require('../proxyRotator');
const config = require('../config');

const rotator = new ProxyRotator();

const BRAND_TYPE_QUERIES = {
  'streetwear':       ['streetwear brand', 'street fashion brand', 'urban clothing brand', 'hype streetwear label'],
  'luxury':           ['luxury fashion brand', 'high end clothing label', 'luxury apparel brand', 'designer fashion house'],
  'sustainable':      ['sustainable fashion brand', 'eco clothing brand', 'ethical fashion label', 'slow fashion brand'],
  'activewear':       ['activewear brand', 'athletic clothing brand', 'performance apparel brand', 'gym wear brand'],
  'workwear':         ['workwear brand', 'workwear clothing label', 'industrial workwear brand'],
  'vintage':          ['vintage clothing brand', 'retro fashion label', 'vintage inspired brand'],
  'swimwear':         ['swimwear brand', 'swimwear label', 'beach clothing brand'],
  'denim':            ['denim brand', 'jeans brand', 'denim clothing label'],
  'minimalist':       ['minimalist clothing brand', 'minimal fashion label', 'capsule wardrobe brand'],
  'sportswear':       ['sportswear brand', 'sports clothing label', 'athletic wear brand'],
  'kids':             ['kids clothing brand', 'children fashion label', 'kids apparel brand'],
  'accessories':      ['accessories brand', 'fashion accessories label', 'clothing accessories brand'],
  'formal / tailoring': ['tailoring brand', 'formal wear brand', 'bespoke clothing label', 'suiting brand'],
  'indie / independent': ['independent clothing brand', 'indie fashion label', 'small clothing brand', 'boutique clothing brand']
};

function getQueries(brandType, country) {
  const base = BRAND_TYPE_QUERIES[brandType.toLowerCase()] ||
    [`${brandType} clothing brand`, `${brandType} fashion label`];
  // Mix in country context
  return base.map(q => `${q} ${country} instagram site:instagram.com`);
}

async function searchInstagramBrands(brandType, country, page = 1) {
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

      // We want instagram.com profile links
      if (link && link.includes('instagram.com') && !link.includes('/p/') && !link.includes('/reel/')) {
        const handle = extractInstagramHandle(link);
        if (handle) {
          results.push({
            companyName: cleanTitle(title),
            instagramHandle: handle,
            instagramUrl: `https://www.instagram.com/${handle}/`,
            snippet,
            source: 'instagram'
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

function extractInstagramHandle(url) {
  try {
    const match = url.match(/instagram\.com\/([a-zA-Z0-9_.]+)\/?/);
    if (!match) return null;
    const handle = match[1];
    // Skip Instagram's own navigation pages
    const skip = ['explore', 'accounts', 'login', 'p', 'reels', 'stories', 'tv', 'direct'];
    if (skip.includes(handle.toLowerCase())) return null;
    return handle;
  } catch {
    return null;
  }
}

function cleanTitle(title) {
  return title
    .replace(/\s*[@•|·\-–—]\s*instagram.*/i, '')
    .replace(/\s*on instagram.*/i, '')
    .replace(/\s*\(@[^)]+\)/, '')
    .trim();
}

/**
 * Fetch the Instagram profile page and extract the website link from bio.
 * Instagram serves partial HTML even without login for public profiles.
 */
async function getWebsiteFromInstagram(handle) {
  try {
    // Use the embed endpoint which is less restricted
    const url = `https://www.instagram.com/${handle}/`;
    const res = await axios.get(url, {
      headers: {
        ...rotator.getHeaders(),
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': 'https://www.google.com/'
      },
      timeout: 12000
    });

    const html = res.data;

    // Try to extract website from meta tags or JSON-LD
    const websiteMatch =
      html.match(/"website":"([^"]+)"/) ||
      html.match(/website":\s*"([^"]+)"/) ||
      html.match(/external_url":"([^"]+)"/);

    if (websiteMatch) {
      const site = websiteMatch[1].replace(/\\u0026/g, '&');
      if (site && site.startsWith('http')) return site;
    }

    // Fallback: look for a linktree or bio link in og:description
    const descMatch = html.match(/og:description"[^>]*content="([^"]+)"/);
    if (descMatch) {
      const urlInDesc = descMatch[1].match(/https?:\/\/[^\s"'<>]+/);
      if (urlInDesc) return urlInDesc[0];
    }

    return null;
  } catch {
    return null;
  }
}

async function scrapeInstagram(brandType, country, rounds = 6) {
  const results = [];
  const seenHandles = new Set();

  for (let i = 1; i <= rounds; i++) {
    const found = await searchInstagramBrands(brandType, country, i);

    for (const brand of found) {
      if (seenHandles.has(brand.instagramHandle)) continue;
      seenHandles.add(brand.instagramHandle);

      // Try to get their website from their Instagram profile
      const website = await getWebsiteFromInstagram(brand.instagramHandle);
      results.push({ ...brand, website: website || '' });

      await delay(800 + Math.random() * 1200);
    }

    if (found.length === 0) break;
    await delay(config.SEARCH_DELAY_MIN + Math.random() * (config.SEARCH_DELAY_MAX - config.SEARCH_DELAY_MIN));
  }

  return results;
}

module.exports = { scrapeInstagram };
