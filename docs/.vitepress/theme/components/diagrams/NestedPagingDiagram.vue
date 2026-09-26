<template>
  <figure class="figure">
    <svg viewBox="0 0 640 300" role="img" aria-label="Two-stage address translation in a virtual machine: guest page tables, then the hypervisor's nested page tables">
      <defs>
        <marker id="np-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <rect x="20" y="30" width="170" height="60" rx="8" class="box-a" />
      <text x="105" y="56" text-anchor="middle" class="tb">Guest virtual</text>
      <text x="105" y="76" text-anchor="middle" class="m">what the app uses</text>

      <rect x="235" y="30" width="170" height="60" rx="8" class="box-b" />
      <text x="320" y="56" text-anchor="middle" class="tb">Guest "physical"</text>
      <text x="320" y="76" text-anchor="middle" class="m">what the guest thinks is RAM</text>

      <rect x="450" y="30" width="170" height="60" rx="8" class="box-c" />
      <text x="535" y="56" text-anchor="middle" class="tb">Host physical</text>
      <text x="535" y="76" text-anchor="middle" class="m">real RAM</text>

      <path d="M190 60 L233 60" class="ln" marker-end="url(#np-ah)" />
      <path d="M405 60 L448 60" class="ln" marker-end="url(#np-ah)" />

      <rect x="120" y="120" width="190" height="56" rx="8" class="box" />
      <text x="215" y="144" text-anchor="middle" class="t">Guest page tables</text>
      <text x="215" y="164" text-anchor="middle" class="m">written by the guest kernel</text>
      <path d="M212 120 L212 64" class="ln-dash" />

      <rect x="330" y="120" width="190" height="56" rx="8" class="box-d" />
      <text x="425" y="144" text-anchor="middle" class="t">Nested page tables</text>
      <text x="425" y="164" text-anchor="middle" class="m">written by the hypervisor</text>
      <path d="M427 120 L427 64" class="ln-dash" />

      <rect x="20" y="210" width="600" height="70" rx="8" class="ghost" />
      <text x="320" y="236" text-anchor="middle" class="t">The CPU walks both tables in hardware on a TLB miss.</text>
      <text x="320" y="258" text-anchor="middle" class="m">Each step of the guest walk needs its own walk of the nested tables,</text>
      <text x="320" y="274" text-anchor="middle" class="m">so one miss can cost up to 24 memory reads instead of 4.</text>
    </svg>
    <figcaption>
      Address translation inside a virtual machine. The TLB caches the final result, guest virtual to host
      physical, so most accesses skip both walks.
    </figcaption>
  </figure>
</template>
