<script setup lang="ts">
const cores = [0, 1, 2, 3]
const cx = (i: number) => 20 + i * 152
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 400" role="img" aria-label="Cache hierarchy: each core has private L1 and L2 caches, all cores share an L3 cache, and DRAM sits behind the memory controller">
      <template v-for="i in cores" :key="i">
        <rect :x="cx(i)" y="20" width="144" height="40" rx="8" class="box-a" />
        <text :x="cx(i) + 72" y="45" text-anchor="middle" class="tb">Core {{ i }}</text>
        <rect :x="cx(i)" y="72" width="144" height="40" rx="6" class="box" />
        <text :x="cx(i) + 72" y="97" text-anchor="middle" class="t">L1 · ~1 ns</text>
        <rect :x="cx(i)" y="124" width="144" height="40" rx="6" class="box" />
        <text :x="cx(i) + 72" y="149" text-anchor="middle" class="t">L2 · ~4 ns</text>
        <path :d="`M${cx(i) + 72} 164 L${cx(i) + 72} 190`" class="ln" />
      </template>

      <rect x="20" y="190" width="600" height="50" rx="8" class="box-c" />
      <text x="320" y="214" text-anchor="middle" class="tb">L3 · shared by all cores · ~10–40 ns</text>
      <text x="320" y="232" text-anchor="middle" class="m">several MiB to hundreds of MiB</text>

      <path d="M320 240 L320 268" class="ln" />
      <rect x="170" y="268" width="300" height="40" rx="8" class="box" />
      <text x="320" y="293" text-anchor="middle" class="t">Memory controller</text>
      <path d="M320 308 L320 332" class="ln" />
      <rect x="20" y="332" width="600" height="50" rx="8" class="box-d" />
      <text x="320" y="356" text-anchor="middle" class="tb">DRAM (main memory) · ~80–120 ns</text>
      <text x="320" y="374" text-anchor="middle" class="m">tens of GiB to terabytes</text>
    </svg>
    <figcaption>
      A typical multi-core CPU. L1 and L2 belong to one core; L3 is shared. Each level is bigger and slower than the one above. Latencies are rough and
      vary by CPU; the ratios between levels matter more than the exact numbers.
    </figcaption>
  </figure>
</template>
