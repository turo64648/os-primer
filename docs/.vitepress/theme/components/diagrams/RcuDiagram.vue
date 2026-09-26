<script setup lang="ts">
// RCU on a timeline: readers never wait; the writer publishes a new version,
// waits for a grace period (until every reader that might see the old
// version has finished), then frees the old version.
const x0 = 110
const u = 40
const X = (t: number) => x0 + t * u
const rowY = (r: number) => 44 + r * 36
const rows = ['Reader 1', 'Reader 2', 'Reader 3', 'Writer']
const bars = [
  { r: 0, a: 0, b: 5, cls: 'box-a', label: 'uses old version' },
  { r: 1, a: 1, b: 2.5, cls: 'box-a', label: 'old' },
  { r: 2, a: 4, b: 9, cls: 'box-c', label: 'uses new version' },
  { r: 3, a: 0, b: 3, cls: 'box-d', label: 'copy + change' },
  { r: 3, a: 3, b: 6, cls: 'ghost', label: 'grace period' },
  { r: 3, a: 6, b: 8, cls: 'box-b', label: 'free old' },
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 230" role="img" aria-label="RCU timeline: readers run without locks; the writer publishes a new version, waits a grace period for old readers to finish, then frees the old version">
      <template v-for="(name, r) in rows" :key="r">
        <text x="20" :y="rowY(r) + 18" class="m">{{ name }}</text>
        <line :x1="X(0)" :y1="rowY(r) + 26" :x2="X(12)" :y2="rowY(r) + 26" class="ln-dash" />
      </template>
      <template v-for="(b, i) in bars" :key="i">
        <rect :x="X(b.a)" :y="rowY(b.r)" :width="(b.b - b.a) * u" height="26" rx="4" :class="b.cls" />
        <text :x="(X(b.a) + X(b.b)) / 2" :y="rowY(b.r) + 18" text-anchor="middle" class="m">{{ b.label }}</text>
      </template>

      <!-- publish -->
      <line :x1="X(3)" y1="30" :x2="X(3)" :y2="rowY(3) + 30" class="ln-a" />
      <text :x="X(3)" y="22" text-anchor="middle" class="m">publish: swap the pointer</text>
      <!-- end of grace period -->
      <line :x1="X(6)" :y1="rowY(0) - 4" :x2="X(6)" :y2="rowY(3) + 30" class="ln-dash" />

      <rect x="110" y="200" width="16" height="12" rx="2" class="box-a" />
      <text x="132" y="211" class="m">sees the old version</text>
      <rect x="300" y="200" width="16" height="12" rx="2" class="box-c" />
      <text x="322" y="211" class="m">sees the new version</text>
    </svg>
    <figcaption>
      Read-copy-update. Readers take no lock. The writer builds a new copy and publishes it by swapping one
      pointer. Readers that started earlier may still use the old copy, so the writer waits until all of them
      have finished before freeing it.
    </figcaption>
  </figure>
</template>
