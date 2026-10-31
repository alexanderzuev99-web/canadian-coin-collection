// Personal release decisions live in the same backed-up snapshot as ownership.
window.NewCoins = {
  originals: new Set(COIN_DATA.map(c=>String(c.id))),
  state: {},
  mintURL(value) {
    try {const u=new URL(value);return u.protocol==='https:'&&['www.mint.ca','mint.ca'].includes(u.hostname)&&!u.username&&!u.password?u.href:'';}catch{return '';}
  },
  validate(value) {
    if(value===undefined)return {};
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>1000)throw Error('Invalid new-coin decisions in this backup.');
    const result={};
    for(const [id,r] of Object.entries(value)){
      if(!/^[a-f0-9]{16}$/.test(id)||!r||!['accepted','skipped','pending'].includes(r.status)||!this.mintURL(r.url))throw Error('Invalid new-coin decision.');
      const coins=r.coins||[];
      if(!Array.isArray(coins)||coins.length>2)throw Error('Invalid new-coin variants.');
      const clean=[];
      for(const c of coins){
        if(!c||!['colour','non-colour'].includes(c.variant)||c.id!==`new-${id}-${c.variant}`||!['5¢','10¢','25¢','$1','$2'].includes(c.denomination)||!Number.isInteger(c.year)||c.year<1987||c.year>new Date().getFullYear()+1||typeof c.name!=='string'||!c.name.trim()||c.name.length>160)throw Error('Invalid coin details.');
        clean.push({id:c.id,name:c.name.trim(),year:c.year,denomination:c.denomination,variant:c.variant});
      }
      if(new Set(clean.map(c=>c.id)).size!==clean.length||(r.status==='accepted'&&!clean.length))throw Error('Invalid new-coin variants.');
      result[id]={status:r.status,url:this.mintURL(r.url),title:String(r.title||'Mint release').slice(0,240),coins:clean};
    }
    return result;
  },
  apply() {
    for(let i=COIN_DATA.length-1;i>=0;i--)if(!this.originals.has(String(COIN_DATA[i].id)))COIN_DATA.splice(i,1);
    for(const map of [COIN_IMAGES,window.COIN_STORIES||{}])for(const id of Object.keys(map))if(id.startsWith('new-'))delete map[id];
    window.COIN_STORIES ||= {};
    for(const r of Object.values(this.state))if(r.status==='accepted')for(const c of r.coins){
      COIN_DATA.push({...c,variant:c.variant==='colour'?'Colour':'Non-colour',series:'Personal additions',owned:false});
      COIN_IMAGES[c.id]={image:'',sourcePage:r.url,credit:'Royal Canadian Mint',status:'source-pending',note:'Personal addition. An exact reverse photograph has not yet been verified; view the official release.'};
      COIN_STORIES[c.id]={issued:String(c.year),why:'This commemorative circulation issue was added to your personal checklist after you reviewed the Royal Canadian Mint announcement. See the official release for the event being commemorated.',design:'The exact reverse photograph and detailed design notes are pending verification. The official Mint release is linked below.',variant:(c.variant==='colour'?'Colour':'Non-colour')+' circulation variant selected by you. This personal addition is saved in this browser.',sources:[{title:'Official Mint release',url:r.url}]};
    }
  },
  decide(candidate,status,details) {
    const next={...this.state,[candidate.id]:{status,url:candidate.url,title:candidate.title,coins:details||this.state[candidate.id]?.coins||[]}};
    const clean=this.validate(next);
    if(status==='accepted')for(const c of clean[candidate.id].coins){
      const duplicate=COIN_DATA.find(x=>!String(x.id).startsWith('new-'+candidate.id+'-')&&x.year===c.year&&x.denomination===c.denomination&&x.name.toLowerCase().replace(/[^a-z0-9]/g,'')===c.name.toLowerCase().replace(/[^a-z0-9]/g,'')&&(/^colour\b/i.test(x.variant))===(c.variant==='colour'));
      if(duplicate)throw Error('This coin and variant are already in your checklist.');
    }
    const old=this.state;this.state=clean;this.apply();
    if(!CoinCollection.save(CoinCollection.read())){this.state=old;this.apply();throw Error('Browser storage is unavailable. Nothing was added; export a backup before leaving.');}
    window.dispatchEvent(new Event('coin-catalogue-change'));
  },
  reload() {try{this.state=this.validate(CoinCollection.snapshot().releaseReviews);}catch{this.state={};}this.apply();}
};
NewCoins.reload();
