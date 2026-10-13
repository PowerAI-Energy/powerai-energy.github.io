# PowerAI-Energy

Sitio web estático para servicios de ingeniería en sistemas eléctricos de potencia y mantenimiento predictivo en baja y media tensión.

## GitHub Pages
Repositorio: `powerai-energy.github.io`
Fuente: branch `main`, carpeta `/(root)`.

Sitio: https://powerai-energy.github.io/
## Indicadores técnicos y meteorología

La tira se consulta automáticamente en todas las páginas. No muestra divisas ni
precios eléctricos. Muestra los indicadores técnicos agregados del Sistema que
responden a la API pública de XM, con las unidades originales y el período de cada
observación. El botón **Datos** permite revisar los valores y el catálogo técnico,
que incluye otras desagregaciones; no se descarga todo el histórico de XM.

`scripts/update_engineering_data.py` consulta el catálogo, las series técnicas y
los precios spot Brent/WTI de EIA publicados en FRED. Convierte estos últimos a
COP/barril usando la TRM de datos.gov.co y conserva ambas fechas. No son precios
de venta colombianos ni cotizaciones en tiempo real. El colector no necesita claves
ni paquetes Python externos.

El workflow `engineering-data.yml` se ejecuta al modificar el colector, manualmente
y cada hora. Guarda `data/engineering-data.json` y solicita la reconstrucción de
GitHub Pages. Requiere GitHub Actions habilitado y permisos de escritura de
contenido y Pages para el token del workflow. El programa conserva observaciones
anteriores con su fecha y señala los fallos; nunca publica cifras de prueba.

La geolocalización se solicita después de una pregunta al visitante. No se usa
antes de autorizar, ni se persisten coordenadas. MET Norway recibe coordenadas
aproximadas para un pronóstico, y BigDataCloud para el lugar. La altitud procede del
terreno del modelo, no de una medición GPS; estos datos no sustituyen instrumentos
ni evaluaciones de seguridad en campo.

Verificación: `python3 -m unittest discover -s tests` y `node --check script.js`.
Fuentes: documentación pública de [XM](https://github.com/EquipoAnaliticaXM/API_XM),
[MET Norway](https://api.met.no/), [FRED](https://fred.stlouisfed.org/),
[TRM](https://www.datos.gov.co/Econom-a-y-Finanzas/TRM/32sa-8pi3).
