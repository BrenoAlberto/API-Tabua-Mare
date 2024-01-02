// #TODO: Why use abstractions when you're coupling them to fetch?

interface HTTP {
    get(url: string, init?: RequestInit): Promise<Response>;
    post(url: string, body: any, init?: RequestInit): Promise<Response>;
}

abstract class BaseHTTP implements HTTP {
    abstract get(url: string, init?: RequestInit): Promise<Response>;
    abstract post(url: string, body: any, init?: RequestInit): Promise<Response>;
}

export {
    HTTP,
    BaseHTTP
}