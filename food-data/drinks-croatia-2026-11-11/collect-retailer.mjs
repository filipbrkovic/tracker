import fs from 'node:fs/promises';
import {dir,clean,rows,batch,numeric} from './collect.mjs';
const products=JSON.parse(await fs.readFile(new URL('konzum-products.json',dir),'utf8'));
const result=[];let found=0;
await batch(products.map(r=>r.url),async(url,h)=>{
 const meta=products.find(p=>p.url===url),r={...meta,supplier:'Konzum',sourceType:'retailer_label'};
 r.name=clean(h.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
 const schemas=[...h.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(m=>{try{const x=JSON.parse(m[1]);return Array.isArray(x)?x:[x]}catch{return []}});
 const schema=schemas.find(s=>s['@type']==='Product');r.brand=typeof schema?.brand==='string'?schema.brand:schema?.brand?.name||'';r.ean=schema?.gtin13||schema?.gtin||null;
 const tables=[...h.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].filter(m=>/kcal/i.test(m[0]));
 if(tables.length!==1){r.excluded=tables.length?'multiple nutrition panels':'no calorie table';result.push(r);return;}
 const table=tables[0],v=rows(table[0]);r.labelValues=Object.fromEntries(v.filter(r=>r.length===2));r.nutritionText=clean(table[0]);
 const value=rx=>v.find(r=>rx.test(r[0]))?.[1];const en=value(/^Energija/);const nums=en?.match(/^\s*([\d.,]+)\s*\/\s*([\d.,]+)\s*$/);
 r.kj=nums?numeric(nums[1]):null;r.kcal=nums?numeric(nums[2]):null;r.p=numeric(value(/^Bjelančevine/));r.g=numeric(value(/^Masti/));r.c=numeric(value(/^Ugljikohidrati/));
 r.basisText=v[0]?.join(' ');r.basis=/100\s*g\s*\/\s*ml/i.test(r.basisText)?'100ml':null;
 // Keep enough adjacent product text for manual classification and ABV checks.
 const h1=h.search(/<h1\b/i),end=h.indexOf('Prije konzumacije',h1);r.productText=clean(h.slice(h1,end>h1?end:h1+25000)).slice(0,9000);
 if(!r.name||!r.basis||r.kcal==null)r.excluded='missing name, basis or numeric calories';
 else if(/sirup|prah|instant|granul|kapsul|kava.*\d+\s*g\b|čaj.*\d+\s*g\b|cedevita.*\d+\s*g\b|bajadera.*praline|poklon|set |paket|desert|puding|kaša|vrhnje|krem/i.test(r.name))r.excluded='concentrate, powder, food or mixed gift pack; not ready to drink';
 else if(!/\d\s*(?:ml|l|lit|litre|litra)\b/i.test(r.name))r.excluded='cannot establish liquid package from product identity';
 else found++;
 result.push(r);if(result.length%60===0){await fs.writeFile(new URL('konzum-labels.json',dir),JSON.stringify(result,null,2));console.log('Nutrition panels',found,'from',result.length);}
},3);
await fs.writeFile(new URL('konzum-labels.json',dir),JSON.stringify(result,null,2));console.log('DONE',result.length,found);
