import fs from 'node:fs/promises';
const source=new URL('./sources/',import.meta.url);
const raw=JSON.parse(await fs.readFile(new URL('ciqual-2025-rows.json',source),'utf8'));
const foods=JSON.parse(await fs.readFile(new URL('ciqual-2025-foods.json',source),'utf8'));
const names=new Map(foods.map(f=>[f.alim_code.trim(),f.alim_nom_eng?.trim()]));
// This is a food-identity/translation map, never a table of invented nutrients.
const terms=`
Apple|jabuka|fruit
Apricot|marelica|fruit
Avocado|avokado|fruit
Banana|banana|fruit
Blackberry|kupina|fruit
Blueberry|borovnica|fruit
Cherry|trešnja|fruit
Sour cherry|višnja|fruit
Clementine|klementina|fruit
Cranberry|brusnica|fruit
Date|datulja|fruit
Fig|smokva|fruit
Grapefruit|grejp|fruit
Grape|grožđe|fruit
Kiwi|kivi|fruit
Lemon|limun|fruit
Lime|limeta|fruit
Mandarin|mandarina|fruit
Mango|mango|fruit
Melon|dinja|fruit
Nectarine|nektarina|fruit
Orange|naranča|fruit
Peach|breskva|fruit
Pear|kruška|fruit
Pineapple|ananas|fruit
Plum|šljiva|fruit
Pomegranate|nar|fruit
Raspberry|malina|fruit
Redcurrant|crveni ribiz|fruit
Blackcurrant|crni ribiz|fruit
Strawberry|jagoda|fruit
Watermelon|lubenica|fruit
Prune|suha šljiva|fruit
Raisin|grožđice|fruit
Artichoke|artičoka|vegetable
Asparagus|šparoge|vegetable
Beetroot|cikla|vegetable
Broccoli|brokula|vegetable
Brussels sprout|prokulica|vegetable
Carrot|mrkva|vegetable
Cauliflower|cvjetača|vegetable
Celeriac|celer korijen|vegetable
Celery|celer stabljika|vegetable
Chicory|radič|vegetable
Courgette|tikvica|vegetable
Cucumber|krastavac|vegetable
Eggplant|patlidžan|vegetable
Fennel|komorač|vegetable
French bean|mahune|vegetable
Garden peas|grašak|vegetable
Garlic|češnjak|vegetable
Green cabbage|zelje|vegetable
Red cabbage|crveni kupus|vegetable
White cabbage|bijeli kupus|vegetable
Savoy cabbage|kelj|vegetable
Kale|lisnati kelj|vegetable
Kohlrabi|korabica|vegetable
Leek|poriluk|vegetable
Lettuce|zelena salata|vegetable
Onion|luk|vegetable
Parsnip|pastrnjak|vegetable
Pumpkin|bundeva|vegetable
Radish|rotkvica|vegetable
Rocket|rikola|vegetable
Shallot|ljutika|vegetable
Spinach|špinat|vegetable
Sweet pepper|paprika|vegetable
Swiss chard|blitva|vegetable
Tomato|rajčica|vegetable
Turnip|repa|vegetable
Button mushroom|šampinjon|mushroom
Boletus|vrganj|mushroom
Chanterelle|lisičarka|mushroom
Oyster mushroom|bukovača|mushroom
Mushroom|gljive|mushroom
Potato|krumpir|starch
Sweet potato|batat|starch
Lentil|leća|legume
Chick pea|slanutak|legume
Chickpea|slanutak|legume
White bean|bijeli grah|legume
Haricot bean|grah|legume
Red kidney bean|crveni grah|legume
Broad bean|bob|legume
Split pea|suhi grašak|legume
Soybean|soja|legume
Almond|badem|nuts-seeds
Brazil nut|brazilski orah|nuts-seeds
Cashew nut|indijski oraščić|nuts-seeds
Chestnut|kesten|nuts-seeds
Hazelnut|lješnjak|nuts-seeds
Peanut|kikiriki|nuts-seeds
Pecan nut|pekan orah|nuts-seeds
Pine nut|pinjol|nuts-seeds
Pistachio|pistacija|nuts-seeds
Walnut|orah|nuts-seeds
Chia seed|chia sjemenke|nuts-seeds
Flaxseed|lanene sjemenke|nuts-seeds
Linseed|lanene sjemenke|nuts-seeds
Sesame seed|sezam|nuts-seeds
Sunflower seed|suncokretove sjemenke|nuts-seeds
Pumpkin seed|bučine sjemenke|nuts-seeds
Rice|riža|grain
Oat|zob|grain
Pearled barley|ječmena kaša|grain
Barley|ječam|grain
Buckwheat|heljda|grain
Millet|proso|grain
Quinoa|kvinoja|grain
Spelt|pir|grain
Rye|raž|grain
Polenta|palenta|grain
Couscous|kus-kus|grain
Wheat bulgur|bulgur|grain
Wheat, bulgur|bulgur|grain
Durum wheat semolina|pšenična krupica|grain
Pasta|tjestenina|grain
Gnocchi|njoki|grain
Wheat flour|pšenično brašno|baking
Maize/corn flour|kukuruzno brašno|baking
Maize/corn starch|kukuruzni škrob|baking
Potato starch|krumpirov škrob|baking
Rice flour|rižino brašno|baking
Rye flour|raženo brašno|baking
Buckwheat flour|heljdino brašno|baking
Spelt flour|pirovo brašno|baking
Bread|kruh|bread
Breadcrumbs|krušne mrvice|bread
Rusk|dvopek|bread
Chicken|piletina|meat
Turkey|puretina|meat
Beef|govedina|meat
Veal|teletina|meat
Pork|svinjetina|meat
Lamb|janjetina|meat
Rabbit|kunić|meat
Duck|patka|meat
Goose|guska|meat
Sardine|srdela|fish
Anchovy|inćun|fish
Mackerel|skuša|fish
Salmon|losos|fish
Trout|pastrva|fish
Tuna|tuna|fish
Cod|bakalar|fish
Hake|oslić|fish
Gilthead seabream|orada|fish
Sea bass|brancin|fish
Carp|šaran|fish
Sole|list|fish
Squid|lignja|seafood
Octopus|hobotnica|seafood
Cuttlefish|sipa|seafood
Prawn|kozice|seafood
Shrimp|škampi|seafood
Mussel|dagnje|seafood
Egg|jaje|egg
Egg white|bjelanjak|egg
Egg yolk|žumanjak|egg
Milk|mlijeko|dairy
Goat milk|kozje mlijeko|dairy
Sheep milk|ovčje mlijeko|dairy
Yogurt|jogurt|dairy
Cream|vrhnje|dairy
Butter|maslac|fat
Olive oil|maslinovo ulje|fat
Sunflower oil|suncokretovo ulje|fat
Rapeseed oil|ulje uljane repice|fat
Pumpkin seed oil|bučino ulje|fat
Linseed oil|laneno ulje|fat
Walnut oil|orahovo ulje|fat
Coconut fat or oil|kokosovo ulje|fat
Honey|med|sweetener
Sugar|šećer|sweetener
Salt|sol|seasoning
Vinegar|ocat|seasoning
Pepper|papar|spice
Paprika|crvena paprika začin|spice
Basil|bosiljak|herb
Parsley|peršin|herb
Oregano|origano|herb
Rosemary|ružmarin|herb
Thyme|majčina dušica|herb
Dill|kopar|herb
Coffee|kava|drink
Tea|čaj|drink
Tofu|tofu|plant-protein
`.trim().split('\n').map(s=>{const [en,hr,cat]=s.split('|');return{en,hr,cat}}).sort((a,b)=>b.en.length-a.en.length);
const exactCodes=new Set('7000 7001 7106 7110 7111 7125 7170 7180 7200 7255 7259 7263 7813 7815 7300 7500 7525 19550 19556 19582 19583 19589 19592 19016 19023 19024 19033 19041 19042 19050 19051 19060 19200 19202 19250 12020 12100 12115 12118 12120 12122 12123 12726 12729 12736 12524 12060 12066 12068 12069 19584 19585 19590 19591 12300 12303 12805 12819 19410 19417 19430 19431 19436 16400 16402 16403 17040 17130 17180 17220 17270 17440 16040 16060'.split(' '));
const parse=v=>{if(v==null)return null;const t=String(v).trim();return /^\d+(?:[.,]\d+)?$/.test(t)?Number(t.replace(',','.')):null};
for(const code of '13009 15000 15001 15041 15202 18004 20503 20524 20525 36017 36018 19593 19594 19598 19860'.split(' '))exactCodes.add(code);
const reject=/sampled in|label rouge|overseas|guinea|ostrich|foal|horse|turtle|kangaroo|frog|offals|tongue|kidney|brain|testicle|heart,|blood|snail|calf sweetbread|baby food|infant|human|dietetic|meal replacement|vitamin|france|savoy|bresse|jelly|in syrup|var\.|fortified|fat content unknown|prepared with|weight unknown|with sauce|sarladaise|dauphine|duchesse|noisette|khorasan|sorghum|gari|ackee/i;
const rows=[];
for(const r of raw.slice(1)){
 const code=String(r[6]),name=names.get(code);if(!name||parse(r[10])==null||(reject.test(name)&&!exactCodes.has(code)))continue;
 const term=terms.find(t=>name.toLowerCase().startsWith(t.en.toLowerCase())&&/^[\s,(\/]|^$/.test(name.slice(t.en.length)));
 if(!term&&!exactCodes.has(code))continue;
 const cat=term?.cat||(['05'].includes(r[0])?'dairy':'bread');
 const expectedGroup={fruit:'0204',vegetable:'0201',mushroom:'0201',legume:'0203','nuts-seeds':'0205'}[cat];
 if(expectedGroup&&r[1]!==expectedGroup&&!exactCodes.has(code))continue;
 if(/cake|crackers|stew|sauce|trimming|back fat|foot,|cod liver/i.test(name))continue;
 if(cat==='nuts-seeds'&&/drink|oil|butter|paste/.test(name)&&!exactCodes.has(code))continue;
 if(['fruit','vegetable','mushroom','legume','starch'].includes(cat)&&!/raw|boiled|steamed|dried|canned|frozen|cooked|drained|roasted|puree|purée/i.test(name))continue;
 if(['meat','fish','seafood'].includes(cat)&&(!/raw|cooked|grilled|roasted|baked|boiled|steamed|canned/.test(name)||/smoked|breaded|fried|paste|terrine|stew|sauce/.test(name)))continue;
 if(cat==='meat'&&!/^(Chicken|Turkey|Beef|Veal|Pork|Lamb|Rabbit|Duck|Goose),/.test(name))continue;
 if(['dairy','bread','fat'].includes(cat)&&!exactCodes.has(code))continue;
 if(cat==='egg'&&!/^Egg(?: white| yolk)?, (raw|hard-boiled|poached|soft-boiled|fried)/.test(name))continue;
 if(cat==='grain'&&!/raw|cooked|boiled/.test(name))continue;
 if(cat==='drink'&&!/infusion|brewed|instant, reconstituted|espresso|ready-to-drink/.test(name))continue;
 const aliases=term?[term.hr]:[];
 const state=/\braw\b/.test(name)?'sirovo':/boiled|cooked/.test(name)?'kuhano':/grilled|roasted|baked/.test(name)?'pečeno':null;
 if(state&&term)aliases.push(term.hr+' '+state);
 if(/breast/.test(name))aliases.push('prsa','file');if(/thigh/.test(name))aliases.push('batak','zabatak');if(/minced/.test(name))aliases.push('mljeveno meso');
 if(/liver/.test(name))aliases.push('jetra');if(/white bean/.test(name))aliases.push('fažol','pasulj');if(/French bean/.test(name))aliases.push('boranija');
 const bounds=Object.fromEntries([['p',r[15]],['g',r[17]],['c',r[16]]].filter(([k,v])=>parse(v)==null));
 const values={kcal:parse(r[10]),p:parse(r[15]),g:parse(r[17]),c:parse(r[16])};
 const rank=(exactCodes.has(code)?-20:0)+(/raw/.test(name)?0:/boiled|steamed|cooked, no/.test(name)?1:3)+(/average/.test(name)?-2:0)+(/frozen|organic|drained|skin/.test(name)?1:0)+(/breast, meat,|fillet,|escalope|tenderloin|loin,|minced/.test(name)?-2:0);
 rows.push({name,brand:'',aliases,basis:'100g',...values,cat,code,sourceType:'reference_average',sourceUrl:'https://doi.org/10.57745/RDMHWY',raw:{kcal:r[10],p:r[15],g:r[17],c:r[16]},bounds,group:r[1],family:term?.en||code,rank});
}
const counts={},chosen=[];
const caps={meat:5,fish:3,seafood:2,fruit:2,vegetable:2,mushroom:2,grain:4,legume:3,starch:3,'nuts-seeds':2,baking:3,herb:1,spice:1,drink:2,seasoning:2,sweetener:2,'plant-protein':2};
for(const r of rows.sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name))){const key=r.family+(['grain','meat'].includes(r.cat)?(/raw/.test(r.name)?':raw':':cooked'):'');const n=counts[key]||0;if(n>=(caps[r.cat]||100)&&!exactCodes.has(r.code))continue;counts[key]=n+1;chosen.push(r);}
chosen.sort((a,b)=>a.cat.localeCompare(b.cat)||a.name.localeCompare(b.name));
await fs.writeFile(new URL('ciqual-curated.json',source),JSON.stringify(chosen,null,2)+'\n');
await fs.writeFile(new URL('ciqual-curated-review.txt',source),chosen.map(r=>[r.code,r.name,r.aliases.join('|'),r.kcal,r.p,r.g,r.c].join('\t')).join('\n'));
console.log(JSON.stringify({candidates:rows.length,chosen:chosen.length,categories:chosen.reduce((a,r)=>(a[r.cat]=(a[r.cat]||0)+1,a),{}),bounded:chosen.filter(r=>Object.keys(r.bounds).length).length}));
