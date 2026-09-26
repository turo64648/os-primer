<script setup lang="ts">
// Passing a file descriptor over a Unix domain socket: both processes end up
// with their own fd numbers for the same open file.
const a = ['0  stdin', '1  stdout', '2  stderr', '4  → open file']
const b = ['0  stdin', '1  stdout', '2  stderr', '3  → open file']
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 270" role="img" aria-label="Process A sends its file descriptor 4 over a Unix socket; process B receives it as file descriptor 3, and both refer to the same open file in the kernel">
      <defs>
        <marker id="fp-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <text x="95" y="24" text-anchor="middle" class="tb">Process A: fd table</text>
      <text x="545" y="24" text-anchor="middle" class="tb">Process B: fd table</text>
      <template v-for="(r, i) in a" :key="'a' + i">
        <rect x="20" :y="36 + i * 36" width="150" height="30" rx="5" :class="i === 3 ? 'box-a' : 'box'" />
        <text x="32" :y="56 + i * 36" class="t mono">{{ r }}</text>
      </template>
      <template v-for="(r, i) in b" :key="'b' + i">
        <rect x="470" :y="36 + i * 36" width="150" height="30" rx="5" :class="i === 3 ? 'box-a' : 'box'" />
        <text x="482" :y="56 + i * 36" class="t mono">{{ r }}</text>
      </template>

      <!-- the socket message -->
      <rect x="230" y="40" width="180" height="56" rx="8" class="box-b" />
      <text x="320" y="64" text-anchor="middle" class="tb">Unix socket</text>
      <text x="320" y="84" text-anchor="middle" class="m">message with SCM_RIGHTS</text>
      <path d="M172 68 L228 68" class="ln-dash" marker-end="url(#fp-ah)" />
      <path d="M412 68 L468 68" class="ln-dash" marker-end="url(#fp-ah)" />
      <text x="200" y="58" text-anchor="middle" class="m">send</text>
      <text x="440" y="58" text-anchor="middle" class="m">receive</text>

      <!-- the kernel object both fds point to -->
      <rect x="220" y="170" width="200" height="64" rx="8" class="box-d" />
      <text x="320" y="196" text-anchor="middle" class="tb">open file (kernel)</text>
      <text x="320" y="218" text-anchor="middle" class="m">which file, position, flags</text>
      <path d="M170 159 L218 190" class="ln-a" marker-end="url(#fp-ah)" />
      <path d="M470 159 L422 190" class="ln-a" marker-end="url(#fp-ah)" />
      <text x="320" y="260" text-anchor="middle" class="m">different numbers, one shared open file</text>
    </svg>
    <figcaption>
      Passing a file descriptor. The kernel adds an entry to the receiver's table that points to the same open
      file. The number can differ, but the file, its position and its flags are shared.
    </figcaption>
  </figure>
</template>
