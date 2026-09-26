<script setup lang="ts">
// Top: a pipe or socket copies data into the kernel and out again.
// Bottom: shared memory maps the same RAM into both processes.
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 330" role="img" aria-label="A pipe or socket copies data twice through a kernel buffer; shared memory maps the same RAM pages into both processes, with no copy">
      <defs>
        <marker id="ic-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <text x="20" y="24" class="tb">Pipe or socket: the kernel copies the data twice</text>
      <rect x="20" y="40" width="160" height="64" rx="8" class="box-a" />
      <text x="100" y="66" text-anchor="middle" class="tb">Process A</text>
      <text x="100" y="88" text-anchor="middle" class="m">its own buffer</text>
      <rect x="240" y="40" width="160" height="64" rx="8" class="box-d" />
      <text x="320" y="66" text-anchor="middle" class="tb">Kernel</text>
      <text x="320" y="88" text-anchor="middle" class="m">pipe or socket buffer</text>
      <rect x="460" y="40" width="160" height="64" rx="8" class="box-a" />
      <text x="540" y="66" text-anchor="middle" class="tb">Process B</text>
      <text x="540" y="88" text-anchor="middle" class="m">its own buffer</text>
      <path d="M182 72 L238 72" class="ln" marker-end="url(#ic-ah)" />
      <text x="210" y="62" text-anchor="middle" class="m">write</text>
      <text x="210" y="92" text-anchor="middle" class="m">copy 1</text>
      <path d="M402 72 L458 72" class="ln" marker-end="url(#ic-ah)" />
      <text x="430" y="62" text-anchor="middle" class="m">read</text>
      <text x="430" y="92" text-anchor="middle" class="m">copy 2</text>

      <text x="20" y="150" class="tb">Shared memory: both processes map the same RAM</text>
      <rect x="20" y="166" width="160" height="64" rx="8" class="box-a" />
      <text x="100" y="192" text-anchor="middle" class="tb">Process A</text>
      <text x="100" y="214" text-anchor="middle" class="m">sees it at one address</text>
      <rect x="460" y="166" width="160" height="64" rx="8" class="box-a" />
      <text x="540" y="192" text-anchor="middle" class="tb">Process B</text>
      <text x="540" y="214" text-anchor="middle" class="m">maybe at another</text>
      <rect x="230" y="250" width="180" height="50" rx="8" class="box-c" />
      <text x="320" y="280" text-anchor="middle" class="tb">the same RAM pages</text>
      <path d="M130 232 L228 268" class="ln-a" marker-end="url(#ic-ah)" />
      <path d="M510 232 L412 268" class="ln-a" marker-end="url(#ic-ah)" />
      <text x="320" y="322" text-anchor="middle" class="m">no copies and no system calls, but the processes must synchronise themselves</text>
    </svg>
    <figcaption>
      Two ways to move data between processes. Pipes and sockets are simple and safe, but every byte crosses the
      kernel twice. Shared memory avoids the copies, and leaves all coordination to the programs.
    </figcaption>
  </figure>
</template>
