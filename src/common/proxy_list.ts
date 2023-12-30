import ProxyLists from 'proxy-lists';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { RetryConfig, retry } from '../helpers/retry.decorator';
import { JSONStorage } from './json_storage';

class ProxyList {
    private proxies: ProxyLists.Proxy[] = [];
    private currentProxyIndex = 0;
    private shouldContinue = true;

    constructor(
        private readonly jsonStorage: JSONStorage = new JSONStorage()
    ) { }

    isProxyListLoaded() {
        if (this.proxies.length > 0) return true;
        const cachedProxies = this.getCachedProxies();
        if (cachedProxies) {
            this.proxies = cachedProxies;
            return true;
        }
        return false;
    }

    getCachedProxies(
        maxAgeMinutes: number = Infinity // 400 ; lets keep infinity while CPU usage problem is not solved
    ) {
        const cachedProxies = this.jsonStorage.getData('proxy-lists', 'proxies.json');
        if (!cachedProxies) return null;

        const now = new Date();
        const cachedDate = new Date(cachedProxies.date);
        const diffMinutes = Math.round((now.getTime() - cachedDate.getTime()) / 60000);
        if (diffMinutes > maxAgeMinutes) return null;

        return cachedProxies.proxies;
    }

    cacheProxies() {
        this.jsonStorage.saveData('proxy-lists', 'proxies.json', {
            date: new Date(),
            proxies: this.proxies
        });
    }

    @retry([new RetryConfig(Error, 5, [0, 0.5])]) // TODO: this may not be needed, check if proxy-lists already retries
    async loadProxies() {

        // TODO: serious CPU usage here; events being emitted too fast in a seemingly infinite loop; this lib is kinda bad or I'm using it wrong
        return;
        if (this.isProxyListLoaded()) return;


        await new Promise<void>((resolve, reject) => {
            let proxyEmitter = ProxyLists.getProxies(
                {
                    countries: ['br'],
                    // @ts-expect-error
                    requestQueue: {
                        concurrency: 1,
                        proxyRequestTimeout: 500,
                    }
                }
            );

            proxyEmitter.on('data', proxies => {
                if (!this.shouldContinue) {
                    proxyEmitter.removeAllListeners();
                    return;
                }

                this.proxies.push(...proxies);
                if (this.proxies.length >= 30) {
                    proxyEmitter.emit('end');
                }
            });

            proxyEmitter.once('end', () => {
                this.cacheProxies();
                proxyEmitter.removeAllListeners('data');
                proxyEmitter.removeAllListeners('error');
                // @ts-expect-error
                proxyEmitter = null;
                this.shouldContinue = false;
                resolve();
            });

            proxyEmitter.once('error', (error) => {
                reject(error);
            });
        });

        this.shouldContinue = false;
    }

    getCurrentProxy() {
        if (this.proxies.length === 0) return null;
        const proxy = this.proxies[this.currentProxyIndex];
        return `http://${proxy.ipAddress}:${proxy.port}`;
    }

    switchToNextProxy() {
        if (this.proxies.length > 0) {
            this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
        }
    }

    getProxyAgent() {
        const proxyUrl = this.getCurrentProxy();
        if (!proxyUrl) return null;
        return new HttpsProxyAgent(proxyUrl);
    }
}

export default ProxyList;
