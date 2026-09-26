<script setup lang="ts">
const fields = [
  { x: 20, w: 110, label: 'L4 index', bits: '9 bits', cls: 'box-a' },
  { x: 130, w: 110, label: 'L3 index', bits: '9 bits', cls: 'box-c' },
  { x: 240, w: 110, label: 'L2 index', bits: '9 bits', cls: 'box-d' },
  { x: 350, w: 110, label: 'L1 index', bits: '9 bits', cls: 'box-b' },
  { x: 460, w: 160, label: 'offset', bits: '12 bits', cls: 'box' },
]
const tables = [
  { x: 27, name: 'PML4', e: 190, cls: 'box-a' },
  { x: 137, name: 'PDPT', e: 232, cls: 'box-c' },
  { x: 247, name: 'PD', e: 205, cls: 'box-d' },
  { x: 357, name: 'PT', e: 250, cls: 'box-b' },
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 340" role="img" aria-label="Four-level x86-64 page table walk">
      <defs>
        <marker id="pw-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <text x="20" y="26" class="h">48-bit virtual address</text>
      <text x="20" y="96" class="m mono">47</text>
      <text x="620" y="96" text-anchor="end" class="m mono">0</text>
      <template v-for="f in fields" :key="f.label">
        <rect :x="f.x" y="40" :width="f.w" height="40" :class="f.cls" />
        <text :x="f.x + f.w / 2" y="58" text-anchor="middle" class="tb">{{ f.label }}</text>
        <text :x="f.x + f.w / 2" y="74" text-anchor="middle" class="m">{{ f.bits }}</text>
      </template>

      <!-- tables -->
      <template v-for="(t, i) in tables" :key="t.name">
        <rect :x="t.x" y="150" width="96" height="140" rx="4" class="box" />
        <text :x="t.x + 48" y="170" text-anchor="middle" class="tb">{{ t.name }}</text>
        <line v-for="r in 5" :key="r" :x1="t.x" :x2="t.x + 96" :y1="176 + r * 20" :y2="176 + r * 20" class="ln-dash" />
        <rect :x="t.x + 4" :y="t.e" width="88" height="18" rx="3" :class="t.cls" />
        <!-- index selects the entry -->
        <path :d="`M${t.x + 48} 80 L${t.x + 48} ${t.e}`" class="ln-dash" marker-end="url(#pw-ah)" />
        <!-- entry points to next table / frame -->
        <path
          :d="`M${t.x + 92} ${t.e + 9} L${t.x + 110 + (i === 3 ? 13 : 0)} ${t.e + 9}`"
          class="ln"
          marker-end="url(#pw-ah)"
        />
      </template>

      <!-- data page -->
      <rect x="480" y="150" width="140" height="140" rx="4" class="box" />
      <text x="550" y="170" text-anchor="middle" class="tb">4 KiB page</text>
      <rect x="484" y="262" width="132" height="18" rx="3" class="box-a" />
      <text x="550" y="275" text-anchor="middle" class="m">your byte</text>
      <path d="M540 80 L540 262" class="ln-dash" marker-end="url(#pw-ah)" />

      <path d="M40 318 L40 292" class="ln" marker-end="url(#pw-ah)" />
      <text x="50" y="324" class="m">CR3 register holds the physical address of the PML4 (one per process)</text>
    </svg>
    <figcaption>
      Each 9-bit index selects one of 512 eight-byte entries in a 4 KiB table. A TLB miss costs up to four
      dependent memory reads before the data read itself.
    </figcaption>
  </figure>
</template>
