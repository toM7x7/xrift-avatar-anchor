import {useEffect,useMemo,useRef,useState} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import {useTexture} from '@react-three/drei'
import {Interactable,useInstanceState,useItem,usePlacementState,useUsers} from '@xrift/world-components'
import {Camera,DoubleSide,Group,Quaternion,Vector3,SRGBColorSpace} from 'three'
import {createAnchor} from '../../../src/index.mjs'
import {estimateHeadTop,type HeadTopReport} from '../../../src/overhead.mjs'
import {selectXRiftAvatar,isXRiftAvatarBindingCurrent,type XRiftAvatarBinding} from '../../../src/adapters/xrift-runtime.mjs'
import {normalizeTagState} from './state.mjs'

const images={
 work:new URL('./assets/work.png',import.meta.url).href,
 away:new URL('./assets/away.png',import.meta.url).href,
 welcome:new URL('./assets/welcome.png',import.meta.url).href,
 equip:new URL('./assets/equip.png',import.meta.url).href,
 remove:new URL('./assets/remove.png',import.meta.url).href,
 calibrate:new URL('./assets/calibrate.png',import.meta.url).href,
 change:new URL('./assets/change.png',import.meta.url).href,
 up:new URL('./assets/up.png',import.meta.url).href,
 down:new URL('./assets/down.png',import.meta.url).href,
 pending:new URL('./assets/pending.png',import.meta.url).href,
 title:new URL('./assets/title.png',import.meta.url).href,
}
type ImageName=keyof typeof images
type WearState={ownerId:string|null;statusIndex:number;extraHeight:number;serial:number}
const EMPTY:WearState={ownerId:null,statusIndex:0,extraHeight:0,serial:0}
const statuses:ImageName[]=['work','away','welcome']
export interface ItemProps {position?:[number,number,number];rotation?:[number,number,number];scale?:number;onReport?:(report:any)=>void}
function Sprite({image,width=.64,height=.16,onBeforeRender}:{image:ImageName;width?:number;height?:number;onBeforeRender?:any}){
 const texture=useTexture(images[image]);texture.colorSpace=SRGBColorSpace
 return <mesh onBeforeRender={onBeforeRender}><planeGeometry args={[width,height]}/><meshBasicMaterial map={texture} transparent side={DoubleSide} toneMapped={false}/></mesh>
}

/** One placed object owns only its attachment group and namespaced state. */
export function Item({position=[0,0,0],rotation=[0,0,0],scale=1,onReport}:ItemProps){
 const {id}=useItem(),users=useUsers(),placement=usePlacementState(),{scene,camera}=useThree()
 const root=useRef<Group>(null),tag=useRef<Group>(null)
 const [rawWear,setWear]=useInstanceState<unknown>(`${id}:auto-head-tag:v1`,EMPTY)
 const wear=normalizeTagState(rawWear),[displayPhase,setDisplayPhase]=useState('idle')
 const current=useRef(wear);current.current=wear
 const preview=placement.mode==='preview',localId=users.localUser?.id??null
 const present=!!wear.ownerId&&(wear.ownerId===localId||users.remoteUsers.some(user=>user.id===wear.ownerId))
 const worn=present&&!preview,isLocal=worn&&wear.ownerId===localId
 const latest=useRef({worn,isLocal,localId,preview,onReport});latest.current={worn,isLocal,localId,preview,onReport}
 const runtime=useMemo(()=>({owner:null as string|null,binding:null as XRiftAvatarBinding|null,controller:null as ReturnType<typeof createAnchor>|null,estimate:null as HeadTopReport|null,lastScan:-Infinity,lastCalibration:-Infinity,lastReport:-Infinity,serial:-1,time:0,phase:'idle',reason:null as string|null,report:null as any}),[])

 function change(next:WearState){current.current=next;setWear(next)}
 function equip(){if(preview||!localId||worn)return;change({...EMPTY,ownerId:localId,serial:current.current.serial+1})}
 function remove(){if(isLocal)change({...EMPTY,serial:current.current.serial+1})}
 function adjust(kind:'calibrate'|'change'|'up'|'down'){
  if(!isLocal)return
  const previous=current.current
  change({...previous,statusIndex:kind==='change'?(previous.statusIndex+1)%statuses.length:previous.statusIndex,extraHeight:kind==='up'?Math.min(.3,previous.extraHeight+.03):kind==='down'?Math.max(-.09,previous.extraHeight-.03):previous.extraHeight,serial:previous.serial+1})
 }
 function reset(){runtime.controller?.dispose();runtime.controller=null;runtime.binding=null;runtime.estimate=null;runtime.lastScan=-Infinity;runtime.lastCalibration=-Infinity;if(tag.current)tag.current.visible=false}
 useEffect(()=>()=>{reset();if(root.current)delete root.current.userData.avatarAnchor},[])

 function follow(viewCamera:Camera){
  if(!tag.current||!root.current)return
  const {worn,localId}=latest.current,owner=worn?current.current.ownerId:null
  if(runtime.owner!==owner){reset();runtime.owner=owner}
  if(!owner){tag.current.visible=false;runtime.phase=latest.current.preview?'preview':'idle';return}
  const t=runtime.time,excludeRoots=[root.current]
  if(t-runtime.lastScan>.5||!isXRiftAvatarBindingCurrent(runtime.binding,{scene,excludeRoots})){
   runtime.lastScan=t
   const binding=selectXRiftAvatar({scene,userId:owner,localUserId:localId,excludeRoots})
   if(binding.identity!==runtime.binding?.identity){runtime.estimate=null;runtime.lastCalibration=-Infinity}
   runtime.binding=binding
  }
  const binding=runtime.binding
  if(binding?.status!=='ready'||!binding.head||!binding.avatarRoot){tag.current.visible=false;runtime.phase='pending';runtime.reason=binding?.status??'waiting-for-avatar';return}
  if(t-runtime.lastCalibration>.35||runtime.serial!==current.current.serial||!runtime.estimate){
   runtime.lastCalibration=t;runtime.serial=current.current.serial
   runtime.estimate=estimateHeadTop({head:binding.head,avatarRoot:binding.avatarRoot,meshes:binding.meshes,clearance:.12,maxVertices:6000})
  }
  const estimate=runtime.estimate
  if(estimate?.status!=='ready'||!estimate.offset){tag.current.visible=false;runtime.phase='pending';runtime.reason=estimate?.status??'waiting-for-head-geometry';return}
  try{
   runtime.controller??=createAnchor(tag.current)
   const offset:[number,number,number]=[estimate.offset[0],estimate.offset[1]+current.current.extraHeight,estimate.offset[2]]
   const report=runtime.controller.update({bone:binding.head,cameraQuaternion:viewCamera.getWorldQuaternion(new Quaternion()),settings:{offset,offsetSpace:'world',rotationMode:'camera-facing',scale:1}})
   tag.current.visible=true;runtime.phase='worn';runtime.reason=null
   runtime.report={itemId:id,phase:'worn',ownerId:owner,source:binding.source,bindingIdentity:binding.identity,head:report.bone,position:tag.current.getWorldPosition(new Vector3()).toArray(),offset,statusIndex:current.current.statusIndex,extraHeight:current.current.extraHeight,calibration:{method:estimate.source,confidence:estimate.confidence,sampledVertices:estimate.sampledVertices,acceptedVertices:estimate.acceptedVertices,meshCount:estimate.meshCount,headTopY:estimate.bounds?.max[1]},calibrationAt:runtime.lastCalibration,followAt:t,serial:current.current.serial}
   root.current.userData.avatarAnchor=runtime.report
  }catch(error){tag.current.visible=false;runtime.phase='pending';runtime.reason=String(error)}
 }
 useFrame(({clock})=>{
  runtime.time=clock.elapsedTime;follow(camera)
  const report=runtime.phase==='worn'?runtime.report:{itemId:id,phase:runtime.phase,ownerId:latest.current.worn?current.current.ownerId:null,reason:runtime.reason}
  if(root.current)root.current.userData.avatarAnchor=report
  if(runtime.time-runtime.lastReport>.2){runtime.lastReport=runtime.time;setDisplayPhase(runtime.phase);latest.current.onReport?.(report)}
 })
 const button=(key:ImageName,text:string,action:()=>void,at:[number,number,number],enabled=true,width=.3)=><group position={at}><Interactable id={`${id}:head-tag:${key}`} onInteract={action} interactionText={text} enabled={!preview&&enabled}><Sprite image={key} width={width} height={.1}/></Interactable></group>
 return <group ref={root}>
  <group position={position} rotation={rotation} scale={Math.max(.3,Math.min(2,scale))}>
   <mesh position={[0,.035,0]}><cylinderGeometry args={[.27,.3,.07,32]}/><meshStandardMaterial color="#243c38" roughness={.65}/></mesh>
   <mesh position={[0,.58,0]}><cylinderGeometry args={[.018,.028,1.1,16]}/><meshStandardMaterial color="#769387" metalness={.6} roughness={.4}/></mesh>
   <group position={[0,1.35,0]}><Sprite image={worn?(displayPhase==='pending'?'pending':statuses[wear.statusIndex%statuses.length]):'title'} width={.72} height={.18}/></group>
   {!worn&&button('equip','頭上タグを装着する',equip,[0,1.16,.015],!!localId,.5)}
   {worn&&<>
    {button('remove','頭上タグを外す',remove,[-.17,1.14,.015],isLocal)}
    {button('calibrate','位置を再調整',()=>adjust('calibrate'),[.17,1.14,.015],isLocal)}
    {button('change','表示内容を切り替える',()=>adjust('change'),[0,1,.015],isLocal,.5)}
    {button('up','タグを3cm上げる',()=>adjust('up'),[-.17,.86,.015],isLocal)}
    {button('down','タグを3cm下げる',()=>adjust('down'),[.17,.86,.015],isLocal)}
   </>}
  </group>
  <group ref={tag} visible={false}>
   <Interactable id={`${id}:head-tag:worn-remove`} enabled={isLocal} interactionText="頭上タグを外す" onInteract={remove}>
    <Sprite image={statuses[wear.statusIndex%statuses.length]} width={.7} height={.17} onBeforeRender={(_renderer:any,_scene:any,viewCamera:Camera)=>follow(viewCamera)}/>
   </Interactable>
  </group>
 </group>
}
