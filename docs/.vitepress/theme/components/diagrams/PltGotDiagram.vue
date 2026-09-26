<script setup lang="ts">
// A call to a shared-library function through the PLT and GOT, with lazy binding.
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 310" role="img" aria-label="Your code calls a small stub, the PLT entry, which jumps to the address stored in a GOT slot. On the first call the slot leads to the loader's resolver, which fills in the real address of puts; later calls go straight to puts">
      <defs>
        <marker id="plt-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <text x="20" y="24" class="m">in your program</text>
      <text x="440" y="24" class="m">in your program (writable)</text>

      <rect x="20" y="40" width="180" height="64" rx="8" class="box-a" />
      <text x="110" y="66" text-anchor="middle" class="tb">Your code</text>
      <text x="110" y="88" text-anchor="middle" class="m mono">call puts@plt</text>

      <rect x="230" y="40" width="180" height="64" rx="8" class="box-a" />
      <text x="320" y="66" text-anchor="middle" class="tb">PLT stub for puts</text>
      <text x="320" y="88" text-anchor="middle" class="m">jump to address in slot</text>

      <rect x="440" y="40" width="180" height="64" rx="8" class="box-b" />
      <text x="530" y="66" text-anchor="middle" class="tb">GOT slot for puts</text>
      <text x="530" y="88" text-anchor="middle" class="m">holds an address</text>

      <rect x="60" y="200" width="280" height="70" rx="8" class="box-d" />
      <text x="200" y="224" text-anchor="middle" class="tb">Resolver in ld.so</text>
      <text x="200" y="244" text-anchor="middle" class="m">finds puts in libc and writes</text>
      <text x="200" y="260" text-anchor="middle" class="m">its address into the slot</text>

      <rect x="440" y="200" width="180" height="70" rx="8" class="box-c" />
      <text x="530" y="230" text-anchor="middle" class="tb">puts</text>
      <text x="530" y="250" text-anchor="middle" class="m">inside libc.so.6</text>

      <path d="M200 72 L230 72" class="ln" marker-end="url(#plt-ah)" />
      <path d="M410 72 L440 72" class="ln" marker-end="url(#plt-ah)" />

      <!-- later calls -->
      <path d="M560 104 L560 200" class="ln-a" marker-end="url(#plt-ah)" />
      <text x="570" y="146" class="m">every</text>
      <text x="570" y="162" class="m">later call</text>

      <!-- first call -->
      <path d="M470 104 L300 200" class="ln-dash" marker-end="url(#plt-ah)" />
      <text x="340" y="136" text-anchor="end" class="m">first call only:</text>
      <text x="340" y="152" text-anchor="end" class="m">the slot still leads</text>
      <text x="340" y="168" text-anchor="end" class="m">to the resolver</text>

      <path d="M340 235 L440 235" class="ln-dash" marker-end="url(#plt-ah)" />
      <text x="390" y="292" text-anchor="middle" class="m">then jumps to puts</text>
      <path d="M390 240 L390 278" class="ln-dash" />
    </svg>
    <figcaption>
      Lazy binding. The code never contains the address of <code>puts</code>; it goes through a slot that the
      loader fills in. With "bind now", the default on many distributions, every slot is filled at startup
      and the dashed path is never taken.
    </figcaption>
  </figure>
</template>
