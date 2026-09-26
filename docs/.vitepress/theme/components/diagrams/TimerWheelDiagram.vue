<script setup lang="ts">
// A hierarchical timer wheel, drawn as rows of slots. Each level's slots cover 8 times more time.
const levels = [
  { y: 60, name: 'Level 0', span: '1 tick per slot', timers: { 2: 'TCP retransmit', 5: 'poll timeout' } as Record<number, string> },
  { y: 170, name: 'Level 1', span: '8 ticks per slot', timers: { 4: 'idle conn. timer' } as Record<number, string> },
  { y: 280, name: 'Level 2', span: '64 ticks per slot', timers: { 1: 'keepalive' } as Record<number, string> },
]
const slotX = (i: number) => 170 + i * 56
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 370" role="img" aria-label="A timer wheel with three levels of eight slots. Timers are dropped into the slot for their expiry time; near timers go in fine-grained slots, far ones in coarse slots">
      <defs>
        <marker id="tw-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <template v-for="l in levels" :key="l.name">
        <text x="20" :y="l.y + 20" class="tb">{{ l.name }}</text>
        <text x="20" :y="l.y + 40" class="m">{{ l.span }}</text>
        <template v-for="i in 8" :key="i">
          <rect :x="slotX(i - 1)" :y="l.y" width="50" height="32" rx="4" :class="i === 1 ? 'box-b' : 'box'" />
          <text :x="slotX(i - 1) + 25" :y="l.y + 21" text-anchor="middle" class="m">{{ i - 1 }}</text>
          <template v-if="l.timers[i - 1]">
            <path :d="`M${slotX(i - 1) + 25} ${l.y + 32} L${slotX(i - 1) + 25} ${l.y + 48}`" class="ln" />
            <rect :x="slotX(i - 1) - 20" :y="l.y + 48" width="90" height="26" rx="4" class="box-c" />
            <text :x="slotX(i - 1) + 25" :y="l.y + 66" text-anchor="middle" class="m">{{ l.timers[i - 1] }}</text>
          </template>
        </template>
      </template>

      <!-- "now" pointer on level 0 -->
      <path d="M195 30 L195 56" class="ln-a" marker-end="url(#tw-ah)" />
      <text x="205" y="36" class="m">now: each tick moves one slot right and runs what is there</text>
    </svg>
    <figcaption>
      A timer wheel. Adding or cancelling a timer is a constant-time list operation: drop it in the slot for
      its expiry. Timers far in the future go in coarser levels, so they may fire slightly late. That is fine
      for timeouts, which are usually cancelled before they fire.
    </figcaption>
  </figure>
</template>
