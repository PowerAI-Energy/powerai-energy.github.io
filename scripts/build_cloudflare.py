"""Copy only public website assets into the Cloudflare Pages output directory."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'dist'
if OUTPUT.exists():
    shutil.rmtree(OUTPUT)
OUTPUT.mkdir()
for pattern in ('*.html', '*.css', '*.js', 'favicon.svg'):
    for source in ROOT.glob(pattern):
        shutil.copy2(source, OUTPUT / source.name)
for name in ('assets', 'data'):
    shutil.copytree(ROOT / name, OUTPUT / name)
(OUTPUT / '_headers').write_text('/data/engineering-data.json\n  Cache-Control: no-store\n', encoding='utf-8')
shutil.copy2(ROOT / 'scripts' / 'cloudflare_gate.mjs', OUTPUT / '_worker.js')
shutil.copy2(ROOT / 'scripts' / 'cloudflare_contact.mjs', OUTPUT / 'cloudflare_contact.mjs')
(OUTPUT / '_routes.json').write_text('{"version":1,"include":["/*"],"exclude":[]}', encoding='utf-8')
print(f'Public site ready: {OUTPUT}')
