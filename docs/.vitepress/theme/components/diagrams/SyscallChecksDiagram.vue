<script setup lang="ts">
// The checks a system call passes through before the kernel does the work.
const steps = [
  { title: 'Process makes a system call', note: 'for example open("/etc/shadow")', cls: 'box-a', deny: '' },
  { title: '1. seccomp filter', note: 'is this system call allowed at all?', cls: 'box-b', deny: 'EPERM or killed' },
  { title: '2. Ordinary permissions', note: 'user IDs, file mode bits, capabilities', cls: 'box-b', deny: 'EACCES or EPERM' },
  { title: '3. Security module (LSM)', note: 'SELinux or AppArmor policy', cls: 'box-b', deny: 'EACCES' },
  { title: 'The kernel does the work', note: 'inside this process\'s namespaces and cgroup limits', cls: 'box-c', deny: '' },
]
const row = (i: number) => 20 + i * 72
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 380" role="img" aria-label="A system call passes a seccomp filter, then ordinary permission checks, then a security module, before the kernel does the work. Each check can refuse the call">
      <defs>
        <marker id="scc-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>
      <template v-for="(s, i) in steps" :key="s.title">
        <rect x="20" :y="row(i)" width="400" height="52" rx="8" :class="s.cls" />
        <text x="36" :y="row(i) + 22" class="tb">{{ s.title }}</text>
        <text x="36" :y="row(i) + 42" class="m">{{ s.note }}</text>
        <path v-if="i < steps.length - 1" :d="`M220 ${row(i) + 52} L220 ${row(i + 1)}`" class="ln" marker-end="url(#scc-ah)" />
        <template v-if="s.deny">
          <path :d="`M420 ${row(i) + 26} L470 ${row(i) + 26}`" class="ln-dash" marker-end="url(#scc-ah)" />
          <rect x="470" :y="row(i) + 8" width="150" height="36" rx="6" class="box-d" />
          <text x="545" :y="row(i) + 31" text-anchor="middle" class="m">{{ s.deny }}</text>
        </template>
      </template>
      <text x="545" y="46" text-anchor="middle" class="m">refused?</text>
    </svg>
    <figcaption>
      Every layer can refuse a system call before any work happens. The layers are independent: a process
      running as root can still be stopped by a seccomp filter or a security module.
    </figcaption>
  </figure>
</template>
