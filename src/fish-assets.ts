import type { FishModelDefinition } from './fish-model'

export const uploadedFishModel: FishModelDefinition = {
  path: `${import.meta.env.BASE_URL}models/fish/uploaded-fish.glb`,
  rotationY: -Math.PI / 2,
  length: 1.22,
}
export const uploadedFishThumbnail = `${import.meta.env.BASE_URL}models/fish/uploaded-fish.webp`
