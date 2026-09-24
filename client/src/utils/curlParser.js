/**
 * Membersihkan cURL yang kotor / berantakan akibat copy-paste dari terminal,
 * logger Android / iOS / Flutter (misal Dio Logger, Alice, OkHttp, Logcat), dsb.
 */
export function sanitizeCurlInput(raw) {
  if (!raw || !raw.trim()) return '';

  const lines = raw.split(/\r?\n/);
  const cleanedParts = [];

  for (let line of lines) {
    let l = line.trim();
    if (!l) continue;

    // Hapus trailing backslash dulu agar mudah menormalkan
    if (l.endsWith('\\')) {
      l = l.slice(0, -1).trim();
    }

    // 1. Bersihkan prefix Android/Logcat/Flutter/iOS/OkHttp:
    // Contoh: "I/flutter (11595): ║ -X GET", "D/OkHttp ( 1234): -->", "flutter: ║ ..."
    l = l.replace(/^[A-Za-z]\/[A-Za-z0-9_.-]+(?:\s*\(\s*\d+\s*\))?\s*:\s*/, '');
    l = l.replace(/^[A-Za-z0-9_.-]+(?:\s*\(\s*\d+\s*\))?\s*:\s*/, '');
    
    // 2. Bersihkan timestamp prefix seperti [2026-09-24 07:30:00] atau 2026-09-24T...
    l = l.replace(/^\[?\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]?\s*/, '');
    l = l.replace(/^\[[A-Za-z0-9_.-]+\]\s*/, '');

    // 3. Bersihkan box drawing symbols & prompt terminal:
    // ║, │, ┌, └, ├, ┤, ─, |, >, $, #
    l = l.replace(/^[║│┌└├┤─|+>$#•·\s]+/, '');

    // 4. Jika baris pertama / suatu baris memiliki kata "curl " di tengah log
    if (cleanedParts.length === 0) {
      const curlIdx = l.indexOf('curl ');
      if (curlIdx !== -1) {
        l = l.slice(curlIdx);
      }
    }

    const trimmed = l.trim();
    if (trimmed) {
      cleanedParts.push(trimmed);
    }
  }

  // Gabungkan kembali dengan format multiline backslash standar
  return cleanedParts.join(' \\\n  ');
}

/**
 * Parse perintah cURL (termasuk yang multiline atau berisi format kotor)
 * menjadi objek { method, url, headers, body }
 */
export function parseCurlCommand(raw) {
  if (!raw || !raw.trim()) {
    throw new Error('Command cURL kosong');
  }

  // Bersihkan format kotor terlebih dahulu
  const sanitized = sanitizeCurlInput(raw);

  // Hilangkan line continuations
  let clean = sanitized.replace(/\\\r?\n/g, ' ').trim();

  let method = 'GET';
  let url = '';
  const headers = {};
  let body = null;

  // Regex tokenizer untuk menangani string dengan quote dan spasi
  const regex = /[^\s"']+|"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;
  const tokens = [];
  let match;

  while ((match = regex.exec(clean)) !== null) {
    if (match[1] !== undefined) {
      tokens.push(match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
    } else if (match[2] !== undefined) {
      tokens.push(match[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
    } else {
      tokens.push(match[0]);
    }
  }

  let i = 0;
  if (tokens[0] === 'curl') {
    i = 1;
  }

  while (i < tokens.length) {
    const t = tokens[i];

    if (t === '-X' || t === '--request') {
      method = (tokens[i + 1] || 'GET').toUpperCase();
      i += 2;
    } else if (t === '-H' || t === '--header') {
      const headerStr = tokens[i + 1] || '';
      const colonIdx = headerStr.indexOf(':');
      if (colonIdx > 0) {
        const k = headerStr.slice(0, colonIdx).trim();
        const v = headerStr.slice(colonIdx + 1).trim();
        headers[k] = v;
      }
      i += 2;
    } else if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary') {
      body = tokens[i + 1] || '';
      if (method === 'GET') method = 'POST';
      i += 2;
    } else if (t === '-A' || t === '--user-agent') {
      headers['User-Agent'] = tokens[i + 1] || '';
      i += 2;
    } else if (t === '-u' || t === '--user') {
      const userpass = tokens[i + 1] || '';
      try {
        headers['Authorization'] = 'Basic ' + btoa(userpass);
      } catch {
        headers['Authorization'] = 'Basic ' + userpass;
      }
      i += 2;
    } else if (t === '--location' || t === '-L' || t === '-k' || t === '--insecure' || t === '-s' || t === '--silent' || t === '-v' || t === '--verbose') {
      // Abaikan curl flag flags umum yang tidak mempengaruhi payload
      i++;
    } else if (t.startsWith('http://') || t.startsWith('https://')) {
      url = t;
      i++;
    } else if (t === '--url') {
      url = tokens[i + 1] || '';
      i += 2;
    } else {
      if (!url && (t.startsWith('http://') || t.startsWith('https://'))) {
        url = t;
      }
      i++;
    }
  }

  if (!url) {
    const urlFallback = clean.match(/https?:\/\/[^\s'"]+/i);
    if (urlFallback) {
      url = urlFallback[0];
    } else {
      throw new Error('Tidak dapat menemukan URL target dalam cURL');
    }
  }

  return { method, url, headers, body, sanitizedCurl: sanitized };
}
