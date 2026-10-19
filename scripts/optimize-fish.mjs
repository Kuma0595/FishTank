import { NodeIO } from '@gltf-transform/core'
import { dedup, prune, simplify, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
const [input, output] = process.argv.slice(2)
if (!input || !output) {
  console.error('Usage: node scripts/optimize-fish.mjs input.glb output.glb')
  process.exit(1)
}
if (resolve(input) === resolve(output)) throw new Error('Keep the original model: input and output must differ.')
const io = new NodeIO()
const document = await io.read(input)
function triangles() {
  return document.getRoot().listMeshes().flatMap(m => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0) / 3, 0)
}
const before = triangles()
await MeshoptSimplifier.ready
await document.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.18, error: 0.001 }), dedup(), prune())
await io.write(output, document)
console.log(JSON.stringify({ trianglesBefore: before, trianglesAfter: triangles(), bytesBefore: (await stat(input)).size, bytesAfter: (await stat(output)).size, animations: document.getRoot().listAnimations().length }, null, 2))
