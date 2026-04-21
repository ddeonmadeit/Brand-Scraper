#!/usr/bin/env node
/**
 * Run this ONCE locally to get your Gmail refresh token.
 * Then add GMAIL_USER and GMAIL_REFRESH_TOKEN to Railway env vars.
 *
 * Usage:
 *   node get-gmail-token.js
 */

const { google } = require('googleapis');
const http = require('http');
const url = require('url');

// ── Paste your credentials here (same as your railway env vars) ──────────
const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || 'PASTE_CLIENT_ID_HERE';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'PASTE_CLIENT_SECRET_HERE';
// ─────────────────────────────────────────────────────────────────────────

const REDIRECT_URI = 'http://localhost:3001/callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email'
  ],
  prompt: 'consent'
});

console.log('\n──────────────────────────────────────────────');
console.log('  Brand Outreach — Gmail Token Generator');
console.log('──────────────────────────────────────────────');
console.log('\n1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Log in and authorise the app.');
console.log('3. Your refresh token will appear here.\n');

// Temporary local server to catch the OAuth callback
const server = http.createServer(async (req, res) => {
  const { pathname, query } = url.parse(req.url, true);
  if (pathname !== '/callback') { res.end(); return; }

  res.end('<h2 style="font-family:sans-serif;color:#1a1a2e">✓ Authorised! Check your terminal for the token.</h2>');
  server.close();

  try {
    const { tokens } = await oauth2Client.getToken(query.code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    console.log('──────────────────────────────────────────────');
    console.log('  Add these to Railway → Variables:');
    console.log('──────────────────────────────────────────────\n');
    console.log(`GMAIL_USER=${data.email}`);
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n──────────────────────────────────────────────\n');
  } catch (err) {
    console.error('Error getting token:', err.message);
  }
});

server.listen(3001, () => {});
