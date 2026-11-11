// Smoke test: esegue l'intero script di index.html in un DOM finto per
// verificare che l'app si avvii senza errori con il nuovo motore di sync e che
// un salvataggio venga marcato come "da inviare".
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

function makeClassList() {
  const set = new Set();
  return {
    add: (...c) => c.forEach((x) => set.add(x)),
    remove: (...c) => c.forEach((x) => set.delete(x)),
    toggle: (c, force) => {
      const on = force === undefined ? !set.has(c) : !!force;
      if (on) set.add(c);
      else set.delete(c);
      return on;
    },
    contains: (c) => set.has(c),
  };
}

function makeCtx2d() {
  return {
    scale() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
    stroke() {}, arc() {}, fill() {}, fillText() {},
    strokeStyle: '', lineWidth: 0, lineJoin: '', fillStyle: '', font: '',
  };
}

function makeEl() {
  const target = {
    value: '', textContent: '', innerHTML: '', hidden: false, checked: false,
    disabled: false, placeholder: '', download: '', href: '', width: 0, height: 0,
    className: '', id: '', style: {}, dataset: {}, classList: makeClassList(),
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    focus() {}, blur() {}, click() {}, scrollIntoView() {}, contains() { return false; },
    querySelectorAll() { return []; }, querySelector() { return makeEl(); },
    closest() { return makeEl(); }, setAttribute() {}, getAttribute() { return null; },
    insertBefore() {}, prepend() {}, after() {},
    getContext() { return makeCtx2d(); },
    getBoundingClientRect() { return {width: 800, height: 270, top: 0, left: 0}; },
    requestFullscreen() { return Promise.resolve(); },
  };
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      if (typeof prop === 'symbol') return undefined;
      return () => undefined; // qualunque metodo non previsto: no-op
    },
    set(obj, prop, val) { obj[prop] = val; return true; },
  });
}

function makeDom() {
  const registry = new Map();
  const document = {
    getElementById(id) {
      if (!registry.has(id)) registry.set(id, makeEl());
      return registry.get(id);
    },
    querySelectorAll() { return []; },
    querySelector() { return makeEl(); },
    createElement() { return makeEl(); },
    addEventListener() {},
    documentElement: makeEl(),
    body: makeEl(),
    fullscreenElement: null,
    exitFullscreen() {},
  };
  return document;
}

test('index.html si avvia e marca le modifiche come da sincronizzare', async () => {
  const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };

  const sandbox = {
    document: makeDom(),
    window: {addEventListener() {}, devicePixelRatio: 1},
    localStorage,
    navigator: {onLine: true, vibrate() {}},
    fetch: () => Promise.reject(new Error('rete non disponibile nel test')),
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    alert() {},
    confirm: () => true,
    getComputedStyle: () => ({getPropertyValue: () => '#000'}),
    crypto: globalThis.crypto,
    URL: globalThis.URL,
    URLSearchParams: globalThis.URLSearchParams,
    AbortSignal: globalThis.AbortSignal,
    Blob: globalThis.Blob,
    Response: globalThis.Response,
    AbortController: globalThis.AbortController,
    CompressionStream: globalThis.CompressionStream,
    console,
  };
  const ctx = vm.createContext(sandbox);

  // Espone gli interni per poter simulare un salvataggio dopo l'avvio.
  vm.runInContext(
    script +
      '\n;globalThis.__app={save,backupData,pendingCount,applyDelta,outboxRecords,KEY,' +
      'getEntries:()=>entries,getFoods:()=>foods,getMeta:()=>meta,' +
      'setWorkouts:(w)=>{workouts=w},setLifts:(l)=>{lifts=l},setExpanded:(id)=>{expandedWorkoutId=id},' +
      'renderWorkouts,renderDiary,pushDiaryItem,setDiaryMeal,moveDiaryItem,searchOnlineFoods,selectOnlineFood,getDiary:()=>diary,getWorkoutHTML:()=>document.getElementById("workoutBody").innerHTML,' +
      'addEntry:(rec)=>{entries=[...entries,rec];save(KEY,entries)}};',
    ctx,
  );

  const app = ctx.__app;
  assert.equal(app.getEntries().length, 0);

  app.addEntry({id: 'x', date: '2026-01-01', weight: 70, calories: 1800, type: 'training'});

  const meta = app.getMeta();
  assert.ok(meta.updated.entries['2026-01-01'], 'il record salvato deve avere un timestamp');
  assert.ok(app.pendingCount() >= 1, 'il record salvato deve risultare in attesa di invio');

  // L'outbox contiene il record da inviare, con i suoi dati.
  const out = app.outboxRecords();
  assert.equal(out.recs.length, 1);
  assert.equal(out.recs[0].collection, 'entries');
  assert.equal(out.recs[0].data.date, '2026-01-01');
  assert.equal(out.recs[0].updated, meta.updated.entries['2026-01-01']);

  // Un delta del server viene applicato al dispositivo.
  app.applyDelta({records: [
    {collection: 'foods', id: 'f1', data: {id: 'f1', name: 'Pollo', p: 23, g: 2, c: 0, kcal: 110}, updated: 9_000_000_000_000},
  ]});
  assert.ok(app.getFoods().some((f) => f.id === 'f1'), 'il client deve applicare il delta del server');

  // Native datalist selection inserts the option value into the input.
  const foodInput = sandbox.document.getElementById('diaryFood');
  foodInput.value = 'Pol';
  foodInput.oninput();
  const options = sandbox.document.getElementById('foodOptions').innerHTML;
  assert.ok(options.includes('value="Pollo"'), 'typing must offer the food name as the selectable value');
  assert.ok(!options.includes('value="f1"'), 'autocomplete must not insert the internal food ID');
  foodInput.value = 'Pollo';
  foodInput.onchange();
  assert.ok(sandbox.document.getElementById('selectedFoodSummary').textContent.startsWith('Pollo ·'), 'selection by name must resolve to the saved food');

  const date='2026-11-11', food=app.getFoods().find(f=>f.id==='f1');
  sandbox.document.getElementById('diaryDate').value=date;
  sandbox.document.getElementById('diaryMeal').value='breakfast';
  app.pushDiaryItem(date,food,100);
  sandbox.document.getElementById('diaryMeal').value='lunch';
  app.pushDiaryItem(date,food,50);
  const day=app.getDiary()[date];
  assert.equal(day.items[0].meal,'breakfast');assert.equal(day.items[1].meal,'lunch');
  const firstId=day.items[0].id;
  app.setDiaryMeal(date,firstId,'dinner');
  assert.equal(day.items[0].id,firstId);assert.equal(day.items[0].kcal,110);
  assert.equal(JSON.parse(store.get('ricomposizione_diary_v1'))[date].items[0].meal,'dinner');
  app.moveDiaryItem(date,firstId,1);
  assert.equal(day.items[0].id,firstId,'move down cannot leave its meal');
  app.renderDiary();
  const diaryHTML=sandbox.document.getElementById('diaryItems').innerHTML;
  for(const meal of ['breakfast','lunch','dinner','snacks'])assert.ok(diaryHTML.includes(`id="meal-${meal}"`));
  assert.ok(diaryHTML.includes('data-addmeal="lunch"'));
  assert.ok(!diaryHTML.includes('id="meal-unassigned"'));
  assert.equal(app.backupData().diary[date].items[0].meal,'dinner');

  // Real search/selection/form handlers: choosing a result only creates a draft.
  sandbox.fetch=async()=>Response.json({provider:'Open Food Facts',results:[{code:'3858888602825',name:'Example biscuits',brand:'Example',usable:true,kcal:447,p:null,g:18,c:62,aliases:['Primjer'],notes:[]}]});
  foodInput.value='Example';
  await app.searchOnlineFoods();app.selectOnlineFood(0);
  sandbox.document.getElementById('useOnlineFood').onclick();
  assert.ok(sandbox.document.getElementById('onlineFoodNotes').textContent.includes('Confirm'));
  sandbox.document.getElementById('onlineFoodBasis').value='100g';
  sandbox.document.getElementById('useOnlineFood').onclick();
  assert.equal(sandbox.document.getElementById('fName').value,'Example biscuits');
  assert.equal(sandbox.document.getElementById('fKcal').value,447);
  assert.equal(sandbox.document.getElementById('fP').value,'');
  assert.equal(app.getFoods().length,1,'choosing a candidate must not save it automatically');
  sandbox.document.getElementById('foodForm').onsubmit({preventDefault(){}});
  assert.equal(app.getFoods().length,2);assert.equal(app.getFoods().find(f=>f.name==='Example biscuits').p,null);

  const backup = app.backupData();
  assert.equal(backup.version, 5);
  assert.ok(backup.meta, 'il backup deve includere i metadati di merge');
  assert.equal(backup.entries.length, 1);

  // A logged set renders the best-1RM pill on the exercise and, when expanded,
  // the editor with the rep-max chips.
  app.setWorkouts([{id: 'w1', session: 'Giorno 1', name: 'Panca', sets: '3', type: 'compound', rest: "2'", notes: ''}]);
  app.setLifts([{id: 'l1', workoutId: 'w1', name: 'Panca', session: 'Giorno 1', date: '2026-01-02', weight: 80, reps: 5}]);
  app.renderWorkouts();
  let rendered = app.getWorkoutHTML();
  assert.ok(rendered.includes('pr-pill'), 'the best-1RM pill must render');
  assert.ok(rendered.includes('data-wlog="w1"'), 'the log button must render');

  app.setExpanded('w1');
  app.renderWorkouts();
  rendered = app.getWorkoutHTML();
  assert.ok(rendered.includes('data-liftadd="w1"'), 'the set editor must render when expanded');
  assert.ok(rendered.includes('5RM'), 'the rep-max chip must render');
});
