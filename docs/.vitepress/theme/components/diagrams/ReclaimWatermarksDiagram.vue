<script setup lang="ts">
const bands = [
  { y: 50, h: 80, cls: 'box-c', title: 'Plenty of free memory', note: 'Allocations succeed at once. kswapd sleeps.' },
  { y: 130, h: 80, cls: 'box', title: 'Between low and high', note: 'kswapd, once awake, keeps freeing until high.' },
  { y: 210, h: 80, cls: 'box-a', title: 'Below low: kswapd wakes', note: 'Frees memory in the background. No one waits.' },
  { y: 290, h: 70, cls: 'box-b', title: 'Below min: direct reclaim', note: 'The thread asking for memory must free some itself.' },
]
const lines = [
  { y: 130, label: 'high' },
  { y: 210, label: 'low' },
  { y: 290, label: 'min' },
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 430" role="img" aria-label="Free memory levels: above high nothing happens, below low kswapd reclaims in the background, below min allocating threads reclaim directly, and when nothing can be freed the OOM killer runs">
      <defs>
        <marker id="wm-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>
      <text x="100" y="32" text-anchor="middle" class="h">Free memory</text>
      <text x="400" y="32" text-anchor="middle" class="h">What the kernel does</text>

      <template v-for="(b, i) in bands" :key="i">
        <rect x="70" :y="b.y" width="60" :height="b.h" :class="b.cls" />
        <rect x="190" :y="b.y + 8" width="430" :height="b.h - 16" rx="8" :class="b.cls" />
        <text x="205" :y="b.y + b.h / 2 - 4" class="tb">{{ b.title }}</text>
        <text x="205" :y="b.y + b.h / 2 + 16" class="m">{{ b.note }}</text>
      </template>

      <template v-for="l in lines" :key="l.label">
        <line x1="60" :x2="140" :y1="l.y" :y2="l.y" class="ln" />
        <text x="54" :y="l.y + 5" text-anchor="end" class="m mono">{{ l.label }}</text>
      </template>
      <text x="54" y="364" text-anchor="end" class="m mono">0</text>

      <path d="M100 360 L100 384" class="ln" marker-end="url(#wm-ah)" />
      <rect x="20" y="386" width="600" height="36" rx="8" class="box-d" />
      <text x="320" y="409" text-anchor="middle" class="t">Nothing more can be freed: the OOM killer ends a process</text>
    </svg>
    <figcaption>
      The kernel keeps three levels ("watermarks") for free memory. Background freeing starts below low. Only
      when free memory drops below min do programs themselves have to wait.
    </figcaption>
  </figure>
</template>
