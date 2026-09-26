<script setup lang="ts">
// Monolithic kernel vs microkernel: what runs in kernel mode.
const monoParts = ['File systems', 'Network stack', 'Device drivers', 'Scheduling, memory, IPC']
const servers = [
  { x: 340, label: 'File system' },
  { x: 436, label: 'Network' },
  { x: 532, label: 'Driver' },
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 450" role="img" aria-label="A monolithic kernel runs all services in kernel mode; a microkernel moves them into user-mode server processes">
      <text x="160" y="24" text-anchor="middle" class="h">Monolithic (Linux)</text>
      <text x="480" y="24" text-anchor="middle" class="h">Microkernel (seL4, QNX)</text>
      <line x1="320" y1="10" x2="320" y2="440" class="ln-dash" />

      <!-- user-mode labels and boundary -->
      <text x="20" y="48" class="m">user mode</text>
      <text x="340" y="48" class="m">user mode</text>
      <line x1="10" y1="180" x2="310" y2="180" class="ln" />
      <line x1="330" y1="180" x2="630" y2="180" class="ln" />
      <text x="20" y="200" class="m">kernel mode</text>
      <text x="340" y="200" class="m">kernel mode</text>

      <!-- monolithic: user side -->
      <rect x="25" y="60" width="125" height="36" rx="6" class="box-a" />
      <text x="87" y="83" text-anchor="middle" class="t">App</text>
      <rect x="165" y="60" width="125" height="36" rx="6" class="box-a" />
      <text x="227" y="83" text-anchor="middle" class="t">App</text>
      <text x="160" y="130" text-anchor="middle" class="m">shells, libc, daemons:</text>
      <text x="160" y="148" text-anchor="middle" class="m">all ordinary programs</text>

      <!-- monolithic: one big kernel -->
      <rect x="20" y="210" width="280" height="176" rx="8" class="box-d" />
      <text x="160" y="232" text-anchor="middle" class="tb">One kernel program</text>
      <template v-for="(p, i) in monoParts" :key="p">
        <rect x="40" :y="244 + i * 34" width="240" height="28" rx="4" class="box" />
        <text x="160" :y="263 + i * 34" text-anchor="middle" class="t">{{ p }}</text>
      </template>
      <text x="160" y="410" text-anchor="middle" class="m">read(): one trip into the kernel</text>
      <text x="160" y="430" text-anchor="middle" class="m">a driver bug can crash everything</text>

      <!-- microkernel: user side holds the services -->
      <rect x="345" y="60" width="270" height="36" rx="6" class="box-a" />
      <text x="480" y="83" text-anchor="middle" class="t">App</text>
      <template v-for="s in servers" :key="s.label">
        <rect :x="s.x" y="118" width="88" height="40" rx="6" class="box-c" />
        <text :x="s.x + 44" y="143" text-anchor="middle" class="m">{{ s.label }}</text>
      </template>

      <!-- microkernel: small kernel -->
      <rect x="340" y="210" width="280" height="64" rx="8" class="box-d" />
      <text x="480" y="236" text-anchor="middle" class="tb">Small kernel</text>
      <text x="480" y="258" text-anchor="middle" class="m">threads, memory, messages (IPC)</text>
      <text x="480" y="300" text-anchor="middle" class="m">read(): app → kernel → file system</text>
      <text x="480" y="318" text-anchor="middle" class="m">→ kernel → driver → and back</text>
      <text x="480" y="346" text-anchor="middle" class="m">a crashed driver can be restarted</text>
    </svg>
    <figcaption>
      The difference is where services run. A monolithic kernel runs them all in kernel mode, so calls between
      them are cheap function calls. A microkernel runs them as separate user-mode processes that talk through
      messages, which is safer but crosses the boundary more often.
    </figcaption>
  </figure>
</template>
