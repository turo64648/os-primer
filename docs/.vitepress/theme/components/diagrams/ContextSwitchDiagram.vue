<script setup lang="ts">
// A context switch from thread A to thread B, step by step (left),
// with what is saved and what is only disturbed (right).
const steps = [
  { title: '1. Enter the kernel', note: 'timer tick, or A blocks in a system call' },
  { title: "2. Save A's registers", note: "into A's record in the kernel" },
  { title: '3. Scheduler picks a thread', note: 'B: the best runnable thread here' },
  { title: '4. Switch the memory view', note: 'only if B is in a different process' },
  { title: "5. Load B's registers", note: 'return to user mode where B stopped' },
]
const y = (i: number) => 66 + i * 54
const saved = [
  'general-purpose registers',
  'instruction pointer (where it was)',
  'stack pointer',
  'floating-point and vector registers',
  'thread-local storage pointer',
]
const disturbed = [
  "CPU caches fill with B's data",
  'TLB entries, if B is another process',
  'branch predictor history',
  'so A runs slower when it returns',
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 400" role="img" aria-label="The steps of a context switch from thread A to thread B, what the kernel saves, and what is only disturbed">
      <defs>
        <marker id="cs-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <rect x="20" y="10" width="300" height="36" rx="6" class="box-a" />
      <text x="170" y="33" text-anchor="middle" class="tb">Thread A runs (user mode)</text>

      <template v-for="(s, i) in steps" :key="i">
        <rect x="20" :y="y(i)" width="300" height="44" rx="6" :class="i === 3 ? 'ghost' : 'box-d'" />
        <text x="32" :y="y(i) + 19" class="tb">{{ s.title }}</text>
        <text x="32" :y="y(i) + 37" class="m">{{ s.note }}</text>
        <path v-if="i < steps.length - 1" :d="`M170 ${y(i) + 44} L170 ${y(i + 1)}`" class="ln" marker-end="url(#cs-ah)" />
      </template>
      <path d="M170 46 L170 66" class="ln" marker-end="url(#cs-ah)" />
      <path :d="`M170 ${y(4) + 44} L170 350`" class="ln-a" marker-end="url(#cs-ah)" />

      <rect x="20" y="350" width="300" height="36" rx="6" class="box-c" />
      <text x="170" y="373" text-anchor="middle" class="tb">Thread B runs (user mode)</text>

      <!-- what is saved -->
      <rect x="350" y="66" width="270" height="152" rx="8" class="box" />
      <text x="364" y="90" class="tb">Saved and restored</text>
      <text v-for="(s, i) in saved" :key="'s' + i" x="364" :y="116 + i * 22" class="m">{{ s }}</text>
      <path d="M320 142 L350 142" class="ln-dash" />

      <!-- what is disturbed -->
      <rect x="350" y="236" width="270" height="150" rx="8" class="box-b" />
      <text x="364" y="260" class="tb">Not saved, only disturbed</text>
      <text v-for="(s, i) in disturbed" :key="'d' + i" x="364" :y="286 + i * 24" class="m">{{ s }}</text>
    </svg>
    <figcaption>
      A context switch from thread A to thread B on one core. The purple steps run in the kernel. The kernel
      saves and restores the registers exactly; the warm caches are not saved, which is the hidden cost.
    </figcaption>
  </figure>
</template>
