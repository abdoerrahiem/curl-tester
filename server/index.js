import express from 'express';
import cors from 'cors';
import { Agent, request } from 'undici';

const app = express();
const PORT = process.env.PORT || 3035;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Insecure agent option if needed
const insecureAgent = new Agent({
  connect: {
    rejectUnauthorized: false
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'curl-tester-backend', timestamp: Date.now() });
});

app.post('/api/execute', async (req, res) => {
  const {
    method = 'GET',
    url,
    headers = {},
    body = null,
    insecure = false,
    timeout = 30000
  } = req.body;

  if (!url) {
    return res.status(400).json({ error: true, message: 'URL is required' });
  }

  // Security check: cegah SSRF ke localhost / private network dari server
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.31.')
    ) {
      return res.status(403).json({
        error: true,
        message: 'Akses ke IP privat/lokal server diblokir untuk keamanan.'
      });
    }
  } catch (err) {
    return res.status(400).json({ error: true, message: 'Format URL tidak valid' });
  }

  const startTime = performance.now();

  try {
    const cleanHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      if (key && value !== undefined && value !== null) {
        cleanHeaders[key] = String(value);
      }
    }

    const options = {
      method: method.toUpperCase(),
      headers: cleanHeaders,
      headersTimeout: timeout,
      bodyTimeout: timeout,
      dispatcher: insecure ? insecureAgent : undefined
    };

    if (!['GET', 'HEAD'].includes(options.method) && body !== null && body !== undefined) {
      options.body = typeof body === 'object' ? JSON.stringify(body) : String(body);
    }

    const response = await request(url, options);
    const endTime = performance.now();
    const rawBody = await response.body.text();

    const responseHeaders = {};
    for (const [key, value] of Object.entries(response.headers)) {
      responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
    }

    return res.json({
      status: response.statusCode,
      headers: responseHeaders,
      body: rawBody,
      size: Buffer.byteLength(rawBody, 'utf8'),
      timeMs: Math.round(endTime - startTime)
    });
  } catch (error) {
    const endTime = performance.now();
    return res.status(502).json({
      error: true,
      message: error.message || 'Request execution failed',
      timeMs: Math.round(endTime - startTime)
    });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`cURL Tester backend proxy listening on http://127.0.0.1:${PORT}`);
});
