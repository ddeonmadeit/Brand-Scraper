const config = require('./config');

class ProxyRotator {
  constructor() {
    this._index = 0;
  }

  getHeaders() {
    const ua = config.USER_AGENTS[this._index % config.USER_AGENTS.length];
    this._index++;
    return {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-AU,en;q=0.9,en-US;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0'
    };
  }
}

module.exports = { ProxyRotator };
