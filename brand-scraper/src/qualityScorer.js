const config = require('./config');

/**
 * Scores a lead from 0–5 and classifies email type.
 * Returns { qualityScore, emailType }
 */
function scoreLead(lead) {
  let score = 0;
  const email = (lead.email || '').toLowerCase();
  const name = (lead.ownerName || '').toLowerCase();
  const websiteDomain = extractDomain(lead.website || '');
  const emailDomain = email.split('@')[1] || '';
  const prefix = email.split('@')[0];

  // Personal vs generic classification
  const personalPrefixes = [
    'founder', 'owner', 'hello', 'hi', 'hey', 'creative', 'studio',
    'brand', 'design', 'team', 'connect', 'collab', 'wholesale'
  ];
  const genericPrefixes = [
    'info', 'contact', 'sales', 'enquiries', 'enquiry', 'orders',
    'general', 'office', 'mail', 'email', 'shop'
  ];

  let emailType = 'generic';
  if (personalPrefixes.some(p => prefix.includes(p))) {
    emailType = 'personal';
    score += 2;
  } else if (!genericPrefixes.some(p => prefix === p)) {
    // Likely a name-based email (e.g. jane@brandname.com)
    emailType = 'personal';
    score += 2;
  }

  // Email domain matches brand's own website domain (highest quality signal)
  if (websiteDomain && emailDomain === websiteDomain) {
    score += 2;
  } else if (websiteDomain && emailDomain.endsWith('.' + websiteDomain)) {
    score += 1;
  }

  // Has a real owner name
  if (name && name.length > 2) score += 1;

  return { qualityScore: Math.min(score, 5), emailType };
}

function extractDomain(url) {
  try {
    if (!url) return '';
    const u = url.startsWith('http') ? url : 'https://' + url;
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Returns true if this email is from a media/PR/news domain.
 */
function isMediaDomain(domain) {
  return config.BLACKLISTED_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));
}

/**
 * Validates that an email passes all quality filters.
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  email = email.toLowerCase().trim();

  // Basic format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return false;

  const [prefix, domain] = email.split('@');
  if (!prefix || !domain) return false;

  // Consumer/ISP email domains
  if (config.EXCLUDED_EMAIL_DOMAINS.includes(domain)) return false;

  // Excluded prefixes (exact match or prefix.)
  if (config.EXCLUDED_EMAIL_PREFIXES.some(p => prefix === p || prefix.startsWith(p + '.'))) return false;

  // Blacklisted domains (social, media, marketplaces, news)
  if (isMediaDomain(domain)) return false;

  // Reject obviously auto-generated addresses
  if (/\d{5,}/.test(prefix)) return false;

  return true;
}

/**
 * Check that the email domain actually belongs to the brand's own website.
 * This is the primary quality gate — we don't want emails scraped from
 * third-party mentions on a brand's page.
 */
function emailBelongsToSite(email, websiteUrl) {
  if (!config.REQUIRE_DOMAIN_MATCH) return true;
  const siteDomain = extractDomain(websiteUrl);
  if (!siteDomain) return true; // can't check, allow through
  const emailDomain = (email.split('@')[1] || '').toLowerCase();
  // Accept exact match or subdomain (e.g. press@mail.brandname.com)
  return emailDomain === siteDomain || emailDomain.endsWith('.' + siteDomain);
}

module.exports = { scoreLead, isValidEmail, emailBelongsToSite, extractDomain };
