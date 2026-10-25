async (page) => {
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')requests.push(r.method())})
 await page.setViewportSize({width:1440,height:1100})
 await page.getByRole('combobox',{name:'検証用の体格',exact:true}).selectOption('small')
 await page.waitForFunction(()=>window.__avatarLab?.profile==='small')
 const settings={offset:[.03,.18,-.06],offsetSpace:'world',rotationMode:'camera-facing',scale:.7}
 await page.getByRole('textbox',{name:'アンカー設定JSON'}).fill(JSON.stringify(settings))
 await page.getByRole('button',{name:'設定を読み込む',exact:true}).click()
 await page.waitForFunction(()=>window.__avatarLab?.settings?.offset?.[2]===-.06)
 await page.getByRole('button',{name:'設定を書き出す',exact:true}).click()
 const actual=JSON.parse(await page.getByRole('textbox',{name:'アンカー設定JSON'}).inputValue())
 if(JSON.stringify(actual)!==JSON.stringify(settings))throw Error('Settings round-trip mismatch')
 await page.getByRole('combobox',{name:'表示内容',exact:true}).selectOption('離席中')
 await page.getByRole('slider',{name:'頭の左右',exact:true}).press('End')
 const small=await page.evaluate(()=>structuredClone(window.__avatarLab))
 if(Math.abs(small.position[2]-small.head[2]+.06)>1e-8)throw Error('Forward offset missing')
 await page.locator('#controls').evaluate(el=>el.scrollTop=0)
 await page.screenshot({path:'docs/screenshots/anchor-demo.png'})
 if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}))
 await page.getByRole('combobox',{name:'検証用の体格',exact:true}).selectOption('standard')
 return {checks:{smallAvatarAdjustment:true,settingsRoundTrip:true,statusSwitch:true,headRotation:true,noPageErrors:true,noNonGetRequests:true},small}
}
