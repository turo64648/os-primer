<script setup lang="ts">
const slots = Array.from({ length: 8 }, (_, i) => i)
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 300" role="img" aria-label="False sharing: two cores write different counters that sit in the same 64-byte cache line, so the line moves back and forth between their caches">
      <defs>
        <marker id="fs-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <rect x="20" y="20" width="180" height="50" rx="8" class="box-a" />
      <text x="110" y="42" text-anchor="middle" class="tb">Core 0</text>
      <text x="110" y="60" text-anchor="middle" class="m">writes counter a</text>
      <rect x="440" y="20" width="180" height="50" rx="8" class="box-b" />
      <text x="530" y="42" text-anchor="middle" class="tb">Core 1</text>
      <text x="530" y="60" text-anchor="middle" class="m">writes counter b</text>

      <text x="320" y="118" text-anchor="middle" class="m">one 64-byte cache line = 8 slots of 8 bytes</text>
      <template v-for="i in slots" :key="i">
        <rect :x="160 + i * 40" y="130" width="40" height="44" :class="i === 0 ? 'box-a' : i === 1 ? 'box-b' : 'box'" />
        <text v-if="i < 2" :x="180 + i * 40" y="158" text-anchor="middle" class="tb">{{ i === 0 ? 'a' : 'b' }}</text>
      </template>

      <path d="M110 70 C 110 110, 150 130, 178 128" class="ln-a" marker-end="url(#fs-ah)" />
      <path d="M530 70 C 530 110, 250 110, 222 128" class="ln-b" marker-end="url(#fs-ah)" />

      <path d="M120 230 L520 230" class="ln" marker-start="url(#fs-ah)" marker-end="url(#fs-ah)" />
      <text x="320" y="220" text-anchor="middle" class="t">the whole line moves between the two cores' caches</text>
      <text x="320" y="258" text-anchor="middle" class="m">each write must first take the line away from the other core</text>
      <text x="320" y="280" text-anchor="middle" class="m">fix: put a and b in separate cache lines</text>
    </svg>
    <figcaption>
      False sharing. The two threads never touch each other's data, but the hardware tracks ownership per cache
      line, not per variable. Every write forces the line to move to the writing core.
    </figcaption>
  </figure>
</template>
