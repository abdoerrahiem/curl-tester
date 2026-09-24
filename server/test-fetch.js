import { SocksProxyAgent } from 'socks-proxy-agent';

const agent = new SocksProxyAgent('socks5h://127.0.0.1:40000');

async function run() {
  try {
    // In Node 18+, fetch accepts dispatcher or agent (via undici/ProxyAgent or custom)
    // Let's check node-fetch or if we use https.request or axios
    console.log("Testing with native https...");
  } catch (e) {
    console.error(e);
  }
}
run();
