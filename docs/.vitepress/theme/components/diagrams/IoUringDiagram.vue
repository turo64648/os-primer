<script setup lang="ts">
// io_uring: two queues in memory shared by the program and the kernel.
const x0 = 40
const w = 50
const sq = ['read', 'write', 'accept', '', '']
const cq = ['512 B', 'fd 9', '', '', '']
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 380" role="img" aria-label="io_uring: the program writes requests into a submission queue and reads results from a completion queue, both in memory shared with the kernel">
      <defs>
        <marker id="iu-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <rect x="20" y="16" width="600" height="56" rx="8" class="box-a" />
      <text x="320" y="40" text-anchor="middle" class="tb">Your program</text>
      <text x="320" y="60" text-anchor="middle" class="m">adds many requests, keeps working, collects results later</text>

      <rect x="20" y="130" width="600" height="104" rx="8" class="ghost" />
      <text x="320" y="152" text-anchor="middle" class="m">memory shared by the program and the kernel (no copying)</text>

      <!-- submission queue -->
      <text x="165" y="176" text-anchor="middle" class="t">Submission queue</text>
      <template v-for="(s, i) in sq" :key="'s' + i">
        <rect :x="x0 + i * w" y="186" :width="w" height="36" class="box" />
        <text :x="x0 + i * w + w / 2" y="209" text-anchor="middle" class="m">{{ s }}</text>
      </template>

      <!-- completion queue -->
      <text x="475" y="176" text-anchor="middle" class="t">Completion queue</text>
      <template v-for="(c, i) in cq" :key="'c' + i">
        <rect :x="350 + i * w" y="186" :width="w" height="36" class="box-c" />
        <text :x="350 + i * w + w / 2" y="209" text-anchor="middle" class="m">{{ c }}</text>
      </template>

      <rect x="20" y="304" width="600" height="56" rx="8" class="box-d" />
      <text x="320" y="328" text-anchor="middle" class="tb">Kernel</text>
      <text x="320" y="348" text-anchor="middle" class="m">takes requests, does the I/O, posts one result per request</text>

      <!-- 1: program -> SQ, 2: SQ -> kernel, 3: kernel -> CQ, 4: CQ -> program -->
      <path d="M110 72 L110 184" class="ln-a" marker-end="url(#iu-ah)" />
      <text x="118" y="104" class="m">1. write requests</text>
      <path d="M220 222 L220 302" class="ln-a" marker-end="url(#iu-ah)" />
      <text x="228" y="266" class="m">2. kernel takes them</text>
      <path d="M420 302 L420 222" class="ln-a" marker-end="url(#iu-ah)" />
      <text x="428" y="266" class="m">3. kernel adds results</text>
      <path d="M530 184 L530 72" class="ln-a" marker-end="url(#iu-ah)" />
      <text x="522" y="104" text-anchor="end" class="m">4. read results</text>
    </svg>
    <figcaption>
      io_uring. Requests and results travel through memory both sides can see, so a batch of any size needs
      one system call to say "go", or none if a kernel thread watches the submission queue. Results can come
      back in a different order from the requests.
    </figcaption>
  </figure>
</template>
