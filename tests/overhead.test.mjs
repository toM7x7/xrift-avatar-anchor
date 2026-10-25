import test from 'node:test'
import assert from 'node:assert/strict'
import {Bone,BufferGeometry,Float32BufferAttribute,Group,MeshBasicMaterial,Scene,Skeleton,SkinnedMesh,Uint16BufferAttribute,Vector3} from 'three'
import {estimateHeadTop} from '../src/overhead.mjs'
import {updateAnchor} from '../src/index.mjs'
import {createPoseFixture} from '../demo/fixture.mjs'

const close=(actual,expected,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`)
function snapshot(root){const nodes=[];root.traverse(node=>nodes.push([node,node.position.toArray(),node.quaternion.toArray(),node.scale.toArray(),node.parent]));return nodes}
function assertUnchanged(nodes){for(const [node,p,q,s,parent]of nodes){assert.deepEqual(node.position.toArray(),p);assert.deepEqual(node.quaternion.toArray(),q);assert.deepEqual(node.scale.toArray(),s);assert.equal(node.parent,parent)}}

test('head geometry estimates model-dependent crown and compensates a shifted head pivot',()=>{
 const f=createPoseFixture(),root=new Group();root.add(f.mesh)
 let report=estimateHeadTop({head:f.bones.head,avatarRoot:root})
 assert.equal(report.status,'ready');assert.equal(report.confidence,'complete')
 close(report.position[1],1.86);close(report.offset[1],.32)
 const original=report.position.slice()
 // Move the bone pivot, then rebind while keeping the authored neutral surface.
 f.bones.head.position.z=.08;root.updateMatrixWorld(true);f.skeleton.calculateInverses()
 report=estimateHeadTop({head:f.bones.head,avatarRoot:root})
 close(report.position[0],original[0]);close(report.position[1],original[1]);close(report.position[2],original[2])
 close(report.offset[2],original[2]-.08)
 f.dispose()
})

test('scale and world parent transforms preserve a fixed-meter tag clearance',()=>{
 for(const scale of [.3,.65,1,1.35,2]){
  const f=createPoseFixture(),scene=new Scene(),outer=new Group(),root=new Group(),target=new Group()
  scene.add(outer,target);outer.position.set(3,.4,-2);outer.rotation.y=.7;outer.scale.setScalar(scale);outer.add(root);root.add(f.mesh)
  const report=estimateHeadTop({head:f.bones.head,avatarRoot:root,clearance:.12})
  assert.equal(report.status,'ready');close(report.position[1],.4+1.74*scale+.12)
  close(report.position[1]-report.bounds.max[1],.12)
  updateAnchor(target,{bone:f.bones.head,settings:{offset:report.offset,offsetSpace:'world',rotationMode:'world-up'}})
  assert.ok(target.getWorldPosition(new Vector3()).distanceTo(new Vector3().fromArray(report.position))<1e-7)
  f.dispose()
 }
})

test('head-influenced sampling ignores raised hands and a taller bystander rig',()=>{
 const scene=new Scene(),owner=new Group(),f=createPoseFixture(),bystander=createPoseFixture()
 owner.add(f.mesh);scene.add(owner,bystander.mesh);bystander.mesh.scale.setScalar(4)
 const initial=estimateHeadTop({head:f.bones.head,avatarRoot:owner})
 f.bones.leftUpperArm.rotation.z=Math.PI/2;f.bones.rightUpperArm.rotation.z=-Math.PI/2
 // Even a scene-level traversal is filtered by explicit head identity, not names.
 const raised=estimateHeadTop({head:f.bones.head,avatarRoot:scene})
 assert.equal(raised.status,'ready');close(raised.position[1],initial.position[1])
 assert.ok(raised.bounds.max[1]<2)
 const foreignOnly=estimateHeadTop({head:f.bones.head,avatarRoot:owner,meshes:[bystander.mesh]})
 assert.equal(foreignOnly.status,'no-head-geometry')
 f.dispose();bystander.dispose()
})

test('current posed head surface is sampled without resetting source pose or geometry',()=>{
 const f=createPoseFixture(),root=new Group();root.add(f.mesh)
 f.bones.head.rotation.set(.5,.8,.1);root.position.set(-2,.2,1);root.scale.setScalar(.65)
 const before=snapshot(root),geometry=f.mesh.geometry,positions=Array.from(geometry.attributes.position.array),weights=Array.from(geometry.attributes.skinWeight.array)
 const report=estimateHeadTop({head:f.bones.head,avatarRoot:root})
 assert.equal(report.status,'ready');assertUnchanged(before)
 assert.deepEqual(Array.from(geometry.attributes.position.array),positions)
 assert.deepEqual(Array.from(geometry.attributes.skinWeight.array),weights)
 assert.equal(JSON.stringify(report).includes(f.mesh.name),false)
 // A repeated current-pose read has no cumulative deformation.
 assert.deepEqual(estimateHeadTop({head:f.bones.head,avatarRoot:root}),report)
 f.dispose()
})

test('sampling has a hard total budget and exposes approximation coverage',()=>{
 const f=createPoseFixture(),root=new Group();root.add(f.mesh)
 const result=estimateHeadTop({head:f.bones.head,avatarRoot:root,maxVertices:64})
 assert.equal(result.status,'ready');assert.equal(result.confidence,'sampled');assert.ok(result.sampledVertices<=64)
 assert.ok(result.acceptedVertices>0);assert.ok(result.meshCount>0)
 f.dispose()
})

test('head descendants contribute but unrelated bones and low head weights do not',()=>{
 const root=new Group(),head=new Bone(),hair=new Bone(),hand=new Bone();root.add(head,hand);head.add(hair)
 const geometry=new BufferGeometry()
 geometry.setAttribute('position',new Float32BufferAttribute([0,1,0,0,2,0,0,20,0,0,30,0],3))
 geometry.setAttribute('skinIndex',new Uint16BufferAttribute([0,0,0,0,1,0,0,0,2,0,0,0,0,2,0,0],4))
 geometry.setAttribute('skinWeight',new Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,.1,.9,0,0],4))
 const mesh=new SkinnedMesh(geometry,new MeshBasicMaterial());root.add(mesh);mesh.bind(new Skeleton([head,hair,hand]))
 const report=estimateHeadTop({head,avatarRoot:root})
 assert.equal(report.status,'ready');assert.equal(report.acceptedVertices,2);close(report.position[1],2.12)
 geometry.dispose();mesh.material.dispose();mesh.skeleton.dispose()
})

test('absent, mismatched, empty, and invalid input fails closed without guessed geometry',()=>{
 const root=new Group(),head=new Bone(),other=new Group();root.add(head)
 assert.equal(estimateHeadTop({}).status,'waiting-for-head')
 assert.equal(estimateHeadTop({head}).status,'waiting-for-avatar-root')
 assert.equal(estimateHeadTop({head,avatarRoot:other}).status,'mismatched-avatar-root')
 assert.equal(estimateHeadTop({head,avatarRoot:root}).status,'no-head-geometry')
 for(const input of [{clearance:NaN},{clearance:-1},{maxVertices:2},{maxVertices:8.5},{minHeadWeight:0},{minHeadWeight:1.1},{meshes:{}}])assert.throws(()=>estimateHeadTop({head,avatarRoot:root,...input}))
})
