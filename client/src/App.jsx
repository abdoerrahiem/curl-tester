import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  History,
  Search,
  LogIn,
  LogOut,
  User as UserIcon,
  Users
} from 'lucide-react';
import { parseCurlCommand, sanitizeCurlInput } from './utils/curlParser';

const GOOGLE_CLIENT_ID = '679480905723-2a923njts4dmr3l84kea5uuh6f40q6gr.apps.googleusercontent.com';

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const [mainTab, setMainTab] = useState('curl'); // 'curl' | 'tester' | 'history'

  // User Auth State
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('curl_tester_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('curl_tester_token') || '';
    } catch {
      return '';
    }
  });

  // Tab cURL specific state
  const [rawCurl, setRawCurl] = useState('');
  const [curlLoading, setCurlLoading] = useState(false);
  const [curlResponse, setCurlResponse] = useState(null);

  // Tab API Tester specific state
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState([]);
  const [body, setBody] = useState('');
  const [subTab, setSubTab] = useState('headers');
  const [testerLoading, setTesterLoading] = useState(false);
  const [testerResponse, setTesterResponse] = useState(null);

  // Import cURL Modal in Tester tab
  const [importCurlModalOpen, setImportCurlModalOpen] = useState(false);
  const [importCurlInput, setImportCurlInput] = useState('');

  // History state
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSearch, setUsersSearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [copied, setCopied] = useState(false);

  // Ref Google Button container
  const googleBtnRef = useRef(null);

  // Sync theme
  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.error(e);
    }
  }, [theme]);

  // Load user profile & history
  const fetchUsersList = async (authToken) => {
    if (!authToken) return;
    setUsersLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users list:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchUserHistory = async (authToken) => {
    if (!authToken) return;
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/history', {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data.history || []);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUserHistory(token);
    } else {
      // Guest local fallback
      try {
        const saved = localStorage.getItem('curl_tester_history_guest');
        setHistoryList(saved ? JSON.parse(saved) : []);
      } catch {
        setHistoryList([]);
      }
    }
  }, [token]);

  // Google Sign In Callback
  const handleGoogleCallback = async (response) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('curl_tester_token', data.token);
        localStorage.setItem('curl_tester_user', JSON.stringify(data.user));
        fetchUserHistory(data.token);
      } else {
        alert(data.message || 'Gagal login dengan Google');
      }
    } catch (err) {
      alert('Error saat menghubungi server auth: ' + err.message);
    }
  };

  // Initialize Google Identity Services
  useEffect(() => {
    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
          auto_select: false
        });

        if (googleBtnRef.current && !user) {
          googleBtnRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: theme === 'dark' ? 'filled_black' : 'outline',
            size: 'medium',
            shape: 'pill',
            text: 'signin_with',
            logo_alignment: 'left'
          });
        }
      }
    };

    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(timer);
        initGoogle();
      }
    }, 300);

    return () => clearInterval(timer);
  }, [theme, user]);

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('curl_tester_token');
    localStorage.removeItem('curl_tester_user');
    try {
      const saved = localStorage.getItem('curl_tester_history_guest');
      setHistoryList(saved ? JSON.parse(saved) : []);
    } catch {
      setHistoryList([]);
    }
  };

  const saveToHistory = async (item) => {
    if (token) {
      // Reload history from server to get accurate MySQL state
      fetchUserHistory(token);
    } else {
      // Guest mode
      try {
        setHistoryList((prev) => {
          const next = [item, ...prev.filter((h) => h.id !== item.id)].slice(0, 50);
          localStorage.setItem('curl_tester_history_guest', JSON.stringify(next));
          return next;
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const clearAllHistory = async () => {
    if (!window.confirm('Hapus seluruh riwayat request?')) return;
    if (token) {
      try {
        await fetch('/api/history', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        setHistoryList([]);
      } catch (e) {
        alert('Gagal menghapus riwayat di server: ' + e.message);
      }
    } else {
      setHistoryList([]);
      try {
        localStorage.removeItem('curl_tester_history_guest');
      } catch (e) {}
    }
  };

  const deleteHistoryItem = async (id, e) => {
    e.stopPropagation();
    if (token) {
      try {
        await fetch(`/api/history/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        setHistoryList((prev) => prev.filter((item) => String(item.id) !== String(id)));
      } catch (err) {
        console.error(err);
      }
    } else {
      setHistoryList((prev) => {
        const next = prev.filter((item) => String(item.id) !== String(id));
        try {
          localStorage.setItem('curl_tester_history_guest', JSON.stringify(next));
        } catch (err) {}
        return next;
      });
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const copyToClipboard = (text, id = null) => {
    navigator.clipboard.writeText(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Format JSON Response
  const formatBody = (raw) => {
    if (!raw) return '';
    if (typeof raw === 'object') return JSON.stringify(raw, null, 2);
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return raw;
    }
  };

  // Helper method badge color
  const getMethodBadgeColor = (m) => {
    switch (m?.toUpperCase()) {
      case 'GET':
        return 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'POST':
        return 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10';
      case 'PUT':
        return 'text-violet-600 dark:text-violet-400 border-violet-500/30 bg-violet-500/10';
      case 'PATCH':
        return 'text-teal-600 dark:text-teal-400 border-teal-500/30 bg-teal-500/10';
      case 'DELETE':
        return 'text-rose-600 dark:text-rose-400 border-rose-500/30 bg-rose-500/10';
      default:
        return 'text-zinc-600 dark:text-zinc-400 border-zinc-500/30 bg-zinc-500/10';
    }
  };

  // Convert tester state to cURL command string
  const generateCurlFromTester = (tMethod = method, tUrl = url, tHeaders = headers, tBody = body) => {
    let cmd = `curl -X ${tMethod} "${tUrl || 'https://api.example.com'}"`;
    tHeaders.forEach((h) => {
      if (h.key.trim()) {
        cmd += ` \\\n  -H "${h.key}: ${h.value}"`;
      }
    });
    if (!['GET', 'HEAD'].includes(tMethod) && tBody && tBody.trim()) {
      const escapedBody = tBody.replace(/'/g, "'\\''");
      cmd += ` \\\n  -d '${escapedBody}'`;
    }
    return cmd;
  };

  // Load history item into cURL tab
  const loadHistoryToCurl = (item) => {
    const cmd = item.curlCommand || generateCurlFromTester(item.method, item.url, item.headers || [], item.body || '');
    setRawCurl(cmd);
    setMainTab('curl');
  };

  // Load history item into API Tester tab
  const loadHistoryToTester = (item) => {
    if (item.source === 'curl' && item.curlCommand) {
      const parsed = parseCurlCommand(item.curlCommand);
      if (parsed) {
        setMethod(parsed.method || 'GET');
        setUrl(parsed.url || '');
        setHeaders(
          parsed.headers ? Object.entries(parsed.headers).map(([key, value]) => ({ key, value })) : []
        );
        setBody(parsed.body || '');
      }
    } else {
      setMethod(item.method || 'GET');
      setUrl(item.url || '');
      setHeaders(item.headers || []);
      setBody(item.body || '');
    }
    setMainTab('tester');
  };

  // Handler format & clean cURL
  const handleAutoCleanCurl = () => {
    if (!rawCurl.trim()) return;
    const sanitized = sanitizeCurlInput(rawCurl);
    const parsed = parseCurlCommand(sanitized);
    if (!parsed || !parsed.url) {
      setRawCurl(sanitized);
      return;
    }
    let formatted = `curl -X ${parsed.method || 'GET'} "${parsed.url}"`;
    if (parsed.headers && Object.keys(parsed.headers).length > 0) {
      for (const [key, val] of Object.entries(parsed.headers)) {
        formatted += ` \\\n  -H "${key}: ${val}"`;
      }
    }
    if (parsed.body) {
      const escaped = parsed.body.replace(/'/g, "'\\''");
      formatted += ` \\\n  -d '${escaped}'`;
    }
    setRawCurl(formatted);
  };

  // Execute from Tab 1: cURL Only
  const executeRawCurl = async () => {
    if (!rawCurl.trim()) return;
    setCurlLoading(true);
    setCurlResponse(null);

    const parsed = parseCurlCommand(rawCurl);
    if (!parsed || !parsed.url) {
      setCurlResponse({
        error: true,
        message: 'Gagal mem-parsing syntax cURL. Pastikan URL dan format cURL valid.'
      });
      setCurlLoading(false);
      return;
    }

    try {
      const reqHeaders = { 'Content-Type': 'application/json' };
      if (token) reqHeaders['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          url: parsed.url,
          method: parsed.method,
          headers: parsed.headers,
          body: parsed.body,
          source: 'curl',
          curlCommand: rawCurl
        })
      });

      const data = await res.json();
      setCurlResponse(data);

      saveToHistory({
        id: Date.now().toString(),
        source: 'curl',
        timestamp: new Date().toISOString(),
        method: parsed.method || 'GET',
        url: parsed.url,
        curlCommand: rawCurl,
        headers: Object.entries(parsed.headers || {}).map(([key, value]) => ({ key, value })),
        body: parsed.body || '',
        status: data?.status || (data?.error ? 'ERR' : 200),
        timeMs: data?.timeMs || 0
      });
    } catch (err) {
      setCurlResponse({
        error: true,
        message: 'Gagal menghubungi server proxy: ' + err.message
      });
    } finally {
      setCurlLoading(false);
    }
  };

  // Execute from Tab 2: API Tester Visual
  const executeTesterRequest = async () => {
    if (!url.trim()) return;
    setTesterLoading(true);
    setTesterResponse(null);

    const headerMap = {};
    headers.forEach((h) => {
      if (h.key.trim()) headerMap[h.key.trim()] = h.value;
    });

    const activeCurl = generateCurlFromTester(method, url, headers, body);

    try {
      const reqHeaders = { 'Content-Type': 'application/json' };
      if (token) reqHeaders['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          url,
          method,
          headers: headerMap,
          body: !['GET', 'HEAD'].includes(method) ? body : undefined,
          source: 'tester',
          curlCommand: activeCurl
        })
      });

      const data = await res.json();
      setTesterResponse(data);

      saveToHistory({
        id: Date.now().toString(),
        source: 'tester',
        timestamp: new Date().toISOString(),
        method: method || 'GET',
        url,
        curlCommand: activeCurl,
        headers: [...headers],
        body: !['GET', 'HEAD'].includes(method) ? body : '',
        status: data?.status || (data?.error ? 'ERR' : 200),
        timeMs: data?.timeMs || 0
      });
    } catch (err) {
      setTesterResponse({
        error: true,
        message: 'Gagal menghubungi server proxy: ' + err.message
      });
    } finally {
      setTesterLoading(false);
    }
  };

  // Parse cURL inside modal to tester form
  const parseToTesterForm = () => {
    if (!importCurlInput.trim()) return;
    const parsed = parseCurlCommand(importCurlInput);
    if (!parsed || !parsed.url) {
      alert('Gagal mengenali format cURL. Pastikan menyertakan URL target.');
      return;
    }
    setMethod(parsed.method || 'GET');
    setUrl(parsed.url);
    if (parsed.headers && Object.keys(parsed.headers).length > 0) {
      setHeaders(Object.entries(parsed.headers).map(([key, value]) => ({ key, value })));
    }
    if (parsed.body) {
      setBody(parsed.body);
      setSubTab('body');
    }
    setImportCurlModalOpen(false);
    setImportCurlInput('');
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
              <span
                className={`px-2 py-0.5 rounded font-bold border ${
                  resp.status >= 200 && resp.status < 300
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
                }`}
              >
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

        {/* Response Body Box: capped at 60vh */}
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
            <div className="h-[280px] max-h-[60vh] rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 flex flex-col items-center justify-center text-zinc-400 text-xs space-y-3">
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
            <pre className="max-h-[60vh] p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 text-xs font-mono text-zinc-800 dark:text-zinc-200 overflow-auto whitespace-pre-wrap select-all">
              {formatBody(resp.body)}
            </pre>
          ) : (
            <div className="h-[280px] max-h-[60vh] rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 text-xs space-y-2">
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

  // Filter history by search
  const filteredHistory = historyList.filter((item) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (
      item.url?.toLowerCase().includes(q) ||
      item.method?.toLowerCase().includes(q) ||
      item.curlCommand?.toLowerCase().includes(q)
    );
  });

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

        <div className="flex items-center space-x-3">
          {/* User Profile or Google Sign In */}
          {user ? (
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <UserIcon size={16} className="text-zinc-500" />
              )}
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-tight">
                  {user.name || user.email}
                </span>
                <span className="text-[10px] text-zinc-400 leading-none">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="ml-1 p-1 text-zinc-400 hover:text-rose-500 rounded transition cursor-pointer"
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <div ref={googleBtnRef} className="h-9 min-w-[140px]" />
            </div>
          )}

          <div className="h-5 w-px bg-zinc-200 dark:border-zinc-800" />

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

          <button
            onClick={() => setMainTab('history')}
            className={`py-3 flex items-center gap-2 relative transition cursor-pointer ${
              mainTab === 'history'
                ? 'text-zinc-900 dark:text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            <History size={14} />
            <span>History</span>
            {historyList.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {historyList.length}
              </span>
            )}
            {mainTab === 'history' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
            )}
          </button>

          {user?.user?.email === 'abdoerrahiem@gmail.com' && (
            <button
              onClick={() => {
                setMainTab('users');
                if (user?.token) fetchUsersList(user.token);
              }}
              className={`py-3 flex items-center gap-2 relative transition cursor-pointer ${
                mainTab === 'users'
                  ? 'text-zinc-900 dark:text-white font-bold'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <Users size={14} />
              <span>Users</span>
              {usersList.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {usersList.length}
                </span>
              )}
              {mainTab === 'users' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
              )}
            </button>
          )}
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

                <div className="flex justify-end items-center pt-2 gap-2.5">
                  <button
                    onClick={handleAutoCleanCurl}
                    disabled={!rawCurl.trim()}
                    className="h-10 px-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-200 font-semibold text-xs flex items-center gap-2 disabled:opacity-40 transition cursor-pointer"
                    title="Bersihkan log prefix dan rapikan cURL"
                  >
                    <Sparkles size={13} className="text-amber-500" />
                    <span>Format & Clean</span>
                  </button>
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

        {/* ======================= TAB 2: API TESTER VISUAL ======================= */}
        {mainTab === 'tester' && (
          <>
            {/* Left Panel: Request Builder */}
            <div className="flex-1 lg:w-1/2 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col bg-white dark:bg-zinc-900 overflow-y-auto">
              <div className="p-6 space-y-6 flex-1">
                {/* Import cURL quick action */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Request Builder
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setImportCurlModalOpen(!importCurlModalOpen)}
                      className="text-xs px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Sparkles size={12} className="text-amber-500" />
                      <span>Import cURL</span>
                    </button>
                    <button
                      onClick={() => {
                        setUrl('');
                        setHeaders([]);
                        setBody('');
                      }}
                      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1 cursor-pointer"
                      title="Clear builder inputs"
                    >
                      <RotateCcw size={13} /> Clear
                    </button>
                  </div>
                </div>

                {/* Import Modal */}
                {importCurlModalOpen && (
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Paste cURL syntax to parse into form
                      </span>
                      <button
                        onClick={() => setImportCurlModalOpen(false)}
                        className="text-xs text-zinc-400 hover:text-zinc-600"
                      >
                        ✕
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      placeholder="curl -X POST https://api... -H '...' -d '...'"
                      value={importCurlInput}
                      onChange={(e) => setImportCurlInput(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={parseToTesterForm}
                        className="px-4 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs rounded-lg hover:opacity-90"
                      >
                        Parse to Form
                      </button>
                    </div>
                  </div>
                )}

                {/* URL & Method Bar */}
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <div className="relative">
                      <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className={`h-11 px-3.5 rounded-lg border font-mono font-bold text-xs appearance-none pr-8 cursor-pointer focus:outline-none transition ${getMethodBadgeColor(
                          method
                        )}`}
                      >
                        <option
                          value="GET"
                          className="bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 font-semibold"
                        >
                          GET
                        </option>
                        <option
                          value="POST"
                          className="bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 font-semibold"
                        >
                          POST
                        </option>
                        <option
                          value="PUT"
                          className="bg-white dark:bg-zinc-900 text-violet-600 dark:text-violet-400 font-semibold"
                        >
                          PUT
                        </option>
                        <option
                          value="PATCH"
                          className="bg-white dark:bg-zinc-900 text-teal-600 dark:text-teal-400 font-semibold"
                        >
                          PATCH
                        </option>
                        <option
                          value="DELETE"
                          className="bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 font-semibold"
                        >
                          DELETE
                        </option>
                        <option
                          value="HEAD"
                          className="bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 font-semibold"
                        >
                          HEAD
                        </option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-zinc-400">
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </div>
                    </div>

                    <input
                      type="url"
                      placeholder="https://api.domain.com/v1/endpoint"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') executeTesterRequest();
                      }}
                      className="flex-1 h-11 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition"
                    />

                    <button
                      onClick={executeTesterRequest}
                      disabled={testerLoading || !url.trim()}
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
                    className={`pb-3 relative transition cursor-pointer ${
                      subTab === 'headers'
                        ? 'text-zinc-900 dark:text-white font-semibold'
                        : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                    }`}
                  >
                    Headers ({headers.filter((h) => h.key.trim()).length})
                    {subTab === 'headers' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
                    )}
                  </button>

                  <button
                    onClick={() => setSubTab('body')}
                    className={`pb-3 relative transition cursor-pointer ${
                      subTab === 'body'
                        ? 'text-zinc-900 dark:text-white font-semibold'
                        : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                    }`}
                  >
                    Body {['GET', 'HEAD'].includes(method) && <span className="text-[10px] text-zinc-400">(disabled)</span>}
                    {subTab === 'body' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
                    )}
                  </button>

                  <button
                    onClick={() => setSubTab('curl')}
                    className={`pb-3 relative transition cursor-pointer ${
                      subTab === 'curl'
                        ? 'text-zinc-900 dark:text-white font-semibold'
                        : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                    }`}
                  >
                    Generated cURL
                    {subTab === 'curl' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
                    )}
                  </button>
                </div>

                {/* Sub-tab 1: Headers */}
                {subTab === 'headers' && (
                  <div className="space-y-3">
                    {headers.map((h, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          placeholder="Header Name"
                          value={h.key}
                          onChange={(e) => {
                            const next = [...headers];
                            next[i].key = e.target.value;
                            setHeaders(next);
                          }}
                          className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none"
                        />
                        <input
                          placeholder="Value"
                          value={h.value}
                          onChange={(e) => {
                            const next = [...headers];
                            next[i].value = e.target.value;
                            setHeaders(next);
                          }}
                          className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none"
                        />
                        <button
                          onClick={() => setHeaders(headers.filter((_, idx) => idx !== i))}
                          className="p-2 text-zinc-400 hover:text-rose-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setHeaders([...headers, { key: '', value: '' }])}
                      className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1.5 font-medium py-1"
                    >
                      <Plus size={13} /> Add Header
                    </button>
                  </div>
                )}

                {/* Sub-tab 2: Body */}
                {subTab === 'body' && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">JSON / Raw Payload</span>
                      {body && (
                        <button
                          onClick={() => setBody(formatBody(body))}
                          className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                        >
                          Format JSON
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={10}
                      disabled={['GET', 'HEAD'].includes(method)}
                      placeholder={['GET', 'HEAD'].includes(method) ? 'Method ini biasanya tidak memiliki request body.' : '{\n  "key": "value"\n}'}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-40"
                    />
                  </div>
                )}

                {/* Sub-tab 3: Generated cURL */}
                {subTab === 'curl' && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Live cURL Equivalent</span>
                      <button
                        onClick={() => copyToClipboard(generateCurlFromTester())}
                        className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1"
                      >
                        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-xs text-zinc-800 dark:text-zinc-200 overflow-x-auto whitespace-pre-wrap select-all">
                      {generateCurlFromTester()}
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

        {/* ======================= TAB 3: HISTORY ======================= */}
        {mainTab === 'history' && (
          <div className="flex-1 bg-white dark:bg-zinc-900 p-6 flex flex-col overflow-y-auto">
            <div className="max-w-5xl w-full mx-auto space-y-6">
              {/* Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                  <h2 className="text-base font-bold tracking-tight">Request History</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {user
                      ? `Riwayat request tersimpan secara cloud di MySQL untuk akun ${user.email}.`
                      : 'Riwayat sementara di browser. Login dengan Google untuk menyimpan riwayat permanen di akun Anda.'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Cari URL / Method..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="h-9 pl-9 pr-3 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                  </div>

                  {historyList.length > 0 && (
                    <button
                      onClick={clearAllHistory}
                      className="h-9 px-3.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Clear All</span>
                    </button>
                  )}
                </div>
              </div>

              {/* History Items List */}
              {historyLoading ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 text-zinc-400">
                  <div className="w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Memuat riwayat dari MySQL...</span>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 text-zinc-400">
                  <History size={36} className="opacity-30" />
                  <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {historySearch ? 'Tidak ada riwayat yang cocok dengan pencarian.' : 'Belum ada riwayat request.'}
                  </div>
                  <p className="text-xs text-zinc-400 max-w-sm">
                    {user
                      ? 'Setiap request yang kamu jalankan akan otomatis tersinkronisasi ke akun kamu.'
                      : 'Request kamu akan dicatat di browser lokal. Login dengan Google agar tersimpan di cloud database.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredHistory.map((item) => {
                    const curlStr =
                      item.curlCommand ||
                      generateCurlFromTester(item.method, item.url, item.headers || [], item.body || '');

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded font-mono font-bold text-xs border ${getMethodBadgeColor(
                                item.method
                              )}`}
                            >
                              {item.method}
                            </span>
                            <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100 font-semibold break-all">
                              {item.url}
                            </span>
                            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                              via {item.source}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono shrink-0">
                            {item.status && (
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  item.status >= 200 && item.status < 300
                                    ? 'text-emerald-500 bg-emerald-500/10'
                                    : 'text-rose-500 bg-rose-500/10'
                                }`}
                              >
                                {item.status}
                              </span>
                            )}
                            {item.timeMs > 0 && <span>{item.timeMs}ms</span>}
                            <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <button
                              onClick={(e) => deleteHistoryItem(item.id, e)}
                              className="text-zinc-400 hover:text-rose-500 p-1 cursor-pointer transition"
                              title="Delete from history"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* cURL snippet */}
                        <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap max-h-24">
                          {curlStr}
                        </div>

                        {/* Reuse & Copy Action Buttons */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            onClick={() => copyToClipboard(curlStr, item.id)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                          >
                            {copiedId === item.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            <span>{copiedId === item.id ? 'Copied' : 'Copy cURL'}</span>
                          </button>

                          <button
                            onClick={() => loadHistoryToCurl(item)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                            title="Buka kembali di tab cURL"
                          >
                            <Terminal size={12} />
                            <span>Use in cURL</span>
                          </button>

                          <button
                            onClick={() => loadHistoryToTester(item)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                            title="Buka kembali di tab API Tester"
                          >
                            <Sliders size={12} />
                            <span>Use in Tester</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================= TAB 4: USERS (Admin abdoerrahiem@gmail.com Only) ======================= */}
        {mainTab === 'users' && user?.user?.email === 'abdoerrahiem@gmail.com' && (
          <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 overflow-y-auto">
            <div className="max-w-5xl w-full mx-auto p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Users size={18} className="text-zinc-700 dark:text-zinc-300" />
                    Registered Google Users
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Daftar akun Google yang pernah login dan tersinkronisasi di cURL AbdurCodes.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Cari nama atau email..."
                      value={usersSearch}
                      onChange={(e) => setUsersSearch(e.target.value)}
                      className="h-9 pl-9 pr-3 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 w-56 transition"
                    />
                  </div>
                  <button
                    onClick={() => user?.token && fetchUsersList(user.token)}
                    disabled={usersLoading}
                    className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="Refresh data user"
                  >
                    <RotateCcw size={13} className={usersLoading ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Table / List */}
              {usersLoading ? (
                <div className="py-20 flex flex-col items-center justify-center text-zinc-400 text-xs gap-3">
                  <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Memuat daftar pengguna...</span>
                </div>
              ) : usersList.length === 0 ? (
                <div className="py-20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center text-zinc-400 text-xs gap-2">
                  <Users size={32} strokeWidth={1.5} className="text-zinc-300 dark:text-zinc-600" />
                  <p>Belum ada pengguna lain yang terdaftar.</p>
                </div>
              ) : (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-950/80 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold">
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">Pengguna</th>
                        <th className="py-3 px-4">Email Google</th>
                        <th className="py-3 px-4 text-center">Total Requests</th>
                        <th className="py-3 px-4">Terdaftar</th>
                        <th className="py-3 px-4">Aktivitas Terakhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                      {usersList
                        .filter((u) => {
                          if (!usersSearch.trim()) return true;
                          const q = usersSearch.toLowerCase();
                          return (
                            (u.name && u.name.toLowerCase().includes(q)) ||
                            (u.email && u.email.toLowerCase().includes(q))
                          );
                        })
                        .map((u, idx) => (
                          <tr key={u.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition">
                            <td className="py-3.5 px-4 text-center text-zinc-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                {u.avatar ? (
                                  <img
                                    src={u.avatar}
                                    alt={u.name || 'User'}
                                    className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-semibold">
                                    {(u.name || u.email || '?')[0].toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                    <span>{u.name || 'Anonymous User'}</span>
                                    {u.email === 'abdoerrahiem@gmail.com' && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                                        ADMIN
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] font-mono text-zinc-400">ID: {u.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-zinc-700 dark:text-zinc-300">{u.email}</td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                {u.totalRequests || 0}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400 text-[11px]">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                            <td className="py-3.5 px-4 text-zinc-500 dark:text-zinc-400 text-[11px]">
                              {u.lastActive ? new Date(u.lastActive).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
