// Stable IDs and the original key keep existing browser selections compatible.
window.CoinCollection = {
  key: 'alex-coins-v1',
  backupKey: 'alex-coins-backup-v1',
  snapshot() {
    let newest;
    for (const key of [this.key, this.backupKey]) {
      try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        if (value && value.owned && typeof value.owned === 'object' && !Array.isArray(value.owned) && (!newest || (Number(value.revision)||0)>(Number(newest.revision)||0))) newest=value;
      } catch {}
    }
    if(newest)return newest;
    return {owned:{}};
  },
  read() {
    const previous = {...this.snapshot().owned};
    // Merge the two Lucky Loonie dates once; save() retires ID 121, so later removals stay removed.
    if(typeof previous[121]==='boolean') previous[120]=previous[120]===true||previous[121]===true;
    // An explicit false is a deliberate removal and must beat a legacy true.
    for (const [from, to] of [[110,112],[83,191],[192,84]]) {
      if (typeof previous[to] !== 'boolean' && typeof previous[from] === 'boolean') previous[to] = previous[from];
    }
    return Object.fromEntries(COIN_DATA.map(c => [c.id, typeof previous[c.id] === 'boolean' ? previous[c.id] : c.owned]));
  },
  save(owned) {
    const clean = Object.fromEntries(COIN_DATA.map(c=>[c.id, typeof owned[c.id]==='boolean' ? owned[c.id] : c.owned]));
    const value=JSON.stringify({version:2,revision:(Number(this.snapshot().revision)||0)+1,updatedAt:new Date().toISOString(),owned:clean});
    let saved=false;
    for(const key of [this.key,this.backupKey]) {
      try { localStorage.setItem(key,value); saved=true; } catch {}
    }
    return saved;
  },
  set(id, value) {
    const owned={...this.read(),[id]:value};
    return {owned,saved:this.save(owned)};
  },
  exportData() { return JSON.stringify({app:'Canadian Coin Collection',version:2,exportedAt:new Date().toISOString(),owned:this.read()},null,2); },
  importData(text) {
    const data=JSON.parse(text);
    if(!data || !data.owned || typeof data.owned!=='object' || Array.isArray(data.owned)) throw new Error('Choose a collection backup JSON file.');
    const entries=Object.entries(data.owned), known=new Set(COIN_DATA.map(c=>String(c.id)));
    if(!entries.length || entries.some(([id,v])=>!/^[0-9]+$/.test(id)||typeof v!=='boolean') || !entries.some(([id])=>known.has(id))) throw new Error('This file does not contain valid coin selections.');
    const owned=this.read();
    for(const [id,value] of entries) if(known.has(id)) owned[id]=value;
    if(typeof data.owned[121]==='boolean') owned[120]=data.owned[120]===true||data.owned[121]===true;
    return {owned,saved:this.save(owned)};
  },
  random(exclude, rng = Math.random) {
    const candidates = COIN_DATA.filter(c => String(c.id) !== String(exclude));
    return candidates[Math.floor(rng() * candidates.length)];
  },
  openRandom(exclude) {
    const coin = this.random(exclude);
    if (coin) location.assign('coin.html?id=' + encodeURIComponent(coin.id));
  }
};
