import { SocksProxyAgent } from 'socks-proxy-agent';
import { Agent, request } from 'undici';

const socksAgent = new SocksProxyAgent('socks5h://127.0.0.1:40000');

// Test using native fetch with dispatcher or undici / node http
import http from 'http';
import https from 'https';

https.get('https://cloudflare.com/cdn-cgi/trace', { agent: socksAgent }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("RESPONSE VIA WARP SOCKS5:");
    console.log(data);
  });
}).on('error', (err) => {
  console.error("ERROR:", err);
});
