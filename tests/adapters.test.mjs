import test from 'node:test'
import assert from 'node:assert/strict'
import {Bone,Group} from 'three'
import {mapVRMBones,selectVRMBone} from '../src/adapters/vrm.mjs'
import {selectXRiftBone,selectXRiftHead} from '../src/adapters/xrift.mjs'

test('explicit semantic maps support other body parts and reject stale roots',()=>{
 const avatar=new Group(),other=new Group(),head=new Bone(),hand=new Bone(),foreign=new Bone()
 avatar.add(head,hand);other.add(foreign)
 const base={userId:'local-user',avatarRoot:avatar,bones:{head,leftHand:hand}}
 assert.equal(selectXRiftBone({...base,bone:'leftHand'}).bone,hand)
 assert.equal(selectXRiftBone({...base,bone:'chest'}).status,'waiting-for-bone')
 assert.equal(selectXRiftBone({...base,avatarRoot:other}).status,'mismatched-avatar-root')
 assert.equal(selectXRiftBone({...base,avatarRoot:undefined}).status,'waiting-for-avatar-root')
 assert.equal(selectXRiftBone({...base,userId:null}).status,'empty')
 assert.equal(selectXRiftBone({userId:'u',bone:'leftHand'}).status,'waiting-for-bone-map')
 assert.equal(selectXRiftHead({userId:'u'}).status,'waiting-for-scene')
})

test('VRM adapter reads declared raw/normalized humanoid roles without name heuristics or mutation',()=>{
 const root=new Group(),head=new Bone(),normalizedHead=new Bone();root.add(head,normalizedHead)
 head.name='arbitrary-author-name';head.position.set(.1,1.1,.2)
 const calls=[],vrm={scene:root,humanoid:{getRawBoneNode(role){calls.push(['raw',role]);return role==='head'?head:null},getNormalizedBoneNode(role){calls.push(['normalized',role]);return role==='head'?normalizedHead:null}}}
 const before=head.position.toArray()
 assert.equal(selectVRMBone({vrm}).bone,head)
 assert.equal(selectVRMBone({vrm,space:'normalized'}).bone,normalizedHead)
 assert.equal(selectVRMBone({vrm,bone:'leftHand'}).status,'waiting-for-bone')
 assert.equal(selectVRMBone({vrm,bone:'author-head'}).status,'unsupported-bone-role')
 assert.equal(selectVRMBone({vrm,space:'guess'}).status,'unsupported-bone-space')
 assert.deepEqual(mapVRMBones(vrm),{head})
 assert.deepEqual(head.position.toArray(),before)
 const other=new Group();other.add(head)
 assert.equal(selectVRMBone({vrm}).status,'mismatched-avatar-root')
 other.add(normalizedHead)
 assert.equal(selectVRMBone({vrm,space:'normalized'}).status,'mismatched-avatar-root')
 assert.equal(selectVRMBone({}).status,'waiting-for-humanoid')
 assert.ok(calls.some(([space])=>space==='normalized'))
})
