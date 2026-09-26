<script setup lang="ts">
// One system call, step by step. Left column: user mode. Right column: kernel mode.
const row = (i: number) => 50 + i * 72
const left = [
  { i: 0, title: '1. Your code calls write()', note: 'a normal call into the C library' },
  { i: 1, title: '2. libc fills registers', note: 'call number + up to 6 arguments' },
  { i: 2, title: '3. Runs the syscall instruction', note: 'the one door into the kernel' },
  { i: 5, title: '8. libc checks the result', note: 'error: returns -1 and sets errno' },
]
const right = [
  { i: 2, title: '4. CPU enters kernel mode', note: 'jumps to an address set at boot' },
  { i: 3, title: '5. Kernel saves registers', note: 'then looks up the handler' },
  { i: 4, title: '6. Handler does the work', note: 'checks every argument first' },
  { i: 5, title: '7. Result in a register', note: 'CPU drops back to user mode' },
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 480" role="img" aria-label="The steps of a system call, crossing from user mode into kernel mode and back">
      <defs>
        <marker id="sc-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <text x="155" y="30" text-anchor="middle" class="h">User mode</text>
      <text x="485" y="30" text-anchor="middle" class="h">Kernel mode</text>
      <line x1="320" y1="40" x2="320" y2="470" class="ln-dash" />

      <!-- user-mode steps -->
      <template v-for="s in left" :key="'l' + s.i">
        <rect x="20" :y="row(s.i)" width="270" height="56" rx="8" class="box-a" />
        <text x="155" :y="row(s.i) + 24" text-anchor="middle" class="tb">{{ s.title }}</text>
        <text x="155" :y="row(s.i) + 44" text-anchor="middle" class="m">{{ s.note }}</text>
      </template>

      <!-- the thread is waiting while the kernel runs -->
      <rect x="20" :y="row(3)" width="270" height="128" rx="8" class="ghost" />
      <text x="155" :y="row(3) + 54" text-anchor="middle" class="m">your code is paused here</text>
      <text x="155" :y="row(3) + 74" text-anchor="middle" class="m">(the same thread is now</text>
      <text x="155" :y="row(3) + 94" text-anchor="middle" class="m">running kernel code)</text>

      <!-- kernel-mode steps -->
      <template v-for="s in right" :key="'r' + s.i">
        <rect x="350" :y="row(s.i)" width="270" height="56" rx="8" class="box-d" />
        <text x="485" :y="row(s.i) + 24" text-anchor="middle" class="tb">{{ s.title }}</text>
        <text x="485" :y="row(s.i) + 44" text-anchor="middle" class="m">{{ s.note }}</text>
      </template>

      <!-- arrows down each column -->
      <path :d="`M155 ${row(0) + 56} L155 ${row(1)}`" class="ln" marker-end="url(#sc-ah)" />
      <path :d="`M155 ${row(1) + 56} L155 ${row(2)}`" class="ln" marker-end="url(#sc-ah)" />
      <path :d="`M485 ${row(2) + 56} L485 ${row(3)}`" class="ln" marker-end="url(#sc-ah)" />
      <path :d="`M485 ${row(3) + 56} L485 ${row(4)}`" class="ln" marker-end="url(#sc-ah)" />
      <path :d="`M485 ${row(4) + 56} L485 ${row(5)}`" class="ln" marker-end="url(#sc-ah)" />

      <!-- crossings -->
      <path :d="`M290 ${row(2) + 28} L350 ${row(2) + 28}`" class="ln-a" marker-end="url(#sc-ah)" />
      <path :d="`M350 ${row(5) + 28} L290 ${row(5) + 28}`" class="ln-a" marker-end="url(#sc-ah)" />
    </svg>
    <figcaption>
      One system call. Only two arrows cross the line: the syscall instruction going in and the return
      instruction coming out. Everything on the right runs in kernel mode, on the same thread.
    </figcaption>
  </figure>
</template>
