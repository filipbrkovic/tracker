import fs from 'node:fs/promises';
const root=new URL('./',import.meta.url), dir=new URL('sources/',root);
const read=async name=>JSON.parse(await fs.readFile(new URL(name,dir),'utf8'));
const exclusions=[], duplicates=[];
const aliasesByCode={7263:'perec',7525:'grisini',7813:'kukuruzna tortilja',7259:'pecivo za hamburger|pecivo za hot dog',7200:'tost kruh',7111:'integralni tost',7815:'pšenična tortilja',12020:'brie sir',12726:'cheddar sir',12805:'svježi kozji sir',12819:'kozji sirni namaz',12729:'edamer',12115:'ementaler',12118:'ribani ementaler',12066:'feta ovčji kozji sir',12060:'kravlji sir tipa feta',12524:'gorgonzola',12736:'gauda|gouda',12123:'grana padano',12100:'tvrdi sir',19584:'mascarpone',19591:'bivolja mozzarella',19590:'mozzarella',12120:'parmezan',12122:'pecorino ovčji sir',12300:'topljeni sir u listićima',12068:'sirni namaz',12069:'lagani sirni namaz',17040:'ulje kikirikija',15202:'maslac od kikirikija|kikiriki maslac'};
const generic=await read('ciqual-curated.json');
for(const r of generic){
 if(aliasesByCode[r.code])r.aliases=aliasesByCode[r.code].split('|');
 if(r.code==='17040')r.cat='fat';
 if(r.code==='15202')r.cat='nuts-seeds';
 if(/Processed cheese.*triangle/.test(r.name))r.aliases=['topljeni sir trokutići'];
 if(/Shrimp or prawn/.test(r.name))r.aliases=['kozice','račići'];
 if(/Salmon trout/.test(r.name))r.aliases=['losos pastrva'];
 if(/black, raw/.test(r.name)&&r.family==='Radish')r.aliases=['crna rotkva'];
 if(r.aliases.includes('rajčica'))r.aliases.push('paradajz','pomidor');
 if(/cabbage/.test(r.name)&&!r.aliases.includes('kupus'))r.aliases.push('kupus');
 r.source=`ANSES Ciqual 2025; food code ${r.code}; reference average; per 100g edible portion; ${r.sourceUrl}`;
 const bounds=Object.entries(r.bounds).map(([k,v])=>`${({p:'protein',g:'fat',c:'carbohydrate'})[k]}: ${v} g/100g`);
 if(bounds.length)r.source+='; blank numeric fields preserve source limits/missing values: '+bounds.join(', ');
}
const branded=[];
for(const manufacturer of ['podravka','kras','vindija'])for(const r of await read(manufacturer+'-labels.json')){
 if(r.excluded){exclusions.push({url:r.url,name:r.name,reason:r.excluded});continue;}
 r.name=r.name.replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replaceAll('&amp;','&');
 let reason;
 const sum=r.p+r.g+r.c, energy=4*r.p+9*r.g+4*r.c;
 if(sum>102)reason='macronutrient mass exceeds 102g per 100g/ml';
 if(r.kj&&Math.abs(r.kj-r.kcal*4.184)>Math.max(12,r.kj*.025))reason='kJ/kcal disagreement above rounding tolerance';
 if(Math.abs(r.kcal-energy)>Math.max(25,r.kcal*.18))reason='large label energy/macronutrient discrepancy; not corrected or inferred';
 if(manufacturer==='podravka'&&/juha|kocka|temeljac|čaj/i.test(r.name)&&r.kcal<180)reason='dry-versus-prepared basis ambiguous in manufacturer panel';
 if(manufacturer==='podravka'&&/biljni napitak|barista/i.test(r.name))reason='liquid panel marked 100g on website; excluded pending package verification';
 if(reason){exclusions.push({url:r.url,name:r.name,reason,values:{kcal:r.kcal,p:r.p,g:r.g,c:r.c}});continue;}
 let cat='pantry';
 for(const [rx,c] of [[/čokol|dorina|bajader|keks|napolit|bombon|ki-ki|domać|bananko|griotte|čok|brundo|lino lada/i,'sweets-snacks'],[/tuna|sardin|skuš|haring|inćun|riblji|oslić|mirela/i,'fish'],[/juha|temeljac|kocka/i,'soup'],[/vegeta|začin|papar|cimet|lovor|kurkuma|fant |origano|peršin/i,'seasoning'],[/puding|sir|skyr|jogurt|shake|mlijeko/i,'dairy'],[/brašno|prašak|kvasac|šećer|preljev|kakao|želatin|krema|glazura/i,'baking'],[/riž|tjesten|rezan|špaget|makaron|kaša|žitar|krupic|ječ|zob|zlatic/i,'grain'],[/ajvar|rajč|pelat|passata|cikl|krastav|mahun|grah|graš|paprik|đuveč|maslin|šampinj|brokul|špinat|povr/i,'vegetable-preserves']])if(rx.test(r.name)){cat=c;break;}
 if(cat==='pantry')for(const [rx,c] of [[/losos|kozic|lignj|hobotnic|bakalar|pangasius|brancin|orada/i,'fish'],[/paštet|kobasic|pršut|šunk|salama|salamin|hrenov|mortadel|pancet|špek|mesni|pate/i,'meat-products'],[/džem|marmel|voćni namaz|pekmez|kompot/i,'fruit-preserves'],[/bucatini|fusilli|cappelletti|linguine|penne|farfalle|spaghetti|muesli|pahulj|griz|tjesten|talianett|rizoto/i,'grain'],[/brownie|cake|kolač|biskvit|čajni|505 |bronhi|kroki|kviki|waf|fini mini|puni|karamel/i,'sweets-snacks'],[/mix|umak|wok|curry|chilli|gulaš|grah|sarma|meso|piletin|ćuft|pljesk|čevap|ćevap/i,'prepared-meals']])if(rx.test(r.name)){cat=c;break;}
 branded.push({...r,manufacturer,cat,aliases:[],sourceType:'manufacturer_label',sourceUrl:r.url,source:`${manufacturer==='podravka'?'Podravka Group':manufacturer==='kras'?'Kraš':'Vindija'}; manufacturer label; per ${r.basis}; retrieved ${r.retrieved}; ${r.url}`});
}
// Identity matches LocalCal: case-insensitive name + brand. Conflicting panels are omitted entirely.
const groups=new Map();
for(const r of branded){const key=[r.name,r.brand].map(s=>s.normalize('NFC').trim().toLowerCase()).join('\0');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
let unique=[];
for(const rs of groups.values()){
 const signatures=new Set(rs.map(r=>JSON.stringify([r.basis,r.kcal,r.p,r.g,r.c])));
 if(signatures.size>1){for(const r of rs)exclusions.push({url:r.url,name:r.name,reason:'conflicting manufacturer panels for same name and brand'});continue;}
 unique.push(rs[0]);for(const r of rs.slice(1))duplicates.push({url:r.url,name:r.name,kept:rs[0].url});
}
// If more than 1000, retain broad brand coverage, round-robin within brands.
if(generic.length+unique.length>1000){const queues=new Map();for(const r of unique.sort((a,b)=>a.name.localeCompare(b.name,'hr'))){if(!queues.has(r.brand))queues.set(r.brand,[]);queues.get(r.brand).push(r);}const keep=[];while(keep.length<1000-generic.length&&[...queues.values()].some(q=>q.length))for(const q of queues.values())if(q.length&&keep.length<1000-generic.length)keep.push(q.shift());for(const q of queues.values())for(const r of q)exclusions.push({url:r.url,name:r.name,reason:'1000-row selection limit; balanced brand coverage'});unique=keep;}
const final=[...generic,...unique].sort((a,b)=>a.cat.localeCompare(b.cat)||a.name.localeCompare(b.name,'en')||a.brand.localeCompare(b.brand));
const summary={created:'2026-11-11',count:final.length,referenceFoods:generic.length,manufacturerFoods:unique.length,boundedReferenceFoods:generic.filter(r=>Object.keys(r.bounds).length).length,manufacturers:unique.reduce((a,r)=>(a[r.manufacturer]=(a[r.manufacturer]||0)+1,a),{}),categories:final.reduce((a,r)=>(a[r.cat]=(a[r.cat]||0)+1,a),{}),basis:final.reduce((a,r)=>(a[r.basis]=(a[r.basis]||0)+1,a),{}),exclusions:exclusions.reduce((a,r)=>(a[r.reason]=(a[r.reason]||0)+1,a),{}),duplicatePages:duplicates.length};
await fs.writeFile(new URL('curated-records.json',dir),JSON.stringify(final,null,2)+'\n');
await fs.writeFile(new URL('quality-audit.json',root),JSON.stringify({summary,exclusions,duplicates},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
