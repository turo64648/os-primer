<script setup lang="ts">
// Store buffering: each core's store waits in its store buffer while the
// next load reads memory, so both threads can read the old value 0.
const cores = [
  { x: 20, name: 'Core 1 (thread 1)', lines: ['1. x = 1', '2. r1 = y'], buf: 'store buffer: x = 1', read: 'r1 reads y = 0', readX: 278, anchor: 'start' },
  { x: 340, name: 'Core 2 (thread 2)', lines: ['1. y = 1', '2. r2 = x'], buf: 'store buffer: y = 1', read: 'r2 reads x = 0', readX: 582, anchor: 'end' },
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 290" role="img" aria-label="Each core's store waits in its own store buffer while its next load reads memory, so both threads read the old value zero">
      <defs>
        <marker id="sb-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <template v-for="c in cores" :key="c.x">
        <rect :x="c.x" y="16" width="280" height="150" rx="8" class="box-a" />
        <text :x="c.x + 16" y="40" class="tb">{{ c.name }}</text>
        <text v-for="(l, i) in c.lines" :key="i" :x="c.x + 16" :y="68 + i * 24" class="t mono">{{ l }}</text>
        <rect :x="c.x + 16" y="112" width="180" height="40" rx="6" class="box-b" />
        <text :x="c.x + 106" y="137" text-anchor="middle" class="m">{{ c.buf }}</text>

        <!-- the store drains to memory later -->
        <path :d="`M${c.x + 106} 152 L${c.x + 106} 224`" class="ln-dash" marker-end="url(#sb-ah)" />
        <text :x="c.x + 112" y="192" class="m">later</text>

        <!-- the load reads memory now -->
        <path :d="`M${c.x + 250} 224 L${c.x + 250} 168`" class="ln-a" marker-end="url(#sb-ah)" />
        <text :x="c.readX" y="212" :text-anchor="c.anchor" class="m">{{ c.read }}</text>
      </template>

      <rect x="20" y="226" width="600" height="50" rx="8" class="box-c" />
      <text x="320" y="256" text-anchor="middle" class="t">Memory and caches: x = 0, y = 0 (the stores have not arrived)</text>
    </svg>
    <figcaption>
      The store-buffering test. Each core puts its store in a private store buffer and moves on. Its next load
      reads memory, where the other core's store has not arrived yet. Both threads read 0, an outcome that is
      impossible if instructions ran one at a time in program order.
    </figcaption>
  </figure>
</template>
