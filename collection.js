// One storage format for the checklist and individual coin pages.
window.CoinCollection = {
  read() {
    let stored;
    try { stored = JSON.parse(localStorage.getItem('alex-coins-v1') || 'null'); } catch {}
    const previous = stored?.owned && typeof stored.owned === 'object' ? {...stored.owned} : {};
    for (const [from, to] of [[110,112],[83,191],[192,84]]) {
      if (previous[from] === true) previous[to] = true;
    }
    return Object.fromEntries(COIN_DATA.map(c => [c.id, typeof previous[c.id] === 'boolean' ? previous[c.id] : c.owned]));
  },
  save(owned) {
    try { localStorage.setItem('alex-coins-v1', JSON.stringify({owned})); return true; }
    catch { return false; }
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
