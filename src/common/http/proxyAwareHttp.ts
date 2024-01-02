import ProxyList from '../proxy_list';
import { RetryConfig, retry } from '../../helpers/retry.decorator';
import { BaseHTTP, HTTP } from './http.interface';


class ProxyAwareHTTP extends BaseHTTP {
    constructor(private http: HTTP, private proxyList: ProxyList) {
        super();
    }

    @retry([new RetryConfig(Error, 30, [0, 0.5])])
    async get(url: string) {
        await this.proxyList.loadProxies();
        const requestOptions: RequestInit = {
            method: 'GET',
            ...{ agent: this.proxyList.getProxyAgent() }
        };
        const response = await this.http.get(url, requestOptions);
        return response
    }

    async post(url: string, body: any) {
        const requestOptions: RequestInit = {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
            },
            ...{ agent: this.proxyList.getProxyAgent() }
        };
        return await this.http.post(url, body, requestOptions);
    }
}

export {
    ProxyAwareHTTP
}