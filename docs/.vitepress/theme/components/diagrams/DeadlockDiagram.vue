<script setup lang="ts">
// Two threads, two locks, a cycle of "holds" and "waits for" (left),
// and the order of events that produces it (right).
const steps = [
  '1. T1 locks A',
  '2. T2 locks B',
  '3. T1 wants B: waits for T2',
  '4. T2 wants A: waits for T1',
  'Neither can continue, ever.',
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 290" role="img" aria-label="A deadlock: thread 1 holds lock A and waits for lock B, while thread 2 holds lock B and waits for lock A">
      <defs>
        <marker id="dl-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <!-- locks -->
      <rect x="120" y="24" width="100" height="40" rx="20" class="box-c" />
      <text x="170" y="49" text-anchor="middle" class="tb">lock A</text>
      <rect x="120" y="196" width="100" height="40" rx="20" class="box-c" />
      <text x="170" y="221" text-anchor="middle" class="tb">lock B</text>

      <!-- threads -->
      <rect x="20" y="110" width="100" height="40" rx="6" class="box-a" />
      <text x="70" y="135" text-anchor="middle" class="tb">T1</text>
      <rect x="220" y="110" width="100" height="40" rx="6" class="box-a" />
      <text x="270" y="135" text-anchor="middle" class="tb">T2</text>

      <!-- held by (black) and waits for (orange) -->
      <path d="M135 64 L90 108" class="ln" marker-end="url(#dl-ah)" />
      <path d="M90 152 L135 194" class="ln-b" stroke-dasharray="6 4" marker-end="url(#dl-ah)" />
      <path d="M205 194 L250 152" class="ln" marker-end="url(#dl-ah)" />
      <path d="M250 108 L205 66" class="ln-b" stroke-dasharray="6 4" marker-end="url(#dl-ah)" />

      <line x1="20" y1="262" x2="50" y2="262" class="ln" />
      <text x="58" y="266" class="m">lock is held by thread</text>
      <line x1="200" y1="262" x2="230" y2="262" class="ln-b" stroke-dasharray="6 4" />
      <text x="238" y="266" class="m">thread waits for lock</text>

      <!-- sequence -->
      <rect x="360" y="24" width="260" height="212" rx="8" class="box" />
      <text x="374" y="50" class="tb">How it happens</text>
      <text v-for="(s, i) in steps" :key="i" x="374" :y="84 + i * 32" :class="i === 4 ? 'tb' : 't'">{{ s }}</text>
    </svg>
    <figcaption>
      A deadlock. Each thread holds one lock and waits for the other's. Following the arrows gives a cycle:
      T1 → B → T2 → A → T1.
    </figcaption>
  </figure>
</template>
