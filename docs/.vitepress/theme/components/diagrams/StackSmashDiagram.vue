<script setup lang="ts">
// A function's stack frame, and what a buffer overflow overwrites.
const frame = [
  { label: 'caller\'s frame', note: '', cls: 'box' },
  { label: 'return address', note: 'where to continue after the function', cls: 'box-d' },
  { label: 'saved frame pointer', note: '', cls: 'box' },
  { label: 'canary', note: 'random value, checked before return', cls: 'box-c' },
  { label: 'char buf[16]', note: 'filled by strcpy, from the bottom up', cls: 'box-a' },
]
const row = (i: number) => 40 + i * 56
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 360" role="img" aria-label="A stack frame with a buffer at the bottom, then a canary, the saved frame pointer and the return address above it. Writing past the end of the buffer overwrites the canary before it reaches the return address">
      <defs>
        <marker id="ss-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>
      <text x="150" y="24" text-anchor="middle" class="m">higher addresses</text>
      <template v-for="(f, i) in frame" :key="f.label">
        <rect x="40" :y="row(i)" width="220" height="48" rx="6" :class="f.cls" />
        <text x="150" :y="row(i) + 29" text-anchor="middle" class="tb mono">{{ f.label }}</text>
        <text v-if="f.note" x="280" :y="row(i) + 29" class="m">{{ f.note }}</text>
      </template>
      <text x="150" y="340" text-anchor="middle" class="m">lower addresses</text>

      <!-- overflow arrow -->
      <path d="M20 300 L20 108" class="ln-a" marker-end="url(#ss-ah)" />
      <text x="280" y="325" class="m">A write that runs past the buffer climbs upwards.</text>
      <text x="280" y="343" class="m">It must cross the canary to reach the return address.</text>
    </svg>
    <figcaption>
      One function's stack frame on x86-64 (the stack grows down, so the buffer sits below the return
      address). A long enough <code>strcpy</code> overwrites the return address. The canary sits in between,
      so the overflow damages it first, and the check before <code>return</code> catches it.
    </figcaption>
  </figure>
</template>
