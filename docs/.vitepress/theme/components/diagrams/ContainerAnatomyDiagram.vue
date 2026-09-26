<template>
  <figure class="figure">
    <svg viewBox="0 0 640 330" role="img" aria-label="A container is ordinary processes plus namespaces, cgroups, security filters and a root filesystem, all on the shared host kernel">
      <rect x="220" y="110" width="200" height="70" rx="10" class="box-a" />
      <text x="320" y="140" text-anchor="middle" class="tb">The container's</text>
      <text x="320" y="160" text-anchor="middle" class="tb">processes</text>

      <rect x="20" y="20" width="270" height="70" rx="8" class="box" />
      <text x="155" y="46" text-anchor="middle" class="tb">Namespaces</text>
      <text x="155" y="66" text-anchor="middle" class="m">what it can see: PIDs, network,</text>
      <text x="155" y="82" text-anchor="middle" class="m">mounts, hostname, users</text>

      <rect x="350" y="20" width="270" height="70" rx="8" class="box" />
      <text x="485" y="46" text-anchor="middle" class="tb">cgroups</text>
      <text x="485" y="66" text-anchor="middle" class="m">how much it can use: CPU,</text>
      <text x="485" y="82" text-anchor="middle" class="m">memory, I/O, number of processes</text>

      <rect x="20" y="200" width="270" height="70" rx="8" class="box" />
      <text x="155" y="226" text-anchor="middle" class="tb">Security filters</text>
      <text x="155" y="246" text-anchor="middle" class="m">what it may do: capabilities,</text>
      <text x="155" y="262" text-anchor="middle" class="m">seccomp, AppArmor or SELinux</text>

      <rect x="350" y="200" width="270" height="70" rx="8" class="box" />
      <text x="485" y="226" text-anchor="middle" class="tb">Root filesystem</text>
      <text x="485" y="246" text-anchor="middle" class="m">which files: image layers</text>
      <text x="485" y="262" text-anchor="middle" class="m">plus a writable layer</text>

      <path d="M220 120 L200 90 M420 120 L440 90 M220 170 L200 200 M420 170 L440 200" class="ln" />

      <rect x="20" y="286" width="600" height="34" rx="8" class="box-c" />
      <text x="320" y="308" text-anchor="middle" class="t">All of it runs on the one shared host kernel</text>
    </svg>
    <figcaption>
      There is no single "container" object in the Linux kernel. A container runtime combines these four
      independent kernel features around an ordinary group of processes.
    </figcaption>
  </figure>
</template>
