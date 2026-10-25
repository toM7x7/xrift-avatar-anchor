import {Suspense,useEffect,useMemo,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {Canvas,useFrame,useThree} from '@react-three/fiber'
import {OrbitControls} from '@react-three/drei'
import {ItemProvider,XRiftProvider,type UsersContextValue} from '@xrift/world-components'
import {Group,Vector3} from 'three'
import {Item} from './Item'
import {createPoseFixture} from '../../../demo/fixture.mjs'
import {syncSkinnedTransforms} from '../../../demo/skinning.mjs'
import {SDKApp} from './sdk-dev'

const params=new URLSearchParams(location.search),thumbnail=params.has('thumbnail')
function Light(){return <><color attach="background" args={['#e9eee9']}/><hemisphereLight args={['#ffffff','#6d8576',2.5]}/><directionalLight position={[3,6,4]} intensity={2}/></>}
function Rig({scale,moving,refRoot}:{scale:number;moving:boolean;refRoot:any}){
 const f=useMemo(()=>createPoseFixture() as any,[]),root=useRef<Group>(null),headRest=useMemo(()=>f.bones.head.quaternion.clone(),[f])
 useEffect(()=>()=>f.dispose(),[f])
 useFrame(({clock})=>{
  if(!root.current)return;refRoot.current=root.current
  root.current.position.set(moving?Math.sin(clock.elapsedTime)*.6:0,0,0)
  root.current.scale.setScalar(scale)
  f.bones.head.quaternion.copy(headRest);f.bones.head.rotateY(moving?Math.sin(clock.elapsedTime)*.7:0);f.bones.head.rotateX(moving?Math.sin(clock.elapsedTime*.7)*.3:0)
  syncSkinnedTransforms(root.current)
 },-.1)
 return <group ref={root}><primitive object={f.mesh}/></group>
}
function DevBridge(){
 const {scene,camera}=useThree()
 useEffect(()=>{
  (window as any).__autoTagActions={interact(suffix:string){let found:any=null;scene.traverse(o=>{if(o.userData?.id===`tag-dev:head-tag:${suffix}`)found=o.userData});if(!found)return false;found.onInteract(found.id);return true},sample(){let report:any=null;scene.traverse(o=>{if(o.userData.avatarAnchor)report=o.userData.avatarAnchor});return report}}
  return()=>{delete (window as any).__autoTagActions}
 },[scene,camera])
 return null
}
function App(){
 if(!thumbnail&&params.get('mode')!=='rig')return <SDKApp/>
 const [scale,setScale]=useState(1),[moving,setMoving]=useState(false),[report,setReport]=useState<any>(null),rig=useRef<Group>(null)
 const users=useMemo<UsersContextValue>(()=>({localUser:{id:'local-dev',displayName:'自作検証',avatarUrl:null,isGuest:false},remoteUsers:[],getMovement:()=>undefined,getLocalMovement:()=>({position:{x:rig.current?.position.x??0,y:0,z:0},direction:{x:0,z:1},horizontalSpeed:0,verticalSpeed:0,rotation:{yaw:0,pitch:0},isGrounded:true,isJumping:false}),getLocalAvatarHeight:()=>({height:1.75*scale,eyeHeight:1.55*scale})}),[scale])
 useEffect(()=>{(window as any).__autoTagReadback=report},[report])
 return <main style={{display:'grid',gridTemplateColumns:thumbnail?'minmax(0,1fr)':'minmax(0,1fr) 310px',height:'100vh',overflow:'hidden',background:'#e9eee9',fontFamily:'system-ui',color:'#174e40'}}>
  <section style={{minWidth:0,overflow:'hidden'}}><XRiftProvider baseUrl="/" usersImplementation={users}><Canvas camera={{position:thumbnail?[2.3,1.9,3.2]:[3.5,2.6,5],fov:42}} onCreated={({camera})=>camera.layers.enable(10)}><Light/><gridHelper args={[16,32,'#97ac9d','#c9d4cb']}/><Rig scale={scale} moving={moving} refRoot={rig}/><Suspense fallback={null}><ItemProvider id="tag-dev"><Item position={[1.2,0,0]} onReport={setReport}/></ItemProvider></Suspense><DevBridge/><OrbitControls target={[.3,1,0]}/></Canvas></XRiftProvider></section>
  {!thumbnail&&<aside style={{padding:24,overflow:'auto',background:'#fffdf4'}}><small>LOCAL / AUTHORED RIG</small><h1>自動調整・頭上タグ</h1><p>自作骨格と実SDKの検証。XRift本番とは分けて記録します。</p><button onClick={()=>(window as any).__autoTagActions.interact('equip')}>装着する</button> <button onClick={()=>(window as any).__autoTagActions.interact('remove')}>外す</button><p><button onClick={()=>setMoving(!moving)}>{moving?'動きを止める':'動かす'}</button> <button onClick={()=>(window as any).__autoTagActions.interact('calibrate')}>再調整</button></p><label>体格 <input aria-label="体格" type="range" min=".4" max="1.6" step=".1" value={scale} onChange={e=>setScale(Number(e.target.value))}/></label><p><button onClick={()=>(window as any).__autoTagActions.interact('change')}>表示切替</button> <button onClick={()=>(window as any).__autoTagActions.interact('up')}>上へ</button> <button onClick={()=>(window as any).__autoTagActions.interact('down')}>下へ</button></p><pre style={{fontSize:11,whiteSpace:'pre-wrap'}}>{JSON.stringify(report,null,2)}</pre></aside>}
 </main>
}
createRoot(document.getElementById('root')!).render(<App/> )
