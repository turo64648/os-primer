<script setup lang="ts">
// Closing a TCP connection: states on each side and the four messages between them.
const left = [
  { y: 50, t: 'ESTABLISHED' },
  { y: 110, t: 'FIN_WAIT_1' },
  { y: 170, t: 'FIN_WAIT_2' },
  { y: 250, t: 'TIME_WAIT' },
  { y: 330, t: 'CLOSED' },
]
const right = [
  { y: 50, t: 'ESTABLISHED' },
  { y: 130, t: 'CLOSE_WAIT' },
  { y: 230, t: 'LAST_ACK' },
  { y: 330, t: 'CLOSED' },
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 380" role="img" aria-label="TCP close: the side that closes first goes through FIN_WAIT to TIME_WAIT; the other side goes through CLOSE_WAIT and LAST_ACK">
      <defs>
        <marker id="tc-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>
      <text x="110" y="26" text-anchor="middle" class="h">Closes first</text>
      <text x="530" y="26" text-anchor="middle" class="h">Other side</text>


      <template v-for="s in left" :key="'l' + s.t">
        <rect x="30" :y="s.y" width="160" height="30" rx="6" :class="s.t === 'TIME_WAIT' ? 'box-b' : 'box-a'" />
        <text x="110" :y="s.y + 20" text-anchor="middle" class="t mono">{{ s.t }}</text>
      </template>
      <template v-for="s in right" :key="'r' + s.t">
        <rect x="450" :y="s.y" width="160" height="30" rx="6" :class="s.t === 'CLOSE_WAIT' ? 'box-b' : 'box-a'" />
        <text x="530" :y="s.y + 20" text-anchor="middle" class="t mono">{{ s.t }}</text>
      </template>

      <!-- messages -->
      <path d="M192 104 L448 132" class="ln-a" marker-end="url(#tc-ah)" />
      <text x="320" y="108" text-anchor="middle" class="tb">FIN</text>
      <path d="M448 150 L192 172" class="ln-a" marker-end="url(#tc-ah)" />
      <text x="320" y="152" text-anchor="middle" class="tb">ACK</text>
      <path d="M448 226 L192 252" class="ln-a" marker-end="url(#tc-ah)" />
      <text x="320" y="228" text-anchor="middle" class="tb">FIN</text>
      <path d="M192 272 L448 318" class="ln-a" marker-end="url(#tc-ah)" />
      <text x="320" y="286" text-anchor="middle" class="tb">ACK</text>

      <text x="530" y="182" text-anchor="middle" class="m">waits for the program</text>
      <text x="530" y="200" text-anchor="middle" class="m">to call close()</text>
      <text x="110" y="300" text-anchor="middle" class="m">waits 60 s on Linux</text>
      <text x="110" y="318" text-anchor="middle" class="m">(2 × max packet lifetime)</text>
      <text x="110" y="100" text-anchor="middle" class="m">close()</text>
    </svg>
    <figcaption>
      Closing a TCP connection takes four messages, one FIN and one ACK in each direction. The side that closes
      first ends in <code>TIME_WAIT</code> for a while. The other side sits in <code>CLOSE_WAIT</code> until its
      program calls <code>close</code>, which a buggy program may never do.
    </figcaption>
  </figure>
</template>
