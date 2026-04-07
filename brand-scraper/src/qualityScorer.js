const config = require('./config');

/**
 * Scores a lead from 0–5 and classifies email type.
 * Returns { qualityScore, emailType }
 */
function scoreLead(lead) {
  let score = 0;
  const email = (lead.email || '').toLowerCase();
  const name = (lead.ownerName || '').toLowerCase();
  const domain = extractDomain(lead.website || lead.email || '');

  // Email type classification
  const personalPrefixes = ['founder', 'owner', 'hello', 'hi', 'hey', 'creative', 'studio', 'brand', 'design'];
  const genericPrefixes = ['info', 'contact', 'sales', 'enquiries', 'enquiry', 'orders', 'wholesale', 'press', 'general'];

  const prefix = email.split('@')[0];
  let emailType = 'generic';

  if (personalPrefixes.some(p => prefix.includes(p))) {
    emailType = 'personal';
    score += 2;
  } else if (!genericPrefixes.some(p => prefix === p)) {
    // Likely a name-based email
    emailType = 'personal';
    score += 2;
  }

  // Has owner name
  if (name && name.length > 2) score += 1;

  // Domain matches email domain (brand's own domain)
  if (domain && email.endsWith('@' + domain)) score += 1;

  // Has website
  if (lead.website) score += 1;

  return { qualityScore: Math.min(score, 5), emailType };
}

function extractDomain(url) {
  try {
    const u = url.startsWith('http') ? url : 'https://' + url;
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Validates that an email passes basic filters.
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  email = email.toLowerCase().trim();

  // Basic format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;

  const [prefix, domain] = email.split('@');

  // Excluded domains
  if (config.EXCLUDED_EMAIL_DOMAINS.includes(domain)) return false;

  // Excluded prefixes
  if (config.EXCLUDED_EMAIL_PREFIXES.some(p => prefix === p || prefix.startsWith(p + '.'))) return false;

  // Blacklisted domains
  if (config.BLACKLISTED_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) return false;

  return true;
}

module.exports = { scoreLead, isValidEmail };
