<script setup lang="ts">
// One request's life, left to right. "on" segments run on a CPU; the others wait.
const segs = [
  { w: 70, on: true, label: 'parse' },
  { w: 90, on: false, label: 'lock' },
  { w: 60, on: true, label: 'logic' },
  { w: 150, on: false, label: 'disk read' },
  { w: 70, on: false, label: 'run queue' },
  { w: 60, on: true, label: 'reply' },
]
let x = 50
const placed = segs.map((s) => {
  const p = { ...s, x }
  x += s.w
  return p
})
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 260" role="img" aria-label="Timeline of one request: short periods running on a CPU separated by waits for a lock, a disk read and the run queue">
      <defs>
        <marker id="oo-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>
      <text x="50" y="30" class="tb">One request, from arrival to reply</text>

      <template v-for="(s, i) in placed" :key="i">
        <rect :x="s.x" y="60" :width="s.w" height="50" :class="s.on ? 'box-a' : 'box-b'" />
        <text :x="s.x + s.w / 2" y="90" text-anchor="middle" class="t">{{ s.label }}</text>
      </template>
      <path d="M50 130 L602 130" class="ln" marker-end="url(#oo-ah)" />
      <text x="606" y="134" class="m">time</text>

      <rect x="50" y="160" width="22" height="18" class="box-a" />
      <text x="82" y="174" class="t">running on a CPU (on-CPU)</text>
      <text x="82" y="194" class="m">a CPU profiler such as perf sees only these</text>

      <rect x="350" y="160" width="22" height="18" class="box-b" />
      <text x="382" y="174" class="t">waiting (off-CPU)</text>
      <text x="382" y="194" class="m">needs off-CPU analysis to see</text>

      <text x="320" y="238" text-anchor="middle" class="m">Here the request spends about two thirds of its time waiting.</text>
    </svg>
    <figcaption>
      A request's latency is its time on a CPU plus its time waiting. Speeding up the code that runs can only
      shrink the first part.
    </figcaption>
  </figure>
</template>
