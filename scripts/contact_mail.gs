/** PowerAI-Energy: send an email code before delivering a contact request.
 * Private Apps Script properties hold SERVICE_KEY and OTP state.
 * This project does not read the inbox or contacts. */
function configurarServicio() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SERVICE_KEY')) props.setProperty('SERVICE_KEY', Utilities.getUuid() + Utilities.getUuid());
  props.setProperty('RECIPIENT', 'PowerAI.Energy@gmail.com');
  return 'Servicio preparado. Cuota restante: ' + MailApp.getRemainingDailyQuota();
}
function doGet() { return json_({ok:false,error:'Use el formulario oficial de PowerAI-Energy.'}); }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function same_(a,b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  var diff=0;for(var i=0;i<a.length;i++) diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
function digest_(value,secret) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(value,secret)).replace(/=+$/,''); }
function email_(value) {
  if(typeof value!=='string' || value.length>254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) throw Error('Indique un correo válido.');
  return value.trim().toLowerCase();
}
function cleanup_(props,now) {
  var values=props.getProperties();Object.keys(values).forEach(function(key){
    if(key.indexOf('OTP_')===0 || key.indexOf('RATE_')===0){try{if(JSON.parse(values[key]).exp<=now)props.deleteProperty(key);}catch(e){props.deleteProperty(key);}}
  });
}
function rate_(props,key,limit,now) {
  var name='RATE_'+key,value=JSON.parse(props.getProperty(name)||'null');
  if(!value || value.exp<=now)value={count:0,exp:now+3600000};
  if(value.count>=limit)throw Error('Ha alcanzado el límite temporal. Intente más tarde.');
  value.count++;props.setProperty(name,JSON.stringify(value));
}
function fields_(input,email) {
  if(!input || typeof input!=='object')throw Error('Falta la solicitud.');
  var limits={nombre:160,empresa:200,tension:120,servicio:250,mensaje:6000},output={email:email};
  Object.keys(limits).forEach(function(key){
    if(input[key]!=null && typeof input[key]!=='string')throw Error('Solicitud inválida.');
    output[key]=String(input[key]||'').trim();if(output[key].length>limits[key])throw Error('Un campo excede la longitud permitida.');
  });
  if(!output.nombre || !output.mensaje)throw Error('Complete nombre y descripción.');
  return output;
}
function doPost(e) {
  var lock=LockService.getScriptLock();
  try {
    if(!e || !e.postData || e.postData.contents.length>16000)return json_({ok:false,error:'Solicitud inválida.'});
    var data=JSON.parse(e.postData.contents),props=PropertiesService.getScriptProperties(),secret=props.getProperty('SERVICE_KEY');
    if(!secret || !same_(data.serviceKey,secret))return json_({ok:false,error:'Acceso no autorizado.'});
    if(!lock.tryLock(5000))return json_({ok:false,error:'Servicio ocupado. Intente nuevamente.'});
    var now=Date.now();cleanup_(props,now);var email=email_(data.email);
    if(data.action==='start') {
      if(typeof data.clientHash!=='string' || !/^[A-Za-z0-9_-]{30,100}$/.test(data.clientHash))throw Error('Solicitud inválida.');
      if(MailApp.getRemainingDailyQuota()<10)throw Error('El servicio de correo alcanzó su límite diario. Intente más tarde.');
      rate_(props,digest_('email:'+email,secret),3,now);rate_(props,'client:'+data.clientHash,5,now);
      var id=Utilities.getUuid(),random=Utilities.computeHmacSha256Signature(Utilities.getUuid()+Utilities.getUuid(),secret);
      var n=((random[0]&255)*16777216+(random[1]&255)*65536+(random[2]&255)*256+(random[3]&255))%1000000;
      var code=String(n).padStart(6,'0');
      props.setProperty('OTP_'+id,JSON.stringify({email:email,hash:digest_(id+':'+email+':'+code,secret),exp:now+30000,attempts:0}));
      try{MailApp.sendEmail({to:email,subject:'Su código de seguridad — PowerAI-Energy',body:'Su código de seguridad es: '+code+'\n\nVence en 30 segundos y solo puede usarse una vez. Escríbalo en el formulario de PowerAI-Energy para enviar su solicitud.\n\nSi no solicitó este código, ignore este mensaje. No comparta el código con otras personas.',name:'PowerAI-Energy'});}catch(error){props.deleteProperty('OTP_'+id);throw Error('No se pudo enviar el código. Intente más tarde.');}
      return json_({ok:true,challengeId:id,expiresIn:30});
    }
    if(data.action==='verify-send') {
      if(typeof data.challengeId!=='string' || !/^[a-f0-9-]{36}$/.test(data.challengeId) || typeof data.code!=='string' || !/^\d{6}$/.test(data.code))throw Error('Revise el código de seis dígitos.');
      var name='OTP_'+data.challengeId,entry=JSON.parse(props.getProperty(name)||'null');
      if(!entry || entry.exp<=now || entry.email!==email)throw Error('El código venció o no corresponde al correo. Solicite uno nuevo.');
      entry.attempts++;
      if(entry.attempts>5){props.deleteProperty(name);throw Error('Demasiados intentos. Solicite un código nuevo.');}
      if(!same_(entry.hash,digest_(data.challengeId+':'+email+':'+data.code,secret))){props.setProperty(name,JSON.stringify(entry));throw Error('Código incorrecto. Revíselo e intente nuevamente.');}
      var fields=fields_(data.fields,email);
      if(MailApp.getRemainingDailyQuota()<1)throw Error('El servicio de correo alcanzó su límite diario. Intente más tarde.');
      // Consume before sending: replay cannot deliver the request twice.
      props.deleteProperty(name);
      var text='SOLICITUD TÉCNICA — CORREO DEL REMITENTE VERIFICADO\n\n'+Object.keys(fields).map(function(key){return key.toUpperCase()+': '+fields[key];}).join('\n\n');
      try{MailApp.sendEmail({to:props.getProperty('RECIPIENT'),subject:'Nueva solicitud técnica — PowerAI-Energy',body:text,replyTo:email,name:'PowerAI-Energy'});}catch(error){throw Error('No se pudo confirmar el envío. Solicite un código nuevo antes de reintentar.');}
      return json_({ok:true,sent:true});
    }
    throw Error('Operación no permitida.');
  } catch(error){return json_({ok:false,error:String(error.message||'No se pudo completar la operación.')});}
  finally {if(lock.hasLock())lock.releaseLock();}
}
