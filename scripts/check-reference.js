async (page) => {
 // Current authored/local-VRM selection only. No filesystem reads or screenshots.
 await page.waitForFunction(()=>window.__avatarLab?.lanes?.length>0)
 await page.locator('#content').selectOption('hat');await page.locator('#bone').selectOption('head')
 if(!await page.evaluate(()=>window.__avatarLab.paused))await page.locator('#pause').click()
 await page.waitForFunction(()=>window.__avatarLab.paused&&window.__avatarLab.content==='hat'&&window.__avatarLab.boneRole==='head')
 const count=await page.locator('#lane option').count(),results=[]
 const pressReference=async()=>{
  const revision=await page.evaluate(()=>window.__avatarLab.referenceCalibration?.revision??0)
  await page.locator('#neutralReference').click()
  await page.waitForFunction(old=>window.__avatarLab.referenceCalibration?.revision>old,revision)
  return page.evaluate(()=>structuredClone(window.__avatarLab))
 }
 const setRange=async(id,number)=>{await page.locator(`#${id}`).evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))},number)}
 const nextFrames=async()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
 for(let i=0;i<count;i++){
  await page.locator('#lane').selectOption(String(i))
  await page.waitForFunction(i=>document.querySelector('#lane').selectedIndex===i&&window.__avatarLab.label===document.querySelector('#lane').selectedOptions[0].textContent,i)
  const before=await page.evaluate(()=>({head:window.__avatarLab.head,sourceQuaternion:window.__avatarLab.sourceQuaternion,settings:window.__avatarLab.settings}))
  const data=await pressReference(),reference=data.referenceCalibration
  if(data.settings.offsetSpace!=='bone'||data.settings.rotationMode!=='bone'||!data.settings.rotationOffset)throw Error('Neutral reference did not produce bone-local calibration')
  if(reference.after.neutralOrientationErrorRad>1e-6)throw Error('Reference hat does not match the intended orientation in the neutral pose')
  if(Math.abs(reference.after.modelTopClearanceM-reference.nominalClearanceM)>1e-6)throw Error('Reference does not match the documented model-top estimate')
  if(data.status!=='ready'||data.errorMm>1||data.orientationErrorRad>1e-6)throw Error('Reference tracking drifted')
  const sourceDifference=Math.max(...data.head.map((v,j)=>Math.abs(v-before.head[j])),...data.sourceQuaternion.map((v,j)=>Math.abs(v-before.sourceQuaternion[j])))
  if(sourceDifference>1e-8)throw Error('Reference sampling changed the controlled avatar pose')
  if(!/参考補正・見た目要確認/.test(await page.locator('#calibrationState').textContent()))throw Error('Reference calibration was marked as adopted')
  const controls=await page.evaluate(()=>Object.fromEntries(['avatarScale','headYaw','headPitch','headRoll','crouch'].map(id=>[id,Number(document.getElementById(id).value)])))
  const originalMotion=await page.locator('#motion').isChecked()
  await page.locator('#motion').check()
  for(const [id,value]of [['headYaw',.6],['headPitch',-.2],['headRoll',.15],['crouch',.7]])await setRange(id,value)
  // Advance actual renderer traversals at each scale before returning to the same
  // neutral sampling condition; this reproduces stale attached-bind inverses.
  for(const scale of [.65,1,1.35,controls.avatarScale]){await setRange('avatarScale',scale);await page.waitForFunction(s=>window.__avatarLab.avatarScale===s,scale);await nextFrames()}
  for(const [id,value]of Object.entries(controls))await setRange(id,value)
  if(!originalMotion)await page.locator('#motion').uncheck()
  await nextFrames()
  const repeated=await pressReference(),repeatReference=repeated.referenceCalibration
  const neutralTopRepeatDifferenceM=Math.abs(reference.modelTopY-repeatReference.modelTopY)
  const calibrationRepeatDifference=Math.max(...reference.afterSettings.offset.map((v,j)=>Math.abs(v-repeatReference.afterSettings.offset[j])),...reference.afterSettings.rotationOffset.map((v,j)=>Math.abs(v-repeatReference.afterSettings.rotationOffset[j])))
  if(neutralTopRepeatDifferenceM>1e-7||calibrationRepeatDifference>1e-7)throw Error(`Reference changed after scale/movement roundtrip: ${JSON.stringify({neutralTopRepeatDifferenceM,calibrationRepeatDifference})}`)
  if(repeatReference.revision<=reference.revision)throw Error('Reference revision did not advance')
  results.push({label:data.label,kind:data.kind,avatarId:data.avatarId,reference,repeatReference,neutralTopRepeatDifferenceM,calibrationRepeatDifference,trackingErrorMm:data.errorMm,orientationErrorRad:data.orientationErrorRad,sourceDifference})
 }
 await page.locator('#lane').selectOption('0')
 return {evidenceTier:results.every(r=>r.kind==='local-vrm')?'local-vrm-browser':'authored-fixture-browser',checks:{models:count,explicitReferenceOnly:true,neutralWorldUp:true,estimatedTopClearance:true,boneLocalTracking:true,controlledPosePreserved:true,requiresVisualReview:true,referenceRevisionAdvanced:true,neutralReferenceScaleMovementRoundTrip:true},results}
}
