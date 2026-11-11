import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
const root=new URL('./',import.meta.url);
const read=async path=>JSON.parse(await fs.readFile(new URL(path,root),'utf8'));
const records=await read('sources/curated-records.json');
const csv=await fs.readFile(new URL('croatia-foods-1000.csv',root),'utf8');
const html=await fs.readFile(new URL('../../index.html',root),'utf8');
const core=html.split('/* SYNC-CORE-START */')[1].split('/* SYNC-CORE-END */')[0];
const parsers=html.slice(html.indexOf('function detectDelimiter('),html.indexOf('function mapHeaders('))+html.slice(html.indexOf('function localFoodRows('),html.indexOf('/* ---------- Food database ---------- */'));
const context=vm.createContext({crypto:globalThis.crypto});
vm.runInContext(core+parsers+';globalThis.api={localFoodRows,previewFoods,foodMatches,snapshotFood,detectDelimiter}',context);
const api=context.api;
assert.equal(api.detectDelimiter(csv),';');
const rows=api.localFoodRows(csv), report=api.previewFoods(rows,[]);
assert.equal(rows.length,1000);assert.equal(report.added,1000);assert.equal(report.rejected,0);assert.equal(report.updated,0);assert.equal(report.warnings.length,0);
const repeat=api.previewFoods(rows,report.foods);
assert.equal(repeat.added,0);assert.equal(repeat.updated,0);assert.equal(repeat.skipped,1000);assert.equal(repeat.rejected,0);
const rawReference=await read('sources/ciqual-2025-rows.json');
const ciqual=new Map(rawReference.slice(1).map(r=>[r[6],r]));
const parse=v=>/^\d+(?:[.,]\d+)?$/.test(String(v).trim())?Number(String(v).replace(',','.')):null;
const identities=new Set();
let missingFields=0,referenceChecks=0,labelChecks=0;
for(let i=0;i<records.length;i++){
 const r=records[i], food=report.foods[i];
 const identity=r.name.trim().toLowerCase()+'\0'+r.brand.trim().toLowerCase();assert.ok(!identities.has(identity));identities.add(identity);
 for(const k of ['name','brand','basis','kcal','p','g','c','source','cat'])assert.equal(food[k],r[k],`CSV round-trip row ${i+1} ${k}`);
 assert.equal(food.aliases.join('|'),r.aliases.join('|'));assert.ok(/^https:\/\//.test(r.sourceUrl));
 for(const k of ['p','g','c']){if(food[k]==null)missingFields++;else assert.ok(food[k]>=0&&food[k]<=100,`${r.name}: ${k}`);}
 if(r.sourceType==='reference_average'){
  const raw=ciqual.get(r.code);for(const [k,col] of [['kcal',10],['p',15],['g',17],['c',16]])assert.equal(r[k],parse(raw[col]),`Reference source ${r.code} ${k}`);
  assert.equal(r.basis,'100g');referenceChecks++;
 }else{
  const v=r.labelValues, entry=regex=>Object.entries(v).find(([k])=>regex.test(k))?.[1];
  for(const [k,rx] of [['p',/^(Bjelančevine|Proteini)/i],['g',/^Masti/i],['c',/^Ugljikohidrati/i]]){
   const value=entry(rx)?.match(/[\d.,]+/);assert.equal(r[k],Number(value?.[0].replace(',','.')),`Label source ${r.url} ${k}`);
  }
  const energy=entry(/energ/i)?.match(/([\d.,]+)\s*kcal/i);assert.equal(r.kcal,Number(energy?.[1].replace(',','.')));labelChecks++;
 }
}
const chicken=report.foods.find(r=>r.name==='Chicken, breast, without skin, raw');
assert.equal(api.snapshotFood(chicken,150).kcal,165);assert.equal(api.snapshotFood(chicken,150).p,35.1);
for(const q of ['blitva','rajcica','heljdino brasno','grah','piletina'])assert.ok(report.foods.some(f=>api.foodMatches(f,q)),q);
const domacica=report.foods.find(r=>r.name==='Domaćica Original'&&r.brand==='Kraš');assert.equal(domacica.kcal,447);assert.equal(domacica.p,6.6);assert.equal(domacica.g,18);assert.equal(domacica.c,62);
const result={rows:records.length,firstImport:{added:report.added,rejected:report.rejected,warnings:report.warnings.length},repeatImport:{added:repeat.added,updated:repeat.updated,skipped:repeat.skipped},sourceNumericChecks:{referenceFoods:referenceChecks,manufacturerFoods:labelChecks},blankMacroFields:missingFields,unicodeAndAliasSearch:'passed',portionScaling:'passed',sha256:crypto.createHash('sha256').update(csv).digest('hex')};
await fs.writeFile(new URL('validation-results.json',root),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
