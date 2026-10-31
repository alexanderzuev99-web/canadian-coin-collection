const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname;
function session(store,failKey){const c={localStorage:{getItem:k=>store[k]??null,setItem(k,v){if(k===failKey)throw Error('quota');store[k]=v;}}};c.window=c;vm.createContext(c);for(const f of ['data.js','collection.js','categories.js'])vm.runInContext(fs.readFileSync(root+'/'+f,'utf8'),c);return c;}
const store={'alex-coins-v1':JSON.stringify({owned:{110:true,112:false,83:true,191:false,192:true,84:false,137:true,182:false}})};
let c=session(store),a=c.CoinCollection;
for(const id of [112,191,84,182])assert.equal(a.read()[id],false,'Explicit removals beat old migrations');
a.set(137,false);a.set(182,true);c=session(store);a=c.CoinCollection;assert.equal(a.read()[137],false);assert.equal(a.read()[182],true);
let backup=a.exportData();a.set(137,true);a.importData(backup);assert.equal(a.read()[137],false);assert.equal(Object.keys(a.read()).length,174);
const unchanged=JSON.stringify(store);for(const text of ['{bad','null','{"owned":{"137":"false"}}','{"owned":[]}','{"owned":{"9999":true}}'])assert.throws(()=>a.importData(text));assert.equal(JSON.stringify(store),unchanged);
const validPrimary=store['alex-coins-v1'];
store['alex-coins-v1']='{corrupt';assert.equal(session(store).CoinCollection.read()[137],false);
c=session(store,'alex-coins-v1');assert.equal(c.CoinCollection.set(137,true).saved,true);assert.equal(session(store).CoinCollection.read()[137],true);
store['alex-coins-v1']=validPrimary;assert.equal(session(store).CoinCollection.read()[137],true,'Newer fallback wins after primary write failure');
const merged=session({'alex-coins-v1':JSON.stringify({owned:{83:true,192:true,110:true}})}).CoinCollection.read();for(const id of [191,84,112])assert.equal(merged[id],true);
const groups=c.CoinCategories.groups(c.COIN_DATA);assert.equal(groups.reduce((n,g)=>n+g.coins.length,0),174);assert.equal(new Set(groups.flatMap(g=>g.coins.map(c=>c.id))).size,174);
for(const year of [1999,2000])assert.equal(groups.find(g=>g.key==='25¢|Millennium · '+year).coins.length,12);
assert.equal(groups.find(g=>g.key==='25¢|War of 1812 · 2012–2013').coins.length,8);
console.log('PASS: additions/removals survive new sessions; explicit false beats legacy migrations; backup recovery and import validation preserve data; all 174 IDs appear in exactly one denomination/release group.');
