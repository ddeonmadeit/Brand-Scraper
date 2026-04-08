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

  // Minimum quality score to save a lead (0–5)
  MIN_QUALITY_SCORE: 2,

  // Only accept emails whose domain matches the brand's own website domain
  REQUIRE_DOMAIN_MATCH: true,

  // Email filters — exclude consumer/ISP providers
  EXCLUDED_EMAIL_DOMAINS: [
    'gmail.com', 'yahoo.com', 'yahoo.com.au', 'hotmail.com', 'outlook.com', 'live.com',
    'icloud.com', 'me.com', 'aol.com', 'protonmail.com', 'mail.com',
    'ymail.com', 'msn.com', 'bigpond.com', 'bigpond.net.au', 'optusnet.com.au',
    'aapt.net.au', 'westnet.com.au', 'internode.on.net', 'tpg.com.au',
    'exemail.com.au', 'dodo.com.au', 'iinet.net.au', 'netspace.net.au'
  ],

  EXCLUDED_EMAIL_PREFIXES: [
    'noreply', 'no-reply', 'donotreply', 'do-not-reply',
    'mailer', 'bounce', 'postmaster', 'webmaster', 'admin',
    'newsletter', 'unsubscribe', 'notifications', 'support',
    'help', 'abuse', 'security', 'privacy', 'legal', 'compliance',
    'editor', 'editorial', 'advertise', 'advertising', 'media',
    'press', 'pr', 'publicity', 'submissions', 'contribute', 'tips',
    'news', 'letters', 'feedback', 'jobs', 'careers', 'hr', 'recruitment'
  ],

  // Domain blacklist — social media, marketplaces, directories, media & PR sites
  BLACKLISTED_DOMAINS: [
    // Social media
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
    'linkedin.com', 'pinterest.com', 'youtube.com', 'reddit.com', 'snapchat.com',
    'tumblr.com', 'threads.net', 'bereal.com',
    // Platforms / builders
    'wordpress.com', 'blogspot.com', 'wix.com', 'squarespace.com', 'weebly.com',
    'webflow.io', 'cargo.site', 'format.com', 'about.me', 'linktree.com',
    'linktr.ee', 'bio.site', 'beacons.ai', 'campsite.bio',
    // Marketplaces
    'shopify.com', 'bigcommerce.com', 'etsy.com', 'ebay.com', 'amazon.com',
    'amazon.com.au', 'amazon.co.uk', 'depop.com', 'vestiairecollective.com',
    'grailed.com', 'poshmark.com', 'vinted.com', 'thredup.com', 'stockx.com',
    'farfetch.com', 'net-a-porter.com', 'mytheresa.com', 'ssense.com',
    'asos.com', 'boohoo.com', 'prettylittlething.com', 'revolve.com',
    'nordstrom.com', 'zalando.com', 'matchesfashion.com',
    // Job/classifieds
    'gumtree.com.au', 'seek.com.au', 'indeed.com', 'glassdoor.com',
    // Directories
    'yelp.com', 'tripadvisor.com', 'yellowpages.com.au', 'truelocal.com.au',
    'hotfrog.com.au', 'whitepages.com.au', 'dnb.com',
    // Government
    'abn.business.gov.au', 'business.gov.au', 'abs.gov.au',
    // Fashion media & magazines
    'vogue.com', 'vogue.com.au', 'vogue.co.uk', 'harpersbazaar.com',
    'harpersbazaar.com.au', 'elle.com', 'elle.com.au', 'cosmopolitan.com',
    'marieclaire.com', 'instyle.com', 'wwd.com', 'businessoffashion.com',
    'fashionjournal.com.au', 'fashionweekdaily.com', 'style.com',
    'refinery29.com', 'whowhatwear.com', 'popsugar.com', 'byrdie.com',
    'thecut.com', 'nymag.com', 'vanityfair.com', 'gq.com', 'esquire.com',
    'menshealth.com', 'womenshealthmag.com', 'hypebeast.com', 'highsnobiety.com',
    'complex.com', 'dazeddigital.com', 'dazed.com', 'i-d.vice.com', 'vice.com',
    'ssense.com', 'nss-magazine.com', 'wonderlandmagazine.com',
    'anothermag.com', 'wallpaper.com', 'monocle.com', 'sleek-mag.com',
    // PR agencies / news wires
    'prnewswire.com', 'businesswire.com', 'prweb.com', 'globenewswire.com',
    'newswire.com.au', 'medianet.com.au',
    // General news/blogs that may mention brands
    'theguardian.com', 'smh.com.au', 'theage.com.au', 'news.com.au',
    'dailymail.co.uk', 'nytimes.com', 'wsj.com', 'forbes.com', 'inc.com',
    'techcrunch.com', 'mashable.com', 'buzzfeed.com', 'huffpost.com',
    // Aggregators / review
    'trustpilot.com', 'productreview.com.au', 'google.com', 'bing.com'
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
