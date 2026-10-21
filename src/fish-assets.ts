import type { FishModelDefinition } from './fish-model'

export const whitecloudFishModel: FishModelDefinition = {
  path: `${import.meta.env?.BASE_URL ?? "/"}models/fish/whitecloud-swim.glb`,
  rotationY: -Math.PI / 2,
  length: 1.22,
}
export const whitecloudFishThumbnail = `${import.meta.env?.BASE_URL ?? "/"}models/fish/uploaded-fish.webp`

export const cardinalFishModel: FishModelDefinition = {
  path: `${import.meta.env?.BASE_URL ?? "/"}models/fish/cardinal-tetra.glb`,
  rotationY: -Math.PI / 2,
  length: 1.22,
}
export const cardinalFishThumbnail = `${import.meta.env?.BASE_URL ?? "/"}models/fish/cardinal-tetra.webp`

/** Species identity is part of the asset catalog, never a per-tank preference. */
export function fishModelForSpecies(id: string): FishModelDefinition | undefined {
  if (id === 'whitecloud') return whitecloudFishModel
  if (id === 'cardinal') return cardinalFishModel
  return undefined
}

export function fishThumbnailForSpecies(id: string): string | undefined {
  if (id === 'whitecloud') return whitecloudFishThumbnail
  if (id === 'cardinal') return cardinalFishThumbnail
  return undefined
}
