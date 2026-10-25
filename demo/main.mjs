import {createStage,commonControls,bindActorControls,value,showMetrics} from './common.mjs'
import {normalizeAnchorSettings,updateAnchor,normalizeAttachmentProfile,serializeAttachmentProfile,resolveAttachmentProfile} from '../src/index.mjs'
import {refreshSkinnedBounds} from './skinning.mjs'

commonControls('アバター装着の比較実験','頭上タグ・被りもの・小物を並べ、体格・骨の原点・軸の違いを観察します。補正はモデルと部位ごとに独立します。')
document.querySelector('#specific').innerHTML=`<label>装着するもの<select id="content"><option value="tag">頭上タグ</option><option value="hat">被りもの</option><option value="orb">小物・マーカー</option></select></label><label>追従する部位<select id="bone"><option value="head">頭</option><option value="chest">胸</option><option value="leftHand">左手</option></select></label><label>表示内容<select id="status"><option>作業中</option><option>離席中</option><option>取り込み中</option></select></label><p id="calibrationState" class="note"></p>${[['x','左右',0],['y','高さ',.22],['z','前後',0]].map(([id,label,n])=>`<label>${label}（m）<input id="${id}" type="range" min="-1" max="1" step=".005" value="${n}"><output id="${id}Out"></output></label>`).join('')}<label>表示サイズ<input id="size" type="range" min=".05" max="3" step=".05" value="1"></label><label>オフセット基準<select id="space"><option value="world">ワールド軸</option><option value="bone">選んだ骨のローカル軸</option><option value="head">頭の骨の軸（旧設定互換）</option></select></label><label>表示方向<select id="rotation"><option value="world-up">水平を保つ</option><option value="camera-facing">観察者へ向く</option><option value="bone">選んだ骨に追従</option><option value="head">頭に追従する（旧設定互換）</option></select></label><button id="reset">位置を初期化</button><details open><summary>補正値のJSON</summary><p class="note">補正値だけを明示的に移すための旧形式です。適用先は選択モデルです。</p><button id="export">設定を書き出す</button><button id="import">設定を読み込む</button><textarea id="settings" rows="4" aria-label="アンカー設定JSON"></textarea></details><details><summary>モデル別プロファイル v1</summary><p class="note">モデルID・小物・部位を含みます。一致しないモデルへの読込は拒否します。ページを閉じる前にJSONを保存してください。</p><button id="exportProfile">プロファイルを書き出す</button><button id="importProfile">プロファイルを読み込む</button><textarea id="profileJSON" rows="8" aria-label="装着プロファイルJSON"></textarea></details>`
const stage=createStage(),{THREE}=stage,settingsByKey=new Map(),confirmedKeys=new Set(),referenceByKey=new Map(),visuals=new Map()
const $=id=>document.getElementById(id),message=text=>$('message').textContent=text
let selectedKey='',rotationOffset,previousList='',lastMetrics=0,referenceRevision=0
const content=()=>$('content').value,boneRole=()=>$('bone').value,attachmentId=()=>`${content()}:${boneRole()}`,keyFor=actor=>`${actor.id}|${content()}|${boneRole()}`
function defaultConfig(){return normalizeAnchorSettings(content()==='tag'?{offset:[0,.22,0]}:content()==='hat'?{offset:[0,.2,0],offsetSpace:'bone',rotationMode:'bone',scale:1}:{offset:[0,.08,0],offsetSpace:'bone',rotationMode:'bone',scale:1})}
function config(){return normalizeAnchorSettings({offset:[value('x'),value('y'),value('z')],scale:value('size'),offsetSpace:$('space').value,rotationMode:$('rotation').value,...(rotationOffset?{rotationOffset}:{})})}
function setConfig(c){const v=normalizeAnchorSettings(c);['x','y','z'].forEach((id,i)=>{const input=$(id);input.step='any';input.min=Math.min(-1,v.offset[i]);input.max=Math.max(1,v.offset[i]);input.value=v.offset[i]});$('size').step='any';$('size').min=Math.min(.05,v.scale);$('size').max=Math.max(3,v.scale);$('size').value=v.scale;$('space').value=v.offsetSpace;$('rotation').value=v.rotationMode;rotationOffset=v.rotationOffset}
function saveSelection(){if(selectedKey)settingsByKey.set(selectedKey,config())}
function selectCurrent(){selectedKey=keyFor(stage.actor);setConfig(settingsByKey.get(selectedKey)??defaultConfig());$('laneDetail').textContent=stage.actor.detail;updateCalibrationState()}
function updateCalibrationState(){$('calibrationState').textContent=referenceByKey.has(selectedKey)?'参考補正・見た目要確認（中立姿勢のモデル全体上端から推定）':confirmedKeys.has(selectedKey)?'このモデル・小物・部位用の補正を適用中':'初期補正です。赤点と見た目の頭頂を比べて調整してください'}
function refreshActors(){
 const list=stage.actors.map(a=>a.id).join('|');if(list!==previousList){
  previousList=list;for(const v of visuals.values()){stage.scene.remove(v.anchor,v.dot);v.dispose()}visuals.clear()
  $('lane').replaceChildren(...stage.actors.map((a,i)=>{const option=document.createElement('option');option.value=i;option.textContent=a.label;return option}));$('lane').value='0'
  stage.actors.forEach(a=>visuals.set(a.id,makeVisual()));renderCards()
 }
 selectCurrent()
}
function renderCards(){let cards=$('laneCards');if(!cards){cards=document.createElement('div');cards.id='laneCards';cards.setAttribute('aria-label','並列実験の結果');$('viewport').append(cards)}cards.replaceChildren(...stage.actors.map((actor,i)=>{const button=document.createElement('button');button.type='button';button.dataset.lane=actor.id;const title=document.createElement('strong'),result=document.createElement('span');title.textContent=actor.label;result.textContent='計測中';button.append(title,result);button.onclick=()=>{saveSelection();stage.select(i);$('lane').value=i;selectCurrent()};return button}))}
function makeVisual(){
 const anchor=new THREE.Group(),dot=new THREE.Mesh(new THREE.SphereGeometry(.018),new THREE.MeshBasicMaterial({color:'#c45c32',depthTest:false}));stage.scene.add(anchor,dot)
 const surface=document.createElement('canvas');surface.width=768;surface.height=192;const ctx=surface.getContext('2d'),texture=new THREE.CanvasTexture(surface)
 const tag=new THREE.Mesh(new THREE.PlaneGeometry(.64,.16),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide}));anchor.add(tag)
 const hat=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:'#c36535',roughness:.65});const brim=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.025,32),material);hat.add(brim);const crown=new THREE.Mesh(new THREE.CylinderGeometry(.105,.12,.14,32),material);crown.position.y=.075;hat.add(crown);anchor.add(hat)
 const orb=new THREE.Mesh(new THREE.OctahedronGeometry(.085),new THREE.MeshStandardMaterial({color:'#2988ad',metalness:.25,roughness:.35}));anchor.add(orb)
 const axes=new THREE.AxesHelper(.18);anchor.add(axes)
 let lastText=''
 return {anchor,dot,draw(text){tag.visible=content()==='tag';hat.visible=content()==='hat';orb.visible=content()==='orb';if(text!==lastText){ctx.clearRect(0,0,768,192);ctx.fillStyle='#174e40';ctx.fillRect(0,0,768,192);ctx.fillStyle='#fff9e9';ctx.font='bold 100px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,100);texture.needsUpdate=true;lastText=text}},dispose(){const geometries=new Set(),materials=new Set();anchor.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material)});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());dot.geometry.dispose();dot.material.dispose();texture.dispose()}}
}
$('lane').onchange=e=>{saveSelection();stage.select(Number(e.target.value));selectCurrent()}
for(const id of ['content','bone'])$(id).onchange=()=>{saveSelection();selectCurrent()}
for(const id of ['x','y','z','size','space','rotation'])$(id).addEventListener('input',()=>{saveSelection();confirmedKeys.add(selectedKey);updateCalibrationState()})
$('reset').onclick=()=>{setConfig(defaultConfig());saveSelection();confirmedKeys.delete(selectedKey);referenceByKey.delete(selectedKey);updateCalibrationState()}
$('reset').insertAdjacentHTML('afterend','<button id="neutralReference">中立姿勢の上向きに合わせる</button><p class="note">参考補正です。頭はモデル全体の上端（髪・装飾を含むバウンディングボックス）から高さを推定します。正確な頭頂・帽子の装着位置は手動で確認してください。胸・手は8cm上を仮置きします。押すまで適用しません。</p>')
function currentMotion(){return {headYaw:value('headYaw'),headPitch:value('headPitch'),headRoll:value('headRoll'),crouch:value('crouch'),motion:$('motion').checked,scale:value('avatarScale')}}
$('neutralReference').onclick=()=>{
 const actor=stage.actor,bone=actor.bones[boneRole()],visual=visuals.get(actor.id),time=window.__avatarLab?.elapsed??0,previousSettings=config()
 if(!bone){message('選択した部位がないため参考補正を保留しました');return}
 try{
  // Sample the stored neutral pose, never overwrite those stored transforms.
  actor.animate(0,{scale:value('avatarScale')})
  refreshSkinnedBounds(actor.root)
  const box=new THREE.Box3().setFromObject(actor.model),origin=bone.getWorldPosition(new THREE.Vector3()),neutralQuaternion=bone.getWorldQuaternion(new THREE.Quaternion()),inverse=neutralQuaternion.clone().invert()
  if(!Number.isFinite(box.max.y))throw Error('モデルの上端を推定できません')
  const clearance=content()==='tag'?.12:.015,lift=boneRole()==='head'?Math.max(.015,box.max.y-origin.y+clearance):.08,worldOffset=new THREE.Vector3(0,lift,0),settings=normalizeAnchorSettings(content()==='tag'?{...previousSettings,offset:worldOffset.toArray(),offsetSpace:'world',rotationMode:'world-up',rotationOffset:undefined}:{...previousSettings,offset:worldOffset.clone().applyQuaternion(inverse).toArray(),offsetSpace:'bone',rotationMode:'bone',rotationOffset:inverse.toArray()})
  const measure=c=>{updateAnchor(visual.anchor,{bone,cameraQuaternion:stage.camera.getWorldQuaternion(new THREE.Quaternion()),settings:c});const position=visual.anchor.getWorldPosition(new THREE.Vector3()),quaternion=visual.anchor.getWorldQuaternion(new THREE.Quaternion());return {position:position.toArray(),quaternion:quaternion.toArray(),neutralOrientationErrorRad:quaternion.angleTo(new THREE.Quaternion()),modelTopClearanceM:position.y-box.max.y}}
  const before=measure(previousSettings),after=measure(settings)
  setConfig(settings);saveSelection();confirmedKeys.delete(selectedKey)
  referenceByKey.set(selectedKey,{revision:++referenceRevision,method:boneRole()==='head'?'neutral-model-bounding-box-top':'neutral-world-up-8cm',requiresVisualReview:true,avatarScale:value('avatarScale'),boneRole:boneRole(),modelTopY:box.max.y,neutralBonePosition:origin.toArray(),neutralBoneQuaternion:neutralQuaternion.toArray(),nominalClearanceM:boneRole()==='head'?clearance:null,beforeSettings:previousSettings,afterSettings:settings,before,after})
  updateCalibrationState();message('参考補正・見た目要確認。中立姿勢の上向きを骨ローカルの補正へ変換しました')
 }catch(error){setConfig(previousSettings);message(String(error))}
 finally{actor.animate(time,currentMotion())}
}
$('export').onclick=()=>$('settings').value=JSON.stringify(config(),null,2)
$('import').onclick=()=>{try{setConfig(JSON.parse($('settings').value));saveSelection();confirmedKeys.add(selectedKey);referenceByKey.delete(selectedKey);updateCalibrationState();message('選択モデルに補正値を読み込みました')}catch(e){message(String(e))}}
$('exportProfile').onclick=()=>{const profile=normalizeAttachmentProfile({schema:'xrift-avatar-anchor.profile',version:1,avatarId:stage.actor.id,attachmentId:attachmentId(),bone:boneRole(),settings:config()});$('profileJSON').value=serializeAttachmentProfile(profile);message('モデルIDを含むプロファイルを書き出しました')}
$('importProfile').onclick=()=>{try{const profile=normalizeAttachmentProfile(JSON.parse($('profileJSON').value)),result=resolveAttachmentProfile([profile],{avatarId:stage.actor.id,attachmentId:attachmentId(),bone:boneRole()});if(result.status!=='ready')throw Error('モデル・小物・部位が一致しないため適用しません');setConfig(result.profile.settings);saveSelection();confirmedKeys.add(selectedKey);referenceByKey.delete(selectedKey);updateCalibrationState();message('一致するモデルへプロファイルを読み込みました')}catch(e){message(String(e))}}
bindActorControls(stage,()=>{saveSelection();previousList='';refreshActors()});refreshActors()

stage.setUpdate((t,dt,actors)=>{
 const activeSettings=config(),cameraQuaternion=stage.camera.getWorldQuaternion(new THREE.Quaternion()),lanes=[]
 const motion=currentMotion()
 for(const actor of actors){
  actor.animate(t,motion);const visual=visuals.get(actor.id);if(!visual)continue
  visual.draw($('status').value);const bone=actor.bones[boneRole()],settings=actor===stage.actor?activeSettings:settingsByKey.get(keyFor(actor))??defaultConfig()
  let result={avatarId:actor.id,label:actor.label,kind:actor.kind,boneRole:boneRole(),status:'missing-bone',errorMm:null,settings,referenceCalibration:referenceByKey.get(keyFor(actor))??null}
  if(bone){try{
   const report=updateAnchor(visual.anchor,{bone,cameraQuaternion,settings}),origin=bone.getWorldPosition(new THREE.Vector3()),offset=new THREE.Vector3().fromArray(settings.offset)
   if(settings.offsetSpace!=='world')offset.applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()))
   const expected=origin.clone().add(offset),actual=visual.anchor.getWorldPosition(new THREE.Vector3()),errorMm=actual.distanceTo(expected)*1000
   const sourceQuaternion=bone.getWorldQuaternion(new THREE.Quaternion()),worldQuaternion=visual.anchor.getWorldQuaternion(new THREE.Quaternion()),expectedQuaternion=settings.rotationMode==='world-up'?new THREE.Quaternion():settings.rotationMode==='camera-facing'?cameraQuaternion.clone():sourceQuaternion.clone()
   if(settings.rotationOffset)expectedQuaternion.multiply(new THREE.Quaternion().fromArray(settings.rotationOffset))
   const orientationErrorRad=worldQuaternion.angleTo(expectedQuaternion),worldScale=visual.anchor.getWorldScale(new THREE.Vector3()).toArray()
   visual.anchor.visible=true;visual.dot.visible=true;visual.dot.position.copy(origin)
   result={...result,...report,head:origin.toArray(),position:actual.toArray(),expected:expected.toArray(),sourceQuaternion:sourceQuaternion.toArray(),worldQuaternion:worldQuaternion.toArray(),worldScale,orientationErrorRad,status:errorMm<=1&&orientationErrorRad<=1e-6?'ready':'transform-error',errorMm}
  }catch(error){visual.anchor.visible=false;visual.dot.visible=false;result.status='unsupported-transform';result.reason=String(error)}}else{visual.anchor.visible=false;visual.dot.visible=false}
  lanes.push(result)
 }
 const selected=lanes[actors.indexOf(stage.actor)],data={profile:stage.profile,...selected,lanes,elapsed:t,paused:stage.paused,motion:motion.motion,content:content(),avatarScale:motion.scale}
 window.__avatarLab=data
 if(performance.now()-lastMetrics>120){lastMetrics=performance.now();showMetrics(data);for(const lane of lanes){const card=[...$('laneCards').children].find(c=>c.dataset.lane===lane.avatarId);if(card){card.classList.toggle('selected',lane.avatarId===stage.actor.id);card.classList.toggle('failed',lane.status!=='ready');card.querySelector('span').textContent=lane.status==='ready'?`${lane.errorMm.toFixed(4)} mm · 計算一致`:`保留: ${lane.status}`}}for(const id of ['x','y','z'])$(id+'Out').textContent=value(id).toFixed(3)}
})
