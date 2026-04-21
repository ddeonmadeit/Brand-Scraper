#!/usr/bin/env node

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const csvParser = require('csv-parser');
const { Resend } = require('resend');
const { ScraperPipeline, brandTypes, countries } = require('./src/pipeline');
const config = require('./src/config');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Paths ──────────────────────────────────────────────────────────────
const SENT_PATH     = path.join(config.OUTPUT_DIR, 'sent.json');
const TEMPLATE_PATH = path.join(config.OUTPUT_DIR, 'template.json');
const SETTINGS_PATH = path.join(config.OUTPUT_DIR, 'last-settings.json');
const CSV_PATH      = path.join(config.OUTPUT_DIR, 'Brand Leads.csv');

function ensureOutputDir() {
  if (!fs.existsSync(config.OUTPUT_DIR)) fs.mkdirSync(config.OUTPUT_DIR, { recursive: true });
}

// ── Sent tracker ────────────────────────────────────────────────────────
function loadSentEmails() {
  try { return new Set(JSON.parse(fs.readFileSync(SENT_PATH, 'utf8'))); }
  catch { return new Set(); }
}

function saveSentEmails(set) {
  ensureOutputDir();
  fs.writeFileSync(SENT_PATH, JSON.stringify([...set]));
}

// ── Template persistence ────────────────────────────────────────────────
const DEFAULT_TEMPLATE = {
  fromName: 'Brand Outreach',
  fromEmail: '',
  replyTo: '',
  subject: 'Quick question about {{company}}',
  body: `Hi {{firstName}},

I came across {{company}} and wanted to reach out personally.

We love what you're building in the {{brandType}} space and think there could be a great opportunity to collaborate.

Would you be open to a quick chat this week?

Looking forward to hearing from you.

Best,

{{senderName}}`
};

function loadTemplate() {
  try { return { ...DEFAULT_TEMPLATE, ...JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8')) }; }
  catch { return { ...DEFAULT_TEMPLATE }; }
}

function saveTemplate(tpl) {
  ensureOutputDir();
  fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(tpl, null, 2));
}

// ── Merge tag replacement ────────────────────────────────────────────────
function applyMergeTags(str, lead, tpl) {
  const firstName = (lead.ownerName || '').split(' ')[0] || 'there';
  return (str || '')
    .replace(/\{\{firstName\}\}/g, firstName)
    .replace(/\{\{ownerName\}\}/g, lead.ownerName || '')
    .replace(/\{\{company\}\}/g, lead.companyName || lead.website || 'your brand')
    .replace(/\{\{email\}\}/g, lead.email || '')
    .replace(/\{\{brandType\}\}/g, lead.brandType || '')
    .replace(/\{\{country\}\}/g, lead.country || '')
    .replace(/\{\{senderName\}\}/g, tpl.fromName || '');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Active send job ─────────────────────────────────────────────────────
let sendJob = null;

// ── Scraper state ────────────────────────────────────────────────────────
let pipeline = null;
const sseClients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) res.write(msg);
}

function attachPipelineEvents(pl) {
  pl.on('progress', (status) => broadcast('progress', status));
  pl.on('lead',     (lead)   => broadcast('lead', lead));
  pl.on('log',      (entry)  => broadcast('log', entry));
  pl.on('done',     (status) => broadcast('done', status));
  pl.on('error',    (msg)    => broadcast('error', { message: msg }));
}

// ═══════════════════════════════════════════════════════════════════════
// Scraper routes
// ═══════════════════════════════════════════════════════════════════════

app.get('/api/options', (req, res) => res.json({ brandTypes, countries }));

app.get('/api/status', (req, res) => {
  if (!pipeline) return res.json({ running: false, phase: 'idle', leadCount: 0, target: 0 });
  res.json(pipeline.getStatus());
});

app.get('/api/last-settings', (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'))); }
  catch { res.json(null); }
});

app.post('/api/start', (req, res) => {
  if (pipeline && pipeline.running) return res.status(409).json({ error: 'Scraper is already running' });

  const {
    target    = 500,
    resume    = false,
    sources   = ['instagram', 'facebook', 'duckduckgo', 'bing'],
    brandType = null,
    country   = null
  } = req.body;

  const settings = { target, sources, brandType, country };
  try { ensureOutputDir(); fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings)); } catch {}

  pipeline = new ScraperPipeline({
    target: parseInt(target, 10) || 500,
    resume,
    sources,
    brandType,
    country,
    verbose: true
  });
  attachPipelineEvents(pipeline);
  pipeline.run().catch(err => console.error('Pipeline error:', err.message));

  res.json({ message: 'Scraper started', target: pipeline.target });
});

app.post('/api/stop', (req, res) => {
  if (!pipeline || !pipeline.running) return res.status(400).json({ error: 'Scraper is not running' });
  pipeline.abort();
  res.json({ message: 'Stop requested' });
});

app.get('/api/download', (req, res) => {
  if (!fs.existsSync(CSV_PATH)) return res.status(404).json({ error: 'No CSV file found. Run the scraper first.' });
  res.download(CSV_PATH, 'Brand Leads.csv');
});

app.get('/api/leads', (req, res) => {
  if (!fs.existsSync(CSV_PATH)) return res.json({ leads: pipeline ? (pipeline.recentLeads || []) : [] });

  const leads = [];
  fs.createReadStream(CSV_PATH)
    .pipe(csvParser())
    .on('data', row => leads.push({
      email:        row['Email'] || '',
      ownerName:    row['Owner Name'] || '',
      companyName:  row['Brand Name'] || '',
      website:      row['Website'] || '',
      brandType:    row['Brand Type'] || '',
      country:      row['Country'] || '',
      emailType:    row['Email Type'] || '',
      qualityScore: parseInt(row['Quality Score'], 10) || 0,
      source:       row['Source'] || ''
    }))
    .on('end', () => res.json({ leads }))
    .on('error', () => res.json({ leads: pipeline ? (pipeline.recentLeads || []) : [] }));
});

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
  if (pipeline) res.write(`event: progress\ndata: ${JSON.stringify(pipeline.getStatus())}\n\n`);
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// ═══════════════════════════════════════════════════════════════════════
// Email template routes
// ═══════════════════════════════════════════════════════════════════════

app.get('/api/template', (req, res) => res.json(loadTemplate()));

app.post('/api/template', (req, res) => {
  const tpl = { ...loadTemplate(), ...req.body };
  saveTemplate(tpl);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════
// Sent-email tracking
// ═══════════════════════════════════════════════════════════════════════

app.get('/api/sent', (req, res) => {
  const sent = loadSentEmails();
  res.json({ count: sent.size, emails: [...sent] });
});

app.delete('/api/sent', (req, res) => {
  saveSentEmails(new Set());
  res.json({ ok: true });
});

// ── Resend API key (env var preferred, saved file as fallback) ────────────
const RESEND_KEY_PATH = path.join(config.OUTPUT_DIR, 'resend-key.json');

function loadResendKey() {
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY;
  try { return JSON.parse(fs.readFileSync(RESEND_KEY_PATH, 'utf8')).key; }
  catch { return null; }
}

function saveResendKey(key) {
  ensureOutputDir();
  fs.writeFileSync(RESEND_KEY_PATH, JSON.stringify({ key }));
}

app.get('/api/resend-key', (req, res) => {
  const key = loadResendKey();
  res.json({ configured: !!key });
});

app.post('/api/resend-key', (req, res) => {
  const { key } = req.body;
  if (!key || !key.startsWith('re_')) return res.status(400).json({ error: 'Invalid Resend API key (should start with re_)' });
  saveResendKey(key);
  res.json({ ok: true });
});

function buildEmailHtml(subject, bodyText, replyEmail) {
  const htmlParas = bodyText
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 18px;line-height:1.7">${p.trim().replace(/\n/g, '<br>')}</p>`)
    .join('\n');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="padding:32px 40px 8px"><div style="font-size:15px;color:#1a1a1a">${htmlParas}</div></td></tr>
<tr><td style="padding:16px 40px 32px;border-top:1px solid #f0f0f0">
<p style="margin:0;font-size:12px;color:#999;line-height:1.6">You received this because your brand was identified as a potential fit.<br>
To unsubscribe reply "Unsubscribe" or <a href="mailto:${replyEmail}?subject=Unsubscribe" style="color:#999">click here</a>.</p>
</td></tr></table></td></tr></table></body></html>`;
}

// ── Test email ────────────────────────────────────────────────────────────
app.post('/api/send/test', async (req, res) => {
  const { toEmail } = req.body;
  if (!toEmail) return res.status(400).json({ error: 'Provide a toEmail address' });

  const apiKey = loadResendKey();
  if (!apiKey) return res.status(400).json({ error: 'Resend API key not configured' });

  const tpl = loadTemplate();

  const sampleLead = {
    email: toEmail,
    ownerName: 'Alex Sample',
    companyName: 'Sample Brand',
    brandType: 'Streetwear',
    country: 'Australia'
  };

  const subject  = applyMergeTags(tpl.subject || 'Test email from Brand Outreach', sampleLead, tpl);
  const bodyText = applyMergeTags(tpl.body || 'Hi {{firstName}}, this is a test.', sampleLead, tpl);
  const replyEmail = tpl.replyTo || tpl.fromEmail || 'noreply@example.com';

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `${tpl.fromName || 'Brand Outreach'} <${tpl.fromEmail || 'onboarding@resend.dev'}>`,
      to: [toEmail],
      reply_to: replyEmail,
      subject: `[TEST] ${subject}`,
      text: `[TEST EMAIL]\n\n${bodyText}`,
      html: buildEmailHtml(subject, bodyText, replyEmail)
    });
    res.json({ ok: true, message: `Test email sent to ${toEmail}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk send (SSE stream) ────────────────────────────────────────────────

app.post('/api/send/start', async (req, res) => {
  if (sendJob && sendJob.running) return res.status(409).json({ error: 'A send job is already running' });

  const { leads, delayMin = 4000, delayMax = 9000 } = req.body;
  if (!Array.isArray(leads) || leads.length === 0) return res.status(400).json({ error: 'No leads provided' });

  const tpl = loadTemplate();
  if (!tpl.fromEmail) return res.status(400).json({ error: 'Set a From email in the template first' });

  const apiKey = loadResendKey();
  if (!apiKey) return res.status(400).json({ error: 'Resend API key not configured. Add it in the Send section.' });

  const resend = new Resend(apiKey);
  const sentSet = loadSentEmails();
  const queue = leads.filter(l => l.email && !sentSet.has(l.email.toLowerCase()));

  sendJob = {
    running: true,
    total: queue.length,
    sent: 0,
    skipped: leads.length - queue.length,
    failed: 0,
    aborted: false
  };

  res.json({ ok: true, queued: queue.length, alreadySent: sendJob.skipped });

  (async () => {
    for (const lead of queue) {
      if (sendJob.aborted) break;

      try {
        const subject  = applyMergeTags(tpl.subject, lead, tpl);
        const bodyText = applyMergeTags(tpl.body, lead, tpl);
        const replyEmail = tpl.replyTo || tpl.fromEmail;
        const toAddress = lead.ownerName ? `${lead.ownerName} <${lead.email}>` : lead.email;

        await resend.emails.send({
          from: `${tpl.fromName} <${tpl.fromEmail}>`,
          to: [toAddress],
          reply_to: replyEmail,
          subject,
          text: bodyText + `\n\n---\nTo unsubscribe reply "Unsubscribe".`,
          html: buildEmailHtml(subject, bodyText, replyEmail),
          headers: {
            'X-Entity-Ref-ID': `brand-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            'List-Unsubscribe': `<mailto:${replyEmail}?subject=Unsubscribe>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            'Precedence': 'bulk'
          }
        });

        sentSet.add(lead.email.toLowerCase());
        saveSentEmails(sentSet);
        sendJob.sent++;
        broadcastSend('send_progress', { sent: sendJob.sent, total: sendJob.total, failed: sendJob.failed, current: lead.email, status: 'sent' });

      } catch (err) {
        sendJob.failed++;
        broadcastSend('send_progress', { sent: sendJob.sent, total: sendJob.total, failed: sendJob.failed, current: lead.email, status: 'failed', error: err.message });
      }

      if (!sendJob.aborted && sendJob.sent + sendJob.failed < sendJob.total) {
        await delay(delayMin + Math.random() * (delayMax - delayMin));
      }
    }

    sendJob.running = false;
    broadcastSend('send_done', { sent: sendJob.sent, failed: sendJob.failed, total: sendJob.total, aborted: sendJob.aborted });
  })();
});

app.post('/api/send/stop', (req, res) => {
  if (!sendJob || !sendJob.running) return res.status(400).json({ error: 'No send job running' });
  sendJob.aborted = true;
  res.json({ ok: true });
});

app.get('/api/send/status', (req, res) => {
  if (!sendJob) return res.json({ running: false });
  res.json({ ...sendJob });
});

const sendSseClients = new Set();

function broadcastSend(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of sendSseClients) c.write(msg);
}

app.get('/api/send/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
  if (sendJob) res.write(`event: send_progress\ndata: ${JSON.stringify({ sent: sendJob.sent, total: sendJob.total, failed: sendJob.failed, running: sendJob.running })}\n\n`);
  sendSseClients.add(res);
  req.on('close', () => sendSseClients.delete(res));
});

// Serve dashboard
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n Brand Outreach UI running at http://0.0.0.0:${PORT}\n`);
});
