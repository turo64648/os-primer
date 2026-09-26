<script setup lang="ts">
// Three ways a core can receive timer interrupts: periodic, tickless when idle, fully tickless.
const x0 = 190
const x1 = 620
const every = (from: number, to: number, step: number) => {
  const out: number[] = []
  for (let x = from; x <= to; x += step) out.push(x)
  return out
}
const rows = [
  { y: 60, title: 'Periodic tick', note: 'old default', busyTo: 400, ticks: every(200, 610, 20), label: '' },
  { y: 160, title: 'Tickless idle', note: 'the usual default', busyTo: 400, ticks: [...every(200, 390, 20), 560], label: 'next timer due' },
  { y: 260, title: 'Full tickless', note: 'nohz_full cores', busyTo: 620, ticks: [410], label: 'rare housekeeping' },
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 330" role="img" aria-label="Timer interrupts over time on one core in three modes: a periodic tick that fires even when idle, a tickless-idle mode that stops ticks while idle, and full tickless mode that stops ticks while one thread runs">
      <text x="405" y="24" text-anchor="middle" class="m">time →   (each short line is one timer interrupt)</text>
      <template v-for="r in rows" :key="r.title">
        <text x="20" :y="r.y + 16" class="tb">{{ r.title }}</text>
        <text x="20" :y="r.y + 36" class="m">{{ r.note }}</text>

        <rect :x="x0" :y="r.y" :width="r.busyTo - x0" height="40" rx="4" class="box-a" />
        <text :x="(x0 + r.busyTo) / 2" :y="r.y + 25" text-anchor="middle" class="m">
          {{ r.busyTo === x1 ? 'one thread running' : 'running threads' }}
        </text>
        <template v-if="r.busyTo < x1">
          <rect :x="r.busyTo" :y="r.y" :width="x1 - r.busyTo" height="40" rx="4" class="box" />
          <text :x="(r.busyTo + x1) / 2" :y="r.y + 25" text-anchor="middle" class="m">idle</text>
        </template>

        <path v-for="t in r.ticks" :key="t" :d="`M${t} ${r.y - 14} L${t} ${r.y - 2}`" class="ln-b" />
        <text v-if="r.label" :x="r.ticks[r.ticks.length - 1]" :y="r.y + 58" text-anchor="middle" class="m">{{ r.label }}</text>
      </template>
    </svg>
    <figcaption>
      A periodic tick wakes every core hundreds of times a second, even when it has nothing to do. Tickless
      idle stops the tick on idle cores to save power. Full tickless also stops it on a core running one
      thread, to remove interruptions.
    </figcaption>
  </figure>
</template>
