# Acceso humano en Cloudflare y consulta automática de XM

La compilación `python3 scripts/build_cloudflare.py` incorpora `scripts/cloudflare_gate.mjs` como `dist/_worker.js`. GitHub Pages conserva el sitio estático independiente; no ejecuta este Worker.

## Verificación humana

En producción se requieren `TURNSTILE_SITE_KEY` (pública) y `TURNSTILE_SECRET_KEY` (secreto cifrado de Pages). No copiar el secreto al repositorio. El widget administrado admite `powerai-energy.pages.dev` y `powerai-energy.github.io`; Cloudflare decide cuándo requiere interacción. No existe aquí un ajuste que garantice un acertijo de máxima dificultad para cada visita.

El Worker valida el token con Siteverify, exige el hostname de la petición y la acción `site-entry`, y solo entonces concede una cookie firmada de hasta 30 minutos, HttpOnly, Secure y vinculada al navegador. Sin sesión válida no entrega HTML, JSON ni imágenes. Las respuestas son privadas y no almacenables. El modo de agotamiento de cuota de Pages debe ser **Fail closed**; no activar pagos. Las funciones consumen la cuota gratuita de Workers, compartida con otros proyectos.

Pruebas: `node --test tests/cloudflare_gate.test.mjs`. Cubren acceso directo sin sesión, tokens falsos, host/acción incorrectos, vencimiento, cambio de navegador, error de red y redirecciones externas.

## XM automático

El workflow `.github/workflows/engineering-data.yml` se ejecuta cada hora (`17 * * * *`), además de manualmente y por cambios del colector. No depende de un PC encendido. Comando del colector: `python scripts/update_engineering_data.py`. Instalar antes `requirements-feeds.txt` con los hashes indicados en README.

La consulta incluye el día actual y selecciona la última observación numérica que devuelve la fuente. No reemplaza la fecha de una observación con la fecha de consulta. El 21/10/2026 se consultó directamente `https://servapibi.xm.com.co/hourly`, del 18 al 21 de octubre, para `DemaReal` y `Gene`: ambas devolvieron únicamente el 18/10/2026, última hora 23:00–24:00 (Colombia). Este resultado no permite afirmar que esos valores sean medición instantánea. Otros productos de XM pueden tener otra frecuencia; no se ha verificado una API operativa en tiempo real equivalente para estos indicadores.

La publicación del JSON en GitHub se solicita en cada actualización. Cloudflare recibe el hook aproximadamente cada dos horas para respetar 500 builds/mes; esto es distinto de la hora observada por XM. GitHub puede retrasar ejecuciones programadas. Si las fuentes fallan se conservan las observaciones con sus fechas y advertencias.

## Verificación del correo del remitente

Ambos formularios usan `contact-verification.js` y el endpoint de Cloudflare `/api/contact`. Al solicitar un código, Cloudflare valida Turnstile en servidor con hostname del sitio y acción `contact-start`. El servicio privado `scripts/contact_mail.gs` se despliega como aplicación web de Google Apps Script, ejecutada por la cuenta receptora. No lee la bandeja de entrada ni contactos.

Configurar en Pages producción `MAIL_SERVICE_URL` (URL /exec de la implementación) y `MAIL_SERVICE_KEY` como secreto cifrado. La misma clave está en Script Properties `SERVICE_KEY`; `configurarServicio()` la crea sin imprimirla y configura `RECIPIENT`. No guardar claves en archivos, capturas ni repositorio. Cualquier llamada sin clave se rechaza. El proyecto no se comparte públicamente aunque el endpoint /exec sea accesible.

El código tiene seis dígitos, vence en 30 segundos, se almacena como HMAC y permite cinco intentos; se consume antes de enviar la solicitud. Límite de tres códigos por correo y cinco por hash de cliente por hora. Solo después de verificar se envía al receptor fijo con Reply-To del correo verificado. El navegador retorna a gracias.html en su propio dominio. No hay envío alternativo sin verificación.

La cuota gratuita de MailApp depende de la cuenta. Para cuentas de consumidor Google publica 100 destinatarios/día; un proceso completo consume dos envíos, más reintentos. Se reservan los últimos envíos para solicitudes que ya tengan código. No contratar una ampliación. Ante fallo o agotamiento, el formulario informa y no envía sin verificar. Cuotas: https://developers.google.com/apps-script/guides/services/quotas

Pruebas: `node --test tests/cloudflare_gate.test.mjs tests/cloudflare_contact.test.mjs tests/contact_mail.test.mjs`. La prueba real de recepción y retorno a gracias.html debe hacerse tras cada cambio de servicio o configuración. No declarar completa la verificación de producción solo por pasar pruebas simuladas.
