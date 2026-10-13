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
de venta colombianos ni cotizaciones en tiempo real. El colector no necesita claves. Si FRED no responde, consulta los archivos Excel
públicos de la EIA con `xlrd`, fijado y verificado en `requirements-feeds.txt`.
Instalación: `python3 -m pip install --require-hashes -r requirements-feeds.txt`.

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

La tira prioriza demanda real y generación reportada cuando métricas relacionadas
coinciden en valor, unidad y período. El detalle conserva todas las observaciones.
El desplazamiento es continuo y se controla con el botón de pausa; si el visitante
solicita movimiento reducido en su sistema, puede iniciarlo explícitamente.

La participación por fuente se calcula con la generación de recursos de XM para
una misma hora publicada y su clasificación energética. Se conservan recursos sin
clasificar en una categoría propia y se advierte si el total difiere del agregado
del Sistema. Estos porcentajes corresponden a generación eléctrica del SIN, no
a toda la matriz energética del país ni a una medición instantánea.
