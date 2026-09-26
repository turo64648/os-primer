<script setup lang="ts">
const cells = Array.from({ length: 10 }, (_, i) => i)
const rows = [
  { y: 50, title: '1. After 200,000 mallocs', kind: 'used' },
  { y: 150, title: '2. After freeing all but the last', kind: 'free' },
  { y: 250, title: '3. After malloc_trim', kind: 'gone' },
]
const cx = (i: number) => 30 + i * 58
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 350" role="img" aria-label="A heap that cannot shrink because the last block is still in use, until free pages in the middle are returned">
      <template v-for="r in rows" :key="r.y">
        <text x="30" :y="r.y - 12" class="tb">{{ r.title }}</text>
        <template v-for="i in cells" :key="i">
          <rect :x="cx(i)" :y="r.y" width="52" height="44" rx="4"
            :class="i === 9 || r.kind === 'used' ? 'box-a' : r.kind === 'free' ? 'box-c' : 'ghost'" />
        </template>
        <text v-if="r.kind === 'used'" x="30" :y="r.y + 66" class="m">every page in RAM: RSS about 200 MB</text>
        <text v-if="r.kind === 'free'" x="30" :y="r.y + 66" class="m">free inside malloc, still in RAM: RSS unchanged</text>
        <text v-if="r.kind === 'gone'" x="30" :y="r.y + 66" class="m">free pages handed back to the kernel: RSS about 3 MB</text>
      </template>
      <text x="604" y="342" text-anchor="middle" class="m">last block</text>
      <path d="M604 294 L604 326" class="ln-dash" />
    </svg>
    <figcaption>
      The heap can only shrink from its end, and the last block is still in use. So freed memory stays in RAM
      until the allocator hands back the pages in the middle (here with <code>malloc_trim</code>).
    </figcaption>
  </figure>
</template>
