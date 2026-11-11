import fs from 'node:fs/promises';
import {dir,numeric} from './collect.mjs';
const candidates=JSON.parse(await fs.readFile(new URL('ciqual-drink-candidates.json',dir),'utf8'));
const previous=JSON.parse(await fs.readFile(new URL('../../croatia-2026-11-11/sources/curated-records.json',dir),'utf8'));
const previousCodes=new Set(previous.filter(r=>r.sourceType==='reference_average').map(r=>String(r.code)));
// Explicit identities and Croatian search aliases. Nutrients always come from Ciqual, never from this mapping.
const selection=`
18045|Negazirana mineralna voda|water
18046|Gazirana mineralna voda|water
18066|Voda iz slavine|water
18430|Izvorska voda|water
2000|Sok od ananasa iz koncentrata|juice
2002|Multivitaminski voćni sok|juice
2006|Sok od mrkve|juice
2007|Domaći limunov sok|juice
2012|Sok od naranče iz koncentrata|juice
2013|Svježe cijeđeni sok od naranče|juice
2014|Sok od jabuke iz koncentrata|juice
2015|Sok od grejpa iz koncentrata|juice
2016|Sok od grožđa|juice
2017|Sok od nara|juice
2018|Sok od suhih šljiva|juice
2019|Sok od grožđa iz koncentrata|juice
2023|Svježi sok od manga|juice
2024|Svježi sok od marakuje|juice
2025|Svježe cijeđeni sok od grejpa|juice
2026|Sok od rajčice 3 g soli po litri|juice
2027|Čisti sok od grejpa|juice
2028|Čisti sok od limuna|juice
2030|Svježi sok od limete|juice
2031|Čisti sok od limete|juice
2032|Sok od rajčice 6 g soli po litri|juice
2033|Miješani voćni sok s pireom|juice
2034|Sok od mandarine ili klementine|juice
2035|Čisti miješani voćni sok|juice
2036|Miješani voćni sok na bazi grožđa|juice
2038|Miješani voćni sok na bazi naranče|juice
2039|Svježi sok od nara|juice
2048|Miješani voćni sok na bazi jabuke|juice
2052|Sok od voća i povrća|juice
2053|Sok od rajčice prosječni sastav|juice
2069|Miješani voćni sok iz koncentrata|juice
2070|Čisti sok od naranče|juice
2071|Multivitaminski voćni sok iz koncentrata|juice
2073|Čisti sok od ananasa|juice
2074|Čisti sok od jabuke|juice
2377|Sok od crvene naranče|juice
2381|Sok od brusnice|juice
2009|Miješani nektar na bazi jabuke|juice
2022|Nektar od jagode|juice
2043|Nektar od marelice|juice
2054|Nektar od kruške|juice
2060|Multivitaminski nektar|juice
2061|Miješani voćni nektar|juice
2063|Miješani nektar na bazi naranče|juice
2064|Voćni nektar sa sladilima smanjen šećer|juice
2076|Nektar od jabuke|juice
2365|Nektar od marakuje|juice
2366|Nektar od banane|juice
2370|Nektar od manga|juice
2371|Nektar od breskve|juice
2374|Nektar od ananasa|juice
2375|Nektar od naranče|juice
18010|Limunada sa šećerom|soft-drink
18012|Voda s okusom sa šećerom|water
18013|Tonic bez dodanog šećera sa sladilima|soft-drink
18014|Tonic sa šećerom i sladilima|soft-drink
18015|Ledeni čaj sa šećerom i sladilima|iced-tea
18016|Limunada sa šećerom i sladilima|soft-drink
18018|Cola sa šećerom|soft-drink
18025|Kombucha|fermented-drink
18028|Voda s okusom bez šećera i sladila|water
18030|Voda s okusom bez dodanog šećera sa sladilima|water
18035|Limunada bez dodanog šećera sa sladilima|soft-drink
18037|Cola sa šećerom i sladilima|soft-drink
18060|Cola bez dodanog šećera sa sladilima|soft-drink
18064|Ledeni čaj sa smanjenim šećerom|iced-tea
18065|Ledeni čaj bez dodanog šećera sa sladilima|iced-tea
18067|Cola sa šećerom bez kofeina|soft-drink
18068|Cola bez šećera i kofeina sa sladilima|soft-drink
18075|Ledeni čaj sa šećerom|iced-tea
18306|Napitak od aloe vere sa šećerom|soft-drink
18316|Vodeni kefir tibicos|fermented-drink
18344|Tonic sa šećerom|soft-drink
18348|Sportski napitak sa šećerom|sports-drink
18352|Energetski napitak sa šećerom|energy-drink
18353|Energetski napitak bez dodanog šećera sa sladilima|energy-drink
18354|Energetski napitak sa šećerom i sladilima|energy-drink
19117|Mliječni napitak s kavom i šećerom poluobrano mlijeko|milk-drink
19118|Čokoladno mlijeko sa šećerom poluobrano|milk-drink
18011|Kokosova voda|water
18107|Napitak od badema bez dodanog šećera neobogaćen|plant-drink
18110|Napitak od badema sa šećerom i dodanim kalcijem|plant-drink
18899|Zobeni napitak bez dodanog šećera neobogaćen|plant-drink
18900|Sojin napitak neobogaćen|plant-drink
18901|Sojin napitak s dodanim kalcijem|plant-drink
18902|Sojin napitak s okusom i šećerom neobogaćen|plant-drink
18903|Sojin napitak s okusom šećerom i kalcijem|plant-drink
18904|Rižin napitak|plant-drink
18907|Kokosov napitak|plant-drink
18004|Kuhana crna kava bez šećera|coffee-tea
18020|Kuhani čaj bez šećera|coffee-tea
18022|Biljni čaj bez šećera|coffee-tea
18070|Kuhana kava bez kofeina i šećera|coffee-tea
18071|Espresso bez šećera|coffee-tea
18072|Pripremljena instant kava bez kofeina i šećera|coffee-tea
18073|Pripremljena instant kava bez šećera|coffee-tea
18104|Pripremljeni kakao s poluobranim mlijekom i šećerom|milk-drink
18151|Kava s mlijekom cappuccino bez šećera|coffee-tea
18154|Crni čaj bez šećera|coffee-tea
18155|Zeleni čaj bez šećera|coffee-tea
18162|Pripremljena instant mješavina cikorije i kave s vodom bez šećera|coffee-tea
1006|Slatko vino|wine
5201|Bijelo pjenušavo vino|wine
5207|Šampanjac|wine
5214|Crno vino|wine
5215|Bijelo suho vino|wine
5216|Rose vino ružičasto vino|wine
5000|Tamno pivo|beer
5001|Pivo 4 do 5 posto alkohola|beer
5002|Jako pivo iznad 8 posto alkohola|beer
5006|Suhi cider jabukovača|cider
5007|Slatki cider jabukovača|cider
5008|Pivo s nižim alkoholom 3 posto|beer
5009|Bijelo pšenično pivo|beer
5010|Specijalno pivo 5 do 6 posto alkohola|beer
5011|Samostansko ili pivovarsko pivo promjenjiv alkohol|beer
5021|Polusuhi cider jabukovača|cider
5022|Cider s voćnim okusom|cider
5029|Bezalkoholno pivo zaslađeno s okusom ili voćnim sokom|nonalcoholic-beer
5030|Bezalkoholno pivo ispod 1.2 posto bez dodanog šećera|nonalcoholic-beer
1001|Voćna rakija referentni prosjek|spirits
1002|Gin džin|spirits
1003|Liker referentni prosjek|spirits
1004|Rum|spirits
1005|Whisky viski|spirits
1007|Aperitiv na bazi vina|spirits
1008|Vodka votka|spirits
1021|Liker od crnog ribiza|spirits
1023|Brandy vinjak konjak|spirits
1024|Calvados rakija od jabuke|spirits
1012|Koktel na bazi ruma referentni prosjek|cocktail
1013|Koktel na bazi viskija referentni prosjek|cocktail
1017|Sangria sangrija|cocktail
1022|Gotovi punč koktel 16 posto alkohola|cocktail
2008|Bezalkoholni koktel sa sokom i sirupom|soft-drink
18007|Bezalkoholni koktel od sokova bez sirupa|soft-drink
5004|Radler mješavina piva i limunade|beer
5005|Gotovi radler ispod 1 posto alkohola|nonalcoholic-beer
`.trim().split('\n').map(l=>l.split('|'));
const records=[],excluded=[];
for(const [code,alias,category] of selection){
 const r=candidates.find(x=>String(x.code)===code);if(!r)throw new Error('Missing '+code);
 if(previousCodes.has(code)){excluded.push({code,name:r.name,reason:'already in food CSV'});continue;}
 const kcal=numeric(String(r.kcal));if(kcal==null){excluded.push({code,name:r.name,reason:'no numeric reference calories'});continue;}
 const bounds={};const v={};for(const k of ['p','g','c']){v[k]=numeric(String(r[k]));if(v[k]==null)bounds[k]=String(r[k]);}
 const alcohol=numeric(String(r.alcohol));
 const source=`ANSES Ciqual 2025; code ${code}; reference average, not a Croatian brand label; per 100g (NOT 100ml); ${Object.keys(bounds).length?'non-numeric macros '+JSON.stringify(bounds)+'; ':''}${alcohol>0?'ethanol '+alcohol+' g/100g; published energy includes alcohol; ':''}https://doi.org/10.57745/RDMHWY`;
 records.push({...r,...v,kcal,code,brand:'ANSES Ciqual 2025',aliases:[alias],cat:'drink,'+category,basis:'100g',source,sourceType:'reference_average',sourceUrl:'https://doi.org/10.57745/RDMHWY',bounds,alcohol});
}
await fs.writeFile(new URL('generic-records.json',dir),JSON.stringify(records,null,2));await fs.writeFile(new URL('generic-exclusions.json',dir),JSON.stringify(excluded,null,2));console.log('GENERIC',records.length,'excluded',excluded.length);
