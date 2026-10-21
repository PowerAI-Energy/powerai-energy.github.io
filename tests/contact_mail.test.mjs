import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHmac,randomUUID} from 'node:crypto';
const source=readFileSync(new URL('../scripts/contact_mail.gs',import.meta.url),'utf8');
function service(){
 const state=new Map(),sent=[];let locked=false,now=Date.now(),quota=100;
 const props={getProperty:k=>state.get(k)||null,setProperty(k,v){state.set(k,v);return props},deleteProperty:k=>state.delete(k),getProperties:()=>Object.fromEntries(state)};
 const context=vm.createContext({Date:{now:()=>now},PropertiesService:{getScriptProperties:()=>props},
 Utilities:{getUuid:randomUUID,computeHmacSha256Signature:(v,k)=>[...createHmac('sha256',k).update(v).digest()],base64EncodeWebSafe:v=>Buffer.from(v).toString('base64url')},
 MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:v=>{quota--;sent.push(v)}},LockService:{getScriptLock:()=>({tryLock:()=>{locked=true;return true},hasLock:()=>locked,releaseLock:()=>{locked=false}})},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:v=>({setMimeType:()=>v})}});
 vm.runInContext(source,context);context.configurarServicio();
 const key=state.get('SERVICE_KEY'),email='visitor@example.test';
 const call=payload=>JSON.parse(context.doPost({postData:{contents:JSON.stringify({serviceKey:key,...payload})}}));
 const start=()=>call({action:'start',email,clientHash:'a'.repeat(43)});
 const code=()=>sent.at(-1).body.match(/\b\d{6}\b/)[0];
 const send=(id,pin,mail=email)=>call({action:'verify-send',email:mail,challengeId:id,code:pin,fields:{nombre:'Prueba',mensaje:'Solicitud de prueba'}});
 return {state,sent,key,email,call,start,code,send,advance:ms=>now+=ms,setQuota:value=>quota=value};
}
test('unauthorized callers cannot send any mail',()=>{const s=service();assert.equal(s.call({serviceKey:'wrong',action:'start',email:s.email}).ok,false);assert.equal(s.sent.length,0)});
test('start sends only a code, never delivers the contact request',()=>{const s=service(),r=s.start();assert.equal(r.ok,true);assert.equal(r.expiresIn,600);assert.match(s.code(),/^\d{6}$/);assert.equal(s.sent.length,1);assert.equal(s.sent[0].to,s.email);assert.ok(!JSON.stringify([...s.state]).includes(s.code()))});
test('only matching verified email can send; successful code is single-use',()=>{const s=service(),r=s.start(),pin=s.code();assert.equal(s.send(r.challengeId,pin,'other@example.test').ok,false);assert.equal(s.sent.length,1);assert.equal(s.send(r.challengeId,pin).sent,true);assert.equal(s.sent.length,2);assert.equal(s.sent[1].replyTo,s.email);assert.equal(s.sent[1].to,'PowerAI.Energy@gmail.com');assert.equal(s.send(r.challengeId,pin).ok,false);assert.equal(s.sent.length,2)});
test('wrong attempts are bounded and never send request',()=>{const s=service(),r=s.start(),pin=s.code(),wrong=pin==='000000'?'111111':'000000';for(let i=0;i<6;i++)assert.equal(s.send(r.challengeId,wrong).ok,false);assert.equal(s.send(r.challengeId,pin).ok,false);assert.equal(s.sent.length,1)});
test('expired code and exhausted quota cannot send',()=>{const s=service(),r=s.start(),pin=s.code();s.advance(600001);assert.equal(s.send(r.challengeId,pin).ok,false);assert.equal(s.sent.length,1);s.setQuota(0);assert.equal(s.start().ok,false);assert.equal(s.sent.length,1)});
test('email rate limit stops repeated code requests',()=>{const s=service();for(let i=0;i<3;i++)assert.equal(s.start().ok,true);assert.equal(s.start().ok,false);assert.equal(s.sent.length,3)});

