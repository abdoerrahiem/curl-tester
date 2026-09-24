import React, { useState, useEffect } from 'react';
import {
  Play,
  Sun,
  Moon,
  Copy,
  Check,
  Terminal,
  Clock,
  HardDrive,
  Plus,
  Trash2,
  Code,
  AlertCircle,
  Sliders,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { parseCurlCommand, sanitizeCurlInput } from './utils/curlParser';

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const [mainTab, setMainTab] = useState('curl'); // 'curl' | 'tester'

  // Tab cURL specific state
  const [rawCurl, setRawCurl] = useState('');
  const [curlLoading, setCurlLoading] = useState(false);
  const [curlResponse, setCurlResponse] = useState(null);

  // Tab API Tester specific state
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [subTab, setSubTab] = useState('headers'); // 'headers' | 'body' | 'curl' | 'codegen'
  const [codeLang, setCodeLang] = useState('curl');
  const [headers, setHeaders] = useState([
    { key: '', value: '' }
  ]);
  const [body, setBody] = useState('');
  const [testerLoading, setTesterLoading] = useState(false);
  const [testerResponse, setTesterResponse] = useState(null);
  const [importCurlInput, setImportCurlInput] = useState('');

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const formatBody = (raw) => {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  };

  const getMethodBadgeColor = (m) => {
    switch (m) {
      case 'GET': return 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'POST': return 'text-amber-500 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'PUT': return 'text-violet-500 dark:text-violet-400 bg-violet-500/10 border-violet-500/20';
      case 'DELETE': return 'text-rose-500 dark:text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'PATCH': return 'text-teal-500 dark:text-teal-400 bg-teal-500/10 border-teal-500/20';
      default: return 'text-zinc-500 dark:text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    }
  };

  // --- TAB 1: cURL EXECUTOR & CLEANER ---
  const handleAutoCleanCurl = () => {
    if (!rawCurl.trim()) return;
    const cleaned = sanitizeCurlInput(rawCurl);
    setRawCurl(cleaned);
  };

  const executeRawCurl = async () => {
    if (!rawCurl.trim()) return;
    setCurlLoading(true);
    setCurlResponse(null);

    try {
      const parsed = parseCurlCommand(rawCurl);
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: parsed.method,
          url: parsed.url,
          headers: parsed.headers,
          body: parsed.body
        })
      });

      const data = await res.json();
      setCurlResponse(data);
    } catch (err) {
      setCurlResponse({
        error: true,
        message: err.message || 'Gagal mengeksekusi perintah cURL'
      });
    } finally {
      setCurlLoading(false);
    }
  };

  // --- TAB 2: API TESTER ---
  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const updateHeader = (index, field, val) => {
    const next = [...headers];
    next[index][field] = val;
    setHeaders(next);
  };

  const removeHeader = (index) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const generateCurlFromTester = () => {
    let cmd = `curl -X ${method} "${url || 'https://api.example.com'}"`;
    headers.forEach(h => {
      if (h.key.trim()) {
        cmd += ` \\\n  -H "${h.key.trim()}: ${h.value.trim()}"`;
      }
    });
    if (body.trim() && !['GET', 'HEAD'].includes(method)) {
      cmd += ` \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
    }
    return cmd;
  };

  const generateCodeSnippet = (lang) => {
    if (lang === 'curl') return generateCurlFromTester();
    const validHeaders = headers.filter(h => h.key.trim());
    const headerObj = validHeaders.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});

    if (lang === 'fetch') {
      return `const response = await fetch("${url}", {
  method: "${method}",
  headers: ${JSON.stringify(headerObj, null, 2)},
  ${!['GET', 'HEAD'].includes(method) && body.trim() ? `body: JSON.stringify(${body})` : ''}
});
const data = await response.json();
console.log(data);`;
    }

    if (lang === 'python') {
      return `import requests

url = "${url}"
headers = ${JSON.stringify(headerObj, null, 2)}
${!['GET', 'HEAD'].includes(method) && body.trim() ? `payload = ${body}\nresponse = requests.${method.toLowerCase()}(url, headers=headers, json=payload)` : `response = requests.${method.toLowerCase()}(url, headers=headers)`}

print(response.status_code)
print(response.text)`;
    }

    if (lang === 'golang') {
      return `package main

import (
  "fmt"
  "net/http"
  "io"
  ${!['GET', 'HEAD'].includes(method) && body.trim() ? `"strings"` : ''}
)

func main() {
  url := "${url}"
  ${!['GET', 'HEAD'].includes(method) && body.trim() ? `payload := strings.NewReader(\`${body}\`)\n  req, _ := http.NewRequest("${method}", url, payload)` : `req, _ := http.NewRequest("${method}", url, nil)`}

  ${validHeaders.map(h => `req.Header.Add("${h.key}", "${h.value}")`).join('\n  ')}

  res, _ := http.DefaultClient.Do(req)
  defer res.Body.Close()
  body, _ := io.ReadAll(res.Body)

  fmt.Println(string(body))
}`;
    }

    return '';
  };

  const parseToTesterForm = () => {
    if (!importCurlInput.trim()) return;
    try {
      const parsed = parseCurlCommand(importCurlInput);
      setUrl(parsed.url);
      setMethod(parsed.method);

      const headerPairs = Object.entries(parsed.headers).map(([k, v]) => ({ key: k, value: v }));
      if (headerPairs.length > 0) {
        setHeaders(headerPairs);
      }
      if (parsed.body) {
        setBody(typeof parsed.body === 'object' ? JSON.stringify(parsed.body, null, 2) : parsed.body);
      }
      setImportCurlInput('');
    } catch (err) {
      alert('Gagal mengurai cURL: ' + err.message);
    }
  };

  const executeTesterRequest = async () => {
    if (!url.trim()) return;
    setTesterLoading(true);
    setTesterResponse(null);

    const headerMap = {};
    headers.forEach(h => {
      if (h.key.trim()) headerMap[h.key.trim()] = h.value.trim();
    });

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          url,
          headers: headerMap,
          body: !['GET', 'HEAD'].includes(method) ? body : undefined
        })
      });

      const data = await res.json();
      setTesterResponse(data);
    } catch (err) {
      setTesterResponse({
        error: true,
        message: 'Gagal menghubungi server proxy: ' + err.message
      });
    } finally {
      setTesterLoading(false);
    }
  };

  // Render Response Box
  const renderResponseBox = (resp, isLoading) => {
    return (
      <div className="p-6 space-y-4">
        {/* Response Meta Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <span className="font-bold text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Response
          </span>

          {resp && !resp.error && (
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className={`px-2 py-0.5 rounded font-bold border ${resp.status >= 200 && resp.status < 300 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
                {resp.status}
              </span>
              <span className="flex items-center gap-1 text-zinc-500">
                <Clock size={12} /> {resp.timeMs} ms
              </span>
              <span className="flex items-center gap-1 text-zinc-500">
                <HardDrive size={12} /> {resp.size} B
              </span>
            </div>
          )}
        </div>

        {/* Response Body Box */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">Response Body</span>
            {resp && resp.body && (
              <button
                onClick={() => copyToClipboard(resp.body)}
                className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center gap-1 transition cursor-pointer"
              >
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy Body'}
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="min-h-[380px] rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 flex flex-col items-center justify-center text-zinc-400 text-xs space-y-3">
              <div className="w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
              <span>Executing request via backend proxy...</span>
            </div>
          ) : resp?.error ? (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-mono space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle size={14} /> Request Execution Error
              </div>
              <div>{resp.message}</div>
            </div>
          ) : resp ? (
            <pre className="min-h-[380px] p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 text-xs font-mono text-zinc-800 dark:text-zinc-200 overflow-auto whitespace-pre-wrap select-all">
              {formatBody(resp.body)}
            </pre>
          ) : (
            <div className="min-h-[380px] rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 text-xs space-y-2">
              <Code size={24} className="opacity-40" />
              <span>Klik &quot;Execute&quot; atau &quot;Send&quot; untuk melihat hasil response.</span>
            </div>
          )}
        </div>

        {/* Response Headers Accordion */}
        {resp?.headers && (
          <details className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs">
            <summary className="p-3.5 font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none flex justify-between items-center">
              <span>Response Headers ({Object.keys(resp.headers).length})</span>
              <span className="text-zinc-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="p-3.5 border-t border-zinc-200 dark:border-zinc-800 font-mono space-y-1.5 text-zinc-600 dark:text-zinc-400 max-h-60 overflow-y-auto">
              {Object.entries(resp.headers).map(([k, v]) => (
                <div key={k} className="flex">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 mr-2">{k}:</span>
                  <span className="truncate">{v}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-150">
      
      {/* 1. Top Navbar */}
      <header className="h-16 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center font-black tracking-tighter text-base shadow-sm">
            &gt;_
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight">cURL Tester</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                PRO
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* 2. Sub-Navbar: Main Tab Switcher */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md px-6 flex items-center justify-between">
        <div className="flex space-x-8 text-xs font-semibold">
          <button
            onClick={() => setMainTab('curl')}
            className={`py-3 flex items-center gap-2 relative transition cursor-pointer ${
              mainTab === 'curl'
                ? 'text-zinc-900 dark:text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            <Terminal size={14} />
            <span>cURL</span>
            {mainTab === 'curl' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setMainTab('tester')}
            className={`py-3 flex items-center gap-2 relative transition cursor-pointer ${
              mainTab === 'tester'
                ? 'text-zinc-900 dark:text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            <Sliders size={14} />
            <span>API Tester</span>
            {mainTab === 'tester' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
            )}
          </button>
        </div>

        <div className="text-[11px] text-zinc-400 hidden sm:block">
          {mainTab === 'curl' ? 'Mode: Direct Multiline cURL Runner (Auto Clean Supported)' : 'Mode: Interactive Visual Request Builder'}
        </div>
      </div>

      {/* 3. Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* ======================= TAB 1: cURL ONLY ======================= */}
        {mainTab === 'curl' && (
          <>
            {/* Left Panel: Raw cURL Multi-line Editor */}
            <div className="flex-1 lg:w-1/2 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col bg-white dark:bg-zinc-900 overflow-y-auto">
              <div className="p-6 space-y-4 flex-1 flex flex-col">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">cURL Command</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Paste syntax cURL apa saja (termasuk output kotor dari logger Android, Dio, Alice, OkHttp, terminal).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAutoCleanCurl}
                      className="text-xs px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition cursor-pointer"
                      title="Bersihkan log prefix dan format ulang cURL"
                    >
                      <Sparkles size={12} className="text-amber-500" /> Format & Clean
                    </button>
                    <button
                      onClick={() => setRawCurl('')}
                      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1 cursor-pointer"
                      title="Clear editor"
                    >
                      <RotateCcw size={13} /> Clear
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col space-y-2">
                  <textarea
                    value={rawCurl}
                    onChange={(e) => setRawCurl(e.target.value)}
                    placeholder={'curl -X POST "https://api.example.com" -H "Content-Type: application/json" -d \'{"hello": "world"}\''}
                    spellCheck="false"
                    className="flex-1 min-h-[340px] w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-none transition"
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="text-[11px] text-zinc-400">
                    Otomatis membersihkan log prefix seperti <code className="font-mono">I/flutter: ║</code> saat dieksekusi.
                  </div>
                  <button
                    onClick={executeRawCurl}
                    disabled={curlLoading || !rawCurl.trim()}
                    className="h-10 px-6 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs flex items-center gap-2 hover:opacity-90 active:scale-95 disabled:opacity-50 transition shadow-sm cursor-pointer"
                  >
                    {curlLoading ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Play size={13} fill="currentColor" />
                    )}
                    <span>Execute cURL</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Panel: cURL Response */}
            <div className="flex-1 lg:w-1/2 flex flex-col bg-zinc-100/50 dark:bg-zinc-950/60 overflow-y-auto">
              {renderResponseBox(curlResponse, curlLoading)}
            </div>
          </>
        )}

        {/* ======================= TAB 2: API TESTER ======================= */}
        {mainTab === 'tester' && (
          <>
            {/* Left Panel: Request Builder */}
            <div className="flex-1 lg:w-1/2 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col bg-white dark:bg-zinc-900 overflow-y-auto">
              <div className="p-6 space-y-5">
                
                {/* Import cURL Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Terminal size={14} /> Import Raw cURL ke Form
                    </span>
                    {importCurlInput.trim() && (
                      <button
                        onClick={parseToTesterForm}
                        className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Convert &rarr;
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder='Paste syntax cURL (bisa dari logger flutter/android) di sini'
                      value={importCurlInput}
                      onChange={(e) => setImportCurlInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') parseToTesterForm(); }}
                      className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition"
                    />
                    <button
                      onClick={parseToTesterForm}
                      className="px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
                    >
                      Parse
                    </button>
                  </div>
                </div>

                {/* URL & Method Bar */}
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <div className="relative">
                      <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className={`h-11 px-3.5 rounded-lg border font-mono font-bold text-xs appearance-none pr-8 cursor-pointer focus:outline-none transition ${getMethodBadgeColor(method)}`}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                        <option value="HEAD">HEAD</option>
                      </select>
                    </div>

                    <input
                      type="url"
                      placeholder="https://api.domain.com/v1/endpoint"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') executeTesterRequest(); }}
                      className="flex-1 h-11 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition"
                    />

                    <button
                      onClick={executeTesterRequest}
                      disabled={testerLoading}
                      className="h-11 px-6 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs flex items-center gap-2 hover:opacity-90 active:scale-95 disabled:opacity-50 transition shadow-sm cursor-pointer"
                    >
                      {testerLoading ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Play size={13} fill="currentColor" />
                      )}
                      <span>Send</span>
                    </button>
                  </div>
                </div>

                {/* Sub-tabs Navigation */}
                <div className="border-b border-zinc-200 dark:border-zinc-800 flex space-x-6 text-xs font-medium">
                  <button
                    onClick={() => setSubTab('headers')}
                    className={`pb-3 relative transition cursor-pointer ${subTab === 'headers' ? 'text-zinc-900 dark:text-white font-semibold' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                  >
                    Headers ({headers.filter(h => h.key.trim()).length})
                    {subTab === 'headers' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
                    )}
                  </button>

                  <button
                    onClick={() => setSubTab('body')}
                    className={`pb-3 relative transition cursor-pointer ${subTab === 'body' ? 'text-zinc-900 dark:text-white font-semibold' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                  >
                    Body {['GET', 'HEAD'].includes(method) && <span className="text-[10px] text-zinc-400">(disabled)</span>}
                    {subTab === 'body' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
                    )}
                  </button>

                  <button
                    onClick={() => setSubTab('curl')}
                    className={`pb-3 relative transition cursor-pointer ${subTab === 'curl' ? 'text-zinc-900 dark:text-white font-semibold' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                  >
                    Live cURL
                    {subTab === 'curl' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
                    )}
                  </button>

                  <button
                    onClick={() => setSubTab('codegen')}
                    className={`pb-3 relative transition cursor-pointer ${subTab === 'codegen' ? 'text-zinc-900 dark:text-white font-semibold' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                  >
                    Code Snippets
                    {subTab === 'codegen' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
                    )}
                  </button>
                </div>

                {/* SubTab: Headers */}
                {subTab === 'headers' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400">Header Pairs</span>
                      <button
                        onClick={addHeader}
                        className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={13} /> Add Header
                      </button>
                    </div>

                    <div className="space-y-2">
                      {headers.map((h, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder="Header Key (e.g. Authorization)"
                            value={h.key}
                            onChange={(e) => updateHeader(i, 'key', e.target.value)}
                            className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                          />
                          <input
                            type="text"
                            placeholder="Value (e.g. Bearer token)"
                            value={h.value}
                            onChange={(e) => updateHeader(i, 'value', e.target.value)}
                            className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                          />
                          <button
                            onClick={() => removeHeader(i)}
                            className="p-2 text-zinc-400 hover:text-rose-500 rounded transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SubTab: Body */}
                {subTab === 'body' && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400">JSON / Raw Payload</span>
                      <button
                        onClick={() => setBody(formatBody(body))}
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:underline cursor-pointer"
                      >
                        Format JSON
                      </button>
                    </div>
                    <textarea
                      rows={10}
                      value={body}
                      disabled={['GET', 'HEAD'].includes(method)}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder='{\n  "key": "value"\n}'
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition"
                    />
                  </div>
                )}

                {/* SubTab: Live cURL */}
                {subTab === 'curl' && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400">Auto-Generated cURL Command</span>
                      <button
                        onClick={() => copyToClipboard(generateCurlFromTester())}
                        className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        {copied ? 'Copied' : 'Copy cURL'}
                      </button>
                    </div>
                    <pre className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 overflow-x-auto whitespace-pre-wrap select-all">
                      {generateCurlFromTester()}
                    </pre>
                  </div>
                )}

                {/* SubTab: Code Generation */}
                {subTab === 'codegen' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      {['curl', 'fetch', 'python', 'golang'].map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setCodeLang(lang)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${codeLang === lang ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
                        >
                          {lang === 'fetch' ? 'JavaScript (Fetch)' : lang}
                        </button>
                      ))}
                    </div>
                    <pre className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 overflow-x-auto whitespace-pre-wrap select-all">
                      {generateCodeSnippet(codeLang)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: API Tester Response */}
            <div className="flex-1 lg:w-1/2 flex flex-col bg-zinc-100/50 dark:bg-zinc-950/60 overflow-y-auto">
              {renderResponseBox(testerResponse, testerLoading)}
            </div>
          </>
        )}

      </main>

    </div>
  );
}
