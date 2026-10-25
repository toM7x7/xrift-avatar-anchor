import test from 'node:test'
import assert from 'node:assert/strict'
import {Bone, Euler, Group, Matrix4, Quaternion, Scene, Vector3} from 'three'
import {
  createAnchor, updateAnchor, updateHeadAnchor, normalizeAnchorSettings,
  normalizeAttachmentProfile, serializeAttachmentProfile, resolveAttachmentProfile,
  HUMANOID_BONE_ROLES,
} from '../src/index.mjs'
import {createPoseFixture} from '../demo/fixture.mjs'

const nearVector = (actual, expected) => assert.ok(actual.distanceTo(expected) < 1e-8, `${actual.toArray()} != ${expected.toArray()}`)
const nearMatrix = (actual, expected) => actual.elements.forEach((value, i) => assert.ok(Math.abs(value - expected.elements[i]) < 1e-8))
const transform = object => ({p: object.position.toArray(), q: object.quaternion.toArray(), s: object.scale.toArray(), matrix: object.matrix.toArray()})

test('generic attachment follows six body roles through scale, motion, and pivot displacement without editing bones', () => {
  const fixture = createPoseFixture(), scene = new Scene(), avatar = new Group(), target = new Group()
  avatar.add(fixture.mesh); scene.add(avatar, target)
  const cameraQuaternion = new Quaternion().setFromEuler(new Euler(.3, -.6, .1)), beforeCamera = cameraQuaternion.toArray()
  const offset = new Vector3(.045, .13, -.07)
  try {
    for (const scale of [.3, .65, 1, 1.35, 3]) for (const role of ['head', 'chest', 'leftHand', 'rightHand', 'hips', 'leftFoot']) {
      avatar.scale.setScalar(scale); avatar.position.set(2, .1, -4); avatar.rotation.set(.1, .9, .2)
      const bone = fixture.bones[role]; bone.rotation.set(-.35, .7, -.15)
      avatar.updateWorldMatrix(true, true)
      const before = transform(bone), origin = bone.getWorldPosition(new Vector3()), orientation = bone.getWorldQuaternion(new Quaternion())
      const result = updateAnchor(target, {bone, cameraQuaternion, settings: {offset: offset.toArray(), offsetSpace: 'bone', rotationMode: 'bone', scale: .8}})
      nearVector(target.getWorldPosition(new Vector3()), origin.clone().add(offset.clone().applyQuaternion(orientation)))
      nearVector(target.getWorldScale(new Vector3()), new Vector3(.8, .8, .8))
      assert.ok(target.getWorldQuaternion(new Quaternion()).angleTo(orientation) < 1e-7)
      assert.deepEqual(result.bone, origin.toArray()); assert.deepEqual(transform(bone), before)
    }
    assert.deepEqual(cameraQuaternion.toArray(), beforeCamera)
  } finally {fixture.dispose()}
})

test('rotation calibration composes after chosen orientation under a transformed attachment parent', () => {
  const bone = new Bone(), parent = new Group(), target = new Group()
  bone.position.set(1, 2, -1); bone.rotation.set(.3, .6, -.2)
  parent.position.set(-2, 1, 4); parent.rotation.set(.1, -.7, .2); parent.scale.setScalar(1.6); parent.add(target)
  const correction = new Quaternion().setFromEuler(new Euler(.2, -.4, .7)), camera = new Quaternion().setFromEuler(new Euler(-.1, .2, .5))
  for (const rotationMode of ['bone', 'world-up', 'camera-facing']) {
    const origin = bone.getWorldPosition(new Vector3()), boneRotation = bone.getWorldQuaternion(new Quaternion())
    const orientation = rotationMode === 'bone' ? boneRotation : rotationMode === 'camera-facing' ? camera.clone() : new Quaternion()
    orientation.multiply(correction)
    const expected = new Matrix4().compose(origin.add(new Vector3(.02, .18, -.04)), orientation, new Vector3(.7, .7, .7))
    updateAnchor(target, {bone, cameraQuaternion: camera, settings: {offset: [.02, .18, -.04], rotationMode, rotationOffset: correction.toArray(), scale: .7}})
    nearMatrix(target.matrixWorld, expected)
  }
})

test('legacy head aliases produce the same output as generic bone settings', () => {
  const bone = new Bone(), a = new Group(), b = new Group(); bone.rotation.set(.4, -.8, .1)
  const headReport = updateHeadAnchor(a, {head: bone, settings: {offsetSpace: 'head', rotationMode: 'head'}})
  const boneReport = updateAnchor(b, {bone, settings: {offsetSpace: 'bone', rotationMode: 'bone'}})
  nearMatrix(a.matrixWorld, b.matrixWorld)
  assert.deepEqual(headReport.head, boneReport.bone)
})

test('unsupported shear and singular/nonfinite transforms reject without editing target', () => {
  const bone = new Bone(), parent = new Group(), target = new Group(); parent.add(target)
  target.position.set(.1, .2, .3); target.rotation.set(.1, .2, .4); target.scale.setScalar(.6); target.updateMatrix()
  const before = transform(target)
  parent.scale.set(2, 1, .5); parent.rotation.y = .7; parent.position.x = 1e8
  assert.throws(() => updateAnchor(target, {bone}), /shear/)
  assert.deepEqual(transform(target), before)
  parent.scale.set(0, 1, 1)
  assert.throws(() => updateAnchor(target, {bone}), /singular/)
  assert.deepEqual(transform(target), before)
  parent.scale.setScalar(1); parent.position.x = Infinity
  assert.throws(() => updateAnchor(target, {bone}), /not finite/)
  assert.deepEqual(transform(target), before)
  const sourceParent = new Group(); sourceParent.scale.set(2, 1, .5); sourceParent.add(bone); bone.rotation.y = .5
  assert.throws(() => updateAnchor(new Group(), {bone}), /Source bone.*shear/)
})

test('aligned nonuniform attachment parent remains representable and mirrored source is rejected', () => {
  const bone = new Bone(), parent = new Group(), target = new Group(); parent.add(target); parent.scale.set(2, 1, .5)
  updateAnchor(target, {bone, settings: {offset: [.1, .3, -.2], scale: .8}})
  nearVector(target.getWorldPosition(new Vector3()), new Vector3(.1, .3, -.2))
  nearVector(target.getWorldScale(new Vector3()), new Vector3(.8, .8, .8))
  bone.scale.x = -1
  assert.throws(() => updateAnchor(target, {bone}), /reflected/)
})

test('self/ancestor targets and invalid camera orientations fail before changing source or target', () => {
  const root = new Group(), bone = new Bone(); root.add(bone); root.updateWorldMatrix(true, true)
  const before = transform(root)
  assert.throws(() => updateAnchor(root, {bone}), /ancestor/)
  assert.throws(() => updateAnchor(bone, {bone}), /ancestor/)
  assert.deepEqual(transform(root), before)
  for (const cameraQuaternion of [undefined, new Quaternion(0, 0, 0, 0), new Quaternion(0, NaN, 0, 1)]) {
    const target = new Group(), saved = transform(target)
    assert.throws(() => updateAnchor(target, {bone, cameraQuaternion, settings: {rotationMode: 'camera-facing'}}))
    assert.deepEqual(transform(target), saved)
  }
})

test('controller supports manual local matrix updates, and restores original pose and matrix on dispose', () => {
  const bone = new Bone(), target = new Group(); target.matrixAutoUpdate = false
  target.position.set(2, 3, 4); target.rotation.set(.2, -.3, .1); target.scale.set(.3, .7, 1.2); target.updateMatrix()
  const before = transform(target), controller = createAnchor(target, {offset: [0, .4, -.1]})
  controller.update({bone}); nearVector(target.getWorldPosition(new Vector3()), new Vector3(0, .4, -.1))
  controller.dispose(); controller.dispose()
  assert.deepEqual(transform(target), before); assert.equal(target.matrixAutoUpdate, false)
  assert.throws(() => controller.update({bone}), /disposed/)
  target.matrixWorldAutoUpdate = false
  assert.throws(() => updateAnchor(target, {bone}), /matrixWorldAutoUpdate/)
})

const profile = overrides => ({schema: 'xrift-avatar-anchor.profile', version: 1, avatarId: 'A01', attachmentId: 'hat', bone: 'head', settings: {offset: [.01, .18, -.04], offsetSpace: 'bone', rotationMode: 'bone', rotationOffset: [0, 0, 0, 1]}, ...overrides})

test('versioned calibration profiles round-trip, clone numeric settings, and require exact unique identity', () => {
  const input = profile(), normalized = normalizeAttachmentProfile(input)
  assert.deepEqual(normalizeAttachmentProfile(JSON.parse(serializeAttachmentProfile(normalized))), normalized)
  input.settings.offset[0] = .9; assert.equal(normalized.settings.offset[0], .01)
  assert.equal(HUMANOID_BONE_ROLES.length, new Set(HUMANOID_BONE_ROLES).size)
  assert.equal(resolveAttachmentProfile([normalized], {avatarId: 'A01', attachmentId: 'hat'}).status, 'ready')
  assert.equal(resolveAttachmentProfile([normalized], {avatarId: 'A02', attachmentId: 'hat'}).status, 'missing-profile')
  assert.equal(resolveAttachmentProfile([normalized], {avatarId: 'A01', attachmentId: 'tag'}).status, 'missing-profile')
  assert.equal(resolveAttachmentProfile([normalized, normalized], {avatarId: 'A01', attachmentId: 'hat'}).status, 'ambiguous-profile')
  assert.equal(resolveAttachmentProfile([normalized], {avatarId: 'A01', attachmentId: 'hat', bone: 'leftHand'}).status, 'bone-mismatch')
  assert.equal(normalizeAttachmentProfile(profile({bone: 'rightIndexDistal'})).bone, 'rightIndexDistal')
})

test('profiles and settings reject unsupported versions, bones, identifiers, and nonfinite calibration', () => {
  for (const overrides of [{schema: 'other'}, {version: 2}, {version: '1'}, {avatarId: ''}, {avatarId: ' A01'}, {attachmentId: '\n'}, {bone: 'skull'}, {settings: null}]) {
    assert.throws(() => normalizeAttachmentProfile(profile(overrides)))
  }
  for (const settings of [null, [], {offset: [0, Infinity, 0]}, {offsetSpace: 'avatar'}, {rotationMode: 'billboard'}, {scale: -1}, {rotationOffset: [0, 0, 0, 0]}, {rotationOffset: [0, 0, NaN, 1]}]) {
    assert.throws(() => normalizeAnchorSettings(settings))
  }
  assert.deepEqual(normalizeAnchorSettings({rotationOffset: [0, 0, 0, 2]}).rotationOffset, [0, 0, 0, 1])
})
