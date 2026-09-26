<template>
  <figure class="figure">
    <svg viewBox="0 0 640 330" role="img" aria-label="Virtual machines each run their own kernel on a hypervisor; containers are processes sharing one host kernel">
      <text x="160" y="28" text-anchor="middle" class="h">Virtual machines</text>
      <text x="480" y="28" text-anchor="middle" class="h">Containers</text>

      <!-- VM stack -->
      <rect x="20" y="44" width="135" height="44" rx="6" class="box-a" />
      <text x="87" y="71" text-anchor="middle" class="t">App A</text>
      <rect x="165" y="44" width="135" height="44" rx="6" class="box-b" />
      <text x="232" y="71" text-anchor="middle" class="t">App B</text>
      <rect x="20" y="96" width="135" height="44" rx="6" class="box-a" />
      <text x="87" y="123" text-anchor="middle" class="t">Guest kernel A</text>
      <rect x="165" y="96" width="135" height="44" rx="6" class="box-b" />
      <text x="232" y="123" text-anchor="middle" class="t">Guest kernel B</text>
      <text x="160" y="160" text-anchor="middle" class="m">virtual hardware for each VM</text>
      <rect x="20" y="168" width="280" height="50" rx="8" class="box-d" />
      <text x="160" y="198" text-anchor="middle" class="tb">Hypervisor</text>
      <rect x="20" y="226" width="280" height="44" rx="8" class="box" />
      <text x="160" y="253" text-anchor="middle" class="t">Hardware</text>

      <line x1="320" y1="40" x2="320" y2="280" class="ln-dash" />

      <!-- container stack -->
      <rect x="340" y="44" width="135" height="96" rx="6" class="box-a" />
      <text x="407" y="84" text-anchor="middle" class="t">App A</text>
      <text x="407" y="104" text-anchor="middle" class="m">+ its libraries</text>
      <rect x="485" y="44" width="135" height="96" rx="6" class="box-b" />
      <text x="552" y="84" text-anchor="middle" class="t">App B</text>
      <text x="552" y="104" text-anchor="middle" class="m">+ its libraries</text>
      <text x="480" y="160" text-anchor="middle" class="m">system calls, like any process</text>
      <rect x="340" y="168" width="280" height="50" rx="8" class="box-c" />
      <text x="480" y="198" text-anchor="middle" class="tb">One shared host kernel</text>
      <rect x="340" y="226" width="280" height="44" rx="8" class="box" />
      <text x="480" y="253" text-anchor="middle" class="t">Hardware</text>

      <text x="160" y="304" text-anchor="middle" class="m">boundary: virtual hardware</text>
      <text x="480" y="304" text-anchor="middle" class="m">boundary: the system call interface</text>
    </svg>
    <figcaption>
      A virtual machine pretends to be a whole computer and runs its own kernel. A container is a group of
      ordinary processes that the one host kernel shows a restricted view of the system.
    </figcaption>
  </figure>
</template>
