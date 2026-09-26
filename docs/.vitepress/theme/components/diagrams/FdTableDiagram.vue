<script setup lang="ts">
// Three levels: per-process descriptor tables, shared open file descriptions, inodes.
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 350" role="img" aria-label="Descriptors in each process point to open files in the kernel, which point to inodes. After fork, parent and child share one open file and its offset.">
      <defs>
        <marker id="fd-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <text x="100" y="24" text-anchor="middle" class="h">Descriptor tables</text>
      <text x="100" y="42" text-anchor="middle" class="m">one per process</text>
      <text x="340" y="24" text-anchor="middle" class="h">Open files</text>
      <text x="340" y="42" text-anchor="middle" class="m">shared, in the kernel</text>
      <text x="550" y="24" text-anchor="middle" class="h">Inodes</text>
      <text x="550" y="42" text-anchor="middle" class="m">the files themselves</text>

      <!-- process A -->
      <rect x="10" y="60" width="180" height="118" rx="8" class="box-a" />
      <text x="100" y="82" text-anchor="middle" class="tb">Parent process</text>
      <rect x="24" y="94" width="152" height="30" rx="4" class="box" />
      <text x="36" y="114" class="t mono">fd 3</text>
      <rect x="24" y="134" width="152" height="30" rx="4" class="box" />
      <text x="36" y="154" class="t mono">fd 4</text>

      <!-- process B -->
      <rect x="10" y="210" width="180" height="78" rx="8" class="box-a" />
      <text x="100" y="232" text-anchor="middle" class="tb">Child (after fork)</text>
      <rect x="24" y="244" width="152" height="30" rx="4" class="box" />
      <text x="36" y="264" class="t mono">fd 3</text>

      <!-- open file descriptions -->
      <rect x="250" y="80" width="180" height="84" rx="8" class="box-d" />
      <text x="340" y="104" text-anchor="middle" class="tb">Open file #1</text>
      <text x="340" y="126" text-anchor="middle" class="m">offset: 4096</text>
      <text x="340" y="146" text-anchor="middle" class="m">mode: read + write</text>

      <rect x="250" y="200" width="180" height="84" rx="8" class="box-d" />
      <text x="340" y="224" text-anchor="middle" class="tb">Open file #2</text>
      <text x="340" y="246" text-anchor="middle" class="m">offset: 0</text>
      <text x="340" y="266" text-anchor="middle" class="m">mode: read only</text>

      <!-- inode -->
      <rect x="480" y="130" width="140" height="84" rx="8" class="box-c" />
      <text x="550" y="156" text-anchor="middle" class="tb">Inode 812</text>
      <text x="550" y="178" text-anchor="middle" class="m">size, owner,</text>
      <text x="550" y="196" text-anchor="middle" class="m">data location</text>

      <path d="M176 109 L248 112" class="ln-a" marker-end="url(#fd-ah)" />
      <path d="M176 259 C 215 259, 215 140, 248 136" class="ln-a" marker-end="url(#fd-ah)" />
      <path d="M176 149 C 215 149, 215 230, 248 234" class="ln-a" marker-end="url(#fd-ah)" />
      <path d="M430 122 L478 160" class="ln" marker-end="url(#fd-ah)" />
      <path d="M430 242 L478 190" class="ln" marker-end="url(#fd-ah)" />

      <text x="320" y="318" text-anchor="middle" class="m">fd 3 in both processes shares open file #1, so they share one offset.</text>
      <text x="320" y="336" text-anchor="middle" class="m">fd 4 came from a second open() of the same file: its own offset.</text>
    </svg>
    <figcaption>
      Three levels. A file descriptor is an index into the process's own table. It points to an open file in
      the kernel, which holds the current offset and mode. That points to the inode. <code>fork</code> and
      <code>dup</code> share an open file; a second <code>open</code> creates a new one.
    </figcaption>
  </figure>
</template>
