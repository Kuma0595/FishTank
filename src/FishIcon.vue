<script setup lang="ts">
import { computed } from 'vue'
import type { Species } from './catalog'
import { fishThumbnailForSpecies } from './fish-assets'
const props = defineProps<{fish:Species}>()
const thumbnail = computed(() => fishThumbnailForSpecies(props.fish.id))
</script>
<template>
<img v-if="thumbnail" :src="thumbnail" class="fish-illustration model-thumbnail" alt=""/><svg v-else viewBox="0 0 150 86" aria-hidden="true" class="fish-illustration">
 <ellipse cx="72" cy="75" rx="38" ry="3" fill="currentColor" opacity=".045"/>
 <g :transform="fish.shape==='bottom'?'translate(0 8)':''">
 <path :d="fish.shape==='fan'?'M92 42 Q116 17 137 21 Q130 42 138 63 Q116 67 92 45Z':fish.shape==='round'?'M94 42 Q117 23 134 25 L125 43 L135 62 Q115 64 94 47Z':'M94 43 L124 25 L119 43 L125 61Z'" :fill="fish.accent" opacity=".85"/>
 <path d="M57 30 Q66 13 84 22 L94 35Z" :fill="fish.accent" opacity=".8"/>
 <path d="M62 53 Q75 71 86 58 L93 48Z" :fill="fish.accent" opacity=".75"/>
 <ellipse cx="69" cy="43" :rx="fish.shape==='round'?30:34" :ry="fish.shape==='round'?23:fish.shape==='tall'?21:15" :fill="fish.color"/>
 <ellipse cx="63" cy="39" rx="20" ry="8" fill="#ffffff" opacity=".12"/>
 <template v-if="fish.pattern==='neon'"><path d="M39 40 Q65 36 98 41" :stroke="fish.id==='neon'?'#70e4e4':'#f7e9bb'" stroke-width="4" fill="none"/><path v-if="fish.id==='neon'" d="M67 49 L97 47" :stroke="fish.accent" stroke-width="7"/></template>
 <template v-if="fish.pattern==='stripe'"><path v-for="y in [36,43,50]" :key="y" :d="`M39 ${y} Q69 ${y-3} 100 ${y}`" :stroke="fish.accent" stroke-width="2.5" fill="none"/></template>
 <template v-if="fish.pattern==='panda'"><path d="M47 31 Q41 43 48 55 L58 56 Q51 40 58 29Z" :fill="fish.accent"/><path d="M89 31 L99 36 L99 50 L89 55Z" :fill="fish.accent"/></template>
 <template v-if="fish.pattern==='spots'"><circle v-for="(p,i) in [[116,35],[122,47],[113,52],[127,30],[130,56]]" :key="i" :cx="p[0]" :cy="p[1]" r="2.8" fill="#765a46" opacity=".7"/></template>
 <path d="M53 39 Q59 44 54 50" stroke="#ffffff" stroke-width="1.4" fill="none" opacity=".3"/>
 <circle cx="45" cy="40" r="4" fill="#f9efd6"/><circle cx="44" cy="40" r="2.4" fill="#283e37"/><circle cx="43.3" cy="39" r=".8" fill="white"/>
 <path d="M35 46 L39 46" stroke="#715b42" stroke-width="1" stroke-linecap="round"/>
 </g>
</svg>
</template>
