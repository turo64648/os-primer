<script setup lang="ts">
// select/poll versus epoll: who keeps the list of watched sockets, and what crosses into the kernel.
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 350" role="img" aria-label="With poll the program passes every socket on every call; with epoll the kernel keeps the watch list and returns only ready sockets">
      <defs>
        <marker id="ep-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <text x="160" y="26" text-anchor="middle" class="h">select / poll</text>
      <text x="480" y="26" text-anchor="middle" class="h">epoll</text>
      <line x1="320" y1="12" x2="320" y2="340" class="ln-dash" />

      <!-- left: poll -->
      <rect x="20" y="44" width="280" height="56" rx="8" class="box-a" />
      <text x="160" y="67" text-anchor="middle" class="tb">Your program</text>
      <text x="160" y="87" text-anchor="middle" class="m">builds a list of all 10,000 sockets</text>

      <path d="M110 100 L110 176" class="ln-a" marker-end="url(#ep-ah)" />
      <text x="104" y="132" text-anchor="end" class="m">all 10,000</text>
      <text x="104" y="150" text-anchor="end" class="m">in</text>
      <path d="M210 176 L210 100" class="ln-a" marker-end="url(#ep-ah)" />
      <text x="216" y="132" class="m">all back,</text>
      <text x="216" y="150" class="m">3 marked ready</text>

      <rect x="20" y="176" width="280" height="80" rx="8" class="box-d" />
      <text x="160" y="202" text-anchor="middle" class="tb">Kernel</text>
      <text x="160" y="222" text-anchor="middle" class="m">checks every socket, every call,</text>
      <text x="160" y="240" text-anchor="middle" class="m">then forgets the list</text>

      <text x="160" y="296" text-anchor="middle" class="t">Work per call grows with</text>
      <text x="160" y="316" text-anchor="middle" class="t">sockets <tspan font-weight="700">watched</tspan></text>

      <!-- right: epoll -->
      <rect x="340" y="44" width="280" height="56" rx="8" class="box-a" />
      <text x="480" y="67" text-anchor="middle" class="tb">Your program</text>
      <text x="480" y="87" text-anchor="middle" class="m">tells the kernel about each socket once</text>

      <path d="M400 100 L400 176" class="ln-a" marker-end="url(#ep-ah)" />
      <text x="394" y="132" text-anchor="end" class="m">add</text>
      <text x="394" y="150" text-anchor="end" class="m">once</text>
      <path d="M540 176 L540 100" class="ln-a" marker-end="url(#ep-ah)" />
      <text x="546" y="132" class="m">only the</text>
      <text x="546" y="150" class="m">3 ready</text>

      <rect x="340" y="176" width="280" height="130" rx="8" class="box-d" />
      <text x="480" y="198" text-anchor="middle" class="tb">Kernel</text>
      <rect x="352" y="212" width="120" height="80" rx="6" class="box" />
      <text x="412" y="238" text-anchor="middle" class="t">Watch list</text>
      <text x="412" y="258" text-anchor="middle" class="m">10,000</text>
      <text x="412" y="276" text-anchor="middle" class="m">sockets</text>
      <rect x="490" y="212" width="120" height="80" rx="6" class="box-c" />
      <text x="550" y="238" text-anchor="middle" class="t">Ready list</text>
      <text x="550" y="258" text-anchor="middle" class="m">3 sockets</text>
      <path d="M472 252 L490 252" class="ln" marker-end="url(#ep-ah)" />

      <text x="480" y="326" text-anchor="middle" class="t">Work per call grows with sockets <tspan font-weight="700">ready</tspan></text>
    </svg>
    <figcaption>
      With select and poll, the program hands over the whole list on every call and the kernel scans all of it.
      With epoll, the kernel keeps the watch list. When data arrives on a socket, the kernel moves it to a
      ready list, and each wait returns only that list.
    </figcaption>
  </figure>
</template>
