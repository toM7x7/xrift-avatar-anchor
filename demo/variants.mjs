import {createPoseFixture} from './fixture.mjs'

export const FIXTURE_VARIANTS = [
  {id:'standard',label:'S01 標準',scale:1,detail:'基準となる自作骨格'},
  {id:'small',label:'S02 小型',scale:.65,detail:'同じ骨格を0.65倍'},
  {id:'tall',label:'S03 大型',scale:1.35,detail:'同じ骨格を1.35倍'},
  {id:'forward-pivot',label:'S04 前方ピボット',scale:1,detail:'頭の原点を前へ8cm・見た目は維持'},
  {id:'axis-turned',label:'S05 骨軸90°',scale:1,detail:'頭のローカル軸だけを90°回転'},
]

/** Original fixtures only; these are controlled failure probes, not different VRM authors. */
export function createVariantFixture(kind){
  const fixture=createPoseFixture()
  if(kind==='forward-pivot')fixture.bones.head.position.z+=.08
  if(kind==='axis-turned')fixture.bones.head.rotation.y=Math.PI/2
  // Rebind changed pivot/axes while leaving the authored neutral mesh unchanged.
  fixture.mesh.updateWorldMatrix(true,true)
  fixture.skeleton.calculateInverses()
  return fixture
}
