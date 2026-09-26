<script setup lang="ts">
// Send path (down, left) and receive path (up, right) through the Linux network stack.
const send = [
  { t: 'write() / send()', m: 'copy into the socket send buffer', c: 'box-a' },
  { t: 'TCP', m: 'cut into segments, keep until ACKed', c: 'box-d' },
  { t: 'IP', m: 'pick a route, apply firewall rules', c: 'box-d' },
  { t: 'Queueing discipline', m: 'order and pace outgoing packets', c: 'box-d' },
  { t: 'Driver', m: 'put packet on the card’s send ring', c: 'box-d' },
  { t: 'Network card', m: 'reads the packet from RAM (DMA)', c: 'box' },
]
const recv = [
  { t: 'read() / recv()', m: 'copy into your buffer', c: 'box-a' },
  { t: 'Wake the reader', m: 'blocked read, or epoll', c: 'box-d' },
  { t: 'TCP', m: 'put in order, ACK, add to buffer', c: 'box-d' },
  { t: 'IP', m: 'is it for us? firewall rules', c: 'box-d' },
  { t: 'NAPI poll (softirq)', m: 'take a batch from the ring', c: 'box-d' },
  { t: 'Network card', m: 'writes packet to RAM, interrupt', c: 'box' },
]
const y = (i: number) => 40 + i * 58 + (i >= 1 ? 18 : 0) + (i >= 5 ? 18 : 0)
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 420" role="img" aria-label="The send path goes down from write through TCP, IP, queueing and the driver to the network card. The receive path goes up from the card through NAPI, IP and TCP to read.">
      <defs>
        <marker id="pp-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>
      <text x="160" y="26" text-anchor="middle" class="h">Sending</text>
      <text x="480" y="26" text-anchor="middle" class="h">Receiving</text>
      <template v-for="(s, i) in send" :key="'s' + i">
        <rect x="15" :y="y(i)" width="290" height="46" rx="8" :class="s.c" />
        <text x="160" :y="y(i) + 19" text-anchor="middle" class="tb">{{ s.t }}</text>
        <text x="160" :y="y(i) + 37" text-anchor="middle" class="m">{{ s.m }}</text>
        <path v-if="i < send.length - 1" :d="`M160 ${y(i) + 46} L160 ${y(i + 1) - 1}`" class="ln" marker-end="url(#pp-ah)" />
      </template>
      <template v-for="(r, i) in recv" :key="'r' + i">
        <rect x="335" :y="y(i)" width="290" height="46" rx="8" :class="r.c" />
        <text x="480" :y="y(i) + 19" text-anchor="middle" class="tb">{{ r.t }}</text>
        <text x="480" :y="y(i) + 37" text-anchor="middle" class="m">{{ r.m }}</text>
        <path v-if="i < recv.length - 1" :d="`M480 ${y(i + 1)} L480 ${y(i) + 47}`" class="ln" marker-end="url(#pp-ah)" />
      </template>
      <line x1="10" :y1="y(1) - 15" x2="250" :y2="y(1) - 15" class="ln-dash" />
      <line x1="390" :y1="y(1) - 15" x2="630" :y2="y(1) - 15" class="ln-dash" />
      <text x="320" :y="y(1) - 10" text-anchor="middle" class="m">user ↑  kernel ↓</text>
      <line x1="10" :y1="y(5) - 15" x2="250" :y2="y(5) - 15" class="ln-dash" />
      <line x1="390" :y1="y(5) - 15" x2="630" :y2="y(5) - 15" class="ln-dash" />
      <text x="320" :y="y(5) - 10" text-anchor="middle" class="m">kernel ↑  hardware ↓</text>
    </svg>
    <figcaption>
      The path of data through the Linux network stack. Sending goes down on the left; receiving comes up on the
      right. Everything between the two dashed lines runs in the kernel. <code>write</code> returns once the data
      is in the send buffer, long before it reaches the wire.
    </figcaption>
  </figure>
</template>
