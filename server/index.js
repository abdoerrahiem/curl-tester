import express from 'express';
import cors from 'cors';
import { Agent, request } from 'undici';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import pool, { initDb } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3035;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '679480905723-2a923njts4dmr3l84kea5uuh6f40q6gr.apps.googleusercontent.com';
const JWT_SECRET = process.env.JWT_SECRET || 'secret_jwt_curl_tester';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Auth Middleware (optional or required based on endpoint)
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: true, message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: true, message: 'Invalid or expired token' });
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      // ignore invalid token for optional auth
    }
  }
  next();
};

// Insecure agent option
const insecureAgent = new Agent({
  connect: {
    rejectUnauthorized: false
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'curl-tester-backend', timestamp: Date.now() });
});

// Auth Routes
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: true, message: 'Credential is required' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture: avatar } = payload;

    if (!email) {
      return res.status(400).json({ error: true, message: 'Email not provided by Google' });
    }

    // Upsert user into MySQL
    const [rows] = await pool.query('SELECT * FROM users WHERE google_id = ? OR email = ? LIMIT 1', [googleId, email]);
    let userId;

    if (rows.length > 0) {
      userId = rows[0].id;
      await pool.query(
        'UPDATE users SET name = ?, avatar = ?, google_id = ? WHERE id = ?',
        [name || rows[0].name, avatar || rows[0].avatar, googleId, userId]
      );
    } else {
      const [insertResult] = await pool.query(
        'INSERT INTO users (google_id, email, name, avatar) VALUES (?, ?, ?, ?)',
        [googleId, email, name, avatar]
      );
      userId = insertResult.insertId;
    }

    const token = jwt.sign(
      { id: userId, email, name, avatar },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      user: {
        id: userId,
        email,
        name,
        avatar
      }
    });
  } catch (error) {
    console.error('Google verification error:', error);
    return res.status(401).json({ error: true, message: 'Google authentication failed: ' + error.message });
  }
});

// Verify current session
app.get('/api/auth/me', authenticateUser, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, email, name, avatar, created_at FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: true, message: 'User not found' });
    }
    return res.json({ user: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: true, message: err.message });
  }
});

// History Routes (User-specific)
app.get('/api/history', authenticateUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, source, method, url, curl_command as curlCommand, headers, body, status, time_ms as timeMs, created_at as timestamp 
       FROM request_history 
       WHERE user_id = ? 
       ORDER BY id DESC 
       LIMIT 100`,
      [req.user.id]
    );

    // Format headers if stringified
    const formatted = rows.map((r) => {
      let parsedHeaders = [];
      try {
        if (typeof r.headers === 'string') {
          const obj = JSON.parse(r.headers);
          parsedHeaders = Array.isArray(obj) ? obj : Object.entries(obj).map(([k, v]) => ({ key: k, value: v }));
        } else if (typeof r.headers === 'object' && r.headers !== null) {
          parsedHeaders = Array.isArray(r.headers) ? r.headers : Object.entries(r.headers).map(([k, v]) => ({ key: k, value: v }));
        }
      } catch (e) {
        parsedHeaders = [];
      }
      return {
        ...r,
        id: String(r.id),
        headers: parsedHeaders
      };
    });

    return res.json({ history: formatted });
  } catch (err) {
    console.error('Fetch history error:', err);
    return res.status(500).json({ error: true, message: err.message });
  }
});

app.post('/api/history', authenticateUser, async (req, res) => {
  const { source = 'curl', method = 'GET', url, curlCommand = '', headers = [], body = '', status = '200', timeMs = 0 } = req.body;
  if (!url) {
    return res.status(400).json({ error: true, message: 'URL is required' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO request_history (user_id, source, method, url, curl_command, headers, body, status, time_ms) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        source,
        method.toUpperCase(),
        url,
        curlCommand,
        JSON.stringify(headers),
        body,
        String(status),
        timeMs
      ]
    );

    return res.json({
      success: true,
      id: String(result.insertId)
    });
  } catch (err) {
    console.error('Save history error:', err);
    return res.status(500).json({ error: true, message: err.message });
  }
});

app.delete('/api/history/:id', authenticateUser, async (req, res) => {
  try {
    await pool.query('DELETE FROM request_history WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: true, message: err.message });
  }
});

app.delete('/api/history', authenticateUser, async (req, res) => {
  try {
    await pool.query('DELETE FROM request_history WHERE user_id = ?', [req.user.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: true, message: err.message });
  }
});

// Proxy Execution route
app.post(['/api/proxy', '/api/execute'], optionalAuth, async (req, res) => {
  const {
    method = 'GET',
    url,
    headers = {},
    body = null,
    insecure = false,
    timeout = 30000,
    source = 'curl',
    curlCommand = ''
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

    const timeMs = Math.round(endTime - startTime);

    // If authenticated user, automatically save to database history as well!
    if (req.user && req.user.id) {
      try {
        const headerList = Object.entries(cleanHeaders).map(([key, value]) => ({ key, value }));
        await pool.query(
          `INSERT INTO request_history (user_id, source, method, url, curl_command, headers, body, status, time_ms) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            source,
            options.method,
            url,
            curlCommand,
            JSON.stringify(headerList),
            options.body || '',
            String(response.statusCode),
            timeMs
          ]
        );
      } catch (dbErr) {
        console.error('Auto save history error:', dbErr);
      }
    }

    return res.json({
      status: response.statusCode,
      headers: responseHeaders,
      body: rawBody,
      size: Buffer.byteLength(rawBody, 'utf8'),
      timeMs
    });
  } catch (error) {
    const endTime = performance.now();
    const timeMs = Math.round(endTime - startTime);

    if (req.user && req.user.id) {
      try {
        await pool.query(
          `INSERT INTO request_history (user_id, source, method, url, curl_command, headers, body, status, time_ms) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            source,
            method.toUpperCase(),
            url,
            curlCommand,
            JSON.stringify([]),
            body || '',
            'ERR',
            timeMs
          ]
        );
      } catch (dbErr) {
        console.error('Auto save error history:', dbErr);
      }
    }

    return res.status(502).json({
      error: true,
      message: error.message || 'Request execution failed',
      timeMs
    });
  }
});

// Initialize database then start server
initDb()
  .then(() => {
    app.listen(PORT, '127.0.0.1', () => {
      console.log(`cURL Tester backend proxy listening on http://127.0.0.1:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
