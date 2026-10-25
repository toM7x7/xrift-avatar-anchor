import {Suspense,useEffect,useMemo,useRef,useState} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import {RigidBody,CuboidCollider} from '@react-three/rapier'
import {DevEnvironment,Item as SDKItem,XRiftProvider,useUsers} from '@xrift/world-components'
import {Bone,Group,LoadingManager,Object3D,Quaternion,Vector3} from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm'
import {Item as TagItem} from './Item'
import {createPoseFixture} from '../../../demo/fixture.mjs'
import {syncSkinnedTransforms} from '../../../demo/skinning.mjs'

type Actor={root:Object3D;head:Object3D;rest:Quaternion;id:string;dispose:()=>void}
function fixtureActor():Actor{const f=createPoseFixture() as any;return {root:f.mesh,head:f.bones.head,rest:f.bones.head.quaternion.clone(),id:'authored-fixture',dispose:()=>f.dispose()}}
function disposeModel(root:Object3D){const geometry=new Set<any>(),materials=new Set<any>(),textures=new Set<any>(),skeletons=new Set<any>();root.traverse((o:any)=>{if(o.geometry)geometry.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const v of Object.values(m))if((v as any)?.isTexture)textures.add(v)}});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());skeletons.forEach(s=>s.dispose())}
function SDKAvatar({actor,scale,enabled}:{actor:Actor;scale:number;enabled:boolean}){
 const root=useRef<Group>(null),users=useUsers()
 useFrame(()=>{
  if(!root.current||!enabled)return
  const m=users.getLocalMovement();root.current.position.set(m.position.x,m.position.y,m.position.z);root.current.rotation.set(0,m.rotation.yaw+Math.PI,0);root.current.scale.setScalar(scale)
  actor.head.quaternion.copy(actor.rest);actor.head.rotateX(-m.rotation.pitch);syncSkinnedTransforms(root.current)
 })
 return enabled?<group ref={root}><primitive object={actor.root}/></group>:null
}
function AmbiguousRig(){const actor=useMemo(fixtureActor,[]);useEffect(()=>()=>actor.dispose(),[actor]);return <group position={[4,0,0]}><primitive object={actor.root}/></group>}
function SDKBridge({observer,onRead,actorId}:{observer:boolean;onRead:(data:any)=>void;actorId:string}){
 const {scene,camera}=useThree(),users=useUsers(),last=useRef(0)
 useFrame(({clock})=>{
  const m=users.getLocalMovement()
  if(observer){camera.position.set(m.position.x,m.position.y+2.2,m.position.z+3);camera.layers.enable(10)}else camera.layers.disable(10)
  if(clock.elapsedTime-last.current<.15)return;last.current=clock.elapsedTime
  const items:any[]=[];scene.traverse(o=>{if(o.userData.avatarAnchor)items.push(o.userData.avatarAnchor)})
  const data={environment:'official-DevEnvironment-0.58.0',avatar:'additional owned test rig, not SDK DummyAvatar',modelId:actorId,observerCamera:observer,movement:structuredClone(m),items};(window as any).__sdkTagReadback=data;onRead(data)
 })
 useEffect(()=>{
  (window as any).__sdkTagActions={interact(suffix:string,placementId='tag-sdk-one'){let target:any=null;scene.traverse(o=>{if(o.userData?.id===`${placementId}:head-tag:${suffix}`)target=o.userData});if(!target)return false;target.onInteract(target.id);return true},aimAtStation(){camera.lookAt(0,1.16,0)},snapshot(){const items:any[]=[];scene.traverse(o=>{if(o.userData.avatarAnchor)items.push(o.userData.avatarAnchor)});return {environment:'official-DevEnvironment-0.58.0',modelId:actorId,movement:structuredClone(users.getLocalMovement()),camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray()},items}}}
  return()=>{delete (window as any).__sdkTagActions;delete (window as any).__sdkTagReadback}
 },[scene,users,actorId])
 return null
}
export function SDKApp(){
 const [actor,setActor]=useState<Actor>(fixtureActor),[scale,setScale]=useState(1),[observer,setObserver]=useState(false),[enabled,setEnabled]=useState(true),[ambiguous,setAmbiguous]=useState(false),[report,setReport]=useState<any>(null),[message,setMessage]=useState('自作骨格を追加しています。標準SDKの箱型アバターとは別です。'),generation=useRef(0)
 useEffect(()=>()=>actor.dispose(),[actor])
 const items=useMemo(()=>({'00000000-0000-4000-8000-000000000001':TagItem}),[])
 async function loadFile(file:File){
  const request=++generation.current
  try{
   const bytes=await file.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join(''),manager=new LoadingManager()
   manager.setURLModifier(url=>{if(/^(data:|blob:)/.test(url))return url;throw Error('外部参照を含むVRMは使えません')})
   const loader=new GLTFLoader(manager);loader.register(parser=>new VRMLoaderPlugin(parser));const gltf=await loader.parseAsync(bytes,''),vrm=gltf.userData.vrm
   if(!vrm?.humanoid)throw Error('VRM humanoidがありません')
   VRMUtils.rotateVRM0(vrm);vrm.firstPerson?.setup();vrm.update(0)
   const head=vrm.humanoid.getRawBoneNode('head');if(!head){disposeModel(vrm.scene);throw Error('headがありません')}
   const next:Actor={root:vrm.scene,head,rest:head.quaternion.clone(),id:'local-vrm:sha256:'+hash,dispose:()=>disposeModel(vrm.scene)}
   if(request!==generation.current){next.dispose();return}
   setActor(next);setMessage('ローカルVRMを追加しました（ファイル名・画像は送信しません）')
  }catch(error){setMessage(String(error))}
 }
 return <main style={{height:'100vh',display:'grid',gridTemplateColumns:'minmax(0,1fr) 330px',fontFamily:'system-ui',color:'#174e40'}}>
  <style>{'#sdkViewport > div {width:100% !important;height:100% !important} #sdkControls button {cursor:pointer;margin:4px 2px;padding:7px 9px} #sdkControls input[type=file] {max-width:100%}'}</style>
  <section id="sdkViewport" style={{position:'relative',overflow:'hidden'}}><XRiftProvider baseUrl="/"><DevEnvironment items={items} spawnPosition={[0,.81,2.5]} camera={{fov:55}} shadows={false} physicsConfig={{allowInfiniteJump:false}}>
   <color attach="background" args={['#e9eee9']}/><hemisphereLight args={['#ffffff','#768b80',2.5]}/><directionalLight position={[3,6,4]} intensity={2}/>
   <RigidBody type="fixed" colliders={false}><mesh position={[0,-.1,0]}><boxGeometry args={[40,.2,40]}/><meshStandardMaterial color="#d3dfd4"/></mesh><CuboidCollider args={[20,.1,20]} position={[0,-.1,0]}/></RigidBody><gridHelper args={[40,40,'#96ae9c','#c2d1c4']} position={[0,.005,0]}/>
   <SDKAvatar actor={actor} scale={scale} enabled={enabled}/>{ambiguous&&<AmbiguousRig/>}
   <Suspense fallback={null}><SDKItem placementId="tag-sdk-one" itemId="00000000-0000-4000-8000-000000000001" position={[0,0,0]}/><SDKItem placementId="tag-sdk-two" itemId="00000000-0000-4000-8000-000000000001" position={[1,0,0]}/></Suspense>
   <SDKBridge observer={observer} onRead={setReport} actorId={actor.id}/>
  </DevEnvironment></XRiftProvider></section>
  <aside id="sdkControls" onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} style={{padding:20,overflow:'auto',background:'#fffdf5'}}><small>公式 DevEnvironment / SDK 0.58.0</small><h1>頭上タグの装着検証</h1><p>公式のアイテム差込・物理歩行・中央レイを使用。骨格と観察カメラは追加の検証機能です。</p>
   <p><button onClick={()=>(window as any).__sdkTagActions?.interact('equip')}>1を装着</button> <button onClick={()=>(window as any).__sdkTagActions?.interact('remove')}>1を外す</button></p><p><button onClick={()=>(window as any).__sdkTagActions?.interact('change')}>1の表示切替</button> <button onClick={()=>(window as any).__sdkTagActions?.interact('calibrate')}>1を再調整</button></p>
   <p><button onClick={()=>(window as any).__sdkTagActions?.aimAtStation()}>台座へ向く（クリック確認用）</button></p>
   <p><button onClick={()=>(window as any).__sdkTagActions?.interact('equip','tag-sdk-two')}>2を装着</button> <button onClick={()=>(window as any).__sdkTagActions?.interact('remove','tag-sdk-two')}>2を外す</button></p>
   <p><label><input type="checkbox" checked={observer} onChange={e=>setObserver(e.target.checked)}/>観察用カメラ（追加）</label></p>
   <label>アバター倍率 <input aria-label="アバター倍率" type="range" min=".4" max="1.6" step=".1" value={scale} onChange={e=>setScale(Number(e.target.value))}/></label>
   <p><label>ローカルVRM（非送信）<input id="sdkVrm" type="file" accept=".vrm" onChange={e=>{const file=e.target.files?.[0];if(file)void loadFile(file);e.target.value=''}}/></label></p><p>{message}</p><p style={{fontSize:11,overflowWrap:'anywhere'}}>モデルID: {actor.id}</p>
   <p><label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>検証骨格を表示</label></p><p><label><input type="checkbox" checked={ambiguous} onChange={e=>setAmbiguous(e.target.checked)}/>曖昧な別骨格を追加</label></p>
   <p><a href="/?mode=rig">静的な比較・サムネイル用画面</a></p><pre style={{fontSize:10,whiteSpace:'pre-wrap'}}>{JSON.stringify(report,null,2)}</pre>
  </aside>
 </main>
}
