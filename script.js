const menuToggle=document.querySelector('.menu-toggle'),navLinks=document.querySelector('#nav-links');
menuToggle?.addEventListener('click',()=>{const open=navLinks.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open))});
document.querySelectorAll('#nav-links a').forEach(link=>link.addEventListener('click',()=>{navLinks?.classList.remove('open');menuToggle?.setAttribute('aria-expanded','false')}));
const year=document.querySelector('#year'); if(year) year.textContent=new Date().getFullYear();
const form=document.querySelector('#contact-form');
form?.addEventListener('submit',()=>{
  const d=new FormData(form);
  try {
    sessionStorage.setItem('powerai_contact_pending',JSON.stringify({
      nombre:d.get('nombre')||'',empresa:d.get('empresa')||'',email:d.get('email')||'',tension:d.get('tension')||'',servicio:d.get('servicio')||'',mensaje:d.get('mensaje')||''
    }));
  } catch(e) {}
});