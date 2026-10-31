// Release/program groups, scoped to denomination. Colour variants stay together.
window.CoinCategories = {
  forCoin(c) {
    if(c.year===2017 && c.name.startsWith('Canada 150')) return 'Canada 150 · 2017';
    const groups={
      'Canada 125':'Canada 125 · 1992',
      'Millennium 1999':'Millennium · 1999',
      'Millennium 2000':'Millennium · 2000',
      'Vancouver 2010':'Vancouver 2010 · 2007–2010',
      'Legendary Nature':'Legendary Nature · 2011',
      'War of 1812':'War of 1812 · 2012–2013',
      'Bluenose 100':'Bluenose centenary · 2021',
      '10th Anniversary':'Toonie 10th anniversary · 2006'
    };
    if(groups[c.series]) return groups[c.series];
    if([84,191].includes(c.id)) return 'Arctic Expedition & Life in the North · 2013';
    if(COIN_DATA.filter(x=>x.denomination===c.denomination && x.name===c.name && x.year===c.year).length>1) return c.name+' · '+c.year;
    return 'Other commemoratives';
  },
  key(c) { return c.denomination+'|'+this.forCoin(c); },
  groups(coins) {
    const groups=new Map();
    for(const c of coins){const key=this.key(c);if(!groups.has(key))groups.set(key,{key,title:this.forCoin(c),denomination:c.denomination,coins:[]});groups.get(key).coins.push(c);}
    const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    for(const g of groups.values()) if(g.title==='Millennium · 1999')g.coins.sort((a,b)=>months.findIndex(m=>a.name.includes('– '+m+':'))-months.findIndex(m=>b.name.includes('– '+m+':')));
    return [...groups.values()];
  }
};
