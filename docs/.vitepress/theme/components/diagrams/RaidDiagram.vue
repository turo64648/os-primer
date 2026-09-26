<script setup lang="ts">
// Four RAID layouts. Each column is a disk; each cell is a chunk of data (P = parity).
const panels = [
  { x: 10, title: 'RAID 0', sub: 'striping', disks: [['A1', 'A3'], ['A2', 'A4']], n1: 'fast, full capacity', n2: 'any failure: all lost' },
  { x: 170, title: 'RAID 1', sub: 'mirroring', disks: [['A1', 'A2'], ['A1', 'A2']], n1: 'half capacity', n2: 'survives 1 disk' },
  { x: 330, title: 'RAID 5', sub: 'striping + parity', disks: [['A1', 'B1', 'P'], ['A2', 'P', 'C1'], ['P', 'B2', 'C2']], n1: 'loses 1 disk to parity', n2: 'survives 1 disk' },
  { x: 490, title: 'RAID 10', sub: 'striped mirrors', disks: [['A1', 'A3'], ['A1', 'A3'], ['A2', 'A4'], ['A2', 'A4']], n1: 'half capacity', n2: '1 per mirror pair' },
]
const W = 140
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 260" role="img" aria-label="RAID 0, 1, 5 and 10 layouts, showing how data chunks and parity are spread over disks">
      <template v-for="p in panels" :key="p.title">
        <text :x="p.x + W / 2" y="24" text-anchor="middle" class="tb">{{ p.title }}</text>
        <text :x="p.x + W / 2" y="42" text-anchor="middle" class="m">{{ p.sub }}</text>
        <template v-for="(d, di) in p.disks" :key="p.title + di">
          <rect :x="p.x + di * (W / p.disks.length) + 3" y="54" :width="W / p.disks.length - 6" height="136" rx="6" class="box" />
          <template v-for="(c, ci) in d" :key="p.title + di + ci">
            <rect :x="p.x + di * (W / p.disks.length) + 7" :y="62 + ci * 40" :width="W / p.disks.length - 14" height="32" rx="3" :class="c === 'P' ? 'box-b' : 'box-a'" />
            <text :x="p.x + di * (W / p.disks.length) + W / p.disks.length / 2" :y="83 + ci * 40" text-anchor="middle" class="m">{{ c }}</text>
          </template>
        </template>
        <text :x="p.x + W / 2" y="216" text-anchor="middle" class="m">{{ p.n1 }}</text>
        <text :x="p.x + W / 2" y="236" text-anchor="middle" class="m">{{ p.n2 }}</text>
      </template>
    </svg>
    <figcaption>
      Four RAID layouts. Each tall box is a disk, each small box a chunk of data. P is parity: the XOR of the
      other chunks in its row, from which any one missing chunk can be rebuilt. RAID 5 rotates parity across
      disks so no single disk takes every parity write.
    </figcaption>
  </figure>
</template>
