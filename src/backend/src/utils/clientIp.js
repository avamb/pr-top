// Real client IP resolution
//
// Request chain in production: Cloudflare -> Traefik -> nginx (frontend
// container) -> backend. The number of proxy hops differs between dev and
// prod, so `trust proxy` + X-Forwarded-For is unreliable for rate limiting.
// Cloudflare sets CF-Connecting-IP to the true visitor address; nginx forwards
// it as-is (src/frontend/nginx.conf). The header is only trustworthy while the
// origin is not reachable directly (see PLAN_ANTIBOT_REGISTRATION_AND_CODE_LOGIN.md
// §3 phase 0; index.js warns at startup unless ORIGIN_LOCKED=true).
// Falls back to req.ip when the header is absent or malformed.
//
// IPv6 is collapsed to its /64 so a client rotating through the 2^64
// addresses of a single allocation still shares one rate-limit bucket.
// IPv4 (including IPv4-mapped ::ffff:a.b.c.d) is used unchanged.
const net = require('net');

// Expand an IPv6 literal to its 8 hextets (zero-padded), or null if it cannot
// be parsed. Handles '::' compression, an embedded IPv4 tail and zone ids.
function expandIPv6(ip) {
  let s = ip.split('%')[0];
  const embedded = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (embedded) {
    const p = embedded[2].split('.').map(Number);
    s = embedded[1] + ((p[0] << 8) | p[1]).toString(16) + ':' + ((p[2] << 8) | p[3]).toString(16);
  }
  const parts = s.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const groups = parts.length === 2
    ? head.concat(new Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), tail)
    : head;
  if (groups.length !== 8) return null;
  return groups.map((g) => g.padStart(4, '0').toLowerCase());
}

// Normalise an address into a rate-limit key: IPv4 as-is, IPv6 -> /64.
function bucketKey(ip) {
  if (net.isIPv4(ip)) return ip;
  if (net.isIPv6(ip)) {
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped) return mapped[1];
    const groups = expandIPv6(ip);
    if (groups) return groups.slice(0, 4).join(':') + '::/64';
  }
  return ip;
}

function getClientIp(req) {
  const header = req && req.headers ? req.headers['cf-connecting-ip'] : undefined;
  if (typeof header === 'string') {
    const candidate = header.trim();
    if (candidate && net.isIP(candidate)) {
      return bucketKey(candidate);
    }
  }
  const fallback = req && (req.ip || (req.socket && req.socket.remoteAddress));
  return fallback ? bucketKey(String(fallback)) : 'unknown';
}

module.exports = { getClientIp, bucketKey };
