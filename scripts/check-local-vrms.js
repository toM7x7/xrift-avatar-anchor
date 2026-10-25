async (page) => {
 // First select three local VRMs in the browser. Run from the repository directory.
 // The script deliberately contains no private input names; captures are ignored.
 const outputDir='artifacts'
 const errors=[],nonGet=[]
 const onError=error=>errors.push(String(error.message)),onRequest=request=>{if(request.method()!=='GET')nonGet.push(request.method())}
 page.on('pageerror',onError);page.on('request',onRequest)
 try{
  await page.setViewportSize({width:1600,height:1000})
  await page.waitForFunction(()=>window.__avatarLab?.profile==='local-vrm'&&window.__avatarLab.lanes.length===3&&window.__avatarLab.lanes.every(l=>l.status==='ready'),null,{timeout:60000})
  if(await page.locator('#pause').textContent()==='動きを再開')await page.locator('#pause').click()
  const before=await page.evaluate(()=>structuredClone(window.__avatarLab))
  await page.waitForFunction(t=>window.__avatarLab.elapsed>t+.6,before.elapsed)
  const moved=await page.evaluate(()=>structuredClone(window.__avatarLab))
  if(moved.lanes.some((lane,i)=>JSON.stringify(lane.head)===JSON.stringify(before.lanes[i].head)))throw Error('At least one real model did not move')
  await page.locator('#pause').click()
  const observations=[]
  for(const [content,bone]of [['tag','head'],['hat','head'],['orb','leftHand'],['tag','chest']]){
   await page.locator('#content').selectOption(content);await page.locator('#bone').selectOption(bone)
   for(const avatarScale of [.65,1,1.35]){
    await page.locator('#avatarScale').evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))},avatarScale)
    await page.waitForFunction(([c,b,s])=>window.__avatarLab.content===c&&window.__avatarLab.avatarScale===s&&window.__avatarLab.lanes.every(l=>l.boneRole===b&&l.status==='ready'),[content,bone,avatarScale])
    const state=await page.evaluate(()=>structuredClone(window.__avatarLab))
    if(state.lanes.some(l=>l.errorMm>1||l.orientationErrorRad>1e-5))throw Error('Live VRM anchor drift exceeds threshold')
    observations.push({content,bone,avatarScale,models:state.lanes.map(l=>({avatarId:l.avatarId,label:l.label,position:l.position,settings:l.settings,errorMm:l.errorMm,orientationErrorRad:l.orientationErrorRad,worldScale:l.worldScale}))})
   }
  }
  await page.locator('#bone').selectOption('head');await page.locator('#content').selectOption('hat')
  await page.locator('#controls').evaluate(el=>el.scrollTop=0)
  await page.screenshot({path:outputDir+'/local-vrms-hat-private.png'})
  await page.locator('#content').selectOption('tag');await page.locator('#front').click()
  await page.locator('#avatarScale').evaluate(input=>{input.value=1;input.dispatchEvent(new Event('input',{bubbles:true}))})
  await page.waitForFunction(()=>window.__avatarLab.avatarScale===1&&window.__avatarLab.content==='tag')
  await page.screenshot({path:outputDir+'/local-vrms-tag-private.png'})
  if(errors.length||nonGet.length)throw Error(JSON.stringify({errors,nonGet}))
  return {evidenceTier:'local-real-vrm-browser',runtime:'GLTFLoader + three-vrm raw humanoid simplified pose; no live XRift/Quest',modelCount:3,checks:{parallelRendering:true,allModelsMoving:true,headTag:true,headHat:true,chestTag:true,leftHandItem:true,threeAvatarScales:true,noPageErrors:true,noNonGetRequests:true},observations,errors,nonGet,captures:'Ignored artifacts/local-vrms-*-private.png; not public deliverables',visualFit:'Uncalibrated probes; human fit acceptance remains separate'}
 }finally{page.off('pageerror',onError);page.off('request',onRequest)}
}
