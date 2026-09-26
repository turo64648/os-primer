<script setup lang="ts">
// Per-core run queues. Core 1 is idle, so the load balancer moves a waiting
// thread from core 0 (which shares a cache with core 1).
const cols = [20, 170, 330, 480] // x of each core column, 140 wide
const cores = [
  { name: 'Core 0', running: 'T1', waiting: ['T2', 'T3', 'T4'] },
  { name: 'Core 1', running: '', waiting: [] as string[] },
  { name: 'Core 2', running: 'T5', waiting: ['T6'] },
  { name: 'Core 3', running: 'T7', waiting: [] as string[] },
]
const qy = (i: number) => 156 + i * 34
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 330" role="img" aria-label="Each CPU core has its own queue of waiting threads; the load balancer moves a thread from a busy core to an idle one">
      <defs>
        <marker id="rq-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <!-- cache groups -->
      <rect x="10" y="8" width="310" height="262" rx="10" class="ghost" />
      <rect x="320" y="8" width="310" height="262" rx="10" class="ghost" />
      <text x="165" y="28" text-anchor="middle" class="m">these two cores share a cache</text>
      <text x="475" y="28" text-anchor="middle" class="m">these two cores share a cache</text>

      <template v-for="(c, k) in cores" :key="k">
        <rect :x="cols[k]" y="40" width="140" height="34" rx="6" class="box-a" />
        <text :x="cols[k] + 70" y="62" text-anchor="middle" class="tb">{{ c.name }}</text>

        <rect :x="cols[k]" y="86" width="140" height="34" rx="6" :class="c.running ? 'box-c' : 'ghost'" />
        <text :x="cols[k] + 70" y="108" text-anchor="middle" :class="c.running ? 't' : 'm'">
          {{ c.running ? c.running + ' running' : 'idle' }}
        </text>

        <text :x="cols[k]" y="144" class="m">run queue:</text>
        <template v-for="(w, i) in c.waiting" :key="w">
          <rect :x="cols[k] + 10" :y="qy(i)" width="120" height="28" rx="5" :class="w === 'T4' ? 'box-b' : 'box'" />
          <text :x="cols[k] + 70" :y="qy(i) + 19" text-anchor="middle" class="t">{{ w }} waiting</text>
        </template>
        <text v-if="!c.waiting.length" :x="cols[k] + 70" :y="qy(0) + 19" text-anchor="middle" class="m">(empty)</text>
      </template>

      <!-- balancer moves T4 from core 0 to idle core 1 -->
      <path d="M150 238 C 170 238, 185 180, 222 124" class="ln-b" marker-end="url(#rq-ah)" />
      <text x="20" y="300" class="m">The load balancer moves T4 to the idle core next door first,</text>
      <text x="20" y="316" class="m">because that core shares a cache. Moving further away costs more.</text>
    </svg>
    <figcaption>
      Each core has its own run queue of threads that are ready but waiting. Cores only pick from their own queue,
      so the kernel moves threads between queues to keep every core busy.
    </figcaption>
  </figure>
</template>
