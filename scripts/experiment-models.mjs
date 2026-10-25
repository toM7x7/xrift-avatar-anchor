/** Numerical fixtures. These contain no meshes, textures, or author metadata. */
import {Bone,Group,Matrix4,Quaternion,Vector3} from 'three'

export const SYNTHETIC_CONDITIONS=['standard','small','tall','forward-pivot','axis-turned','big-head']

export function createNumericalFixture(condition='standard'){
 if(!SYNTHETIC_CONDITIONS.includes(condition))throw new TypeError('Unknown synthetic condition')
 const root=new Group(),bones={}
 const add=(role,position,parent=root)=>{const node=new Bone();node.position.fromArray(position);node.name=role;parent.add(node);bones[role]=node;return node}
 const hips=add('hips',[0,.9,0]),spine=add('spine',[0,.16,0],hips),chest=add('chest',[0,.2,0],spine),neck=add('neck',[0,.18,0],chest)
 const head=add('head',[0,.1,condition==='forward-pivot'?.08:0],neck)
 const leftUpperArm=add('leftUpperArm',[.2,.12,0],chest),leftLowerArm=add('leftLowerArm',[.28,0,0],leftUpperArm)
 add('leftHand',[.25,0,0],leftLowerArm)
 let crown=new Vector3(0,condition==='big-head'?.33:.2,condition==='forward-pivot'?-.08:.015)
 if(condition==='axis-turned'){
  head.quaternion.setFromAxisAngle(new Vector3(0,0,1),Math.PI/2)
  crown.applyQuaternion(head.quaternion.clone().invert())
 }
 root.scale.setScalar(condition==='small'?.65:condition==='tall'?1.35:1)
 // Profile offsets are meters, so calibrate the neutral crown at this avatar's scale.
 crown.multiplyScalar(root.scale.x)
 root.updateWorldMatrix(true,true)
 return {root,bones,crown:crown.toArray(),condition,evidence:'synthetic-transform',generation:'authored',dispose(){}}
}

/** Read only the JSON chunk of GLB 2; never decode meshes, textures or links. */
export function readGLBJSON(bytes){
 const data=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes)
 if(data.length<20||data.readUInt32LE(0)!==0x46546c67||data.readUInt32LE(4)!==2||data.readUInt32LE(8)!==data.length)throw new TypeError('Expected a complete GLB 2 file')
 let json=null
 for(let offset=12;offset<data.length;){
  if(offset+8>data.length)throw new TypeError('Truncated GLB chunk header')
  const length=data.readUInt32LE(offset),type=data.readUInt32LE(offset+4),end=offset+8+length
  if(length%4!==0||end>data.length)throw new TypeError('Invalid GLB chunk bounds')
  if(type===0x4e4f534a){if(json)throw new TypeError('Duplicate GLB JSON');json=JSON.parse(data.subarray(offset+8,end).toString('utf8').replace(/\0+$/,''))}
  offset=end
 }
 if(!json||!Array.isArray(json.nodes))throw new TypeError('GLB JSON has no nodes')
 return json
}

/** Reconstruct the authored glTF node transforms only, NOT a VRMLoader runtime. */
export function createMetadataRig(json){
 const extension=json.extensions?.VRMC_vrm??json.extensions?.VRM
 const mapping=json.extensions?.VRMC_vrm?.humanoid?.humanBones??Object.fromEntries((json.extensions?.VRM?.humanoid?.humanBones??[]).map(entry=>[entry.bone,entry]))
 if(!extension||!mapping.head)throw new TypeError('VRM humanoid head mapping required')
 const validIndex=index=>Number.isInteger(index)&&index>=0&&index<json.nodes.length
 const nodes=json.nodes.map(description=>{
  const node=new Bone()
  if(description.matrix){if(description.matrix.length!==16||!description.matrix.every(Number.isFinite))throw new TypeError('Invalid node matrix');new Matrix4().fromArray(description.matrix).decompose(node.position,node.quaternion,node.scale)}
  else {
   for(const [key,size,fallback] of [['translation',3,[0,0,0]],['rotation',4,[0,0,0,1]],['scale',3,[1,1,1]]]){
    const value=description[key]??fallback
    if(!Array.isArray(value)||value.length!==size||!value.every(Number.isFinite))throw new TypeError('Invalid node transform')
    ;({translation:node.position,rotation:node.quaternion,scale:node.scale}[key]).fromArray(value)
   }
  }
  return node
 })
 const parents=new Map()
 for(let parent=0;parent<json.nodes.length;parent++)for(const child of json.nodes[parent].children??[]){
  if(!validIndex(child)||child===parent||parents.has(child))throw new TypeError('Invalid glTF parent tree')
  parents.set(child,parent)
 }
 for(let i=0;i<nodes.length;i++){
  const visited=new Set([i]);let current=i
  while(parents.has(current)){current=parents.get(current);if(visited.has(current))throw new TypeError('Cyclic glTF hierarchy');visited.add(current)}
 }
 for(const [child,parent]of parents)nodes[parent].add(nodes[child])
 const root=new Group(),scene=json.scenes?.[json.scene??0]
 for(const index of scene?.nodes??nodes.map((_,i)=>i).filter(i=>!parents.has(i))){if(!validIndex(index)||parents.has(index))throw new TypeError('Invalid glTF scene root');root.add(nodes[index])}
 const bones={}
 for(const [role,entry]of Object.entries(mapping)){
  if(!validIndex(entry.node))throw new TypeError('Invalid humanoid node index')
  let cursor=nodes[entry.node];while(cursor&&cursor!==root)cursor=cursor.parent
  if(cursor===root)bones[role]=nodes[entry.node]
 }
 if(!bones.head)throw new TypeError('Head not in selected glTF scene')
 root.updateWorldMatrix(true,true)
 return {root,bones,crown:null,generation:json.extensions?.VRMC_vrm?`VRM ${extension.specVersion??'1.x'}`:`VRM ${extension.specVersion??'0.x'}`,nodeCount:nodes.length,evidence:'vrm-metadata-transform',dispose(){}}
}

export const MOTIONS=[
 {id:'neutral'},
 {id:'yaw-minus-60',yaw:-Math.PI/3},
 {id:'yaw-plus-60',yaw:Math.PI/3},
 {id:'pitch-minus-30',pitch:-Math.PI/6},
 {id:'pitch-plus-30',pitch:Math.PI/6},
 {id:'roll-plus-30',roll:Math.PI/6},
 {id:'crouch',crouch:.35,pitch:Math.PI/6},
 {id:'root-walk',move:[1.3,0,-.7],turn:.8},
 {id:'raised-hand',arm:-Math.PI/3},
]

export function snapshotRig(rig){
 const nodes=[];rig.root.traverse(node=>nodes.push({node,position:node.position.toArray(),quaternion:node.quaternion.toArray(),scale:node.scale.toArray()}))
 return nodes
}
export function restoreRig(snapshot){for(const {node,position,quaternion,scale}of snapshot){node.position.fromArray(position);node.quaternion.fromArray(quaternion);node.scale.fromArray(scale)}}
export function rigUnchanged(snapshot){return snapshot.every(({node,position,quaternion,scale})=>node.position.equals(new Vector3().fromArray(position))&&node.quaternion.equals(new Quaternion().fromArray(quaternion))&&node.scale.equals(new Vector3().fromArray(scale)))}

export function applyMotion(rig,motion){
 const head=rig.bones.head
 head.rotateY(motion.yaw??0);head.rotateX(motion.pitch??0);head.rotateZ(motion.roll??0)
 if(motion.crouch&&rig.bones.hips){rig.bones.hips.position.y-=motion.crouch;rig.bones.spine?.rotateX(.2)}
 if(motion.move)rig.root.position.add(new Vector3().fromArray(motion.move))
 if(motion.turn)rig.root.rotateY(motion.turn)
 if(motion.arm)rig.bones.leftUpperArm?.rotateZ(motion.arm)
 rig.root.updateWorldMatrix(true,true)
}
