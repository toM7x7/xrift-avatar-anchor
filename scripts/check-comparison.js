async (page) => {
 const errors=[],nonGet=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')nonGet.push(r.method())})
 await page.setViewportSize({width:1600,height:1000})
 await page.reload()
 await page.waitForFunction(()=>window.__avatarLab?.lanes?.length===5&&window.__avatarLab.lanes.every(l=>l.status==='ready'))
 const before=await page.evaluate(()=>structuredClone(window.__avatarLab))
 await page.waitForFunction(t=>window.__avatarLab.elapsed>t+.5,before.elapsed)
 const after=await page.evaluate(()=>structuredClone(window.__avatarLab))
 if(after.lanes.every((l,i)=>JSON.stringify(l.head)===JSON.stringify(before.lanes[i].head)))throw Error('Parallel motion did not advance')
 await page.getByRole('button',{name:'動きを停止',exact:true}).click()
 const frozen=await page.evaluate(()=>window.__avatarLab.elapsed)
 await page.evaluate(()=>new Promise(resolve=>{let n=0;function frame(){if(++n===5)resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)}))
 if(await page.evaluate(()=>window.__avatarLab.elapsed)!==frozen)throw Error('Pause did not hold the pose')
 const offGrid={offset:[.123,.234567,-.07123],offsetSpace:'world',rotationMode:'world-up',scale:.83}
 await page.locator('#settings').fill(JSON.stringify(offGrid));await page.locator('#import').click();await page.locator('#export').click()
 if(JSON.stringify(JSON.parse(await page.locator('#settings').inputValue()))!==JSON.stringify(offGrid))throw Error('Imported calibration was snapped to slider increments')
 await page.locator('#x').evaluate(input=>{input.value=.035;input.dispatchEvent(new Event('input',{bubbles:true}))})
 await page.locator('#lane').selectOption('1')
 await page.waitForFunction(()=>window.__avatarLab.label.startsWith('S02'))
 if(await page.evaluate(()=>window.__avatarLab.settings.offset[0])!==0)throw Error('Calibration leaked across avatars')
 await page.locator('#lane').selectOption('0')
 await page.waitForFunction(()=>window.__avatarLab.settings.offset[0]===.035)
 await page.getByText('モデル別プロファイル v1',{exact:true}).click()
 await page.locator('#exportProfile').click()
 const profile=JSON.parse(await page.locator('#profileJSON').inputValue())
 if(profile.version!==1||profile.avatarId!=='fixture:standard')throw Error('Versioned profile missing identity')
 await page.locator('#lane').selectOption('1')
 await page.locator('#importProfile').click()
 if(!/一致しない/.test(await page.locator('#message').textContent()))throw Error('Mismatched profile was not rejected')
 await page.locator('#lane').selectOption('0')
 await page.locator('#importProfile').click()
 if(!/一致するモデル/.test(await page.locator('#message').textContent()))throw Error('Matching profile did not import')
 const checks={parallelFixtures:5,motion:true,pause:true,calibrationIsolation:true,offGridSettingsRoundTrip:true,profileRoundTrip:true,mismatchedProfileRejected:true}
 for(const [content,bone]of [['hat','head'],['orb','leftHand'],['tag','chest']]){
  await page.locator('#content').selectOption(content);await page.locator('#bone').selectOption(bone)
  await page.waitForFunction(([c,b])=>window.__avatarLab.content===c&&window.__avatarLab.lanes.every(l=>l.boneRole===b&&l.status==='ready'),[content,bone])
  const data=await page.evaluate(()=>structuredClone(window.__avatarLab))
  if(data.lanes.some(l=>l.errorMm>1||l.orientationErrorRad>1e-6))throw Error(`${content}/${bone} drifted`)
  checks[`${content}/${bone}`]=true
 }
 await page.locator('#bone').selectOption('head');await page.locator('#content').selectOption('hat')
 await page.locator('#rotation').selectOption('camera-facing')
 await page.waitForFunction(()=>window.__avatarLab.settings.rotationMode==='camera-facing'&&window.__avatarLab.status==='ready')
 checks.cameraFacing=true
 await page.locator('#content').selectOption('tag')
 await page.locator('#controls').evaluate(el=>el.scrollTop=0)
 await page.screenshot({path:'docs/screenshots/anchor-comparison.png'})
 if(errors.length||nonGet.length)throw Error(JSON.stringify({errors,nonGet}))
 checks.noPageErrors=true;checks.noNonGetRequests=true
 return {checks,maxErrorMm:Math.max(...after.lanes.map(l=>l.errorMm)),maxOrientationErrorRad:Math.max(...after.lanes.map(l=>l.orientationErrorRad)),models:after.lanes.map(l=>({id:l.avatarId,kind:l.kind})),evidenceTier:'authored-fixture-browser',errors,nonGet}
}
