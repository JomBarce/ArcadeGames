export async function fetchText(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    return await res.text();
}

export async function fetchJson<T>(url: string): Promise<T>{
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch JSON from ${url}: ${res.status} ${res.statusText}`);
    }
    return await res.json();
}