const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname;
function session(store,failKey){const c={localStorage:{getItem:k=>store[k]??null,setItem(k,v){if(k===failKey)throw Error('quota');store[k]=v;}}};c.window=c;vm.createContext(c);for(const f of ['data.js','collection.js','categories.js'])vm.runInContext(fs.readFileSync(root+'/'+f,'utf8'),c);return c;}
const store={'alex-coins-v1':JSON.stringify({owned:{110:true,112:false,83:true,191:false,192:true,84:false,137:true,182:false}})};
let c=session(store),a=c.CoinCollection;
for(const id of [112,191,84,182])assert.equal(a.read()[id],false,'Explicit removals beat old migrations');
a.set(137,false);a.set(182,true);c=session(store);a=c.CoinCollection;assert.equal(a.read()[137],false);assert.equal(a.read()[182],true);
let backup=a.exportData();a.set(137,true);a.importData(backup);assert.equal(a.read()[137],false);assert.equal(Object.keys(a.read()).length,173);
const unchanged=JSON.stringify(store);for(const text of ['{bad','null','{"owned":{"137":"false"}}','{"owned":[]}','{"owned":{"9999":true}}'])assert.throws(()=>a.importData(text));assert.equal(JSON.stringify(store),unchanged);
const validPrimary=store['alex-coins-v1'];
store['alex-coins-v1']='{corrupt';assert.equal(session(store).CoinCollection.read()[137],false);
c=session(store,'alex-coins-v1');assert.equal(c.CoinCollection.set(137,true).saved,true);assert.equal(session(store).CoinCollection.read()[137],true);
store['alex-coins-v1']=validPrimary;assert.equal(session(store).CoinCollection.read()[137],true,'Newer fallback wins after primary write failure');
const merged=session({'alex-coins-v1':JSON.stringify({owned:{83:true,192:true,110:true}})}).CoinCollection.read();for(const id of [191,84,112])assert.equal(merged[id],true);
const groups=c.CoinCategories.groups(c.COIN_DATA);assert.equal(groups.reduce((n,g)=>n+g.coins.length,0),173);assert.equal(new Set(groups.flatMap(g=>g.coins.map(c=>c.id))).size,173);
for(const year of [1999,2000])assert.equal(groups.find(g=>g.key==='25¢|Millennium · '+year).coins.length,12);
assert.equal(groups.find(g=>g.key==='25¢|War of 1812 · 2012–2013').coins.length,8);
console.log('PASS: additions/removals survive new sessions; explicit false beats legacy migrations; backup recovery and import validation preserve data; all 173 IDs appear in exactly one denomination/release group.');

for(const old of [{120:false,121:true},{120:true,121:false},{120:true,121:true},{120:false,121:false}]){const st={'alex-coins-v1':JSON.stringify({owned:old})};let cc=session(st).CoinCollection;assert.equal(cc.read()[120],old[120]||old[121]);cc.set(120,false);cc=session(st).CoinCollection;assert.equal(cc.read()[120],false);assert.equal(cc.read()[121],undefined);cc.importData(JSON.stringify({owned:old}));assert.equal(cc.read()[120],old[120]||old[121]);}
console.log('PASS: either Lucky Loonie year migrates as collected; removals persist after migration; old backups merge both years.');

// A stale catalogue must not erase unknown IDs or personal-release metadata.
const futureId='new-eeeeeeeeeeeeeeee-colour';
const versions={};let modern=session(versions).CoinCollection;
modern.save({...modern.read(),4:false,9999:true,[futureId]:true});
const archived=JSON.parse(versions['alex-coins-vault-v1']);archived.releaseReviews={future:{status:'skipped'}};versions['alex-coins-vault-v1']=JSON.stringify(archived);
versions['alex-coins-v1']=versions['alex-coins-backup-v1']=JSON.stringify({revision:100,owned:{4:false,5:true}});
let older=session(versions).CoinCollection;assert.equal(older.snapshot().owned[9999],true);assert.equal(older.snapshot().owned[futureId],true);assert.equal(older.read()[4],false);assert(older.snapshot().releaseReviews.future);
older.save(older.read());let next=session(versions).CoinCollection;assert.equal(next.snapshot().owned[futureId],true);assert.equal(next.snapshot().owned[9999],true);assert.equal(next.read()[4],false);assert.equal(next.read()[5],true);
console.log('PASS: catalogue version changes retain unknown future IDs, deliberate removals and release metadata; archive survives writes from older clients.');
