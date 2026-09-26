<script setup lang="ts">
// fork() vs pthread_create(): both make a new kernel task. The difference is what the new task shares.
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 340" role="img" aria-label="Two processes each have their own memory and file table; two threads are two tasks that point to one shared memory and one shared file table">
      <text x="160" y="24" text-anchor="middle" class="h">fork(): two processes</text>
      <text x="480" y="24" text-anchor="middle" class="h">Two threads, one process</text>
      <line x1="320" y1="10" x2="320" y2="330" class="ln-dash" />

      <!-- left: two tasks, each with its own resources -->
      <rect x="20" y="44" width="130" height="64" rx="8" class="box-a" />
      <text x="85" y="68" text-anchor="middle" class="tb">Task, PID 100</text>
      <text x="85" y="88" text-anchor="middle" class="m">registers, stack</text>
      <rect x="170" y="44" width="130" height="64" rx="8" class="box-a" />
      <text x="235" y="68" text-anchor="middle" class="tb">Task, PID 101</text>
      <text x="235" y="88" text-anchor="middle" class="m">registers, stack</text>

      <rect x="20" y="160" width="130" height="96" rx="8" class="box-b" />
      <text x="85" y="186" text-anchor="middle" class="t">own memory</text>
      <text x="85" y="210" text-anchor="middle" class="t">own file table</text>
      <text x="85" y="234" text-anchor="middle" class="t">own handlers</text>
      <rect x="170" y="160" width="130" height="96" rx="8" class="box-b" />
      <text x="235" y="186" text-anchor="middle" class="t">own memory</text>
      <text x="235" y="210" text-anchor="middle" class="t">own file table</text>
      <text x="235" y="234" text-anchor="middle" class="t">own handlers</text>

      <path d="M85 108 L85 160" class="ln" />
      <path d="M235 108 L235 160" class="ln" />

      <text x="160" y="290" text-anchor="middle" class="m">starts as a copy (copy-on-write),</text>
      <text x="160" y="308" text-anchor="middle" class="m">then each goes its own way</text>

      <!-- right: two tasks, one set of resources -->
      <rect x="340" y="44" width="130" height="64" rx="8" class="box-a" />
      <text x="405" y="68" text-anchor="middle" class="tb">Task, TID 200</text>
      <text x="405" y="88" text-anchor="middle" class="m">registers, stack</text>
      <rect x="490" y="44" width="130" height="64" rx="8" class="box-a" />
      <text x="555" y="68" text-anchor="middle" class="tb">Task, TID 201</text>
      <text x="555" y="88" text-anchor="middle" class="m">registers, stack</text>

      <rect x="340" y="160" width="280" height="96" rx="8" class="box-c" />
      <text x="480" y="186" text-anchor="middle" class="t">one shared memory</text>
      <text x="480" y="210" text-anchor="middle" class="t">one shared file table</text>
      <text x="480" y="234" text-anchor="middle" class="t">one set of signal handlers</text>

      <path d="M405 108 L440 160" class="ln" />
      <path d="M555 108 L520 160" class="ln" />

      <text x="480" y="290" text-anchor="middle" class="m">made by clone() with sharing flags;</text>
      <text x="480" y="308" text-anchor="middle" class="m">both threads report PID 200</text>
    </svg>
    <figcaption>
      To the Linux kernel, a process and a thread are both a <strong>task</strong>. What differs is what the
      new task shares with the task that created it.
    </figcaption>
  </figure>
</template>
