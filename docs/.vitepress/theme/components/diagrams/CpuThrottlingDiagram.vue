<script setup lang="ts">
// CFS bandwidth throttling: a container limited to 2 CPUs (200 ms of CPU time
// per 100 ms period) runs 8 busy threads, uses its whole quota in 25 ms, and is
// frozen for the remaining 75 ms. The next period is quiet.
const x0 = 50
const px = 2.8 // pixels per millisecond
const X = (ms: number) => x0 + ms * px
const ticks = [0, 25, 100, 120, 200]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 290" role="img" aria-label="A container with a 2-CPU limit uses its whole quota in 25 milliseconds and is throttled for 75 milliseconds; a request that arrives meanwhile waits">
      <defs>
        <marker id="th-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <text x="20" y="22" class="tb">Limit: 200 ms of CPU time per 100 ms period (2 CPUs)</text>

      <!-- period labels -->
      <text :x="X(50)" y="50" text-anchor="middle" class="m">period 1: a burst of work</text>
      <text :x="X(150)" y="50" text-anchor="middle" class="m">period 2: quiet</text>
      <line :x1="X(100)" y1="38" :x2="X(100)" y2="170" class="ln-dash" />

      <!-- the container's CPU use -->
      <text x="20" y="70" class="m">CPU</text>
      <rect :x="X(0)" y="60" :width="25 * px" height="56" rx="4" class="box-a" />
      <text :x="X(12.5)" y="84" text-anchor="middle" class="t">8</text>
      <text :x="X(12.5)" y="104" text-anchor="middle" class="m">threads</text>
      <rect :x="X(25)" y="60" :width="75 * px" height="56" rx="4" class="box-b" />
      <text :x="X(62.5)" y="84" text-anchor="middle" class="tb">throttled</text>
      <text :x="X(62.5)" y="104" text-anchor="middle" class="m">quota spent: nothing may run</text>
      <rect :x="X(100)" y="60" :width="20 * px" height="56" rx="4" class="box-a" />
      <text :x="X(110)" y="92" text-anchor="middle" class="m">1</text>
      <text :x="X(160)" y="92" text-anchor="middle" class="m">idle, quota left over</text>

      <!-- time axis -->
      <line :x1="X(0)" y1="126" :x2="X(200)" y2="126" class="ln" />
      <template v-for="t in ticks" :key="t">
        <line :x1="X(t)" y1="122" :x2="X(t)" y2="130" class="ln" />
        <text :x="X(t)" y="146" text-anchor="middle" class="m">{{ t }} ms</text>
      </template>

      <!-- a request that arrives during throttling -->
      <text x="20" y="196" class="m">req</text>
      <circle :cx="X(30)" cy="192" r="5" class="box-d" />
      <path :d="`M${X(30) + 6} 192 L${X(100) - 2} 192`" class="ln-b" marker-end="url(#th-ah)" />
      <text :x="X(65)" y="182" text-anchor="middle" class="m">request waits about 70 ms</text>
      <rect :x="X(100)" y="184" :width="3 * px" height="16" rx="2" class="box-c" />
      <text :x="X(106)" y="197" class="m">3 ms of real work</text>

      <text x="20" y="240" class="t">Average over both periods: 1.1 CPUs, only 55% of the limit.</text>
      <text x="20" y="264" class="t">Yet one request waited 70 ms for 3 ms of work.</text>
    </svg>
    <figcaption>
      CPU limits in containers are a budget per period, shared by all threads. Eight threads spend a 2-CPU budget
      in a quarter of the period, then everything stops until the next period starts.
    </figcaption>
  </figure>
</template>
