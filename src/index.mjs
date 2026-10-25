import {Matrix4,Quaternion,Vector3} from 'three'
const finite=v=>typeof v==='number'&&Number.isFinite(v)
export const DEFAULT_ANCHOR_SETTINGS=Object.freeze({offset:Object.freeze([0,.22,0]),offsetSpace:'world',rotationMode:'world-up',scale:1})
export function normalizeAnchorSettings(value={}){
 const offset=value.offset??DEFAULT_ANCHOR_SETTINGS.offset
 if(!Array.isArray(offset)||offset.length!==3||!offset.every(finite))throw new TypeError('offset must contain three finite meter values')
 if(!['world','head'].includes(value.offsetSpace??'world'))throw new TypeError('Unknown offsetSpace')
 if(!['world-up','head','camera-facing'].includes(value.rotationMode??'world-up'))throw new TypeError('Unknown rotationMode')
 const scale=value.scale??1;if(!finite(scale)||scale<=0)throw new TypeError('scale must be positive')
 return {offset:[...offset],offsetSpace:value.offsetSpace??'world',rotationMode:value.rotationMode??'world-up',scale}
}
/** All distances are world meters. Head-local offsets use authored bone axes. */
export function updateHeadAnchor(target,{head,cameraQuaternion,settings={}}={}){
 if(!head?.isObject3D||!target?.isObject3D)throw new TypeError('head and target Object3D are required')
 const config=normalizeAnchorSettings(settings),headPosition=head.getWorldPosition(new Vector3()),headRotation=head.getWorldQuaternion(new Quaternion())
 const offset=new Vector3().fromArray(config.offset)
 if(config.offsetSpace==='head')offset.applyQuaternion(headRotation)
 const rotation=config.rotationMode==='head'?headRotation:config.rotationMode==='camera-facing'?cameraQuaternion:new Quaternion()
 if(!rotation?.isQuaternion)throw new TypeError('camera-facing requires an explicit cameraQuaternion')
 const position=headPosition.clone().add(offset),world=new Matrix4().compose(position,rotation,new Vector3(config.scale,config.scale,config.scale))
 if(target.parent){target.parent.updateWorldMatrix(true,false);if(Math.abs(target.parent.matrixWorld.determinant())<1e-12)throw new Error('Anchor parent transform is singular');world.premultiply(target.parent.matrixWorld.clone().invert())}
 world.decompose(target.position,target.quaternion,target.scale);target.updateWorldMatrix(true,true)
 return {head:headPosition.toArray(),position:position.toArray(),settings:config}
}
export function createHeadAnchor(target,initial={}){
 const saved={position:target.position.clone(),quaternion:target.quaternion.clone(),scale:target.scale.clone()},settings=normalizeAnchorSettings(initial)
 let disposed=false
 return {settings,update(options){if(disposed)throw new Error('Anchor disposed');return updateHeadAnchor(target,{...options,settings:options?.settings??settings})},dispose(){if(disposed)return;disposed=true;target.position.copy(saved.position);target.quaternion.copy(saved.quaternion);target.scale.copy(saved.scale);target.updateWorldMatrix(true,true)}}
}
