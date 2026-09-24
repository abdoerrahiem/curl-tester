import { SocksProxyAgent } from 'socks-proxy-agent';
import { Agent, buildConnector } from 'undici';

// Buat custom dispatcher untuk undici menggunakan SOCKS5 proxy WARP
export function createWarpDispatcher(proxyUrl = 'socks5h://127.0.0.1:40000') {
  const socksAgent = new SocksProxyAgent(proxyUrl);
  
  const connector = buildConnector({
    // Undici connector options
  });

  return new Agent({
    connect(opts, callback) {
      // Delegasikan koneksi socket melalui socks-proxy-agent
      // @ts-ignore
      socksAgent.callback(
        {
          host: opts.host,
          port: opts.port ? Number(opts.port) : (opts.protocol === 'https:' ? 443 : 80),
          protocol: opts.protocol || 'https:',
          path: null,
          method: 'CONNECT'
        },
        (err, socket) => {
          if (err) return callback(err, null);
          return callback(null, socket);
        }
      );
    }
  });
}
