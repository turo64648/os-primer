<script setup lang="ts">
const rows = [
  { name: 'Clean file page', note: 'same as the copy in the file', act: 'Drop it', how: 'read it from the file again if needed', cost: 'cheap', cls: 'box-c' },
  { name: 'Dirty file page', note: 'changed, file not updated yet', act: 'Write it to the file, then drop it', how: 'costs a disk write first', cost: 'slower', cls: 'box-a' },
  { name: 'Anonymous page', note: 'heap, stack: no file behind it', act: 'Write it to swap, then drop it', how: 'impossible if there is no swap', cost: 'slow', cls: 'box-b' },
  { name: 'Locked or kernel page', note: 'mlock, most kernel memory', act: 'Cannot be freed', how: 'stays in RAM', cost: '', cls: 'box-d' },
]
const y = (i: number) => 56 + i * 76
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 360" role="img" aria-label="Four kinds of pages in RAM and what the kernel must do to free each one">
      <defs>
        <marker id="pk-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>
      <text x="140" y="32" text-anchor="middle" class="h">A page in RAM</text>
      <text x="470" y="32" text-anchor="middle" class="h">How the kernel can free it</text>
      <template v-for="(r, i) in rows" :key="i">
        <rect x="20" :y="y(i)" width="250" height="58" rx="8" :class="r.cls" />
        <text x="145" :y="y(i) + 24" text-anchor="middle" class="tb">{{ r.name }}</text>
        <text x="145" :y="y(i) + 44" text-anchor="middle" class="m">{{ r.note }}</text>
        <path :d="`M270 ${y(i) + 29} L316 ${y(i) + 29}`" class="ln" marker-end="url(#pk-ah)" />
        <rect x="320" :y="y(i)" width="300" height="58" rx="8" class="box" />
        <text x="470" :y="y(i) + 24" text-anchor="middle" class="t">{{ r.act }}</text>
        <text x="470" :y="y(i) + 44" text-anchor="middle" class="m">{{ r.how }}</text>
      </template>
    </svg>
    <figcaption>
      Every page in RAM falls into one of these groups. The higher a page is in this list, the cheaper it is for
      the kernel to take its frame back.
    </figcaption>
  </figure>
</template>
