import {createStage,commonControls,bindActorControls,value,showMetrics} from './common.mjs'
import {createPoseFixture} from './fixture.mjs'
import {normalizeAnchorSettings,updateHeadAnchor} from '../src/index.mjs'
commonControls('頭上アンカーの調整','頭を動かし、前後左右・高さを調整して「作業中／離席中」の見え方を確かめます。')
document.querySelector('#specific').innerHTML=`<label>表示内容<select id="status"><option>作業中</option><option>離席中</option><option>取り込み中</option></select></label>${[['x','左右',0],['y','高さ',.22],['z','前後',0]].map(([id,label,n])=>`<label>${label}（m）<input id="${id}" type="range" min="-.4" max=".6" step=".005" value="${n}"><output id="${id}Out"></output></label>`).join('')}<label>表示サイズ<input id="size" type="range" min=".3" max="1.7" step=".05" value="1"></label><label>オフセット基準<select id="space"><option value="world">ワールド軸</option><option value="head">頭の骨のローカル軸</option></select></label><label>表示方向<select id="rotation"><option value="world-up">水平を保つ</option><option value="camera-facing">観察者へ向く</option><option value="head">頭に追従する</option></select></label><button id="reset">位置を初期化</button><button id="export">設定を書き出す</button><button id="import">設定を読み込む</button><textarea id="settings" rows="4" aria-label="アンカー設定JSON"></textarea>`
const stage=createStage(createPoseFixture),{THREE}=stage,anchor=new THREE.Group();stage.scene.add(anchor)
const surface=document.createElement('canvas');surface.width=768;surface.height=192;const ctx=surface.getContext('2d'),texture=new THREE.CanvasTexture(surface),label=new THREE.Mesh(new THREE.PlaneGeometry(.64,.16),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide}));anchor.add(label)
const headDot=new THREE.Mesh(new THREE.SphereGeometry(.018),new THREE.MeshBasicMaterial({color:'#c45c32',depthTest:false}));stage.scene.add(headDot)
let lastStatus='';const config=()=>normalizeAnchorSettings({offset:[value('x'),value('y'),value('z')],scale:value('size'),offsetSpace:document.querySelector('#space').value,rotationMode:document.querySelector('#rotation').value})
function setConfig(c){const v=normalizeAnchorSettings(c);['x','y','z'].forEach((id,i)=>document.getElementById(id).value=v.offset[i]);document.querySelector('#size').value=v.scale;document.querySelector('#space').value=v.offsetSpace;document.querySelector('#rotation').value=v.rotationMode}
document.querySelector('#reset').onclick=()=>setConfig({});document.querySelector('#export').onclick=()=>document.querySelector('#settings').value=JSON.stringify(config(),null,2)
document.querySelector('#import').onclick=()=>{try{setConfig(JSON.parse(document.querySelector('#settings').value));document.querySelector('#message').textContent='設定を読み込みました'}catch(e){document.querySelector('#message').textContent=String(e)}}
bindActorControls(stage)
stage.setUpdate((t,dt,actor)=>{
 actor.animate(t,{headYaw:value('headYaw'),headPitch:value('headPitch')});const text=document.querySelector('#status').value
 if(text!==lastStatus){ctx.clearRect(0,0,768,192);ctx.fillStyle='#174e40';ctx.fillRect(0,0,768,192);ctx.fillStyle='#fff9e9';ctx.font='bold 100px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,100);texture.needsUpdate=true;lastStatus=text}
 if(!actor.bones.head){anchor.visible=false;return}anchor.visible=true
 const report=updateHeadAnchor(anchor,{head:actor.bones.head,cameraQuaternion:stage.camera.getWorldQuaternion(new THREE.Quaternion()),settings:config()});headDot.position.fromArray(report.head)
 for(const id of ['x','y','z'])document.getElementById(id+'Out').textContent=value(id).toFixed(3)
 const data={profile:stage.profile,...report};window.__avatarLab=data;showMetrics(data)
})
