import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('dist/server/index.js',root),'utf8');
const manifest=JSON.parse(await readFile(new URL('dist/.openai/hosting.json',root),'utf8'));
assert.ok(manifest.project_id);
assert.ok(!manifest.static,'This is a server Worker, not a static site');
const worker=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
assert.equal(typeof worker.default.fetch,'function');
for(const path of ['/','/styles.css','/app.js','/analytics.mjs','/api/health','/api/snapshot']){
 const res=await worker.default.fetch(new Request('https://test.invalid'+path),{},{});
 assert.equal(res.status,200,path);
 if(path==='/api/snapshot'){
  const s=await res.json();assert.equal(s.universe.length,259);assert.equal(Object.keys(s.series).length,235);
  assert.ok(s.risk.DGS10.points.length>200);assert.ok(s.risk.VIX.points.length>200);
 }
}
const bad=await worker.default.fetch(new Request('https://test.invalid/api/history?symbol=https://evil.example'),{},{});
assert.equal(bad.status,400,'Only catalog instruments may trigger upstream fetches');
const post=await worker.default.fetch(new Request('https://test.invalid/api/snapshot',{method:'POST'}),{},{});
assert.equal(post.status,405);
console.log('Artifact valid: Worker routes, real coverage, indicator series and symbol allowlist checked.');
