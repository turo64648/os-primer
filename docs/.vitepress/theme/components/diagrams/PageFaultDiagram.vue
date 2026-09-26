<template>
  <figure class="figure">
    <svg viewBox="0 0 640 550" role="img" aria-label="Flowchart of a memory access, TLB miss and page fault handling">
      <defs>
        <marker id="pf-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <!-- main column -->
      <rect x="40" y="20" width="320" height="40" rx="8" class="box" />
      <text x="200" y="45" text-anchor="middle" class="t">CPU accesses a virtual address</text>

      <rect x="40" y="84" width="320" height="40" rx="8" class="box-a" />
      <text x="200" y="109" text-anchor="middle" class="tb">In the TLB?</text>

      <rect x="40" y="148" width="320" height="40" rx="8" class="box" />
      <text x="200" y="173" text-anchor="middle" class="t">Hardware walks the page table</text>

      <rect x="40" y="212" width="320" height="40" rx="8" class="box-a" />
      <text x="200" y="237" text-anchor="middle" class="tb">Entry present and access allowed?</text>

      <rect x="40" y="276" width="320" height="40" rx="8" class="box-d" />
      <text x="200" y="301" text-anchor="middle" class="tb">Page fault: trap into the kernel</text>

      <rect x="40" y="340" width="320" height="40" rx="8" class="box-a" />
      <text x="200" y="365" text-anchor="middle" class="tb">Address in a region the process owns?</text>

      <path d="M200 60 L200 84" class="ln" marker-end="url(#pf-ah)" />
      <path d="M200 124 L200 148" class="ln" marker-end="url(#pf-ah)" />
      <text x="208" y="141" class="m">no</text>
      <path d="M200 188 L200 212" class="ln" marker-end="url(#pf-ah)" />
      <path d="M200 252 L200 276" class="ln" marker-end="url(#pf-ah)" />
      <text x="208" y="269" class="m">no</text>
      <path d="M200 316 L200 340" class="ln" marker-end="url(#pf-ah)" />

      <!-- right column: outcomes -->
      <rect x="400" y="84" width="220" height="40" rx="8" class="box-c" />
      <text x="510" y="109" text-anchor="middle" class="t">Access RAM (fast path)</text>
      <path d="M360 104 L400 104" class="ln" marker-end="url(#pf-ah)" />
      <text x="366" y="98" class="m">yes</text>

      <rect x="400" y="212" width="220" height="40" rx="8" class="box-c" />
      <text x="510" y="237" text-anchor="middle" class="t">Fill TLB, access RAM</text>
      <path d="M360 232 L400 232" class="ln" marker-end="url(#pf-ah)" />
      <text x="366" y="226" class="m">yes</text>

      <rect x="400" y="340" width="220" height="40" rx="8" class="box-b" />
      <text x="510" y="365" text-anchor="middle" class="tb">Crash (SIGSEGV)</text>
      <path d="M360 360 L400 360" class="ln" marker-end="url(#pf-ah)" />
      <text x="370" y="354" class="m">no</text>

      <!-- fault kinds -->
      <path d="M200 380 L200 392 M130 392 L530 392" class="ln" />
      <path d="M130 392 L130 404 M330 392 L330 404 M530 392 L530 404" class="ln" marker-end="url(#pf-ah)" />
      <text x="208" y="389" class="m">yes</text>

      <rect x="40" y="404" width="180" height="64" rx="8" class="box" />
      <text x="130" y="426" text-anchor="middle" class="tb">Minor fault</text>
      <text x="130" y="444" text-anchor="middle" class="m">data already in RAM or</text>
      <text x="130" y="460" text-anchor="middle" class="m">a fresh zeroed page</text>

      <rect x="240" y="404" width="180" height="64" rx="8" class="box" />
      <text x="330" y="426" text-anchor="middle" class="tb">Major fault</text>
      <text x="330" y="444" text-anchor="middle" class="m">read from disk or swap</text>
      <text x="330" y="460" text-anchor="middle" class="m">(thread blocks, ~ms)</text>

      <rect x="440" y="404" width="180" height="64" rx="8" class="box" />
      <text x="530" y="426" text-anchor="middle" class="tb">Copy-on-write</text>
      <text x="530" y="444" text-anchor="middle" class="m">write to shared page:</text>
      <text x="530" y="460" text-anchor="middle" class="m">copy it, map it writable</text>

      <path d="M130 468 L130 492 M330 468 L330 492 M530 468 L530 492" class="ln" marker-end="url(#pf-ah)" />
      <rect x="40" y="492" width="580" height="40" rx="8" class="box-d" />
      <text x="330" y="517" text-anchor="middle" class="t">Kernel updates the page table; CPU re-runs the instruction</text>

      <!-- retry loop -->
      <path d="M40 512 L18 512 L18 40 L40 40" class="ln-dash" marker-end="url(#pf-ah)" />
    </svg>
    <figcaption>
      The whole path of one memory access. Everything above the purple fault box is done by the MMU in hardware;
      everything from the fault down is kernel software.
    </figcaption>
  </figure>
</template>
