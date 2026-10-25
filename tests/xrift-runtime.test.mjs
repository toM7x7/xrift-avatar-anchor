import test from 'node:test'
import assert from 'node:assert/strict'
import {Bone,Group,Scene,Skeleton,SkinnedMesh} from 'three'
import {selectXRiftAvatar,isXRiftAvatarBindingCurrent} from '../src/adapters/xrift-runtime.mjs'
import {createPoseFixture} from '../demo/fixture.mjs'

function remote(scene, fixture, userId) {
  const root=new Group(),marker=new Group()
  marker.userData={id:`remote-player-${userId}`,onInteract(){}}
  root.add(fixture.mesh,marker);scene.add(root)
  return {root,marker}
}

test('runtime selector groups one head across body and first-person head palettes and excludes remote owners',()=>{
  const scene=new Scene(),local=createPoseFixture(),other=createPoseFixture()
  scene.add(local.mesh);const peer=remote(scene,other,'peer')
  const original=local.bones.head.position.toArray(),q=local.bones.head.quaternion.toArray()
  const result=selectXRiftAvatar({scene,userId:'me',localUserId:'me'})
  assert.equal(result.status,'ready');assert.equal(result.head,local.bones.head)
  assert.equal(result.avatarRoot,local.mesh);assert.equal(result.meshes.length,2)
  assert.equal(result.source,'local-unclaimed-head')
  const otherResult=selectXRiftAvatar({scene,userId:'peer',localUserId:'me'})
  assert.equal(otherResult.head,other.bones.head);assert.equal(otherResult.avatarRoot,peer.root)
  assert.ok(isXRiftAvatarBindingCurrent(result,{scene}))
  assert.deepEqual(local.bones.head.position.toArray(),original);assert.deepEqual(local.bones.head.quaternion.toArray(),q)
  local.dispose();other.dispose()
})

test('ambiguous owner/head and unbound scene heads fail closed instead of choosing nearest',()=>{
  const scene=new Scene(),a=createPoseFixture(),b=createPoseFixture()
  scene.add(a.mesh,b.mesh);b.mesh.position.set(100,0,0)
  assert.equal(selectXRiftAvatar({scene,userId:'me',localUserId:'me'}).status,'ambiguous-head')
  assert.equal(selectXRiftAvatar({scene,userId:'missing',localUserId:'me'}).status,'waiting-for-avatar')
  assert.equal(selectXRiftAvatar({scene,userId:null,localUserId:'me'}).status,'empty')
  remote(scene,a,'peer');remote(scene,b,'peer')
  assert.equal(selectXRiftAvatar({scene,userId:'peer',localUserId:'me'}).status,'ambiguous-owner')
  a.dispose();b.dispose()
})

test('explicit root and item exclusions prevent own preview or another rig from becoming wearer',()=>{
  const scene=new Scene(),a=createPoseFixture(),itemRig=createPoseFixture(),itemRoot=new Group()
  scene.add(a.mesh,itemRoot);itemRoot.add(itemRig.mesh)
  const result=selectXRiftAvatar({scene,userId:'me',localUserId:'me',excludeRoots:[itemRoot]})
  assert.equal(result.head,a.bones.head)
  assert.equal(selectXRiftAvatar({scene,userId:'me',localUserId:'me',avatarRoot:itemRoot,excludeRoots:[itemRoot]}).status,'waiting-for-avatar')
  const explicit=selectXRiftAvatar({scene,userId:'me',avatarRoot:a.mesh})
  assert.equal(explicit.status,'ready');assert.equal(explicit.source,'explicit-avatar-root')
  const detached=new Group()
  assert.equal(selectXRiftAvatar({scene,userId:'me',avatarRoot:detached}).status,'waiting-for-avatar')
  a.dispose();itemRig.dispose()
})

test('cache invalidates removed avatar, removed mesh, changed skeleton or changed palette',()=>{
  const scene=new Scene(),a=createPoseFixture();scene.add(a.mesh)
  const input={scene,userId:'me',localUserId:'me'},result=selectXRiftAvatar(input)
  assert.ok(isXRiftAvatarBindingCurrent(result,{scene}))
  scene.remove(a.mesh);assert.equal(isXRiftAvatarBindingCurrent(result,{scene}),false);scene.add(a.mesh)
  const previous=a.mesh.skeleton;a.mesh.skeleton=new Skeleton(previous.bones)
  assert.equal(isXRiftAvatarBindingCurrent(result,{scene}),false);a.mesh.skeleton=previous
  previous.bones.push(new Bone());assert.equal(isXRiftAvatarBindingCurrent(result,{scene}),false);previous.bones.pop()
  const headMesh=a.mesh.children.find(child=>child.isSkinnedMesh)
  a.mesh.remove(headMesh);assert.equal(isXRiftAvatarBindingCurrent(result,{scene}),false);a.mesh.add(headMesh)
  a.dispose()
})

test('raw wins only inside a shared palette; independent normalized rig still counts as ambiguity',()=>{
  const scene=new Scene(),a=createPoseFixture(),b=createPoseFixture();scene.add(a.mesh)
  const normalized=new Bone();normalized.name='Normalized_Head';a.mesh.add(normalized);a.skeleton.bones.push(normalized)
  assert.equal(selectXRiftAvatar({scene,userId:'me',localUserId:'me'}).head,a.bones.head)
  b.bones.head.name='Normalized_Head';scene.add(b.mesh)
  assert.equal(selectXRiftAvatar({scene,userId:'me',localUserId:'me'}).status,'ambiguous-head')
  a.skeleton.bones.pop();a.dispose();b.dispose()
})

test('head descendants can contribute hair meshes without admitting another avatar palette',()=>{
  const scene=new Scene(),a=createPoseFixture(),hairJoint=new Bone();scene.add(a.mesh)
  hairJoint.name='hair-tip';a.bones.head.add(hairJoint)
  const hair=new SkinnedMesh();hair.skeleton=new Skeleton([hairJoint]);a.mesh.add(hair)
  const result=selectXRiftAvatar({scene,userId:'me',localUserId:'me'})
  assert.equal(result.status,'ready');assert.ok(result.meshes.includes(hair))
  hair.skeleton.dispose();a.dispose()
})
