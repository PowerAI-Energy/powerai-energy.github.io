# Publicación de PowerAI-Energy en Cloudflare Pages

El sitio público conserva sus páginas, diseño, imágenes y fuentes de datos. GitHub Pages sigue disponible. No se incluyen hojas de vida ni documentos privados.

## Conectar la cuenta y publicar

En Cloudflare: **Workers & Pages → Create application → Pages → Import an existing Git repository** (los nombres pueden variar según el idioma del panel). Autorizar GitHub y elegir `PowerAI-Energy/powerai-energy.github.io`.

Configurar:

- Nombre sugerido: `powerai-energy` (sujeto a disponibilidad).
- Rama de producción: `main`.
- Framework: `None`.
- Comando de compilación: `python3 scripts/build_cloudflare.py`.
- Directorio de salida: `dist`.
- Directorio raíz: dejar el predeterminado del repositorio.

Pulsar **Save and Deploy**. Cloudflare mostrará la dirección `pages.dev` asignada al proyecto. No hace falta comprar un dominio. El script solo publica HTML, CSS, JavaScript, imágenes y datos; excluye documentación, tests y herramientas del repositorio.

## Datos y actualizaciones

El colector horario existente en GitHub Actions mantiene `data/engineering-data.json` con XM y petróleo en COP y conserva la publicación de GitHub Pages. Cloudflare publica en https://powerai-energy.pages.dev/ desde `main`.

El 21 de octubre de 2026 se observó que los commits del colector no aparecían en Pages y el panel avisó de una incidencia de GitHub con eventos push degradados. Por eso el workflow incorpora un Deploy Hook de Cloudflare para `main`. Su URL está únicamente en el secreto cifrado de GitHub Actions `CLOUDFLARE_PAGES_DEPLOY_HOOK`; no debe copiarse a archivos, capturas públicas ni logs.

En Cloudflare, Build watch paths incluye `*` y excluye `data/engineering-data.json` para evitar builds horarios duplicados cuando vuelvan los eventos push. El hook obtiene el estado actual de `main`, incluido el JSON. El colector sigue siendo horario; las ejecuciones programadas avisan a Cloudflare solo en horas pares UTC (aproximadamente cada dos horas, sujeto a retrasos de GitHub Actions). Una ejecución manual también avisa; una ejecución por push omite el hook para evitar duplicar el despliegue Git.

El plan gratuito admite 500 builds al mes: 12 avisos diarios representan hasta 372 avisos programados en 31 días, más builds por cambios de código, pruebas o ejecuciones manuales. No habilitar cobros ni aumentar la frecuencia sin revisar ese límite. Documentación: https://developers.cloudflare.com/pages/platform/limits/ y https://developers.cloudflare.com/pages/configuration/deploy-hooks/.

La prueba manual del workflow #198 completó correctamente el paso del hook y Cloudflare inició un despliegue para el commit automático `0221555`. La ausencia de caché del JSON no sustituye desplegar sus cambios. Las fechas y las limitaciones de las fuentes se mantienen visibles.

El clima se consulta desde el navegador después del consentimiento de ubicación, mediante MET Norway y BigDataCloud. Comprobar sus solicitudes desde el dominio publicado.

El formulario conserva FormSubmit y ajusta su retorno a `gracias.html` en el dominio desde el que se envía. Comprobar un envío real autorizado; FormSubmit puede pedir una nueva confirmación para el nuevo dominio.

## Verificación tras publicar

Abrir las seis páginas en escritorio y móvil; comprobar imágenes, navegación, tira en movimiento, fechas XM/petróleo, consentimiento y consulta del clima. Comprobar la publicación del siguiente commit horario de datos. El sitio aún no se considera verificado en producción hasta completar estas comprobaciones en la URL real.

La hoja de vida privada requiere una configuración independiente con autenticación; no debe añadirse a este repositorio público.
