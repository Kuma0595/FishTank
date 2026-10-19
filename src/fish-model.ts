import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export interface FishModelDefinition {
  path: string
  /** Rotate the asset so that its nose points along positive X. */
  rotationY: number
  length: number
}

export interface ImportedFishVisual {
  group: THREE.Group
  update: (time: number, speed: number, phase: number) => void
  dispose: () => void
}

const SWIM_GLSL = `
uniform float uFishTime;
uniform float uFishPhase;
uniform float uFishSpeed;
float fishBend(float x) {
  float tail = 1.0 - smoothstep(-0.46, 0.3, x);
  float wave = sin(uFishTime * (5.0 + uFishSpeed * 2.5) + uFishPhase + x * 5.0);
  return wave * tail * tail * 0.065;
}
`

/** Bake scene transforms, retain the artist's UVs, and center the actor on its bounds. */
export function normalizeFishModel(source: THREE.Object3D, rotationY: number): THREE.Group {
  source.updateMatrixWorld(true)
  const group = new THREE.Group()
  const correction = new THREE.Matrix4().makeRotationY(rotationY)
  source.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    const geometry = object.geometry.clone()
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(correction, object.matrixWorld))
    const sourceMaterials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material]
    const materials = sourceMaterials.map(material => material.clone())
    const mesh = new THREE.Mesh(geometry, Array.isArray(object.material) ? materials : materials[0])
    group.add(mesh)
  })
  const bounds = new THREE.Box3().setFromObject(group)
  const size = bounds.getSize(new THREE.Vector3())
  if (group.children.length === 0 || !Number.isFinite(size.x) || size.x <= 0) throw new Error('鱼模型缺少有效的网格')
  const center = bounds.getCenter(new THREE.Vector3())
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.translate(-center.x, -center.y, -center.z)
    object.geometry.scale(1 / size.x, 1 / size.x, 1 / size.x)
    object.geometry.computeBoundingBox()
    object.geometry.computeBoundingSphere()
    // The swim shader displaces the tail slightly outside the static bounding sphere.
    if (object.geometry.boundingSphere) object.geometry.boundingSphere.radius += 0.08
  })
  return group
}

function materialsOf(object: THREE.Object3D): THREE.Material[] {
  const materials = new Set<THREE.Material>()
  object.traverse(node => {
    if (node instanceof THREE.Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material)
  })
  return [...materials]
}

function disposeTemplate(template: THREE.Object3D, withTextures = true) {
  const geometries = new Set<THREE.BufferGeometry>()
  const textures = new Set<THREE.Texture>()
  template.traverse(object => {
    if (object instanceof THREE.Mesh) geometries.add(object.geometry)
  })
  for (const material of materialsOf(template)) {
    if (withTextures) for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
    material.dispose()
  }
  for (const geometry of geometries) geometry.dispose()
  for (const texture of textures) texture.dispose()
}

export class FishModelLibrary {
  constructor(private loader: Pick<GLTFLoader, 'loadAsync'> = new GLTFLoader()) {}
  private cache = new Map<string, Promise<THREE.Group>>()
  private templates = new Set<THREE.Group>()
  private disposed = false

  private load(definition: FishModelDefinition): Promise<THREE.Group> {
    const key = `${definition.path}:${definition.rotationY}`
    let promise = this.cache.get(key)
    if (!promise) {
      promise = this.loader.loadAsync(definition.path).then(gltf => {
        let template: THREE.Group
        try {
          template = normalizeFishModel(gltf.scene, definition.rotationY)
        } finally {
          // The normalized copy owns its own geometry/materials and retains the source textures.
          disposeTemplate(gltf.scene, false)
        }
        if (this.disposed) {
          disposeTemplate(template)
          throw new Error('鱼缸已经关闭')
        }
        this.templates.add(template)
        return template
      }).catch(error => {
        this.cache.delete(key)
        throw error
      })
      this.cache.set(key, promise)
    }
    return promise
  }

  async create(definition: FishModelDefinition): Promise<ImportedFishVisual> {
    if (this.disposed) throw new Error('鱼缸已经关闭')
    const template = await this.load(definition)
    if (this.disposed) throw new Error('鱼缸已经关闭')
    const group = new THREE.Group()
    group.scale.setScalar(definition.length)
    const uniforms = { uFishTime: { value: 0 }, uFishPhase: { value: 0 }, uFishSpeed: { value: 1 } }
    const actorMaterials: THREE.Material[] = []
    template.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      const sourceMaterials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material]
      const materials = sourceMaterials.map(source => {
        const material = source.clone()
        material.onBeforeCompile = shader => {
          Object.assign(shader.uniforms, uniforms)
          shader.vertexShader = SWIM_GLSL + shader.vertexShader
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z += fishBend(position.x);')
          shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nfloat fishSlope = (fishBend(position.x + 0.001) - fishBend(position.x - 0.001)) / 0.002;\nobjectNormal.x -= fishSlope * objectNormal.z;')
        }
        material.customProgramCacheKey = () => 'imported-fish-swim-v1'
        actorMaterials.push(material)
        return material
      })
      const mesh = new THREE.Mesh(object.geometry, Array.isArray(object.material) ? materials : materials[0])
      // Geometry and textures are shared. Only actor materials are released when a fish leaves.
      mesh.userData.sharedFishResources = true
      group.add(mesh)
    })
    return {
      group,
      update(time, speed, phase) {
        uniforms.uFishTime.value = time
        uniforms.uFishSpeed.value = speed
        uniforms.uFishPhase.value = phase
      },
      dispose() {
        for (const material of actorMaterials) material.dispose()
      },
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    for (const template of this.templates) disposeTemplate(template)
    this.templates.clear()
    this.cache.clear()
  }
}
