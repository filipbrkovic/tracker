import fs from 'node:fs/promises';
const dir=new URL('./sources/',import.meta.url);await fs.mkdir(dir,{recursive:true});
const urls=[
 'https://hr.coca-colahellenic.com/hr/our-24-7-portfolio/brands-a-z',
 'https://hr.coca-colahellenic.com/hr/our-24-7-portfolio/brands-a-z/coca-cola/coca-cola-original',
 'https://zagrebackapivovara.hr/vise-o-proizvodima/',
 'https://www.jamnica.hr/',
 'https://www.konzum.hr/web/t/kategorije/pica',
 'https://www.tommy.hr/kategorije/pica',
 'https://www.maraska.hr/',
 'https://www.badel1862.hr/'
];
await Promise.all(urls.map(async(url,i)=>{try{const r=await fetch(url,{signal:AbortSignal.timeout(25000)}),html=await r.text();await fs.writeFile(new URL(`discovery-${i}.html`,dir),html);console.log(i,r.status,html.length,url)}catch(e){console.log(i,e.message)}}));
const rows=JSON.parse(await fs.readFile(new URL('../../croatia-2026-11-11/sources/ciqual-2025-rows.json',dir),'utf8'));
console.log('HEADERS',JSON.stringify(rows[0]));
const drinks=rows.filter(r=>/beverages|drinks/i.test(r.slice(0,6).join(' ')));
await fs.writeFile(new URL('ciqual-drink-candidates.json',dir),JSON.stringify(drinks,null,2));
console.log('CIQUAL',drinks.length,JSON.stringify(drinks.map(r=>r.slice(0,9))));
