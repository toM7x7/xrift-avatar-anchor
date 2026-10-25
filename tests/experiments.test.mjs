import test from 'node:test'
import assert from 'node:assert/strict'
import {createMetadataRig,readGLBJSON,createNumericalFixture} from '../scripts/experiment-models.mjs'
import {runExperiments} from '../scripts/run-experiments.mjs'

test('experiment matrix covers distinct anatomy and body attachments without private assets',async()=>{
 const report=await runExperiments()
 assert.equal(report.summary.syntheticModels,6)
 assert.equal(report.summary.samples,810)
 assert.equal(report.summary.passed,810)
 assert.equal(report.summary.failures,0)
 assert.equal(report.ownerIsolation.passed,true)
 assert.deepEqual(report.models.find(model=>model.id==='fixture:axis-turned').records.map(record=>record.attachment).filter((value,index,list)=>list.indexOf(value)===index),['overhead-tag','observer-tag','calibrated-hat','chest-badge','left-hand-item'])
 const standard=createNumericalFixture(),turned=createNumericalFixture('axis-turned')
 assert.notDeepEqual(turned.bones.head.quaternion.toArray(),standard.bones.head.quaternion.toArray())
 assert.notDeepEqual(turned.crown,standard.crown)
})

test('metadata tier maps VRM0 and VRM1 roles without claiming mesh/runtime loading',()=>{
 const nodes=[{children:[1],translation:[1,0,0]},{translation:[0,1.5,0]}]
 const old=createMetadataRig({nodes,scenes:[{nodes:[0]}],extensions:{VRM:{specVersion:'0.0',humanoid:{humanBones:[{bone:'head',node:1}]}}}})
 const modern=createMetadataRig({nodes,scenes:[{nodes:[0]}],extensions:{VRMC_vrm:{specVersion:'1.0',humanoid:{humanBones:{head:{node:1}}}}}})
 assert.equal(old.generation,'VRM 0.0');assert.equal(modern.generation,'VRM 1.0')
 assert.equal(old.evidence,'vrm-metadata-transform');assert.equal(old.root.children[0].children[0],old.bones.head)
 assert.equal(modern.bones.head.matrixWorld.elements[13],1.5)
 assert.throws(()=>createMetadataRig({nodes:[{children:[1]},{children:[0]}],extensions:{VRM:{humanoid:{humanBones:[{bone:'head',node:1}]}}}}),/Cyclic/)
 assert.throws(()=>createMetadataRig({nodes:[{}],extensions:{VRMC_vrm:{humanoid:{humanBones:{head:{node:99}}}}}}),/index/)
})

test('GLB metadata reader rejects malformed binary before reading node data',()=>{
 assert.throws(()=>readGLBJSON(Buffer.alloc(24)),/complete GLB/)
 const body=Buffer.from(JSON.stringify({asset:{version:'2.0'},nodes:[]}).padEnd(64,' ')),data=Buffer.alloc(20+body.length)
 data.writeUInt32LE(0x46546c67,0);data.writeUInt32LE(2,4);data.writeUInt32LE(data.length,8);data.writeUInt32LE(body.length,12);data.writeUInt32LE(0x4e4f534a,16);body.copy(data,20)
 assert.deepEqual(readGLBJSON(data).nodes,[])
 const truncated=Buffer.from(data);truncated.writeUInt32LE(1000,12);assert.throws(()=>readGLBJSON(truncated),/bounds/)
})
