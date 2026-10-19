import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import type { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { normalizeFishModel, FishModelLibrary } from './fish-model'
import { fishModelForSpecies, whitecloudFishModel } from './fish-assets'
import { species } from './catalog'

function source() {
  const scene = new THREE.Group()
  const geometry = new THREE.BoxGeometry(0.12, 0.4, 1)
  const texture = new THREE.Texture()
  const material = new THREE.MeshStandardMaterial({ map: texture })
  scene.add(new THREE.Mesh(geometry, material))
  return { scene, geometry, material, texture }
}
function loaderFor(scene: THREE.Group) {
  let calls = 0
  const loader = { loadAsync: async () => { calls++; return { scene } as unknown as GLTF } } as Pick<GLTFLoader, 'loadAsync'>
  return { loader, calls: () => calls }
}
const definition = { path: 'fish.glb', rotationY: -Math.PI / 2, length: 0.6 }

test('import transforms are baked and centered without altering artist UVs or original geometry', () => {
  const original = source()
  original.scene.position.set(2, -3, 1)
  original.scene.scale.setScalar(2)
  const uv = Array.from(original.geometry.attributes.uv!.array)
  const normalized = normalizeFishModel(original.scene, -Math.PI / 2)
  const bounds = new THREE.Box3().setFromObject(normalized)
  const size = bounds.getSize(new THREE.Vector3())
  assert.ok(Math.abs(size.x - 1) < 1e-6)
  assert.ok(Math.abs(size.y - 0.4) < 1e-6)
  assert.ok(bounds.getCenter(new THREE.Vector3()).length() < 1e-6)
  const mesh = normalized.children[0] as THREE.Mesh
  assert.notEqual(mesh.geometry, original.geometry)
  assert.deepEqual(Array.from(mesh.geometry.attributes.uv!.array), uv)
  assert.equal(original.scene.position.x, 2)
  assert.equal(original.geometry.attributes.position!.getZ(0), 0.5)
})

test('a school downloads once, shares geometry, and releases textures only when its library closes', async () => {
  const original = source()
  const fake = loaderFor(original.scene)
  const library = new FishModelLibrary(fake.loader)
  const [a, b] = await Promise.all([library.create(definition), library.create(definition)])
  assert.equal(fake.calls(), 1)
  const am = a.group.children[0] as THREE.Mesh
  const bm = b.group.children[0] as THREE.Mesh
  assert.equal(am.geometry, bm.geometry)
  assert.notEqual(am.material, bm.material)
  let textureDisposals = 0, geometryDisposals = 0
  original.texture.addEventListener('dispose', () => textureDisposals++)
  am.geometry.addEventListener('dispose', () => geometryDisposals++)
  a.dispose()
  assert.equal(textureDisposals, 0)
  assert.equal(geometryDisposals, 0)
  b.update(2, 1, 0.7)
  b.dispose()
  library.dispose()
  library.dispose()
  assert.equal(textureDisposals, 1)
  assert.equal(geometryDisposals, 1)
})

test('late downloads cannot resurrect models after a tank is closed', async () => {
  const original = source()
  let resolve!: (gltf: GLTF) => void
  const loader = { loadAsync: () => new Promise<GLTF>(r => resolve = r) } as Pick<GLTFLoader, 'loadAsync'>
  const library = new FishModelLibrary(loader)
  const pending = library.create(definition)
  library.dispose()
  resolve({ scene: original.scene } as unknown as GLTF)
  await assert.rejects(pending, /鱼缸已经关闭/)
})

test('published GLB is self-contained and stays within the per-fish geometry budget', async () => {
  const data = await readFile(new URL('../public/models/fish/uploaded-fish.glb', import.meta.url))
  assert.equal(data.toString('ascii', 0, 4), 'glTF')
  assert.equal(data.readUInt32LE(4), 2)
  assert.ok(data.length < 1_200_000)
  const jsonLength = data.readUInt32LE(12)
  const json = JSON.parse(data.toString('utf8', 20, 20 + jsonLength))
  let triangles = 0
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    triangles += json.accessors[primitive.indices].count / 3
    assert.ok(primitive.attributes.TEXCOORD_0 !== undefined)
  }
  assert.ok(triangles > 0 && triangles <= 25_000)
  assert.ok(json.images.every((image: {bufferView?: number; uri?: string}) => image.bufferView !== undefined && !image.uri))
  assert.ok(json.buffers.every((buffer: {uri?: string}) => !buffer.uri))
})

test('the supplied model is always whitecloud and cannot override any other species', () => {
  assert.equal(fishModelForSpecies('whitecloud'), whitecloudFishModel)
  for (const fish of species.filter(fish => fish.id !== 'whitecloud')) {
    assert.equal(fishModelForSpecies(fish.id), undefined)
  }
  assert.equal(fishModelForSpecies('__proto__'), undefined)
})
