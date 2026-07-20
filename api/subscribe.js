/**
 * Serverless subscribe endpoint — scaffolding for Web Push (Feature 17).
 *
 * Deploy as a Netlify Function (place at /api/subscribe.js and set
 * `functions = "api"` in netlify.toml) or a Vercel Edge Function.
 *
 * This handler receives a PushSubscription from the browser and stores it.
 * For production you would persist to a database/KV and wire a real
 * push-send backend (e.g. `web-push`) to actually deliver notifications.
 *
 * NOTE: VAPID_PUBLIC_KEY (client) + a matching VAPID_PRIVATE_KEY (server env)
 * must be set before real push works. This endpoint is a safe placeholder.
 */

// ---- Netlify Functions style (Node) ----
// Export `handler` for Netlify. For Vercel Edge, remove this block and use the
// `export const config` + `export default async (req)` form at the bottom.

const SUBSCRIPTIONS = []; // in-memory placeholder; replace with DB/KV in prod

export async function handler(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    try {
        const sub = JSON.parse(event.body);
        if (!sub || !sub.endpoint) {
            return { statusCode: 400, body: 'Invalid subscription' };
        }
        // Avoid duplicate endpoints (demo dedup)
        if (!SUBSCRIPTIONS.some((s) => s.endpoint === sub.endpoint)) {
            SUBSCRIPTIONS.push(sub);
        }
        console.log('[subscribe] stored subscription for', sub.endpoint);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: true, count: SUBSCRIPTIONS.length })
        };
    } catch (err) {
        console.error('[subscribe] error', err);
        return { statusCode: 500, body: 'Server error' };
    }
}

/*
// ---- Vercel Edge Function style (uncomment, remove `handler` above) ----
export const config = { runtime: 'edge' };
const SUBS = [];
export default async function (req) {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    try {
        const sub = await req.json();
        if (!sub || !sub.endpoint) return new Response('Invalid', { status: 400 });
        SUBS.push(sub);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    } catch (e) {
        return new Response('Server error', { status: 500 });
    }
}
*/
