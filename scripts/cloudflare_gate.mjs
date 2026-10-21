import { contactApi } from './cloudflare_contact.mjs';
// Cloudflare-only entry gate. GitHub Pages keeps serving the original static site.
const COOKIE = '__Host-powerai_human';
const TTL = 30 * 60;
const encoder = new TextEncoder();
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function bytes(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('encoding');
  return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')), c=>c.charCodeAt(0));
}
async function key(secret) {
  return crypto.subtle.importKey('raw', encoder.encode('PowerAI entry session v1:' + secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']);
}
async function browserHash(request) {
  return b64(await crypto.subtle.digest('SHA-256',encoder.encode(request.headers.get('User-Agent') || '')));
}
export async function createSession(request, secret, now = Date.now()) {
  const payload = b64(encoder.encode(JSON.stringify({exp:Math.floor(now/1000)+TTL, ua:await browserHash(request)})));
  return payload + '.' + b64(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(payload)));
}
export async function hasSession(request, secret, now = Date.now()) {
  try {
    const token = (request.headers.get('Cookie') || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
    if (!token || token.length > 1500) return false;
    const parts = token.split('.');
    if (parts.length !== 2 || !await crypto.subtle.verify('HMAC',await key(secret),bytes(parts[1]),encoder.encode(parts[0]))) return false;
    const data = JSON.parse(new TextDecoder().decode(bytes(parts[0])));
    return Number.isInteger(data.exp) && data.exp > Math.floor(now/1000) && data.exp <= Math.floor(now/1000)+TTL && data.ua === await browserHash(request);
  } catch { return false; }
}
export function localPath(value, origin) {
  try {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/';
    const url = new URL(value,origin);
    return url.origin === origin && url.pathname !== '/__human' ? url.pathname+url.search+url.hash : '/';
  } catch { return '/'; }
}
function gate(sitekey, next, message = '', status = 200) {
  const nonce = b64(crypto.getRandomValues(new Uint8Array(18)));
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Verificación de acceso | PowerAI-Energy</title><style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font-family:Arial,sans-serif;background:#edf4f7;color:#102f42}main{width:100%;max-width:520px;background:white;border:1px solid #d9e4e9;border-radius:14px;padding:36px;box-shadow:0 20px 70px #123b4f15}strong{display:block;font-size:20px}small{display:block;color:#587482;line-height:1.6}h1{font-size:30px;line-height:1.15;margin:30px 0 18px}p{line-height:1.6}button{margin:20px 0;padding:14px 22px;border:0;border-radius:6px;background:#e8ae3c;color:#173544;font-size:16px;font-weight:bold;cursor:pointer}button:disabled{opacity:.5;cursor:wait}.error{color:#9a2c19}.widget{min-height:70px;margin:25px 0 0}@media(max-width:420px){main{padding:22px}h1{font-size:27px}}</style><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script></head><body><main><strong>PowerAI-Energy</strong><small>INGENIERÍA · SISTEMAS ELÉCTRICOS DE POTENCIA</small><h1>Verifique que es una persona para ingresar.</h1><p>Complete la comprobación de seguridad de Cloudflare y continúe al sitio.</p>${message?`<p class="error" role="alert">${escape(message)}</p>`:''}<form action="/__human" method="post"><input type="hidden" name="next" value="${escape(next)}"><div class="cf-turnstile widget" data-sitekey="${escape(sitekey)}" data-action="site-entry" data-theme="light" data-language="es" data-callback="verified" data-expired-callback="expired" data-error-callback="expired"></div><button id="continue" type="submit" disabled>Continuar al sitio</button></form><noscript><p>Active JavaScript para completar la verificación.</p></noscript><small>La verificación de acceso dura hasta 30 minutos en este navegador. Si vence, se solicitará nuevamente.</small></main><script nonce="${nonce}">function verified(){document.getElementById('continue').disabled=false}function expired(){document.getElementById('continue').disabled=true}</script></body></html>`, {status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, private','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}' https://challenges.cloudflare.com; style-src 'nonce-${nonce}'; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`}});
}
export async function handle(request, env, verifyFetch = fetch) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/contact')) return contactApi(request, env, verifyFetch);
  if (!env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) return new Response('Verificación temporalmente no disponible. Intente más tarde.',{status:503,headers:{'Cache-Control':'no-store'}});
  if (url.pathname === '/__human' && request.method === 'POST') {
    if (request.headers.get('Origin') !== url.origin) return new Response('Origen no autorizado',{status:403});
    const body = await request.text();
    if (body.length > 8192) return new Response('Solicitud demasiado grande',{status:413});
    const form = new URLSearchParams(body), next = localPath(form.get('next'),url.origin), token = form.get('cf-turnstile-response');
    if (!token || token.length > 2048) return gate(env.TURNSTILE_SITE_KEY,next,'Complete la verificación de Cloudflare.',403);
    try {
      const response = await verifyFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:request.headers.get('CF-Connecting-IP') || undefined}),signal:AbortSignal.timeout(10000)});
      const result = await response.json();
      if (!response.ok || result.success !== true || result.hostname !== url.hostname || result.action !== 'site-entry') return gate(env.TURNSTILE_SITE_KEY,next,'No se pudo validar la comprobación. Intente nuevamente.',403);
      const session = await createSession(request,env.TURNSTILE_SECRET_KEY);
      return new Response(null,{status:303,headers:{Location:next,'Set-Cookie':`${COOKIE}=${session}; Path=/; Max-Age=${TTL}; HttpOnly; Secure; SameSite=Lax`,'Cache-Control':'no-store'}});
    } catch { return gate(env.TURNSTILE_SITE_KEY,next,'El servicio de verificación no respondió. Intente nuevamente.',503); }
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Método no permitido',{status:405});
  if (!await hasSession(request,env.TURNSTILE_SECRET_KEY)) return gate(env.TURNSTILE_SITE_KEY,localPath(url.pathname+url.search,url.origin));
  const asset = await env.ASSETS.fetch(request);
  const response = new Response(asset.body,asset);
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export default {fetch(request, env) { return handle(request, env); }};
