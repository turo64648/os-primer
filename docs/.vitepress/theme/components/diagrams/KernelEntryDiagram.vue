<script setup lang="ts">
// Three ways into the kernel: interrupt, exception, trap.
// Each panel: a row of instructions, the kernel below, arrows showing where the CPU leaves and returns.
const bx = [20, 110, 200, 290] // x of the four instruction boxes, each 80 wide
const panels = [
  {
    y: 0,
    title: 'Interrupt: something outside needs attention',
    instr: ['mov', 'add', 'cmp', 'jmp'],
    special: -1,
    downX: 195, // between instruction 2 and 3
    upX: 240, // back to instruction 3
    downLabel: 'from a device',
    notes: ['Cause: a device, a timer,', 'or another CPU core', 'Arrives: at any moment', 'Returns: to where it was'],
  },
  {
    y: 160,
    title: 'Exception: this instruction went wrong',
    instr: ['mov', 'load', 'add', 'jmp'],
    special: 1,
    specialClass: 'box-b',
    downX: 140,
    upX: 170, // back to the same instruction
    downLabel: '',
    notes: ['Cause: the instruction failed', 'e.g. page fault, divide by 0', 'Returns: runs it again,', 'or kills the process'],
  },
  {
    y: 320,
    title: 'Trap: the program asks on purpose',
    instr: ['mov', 'syscall', 'cmp', 'jmp'],
    special: 1,
    specialClass: 'box-d',
    downX: 150,
    upX: 240, // on to the next instruction
    downLabel: '',
    notes: ['Cause: a special instruction', 'e.g. syscall, breakpoint', 'Returns: to the next', 'instruction'],
  },
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 480" role="img" aria-label="Interrupts, exceptions and traps: where each one comes from and where the CPU returns afterwards">
      <defs>
        <marker id="ke-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <template v-for="p in panels" :key="p.y">
        <text x="20" :y="p.y + 20" class="tb">{{ p.title }}</text>

        <!-- the program's instructions, in order -->
        <template v-for="(ins, i) in p.instr" :key="p.y + '-' + i">
          <rect :x="bx[i]" :y="p.y + 32" width="80" height="34" rx="6"
                :class="i === p.special ? p.specialClass : 'box'" />
          <text :x="bx[i] + 40" :y="p.y + 54" text-anchor="middle" class="t mono">{{ ins }}</text>
        </template>
        <path :d="`M370 ${p.y + 49} L384 ${p.y + 49}`" class="ln-dash" />

        <!-- the kernel -->
        <rect x="20" :y="p.y + 106" width="350" height="34" rx="6" class="box-d" />
        <text x="195" :y="p.y + 128" text-anchor="middle" class="tb">Kernel handler runs</text>

        <!-- leave and return -->
        <path :d="`M${p.downX} ${p.y + 66} L${p.downX} ${p.y + 106}`" class="ln" marker-end="url(#ke-ah)" />
        <path :d="`M${p.upX} ${p.y + 106} L${p.upX} ${p.y + 66}`" class="ln-a" marker-end="url(#ke-ah)" />
        <text v-if="p.downLabel" :x="p.downX + 52" :y="p.y + 90" class="m">{{ p.downLabel }}</text>

        <!-- notes -->
        <rect x="400" :y="p.y + 32" width="220" height="108" rx="8" class="box" />
        <text v-for="(n, j) in p.notes" :key="j" x="412" :y="p.y + 56 + j * 22" class="m">{{ n }}</text>
      </template>
    </svg>
    <figcaption>
      Three ways the CPU enters the kernel. Black arrows go into the kernel; blue arrows show where the program
      continues. An interrupt has nothing to do with the current instruction. An exception and a trap are caused
      by it.
    </figcaption>
  </figure>
</template>
