<script setup lang="ts">
// Names live in directories; the file itself is the inode. Hard link vs symbolic link.
const rows = [
  { y: 88, name: 'notes.txt', to: 'inode 812' },
  { y: 128, name: 'backup.txt', to: 'inode 812' },
  { y: 168, name: 'short', to: 'inode 950' },
]
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 330" role="img" aria-label="A directory maps names to inode numbers. Two names point to the same inode (a hard link). A symbolic link is its own inode that stores a path.">
      <defs>
        <marker id="fl-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <!-- directory -->
      <rect x="10" y="30" width="230" height="165" rx="8" class="box-a" />
      <text x="125" y="54" text-anchor="middle" class="tb">Directory /home/ana</text>
      <template v-for="r in rows" :key="r.name">
        <rect x="22" :y="r.y - 22" width="206" height="32" rx="4" class="box" />
        <text x="32" :y="r.y" class="t mono">{{ r.name }}</text>
        <text x="218" :y="r.y" text-anchor="end" class="m">→ {{ r.to.replace('inode ', '') }}</text>
      </template>

      <!-- inode 812 -->
      <rect x="290" y="30" width="180" height="140" rx="8" class="box-d" />
      <text x="380" y="54" text-anchor="middle" class="tb">Inode 812</text>
      <text x="300" y="80" class="m">owner, permissions</text>
      <text x="300" y="100" class="m">size, timestamps</text>
      <text x="300" y="120" class="m">link count: 2</text>
      <text x="300" y="140" class="m">where the data is</text>
      <text x="300" y="160" class="m">(no name!)</text>

      <!-- data blocks -->
      <text x="570" y="54" text-anchor="middle" class="tb">Data blocks</text>
      <rect x="520" y="70" width="44" height="36" class="box-c" />
      <rect x="570" y="70" width="44" height="36" class="box-c" />
      <rect x="520" y="112" width="44" height="36" class="box-c" />
      <path d="M470 100 L518 100" class="ln" marker-end="url(#fl-ah)" />

      <!-- inode 950: symlink -->
      <rect x="290" y="220" width="180" height="90" rx="8" class="box-b" />
      <text x="380" y="244" text-anchor="middle" class="tb">Inode 950</text>
      <text x="300" y="268" class="m">type: symbolic link</text>
      <text x="300" y="290" class="m">contents: <tspan class="mono">"notes.txt"</tspan></text>

      <!-- arrows from names -->
      <path d="M228 82 L288 82" class="ln-a" marker-end="url(#fl-ah)" />
      <path d="M228 122 L288 122" class="ln-a" marker-end="url(#fl-ah)" />
      <path d="M228 162 C 260 162, 260 250, 288 250" class="ln-b" marker-end="url(#fl-ah)" />
      <path d="M290 290 C 130 290, 60 260, 60 198" class="ln-dash" marker-end="url(#fl-ah)" />
      <text x="160" y="226" text-anchor="middle" class="m">looked up again</text>
      <text x="160" y="244" text-anchor="middle" class="m">by name</text>
    </svg>
    <figcaption>
      A directory is a list of names and inode numbers. <code>notes.txt</code> and <code>backup.txt</code> are
      two hard links to the same inode, so they are the same file. <code>short</code> is a symbolic link: a
      separate small file that stores a path, which the kernel looks up again when you open it.
    </figcaption>
  </figure>
</template>
