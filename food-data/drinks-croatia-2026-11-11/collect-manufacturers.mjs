import fs from 'node:fs/promises';
import {dir,clean,rows,links,get,batch,numeric} from './collect.mjs';
const products=JSON.parse(await fs.readFile(new URL('hbc-products.json',dir),'utf8'));
const result=[],candidates=new Set();
await batch(products.map(p=>p.learnMore.replace(/^http:/,'https:')),async(url,h)=>{
 const brand=products.find(p=>p.learnMore.replace(/^http:/,'https:')===url)?.name;
 const sections=h.split(/<div class="cmp-subbrand__detail-section[^>]*>/).slice(1);
 for(const [i,section] of sections.entries()){
  const name=clean(section.match(/<h3 class="kb-product-detail__title">([\s\S]*?)<\/h3>/)?.[1]);
  const table=[...section.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].find(m=>/kcal/i.test(m[0]));
  if(!table||!name){result.push({url,name,excluded:'no nutrition panel'});continue;}
  const v=rows(table[0]),value=rx=>v.find(r=>rx.test(r[0]))?.[1];
  const r={url:url+'#product-'+i,name,brand,sourceType:'manufacturer_label',supplier:'Coca-Cola HBC Hrvatska',basis:/100\s*ml/i.test(value(/Veličina/))?'100ml':null,labelValues:Object.fromEntries(v),kcal:numeric(value(/^Energija \(kcal/)),kj:numeric(value(/^Energija \(kJ/)),p:numeric(value(/^Bjelančevine/)),g:numeric(value(/^Masti/)),c:numeric(value(/^Ugljikohidrati/)),productText:clean(section).slice(0,3000)};
  if(!r.basis||r.kcal==null)r.excluded='missing explicit basis or calories';result.push(r);
 }
 for(const l of links(h,url))if(l.includes('/hr/our-24-7-portfolio/brands-a-z/')&&!l.includes('sharing'))candidates.add(l);
 for(const m of h.matchAll(/(?:data-action|data-url)="([^"]+)"/g))if(/subbrand|product-list/.test(m[1])){try{const j=await get(new URL(m[1],url).href);await fs.writeFile(new URL('hbc-child-'+products.findIndex(p=>p.learnMore.replace(/^http:/,'https:')===url)+'.json',dir),j);for(const match of j.matchAll(/(?:\/content\/cch\/hr)?\/hr\/our-24-7-portfolio\/brands-a-z\/[^"\s<>\\]+/g))candidates.add('https://hr.coca-colahellenic.com'+match[0].replace('/content/cch/hr',''));}catch{}}
});
console.log('HBC candidate labels',candidates.size);
await batch([...candidates],async(url,h)=>{
 const name=clean(h.match(/<td>\s*Name\s*<\/td>\s*<td>([\s\S]*?)<\/td>/)?.[1]);
 const section=h.match(/<td>\s*Nutritional Information\s*<\/td>\s*<td>([\s\S]*?<\/table>)/)?.[1];
 if(!section||!name){result.push({url,excluded:'no nutrition panel'});return;}
 const v=rows(section),value=rx=>v.find(r=>rx.test(r[0]))?.[1];
 const r={url,name,brand:products.find(p=>name.toLowerCase().startsWith(p.name.toLowerCase()))?.name||name.split(' ')[0],sourceType:'manufacturer_label',supplier:'Coca-Cola HBC Hrvatska',basis:/100\s*ml/i.test(value(/Veličina/))?'100ml':null,labelValues:Object.fromEntries(v),kcal:numeric(value(/^Energija \(kcal/)),kj:numeric(value(/^Energija \(kJ/)),p:numeric(value(/^Bjelančevine/)),g:numeric(value(/^Masti/)),c:numeric(value(/^Ugljikohidrati/))};
 if(!r.basis||r.kcal==null)r.excluded='missing explicit basis or calories';result.push(r);
});
await fs.writeFile(new URL('hbc-labels.json',dir),JSON.stringify(result,null,2));console.log('HBC result',result.length,result.filter(r=>!r.excluded).length);
const h=await fs.readFile(new URL('discovery-2.html',dir),'utf8');
const hr=h.split('Hranilna vrednost (Slovenija)')[0];const beers=[];
for(const table of hr.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)){
 const v=rows(table[0]);if(!v.some(r=>r.some(c=>/Vrijednost po 100 ml/.test(c))))continue;
 const name=v[0][0],value=rx=>v.find(r=>rx.test(r[0]))?.[1];const abvRow=v.find(r=>r.length===3&&/%|non-alcoholic/.test(r[1])&&!/ABV/.test(r[1]));
 beers.push({url:'https://zagrebackapivovara.hr/vise-o-proizvodima/',name,brand:'Zagrebačka pivovara',supplier:'Zagrebačka pivovara',sourceType:'manufacturer_label',basis:'100ml',kcal:numeric(v.find(r=>r[2]==='kcal')?.[1]),kj:numeric(v.find(r=>r[2]==='kJ')?.[1]),p:numeric(value(/^Bjelančevine/)),g:numeric(value(/^Masti/)),c:numeric(value(/^Ugljikohidrati/)),labelValues:Object.fromEntries(v.filter(r=>r.length===3).map(r=>[r[0]||r[2],r[1]])),abvText:abvRow?.[1]});
}
await fs.writeFile(new URL('brewery-labels.json',dir),JSON.stringify(beers,null,2));console.log('BREWERY',beers.length);
