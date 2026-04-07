class Deduplicator {
  constructor() {
    this.emails = new Set();
    this.domains = new Set();
    this.urls = new Set();
  }

  hasEmail(email) {
    return this.emails.has(email.toLowerCase().trim());
  }

  addEmail(email) {
    this.emails.add(email.toLowerCase().trim());
  }

  hasDomain(domain) {
    return this.domains.has(domain.toLowerCase().trim());
  }

  addDomain(domain) {
    this.domains.add(domain.toLowerCase().trim());
  }

  hasUrl(url) {
    return this.urls.has(url.toLowerCase().trim());
  }

  addUrl(url) {
    this.urls.add(url.toLowerCase().trim());
  }

  get emailCount() { return this.emails.size; }
  get domainCount() { return this.domains.size; }
}

module.exports = { Deduplicator };
