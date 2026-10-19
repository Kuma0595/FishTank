import test from 'node:test'
import assert from 'node:assert/strict'
import { guppyBodyGeometry, guppyTailGeometry, guppyMorph } from './guppy'

test('guppy body has outward normals, finite UVs and a narrow caudal peduncle', () => {
  const geometry = guppyBodyGeometry()
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal')
  assert.ok(Array.from(p.array).every(Number.isFinite))
  assert.ok(Array.from(n.array).every(Number.isFinite))
  assert.ok(Array.from(geometry.getAttribute('uv').array).every(v => v >= 0 && v <= 1.001))
  // Every longitudinal ring starts on the camera-facing side (+Z).
  for (let ring = 1; ring < 63; ring++) assert.ok(n.getZ(ring * 41) > 0.1)
  assert.ok(p.getZ(0) < 0.03)
  assert.ok(Math.max(...Array.from(p.array).filter((_, i) => i % 3 === 2)) > 0.09)
  assert.ok(geometry.index!.count / 3 < 5500)
  geometry.dispose()
})

test('guppy membrane stays attached at its root, has depth and room for flutter', () => {
  const geometry = guppyTailGeometry()
  const p = geometry.getAttribute('position'), weight = geometry.getAttribute('finWeight')
  for (let i = 0; i <= 72; i++) {
    assert.ok(Math.abs(p.getX(i) + 0.43) < 1e-6)
    assert.ok(Math.abs(p.getY(i) - 0.006) < 0.026)
    assert.equal(weight.getX(i), 0)
  }
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox!
  assert.ok(bounds.max.z - bounds.min.z > 0.02)
  assert.ok(bounds.max.y - bounds.min.y > 0.7)
  assert.ok(geometry.boundingSphere!.radius > 0.5)
  assert.ok(geometry.index!.count / 3 < 3600)
  assert.ok(Array.from(p.array).every(Number.isFinite))
  geometry.dispose()
})

test('guppy color morph survives reloads and spans all three palettes', () => {
  assert.deepEqual(['c', 'a', 'b'].map(guppyMorph), [0, 1, 2])
  const restoredIdentity = JSON.parse(JSON.stringify({ uid: '孔雀鱼-1' })).uid
  assert.equal(guppyMorph(restoredIdentity), guppyMorph('孔雀鱼-1'))
  assert.ok(guppyMorph('fish-291') >= 0 && guppyMorph('fish-291') < 3)
})
