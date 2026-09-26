<script setup lang="ts">
// One ELF file, two views: sections (for the linker) and segments (for the loader).
const sections = [
  { y: 120, h: 40, name: '.text', what: 'machine code', cls: 'box-a' },
  { y: 160, h: 30, name: '.rodata', what: 'constants, strings', cls: 'box-a' },
  { y: 190, h: 30, name: '.data', what: 'globals with a value', cls: 'box-b' },
  { y: 220, h: 30, name: '.bss (no bytes in file)', what: 'globals that start at 0', cls: 'ghost' },
  { y: 260, h: 30, name: '.symtab, .debug_*', what: 'symbols, debug info', cls: 'box' },
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 380" role="img" aria-label="An ELF file holds sections for the linker; the program headers group them into segments that the loader maps into memory with permissions">
      <text x="105" y="24" text-anchor="middle" class="h">What it holds</text>
      <text x="320" y="24" text-anchor="middle" class="h">Sections in the file</text>
      <text x="550" y="24" text-anchor="middle" class="h">Segments</text>
      <text x="550" y="42" text-anchor="middle" class="m">mapped into memory</text>

      <!-- file header rows -->
      <rect x="200" y="50" width="240" height="30" rx="4" class="box" />
      <text x="320" y="70" text-anchor="middle" class="t">ELF header</text>
      <rect x="200" y="80" width="240" height="30" rx="4" class="box" />
      <text x="320" y="100" text-anchor="middle" class="t">program headers</text>
      <text x="190" y="70" text-anchor="end" class="m">type, CPU, entry point</text>
      <text x="190" y="100" text-anchor="end" class="m">the loader's table</text>

      <!-- sections -->
      <template v-for="s in sections" :key="s.name">
        <rect x="200" :y="s.y" width="240" :height="s.h" rx="4" :class="s.cls" />
        <text x="320" :y="s.y + s.h / 2 + 5" text-anchor="middle" class="t mono">{{ s.name }}</text>
        <text x="190" :y="s.y + s.h / 2 + 5" text-anchor="end" class="m">{{ s.what }}</text>
      </template>

      <rect x="200" y="290" width="240" height="30" rx="4" class="box" />
      <text x="320" y="310" text-anchor="middle" class="t">section headers</text>
      <text x="190" y="310" text-anchor="end" class="m">the linker's table</text>

      <!-- segments -->
      <rect x="470" y="120" width="160" height="40" rx="6" class="box-a" />
      <text x="550" y="137" text-anchor="middle" class="tb">Code</text>
      <text x="550" y="153" text-anchor="middle" class="m">read + execute</text>
      <rect x="470" y="160" width="160" height="30" rx="6" class="box-a" />
      <text x="550" y="180" text-anchor="middle" class="m">read-only</text>
      <rect x="470" y="190" width="160" height="60" rx="6" class="box-b" />
      <text x="550" y="216" text-anchor="middle" class="tb">Data</text>
      <text x="550" y="236" text-anchor="middle" class="m">read + write</text>
      <rect x="470" y="260" width="160" height="30" rx="6" class="ghost" />
      <text x="550" y="280" text-anchor="middle" class="m">not loaded</text>

      <path d="M440 140 L470 140" class="ln" />
      <path d="M440 175 L470 175" class="ln" />
      <path d="M440 220 L470 220" class="ln" />
      <path d="M440 275 L470 275" class="ln-dash" />

      <!-- program headers describe segments -->
      <path d="M440 95 L550 95 L550 118" class="ln-dash" />
      <text x="456" y="88" class="m">describes the segments</text>

      <text x="320" y="352" text-anchor="middle" class="m">The linker works with many small sections.</text>
      <text x="320" y="370" text-anchor="middle" class="m">The loader only needs a few segments, each with one set of permissions.</text>
    </svg>
    <figcaption>
      The two views of one ELF file. <code>.bss</code> takes no space in the file: the loader gives it fresh,
      zero-filled memory. The full symbol table and debug information stay on disk and are never mapped.
    </figcaption>
  </figure>
</template>
