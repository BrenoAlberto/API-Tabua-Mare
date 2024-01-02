import fs from 'fs';
import path from 'path';

class CacheAwareHttp {
    private readonly snapshots_dir: string = path.join(
        __dirname, '..', '..', 'snapshots'
    );

    constructor() { }

    async get(url: string, init?: RequestInit) {
        console.log(`Requesting ${url}`)
        const request = new Request(url, init);

        const cachedResponse = this.getCachedResponse(request, 1440 * 4)
        if (cachedResponse) {
            console.log(`Response Cached: ${cachedResponse.status}`)
            return cachedResponse
        }

        await this.saveRequestData(request)
        const response = await fetch(request)
        await this.saveResponseData(response)
        console.log(`Response status: ${response.status}`)
        return response
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

        const request = new Request(url, init);
        await this.saveRequestData(request);
        const response = await fetch(request);
        await this.saveResponseData(response);
        return response;
    }

    private getCachedResponse(
        request: Request, maxAgeInMinutes: number
    ): Response | null {
        const sanitizedUrl = this.sanitizeUrl(request.url);
        const currentDate = new Date();
        const snapshotsPath = path.join(
            this.snapshots_dir, this.formatDate(currentDate), sanitizedUrl
        );

        if (!fs.existsSync(snapshotsPath)) {
            return null;
        }

        const files = fs.readdirSync(snapshotsPath);
        for (const file of files) {
            if (file.endsWith('-response.json')) {
                const filePath = path.join(snapshotsPath, file);
                const fileStats = fs.statSync(filePath);
                const fileDate = new Date(fileStats.mtime);

                const ageInMinutes = (
                    currentDate.getTime() - fileDate.getTime()
                ) / (1000 * 60);
                if (ageInMinutes <= maxAgeInMinutes) {
                    const response = JSON.parse(
                        fs.readFileSync(filePath, 'utf8')
                    );
                    if (response.status >= 200 && response.status < 300) {
                        return new Response(response.body, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers,
                        });
                    }
                }
            }
        }

        return null;
    }


    private formatDate(date: Date): string {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${year}-${month}-${day}`;
    }

    private formatTime(date: Date): string {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${hours}-${minutes}-${seconds}`;
    }

    private sanitizeUrl(url: string): string {
        // Replace invalid path characters with '_'
        return url.replace(/[^a-zA-Z0-9\-_\.]/g, '_');
    }

    private getFileExtension(contentType: string): string {
        if (contentType.includes('html')) {
            return '.html';
        } else if (contentType.includes('json')) {
            return '.json';
        } else if (contentType.includes('text')) {
            return '.txt';
        } else if (contentType.includes('xml')) {
            return '.xml';
        } else if (contentType.includes('image')) {
            return '.png';
        } else if (contentType.includes('pdf')) {
            return '.pdf';
        }
        throw new Error(`Unknown content type: ${contentType}`);
    }

    private async saveData(folder: string, filename: string, data: any) {
        const dirPath = path.join(this.snapshots_dir, folder);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        const filePath = path.join(dirPath, filename);
        if (filePath.endsWith('.pdf')) {
            fs.writeFileSync(filePath, data, 'binary');
        }
        else fs.writeFileSync(filePath, data);

        console.log(`Saved ${filePath}`);
    }

    private async saveRequestData(request: Request) {
        const date = new Date();
        const folder = this.formatDate(date) + '/' + this.sanitizeUrl(request.url);
        const filename = this.formatTime(date) + '-request.json';
        const requestData = {
            url: request.url,
            method: request.method,
            headers: [...request.headers],
            body: request.body ? await request.text() : null,
            timestamp: date.toISOString(),
        };
        await this.saveData(
            folder, filename, JSON.stringify(requestData, null, 2)
        );
    }

    private async saveResponseData(response: Response) {
        const date = new Date();
        const folder = this.formatDate(date) + '/' + this.sanitizeUrl(response.url);
        const filenamePrefix = this.formatTime(date);
        const responseData = {
            url: response.url,
            status: response.status,
            statusText: response.statusText,
            headers: [...response.headers],
            timestamp: date.toISOString(),
            body: null as string | Buffer | null,
        };
        const contentType = response.headers.get('Content-Type') || '';
        const extension = this.getFileExtension(contentType);
        const contentFilename = `${filenamePrefix}-content${extension}`;

        const clone = response.clone();
        const body = extension === '.pdf' ?
            Buffer.from(await clone.arrayBuffer()) :
            await clone.text();

        responseData.body = body.slice(0, 1024 * 1024);
        await this.saveData(
            folder, contentFilename, body
        );

        await this.saveData(
            folder,
            `${filenamePrefix}-response.json`,
            JSON.stringify(responseData, null, 2)
        );
    }
}

export const cacheAwareHttp = new CacheAwareHttp();