import test from 'node:test'
import assert from 'node:assert/strict'
import {Box3,Group,Scene,Vector3} from 'three'
import {createVariantFixture} from '../demo/variants.mjs'
import {refreshSkinnedBounds,syncSkinnedTransforms} from '../demo/skinning.mjs'

test('neutral CPU-skinned bounds are independent of previous rendered root scale and movement',()=>{
 const scene=new Scene(),holder=new Group(),fixture=createVariantFixture('axis-turned');scene.add(holder);holder.add(fixture.mesh)
 const neutralHead=fixture.bones.head.quaternion.clone()
 const neutral=()=>{holder.position.set(0,0,0);holder.rotation.set(0,0,0);holder.scale.setScalar(1);fixture.bones.head.quaternion.copy(neutralHead);refreshSkinnedBounds(holder);return new Box3().setFromObject(fixture.mesh)}
 const baseline=neutral(),headBefore=fixture.bones.head.getWorldPosition(new Vector3())
 for(const scale of [.65,1,1.35,.3,2]){
  holder.scale.setScalar(scale);holder.position.set(.4,-.28,.3);holder.rotation.set(.13,.65,.08);fixture.bones.head.rotateY(.7)
  syncSkinnedTransforms(holder)
  // Simulate the renderer's additional traversal before the next reference press.
  scene.updateMatrixWorld(true)
  const actual=neutral()
  assert.ok(actual.min.distanceTo(baseline.min)<1e-10,`neutral minimum changed after ${scale}`)
  assert.ok(actual.max.distanceTo(baseline.max)<1e-10,`neutral maximum changed after ${scale}`)
  assert.ok(fixture.bones.head.getWorldPosition(new Vector3()).distanceTo(headBefore)<1e-10)
 }
 fixture.dispose()
})

test('CPU-skinned bounds scale in world units before any renderer traversal',()=>{
 const holder=new Group(),fixture=createVariantFixture('standard');holder.add(fixture.mesh)
 refreshSkinnedBounds(holder);const baseline=new Box3().setFromObject(fixture.mesh).getSize(new Vector3())
 for(const scale of [.65,1.35,1]){
  holder.scale.setScalar(scale);refreshSkinnedBounds(holder)
  const actual=new Box3().setFromObject(fixture.mesh).getSize(new Vector3())
  assert.ok(actual.distanceTo(baseline.clone().multiplyScalar(scale))<1e-9)
 }
 fixture.dispose()
})
