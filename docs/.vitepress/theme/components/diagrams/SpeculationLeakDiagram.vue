<script setup lang="ts">
// How a speculative-execution attack leaks one secret byte through the cache.
const steps = [
  { who: 'CPU', title: '1. Runs ahead before a check finishes', note: 'a permission check or a bounds check is still pending', cls: 'box-b' },
  { who: 'CPU', title: '2. Reads the secret byte', note: 'for example the value 83', cls: 'box-b' },
  { who: 'CPU', title: '3. Loads array[secret × 4096]', note: 'this brings entry 83 of a probe array into the cache', cls: 'box-b' },
  { who: 'CPU', title: '4. The check fails: results thrown away', note: 'registers are rolled back, but the cache is not', cls: 'box-d' },
  { who: 'Attacker', title: '5. Times a read of each of the 256 entries', note: 'entry 83 is fast (cached); the rest are slow', cls: 'box-a' },
]
const row = (i: number) => 20 + i * 70
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 370" role="img" aria-label="Five steps of a speculative execution attack: the CPU runs ahead, reads a secret, uses it to load a cache line, throws the results away but leaves the cache changed, and the attacker times reads to find which line was loaded">
      <defs>
        <marker id="sl-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>
      <template v-for="(s, i) in steps" :key="s.title">
        <rect x="20" :y="row(i)" width="100" height="52" rx="8" :class="s.cls" />
        <text x="70" :y="row(i) + 31" text-anchor="middle" class="tb">{{ s.who }}</text>
        <rect x="136" :y="row(i)" width="484" height="52" rx="8" :class="s.cls" />
        <text x="150" :y="row(i) + 22" class="tb">{{ s.title }}</text>
        <text x="150" :y="row(i) + 42" class="m">{{ s.note }}</text>
        <path v-if="i < steps.length - 1" :d="`M378 ${row(i) + 52} L378 ${row(i + 1)}`" class="ln" marker-end="url(#sl-ah)" />
      </template>
    </svg>
    <figcaption>
      The core of Meltdown and Spectre. Steps 1–3 happen speculatively and are officially undone in step 4.
      The cache still remembers which entry was loaded, and timing reveals it. Repeat for every byte.
    </figcaption>
  </figure>
</template>
