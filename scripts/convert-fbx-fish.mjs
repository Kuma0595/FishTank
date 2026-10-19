import { readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import * as THREE from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { Document, NodeIO } from '@gltf-transform/core'
import { dedup, prune, weld } from '@gltf-transform/functions'

// Static FBX + external JPEG -> self-contained GLB. Keep all source triangles and UV seams.
const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('Usage: node scripts/convert-fbx-fish.mjs input.fbx output.glb')
if (resolve(input) === resolve(output)) throw new Error('Keep the original FBX separate from the output.')

// FBXLoader normally loads images through the DOM; NodeIO embeds the original bytes instead.
globalThis.window = { URL }
const originalLoad = THREE.TextureLoader.prototype.load
THREE.TextureLoader.prototype.load = function (path) {
  const texture = new THREE.Texture()
  texture.userData.sourcePath = path
  return texture
}
let source
try {
  const bytes = await readFile(input)
  source = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
} finally {
  THREE.TextureLoader.prototype.load = originalLoad
}
if (source.animations.length) throw new Error('This converter supports static fish only; animation must be exported separately.')
source.updateMatrixWorld(true)
const meshes = []
source.traverse(node => { if (node instanceof THREE.Mesh) meshes.push(node) })
if (!meshes.length) throw new Error('FBX has no meshes.')

const document = new Document()
const buffer = document.createBuffer()
const scene = document.createScene('Cardinal tetra')
let triangles = 0
for (const mesh of meshes) {
  if (mesh.isSkinnedMesh || Array.isArray(mesh.material) || mesh.geometry.morphAttributes.position?.length) {
    throw new Error('Skins, morphs and multiple materials require a full DCC export.')
  }
  const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
  const material = mesh.material
  const map = material.map
  if (!map || !geometry.attributes.uv || !geometry.attributes.normal) throw new Error('Fish needs a color texture, UVs and normals.')
  if (!map.offset.equals(new THREE.Vector2()) || !map.repeat.equals(new THREE.Vector2(1, 1)) || map.rotation) {
    throw new Error('Bake texture transforms before converting.')
  }
  const texturePath = resolve(dirname(input), map.userData.sourcePath.replaceAll('\\', '/'))
  if (!/\.jpe?g$/i.test(texturePath)) throw new Error('This converter expects an external JPEG color texture.')
  const texture = document.createTexture('Original color').setImage(await readFile(texturePath)).setMimeType('image/jpeg')
  const convertedMaterial = document.createMaterial(material.name)
    .setBaseColorFactor([...material.color.toArray(), material.opacity])
    .setBaseColorTexture(texture).setMetallicFactor(0).setRoughnessFactor(0.65)
    .setDoubleSided(material.side === THREE.DoubleSide)
  const primitive = document.createPrimitive().setMaterial(convertedMaterial)
  for (const [attribute, semantic, type] of [['position', 'POSITION', 'VEC3'], ['normal', 'NORMAL', 'VEC3'], ['uv', 'TEXCOORD_0', 'VEC2']]) {
    const values = new Float32Array(geometry.attributes[attribute].array)
    // Three's FBX textures use flipY=true; glTF textures use the opposite V convention.
    if (attribute === 'uv') for (let i = 1; i < values.length; i += 2) values[i] = 1 - values[i]
    primitive.setAttribute(semantic, document.createAccessor().setType(type).setArray(values).setBuffer(buffer))
  }
  if (geometry.index) primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint32Array(geometry.index.array)).setBuffer(buffer))
  triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3
  scene.addChild(document.createNode(mesh.name).setMesh(document.createMesh(mesh.name).addPrimitive(primitive)))
  geometry.dispose()
}
await document.transform(weld(), dedup(), prune())
await new NodeIO().write(output, document)
console.log(JSON.stringify({ meshes: meshes.length, triangles, bytes: (await stat(output)).size, animations: source.animations.length }, null, 2))
