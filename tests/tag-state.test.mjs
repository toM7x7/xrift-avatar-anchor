import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeTagState} from '../item/overhead-tag/src/state.mjs'
test('malformed remote instance JSON cannot crash tag rendering or choose invalid texture',()=>{
 for(const value of [null,undefined,[],false,42,{}, {ownerId:3,statusIndex:-1,extraHeight:NaN,serial:Infinity},{ownerId:'other user',statusIndex:100}]){
  const state=normalizeTagState(value);assert.equal(state.ownerId,null);assert.equal(state.statusIndex,0);assert.equal(state.extraHeight,0);assert.equal(state.serial,0)
 }
})
test('tag state preserves valid wearer and status while bounding shared adjustments',()=>{
 const input={ownerId:'local-user',statusIndex:2,extraHeight:20,serial:7},output=normalizeTagState(input)
 assert.deepEqual(output,{ownerId:'local-user',statusIndex:2,extraHeight:.3,serial:7});assert.equal(input.extraHeight,20)
 assert.equal(normalizeTagState({...input,extraHeight:-10}).extraHeight,-.09)
 assert.deepEqual(normalizeTagState(JSON.parse(JSON.stringify(output))),output)
})
