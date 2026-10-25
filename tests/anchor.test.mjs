import test from 'node:test'
import assert from 'node:assert/strict'
import {Bone,Group,Quaternion,Scene,Vector3} from 'three'
import {createHeadAnchor,normalizeAnchorSettings,updateHeadAnchor} from '../src/index.mjs'
import {selectXRiftHead} from '../src/adapters/xrift.mjs'
import {createPoseFixture} from '../demo/fixture.mjs'
test('small rotated avatar and transformed attachment parent keep world-meter offsets',()=>{
 const scene=new Scene(),avatar=new Group(),head=new Bone(),parent=new Group(),target=new Group();avatar.scale.setScalar(.65);avatar.rotation.y=.8;avatar.position.set(2,1,-3);head.position.y=1.5;avatar.add(head);parent.position.set(-2,3,4);parent.rotation.y=-.6;parent.scale.setScalar(1.3);parent.add(target);scene.add(avatar,parent)
 const result=updateHeadAnchor(target,{head,settings:{offset:[-.04,.17,-.08],scale:.7}})
 assert.ok(target.getWorldPosition(new Vector3()).distanceTo(new Vector3().fromArray(result.position))<1e-8)
 assert.ok(target.getWorldScale(new Vector3()).distanceTo(new Vector3(.7,.7,.7))<1e-8)
 assert.ok(target.getWorldPosition(new Vector3()).sub(head.getWorldPosition(new Vector3())).distanceTo(new Vector3(-.04,.17,-.08))<1e-8)
})
test('head-local offsets rotate while world offsets do not, and all rotation modes preserve head',()=>{
 const head=new Bone(),target=new Group();head.rotation.y=Math.PI/2;head.rotation.x=.3;head.updateWorldMatrix(true,true);const before=head.quaternion.clone(),camera=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-.4)
 updateHeadAnchor(target,{head,settings:{offset:[0,0,.2],offsetSpace:'head',rotationMode:'head'}})
 assert.ok(target.getWorldPosition(new Vector3()).distanceTo(new Vector3(0,0,.2).applyQuaternion(before))<1e-8);assert.ok(target.quaternion.angleTo(before)<1e-7)
 updateHeadAnchor(target,{head,settings:{rotationMode:'world-up'}});assert.ok(target.quaternion.angleTo(new Quaternion())<1e-7)
 updateHeadAnchor(target,{head,cameraQuaternion:camera,settings:{rotationMode:'camera-facing'}});assert.ok(target.quaternion.angleTo(camera)<1e-7)
 assert.ok(head.quaternion.angleTo(before)<1e-7);assert.throws(()=>updateHeadAnchor(target,{head,settings:{rotationMode:'camera-facing'}}))
})
test('settings are serializable, invalid values fail, and disposal restores attachment transform',()=>{
 const head=new Bone(),target=new Group();target.position.set(2,3,4);target.scale.setScalar(.6);const old=target.position.clone(),anchor=createHeadAnchor(target,{offset:[.02,.2,-.07]})
 assert.deepEqual(normalizeAnchorSettings(JSON.parse(JSON.stringify(anchor.settings))),anchor.settings)
 anchor.update({head});anchor.dispose();anchor.dispose();assert.ok(target.position.equals(old));assert.equal(target.scale.x,.6);assert.throws(()=>anchor.update({head}))
 for(const bad of [{offset:[NaN,0,0]},{scale:0},{rotationMode:'invalid'}])assert.throws(()=>normalizeAnchorSettings(bad))
})
test('XRift fallback refuses ambiguous local rigs and isolates explicitly marked remote owners',()=>{
 const scene=new Scene(),a=createPoseFixture(),b=createPoseFixture(),remote=new Group(),marker=new Group();scene.add(a.mesh,remote);remote.add(b.mesh,marker);marker.userData={id:'remote-player-other',onInteract(){}}
 assert.equal(selectXRiftHead({scene,userId:'me',localUserId:'me'}).head,a.bones.head)
 assert.equal(selectXRiftHead({scene,userId:'other',localUserId:'me'}).head,b.bones.head)
 const extra=createPoseFixture();scene.add(extra.mesh);assert.equal(selectXRiftHead({scene,userId:'me',localUserId:'me'}).status,'ambiguous-head')
 assert.equal(selectXRiftHead({scene,userId:'me',localUserId:'me',avatarRoot:a.mesh}).head,a.bones.head)
 assert.equal(selectXRiftHead({scene,userId:null,localUserId:'me'}).head,null)
 a.dispose();b.dispose();extra.dispose()
})
