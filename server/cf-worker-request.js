import dotenv from 'dotenv';
dotenv.config();

const CF_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https://curl-tester-proxy.abdoerrahiem.workers.dev';
const PROXY_SECRET = process.env.PROXY_SECRET || 'curl-tester-secret-2026';

export async function executeViaCloudflareWorker(targetUrl, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};
  const timeoutMs = options.timeout || 30000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const payload = {
      url: targetUrl,
      method,
      headers,
      body: options.body || null
    };

    const response = await fetch(CF_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-proxy-secret': PROXY_SECRET,
        'User-Agent': 'curl-tester-backend/1.0.0'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    if (!response.ok && data.error && !data.status) {
      throw new Error(data.message || `Cloudflare Worker proxy error (${response.status})`);
    }

    return {
      statusCode: data.status || response.status,
      statusText: data.statusText || 'OK',
      headers: data.headers || {},
      body: data.body !== undefined ? data.body : '',
      timeMs: data.timeMs || 0
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw err;
  }
}
