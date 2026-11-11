import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {loadCore} from './extract-core.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=html.split('/* SYNC-CORE-START */')[1].split('/* SYNC-CORE-END */')[0];
const ctx=vm.createContext({crypto:globalThis.crypto});
vm.runInContext(code+';globalThis.api={validateFood,previewFoods,foodMatches,snapshotFood,stampDiaryItems,mergeDiaryItems,groupDiaryMeals,onlineFoodDraft}',ctx);
const api=ctx.api;

test('online candidates require confirmed units and preserve source calories and unknown macros',()=>{
 const candidate={code:'3858888602825',name:'Example drink',brand:'Example',usable:true,kcal:64,p:10,g:null,c:4.9,aliases:['Primjer'],notes:['fat: < 0.5; numeric value left blank']};
 assert.throws(()=>api.onlineFoodDraft(candidate,''),/Confirm/);
 const food=api.onlineFoodDraft(candidate,'100ml');assert.equal(food.basis,'100ml');assert.equal(food.kcal,64);assert.equal(food.g,null);assert.ok(food.source.includes(candidate.code));assert.ok(food.source.includes('ODbL'));
 assert.throws(()=>api.onlineFoodDraft({...candidate,kcal:null},'100g'),/calorie/);
 assert.throws(()=>api.onlineFoodDraft({...candidate,p:120},'100g'),/unusually high/);
});

test('meal sections keep empty meals, legacy entries and unknown macros distinct',()=>{
 const items=[{id:'a',meal:'breakfast',kcal:100,p:10,g:2,c:8},{id:'b',meal:'breakfast',kcal:50,p:null,g:0,c:5},{id:'c',kcal:20,p:1,g:0,c:4}];
 const groups=api.groupDiaryMeals(items);
 assert.deepEqual(Array.from(groups,g=>g.id),['breakfast','lunch','dinner','snacks','unassigned']);
 assert.equal(groups[0].totals.kcal,150);assert.equal(groups[0].totals.p,null);
 assert.equal(groups[1].totals.kcal,0);assert.equal(groups[4].items[0].id,'c');
 assert.equal(items[2].meal,undefined,'displaying a legacy entry must not silently assign it');
 const before={day:{items:[{...items[0]}]}};api.stampDiaryItems({},before,100);
 const after=JSON.parse(JSON.stringify(before));after.day.items[0].meal='lunch';api.stampDiaryItems(before,after,200);
 const merged=api.mergeDiaryItems(before.day,after.day,100,200);
 assert.equal(merged.items[0].meal,'lunch');assert.equal(merged.items[0].kcal,100);
});
test('regional names, aliases and distinct brands',()=>{
 const food=api.validateFood({name:'Svježi sir',brand:'A',aliases:'kruh|hljeb',kcal:'98,5'});
 for(const q of ['svjezi sir','KRUH','hljeb']) assert.ok(api.foodMatches(food,q));
 const report=api.previewFoods([food,{...food,brand:'B'}],[]);
 assert.equal(report.added,2);
 assert.equal(api.previewFoods([food,{...food,brand:'B'}],report.foods).added,0);
 assert.equal(food.p,null);
});
test('validation preserves zero and label energy; fractional serving snapshots',()=>{
 const food=api.validateFood({name:'Soup',basis:'serving',kcal:100,p:0,g:0,c:0});
 assert.equal(api.snapshotFood(food,0.5).kcal,50);
 assert.equal(api.snapshotFood(food,0.5).p,0);
 assert.throws(()=>api.validateFood({name:'X',kcal:-1}));
 assert.throws(()=>api.validateFood({name:'X',kcal:10,piece:0}));
 assert.equal(api.previewFoods([{name:'X',kcal:-1}],[]).rejected,1);
});
test('imports work without secure-context UUID and grams convert to servings',()=>{
 const insecure=vm.createContext({crypto:{}});
 vm.runInContext(code+';globalThis.preview=previewFoods',insecure);
 assert.equal(insecure.preview([{name:'LAN food',kcal:10}],[]).added,1);
 const food=api.validateFood({name:'Portion',basis:'serving',piece:200,kcal:300});
 assert.equal(api.snapshotFood(food,100,'g').kcal,150);
 assert.throws(()=>api.snapshotFood(food,100,'ml'));
});
test('explicit reorder survives merge',()=>{
 const before={items:[{id:'a'},{id:'b'}]};api.stampDiaryItems({}, {day:before},100);
 const after=JSON.parse(JSON.stringify(before));after.items.reverse();
 api.stampDiaryItems({day:before},{day:after},200);
 assert.deepEqual(Array.from(api.mergeDiaryItems(before,after,100,200).items,i=>i.id),['b','a']);
});
test('independent same-day offline additions survive; stale copies cannot resurrect deletion',()=>{
 const a={items:[{id:'a',kcal:10}]},b={items:[{id:'b',kcal:20}]};
 api.stampDiaryItems({}, {day:a},100);api.stampDiaryItems({}, {day:b},200);
 const merged=api.mergeDiaryItems(a,b,100,200);
 assert.equal(merged.items.length,2);
 const removed=JSON.parse(JSON.stringify(merged));removed.items=removed.items.filter(i=>i.id!=='a');
 api.stampDiaryItems({day:merged},{day:removed},300);
 assert.deepEqual(Array.from(api.mergeDiaryItems(removed,a,300,100).items,i=>i.id),['b']);
 const core=loadCore();const left={diary:{day:a},meta:core.emptyMeta()},right={diary:{day:b},meta:core.emptyMeta()};
 left.meta.updated.diary.day=100;right.meta.updated.diary.day=200;
 assert.equal(core.syncMerge(left,right).state.diary.day.items.length,2);
});
