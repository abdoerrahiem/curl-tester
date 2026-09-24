import http from 'http';
import https from 'https';
import { SocksProxyAgent } from 'socks-proxy-agent';

// Cloudflare WARP local SOCKS5 proxy daemon
const warpAgent = new SocksProxyAgent('socks5h://127.0.0.1:40000');

export function executeWarpRequest(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(targetUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const method = (options.method || 'GET').toUpperCase();
      const headers = { ...options.headers };
      const timeout = options.timeout || 30000;

      // Ensure Host header matches target host
      if (!headers['Host'] && !headers['host']) {
        headers['Host'] = parsedUrl.host;
      }

      // Add modern default User-Agent if not specified
      if (!headers['User-Agent'] && !headers['user-agent']) {
        headers['User-Agent'] = 'curl/8.7.1';
      }

      const reqOptions = {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers,
        agent: warpAgent,
        timeout
      };

      if (options.insecure) {
        reqOptions.rejectUnauthorized = false;
      }

      const req = client.request(reqOptions, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const bodyBuffer = Buffer.concat(chunks);
          const rawBody = bodyBuffer.toString('utf8');
          resolve({
            statusCode: res.statusCode || 200,
            headers: res.headers,
            body: rawBody
          });
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error(`Request timeout after ${timeout}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (!['GET', 'HEAD'].includes(method) && options.body !== null && options.body !== undefined) {
        req.write(options.body);
      }

      req.end();
    } catch (err) {
      reject(err);
    }
  });
}
