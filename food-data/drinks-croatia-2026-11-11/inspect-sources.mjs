import fs from 'node:fs/promises';
const dir=new URL('./sources/',import.meta.url);
const clean=s=>s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
for(const i of [0,3,4,5,6,7]){
 const html=await fs.readFile(new URL(`discovery-${i}.html`,dir),'utf8');
 const links=[...new Set([...html.matchAll(/(?:href|data-url)=["']([^"']+)["']/g)].map(m=>m[1]))];
 console.log('LINKS',i,links.filter(u=>/brand|proizvod|pica|napit|sok|voda|pivo|vino|sitemap/i.test(u)).slice(-100));
 if(i===0)console.log('HBC data',html.match(/.{0,150}brand.{0,200}/g)?.filter(s=>/json|url|path|data-/i.test(s)).slice(-30));
}
const raw=JSON.parse(await fs.readFile(new URL('../../croatia-2026-11-11/sources/ciqual-2025-rows.json',dir),'utf8'));
const foods=JSON.parse(await fs.readFile(new URL('../../croatia-2026-11-11/sources/ciqual-2025-foods.json',dir),'utf8'));
const names=new Map(foods.map(f=>[f.alim_code.trim(),f.alim_nom_eng?.trim()]));
const drinks=raw.filter(r=>/boisson/i.test(r.slice(0,6).join(' '))).map(r=>({code:r[6],name:names.get(r[6]),group:r.slice(0,6),kcal:r[10],p:r[15],g:r[17],c:r[16],alcohol:r[29]}));
await fs.writeFile(new URL('ciqual-drink-candidates.json',dir),JSON.stringify(drinks,null,2));console.log('GENERIC',drinks.length,drinks.map(r=>r.code+' '+r.name).join('\n'));
