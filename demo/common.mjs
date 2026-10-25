import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm'
import {FIXTURE_VARIANTS,createVariantFixture} from './variants.mjs'
import {refreshSkinnedBounds,syncSkinnedTransforms} from './skinning.mjs'
import './style.css'

const roles=['hips','spine','chest','neck','head','leftUpperArm','leftLowerArm','leftHand','rightUpperArm','rightLowerArm','rightHand','leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot']
export function createStage(){
 const viewport=document.querySelector('#viewport'),scene=new THREE.Scene();scene.background=new THREE.Color('#e9eee9')
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));viewport.append(renderer.domElement)
 const camera=new THREE.PerspectiveCamera(42,1,.01,100);camera.position.set(2.5,1.9,3.7);camera.layers.enable(10)
 const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,1.05,0);orbit.enableDamping=true
 scene.add(new THREE.HemisphereLight('#ffffff','#7d8c81',2.8));const light=new THREE.DirectionalLight('#ffffff',2);light.position.set(3,6,4);scene.add(light,new THREE.GridHelper(20,40,'#869b8c','#c6d0c6'))
 const resize=()=>{const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()};new ResizeObserver(resize).observe(viewport);resize()
 let actors=[],selectedIndex=0,lastTime=performance.now(),elapsed=0,paused=false,update=()=>{},profile='standard',loadGeneration=0
 function disposeObject(root){const gs=new Set(),ms=new Set(),ts=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v)}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose())}
 function wrap(root,bones,{fixture=null,vrm=null,id,label,kind,detail}={}){
  const nodes=new Set(Object.values(bones).filter(Boolean));root.traverse(o=>{if(o.isBone)nodes.add(o)});const neutral=[...nodes].map(o=>({o,p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()}))
  const humanoid=Object.fromEntries(Object.entries(bones).filter(([,b])=>b)),holder=new THREE.Group();holder.add(root)
  refreshSkinnedBounds(holder);const height=Math.max(.3,new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y)
  return {root:holder,model:root,bones:humanoid,vrm,fixture,neutral,id,label,kind,detail,height,base:new THREE.Vector3(),animate(t,{headYaw=0,headPitch=0,headRoll=0,crouch=0,motion=false,scale=1}={}){
   for(const {o,p,q,s}of neutral){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s)}
   holder.position.copy(this.base);holder.scale.setScalar(scale);holder.rotation.set(0,0,0)
   const sway=motion?Math.sin(t*.9)*.18:0,duck=Math.max(crouch,motion?(1+Math.sin(t*.7))*.24:0)
   holder.position.x+=sway;holder.position.y-=height*scale*.22*duck;holder.position.z+=motion?Math.cos(t*.6)*.12:0;holder.rotation.y=motion?Math.sin(t*.5)*.3:0
   humanoid.spine?.rotateX(duck*.3)
   humanoid.head?.rotateY(headYaw+(motion?Math.sin(t)*Math.PI/3:0));humanoid.head?.rotateX(headPitch+(motion?Math.sin(t*.8)*Math.PI/6:0));humanoid.head?.rotateZ(headRoll+(motion?Math.sin(t*.6)*.2:0))
   humanoid.leftLowerArm?.rotateY(motion?Math.sin(t)*.5:0)
   syncSkinnedTransforms(holder)
  },dispose(){if(fixture)fixture.dispose();else disposeObject(root)}}
 }
 function frameCamera(view='front'){
  if(!actors.length)return
  const box=new THREE.Box3();for(const a of actors)box.expandByObject(a.root)
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),distance=Math.max(2.6,size.y*1.55,size.x/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect))*1.35
  orbit.target.copy(center);camera.position.copy(center).add(view==='side'?new THREE.Vector3(distance*.95,distance*.18,distance*.22):new THREE.Vector3(distance*.09,distance*.16,distance));camera.far=Math.max(100,distance*5);camera.updateProjectionMatrix();orbit.update()
 }
 function replace(next,kind){for(const a of actors){scene.remove(a.root);a.dispose()}actors=next;selectedIndex=0;profile=kind;const gap=1.9;actors.forEach((a,i)=>{a.base.set((i-(actors.length-1)/2)*gap,0,0);a.root.position.copy(a.base);scene.add(a.root)});frameCamera();return actors[0]}
 function useFixture(kind='standard'){
  loadGeneration++;const v=FIXTURE_VARIANTS.find(v=>v.id===kind)??FIXTURE_VARIANTS[0],f=createVariantFixture(v.id);f.mesh.scale.setScalar(v.scale)
  return replace([wrap(f.mesh,f.bones,{fixture:f,id:`fixture:${v.id}`,label:v.label,kind:v.id,detail:v.detail})],v.id)
 }
 function useComparison(){loadGeneration++;return replace(FIXTURE_VARIANTS.map(v=>{const f=createVariantFixture(v.id);f.mesh.scale.setScalar(v.scale);return wrap(f.mesh,f.bones,{fixture:f,id:`fixture:${v.id}`,label:v.label,kind:v.id,detail:v.detail})}),'comparison')}
 async function loadVRMs(files){
  const generation=++loadGeneration,next=[]
  try{
   for(const file of files){
    const bytes=await file.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('')
    const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(/^(data:|blob:)/.test(url))return url;throw Error('外部参照を含むVRMは読み込めません')})
    const loader=new GLTFLoader(manager);loader.register(parser=>new VRMLoaderPlugin(parser));const gltf=await loader.parseAsync(bytes,''),vrm=gltf.userData.vrm
    if(!vrm?.humanoid){disposeObject(gltf.scene);throw Error('VRM humanoidがありません')}
    const forwardConvention=vrm.meta?.metaVersion==='0'?'vrm0-forward-v1':'vrm1-forward'
    VRMUtils.rotateVRM0(vrm)
    vrm.firstPerson?.setup();vrm.update(0)
    const bones=Object.fromEntries(roles.map(role=>[role,vrm.humanoid.getRawBoneNode(role)]))
    next.push(wrap(vrm.scene,bones,{vrm,id:`local-vrm:sha256:${hash}${forwardConvention==='vrm0-forward-v1'?':vrm0-forward-v1':''}`,kind:'local-vrm',detail:`VRM ${vrm.meta?.metaVersion??'不明'} / ${forwardConvention} / raw humanoidの簡易姿勢`}))
   }
   next.sort((a,b)=>a.id.localeCompare(b.id));if(new Set(next.map(a=>a.id)).size!==next.length)throw Error('同じVRMを重複して選択しています');next.forEach((a,i)=>a.label=`V${String(i+1).padStart(2,'0')} ローカルVRM`)
   if(generation!==loadGeneration){next.forEach(a=>a.dispose());return null}
   return replace(next,'local-vrm')
  }catch(error){next.forEach(a=>a.dispose());throw error}
 }
 function frame(now){const dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;if(!paused)elapsed+=dt;orbit.update();update(elapsed,dt,actors);renderer.render(scene,camera);requestAnimationFrame(frame)}
 useComparison();requestAnimationFrame(frame)
 return {scene,renderer,camera,orbit,get actor(){return actors[selectedIndex]},get actors(){return actors},get profile(){return profile},get paused(){return paused},setPaused(v){paused=v},select(i){selectedIndex=i},useFixture,useComparison,loadVRM(file){return loadVRMs([file])},loadVRMs,frameCamera,setUpdate(fn){update=fn},THREE}
}
export function commonControls(title,description){
 document.querySelector('#controls').innerHTML=`<p class="eyebrow">XRIFT / ATTACHMENT LAB · v0.2</p><h1>${title}</h1><p>${description}</p><div class="toolbar"><button id="compare">自作骨格を並列比較</button><button id="pause">動きを停止</button></div><div class="toolbar"><button id="front">正面へ</button><button id="side">横から</button></div><label>選択中のモデル<select id="lane"></select></label><p id="laneDetail" class="note"></p><details open><summary>モデルを切り替える</summary><label>検証用の体格<select id="profile"><option value="standard">標準</option><option value="small">小型 0.65倍</option><option value="tall">大型 1.35倍</option><option value="forward-pivot">頭ピボット前ずれの自作ケース</option><option value="axis-turned">頭の骨軸90°の自作ケース</option></select></label><label class="file">手元のVRMを読み込む（複数可）<span class="fileButton">VRMファイルを選択…</span><input id="vrm" type="file" accept=".vrm" multiple></label><p class="note">VRMはブラウザ内だけで読み込みます。ファイル名は表示しません。画像やモデルは送信・保存しません。V番号は選択したモデルのSHA256順で、以前のA02とは対応しません。</p></details><div id="specific"></div><details open><summary>共通の動き・体格</summary><label class="check"><input id="motion" type="checkbox" checked> 自動運動（頭・屈み・移動）</label><label>頭の左右 <input id="headYaw" type="range" min="-1.2" max="1.2" step=".01" value="0"></label><label>頭の上下 <input id="headPitch" type="range" min="-.8" max=".8" step=".01" value="0"></label><label>頭の傾き <input id="headRoll" type="range" min="-.6" max=".6" step=".01" value="0"></label><label>屈み <input id="crouch" type="range" min="0" max="1" step=".01" value="0"></label><label>アバター倍率 <input id="avatarScale" type="range" min=".3" max="2" step=".05" value="1"></label><p class="note">補正は常にメートル単位です。体格を変えても補正・小物サイズは自動で拡縮しません。</p></details><p id="message" role="status"></p><details><summary>選択モデルの計測値</summary><pre id="metrics"></pre></details><p class="note">赤い点は骨の原点。誤差は指定した骨＋補正との計算差で、頭頂や髪との一致を保証しません。実VRMの動作は簡易姿勢であり、XRift／Quest／他者視点は別に確認します。</p>`
}
export function bindActorControls(stage,onChange=()=>{}){
 const message=document.querySelector('#message')
 document.querySelector('#profile').onchange=e=>{stage.useFixture(e.target.value);onChange(stage.actor);message.textContent='自作骨格の単体表示へ切り替えました'}
 document.querySelector('#compare').onclick=()=>{stage.useComparison();onChange(stage.actor);message.textContent='5条件を並列比較します。補正は選択中のモデルへ適用します'}
 document.querySelector('#vrm').onchange=async e=>{const files=[...e.target.files];if(!files.length)return;message.textContent='ローカルVRMを読み込み中…';try{const loaded=await stage.loadVRMs(files);if(!loaded)return;onChange(stage.actor);message.textContent=`ローカルVRM ${stage.actors.length}体を読み込みました`}catch(error){message.textContent=String(error)}finally{e.target.value=''}}
 document.querySelector('#front').onclick=()=>stage.frameCamera('front');document.querySelector('#side').onclick=()=>stage.frameCamera('side')
 document.querySelector('#pause').onclick=e=>{stage.setPaused(!stage.paused);e.target.textContent=stage.paused?'動きを再開':'動きを停止'}
}
export const value=id=>Number(document.getElementById(id).value)
export function showMetrics(data){if(document.querySelector('#metrics').closest('details').open)document.querySelector('#metrics').textContent=JSON.stringify(data,null,2)}
