(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const endpoint = 'https://powerai-energy.pages.dev/api/contact';
  const email = form.elements.namedItem('email');
  const submit = form.querySelector('button[type="submit"]');
  let challengeId = '', verifiedEmail = '', token = '', widget = null, busy = false;
  const panel = document.createElement('div');
  panel.className = 'contact-verification';
  panel.innerHTML = '<p>Antes de enviar su solicitud, verificaremos su correo con un código de seguridad.</p><div id="contact-human-check"></div><div id="contact-code-panel" hidden><label>Código de seguridad<input id="contact-email-code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="Código de 6 dígitos"></label><small>El código vence en 10 minutos. Su solicitud aún no se ha enviado.</small><button type="button" class="btn" id="contact-change-email">Cambiar correo o solicitar otro código</button></div><p id="contact-verify-status" role="status" aria-live="polite"></p>';
  submit.before(panel);
  const status = panel.querySelector('#contact-verify-status');
  const codePanel = panel.querySelector('#contact-code-panel');
  const code = panel.querySelector('#contact-email-code');
  const human = panel.querySelector('#contact-human-check');
  submit.textContent = 'Enviar código de seguridad';
  submit.disabled = true;
  function message(text, error = false) { status.textContent = text; status.style.color = error ? '#9a2c19' : ''; }
  function reset() {
    challengeId = ''; verifiedEmail = ''; token = ''; email.readOnly = false; code.value = ''; code.required = false;
    codePanel.hidden = true; human.hidden = false; submit.textContent = 'Enviar código de seguridad'; submit.disabled = true;
    if (widget !== null && window.turnstile) window.turnstile.reset(widget);
  }
  panel.querySelector('#contact-change-email').addEventListener('click', () => { if (!busy) { reset(); message('Complete la comprobación para solicitar un nuevo código.'); email.focus(); } });
  async function call(payload) {
    const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(35000)});
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'No se pudo completar la operación.');
    return result;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    busy = true; submit.disabled = true;
    try {
      if (!challengeId) {
        if (!token) throw new Error('Complete la comprobación de Cloudflare.');
        message('Enviando código de seguridad…');
        const result = await call({action:'start',email:email.value.trim(),token});
        challengeId = result.challengeId; verifiedEmail = email.value.trim(); email.readOnly = true;
        codePanel.hidden = false; code.required = true; human.hidden = true;
        submit.textContent = 'Verificar código y enviar solicitud';
        message('Enviamos el código a '+verifiedEmail+'. Revise también la carpeta de correo no deseado.');
        code.focus();
      } else {
        if (email.value.trim() !== verifiedEmail) throw new Error('El correo cambió. Solicite un código nuevo.');
        message('Verificando código y enviando solicitud…');
        const fields = {};
        for (const name of ['nombre','empresa','tension','servicio','mensaje']) fields[name] = String(form.elements.namedItem(name)?.value || '');
        const result = await call({action:'verify-send',email:verifiedEmail,challengeId,code:code.value.trim(),fields});
        if (result.sent !== true) throw new Error('No se confirmó el envío.');
        try { sessionStorage.setItem('powerai_contact_pending',JSON.stringify({...fields,email:verifiedEmail})); } catch {}
        window.location.assign(new URL('gracias.html',window.location.href).href);
      }
    } catch (error) {
      message(error.message || 'No se pudo completar la verificación.',true);
      if (!challengeId && widget !== null) { token='';window.turnstile.reset(widget); }
    } finally { busy=false; submit.disabled = !challengeId && !token; }
  });
  (async () => {
    try {
      const response = await fetch(endpoint+'/config', {signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw Error();
      const config = await response.json();
      if (!config.sitekey) throw Error();
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => {
        widget = window.turnstile.render(human, {sitekey:config.sitekey,action:'contact-start',theme:'light',language:'es',
          callback(value) {token=value;submit.disabled=busy;},
          'expired-callback'() {token='';if(!challengeId)submit.disabled=true;},
          'error-callback'() {token='';if(!challengeId)submit.disabled=true;message('No se pudo completar la comprobación. Recargue e intente nuevamente.',true);}
        });
      };
      script.onerror = () => message('No se pudo cargar la comprobación. Recargue e intente nuevamente.',true);
      document.head.append(script);
    } catch {message('La verificación de correo no está disponible temporalmente. Intente más tarde.',true);}
  })();
})();
