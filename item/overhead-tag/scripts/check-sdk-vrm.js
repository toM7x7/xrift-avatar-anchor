async(page)=>{
 // Select one local VRM first. This check contains no private file names.
 const errors=[],onError=e=>errors.push(e.message);page.on('pageerror',onError)
 try{
  const read=()=>page.evaluate(()=>window.__sdkTagActions.snapshot()),one=d=>d.items.find(i=>i.itemId==='tag-sdk-one')
  await page.waitForFunction(()=>window.__sdkTagReadback?.modelId?.startsWith('local-vrm:sha256:'))
  await page.getByRole('checkbox',{name:'観察用カメラ（追加）',exact:true}).uncheck()
  await page.getByRole('button',{name:'1を装着',exact:true}).click()
  await page.waitForFunction(()=>window.__sdkTagActions.snapshot().items.find(i=>i.itemId==='tag-sdk-one')?.phase==='worn')
  const calibration=one(await read()).calibrationAt
  await page.waitForFunction(t=>window.__sdkTagActions.snapshot().items.find(i=>i.itemId==='tag-sdk-one')?.calibrationAt>t+.4,calibration)
  const before=await read(),gap=one(before).position[1]-one(before).calibration.headTopY
  if(Math.abs(gap-.12)>.003)throw Error('Head mesh gap differs from 12cm reference')
  await page.locator('canvas').click();await page.keyboard.down('w')
  try{await page.waitForFunction(z=>window.__sdkTagActions.snapshot().movement.position.z<z-.5,before.movement.position.z,{timeout:6000})}finally{await page.keyboard.up('w')}
  const moved=await read();await page.evaluate(()=>document.exitPointerLock())
  const bodyDelta=moved.movement.position.z-before.movement.position.z,tagDelta=one(moved).position[2]-one(before).position[2]
  if(Math.abs(bodyDelta-tagDelta)>.001)throw Error('Loaded real model tag failed SDK walk tracking')
  await page.getByRole('checkbox',{name:'観察用カメラ（追加）',exact:true}).check()
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
  const hash=before.modelId.split(':').at(-1)
  await page.screenshot({path:`artifacts/sdk-vrm-${hash.slice(0,10)}-worn-private.png`})
  await page.getByRole('button',{name:'1を外す',exact:true}).click()
  await page.waitForFunction(()=>window.__sdkTagActions.snapshot().items.find(i=>i.itemId==='tag-sdk-one')?.phase==='idle')
  if(errors.length)throw Error(JSON.stringify(errors))
  return {tier:'official-DevEnvironment-with-local-real-vrm',modelId:before.modelId,checks:{automaticMeshCalibration:true,fixed12cmReference:true,nativeSDKWalk:true,tracking:true,detach:true,noPageErrors:true},gapM:gap,bodyDeltaM:bodyDelta,tagDeltaM:tagDelta,trackingDeltaErrorMm:Math.abs(bodyDelta-tagDelta)*1000,before,moved,detached:await read(),errors,privateCapture:'Ignored artifacts/sdk-vrm-<hash>-worn-private.png',limitations:['SDK owns physics, input, contexts and item loading. VRM pose bridge is additional local test code.','No real multiplayer or Quest evidence.']}
 }finally{page.off('pageerror',onError)}
}
