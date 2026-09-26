<script setup lang="ts">
// From execve() to main() and back out: who runs each step.
const steps = [
  { who: 'Kernel', cls: 'box-d', title: '1. execve: read the ELF header', note: 'check type and CPU; find the program headers' },
  { who: 'Kernel', cls: 'box-d', title: '2. Map the program and ld.so', note: 'fresh address space; segments mapped, not read' },
  { who: 'Kernel', cls: 'box-d', title: '3. Build the stack, jump to ld.so', note: 'argc, argv, environment, auxiliary vector' },
  { who: 'ld.so', cls: 'box-b', title: '4. Load and link the libraries', note: 'map libc.so.6 etc., fix up addresses' },
  { who: 'libc', cls: 'box-c', title: '5. _start, then libc setup', note: 'run constructors (initialisers)' },
  { who: 'Your code', cls: 'box-a', title: '6. main(argc, argv)', note: 'your program finally runs' },
  { who: 'libc', cls: 'box-c', title: '7. exit', note: 'atexit handlers, destructors, flush, _exit' },
]
const row = (i: number) => 20 + i * 66
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 486" role="img" aria-label="Steps from execve to main: the kernel maps the program and the dynamic loader, the loader loads libraries, libc runs constructors, main runs, then exit runs cleanup">
      <defs>
        <marker id="ps2-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>
      <template v-for="(s, i) in steps" :key="s.title">
        <rect x="20" :y="row(i)" width="120" height="52" rx="8" :class="s.cls" />
        <text x="80" :y="row(i) + 31" text-anchor="middle" class="tb">{{ s.who }}</text>
        <rect x="160" :y="row(i)" width="460" height="52" rx="8" :class="s.cls" />
        <text x="175" :y="row(i) + 22" class="tb">{{ s.title }}</text>
        <text x="175" :y="row(i) + 42" class="m">{{ s.note }}</text>
        <path v-if="i < steps.length - 1" :d="`M390 ${row(i) + 52} L390 ${row(i + 1)}`" class="ln" marker-end="url(#ps2-ah)" />
      </template>
    </svg>
    <figcaption>
      Running a dynamically linked program. By the time <code>main</code> runs, the kernel, the dynamic loader
      and libc have each done work. A statically linked program skips step 4.
    </figcaption>
  </figure>
</template>
