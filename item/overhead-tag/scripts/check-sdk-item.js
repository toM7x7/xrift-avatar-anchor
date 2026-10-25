async (page)=>{
 const errors=[],nonGet=[],onError=e=>errors.push(e.message),onRequest=r=>{if(r.method()!=='GET')nonGet.push({method:r.method(),url:new URL(r.url()).pathname})}
 page.on('pageerror',onError);page.on('request',onRequest)
 try{
  await page.setViewportSize({width:1600,height:1000});await page.reload()
  await page.waitForFunction(()=>window.__sdkTagReadback?.items.length===2&&window.__sdkTagReadback.movement.isGrounded)
  const declaration=await page.evaluate(async()=>{const r=await fetch('/__xrift/world-items');return {status:r.status,...await r.json()}})
  if(declaration.status!==200||!declaration.items?.includes('00000000-0000-4000-8000-000000000001'))throw Error('Official declaration proxy is not configured')
  const read=()=>page.evaluate(()=>window.__sdkTagActions.snapshot()),one=data=>data.items.find(i=>i.itemId==='tag-sdk-one'),two=data=>data.items.find(i=>i.itemId==='tag-sdk-two')
  const idle=await read()
  // Real SDK center-ray interaction, with a test-only explicit camera aim.
  await page.getByRole('button',{name:'台座へ向く（クリック確認用）',exact:true}).click()
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
  await page.locator('canvas').click()
  await page.waitForFunction(()=>window.__sdkTagActions.snapshot().items.find(i=>i.itemId==='tag-sdk-one')?.phase==='worn')
  const equipped=await read(),locked=await page.evaluate(()=>!!document.pointerLockElement)
  if(two(equipped).phase!=='idle')throw Error('First placement changed the second placement')
  await page.keyboard.down('w')
  try{await page.waitForFunction(z=>window.__sdkTagActions.snapshot().movement.position.z<z-.7,equipped.movement.position.z,{timeout:6000})}finally{await page.keyboard.up('w')}
  const moved=await read();await page.evaluate(()=>document.exitPointerLock());await page.waitForFunction(()=>!document.pointerLockElement)
  const bodyDelta=moved.movement.position.z-equipped.movement.position.z,headDelta=one(moved).head[2]-one(equipped).head[2],tagDelta=one(moved).position[2]-one(equipped).position[2]
  if(!locked||Math.abs(bodyDelta-headDelta)>.001||Math.abs(headDelta-tagDelta)>.001)throw Error('Official walk and head/tag motion diverged')
  await page.getByRole('button',{name:'1の表示切替',exact:true}).click()
  await page.waitForFunction(()=>window.__sdkTagActions.snapshot().items.find(i=>i.itemId==='tag-sdk-one')?.statusIndex===1)
  await page.getByRole('button',{name:'2を装着',exact:true}).click()
  await page.waitForFunction(()=>window.__sdkTagActions.snapshot().items.every(i=>i.phase==='worn'))
  await page.getByRole('button',{name:'1を外す',exact:true}).click()
  await page.waitForFunction(()=>window.__sdkTagActions.snapshot().items.find(i=>i.itemId==='tag-sdk-one')?.phase==='idle')
  if(two(await read()).phase!=='worn')throw Error('Detach leaked into another placement')
  await page.getByRole('button',{name:'2を外す',exact:true}).click()
  await page.getByRole('button',{name:'1を装着',exact:true}).click()
  await page.waitForFunction(()=>window.__sdkTagActions.snapshot().items.find(i=>i.itemId==='tag-sdk-one')?.phase==='worn')
  const beforeMissing=await read()
  await page.getByRole('checkbox',{name:'検証骨格を表示',exact:true}).uncheck()
  await page.waitForFunction(()=>window.__sdkTagActions.snapshot().items.find(i=>i.itemId==='tag-sdk-one')?.phase==='pending')
  const missing=await read()
  await page.getByRole('checkbox',{name:'検証骨格を表示',exact:true}).check()
  await page.waitForFunction(()=>window.__sdkTagActions.snapshot().items.find(i=>i.itemId==='tag-sdk-one')?.phase==='worn')
  await page.getByRole('checkbox',{name:'曖昧な別骨格を追加',exact:true}).check()
  await page.waitForFunction(()=>window.__sdkTagActions.snapshot().items.find(i=>i.itemId==='tag-sdk-one')?.reason==='ambiguous-head')
  const ambiguous=await read()
  await page.getByRole('checkbox',{name:'曖昧な別骨格を追加',exact:true}).uncheck()
  await page.waitForFunction(()=>window.__sdkTagActions.snapshot().items.find(i=>i.itemId==='tag-sdk-one')?.phase==='worn')
  const scales=[]
  for(const scale of [.6,1.4,1]){
   const prior=one(await read()).calibrationAt
   await page.getByRole('slider',{name:'アバター倍率',exact:true}).evaluate((el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))},scale)
   await page.waitForFunction(old=>window.__sdkTagActions.snapshot().items.find(i=>i.itemId==='tag-sdk-one')?.calibrationAt>old+.4,prior)
   const snapshot=await read(),report=one(snapshot)
   if(Math.abs((report.head[1]-snapshot.movement.position.y)-1.54*scale)>.001)throw Error('The authored avatar scale control did not update')
   scales.push({scale,report})
  }
  await page.getByRole('checkbox',{name:'観察用カメラ（追加）',exact:true}).check()
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
  await page.screenshot({path:'docs/screenshots/official-sdk-tag-equipped.png'})
  await page.getByRole('button',{name:'1を外す',exact:true}).click()
  await page.waitForFunction(()=>window.__sdkTagActions.snapshot().items.every(i=>i.phase==='idle'))
  const detached=await read()
  if(errors.length||nonGet.length)throw Error(JSON.stringify({errors,nonGet}))
  return {tier:idle.delivery==='published-v2-federation'?'official-DevEnvironment-with-published-v2-and-authored-rig':'official-DevEnvironment-with-authored-rig',sdk:'0.58.0',checks:{officialItemInjection:idle.delivery!=='published-v2-federation',publishedFederation:idle.delivery==='published-v2-federation',declarationProxy:true,nativeCenterRayEquip:true,nativePointerLock:locked,nativePhysicsWalk:true,follow:true,statusSwitch:true,twoPlacementIsolation:true,detach:true,reattach:true,missingHeadHidden:true,ambiguousHeadHidden:true,automaticScaleRecalibration:true,noPageErrors:true,noNonGetRequests:true},movement:{bodyDelta,headDelta,tagDelta,trackingDeltaErrorMm:Math.abs(headDelta-tagDelta)*1000},idle,equipped,moved,beforeMissing,missing,ambiguous,scales,detached,errors,nonGet,limitations:['Additional authored skinned avatar follows SDK movement; default SDK avatar has no skeleton.','Observer camera is test-only; SDK itself is first-person.','Single local user; no real multiplayer/Quest evidence.']}
 }finally{page.off('pageerror',onError);page.off('request',onRequest)}
}
