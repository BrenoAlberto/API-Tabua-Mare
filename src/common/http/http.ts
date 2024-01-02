import { BaseHTTP } from './http.interface';

class CommonHTTP extends BaseHTTP {
    async get(url: string, init?: RequestInit) {
        console.log(`Requesting ${url}`)
        return fetch(url, init);
    }

    async post(url: string, body: any, init?: RequestInit) {
        if (!init) {
            init = {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'Content-Type': 'application/json' },
            };
        } else {
            init.method = 'POST'
        }

        console.log(`Requesting ${url}`)

        const request = new Request(url, init);
        return fetch(request);
    }
}

export const http = new CommonHTTP();