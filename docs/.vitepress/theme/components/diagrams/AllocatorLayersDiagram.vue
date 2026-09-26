<template>
  <figure class="figure">
    <svg viewBox="0 0 640 330" role="img" aria-label="Three layers: the program calls malloc often, the allocator inside the process asks the kernel for pages rarely">
      <defs>
        <marker id="al-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <rect x="20" y="20" width="600" height="64" rx="8" class="box-a" />
      <text x="320" y="46" text-anchor="middle" class="tb">Your program</text>
      <text x="320" y="68" text-anchor="middle" class="m">malloc(32), free(p): millions of calls, any size</text>

      <path d="M200 84 L200 124" class="ln" marker-end="url(#al-ah)" />
      <path d="M440 124 L440 84" class="ln" marker-end="url(#al-ah)" />
      <text x="210" y="109" class="m">ordinary function call</text>
      <text x="450" y="109" class="m">a block of bytes</text>

      <rect x="20" y="124" width="600" height="64" rx="8" class="box-c" />
      <text x="320" y="150" text-anchor="middle" class="tb">The allocator (a library inside the process)</text>
      <text x="320" y="172" text-anchor="middle" class="m">keeps freed blocks and hands them out again</text>

      <path d="M200 188 L200 238" class="ln" marker-end="url(#al-ah)" />
      <path d="M440 238 L440 188" class="ln" marker-end="url(#al-ah)" />
      <text x="210" y="211" class="m">system call, rarely</text>
      <text x="210" y="228" class="m mono">brk, mmap, munmap, madvise</text>
      <text x="450" y="218" class="m">whole pages</text>

      <rect x="20" y="238" width="600" height="64" rx="8" class="box-d" />
      <text x="320" y="264" text-anchor="middle" class="tb">The kernel</text>
      <text x="320" y="286" text-anchor="middle" class="m">only deals in whole pages (4 KiB and up)</text>
    </svg>
    <figcaption>
      The program never talks to the kernel about small blocks. The allocator buys pages in bulk and sells them
      in small pieces.
    </figcaption>
  </figure>
</template>
