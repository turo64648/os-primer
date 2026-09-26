<script setup lang="ts">
const a = [
  { label: 'code', f: 1 },
  { label: 'libc', f: 4 },
  { label: 'heap', f: 6 },
  { label: 'heap', f: -1 },
  { label: 'stack', f: 2 },
]
const b = [
  { label: 'code', f: 5 },
  { label: 'libc', f: 4 },
  { label: 'heap', f: 0 },
  { label: 'stack', f: 7 },
]
const frames = ['B heap', 'A code', 'A stack', 'free', 'libc (shared)', 'B code', 'A heap', 'B stack']
const ay = (i: number) => 70 + i * 46
const fy = (i: number) => 64 + i * 36
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 360" role="img" aria-label="Two processes' virtual pages mapped onto physical frames, with a shared libc frame">
      <text x="95" y="30" text-anchor="middle" class="h">Process A</text>
      <text x="95" y="48" text-anchor="middle" class="m">virtual pages</text>
      <text x="320" y="30" text-anchor="middle" class="h">Physical RAM</text>
      <text x="320" y="48" text-anchor="middle" class="m">frames</text>
      <text x="545" y="30" text-anchor="middle" class="h">Process B</text>
      <text x="545" y="48" text-anchor="middle" class="m">virtual pages</text>

      <!-- mappings -->
      <template v-for="(p, i) in a" :key="'la' + i">
        <path v-if="p.f >= 0" class="ln-a" :d="`M170 ${ay(i) + 19} C 208 ${ay(i) + 19}, 208 ${fy(p.f) + 15}, 245 ${fy(p.f) + 15}`" />
      </template>
      <template v-for="(p, i) in b" :key="'lb' + i">
        <path class="ln-b" :d="`M470 ${ay(i) + 19} C 432 ${ay(i) + 19}, 432 ${fy(p.f) + 15}, 395 ${fy(p.f) + 15}`" />
      </template>

      <!-- process A -->
      <template v-for="(p, i) in a" :key="'a' + i">
        <rect x="20" :y="ay(i)" width="150" height="38" rx="6" :class="p.f >= 0 ? 'box-a' : 'ghost'" />
        <text x="95" :y="ay(i) + 24" text-anchor="middle" :class="p.f >= 0 ? 't' : 'm'">
          {{ p.f >= 0 ? p.label : 'heap · not present' }}
        </text>
      </template>

      <!-- physical frames -->
      <template v-for="(f, i) in frames" :key="'f' + i">
        <rect x="245" :y="fy(i)" width="150" height="30" rx="4" :class="i === 4 ? 'box-c' : f === 'free' ? 'ghost' : 'box'" />
        <text x="256" :y="fy(i) + 20" class="m mono">{{ i }}</text>
        <text x="330" :y="fy(i) + 20" text-anchor="middle" :class="f === 'free' ? 'm' : 't'">{{ f }}</text>
      </template>

      <!-- process B -->
      <template v-for="(p, i) in b" :key="'b' + i">
        <rect x="470" :y="ay(i)" width="150" height="38" rx="6" class="box-b" />
        <text x="545" :y="ay(i) + 24" text-anchor="middle" class="t">{{ p.label }}</text>
      </template>
    </svg>
    <figcaption>
      Each process has its own page table. Contiguous virtual pages can land anywhere in RAM, the same frame can
      be shared (libc), and a page can be valid but have no frame yet.
    </figcaption>
  </figure>
</template>
