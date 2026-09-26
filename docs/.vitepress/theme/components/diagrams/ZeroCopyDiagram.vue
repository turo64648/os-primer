<script setup lang="ts">
// Sending a file over a socket: read()+write() versus sendfile().
const bx = (i: number) => 5 + i * 130
const boxes = [
  { t: 'Disk', m: 'device', c: 'box' },
  { t: 'Page cache', m: 'kernel memory', c: 'box-d' },
  { t: 'Your buffer', m: 'user memory', c: 'box-a' },
  { t: 'Socket buffer', m: 'kernel memory', c: 'box-d' },
  { t: 'Network card', m: 'device', c: 'box' },
]
const top = ['DMA', 'CPU copy', 'CPU copy', 'DMA']
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 310" role="img" aria-label="read plus write copies file data twice with the CPU; sendfile lets the network card read straight from the page cache">
      <defs>
        <marker id="zc-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <!-- row 1: read + write -->
      <text x="320" y="24" text-anchor="middle" class="h">read() then write(): 2 CPU copies, 2 system calls</text>
      <template v-for="(b, i) in boxes" :key="'a' + i">
        <rect :x="bx(i)" y="40" width="110" height="56" rx="8" :class="b.c" />
        <text :x="bx(i) + 55" y="64" text-anchor="middle" class="t">{{ b.t }}</text>
        <text :x="bx(i) + 55" y="84" text-anchor="middle" class="m">{{ b.m }}</text>
      </template>
      <template v-for="(l, i) in top" :key="'l' + i">
        <path :d="`M${bx(i) + 110} 68 L${bx(i + 1)} 68`" :class="l === 'DMA' ? 'ln' : 'ln-b'" marker-end="url(#zc-ah)" />
        <text :x="bx(i) + 120" y="118" text-anchor="middle" :class="l === 'DMA' ? 'm' : 'tb'">{{ l }}</text>
      </template>

      <!-- row 2: sendfile -->
      <text x="320" y="150" text-anchor="middle" class="h">sendfile(): no CPU copy, 1 system call</text>
      <template v-for="(b, i) in boxes" :key="'b' + i">
        <rect :x="bx(i)" y="220" width="110" height="56" rx="8" :class="i === 2 ? 'ghost' : b.c" />
        <text :x="bx(i) + 55" y="244" text-anchor="middle" class="t">{{ i === 2 ? 'not used' : b.t }}</text>
        <text :x="bx(i) + 55" y="264" text-anchor="middle" class="m">{{ i === 3 ? 'pointers only' : i === 2 ? '' : b.m }}</text>
      </template>
      <path :d="`M${bx(0) + 110} 248 L${bx(1)} 248`" class="ln" marker-end="url(#zc-ah)" />
      <text :x="bx(0) + 120" y="298" text-anchor="middle" class="m">DMA</text>
      <path :d="`M${bx(1) + 55} 220 C ${bx(1) + 55} 166, ${bx(4) + 55} 166, ${bx(4) + 55} 218`" class="ln-a" marker-end="url(#zc-ah)" />
      <text :x="bx(3) - 10" y="206" text-anchor="middle" class="m">DMA straight from the page cache</text>
    </svg>
    <figcaption>
      Sending a file over a socket. With read and write, the CPU copies the data into your buffer and out again.
      With sendfile, the data never enters user memory. If the network card can gather data from several places
      in RAM (most server cards can), the CPU copies nothing; otherwise the kernel makes one copy.
    </figcaption>
  </figure>
</template>
