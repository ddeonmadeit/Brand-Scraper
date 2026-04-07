const path = require('path');

module.exports = {
  OUTPUT_DIR: path.join(__dirname, '..', 'output'),
  DATA_DIR: path.join(__dirname, '..', 'data'),

  // Delays (ms)
  DIRECTORY_DELAY_MIN: 1200,
  DIRECTORY_DELAY_MAX: 3000,
  SITE_DELAY_MIN: 400,
  SITE_DELAY_MAX: 1200,
  SEARCH_DELAY_MIN: 4000,
  SEARCH_DELAY_MAX: 9000,

  // Concurrency
  DIRECTORY_CONCURRENCY: 3,
  SITE_CONCURRENCY: 5,
  SEARCH_CONCURRENCY: 1,

  // Pagination
  MAX_PAGES_PER_SOURCE: 10,

  // Anti-block
  BLOCK_THRESHOLD: 3,
  BLOCK_PAUSE_MIN: 30000,
  BLOCK_PAUSE_MAX: 300000,

  // Email filters — exclude non-business providers
  EXCLUDED_EMAIL_DOMAINS: [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
    'icloud.com', 'me.com', 'aol.com', 'protonmail.com', 'mail.com',
    'ymail.com', 'msn.com', 'bigpond.com', 'bigpond.net.au', 'optusnet.com.au',
    'aapt.net.au', 'westnet.com.au', 'internode.on.net'
  ],

  EXCLUDED_EMAIL_PREFIXES: [
    'noreply', 'no-reply', 'donotreply', 'do-not-reply',
    'mailer', 'bounce', 'postmaster', 'webmaster', 'admin',
    'newsletter', 'unsubscribe', 'notifications', 'support',
    'help', 'abuse', 'security', 'privacy', 'legal', 'compliance'
  ],

  // Domain blacklist — irrelevant platforms
  BLACKLISTED_DOMAINS: [
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
    'linkedin.com', 'pinterest.com', 'youtube.com', 'reddit.com', 'snapchat.com',
    'tumblr.com', 'wordpress.com', 'blogspot.com', 'wix.com', 'squarespace.com',
    'shopify.com', 'bigcommerce.com', 'etsy.com', 'ebay.com', 'amazon.com',
    'amazon.com.au', 'gumtree.com.au', 'seek.com.au', 'indeed.com',
    'yelp.com', 'tripadvisor.com', 'yellowpages.com.au', 'truelocal.com.au',
    'hotfrog.com.au', 'whitepages.com.au', 'dnb.com', 'abn.business.gov.au',
    'business.gov.au', 'abs.gov.au'
  ],

  // Brand-specific scoring signals
  BRAND_OWNER_TITLES: [
    'founder', 'co-founder', 'owner', 'director', 'ceo', 'creative director',
    'brand director', 'head of brand', 'head of marketing', 'brand manager',
    'head of design', 'designer', 'creative lead', 'managing director'
  ],

  CONTACT_PATHS: ['/contact', '/about', '/team', '/contact-us', '/about-us', '/pages/contact'],

  // User agents for rotation
  USER_AGENTS: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ]
};
