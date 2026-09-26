<script setup lang="ts">
// Built from a real perf profile of hot.c in this chapter (percent of samples).
const W = 580
const X0 = 30
const px = (pct: number) => (W * pct) / 100
const rows = [
  [{ x: 0, pct: 100, label: '_start → main (100%)', cls: 'box' }],
  [
    { x: 0, pct: 57, label: 'parse (57%)', cls: 'box-a' },
    { x: 57.5, pct: 21.5, label: 'lookup (22%)', cls: 'box-a' },
    { x: 79.5, pct: 19.5, label: 'page fault', cls: 'box-d' },
  ],
  [{ x: 79.5, pct: 19.5, label: 'handle_mm_fault', cls: 'box-d' }],
  [{ x: 79.5, pct: 19, label: 'clear_page', cls: 'box-d' }],
]
const y = (level: number) => 210 - level * 44
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 290" role="img" aria-label="A flame graph: main at the bottom; parse, lookup and a kernel page-fault path above it, with widths proportional to time">
      <template v-for="(row, level) in rows" :key="level">
        <template v-for="b in row" :key="b.label">
          <rect :x="X0 + px(b.x)" :y="y(level)" :width="px(b.pct)" height="38" rx="3" :class="b.cls" />
          <text :x="X0 + px(b.x) + px(b.pct) / 2" :y="y(level) + 24" text-anchor="middle" :class="px(b.pct) < 130 ? 'm' : 't'">{{ b.label }}</text>
        </template>
      </template>
      <text x="30" y="272" class="m">width = share of samples (time on CPU)   ·   up = deeper in the call stack</text>
      <text x="30" y="40" class="m">purple: kernel code, reached through page faults</text>
    </svg>
    <figcaption>
      A simplified flame graph of the <code>hot.c</code> profile below. Look for wide boxes: those functions,
      and everything they call, use the most CPU time. Left-to-right order is alphabetical, not time.
    </figcaption>
  </figure>
</template>
