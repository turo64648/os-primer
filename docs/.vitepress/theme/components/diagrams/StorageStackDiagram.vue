<script setup lang="ts">
// The layers a read or write passes through on its way to the device.
const layers = [
  { t: 'Your program', m: 'read, write, fsync on a file', c: 'box-a', note: 'bytes at offsets in a file' },
  { t: 'File system + page cache', m: 'ext4, XFS, btrfs', c: 'box-d', note: 'turns file offsets into block numbers' },
  { t: 'Block layer', m: 'merges, orders and queues requests', c: 'box-d', note: 'requests: "read 8 blocks at 5,120"' },
  { t: 'Device driver', m: 'NVMe, SATA, virtio, network storage', c: 'box-d', note: 'commands in the device’s format' },
  { t: 'Device controller', m: 'its own CPU, RAM cache and firmware', c: 'box-b', note: 'e.g. the SSD’s flash translation layer' },
  { t: 'Media', m: 'flash chips or spinning platters', c: 'box-c', note: 'where data finally survives power loss' },
]
const y = (i: number) => 16 + i * 66
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 410" role="img" aria-label="The storage stack from the program down through the file system, block layer, driver and device controller to the media">
      <defs>
        <marker id="ss-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>
      <template v-for="(l, i) in layers" :key="l.t">
        <rect x="20" :y="y(i)" width="300" height="50" rx="8" :class="l.c" />
        <text x="170" :y="y(i) + 21" text-anchor="middle" class="tb">{{ l.t }}</text>
        <text x="170" :y="y(i) + 40" text-anchor="middle" class="m">{{ l.m }}</text>
        <text x="340" :y="y(i) + 30" class="m">{{ l.note }}</text>
        <path v-if="i < layers.length - 1" :d="`M170 ${y(i) + 50} L170 ${y(i + 1) - 2}`" class="ln" marker-end="url(#ss-ah)" />
      </template>
      <line x1="10" :y1="y(4) - 8" x2="630" :y2="y(4) - 8" class="ln-dash" />
      <text x="630" :y="y(4) - 14" text-anchor="end" class="m">↑ Linux kernel   ↓ inside the drive</text>
    </svg>
    <figcaption>
      The storage stack. Each layer speaks a different language: files and offsets at the top, numbered blocks in
      the middle, device commands at the bottom. The last two layers are inside the drive, out of the kernel's
      sight.
    </figcaption>
  </figure>
</template>
