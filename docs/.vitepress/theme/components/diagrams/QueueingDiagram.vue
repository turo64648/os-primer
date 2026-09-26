<script setup lang="ts">
// Mean wait in a simple single-server queue (M/M/1): wait = rho / (1 - rho) service times.
const X0 = 70, Y0 = 250, W = 520, H = 210, MAXW = 20
const pts: string[] = []
for (let r = 0; r <= 0.953; r += 0.01) {
  const w = Math.min(r / (1 - r), MAXW)
  pts.push(`${(X0 + r * W).toFixed(1)},${(Y0 - (w / MAXW) * H).toFixed(1)}`)
}
const marks = [
  { r: 0.5, w: 1, label: '50%: 1×' },
  { r: 0.8, w: 4, label: '80%: 4×' },
  { r: 0.9, w: 9, label: '90%: 9×' },
  { r: 0.95, w: 19, label: '95%: 19×' },
]
const mx = (r: number) => X0 + r * W
const my = (w: number) => Y0 - (w / MAXW) * H
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 310" role="img" aria-label="Queueing delay grows slowly at low utilisation and explodes as utilisation approaches 100 percent">
      <line :x1="X0" :y1="Y0" :x2="X0 + W" :y2="Y0" class="ln" />
      <line :x1="X0" :y1="Y0" :x2="X0" :y2="Y0 - H - 10" class="ln" />
      <text :x="X0 + W / 2" :y="Y0 + 40" text-anchor="middle" class="m">how busy the resource is (utilisation)</text>
      <text :x="X0" :y="Y0 + 20" text-anchor="middle" class="m">0%</text>
      <text :x="X0 + W" :y="Y0 + 20" text-anchor="middle" class="m">100%</text>
      <text x="20" y="30" class="m">time waiting in the queue,</text>
      <text x="20" y="46" class="m">in units of the time to serve one request</text>
      <polyline :points="pts.join(' ')" class="ln-a" />
      <template v-for="m in marks" :key="m.r">
        <circle :cx="mx(m.r)" :cy="my(m.w)" r="4" class="box-a" />
        <text :x="mx(m.r) - 8" :y="my(m.w) + 4" text-anchor="end" class="m">{{ m.label }}</text>
      </template>
    </svg>
    <figcaption>
      Average queueing delay in the simplest queue model. Going from 50% to 90% busy multiplies the wait by
      nine. Real systems differ in detail, but always have this shape.
    </figcaption>
  </figure>
</template>
