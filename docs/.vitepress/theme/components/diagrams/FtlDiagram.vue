<script setup lang="ts">
// Flash translation layer: logical blocks map to flash pages; overwrites go to fresh pages.
const lbas = ['block 0', 'block 1', 'block 2', 'block 3']
const ly = (i: number) => 64 + i * 42
const eraseA = [
  { t: 'block 0', c: 'box-c' },
  { t: 'block 1', c: 'box-c' },
  { t: 'block 2 (stale)', c: 'ghost' },
  { t: 'block 3', c: 'box-c' },
]
const eraseB = [
  { t: 'block 2 (new)', c: 'box-c' },
  { t: 'free', c: 'box' },
  { t: 'free', c: 'box' },
  { t: 'free', c: 'box' },
]
const py = (i: number) => 64 + i * 42
// blocks 0, 1 and 3 point to the same row in erase block A
const direct = [0, 1, 3]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 370" role="img" aria-label="The SSD maps each logical block to a flash page. Overwriting block 2 writes a new page in another erase block and marks the old page stale.">
      <defs>
        <marker id="ftl-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <text x="80" y="24" text-anchor="middle" class="tb">What the OS sees</text>
      <text x="80" y="42" text-anchor="middle" class="m">numbered blocks</text>
      <template v-for="(l, i) in lbas" :key="l">
        <rect x="20" :y="ly(i)" width="120" height="32" rx="4" class="box-a" />
        <text x="80" :y="ly(i) + 21" text-anchor="middle" class="t">{{ l }}</text>
      </template>

      <text x="455" y="24" text-anchor="middle" class="tb">Inside the SSD: flash pages</text>
      <rect x="280" y="54" width="160" height="178" rx="8" class="box-d" />
      <text x="360" y="252" text-anchor="middle" class="m">erase block A</text>
      <rect x="460" y="54" width="160" height="178" rx="8" class="box-d" />
      <text x="540" y="252" text-anchor="middle" class="m">erase block B</text>
      <template v-for="(p, i) in eraseA" :key="'a' + i">
        <rect x="290" :y="py(i)" width="140" height="32" rx="4" :class="p.c" />
        <text x="360" :y="py(i) + 21" text-anchor="middle" class="m">{{ p.t }}</text>
      </template>
      <template v-for="(p, i) in eraseB" :key="'b' + i">
        <rect x="470" :y="py(i)" width="140" height="32" rx="4" :class="p.c" />
        <text x="540" :y="py(i) + 21" text-anchor="middle" class="m">{{ p.t }}</text>
      </template>

      <template v-for="i in direct" :key="'m' + i">
        <path :d="`M140 ${ly(i) + 16} L288 ${py(i) + 16}`" class="ln" marker-end="url(#ftl-ah)" />
      </template>
      <!-- block 2: old mapping (dashed) and new mapping over the top to erase block B -->
      <path :d="`M140 ${ly(2) + 16} L288 ${py(2) + 16}`" class="ln-dash" />
      <path :d="`M140 ${ly(2) + 16} C 230 ${ly(2) + 16}, 200 44, 300 44 L 500 44 C 530 44, 540 48, 540 62`" class="ln-b" marker-end="url(#ftl-ah)" />

      <text x="20" y="290" class="t">Overwriting block 2 cannot change its page in place. The SSD</text>
      <text x="20" y="312" class="t">writes a fresh page, updates the map, and marks the old one stale.</text>
      <text x="20" y="334" class="t">Later, garbage collection copies the live pages out of block A</text>
      <text x="20" y="356" class="t">and erases all of it at once.</text>
    </svg>
    <figcaption>
      The flash translation layer. The OS sees fixed, numbered blocks. The SSD keeps a map from each block to
      wherever its current copy lives in flash, because flash can only be written after a whole erase block is
      cleared.
    </figcaption>
  </figure>
</template>
