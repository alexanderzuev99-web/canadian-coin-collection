const $=s=>document.querySelector(s);
const id=new URLSearchParams(location.search).get('id');
const coin=[...COIN_DATA,...COIN_REFERENCES].find(c=>String(c.id)===id);
$('#randomCoin').onclick=()=>CoinCollection.openRandom(id);
if(!coin || !COIN_STORIES[id]) {
  $('#notFound').hidden=false;
} else {
  const story=COIN_STORIES[id], image=COIN_IMAGES[id], reference=COIN_REFERENCES.includes(coin);
  document.title=`${coin.name} · ${coin.year} · Canadian Coin Collection`;
  $('#coinDetail').hidden=false;
  $('#coinMeta').textContent=`${coin.denomination} · ${reference?'STANDARD REFERENCE':coin.year+' · CIRCULATION ISSUE'}`;
  $('#coinTitle').textContent=coin.name;
  $('#coinVariant').textContent=coin.variant;
  for(const [target,field] of [['#coinIssued','issued'],['#coinWhy','why'],['#coinDesign','design'],['#coinVersion','variant']]) $(target).textContent=story[field];
  $('#detailPhoto').src=image.image+'?v=20261008c';
  $('#detailPhoto').alt=`${coin.year} ${coin.name} — ${coin.variant}, reverse`;
  if(image.crop){const [x,y,w,h,W,H]=image.crop;$('#detailPhotoFrame').className='cropped';$('#detailPhotoFrame').setAttribute('style',`--crop-ratio:${w}/${h};--image-width:${W/w*100}%;--image-height:${H/h*100}%;--image-left:${-x/w*100}%;--image-top:${-y/h*100}%`);}
  $('#detailPhoto').onerror=()=>{$('#detailPhotoFrame').hidden=true;$('#imageNote').textContent='Image unavailable. Open the original source below to view this coin.';};
  $('#imageSource').href=image.sourcePage;
  $('#imageSource').textContent=`Image source: ${image.credit} ↗`;
  $('#imageNote').textContent=image.note||'';
  if(image.licenseUrl){const a=document.createElement('a');a.href=image.licenseUrl;a.textContent=image.license;a.className='imageSource';a.target='_blank';a.rel='noopener noreferrer';$('#imageSource').after(a);}
  for(const source of story.sources){const li=document.createElement('li'),a=document.createElement('a');a.href=source.url;a.textContent=source.title;a.target='_blank';a.rel='noopener noreferrer';li.append(a);$('#storySources').append(li);}
  const related=COIN_DATA.filter(c=>c.id!==coin.id && c.year===coin.year && c.name===coin.name);
  for(const other of related){const a=document.createElement('a');a.href='coin.html?id='+other.id;a.textContent=other.denomination+' · '+other.variant;a.className='relatedLink';$('#relatedCoins').append(a);}
  $('#relatedSection').hidden=!related.length;
  let owned=CoinCollection.read();
  function refresh(){const collected=!!owned[coin.id];$('#collectionButton').textContent=collected?'✓ In my collection':'+ Add to collection';$('#collectionButton').setAttribute('aria-pressed',String(collected));$('#collectionButton').classList.toggle('collected',collected);}
  $('#collectionButton').hidden=reference;
  if(reference)$('#collectionStatus').textContent='Reference only · excluded from collection progress';
  else {
    refresh();
    $('#collectionButton').onclick=()=>{owned={...CoinCollection.read(),[coin.id]:!owned[coin.id]};refresh();$('#collectionStatus').textContent=CoinCollection.save(owned)?'Saved on this device.':'Browser storage is unavailable. Changes will last for this visit only.';};
    window.addEventListener('pageshow',()=>{owned=CoinCollection.read();refresh();});
    window.addEventListener('storage',e=>{if(e.key==='alex-coins-v1'){owned=CoinCollection.read();refresh();}});
  }
}
