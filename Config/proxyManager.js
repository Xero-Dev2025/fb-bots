const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');
const https = require('https');
const config = require('./config');

class ProxyManager {
    constructor() {
        this.proxies = [];
        this.currentIndex = 0;
        this.initializeProxies();
    }

    async initializeProxies() {
        if (config.useProxyScrape) {
            console.log('\x1b[33m[⟳] Starting Scrape...\x1b[0m');
            await this.scrapeProxies();
        } 
        else if (config.useProxies) {
            this.loadProxiesFromFile();
        } 
        else {
            console.log('\x1b[33m[!] Proxy disabled\x1b[0m');
            console.log('\x1b[33m[!] Recommended quantity without proxy 100-150\x1b[0m');
        }
    }
    
    loadProxiesFromFile() {
        try {
            const proxyFile = path.join(__dirname, 'proxies.txt');
            const proxyData = fs.readFileSync(proxyFile, 'utf8');
            this.proxies = proxyData.split('\n')
                .map(line => line.trim())
                .filter(line => line && /\d+\.\d+\.\d+\.\d+:\d+/.test(line));
                console.log('');
            console.log(`\x1b[32m[✓] Loaded ${this.proxies.length} proxies from proxies.txt\x1b[0m`);
            
            if (config.useProxiesPlusIp && this.proxies.length > 0) {
                console.log(`\x1b[32m[✓] Using hybrid mode: ${this.proxies.length} proxies + your IP for remaining bots\x1b[0m`);
            }
        } catch (error) {
            console.error('\x1b[31m[×] Error loading proxies.txt:', error.message, '\x1b[0m');
            this.proxies = [];
        }
    }
    
    scrapeProxies() {
        return new Promise((resolve) => {
            const timeout = config.proxyTimeout || 10000;
            const protocol = config.proxyProtocol || 'http';
            const url = `https://api.proxyscrape.com/v2/?request=displayproxies&protocol=${protocol}&timeout=${timeout}&country=all&ssl=all&anonymity=all`;
            
            https.get(url, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        const newProxies = data.split('\n')
                            .map(line => line.trim())
                            .filter(line => line && /\d+\.\d+\.\d+\.\d+:\d+/.test(line));
                        
                        if (newProxies.length > 0) {
                            this.proxies = newProxies;
                            
                            try {
                                fs.writeFileSync(path.join(__dirname, 'scrapped.txt'), this.proxies.join('\n'));
                            } catch (err) {
                                console.error('\x1b[31m[×] Error saving current proxy log:', err.message, '\x1b[0m');
                            }
                            
                            console.log(`\x1b[32m[✓] Successful scrape: ${newProxies.length} proxies obtained\x1b[0m`);
                            
                            if (config.useProxiesPlusIp && this.proxies.length > 0) {
                                console.log(`\x1b[32m[✓] Using hybrid mode: ${this.proxies.length} proxies + your IP for remaining bots\x1b[0m`);
                            }
                        } else {
                            console.log('\x1b[33m[!] ProxyScrape did not return valid proxies\x1b[0m');
                            
                            if (config.useProxies) {
                                this.loadProxiesFromFile();
                            }
                        }
                    } else {
                        console.error(`\x1b[31m[×] Error in ProxyScrape: Status ${res.statusCode}\x1b[0m`);
                        
                        if (config.useProxies) {
                            this.loadProxiesFromFile();
                        }
                    }
                    resolve();
                });
            }).on('error', (err) => {
                console.error('\x1b[31m[×] Error connecting to ProxyScrape:', err.message, '\x1b[0m');
                
                if (config.useProxies) {
                    this.loadProxiesFromFile();
                }
                resolve();
            });
        });
    }

    getNextProxy(botId) {
        // If hybrid mode is enabled and we've used all proxies, return null for direct connection
        if (config.useProxiesPlusIp && botId > this.proxies.length) {
            return null;
        }
        
        // If no proxies or not using proxies, return null
        if (this.proxies.length === 0) return null;
        
        // Get the next proxy from the rotation
        const proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy;
    }

    configureWebSocketOptions(proxy) {
        const wsOptions = {
            headers: {
                'Accept-Encoding': "gzip, deflate, br",
                'Pragma': "no-cache",
                'Origin': "https://agar.io",
                'Accept-Language': "en-US,en;q=0.9",
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                'Upgrade': 'websocket',
                'Sec-WebSocket-Key': "randomly-generated-sec-websocket-key",
                'Cache-Control': "no-cache",
                'Connection': 'Upgrade',
                'Sec-WebSocket-Version': '13'
            }
        };

        if (proxy) {
            const [ip, port] = proxy.split(':');
            const proxyUrl = `http://${ip}:${port}`;
            wsOptions.agent = new HttpsProxyAgent(proxyUrl);
        }

        return wsOptions;
    }
}

module.exports = ProxyManager;