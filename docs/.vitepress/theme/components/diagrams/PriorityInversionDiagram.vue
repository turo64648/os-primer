<script setup lang="ts">
// Priority inversion on one core, without and with priority inheritance.
// Time runs left to right in abstract units 0..12.
const x0 = 130
const u = 40 // pixels per time unit
const X = (t: number) => x0 + t * u
const rows = ['High', 'Medium', 'Low']
const rowY = (panel: number, r: number) => panel * 150 + 44 + r * 30

type Bar = { r: number; a: number; b: number; cls: string; label?: string }
const panels: { title: string; bars: Bar[]; marks: { r: number; t: number; label: string }[] }[] = [
  {
    title: 'Without priority inheritance',
    bars: [
      { r: 2, a: 0, b: 2, cls: 'box-c' },
      { r: 0, a: 2, b: 3, cls: 'box-a' },
      { r: 0, a: 3, b: 10, cls: 'ghost', label: 'waits for the lock' },
      { r: 2, a: 3, b: 4, cls: 'box-c' },
      { r: 1, a: 4, b: 9, cls: 'box-b', label: 'runs, unrelated work' },
      { r: 2, a: 9, b: 10, cls: 'box-c' },
      { r: 0, a: 10, b: 12, cls: 'box-a' },
    ],
    marks: [
      { r: 2, t: 1, label: 'lock' },
      { r: 2, t: 10, label: 'unlock' },
    ],
  },
  {
    title: 'With priority inheritance',
    bars: [
      { r: 2, a: 0, b: 2, cls: 'box-c' },
      { r: 0, a: 2, b: 3, cls: 'box-a' },
      { r: 0, a: 3, b: 5, cls: 'ghost', label: 'waits' },
      { r: 2, a: 3, b: 5, cls: 'box-d', label: 'boosted' },
      { r: 1, a: 4, b: 7, cls: 'ghost', label: 'must wait' },
      { r: 0, a: 5, b: 7, cls: 'box-a' },
      { r: 1, a: 7, b: 12, cls: 'box-b' },
    ],
    marks: [
      { r: 2, t: 1, label: 'lock' },
      { r: 2, t: 5, label: 'unlock' },
    ],
  },
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 310" role="img" aria-label="Priority inversion: a medium-priority thread delays a high-priority one that waits for a lock held by a low-priority thread; priority inheritance fixes it">
      <template v-for="(p, k) in panels" :key="k">
        <text x="20" :y="k * 150 + 26" class="tb">{{ p.title }}</text>
        <template v-for="(name, r) in rows" :key="r">
          <text x="20" :y="rowY(k, r) + 17" class="m">{{ name }}</text>
          <line :x1="X(0)" :y1="rowY(k, r) + 24" :x2="X(12)" :y2="rowY(k, r) + 24" class="ln-dash" />
        </template>
        <template v-for="(b, i) in p.bars" :key="i">
          <rect :x="X(b.a)" :y="rowY(k, b.r)" :width="(b.b - b.a) * u" height="24" rx="4" :class="b.cls" />
          <text v-if="b.label" :x="(X(b.a) + X(b.b)) / 2" :y="rowY(k, b.r) + 17" text-anchor="middle" class="m">{{ b.label }}</text>
        </template>
        <template v-for="(mk, i) in p.marks" :key="'m' + i">
          <line :x1="X(mk.t)" :y1="rowY(k, mk.r) - 4" :x2="X(mk.t)" :y2="rowY(k, mk.r) + 28" class="ln-a" />
          <text :x="X(mk.t)" :y="rowY(k, mk.r) + 42" text-anchor="middle" class="m">{{ mk.label }}</text>
        </template>
      </template>
    </svg>
    <figcaption>
      One core, three threads. The low-priority thread holds a lock the high-priority thread needs. Top: a
      medium thread runs instead, and the high thread waits for it. Bottom: the lock holder temporarily runs at
      high priority, so it finishes and releases the lock quickly.
    </figcaption>
  </figure>
</template>
