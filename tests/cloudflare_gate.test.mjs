import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {handle,createSession,hasSession,localPath} from '../scripts/cloudflare_gate.mjs';
const origin='https://powerai-energy.pages.dev';
const req=(path='/',options={})=>new Request(origin+path,{headers:{'User-Agent':'test-browser',...options.headers},...options});
const env={TURNSTILE_SITE_KEY:'public-test-key',TURNSTILE_SECRET_KEY:'unit-test-secret-not-a-real-key',ASSETS:{fetch:async()=>new Response('protected content')}};
test('unverified visitors cannot get pages, JSON, assets or deep links',async()=>{
 for (const path of ['/','/contacto','/supervision.html','/data/engineering-data.json','/assets/22.png']){
  const r=await worker.fetch(req(path),env,{});
  assert.equal(r.status,200);assert.match(await r.text(),/Verifique que es una persona/);
  assert.match(r.headers.get('Cache-Control'),/no-store/);
 }
});
test('missing configuration fails closed',async()=>{assert.equal((await handle(req(),{})).status,503)});
test('session rejects forgery, expiration and different browser',async()=>{
 const now=Date.now(),token=await createSession(req(),env.TURNSTILE_SECRET_KEY,now);
 const authenticated=(value,ua='test-browser')=>new Request(origin,{headers:{Cookie:'__Host-powerai_human='+value,'User-Agent':ua}});
 assert.equal(await hasSession(authenticated(token),env.TURNSTILE_SECRET_KEY,now),true);
 assert.equal(await hasSession(authenticated(token+'x'),env.TURNSTILE_SECRET_KEY,now),false);
 assert.equal(await hasSession(authenticated(token),env.TURNSTILE_SECRET_KEY,now+1801000),false);
 assert.equal(await hasSession(authenticated(token,'other'),env.TURNSTILE_SECRET_KEY,now),false);
 const r=await handle(authenticated(token),env);
 assert.equal(await r.text(),'protected content');assert.match(r.headers.get('Cache-Control'),/private/);
});
const post=(token='valid-token',headers={})=>req('/__human',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded','User-Agent':'test-browser',...headers},body:new URLSearchParams({'cf-turnstile-response':token,next:'/contacto?from=home'})});
test('server validates hostname and action, then issues secure session',async()=>{
 let calls=0;
 const r=await handle(post(),env,async(url,options)=>{
  calls++;assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(JSON.parse(options.body).secret,env.TURNSTILE_SECRET_KEY);
  return Response.json({success:true,hostname:'powerai-energy.pages.dev',action:'site-entry'});
 });
 assert.equal(calls,1);assert.equal(r.status,303);assert.equal(r.headers.get('Location'),'/contacto?from=home');
 for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert.ok(r.headers.get('Set-Cookie').includes(flag));
});
test('invalid tokens, wrong hostname/action and network failures never grant entry',async()=>{
 for(const result of [{success:false},{success:true,hostname:'attacker.example',action:'site-entry'},{success:true,hostname:'powerai-energy.pages.dev',action:'other'}]){
  const r=await handle(post(),env,async()=>Response.json(result));assert.equal(r.status,403);assert.equal(r.headers.get('Set-Cookie'),null);
 }
 assert.equal((await handle(post(),env,async()=>{throw Error('network')})).status,503);
 assert.equal((await handle(post('',{}),env)).status,403);
 assert.equal((await handle(post('token',{Origin:'https://attacker.example'}),env)).status,403);
});
test('return path cannot redirect outside the site or inject markup',async()=>{
 for(const input of ['//attacker.example','https://attacker.example','/\\attacker.example','/\r\nLocation: x','/__human'])assert.equal(localPath(input,origin),'/');
 assert.equal(localPath('/servicios.html#metodologias',origin),'/servicios.html#metodologias');
 const r=await handle(req('/%22%3E%3Cscript%3E'),env);assert.ok(!(await r.text()).includes('"><script>'));
});
