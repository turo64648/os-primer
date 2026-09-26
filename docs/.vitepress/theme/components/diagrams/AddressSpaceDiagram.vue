<script setup lang="ts">
const regions = [
  { y: 20, h: 44, name: 'Kernel space', note: 'mapped in every process; kernel-only', addr: '0xffff8000_00000000', cls: 'box-d' },
  { y: 64, h: 30, name: 'non-canonical hole', note: 'addresses here always fault', addr: '', cls: 'ghost' },
  { y: 94, h: 44, name: 'Stack ↓', note: 'grows down; guard page below', addr: '0x00007fff_ffffffff', cls: 'box-b' },
  { y: 138, h: 36, name: '', note: '', addr: '', cls: 'gap' },
  { y: 174, h: 52, name: 'mmap region ↓', note: "libraries, mmap'd files, big mallocs", addr: '', cls: 'box-c' },
  { y: 226, h: 36, name: '', note: '', addr: '', cls: 'gap' },
  { y: 262, h: 40, name: 'Heap ↑', note: 'grows up via brk()', addr: '', cls: 'box-a' },
  { y: 302, h: 28, name: 'BSS', note: 'zero-initialised globals', addr: '', cls: 'box' },
  { y: 330, h: 28, name: 'Data', note: 'initialised globals', addr: '', cls: 'box' },
  { y: 358, h: 28, name: 'Text', note: 'code, read-only + executable', addr: '0x00000000_00400000', cls: 'box' },
  { y: 386, h: 30, name: 'unmapped', note: 'catches NULL dereferences', addr: '0x0', cls: 'ghost' },
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 430" role="img" aria-label="Linux x86-64 process address space layout">
      <template v-for="r in regions" :key="r.y">
        <template v-if="r.cls !== 'gap'">
          <rect x="200" :y="r.y" width="160" :height="r.h" :class="r.cls" />
          <text x="280" :y="r.y + r.h / 2 + 5" text-anchor="middle" :class="r.cls === 'ghost' ? 'm' : 'tb'">{{ r.name }}</text>
          <text x="374" :y="r.y + r.h / 2 + 5" class="m">{{ r.note }}</text>
          <text v-if="r.addr" x="190" :y="r.y + 14" text-anchor="end" class="m mono">{{ r.addr }}</text>
        </template>
        <template v-else>
          <line x1="200" x2="200" :y1="r.y" :y2="r.y + r.h" class="ln-dash" />
          <line x1="360" x2="360" :y1="r.y" :y2="r.y + r.h" class="ln-dash" />
          <text x="280" :y="r.y + r.h / 2 + 5" text-anchor="middle" class="m">unmapped</text>
        </template>
      </template>
      <text x="20" y="424" class="m">(Not to scale. ASLR randomises the start of stack, mmap region and heap.)</text>
    </svg>
    <figcaption>
      The layout of a typical Linux x86-64 process. You can see a live one with <code>cat /proc/self/maps</code>.
    </figcaption>
  </figure>
</template>
