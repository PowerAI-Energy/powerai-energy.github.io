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

El colector horario existente en GitHub Actions mantiene `data/engineering-data.json` con XM y petróleo en COP. La integración Git de Pages debe publicar los cambios de `main`, incluidos los commits del colector. Comprobar en Deployments que un commit automático también despliegue. La ausencia de caché del JSON no sustituye la necesidad de desplegar una nueva versión cuando cambian los datos. Las fechas y las limitaciones de las fuentes se mantienen visibles.

El clima se consulta desde el navegador después del consentimiento de ubicación, mediante MET Norway y BigDataCloud. Comprobar sus solicitudes desde el dominio publicado.

El formulario conserva FormSubmit y ajusta su retorno a `gracias.html` en el dominio desde el que se envía. Comprobar un envío real autorizado; FormSubmit puede pedir una nueva confirmación para el nuevo dominio.

## Verificación tras publicar

Abrir las seis páginas en escritorio y móvil; comprobar imágenes, navegación, tira en movimiento, fechas XM/petróleo, consentimiento y consulta del clima. Comprobar la publicación del siguiente commit horario de datos. El sitio aún no se considera verificado en producción hasta completar estas comprobaciones en la URL real.

La hoja de vida privada requiere una configuración independiente con autenticación; no debe añadirse a este repositorio público.
