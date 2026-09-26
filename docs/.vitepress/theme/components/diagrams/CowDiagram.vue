<template>
  <figure class="figure">
    <svg viewBox="0 0 640 300" role="img" aria-label="Copy-on-write: after fork parent and child share one read-only frame; after the child writes, it gets its own copy">
      <defs>
        <marker id="cow-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <!-- left panel: right after fork -->
      <text x="160" y="30" text-anchor="middle" class="h">1. Right after fork</text>
      <rect x="20" y="60" width="120" height="50" rx="8" class="box-a" />
      <text x="80" y="82" text-anchor="middle" class="tb">Parent</text>
      <text x="80" y="100" text-anchor="middle" class="m">read-only</text>
      <rect x="20" y="170" width="120" height="50" rx="8" class="box-b" />
      <text x="80" y="192" text-anchor="middle" class="tb">Child</text>
      <text x="80" y="210" text-anchor="middle" class="m">read-only</text>
      <rect x="190" y="115" width="110" height="50" rx="8" class="box" />
      <text x="245" y="137" text-anchor="middle" class="tb">Frame 7</text>
      <text x="245" y="155" text-anchor="middle" class="m">2 users</text>
      <path d="M140 85 C 165 85, 165 130, 188 132" class="ln-a" marker-end="url(#cow-ah)" />
      <path d="M140 195 C 165 195, 165 150, 188 148" class="ln-b" marker-end="url(#cow-ah)" />

      <line x1="320" y1="20" x2="320" y2="250" class="ln-dash" />

      <!-- right panel: after the child writes -->
      <text x="480" y="30" text-anchor="middle" class="h">2. After the child writes</text>
      <rect x="340" y="60" width="120" height="50" rx="8" class="box-a" />
      <text x="400" y="82" text-anchor="middle" class="tb">Parent</text>
      <text x="400" y="100" text-anchor="middle" class="m">read-only</text>
      <rect x="340" y="170" width="120" height="50" rx="8" class="box-b" />
      <text x="400" y="192" text-anchor="middle" class="tb">Child</text>
      <text x="400" y="210" text-anchor="middle" class="m">writable</text>
      <rect x="510" y="60" width="110" height="50" rx="8" class="box" />
      <text x="565" y="82" text-anchor="middle" class="tb">Frame 7</text>
      <text x="565" y="100" text-anchor="middle" class="m">1 user</text>
      <rect x="510" y="170" width="110" height="50" rx="8" class="box-c" />
      <text x="565" y="192" text-anchor="middle" class="tb">Frame 9</text>
      <text x="565" y="210" text-anchor="middle" class="m">new copy</text>
      <path d="M460 85 L508 85" class="ln-a" marker-end="url(#cow-ah)" />
      <path d="M460 195 L508 195" class="ln-b" marker-end="url(#cow-ah)" />

      <text x="320" y="285" text-anchor="middle" class="m">The child's write faulted. The kernel copied the page, then re-ran the write.</text>
    </svg>
    <figcaption>
      Copy-on-write for one page. If the parent writes next, the kernel sees that Frame 7 has only one user left
      and makes it writable again without copying.
    </figcaption>
  </figure>
</template>
