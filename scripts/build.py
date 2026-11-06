from pathlib import Path
import json,shutil
ROOT=Path(__file__).resolve().parents[1]
dist=ROOT/'dist'
if dist.exists():shutil.rmtree(dist)
(dist/'server').mkdir(parents=True)
(dist/'.openai').mkdir()
assets={}
for filename,mime in [('index.html','text/html'),('styles.css','text/css'),('app.js','text/javascript'),('analytics.mjs','text/javascript')]:
    assets['/'+filename]={'body':(ROOT/'worker'/filename).read_text(),'type':mime+'; charset=utf-8'}
seed=json.loads((ROOT/'data/snapshot.json').read_text())
assert len(seed['series'])>=200, 'A substantive real seed is required'
assert all(len(v['points'])>=5 for v in seed['series'].values())
header='const ASSETS='+json.dumps(assets,ensure_ascii=False,separators=(',',':'))+';\n'
header+='const SEED='+json.dumps(seed,ensure_ascii=False,separators=(',',':'))+';\n'
source=header+(ROOT/'worker/server.mjs').read_text()
(dist/'server/index.js').write_text(source)
shutil.copyfile(ROOT/'.openai/hosting.json',dist/'.openai/hosting.json')
print(f'Built real-data Worker: {len(source.encode()):,} bytes; {len(seed["series"])} ETF histories.')
