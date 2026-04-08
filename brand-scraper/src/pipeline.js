const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const pLimit = require('p-limit');
const csvParser = require('csv-parser');

const config = require('./config');
const { csvWriter, csvWriterFresh, CSV_PATH } = require('./csvWriter');
const { Deduplicator } = require('./deduplicator');
const { scoreLead, isValidEmail } = require('./qualityScorer');
const { scrapeSite, delay } = require('./siteScraper');
const { scrapeInstagram } = require('./scrapers/instagramSearch');
const { scrapeFacebook } = require('./scrapers/facebookSearch');
const { scrapeSearchDuck } = require('./scrapers/duckSearch');
const { scrapeSearchBing } = require('./scrapers/bingSearch');

// ── Brand types available in UI ──────────────────────────────────────
const brandTypes = [
  'Streetwear',
  'Luxury',
  'Sustainable / Ethical',
  'Activewear',
  'Workwear',
  'Vintage / Retro',
  'Swimwear',
  'Denim',
  'Minimalist',
  'Sportswear',
  'Kids',
  'Accessories',
  'Formal / Tailoring',
  'Indie / Independent'
];

// ── Countries available in UI ─────────────────────────────────────────
const countries = [
  'Australia',
  'United States',
  'United Kingdom',
  'Canada',
  'New Zealand',
  'Germany',
  'France',
  'Italy',
  'Spain',
  'Japan',
  'South Korea',
  'Brazil',
  'South Africa',
  'Sweden',
  'Denmark',
  'Netherlands',
  'Portugal'
];

class ScraperPipeline extends EventEmitter {
  constructor({ target = 500, resume = false, sources = ['instagram', 'facebook', 'duckduckgo', 'bing'], brandType = null, country = null, verbose = false }) {
    super();
    this.target = target;
    this.resume = resume;
    this.sources = sources;
    this.brandType = brandType;
    this.country = country;
    this.verbose = verbose;

    this.running = false;
    this.aborted = false;

    this.dedup = new Deduplicator();
    this.recentLeads = [];
    this.leadCount = 0;
    this.personalCount = 0;
    this.genericCount = 0;
    this.domainsScraped = 0;
    this.phase = 'idle';
    this.startTime = null;
    this.errors = [];
  }

  log(message, type = 'info') {
    const entry = { time: new Date().toISOString(), message, type };
    this.emit('log', entry);
    if (this.verbose) console.log(`[${type.toUpperCase()}] ${message}`);
  }

  getStatus() {
    return {
      running: this.running,
      phase: this.phase,
      leadCount: this.leadCount,
      personalCount: this.personalCount,
      genericCount: this.genericCount,
      domainsScraped: this.domainsScraped,
      target: this.target,
      elapsed: this.startTime ? Date.now() - this.startTime : 0,
      brandType: this.brandType,
      country: this.country
    };
  }

  emitProgress() {
    this.emit('progress', this.getStatus());
  }

  abort() {
    this.aborted = true;
    this.log('Stop requested — finishing current operation…', 'warn');
  }

  // ── Load existing leads from CSV for resume mode ──────────────────
  async loadExisting() {
    if (!fs.existsSync(CSV_PATH)) return;
    return new Promise((resolve) => {
      fs.createReadStream(CSV_PATH)
        .pipe(csvParser())
        .on('data', row => {
          const email = (row['Email'] || '').toLowerCase().trim();
          const website = row['Website'] || '';
          if (email) this.dedup.addEmail(email);
          if (website) {
            try {
              const domain = new URL(website).hostname.replace(/^www\./, '');
              this.dedup.addDomain(domain);
            } catch {}
          }
          this.leadCount++;
          if (row['Email Type'] === 'personal') this.personalCount++;
          else this.genericCount++;
        })
        .on('end', resolve)
        .on('error', resolve);
    });
  }

  // ── Persist a confirmed lead ──────────────────────────────────────
  async saveLead(lead) {
    const row = {
      email: lead.email,
      ownerName: lead.ownerName || '',
      companyName: lead.companyName || '',
      website: lead.website || '',
      brandType: lead.brandType || this.brandType || '',
      country: lead.country || this.country || '',
      emailType: lead.emailType || 'generic',
      qualityScore: lead.qualityScore || 0,
      source: lead.source || ''
    };

    try {
      if (!fs.existsSync(CSV_PATH)) {
        await csvWriterFresh().writeRecords([row]);
      } else {
        await csvWriter.writeRecords([row]);
      }
    } catch (err) {
      this.errors.push(err.message);
    }

    this.recentLeads.unshift(row);
    if (this.recentLeads.length > 100) this.recentLeads.pop();

    this.leadCount++;
    if (row.emailType === 'personal') this.personalCount++;
    else this.genericCount++;

    this.emit('lead', row);
    this.emitProgress();
  }

  // ── Process a discovered brand (website → emails) ─────────────────
  async processBrand(brand) {
    if (this.aborted || this.leadCount >= this.target) return;

    const website = brand.website;
    if (!website) return;

    try {
      const domain = new URL(website.startsWith('http') ? website : 'https://' + website).hostname.replace(/^www\./, '');
      if (this.dedup.hasDomain(domain)) return;
      this.dedup.addDomain(domain);
      this.domainsScraped++;
      this.emitProgress();
    } catch { return; }

    this.log(`Scraping ${website}`, 'info');

    const siteResults = await scrapeSite(website);

    for (const r of siteResults) {
      if (this.aborted || this.leadCount >= this.target) break;
      if (!isValidEmail(r.email)) continue;
      if (this.dedup.hasEmail(r.email)) continue;

      this.dedup.addEmail(r.email);

      const { qualityScore, emailType } = scoreLead({ ...r, website });

      // Drop low-quality leads below the minimum threshold
      if (qualityScore < config.MIN_QUALITY_SCORE) {
        this.log(`Skipped low-quality email: ${r.email} (score ${qualityScore})`, 'info');
        continue;
      }

      const lead = {
        email: r.email,
        ownerName: r.ownerName || brand.ownerName || '',
        companyName: brand.companyName || '',
        website,
        brandType: this.brandType || '',
        country: this.country || '',
        emailType,
        qualityScore,
        source: brand.source || 'web'
      };

      await this.saveLead(lead);
      this.log(`Found email: ${r.email} at ${brand.companyName || website}`, 'success');
    }
  }

  // ── Main run ──────────────────────────────────────────────────────
  async run() {
    this.running = true;
    this.aborted = false;
    this.startTime = Date.now();
    this.phase = 'initializing';
    this.emitProgress();

    this.log(`Starting Brand Outreach scraper — target: ${this.target} leads`, 'info');
    this.log(`Brand type: ${this.brandType || 'all'} | Country: ${this.country || 'all'}`, 'info');

    if (!fs.existsSync(path.dirname(CSV_PATH))) {
      fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
    }

    if (this.resume) {
      this.log('Resuming from existing data…', 'info');
      await this.loadExisting();
      this.log(`Loaded ${this.leadCount} existing leads`, 'info');
    }

    const brandType = this.brandType || 'clothing';
    const country = this.country || 'Australia';

    const allBrands = [];

    // ── Phase 1: Instagram discovery ─────────────────────────────────
    if (!this.aborted && this.sources.includes('instagram')) {
      this.phase = 'phase1';
      this.log('Phase 1: Discovering brands on Instagram…', 'info');
      this.emitProgress();

      try {
        const igBrands = await scrapeInstagram(brandType, country);
        this.log(`Instagram: found ${igBrands.length} brand profiles`, 'info');
        allBrands.push(...igBrands);
      } catch (err) {
        this.log(`Instagram search error: ${err.message}`, 'error');
      }
    }

    // ── Phase 2: Facebook discovery ───────────────────────────────────
    if (!this.aborted && this.sources.includes('facebook')) {
      this.phase = 'phase2';
      this.log('Phase 2: Discovering brands on Facebook…', 'info');
      this.emitProgress();

      try {
        const fbBrands = await scrapeFacebook(brandType, country);
        this.log(`Facebook: found ${fbBrands.length} brand pages`, 'info');
        allBrands.push(...fbBrands);
      } catch (err) {
        this.log(`Facebook search error: ${err.message}`, 'error');
      }
    }

    // ── Phase 3: DuckDuckGo web search ────────────────────────────────
    if (!this.aborted && this.leadCount < this.target && this.sources.includes('duckduckgo')) {
      this.phase = 'phase3';
      this.log('Phase 3: Searching DuckDuckGo for brand websites…', 'info');
      this.emitProgress();

      try {
        const ddgBrands = await scrapeSearchDuck(brandType, country);
        this.log(`DuckDuckGo: found ${ddgBrands.length} brand sites`, 'info');
        allBrands.push(...ddgBrands);
      } catch (err) {
        this.log(`DuckDuckGo search error: ${err.message}`, 'error');
      }
    }

    // ── Phase 4: Bing web search ──────────────────────────────────────
    if (!this.aborted && this.leadCount < this.target && this.sources.includes('bing')) {
      this.phase = 'phase4';
      this.log('Phase 4: Searching Bing for brand websites…', 'info');
      this.emitProgress();

      try {
        const bingBrands = await scrapeSearchBing(brandType, country);
        this.log(`Bing: found ${bingBrands.length} brand sites`, 'info');
        allBrands.push(...bingBrands);
      } catch (err) {
        this.log(`Bing search error: ${err.message}`, 'error');
      }
    }

    // ── Phase 5: Scrape each brand website for emails ─────────────────
    if (!this.aborted && allBrands.length > 0) {
      this.phase = 'phase5';
      this.log(`Phase 5: Scraping ${allBrands.length} brand websites for contact emails…`, 'info');
      this.emitProgress();

      const limit = pLimit(config.SITE_CONCURRENCY);
      const tasks = allBrands
        .filter(b => b.website)
        .map(b => limit(() => this.processBrand(b)));

      await Promise.allSettled(tasks);
    }

    // ── Done ──────────────────────────────────────────────────────────
    this.running = false;
    this.phase = this.aborted ? 'aborted' : 'complete';
    this.emitProgress();

    const summary = {
      leadCount: this.leadCount,
      personalCount: this.personalCount,
      genericCount: this.genericCount,
      domainsScraped: this.domainsScraped,
      elapsed: Date.now() - this.startTime,
      aborted: this.aborted
    };

    this.log(`Done — ${this.leadCount} leads found (${this.personalCount} personal, ${this.genericCount} generic)`, 'success');
    this.emit('done', summary);
  }
}

module.exports = { ScraperPipeline, brandTypes, countries };
