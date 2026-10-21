import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'

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

/** Keep the skin, bone hierarchy, and animation target names intact. */
function normalizeAnimatedFish(source: THREE.Object3D, rotationY: number): THREE.Group {
  const group = new THREE.Group()
  const correction = new THREE.Group()
  correction.rotation.y = rotationY
  correction.add(source)
  group.add(correction)
  group.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(group)
  const size = bounds.getSize(new THREE.Vector3())
  if (bounds.isEmpty() || !Number.isFinite(size.x) || size.x <= 0) throw new Error('鱼模型缺少有效的网格')
  correction.position.sub(bounds.getCenter(new THREE.Vector3()))
  group.scale.setScalar(1 / size.x)
  return group
}

interface FishTemplate {
  group: THREE.Group
  clips: THREE.AnimationClip[]
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
  const skeletons = new Set<THREE.Skeleton>()
  template.traverse(object => {
    if (object instanceof THREE.Mesh) geometries.add(object.geometry)
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton)
  })
  for (const material of materialsOf(template)) {
    if (withTextures) for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
    material.dispose()
  }
  for (const geometry of geometries) geometry.dispose()
  for (const texture of textures) texture.dispose()
  for (const skeleton of skeletons) skeleton.dispose()
}

export class FishModelLibrary {
  constructor(private loader: Pick<GLTFLoader, 'loadAsync'> = new GLTFLoader()) {}
  private cache = new Map<string, Promise<FishTemplate>>()
  private templates = new Set<THREE.Group>()
  private disposed = false

  private load(definition: FishModelDefinition): Promise<FishTemplate> {
    const key = `${definition.path}:${definition.rotationY}`
    let promise = this.cache.get(key)
    if (!promise) {
      promise = this.loader.loadAsync(definition.path).then(gltf => {
        let template: THREE.Group
        const clips = gltf.animations ?? []
        if (clips.length) {
          // Flattening into ordinary meshes would discard the supplied skeleton and action.
          try {
            template = normalizeAnimatedFish(gltf.scene, definition.rotationY)
          } catch (error) {
            disposeTemplate(gltf.scene)
            throw error
          }
        } else {
          try {
            template = normalizeFishModel(gltf.scene, definition.rotationY)
          } finally {
            // The normalized copy owns geometry/materials and retains source textures.
            disposeTemplate(gltf.scene, false)
          }
        }
        if (this.disposed) {
          disposeTemplate(template)
          throw new Error('鱼缸已经关闭')
        }
        this.templates.add(template)
        return { group: template, clips }
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
    if (template.clips.length) {
      const model = cloneSkeleton(template.group)
      const actorMaterials: THREE.Material[] = []
      const skeletons = new Set<THREE.Skeleton>()
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return
        const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(material => material.clone())
        actorMaterials.push(...materials)
        object.material = Array.isArray(object.material) ? materials : materials[0]!
        object.userData.sharedFishResources = true
        object.castShadow = true
        // The animated tail can leave the bind-pose bounding sphere.
        object.frustumCulled = false
        if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton)
      })
      group.add(model)
      const mixer = new THREE.AnimationMixer(model)
      const clip = template.clips[0]!
      mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play()
      let previousTime: number | undefined
      return {
        group,
        update(time, speed, phase) {
          if (previousTime === undefined) {
            // Each fish starts at its own point in the artist's cycle.
            mixer.setTime(((phase / (Math.PI * 2) % 1 + 1) % 1) * clip.duration)
          } else {
            mixer.update(Math.max(0, time - previousTime) * THREE.MathUtils.clamp(0.85 + speed * 0.15, 0.8, 1.3))
          }
          previousTime = time
        },
        dispose() {
          mixer.stopAllAction()
          mixer.uncacheRoot(model)
          for (const material of actorMaterials) material.dispose()
          for (const skeleton of skeletons) skeleton.dispose()
        },
      }
    }
    const uniforms = { uFishTime: { value: 0 }, uFishPhase: { value: 0 }, uFishSpeed: { value: 1 } }
    const actorMaterials: THREE.Material[] = []
    template.group.traverse(object => {
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
