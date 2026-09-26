<script setup lang="ts">
// Where written data sits on its way to stable storage, and which call pushes it down each step.
const layers = [
  { y: 30, t: 'Your program’s buffer', m: 'stdio, your own buffers', c: 'box-a', lost: 'lost if the process crashes' },
  { y: 130, t: 'Page cache', m: 'kernel RAM', c: 'box-d', lost: 'lost if the OS crashes or power fails' },
  { y: 230, t: 'Drive’s write cache', m: 'RAM inside the SSD or disk', c: 'box-b', lost: 'lost on power failure, unless' },
  { y: 330, t: 'Stable media', m: 'flash cells, disk platters', c: 'box-c', lost: 'survives power loss' },
]
const pushes = [
  { y: 110, t: 'write()  (fflush() for stdio)' },
  { y: 210, t: 'fsync() / fdatasync(): waits' },
  { y: 310, t: 'cache flush or FUA write, sent by fsync' },
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 400" role="img" aria-label="Written data passes through the program's buffer, the page cache, the drive's cache and finally stable media. Each step needs a specific call.">
      <defs>
        <marker id="dl-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>
      <template v-for="l in layers" :key="l.t">
        <rect x="20" :y="l.y" width="300" height="52" rx="8" :class="l.c" />
        <text x="170" :y="l.y + 22" text-anchor="middle" class="tb">{{ l.t }}</text>
        <text x="170" :y="l.y + 42" text-anchor="middle" class="m">{{ l.m }}</text>
        <text x="340" :y="l.y + 32" class="t">{{ l.lost }}</text>
      </template>
      <text x="340" y="282" class="t">it has power-loss protection</text>
      <template v-for="p in pushes" :key="p.t">
        <path :d="`M60 ${p.y - 28} L60 ${p.y + 18}`" class="ln-a" marker-end="url(#dl-ah)" />
        <text x="74" :y="p.y" class="m mono">{{ p.t }}</text>
      </template>
    </svg>
    <figcaption>
      Where your data is after each call. <code>write</code> only reaches the page cache. <code>fsync</code>
      writes the file's dirty pages to the drive, waits, and asks the drive to put them on stable media. Data is
      safe only at the bottom layer.
    </figcaption>
  </figure>
</template>
