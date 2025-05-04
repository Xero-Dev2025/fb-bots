const config = {
    useProxies: false,       // Set true or false to use proxies
    port: 9090,              // WebSocket server port
    useProxiesPlusIp: true,  // If proxies are missing to complete the max of bots, your IP will be used to fill the missing spaces.
    useProxyScrape: false,   // Set to true to enable proxy scraping
    proxyTimeout: 2000,     // Timeout in ms for proxy scraping
    proxyProtocol: "http"    // Protocol for proxy scraping (http/socks4/socks5)
};
module.exports = config;