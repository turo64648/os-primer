<script setup lang="ts">
// A strip of heap: each block has a small header holding its size.
const blocks = [
  { w: 90, label: 'in use', size: '32', free: false },
  { w: 130, label: 'free', size: '64', free: true },
  { w: 100, label: 'in use', size: '48', free: false },
  { w: 90, label: 'free', size: '32', free: true },
  { w: 130, label: 'in use', size: '96', free: false },
]
const HDR = 22
let x = 30
const placed = blocks.map((b) => {
  const p = { ...b, x }
  x += b.w
  return p
})
const freeBlocks = placed.filter((b) => b.free)
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 250" role="img" aria-label="A strip of heap memory: blocks with size headers, and a free list linking the free blocks">
      <defs>
        <marker id="hc-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <rect x="30" y="20" width="110" height="34" rx="6" class="box-c" />
      <text x="85" y="42" text-anchor="middle" class="t">free list</text>

      <template v-for="(b, i) in placed" :key="i">
        <rect :x="b.x" y="110" :width="HDR" height="56" class="box-d" />
        <rect :x="b.x + HDR" y="110" :width="b.w - HDR" height="56" :class="b.free ? 'ghost' : 'box-a'" />
        <text :x="b.x + HDR / 2" y="143" text-anchor="middle" class="m mono">{{ b.size }}</text>
        <text :x="b.x + HDR + (b.w - HDR) / 2" y="143" text-anchor="middle" :class="b.free ? 'm' : 't'">{{ b.label }}</text>
      </template>

      <path :d="`M140 37 C ${freeBlocks[0].x + 60} 37, ${freeBlocks[0].x + 60} 70, ${freeBlocks[0].x + 60} 106`" class="ln-c" marker-end="url(#hc-ah)" />
      <path :d="`M${freeBlocks[0].x + 80} 110 C ${freeBlocks[0].x + 90} 70, ${freeBlocks[1].x + 40} 70, ${freeBlocks[1].x + 45} 106`" class="ln-c" marker-end="url(#hc-ah)" />

      <rect x="570" y="110" width="50" height="56" class="ghost" />
      <text x="595" y="143" text-anchor="middle" class="m">top</text>

      <path d="M41 172 L41 196" class="ln" />
      <text x="30" y="214" class="m">header: the block's size (and a few flag bits)</text>
      <text x="30" y="234" class="m">free blocks store the free-list links inside themselves</text>
    </svg>
    <figcaption>
      A piece of heap. Every block starts with a header that records its size, which is how <code>free(p)</code>
      knows how big the block is. Free blocks are linked into a list, using their own unused bytes for the links.
    </figcaption>
  </figure>
</template>
