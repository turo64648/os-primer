<template>
  <figure class="figure">
    <svg viewBox="0 0 640 295" role="img" aria-label="Two NUMA nodes, each with its own cores and local memory, joined by an interconnect. Local access is faster than remote access.">
      <defs>
        <marker id="nu-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <rect x="20" y="20" width="250" height="210" rx="10" class="ghost" />
      <text x="145" y="44" text-anchor="middle" class="h">Node 0</text>
      <rect x="40" y="60" width="210" height="50" rx="8" class="box-a" />
      <text x="145" y="82" text-anchor="middle" class="tb">Cores 0–31</text>
      <text x="145" y="100" text-anchor="middle" class="m">with their caches</text>
      <rect x="40" y="160" width="210" height="50" rx="8" class="box" />
      <text x="145" y="190" text-anchor="middle" class="t">Local RAM</text>
      <path d="M145 110 L145 158" class="ln" marker-end="url(#nu-ah)" />
      <text x="153" y="140" class="m">local: fast</text>

      <rect x="370" y="20" width="250" height="210" rx="10" class="ghost" />
      <text x="495" y="44" text-anchor="middle" class="h">Node 1</text>
      <rect x="390" y="60" width="210" height="50" rx="8" class="box-b" />
      <text x="495" y="82" text-anchor="middle" class="tb">Cores 32–63</text>
      <text x="495" y="100" text-anchor="middle" class="m">with their caches</text>
      <rect x="390" y="160" width="210" height="50" rx="8" class="box" />
      <text x="495" y="190" text-anchor="middle" class="t">Local RAM</text>
      <path d="M495 110 L495 158" class="ln" />

      <path d="M270 125 L370 125" class="ln" />
      <rect x="285" y="107" width="70" height="36" rx="6" class="box-d" />
      <text x="320" y="130" text-anchor="middle" class="m">link</text>

      <text x="320" y="258" text-anchor="middle" class="t">A core reaching the other node's RAM crosses the link:</text>
      <text x="320" y="280" text-anchor="middle" class="m">roughly 1.5–2× the latency of local memory, and less bandwidth</text>
    </svg>
    <figcaption>
      A two-socket server has two NUMA nodes. Every core can reach all memory, but memory attached to its own
      node is faster. The core counts are an example.
    </figcaption>
  </figure>
</template>
