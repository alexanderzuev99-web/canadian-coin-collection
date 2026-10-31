(()=>{
 const $=s=>document.querySelector(s);let feed={candidates:[]};
 const element=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 const open=()=>{$('#newCoinsPanel').hidden=false;$('#openNewCoins').setAttribute('aria-expanded','true');$('#newCoinsTitle').scrollIntoView({block:'start',behavior:'smooth'});};
 $('#openNewCoins').onclick=open;
 $('#closeNewCoins').onclick=()=>{$('#newCoinsPanel').hidden=true;$('#openNewCoins').setAttribute('aria-expanded','false');$('#openNewCoins').focus();};
 function renderReviews(){
  const candidates=feed.candidates.filter(c=>!NewCoins.state[c.id]||NewCoins.state[c.id].status==='pending');
  $('#newCoinCount').textContent=candidates.length?'('+candidates.length+')':'';
  const cards=$('#newCoinReviews');cards.replaceChildren();
  if(!candidates.length)cards.append(element('p','No new releases are awaiting your review. The weekly Mint check will put new announcements here.','reviewEmpty'));
  for(const c of candidates){
   const article=element('article',null,'reviewCard');article.append(element('h3',c.title));
   if(c.image){const img=element('img');img.src=c.image;img.alt='Official Mint announcement image; may show several products';img.loading='lazy';img.onerror=()=>img.remove();article.append(img,element('small','Royal Canadian Mint · announcement image, not a verified variant photograph.','sourceNote'));}
   article.append(element('p',c.evidence||'New official Mint release. Check the details before adding it.'));
   const source=element('a','Read the official Mint release ↗','imageSource');source.href=c.url;source.target='_blank';source.rel='noopener noreferrer';article.append(source);
   const form=element('form');form.innerHTML='<label>Coin name<input name="coinName" required maxlength="160" autocomplete="off"></label><div class="reviewFields"><label>Coin year<input name="year" type="number" min="1987" required></label><label>Denomination<select name="denomination" required><option value="">Choose…</option><option>5¢</option><option>10¢</option><option>25¢</option><option>$1</option><option>$2</option></select></label></div><label>Circulation variants to add<select name="variants" required><option value="">Check the source and choose…</option><option value="non-colour">Non-colour</option><option value="colour">Colour</option><option value="both">Colour and non-colour</option></select></label><label class="reviewConfirm"><input name="confirmed" type="checkbox" required>I checked the Mint source: these are base-metal coins released for general circulation, not silver or collector-only issues, and not already in my checklist.</label><div class="reviewActions"><button type="submit" class="randomButton">Add to my checklist</button><button type="button" class="skipRelease">Skip</button></div><p class="reviewMessage" role="status"></p>';
   form.elements.coinName.value=c.name||c.title.slice(0,160);form.elements.year.max=new Date().getFullYear()+1;if(c.year)form.elements.year.value=c.year;if(c.denomination)form.elements.denomination.value=c.denomination;
   form.onsubmit=e=>{e.preventDefault();if(!form.reportValidity())return;try{
    const variants=form.elements.variants.value==='both'?['colour','non-colour']:[form.elements.variants.value];
    NewCoins.decide(c,'accepted',variants.map(variant=>({id:`new-${c.id}-${variant}`,name:form.elements.coinName.value.trim(),year:Number(form.elements.year.value),denomination:form.elements.denomination.value,variant})));
    CoinCollection.notify($('#saveStatus'),'Added to your personal checklist as Missing. Saved in this browser.',true);renderReviews();
   }catch(error){form.querySelector('.reviewMessage').textContent=error.message;}};
   form.querySelector('.skipRelease').onclick=()=>{try{NewCoins.decide(c,'skipped');renderReviews();}catch(error){form.querySelector('.reviewMessage').textContent=error.message;}};
   article.append(form);cards.append(article);
  }
  const previous=$('#previousCoinReviews');previous.replaceChildren();
  for(const [id,r] of Object.entries(NewCoins.state))if(r.status!=='pending'){
   const row=element('div',null,'previousRelease');row.append(element('span',r.title+' · '+(r.status==='accepted'?'Added':'Skipped')));
   if(r.status==='skipped'){const undo=element('button','Review again');undo.onclick=()=>{try{NewCoins.decide({id,...r},'pending');if(!feed.candidates.some(c=>c.id===id))feed.candidates.push({id,...r});renderReviews();}catch(error){CoinCollection.notify($('#saveStatus'),error.message);}};row.append(undo);}
   previous.append(row);
  }
  if(!previous.children.length)previous.append(element('p','No decisions yet.'));
 }
 function parseFeed(data){
  if(!data||data.version!==1||!Array.isArray(data.candidates)||data.candidates.length>1000||!data.checkedAt||!Number.isFinite(Date.parse(data.checkedAt)))throw Error('Invalid release feed.');
  const seen=new Set();data.candidates=data.candidates.map(c=>{
   if(!c||!/^[a-f0-9]{16}$/.test(c.id)||seen.has(c.id)||!NewCoins.mintURL(c.url)||typeof c.title!=='string')throw Error('Invalid release announcement.');seen.add(c.id);
   const image=NewCoins.mintURL(c.image);return {id:c.id,url:NewCoins.mintURL(c.url),title:c.title.slice(0,240),name:typeof c.name==='string'?c.name.slice(0,160):'',year:Number.isInteger(c.year)?c.year:undefined,denomination:['5¢','10¢','25¢','$1','$2'].includes(c.denomination)?c.denomination:'',image:image&&new URL(image).pathname.startsWith('/globalassets/')?image:'',evidence:String(c.evidence||'').slice(0,300)};
  });return data;
 }
 async function getFeed(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(url,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Feed unavailable');return parseFeed(await response.json());}finally{clearTimeout(timer);}}
 async function load(){
  let fallback=false;
  try{feed=await getFeed('https://raw.githubusercontent.com/alexanderzuev99-web/canadian-coin-collection/release-feed/new-coins-feed.json');}
  catch{fallback=true;try{feed=await getFeed('new-coins-feed.json');}catch{$('#newCoinsFeedStatus').textContent='Could not load the Mint check. Your saved collection and decisions are safe. Please try again later.';renderReviews();return;}}
  const date=new Date(feed.checkedAt);$('#newCoinsFeedStatus').textContent=(fallback?'Latest saved check: ':'Last Mint check: ')+date.toLocaleString('en-CA',{dateStyle:'medium',timeStyle:'short'})+(fallback?' · Live feed unavailable.':'');
  for(const [id,r] of Object.entries(NewCoins.state))if(r.status==='pending'&&!feed.candidates.some(c=>c.id===id))feed.candidates.push({id,...r});
  renderReviews();
 }
 window.addEventListener('coin-catalogue-change',renderReviews);
 window.addEventListener('storage',e=>{if(e.key===CoinCollection.key||e.key===CoinCollection.backupKey){NewCoins.reload();renderReviews();}});
 renderReviews();load();
})();
