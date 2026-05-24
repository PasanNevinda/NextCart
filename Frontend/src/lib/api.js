import * as Sentry from '@sentry/react';

const raw = import.meta.env.VITE_API_URL;
// remove trailing slashes
const apiBase = typeof raw === "string" ? raw.replace(/\/+$/, "") : "";


//  authenticated fetch request that help to handle token and error logging with Sentry
export async function apiFetch(endpoint, options = {}) {

    const  {getToken, method="GET", body} = options;
    const headers = {
        "Content-Type": "application/json",
    };

    if(getToken) {
        const token = await getToken();
        if(token){
            headers["Authorization"] = `Bearer ${token}`;
        }
    }

    let res;
    try {

        res = await fetch(`${apiBase}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch (error) {
        Sentry.addBreadcrumb({
            category: "api",
            message: `${method} ${endpoint} failed to fetch`,
            level: "error",
            data: { network: true },
        });

        throw error;
    }

    const data = await res.json();

    Sentry.addBreadcrumb({
        category: "api",
        message: `${method} ${endpoint} - ${res.status}`,
        level: res.ok ? "info" : "error",
        data: { status: res.status },
    });

    if(!res.ok){
        const msg = typeof data?.error === "string" ? data.error : res.statusText;
        const err = new Error(typeof msg === "string" ? msg : "API Error");

        if(res.status >= 500){
            Sentry.captureException(err, {
                tags: {"api.fetch": "http", "http.status": String(res.status)},
                extra: { endpoint, method, status: res.status },
            });
        }
        throw err;
    }

    return data;
}