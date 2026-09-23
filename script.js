const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('#nav-links');

menuToggle?.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
});

document.querySelectorAll('#nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  });
});

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

document.querySelector('#year').textContent = new Date().getFullYear();

const CONTACT_PHONE = '573503513300';
const form = document.querySelector('#contact-form');
form?.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const nombre = String(data.get('nombre') || '').trim();
  const empresa = String(data.get('empresa') || '').trim();
  const email = String(data.get('email') || '').trim();
  const mensaje = String(data.get('mensaje') || '').trim();
  const text = [
    'Solicitud de servicios — PowerAI-Energy',
    `Nombre: ${nombre}`,
    empresa ? `Empresa: ${empresa}` : '',
    `Correo: ${email}`,
    `Necesidad: ${mensaje}`
  ].filter(Boolean).join('\n');
  const url = `https://wa.me/${CONTACT_PHONE}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
});