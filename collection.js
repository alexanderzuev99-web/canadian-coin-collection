// Stable IDs and the original key keep existing browser selections compatible.
window.CoinCollection = {
  key: 'alex-coins-v1',
  noticeTimers: new WeakMap(),
  notify(node, message, temporary = false) {
    const previous = this.noticeTimers.get(node);
    if (previous !== undefined) clearTimeout(previous);
    this.noticeTimers.delete(node);
    node.textContent = message;
    if (temporary) {
      const timer = setTimeout(() => {
        node.textContent = '';
        this.noticeTimers.delete(node);
      }, 3000);
      this.noticeTimers.set(node, timer);
    }
  },
  backupKey: 'alex-coins-backup-v1',
  archiveKey: 'alex-coins-vault-v1',
  validOwned(value) {
    return Object.fromEntries(Object.entries(value||{}).filter(([id,v])=>typeof v==='boolean'&&(/^[0-9]+$/.test(id)||/^new-[a-f0-9]{16}-(colour|non-colour)$/.test(id))));
  },
  snapshot() {
    const snapshots=[];
    for (const key of [this.key,this.backupKey,this.archiveKey]) {
      try {
        const value=JSON.parse(localStorage.getItem(key)||'null');
        if(value&&value.owned&&typeof value.owned==='object'&&!Array.isArray(value.owned))snapshots.push(value);
      } catch {}
    }
    snapshots.sort((a,b)=>(Number(b.revision)||0)-(Number(a.revision)||0));
    if(!snapshots.length)return {owned:{}};
    // Older catalogue versions may omit IDs they do not know. Retain those IDs
    // from the archive; explicit true AND false in the newest snapshot win.
    const owned=Object.assign({},...snapshots.slice().reverse().map(s=>this.validOwned(s.owned)));
    for(const [from,to] of [[110,112],[121,120],[83,191],[192,84]])if(typeof snapshots[0].owned[to]==='boolean'&&typeof snapshots[0].owned[from]!=='boolean')delete owned[from];
    const reviews=snapshots.find(s=>s.releaseReviews&&typeof s.releaseReviews==='object'&&!Array.isArray(s.releaseReviews));
    return {...snapshots[0],owned,...(reviews?{releaseReviews:reviews.releaseReviews}:{})};
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
    const previous=this.snapshot();
    const clean={...this.validOwned(previous.owned),...this.validOwned(owned)};
    for(const c of COIN_DATA)if(typeof clean[c.id]!=='boolean')clean[c.id]=c.owned;
    // Retire aliases after their one-time merge, so later removals stay removed.
    for(const id of [110,121,83,192])delete clean[id];
    const value=JSON.stringify({version:3,revision:(Number(previous.revision)||0)+1,updatedAt:new Date().toISOString(),owned:clean,releaseReviews:window.NewCoins?.state||previous.releaseReviews||{}});
    let saved=false;
    for(const key of [this.key,this.backupKey,this.archiveKey]) {
      try { localStorage.setItem(key,value); saved=true; } catch {}
    }
    if(saved)try{window.CoinSync?.localSaved(clean,window.NewCoins?.state||previous.releaseReviews||{});}catch{}
    return saved;
  },
  set(id, value) {
    const owned={...this.read(),[id]:value};
    return {owned,saved:this.save(owned)};
  },
  exportData() { return JSON.stringify({app:'Canadian Coin Collection',version:2,exportedAt:new Date().toISOString(),owned:this.read(),releaseReviews:window.NewCoins?.state||{}},null,2); },
  importData(text) {
    const data=JSON.parse(text);
    if(!data || !data.owned || typeof data.owned!=='object' || Array.isArray(data.owned)) throw new Error('Choose a collection backup JSON file.');
    const reviews=window.NewCoins?NewCoins.validate(data.releaseReviews):undefined;
    const entries=Object.entries(data.owned), known=new Set(COIN_DATA.map(c=>String(c.id)));
    if(!entries.length || entries.some(([id,v])=>!(/^[0-9]+$/.test(id)||/^new-[a-f0-9]{16}-(colour|non-colour)$/.test(id))||typeof v!=='boolean') || !entries.some(([id])=>known.has(id)||Object.values(reviews||{}).some(r=>r.coins.some(c=>c.id===id)))) throw new Error('This file does not contain valid coin selections.');
    const oldReviews=window.NewCoins?.state;
    if(window.NewCoins&&data.releaseReviews!==undefined){NewCoins.state=reviews;NewCoins.apply();}
    const owned=this.read(), importedKnown=new Set(COIN_DATA.map(c=>String(c.id)));
    for(const [id,value] of entries) owned[id]=value;
    if(typeof data.owned[121]==='boolean') owned[120]=data.owned[120]===true||data.owned[121]===true;
    const saved=this.save(owned);
    if(!saved&&window.NewCoins){NewCoins.state=oldReviews;NewCoins.apply();}
    return {owned:this.read(),saved};
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
