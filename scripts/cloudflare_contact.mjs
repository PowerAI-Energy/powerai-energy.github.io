const ORIGINS = new Set(['https://powerai-energy.pages.dev','https://powerai-energy.github.io']);
function reply(origin,body,status=200) {
  return Response.json(body,{status,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'private, no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'}});
}
export async function contactApi(request,env,serviceFetch=fetch) {
  const url=new URL(request.url),origin=request.headers.get('Origin') || url.origin;
  if(!ORIGINS.has(origin))return new Response('Origen no permitido',{status:403});
  if(request.method==='OPTIONS')return reply(origin,{ok:true});
  if(request.method==='GET' && url.pathname==='/api/contact/config')return reply(origin,{sitekey:env.TURNSTILE_SITE_KEY});
  if(request.method!=='POST' || url.pathname!=='/api/contact')return reply(origin,{ok:false,error:'Método no permitido.'},405);
  if(!env.MAIL_SERVICE_URL || !env.MAIL_SERVICE_KEY)return reply(origin,{ok:false,error:'La verificación de correo todavía no está disponible. Intente más tarde.'},503);
  if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))return reply(origin,{ok:false,error:'Utilice el formulario con JavaScript habilitado.'},415);
  try {
    const reader=request.body?.getReader();let size=0,chunks=[];
    if(!reader)return reply(origin,{ok:false,error:'Solicitud vacía.'},400);
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>20000){await reader.cancel();return reply(origin,{ok:false,error:'Solicitud demasiado grande.'},413)}chunks.push(part.value)}
    const merged=new Uint8Array(size);let pos=0;for(const c of chunks){merged.set(c,pos);pos+=c.length}
    const data=JSON.parse(new TextDecoder().decode(merged));
    if(typeof data.email!=='string' || data.email.length>254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email))return reply(origin,{ok:false,error:'Indique un correo válido.'},400);
    if(data.action!=='start' && data.action!=='verify-send')return reply(origin,{ok:false,error:'Operación no permitida.'},400);
    if(data.action==='start'){
      if(typeof data.token!=='string' || !data.token || data.token.length>2048)return reply(origin,{ok:false,error:'Complete la verificación de Cloudflare.'},403);
      const verified=await serviceFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:data.token,remoteip:request.headers.get('CF-Connecting-IP')||undefined}),signal:AbortSignal.timeout(10000)});
      const check=await verified.json();
      if(!verified.ok || check.success!==true || check.hostname!==new URL(origin).hostname || check.action!=='contact-start')return reply(origin,{ok:false,error:'No se pudo validar la comprobación de Cloudflare.'},403);
    }
    const serviceUrl=new URL(env.MAIL_SERVICE_URL);
    if(serviceUrl.origin!=='https://script.google.com' || !serviceUrl.pathname.endsWith('/exec'))return reply(origin,{ok:false,error:'Servicio de correo no configurado.'},503);
    // Only a hash reaches the mail service; do not store visitor IPs in Apps Script.
    const hmac=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.MAIL_SERVICE_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const digest=await crypto.subtle.sign('HMAC',hmac,new TextEncoder().encode(request.headers.get('CF-Connecting-IP')||'unknown'));
    const clientHash=btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const payload={serviceKey:env.MAIL_SERVICE_KEY,action:data.action,email:data.email,clientHash};
    if(data.action==='verify-send')Object.assign(payload,{challengeId:data.challengeId,code:data.code,fields:data.fields});
    const response=await serviceFetch(serviceUrl.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'follow',signal:AbortSignal.timeout(25000)});
    if(!response.ok)return reply(origin,{ok:false,error:'El servicio de correo no respondió. Intente más tarde.'},502);
    const result=await response.json();
    if(result.ok!==true)return reply(origin,{ok:false,error:typeof result.error==='string'?result.error:'No se pudo completar la operación.'},400);
    if(data.action==='start' && typeof result.challengeId==='string')return reply(origin,{ok:true,challengeId:result.challengeId,expiresIn:600});
    if(data.action==='verify-send' && result.sent===true)return reply(origin,{ok:true,sent:true});
    return reply(origin,{ok:false,error:'Respuesta de correo inválida.'},502);
  }catch{return reply(origin,{ok:false,error:'No se pudo completar la verificación. Intente nuevamente.'},503)}
}
