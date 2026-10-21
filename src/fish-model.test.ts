import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import type { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { normalizeFishModel, FishModelLibrary } from './fish-model'
import { fishModelForSpecies, fishThumbnailForSpecies, whitecloudFishModel, cardinalFishModel, whitecloudFishThumbnail, cardinalFishThumbnail } from './fish-assets'
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

test('animated fish retain skinning, loop independently, and release only their own skeletons', async () => {
  const scene = new THREE.Group()
  const geometry = new THREE.BoxGeometry(1, 0.3, 0.15)
  const vertices = geometry.attributes.position!.count
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(vertices * 4), 4))
  const weights = new Float32Array(vertices * 4)
  for (let i = 0; i < vertices; i++) weights[i * 4] = 1
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4))
  const bone = new THREE.Bone()
  bone.name = 'tail'
  const texture = new THREE.Texture()
  const fish = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ map: texture }))
  fish.add(bone)
  fish.bind(new THREE.Skeleton([bone]))
  scene.add(fish)
  const clip = new THREE.AnimationClip('swim', 1, [new THREE.NumberKeyframeTrack('tail.rotation[z]', [0, 0.5, 1], [0, 0.4, 0])])
  let calls = 0
  const loader = { loadAsync: async () => { calls++; return { scene, animations: [clip] } as unknown as GLTF } } as Pick<GLTFLoader, 'loadAsync'>
  const library = new FishModelLibrary(loader)
  const [a, b] = await Promise.all([library.create({ ...definition, rotationY: 0 }), library.create({ ...definition, rotationY: 0 })])
  function skinned(root: THREE.Object3D) {
    let result!: THREE.SkinnedMesh
    root.traverse(node => { if (node instanceof THREE.SkinnedMesh) result = node })
    return result
  }
  const am = skinned(a.group), bm = skinned(b.group)
  assert.equal(calls, 1)
  assert.equal(am.geometry, bm.geometry)
  assert.notEqual(am.material, bm.material)
  assert.notEqual(am.skeleton, bm.skeleton)
  assert.notEqual(am.skeleton.bones[0], bm.skeleton.bones[0])
  assert.ok(Math.abs(new THREE.Box3().setFromObject(a.group).getSize(new THREE.Vector3()).x - definition.length) < 1e-6)
  // A native action must never receive the fallback procedural deformation too.
  assert.equal(am.material.onBeforeCompile, THREE.Material.prototype.onBeforeCompile)
  a.update(0, 1, 0)
  b.update(0, 1, Math.PI)
  assert.ok(Math.abs(am.skeleton.bones[0]!.rotation.z) < 1e-6)
  assert.ok(Math.abs(bm.skeleton.bones[0]!.rotation.z - 0.4) < 1e-6)
  a.update(0.5, 1, 0)
  assert.ok(Math.abs(am.skeleton.bones[0]!.rotation.z - 0.4) < 1e-6)
  a.update(1, 1, 0)
  assert.ok(Math.abs(am.skeleton.bones[0]!.rotation.z) < 1e-6)
  let textureDisposals = 0, geometryDisposals = 0, skeletonDisposals = 0
  texture.addEventListener('dispose', () => textureDisposals++)
  geometry.addEventListener('dispose', () => geometryDisposals++)
  const disposeSkeleton = am.skeleton.dispose.bind(am.skeleton)
  am.skeleton.dispose = () => { skeletonDisposals++; disposeSkeleton() }
  a.dispose()
  assert.equal(skeletonDisposals, 1)
  assert.equal(textureDisposals, 0)
  assert.equal(geometryDisposals, 0)
  b.update(0.5, 1, Math.PI)
  assert.ok(Math.abs(bm.skeleton.bones[0]!.rotation.z) < 1e-6)
  b.dispose()
  library.dispose()
  assert.equal(textureDisposals, 1)
  assert.equal(geometryDisposals, 1)
})

for (const file of ['uploaded-fish.glb', 'cardinal-tetra.glb', 'whitecloud-swim.glb']) test(`${file} is self-contained and stays within the per-fish geometry budget`, async () => {
  const data = await readFile(new URL(`../public/models/fish/${file}`, import.meta.url))
  assert.equal(data.toString('ascii', 0, 4), 'glTF')
  assert.equal(data.readUInt32LE(4), 2)
  // The animated asset also carries four skin weights/joint indices per vertex.
  assert.ok(data.length < (file === 'whitecloud-swim.glb' ? 2_000_000 : 1_200_000))
  const jsonLength = data.readUInt32LE(12)
  const json = JSON.parse(data.toString('utf8', 20, 20 + jsonLength))
  let triangles = 0
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    triangles += json.accessors[primitive.indices].count / 3
    assert.ok(primitive.attributes.TEXCOORD_0 !== undefined)
  }
  assert.ok(triangles > 0 && triangles <= 25_000)
  if (file === 'whitecloud-swim.glb') {
    assert.equal(json.skins.length, 1)
    assert.equal(json.skins[0].joints.length, 6)
    assert.equal(json.animations.length, 1)
    const primitive = json.meshes[0].primitives[0]
    assert.ok(primitive.attributes.JOINTS_0 !== undefined)
    assert.ok(primitive.attributes.WEIGHTS_0 !== undefined)
    const binaryOffset = 20 + jsonLength + 8
    function floats(index: number) {
      const accessor = json.accessors[index]
      const view = json.bufferViews[accessor.bufferView]
      assert.equal(accessor.componentType, 5126)
      const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type as 'SCALAR' | 'VEC3' | 'VEC4']
      const offset = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
      return Array.from({ length: accessor.count * width }, (_, i) => data.readFloatLE(offset + i * 4))
    }
    let movingRotations = 0
    for (const channel of json.animations[0].channels) {
      const sampler = json.animations[0].samplers[channel.sampler]
      const times = floats(sampler.input)
      assert.equal(times[0], 0)
      assert.equal(times.at(-1), 4)
      if (channel.target.path !== 'rotation') continue
      const rotations = floats(sampler.output)
      // Include frame 121, the matching loop endpoint omitted by the .blend timeline.
      assert.ok(rotations.slice(0, 4).every((v, i) => Math.abs(v - rotations[rotations.length - 4 + i]!) < 1e-5))
      if (rotations.some((v, i) => Math.abs(v - rotations[i % 4]!) > 0.001)) movingRotations++
    }
    assert.ok(movingRotations >= 6)
    assert.match(whitecloudFishModel.path, /whitecloud-swim\.glb$/)
  }
  if (file === 'cardinal-tetra.glb') {
    // Conversion welds duplicate vertices but must retain every source triangle and the JPEG bytes.
    assert.equal(triangles, 19_042)
    assert.equal(json.animations?.length ?? 0, 0)
    const image = json.bufferViews[json.images[0].bufferView]
    const binaryOffset = 20 + jsonLength + 8
    const embeddedImage = data.subarray(binaryOffset + (image.byteOffset ?? 0), binaryOffset + (image.byteOffset ?? 0) + image.byteLength)
    const originalImage = await readFile(new URL('../assets/source/cardinal-tetra/tripo_convert_92270b96-0002-4256-85f2-b7c221a0a452.fbm/tripo_image_92270b96-0002-4256-85f2-b7c221a0a452_0_0.jpg', import.meta.url))
    assert.deepEqual(embeddedImage, originalImage)
  }
  assert.ok(json.images.every((image: {bufferView?: number; uri?: string}) => image.bufferView !== undefined && !image.uri))
  assert.ok(json.buffers.every((buffer: {uri?: string}) => !buffer.uri))
})

test('each supplied model and thumbnail belongs only to its own species', () => {
  assert.equal(fishModelForSpecies('whitecloud'), whitecloudFishModel)
  assert.equal(fishModelForSpecies('cardinal'), cardinalFishModel)
  assert.equal(fishThumbnailForSpecies('whitecloud'), whitecloudFishThumbnail)
  assert.equal(fishThumbnailForSpecies('cardinal'), cardinalFishThumbnail)
  assert.notEqual(whitecloudFishModel.path, cardinalFishModel.path)
  for (const fish of species.filter(fish => !['whitecloud', 'cardinal'].includes(fish.id))) {
    assert.equal(fishModelForSpecies(fish.id), undefined)
    assert.equal(fishThumbnailForSpecies(fish.id), undefined)
  }
  assert.equal(fishModelForSpecies('__proto__'), undefined)
  assert.equal(fishThumbnailForSpecies('__proto__'), undefined)
})
