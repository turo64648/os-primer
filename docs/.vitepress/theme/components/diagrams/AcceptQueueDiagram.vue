<script setup lang="ts">
// A listening socket's two queues.
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 300" role="img" aria-label="Incoming SYNs wait in the SYN queue; completed handshakes move to the accept queue; the program takes them with accept()">
      <defs>
        <marker id="aq-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <rect x="10" y="70" width="110" height="70" rx="8" class="box" />
      <text x="65" y="100" text-anchor="middle" class="tb">Clients</text>
      <text x="65" y="120" text-anchor="middle" class="m">send SYN</text>

      <rect x="160" y="50" width="170" height="110" rx="8" class="box-d" />
      <text x="245" y="76" text-anchor="middle" class="tb">SYN queue</text>
      <text x="245" y="98" text-anchor="middle" class="m">half-open: SYN-ACK sent,</text>
      <text x="245" y="116" text-anchor="middle" class="m">waiting for the final ACK</text>
      <text x="245" y="142" text-anchor="middle" class="m mono">SYN_RECV</text>

      <rect x="370" y="50" width="150" height="110" rx="8" class="box-d" />
      <text x="445" y="76" text-anchor="middle" class="tb">Accept queue</text>
      <text x="445" y="98" text-anchor="middle" class="m">handshake done,</text>
      <text x="445" y="116" text-anchor="middle" class="m">waiting for accept()</text>
      <text x="445" y="142" text-anchor="middle" class="m mono">ESTABLISHED</text>

      <rect x="550" y="70" width="80" height="70" rx="8" class="box-a" />
      <text x="590" y="100" text-anchor="middle" class="tb">Your</text>
      <text x="590" y="120" text-anchor="middle" class="tb">program</text>

      <path d="M120 105 L158 105" class="ln" marker-end="url(#aq-ah)" />
      <path d="M330 105 L368 105" class="ln" marker-end="url(#aq-ah)" />
      <path d="M520 105 L548 105" class="ln-a" marker-end="url(#aq-ah)" />

      <text x="245" y="194" text-anchor="middle" class="t">Flood of fake SYNs fills it.</text>
      <text x="245" y="214" text-anchor="middle" class="m">Defence: SYN cookies, which keep</text>
      <text x="245" y="232" text-anchor="middle" class="m">no entry at all.</text>

      <text x="460" y="194" text-anchor="middle" class="t">Limit: the backlog.</text>
      <text x="460" y="214" text-anchor="middle" class="m">When full, new handshakes are</text>
      <text x="460" y="232" text-anchor="middle" class="m">dropped; clients retry after 1 s, 3 s…</text>

      <text x="320" y="280" text-anchor="middle" class="m">The kernel runs the whole handshake. The program only ever sees finished connections.</text>
    </svg>
    <figcaption>
      A listening socket's two queues. The kernel answers SYNs and completes handshakes on its own. Finished
      connections wait in the accept queue until the program calls <code>accept</code>. If the program is too
      slow, the accept queue fills and new clients are left retrying.
    </figcaption>
  </figure>
</template>
