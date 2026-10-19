import type { FishModelDefinition } from './fish-model'

export const whitecloudFishModel: FishModelDefinition = {
  path: `${import.meta.env?.BASE_URL ?? "/"}models/fish/uploaded-fish.glb`,
  rotationY: -Math.PI / 2,
  length: 1.22,
}
export const whitecloudFishThumbnail = `${import.meta.env?.BASE_URL ?? "/"}models/fish/uploaded-fish.webp`

/** Species identity is part of the asset catalog, never a per-tank preference. */
export function fishModelForSpecies(id: string): FishModelDefinition | undefined {
  return id === 'whitecloud' ? whitecloudFishModel : undefined
}
