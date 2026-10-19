import * as THREE from 'three'

export interface GuppyVisual {
  group: THREE.Group
  update: (time: number, speed: number, phase: number) => void
}

const palettes = [
  { base: '#e96e28', edge: '#68251e', light: '#ffce73', body: '#d57728', blue: '#299fa9' },
  { base: '#73b3d2', edge: '#183955', light: '#d8eff3', body: '#479dac', blue: '#237eaa' },
  { base: '#e6cf59', edge: '#343c28', light: '#fff5a0', body: '#bcaf52', blue: '#279d9c' },
]

/** Stable coloration: restoring a save or changing model mappings retains each fish's morph. */
export function guppyMorph(identity: string): number {
  let hash = 0
  for (const char of identity) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0
  return (hash >>> 0) % palettes.length
}

function texture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void, color = true) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  paint(canvas.getContext('2d')!)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  map.anisotropy = 4
  return map
}

function skinMaps(morph: number) {
  const palette = palettes[morph]!
  const map = texture(768, 384, ctx => {
    // UVs run from tail to nose and around the elliptical cross-section.
    for (let y = 0; y < 384; y++) {
      const elevation = Math.sin((1 - y / 384) * Math.PI * 2)
      const color = new THREE.Color(elevation > 0 ? '#6b8e86' : '#e5e2c9')
      color.lerp(new THREE.Color('#b3d5d4'), 1 - Math.abs(elevation))
      ctx.fillStyle = color.getStyle()
      ctx.fillRect(0, y, 768, 1)
    }
    for (const cy of [0, 192, 384]) {
      for (const [cx, radius, color] of [[190, 175, palette.blue], [340, 100, palette.body], [490, 98, '#8cbbba']] as const) {
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        gradient.addColorStop(0, color)
        gradient.addColorStop(0.55, `${color}b0`)
        gradient.addColorStop(1, `${color}00`)
        ctx.fillStyle = gradient
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
      }
    }
    // Broken pigment at the caudal peduncle, with finer overlapping scale rims.
    for (let i = 0; i < 42; i++) {
      const x = 40 + ((i * 59) % 285), y = (i * 83) % 384
      ctx.fillStyle = 'rgba(14,55,62,.36)'
      ctx.beginPath(); ctx.ellipse(x, y, 3 + i % 5, 2 + i % 3, i, 0, Math.PI * 2); ctx.fill()
    }
    for (let row = 0; row < 26; row++) for (let col = 0; col < 47; col++) {
      const x = col * 17 + (row % 2) * 8.5, y = row * 15
      ctx.strokeStyle = 'rgba(29,65,66,.20)'; ctx.lineWidth = 0.85
      ctx.beginPath(); ctx.ellipse(x, y, 8, 7, 0, -1.2, 1.2); ctx.stroke()
      ctx.strokeStyle = 'rgba(242,255,241,.30)'; ctx.lineWidth = 0.7
      ctx.beginPath(); ctx.ellipse(x + 1, y - 1, 7, 6, 0, -1.15, 0.4); ctx.stroke()
    }
  })
  const bump = texture(512, 256, ctx => {
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 512, 256)
    for (let row = 0; row < 26; row++) for (let col = 0; col < 47; col++) {
      ctx.strokeStyle = '#a4a4a4'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.ellipse(col * 11.3 + row % 2 * 5.6, row * 10, 5, 4.5, 0, -1.3, 1.3); ctx.stroke()
    }
  }, false)
  return { map, bump }
}

/** A closed, tapered body: full shoulder, soft belly, narrow peduncle, upturned mouth. */
export function guppyBodyGeometry() {
  const profile = [
    [-0.43, 0.026, 0.006, 0.006], [-0.34, 0.045, 0.035, 0.006],
    [-0.22, 0.080, 0.054, 0.009], [-0.07, 0.126, 0.083, 0.004],
    [0.09, 0.142, 0.096, 0], [0.23, 0.119, 0.084, 0.014],
    [0.34, 0.081, 0.063, 0.035], [0.425, 0.038, 0.036, 0.044],
    [0.45, 0, 0, 0.052],
  ]
  const curve = new THREE.CatmullRomCurve3(profile.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.35)
  const positions: number[] = [], uvs: number[] = [], indices: number[] = []
  const rings = 64, sides = 40
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, p = curve.getPoint(t)
    const centerY = THREE.MathUtils.lerp(0.006, 0.052, THREE.MathUtils.smoothstep(p.x, 0.1, 0.45))
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2
      positions.push(p.x, centerY + Math.sin(a) * Math.max(0, p.y), Math.cos(a) * Math.max(0, p.z))
      uvs.push((p.x + 0.43) / 0.88, j / sides)
      if (i < rings && j < sides) {
        const k = i * (sides + 1) + j
        indices.push(k, k + sides + 1, k + 1, k + 1, k + sides + 1, k + sides + 2)
      }
    }
  }
  // Close the small peduncle end; the opposite end converges to the mouth.
  const cap = positions.length / 3
  positions.push(-0.43, 0.006, 0); uvs.push(0, 0.5)
  for (let j = 0; j < sides; j++) indices.push(cap, j, j + 1)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere()
  return geometry
}

/** Radial membrane with a gently scalloped free edge and real folds in depth. */
export function guppyTailGeometry() {
  return membrane((u, v) => {
    const angle = (v - 0.5) * 1.55
    const scallop = 1 + Math.sin(v * Math.PI * 36) * 0.0035
    const radius = u * (0.60 + 0.035 * Math.cos(angle * 2)) * scallop
    return new THREE.Vector3(-0.43 - Math.cos(angle) * radius, 0.006 + Math.sin(angle) * (radius + 0.036 * (1 - u)),
      Math.sin(v * Math.PI * 36) * 0.004 * u * u + Math.sin(v * 7) * 0.018 * u)
  }, 24, 72)
}

function membrane(point: (u: number, v: number) => THREE.Vector3, radial = 16, across = 32) {
  const positions: number[] = [], uvs: number[] = [], weights: number[] = [], indices: number[] = []
  for (let i = 0; i <= radial; i++) for (let j = 0; j <= across; j++) {
    const u = i / radial, v = j / across, p = point(u, v)
    positions.push(p.x, p.y, p.z); uvs.push(u, v); weights.push(u)
    if (i < radial && j < across) {
      const k = i * (across + 1) + j
      indices.push(k, k + 1, k + across + 1, k + 1, k + across + 2, k + across + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('finWeight', new THREE.Float32BufferAttribute(weights, 1))
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere()
  // Fin flutter can extend beyond the static bounds.
  if (geometry.boundingSphere) geometry.boundingSphere.radius += 0.15
  return geometry
}

function finMap(morph: number) {
  const palette = palettes[morph]!
  return texture(512, 512, ctx => {
    const gradient = ctx.createLinearGradient(0, 0, 512, 0)
    gradient.addColorStop(0, '#80a9a580'); gradient.addColorStop(0.18, `${palette.light}c0`)
    gradient.addColorStop(0.45, palette.base); gradient.addColorStop(0.87, palette.base)
    gradient.addColorStop(0.96, palette.edge); gradient.addColorStop(1, `${palette.light}c0`)
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 512, 512)
    // Seeded pigment avoids repeating diagonal rows while remaining stable across saves.
    let seed = 71 + morph * 953
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
    for (let i = 0; i < 300; i++) {
      const u = 0.12 + random() * 0.85, v = random()
      const size = (morph === 0 ? 2.1 : 3.4) + u * 4
      ctx.fillStyle = morph === 0 ? 'rgba(90,28,16,.48)' : 'rgba(12,35,42,.83)'
      ctx.beginPath(); ctx.ellipse(u * 512, v * 512, size * 0.8, size * (0.6 + random() * 1.2), random() * Math.PI, 0, Math.PI * 2); ctx.fill()
    }
    for (let ray = 0; ray <= 36; ray++) {
      const y = ray / 36 * 512
      ctx.strokeStyle = 'rgba(255,242,200,.42)'; ctx.lineWidth = 1.25
      ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(160, y - 2, 350, y + 3, 512, y); ctx.stroke()
      ctx.strokeStyle = 'rgba(54,42,30,.22)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, y + 2); ctx.lineTo(512, y + 2); ctx.stroke()
    }
  })
}

const swimShader = `
uniform float uGuppyTime;
uniform float uGuppySpeed;
uniform float uGuppyPhase;
float guppyBend(float x) {
  float weight = 1.0 - smoothstep(-0.9, 0.24, x);
  return sin(uGuppyTime * (4.4 + uGuppySpeed * 3.0) + x * 5.5 + uGuppyPhase)
    * weight * weight * (0.055 + uGuppySpeed * 0.035);
}
`

export function createGuppy(size: number, identity: string): GuppyVisual {
  const group = new THREE.Group(), morph = guppyMorph(identity)
  group.name = '孔雀鱼 · 曲面彩尾'
  group.scale.setScalar(size)
  const uniforms = { uGuppyTime: { value: 0 }, uGuppySpeed: { value: 0.5 }, uGuppyPhase: { value: 0 } }
  function swimmingMaterial(material: THREE.MeshPhysicalMaterial, fin = false) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = swimShader + (fin ? 'attribute float finWeight;\n' : '') + shader.vertexShader
      const flutter = fin ? '\ntransformed.z += sin(uGuppyTime * 7.0 + uv.y * 16.0 + uv.x * 5.0 + uGuppyPhase) * finWeight * finWeight * 0.018;' : ''
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z += guppyBend(position.x);' + flutter)
      shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nfloat slope = (guppyBend(position.x + 0.002) - guppyBend(position.x - 0.002)) / 0.004;\nobjectNormal.x -= slope * objectNormal.z;')
    }
    material.customProgramCacheKey = () => `guppy-membrane-v1-${fin}`
    return material
  }
  const skin = skinMaps(morph)
  const bodyMaterial = swimmingMaterial(new THREE.MeshPhysicalMaterial({
    map: skin.map, bumpMap: skin.bump, bumpScale: 0.0035, roughness: 0.32, metalness: 0.24,
    clearcoat: 0.8, clearcoatRoughness: 0.23, iridescence: 0.32, iridescenceIOR: 1.35,
    iridescenceThicknessRange: [180, 360],
  }))
  const body = new THREE.Mesh(guppyBodyGeometry(), bodyMaterial)
  group.add(body)
  const finMaterial = swimmingMaterial(new THREE.MeshPhysicalMaterial({
    map: finMap(morph), transparent: true, opacity: 0.88, side: THREE.DoubleSide,
    depthWrite: false, roughness: 0.4, metalness: 0.08, clearcoat: 0.45, iridescence: 0.25,
  }), true)
  group.add(new THREE.Mesh(guppyTailGeometry(), finMaterial))
  const dorsal = membrane((u, v) => new THREE.Vector3(
    0.08 - v * 0.33 - u * u * 0.16, 0.10 + Math.sin(v * Math.PI) * 0.025 + u * Math.sin(v * Math.PI) ** 0.65 * 0.24,
    Math.sin(v * 35) * u * 0.007), 14, 36)
  group.add(new THREE.Mesh(dorsal, finMaterial))
  const anal = membrane((u, v) => new THREE.Vector3(-0.04 - v * 0.21 - u * 0.08,
    -0.10 - Math.sin(v * Math.PI) * u * 0.12, Math.sin(v * 24) * u * 0.006), 10, 24)
  group.add(new THREE.Mesh(anal, finMaterial))

  const eyeOuter = new THREE.MeshPhysicalMaterial({ color: '#a79b62', roughness: 0.3, metalness: 0.45 })
  const eyeBlack = new THREE.MeshPhysicalMaterial({ color: '#07191b', roughness: 0.08, clearcoat: 1 })
  const highlight = new THREE.MeshBasicMaterial({ color: '#f1ffef' })
  const detailMaterial = new THREE.MeshStandardMaterial({ color: '#4b6863', roughness: 0.45, transparent: true, opacity: 0.62 })
  const detailGeometry = new THREE.SphereGeometry(1, 20, 14)
  function ellipsoid(position: number[], scale: number[], material: THREE.Material) {
    const mesh = new THREE.Mesh(detailGeometry, material)
    mesh.position.set(position[0]!, position[1]!, position[2]!)
    mesh.scale.set(scale[0]!, scale[1]!, scale[2]!); group.add(mesh)
    return mesh
  }
  const pectorals: THREE.Group[] = []
  const pectoralMap = texture(128, 128, ctx => {
    ctx.fillStyle = '#c3d9c040'; ctx.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = 'rgba(225,239,206,.42)'; ctx.lineWidth = 0.8
      ctx.beginPath(); ctx.moveTo(0, i * 12); ctx.lineTo(128, i * 12); ctx.stroke()
    }
  })
  for (const sign of [-1, 1]) {
    ellipsoid([0.321, 0.066, sign * 0.059], [0.037, 0.039, 0.017], eyeOuter)
    ellipsoid([0.326, 0.067, sign * 0.072], [0.026, 0.029, 0.011], eyeBlack)
    ellipsoid([0.336, 0.079, sign * 0.080], [0.008, 0.008, 0.004], highlight)
    // An inset curved operculum line follows the cheek instead of a painted stripe.
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 20; i++) {
      const a = -1.1 + i / 20 * 2.3
      points.push(new THREE.Vector3(0.205 - Math.cos(a) * 0.025, 0.018 + Math.sin(a) * 0.083, sign * (0.094 * Math.sqrt(1 - (Math.sin(a) * 0.68) ** 2) + 0.001)))
    }
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, 0.0018, 5, false), detailMaterial))
    const pivot = new THREE.Group()
    pivot.position.set(0.13, -0.025, sign * 0.079)
    const pectoralMaterial = swimmingMaterial(new THREE.MeshPhysicalMaterial({
      map: pectoralMap, color: '#b8cfc5', transparent: true, opacity: 0.42, roughness: 0.38, side: THREE.DoubleSide, depthWrite: false,
    }), true)
    const geometry = membrane((u, v) => new THREE.Vector3(-u * (0.06 + v * 0.10),
      -u * Math.sin(v * Math.PI) * 0.075, sign * u * (0.055 + Math.sin(v * Math.PI) * 0.075)), 8, 16)
    pivot.add(new THREE.Mesh(geometry, pectoralMaterial)); group.add(pivot); pectorals.push(pivot)
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0025, 6, 18), detailMaterial)
  mouth.rotation.y = Math.PI / 2; mouth.position.set(0.447, 0.05, 0); group.add(mouth)
  return {
    group,
    update(time, speed, phase) {
      uniforms.uGuppyTime.value = time; uniforms.uGuppySpeed.value = speed; uniforms.uGuppyPhase.value = phase
      for (let i = 0; i < pectorals.length; i++) {
        const sign = i === 0 ? -1 : 1
        pectorals[i]!.rotation.x = sign * (0.18 + Math.sin(time * (10 + speed * 5) + phase + i * 0.7) * 0.38)
        pectorals[i]!.rotation.y = sign * Math.sin(time * 8 + phase) * 0.15
      }
    },
  }
}
