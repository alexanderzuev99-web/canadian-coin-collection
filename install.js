// Installation uses the manifest and Apple touch icon. Request durable storage
// where supported, without changing or clearing the existing collection key.
if(navigator.storage && navigator.storage.persisted && navigator.storage.persist){
 navigator.storage.persisted().then(persisted=>{if(!persisted)return navigator.storage.persist();}).catch(()=>{});
}
