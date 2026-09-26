<script setup lang="ts">
// The life of a Linux task: the main states and what moves it between them.
// Letters in brackets are the codes `ps` shows in its STAT column.
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 400" role="img" aria-label="Process states: created, ready, running, sleeping, zombie and removed, with the events that move a process between them">
      <defs>
        <marker id="ps-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <!-- top row: created, ready, running -->
      <rect x="20" y="40" width="130" height="56" rx="8" class="box" />
      <text x="85" y="64" text-anchor="middle" class="tb">Created</text>
      <text x="85" y="84" text-anchor="middle" class="m mono">fork() / clone()</text>

      <rect x="200" y="40" width="160" height="56" rx="8" class="box-a" />
      <text x="280" y="64" text-anchor="middle" class="tb">Ready (R)</text>
      <text x="280" y="84" text-anchor="middle" class="m">waiting for a CPU</text>

      <rect x="450" y="40" width="170" height="56" rx="8" class="box-a" />
      <text x="535" y="64" text-anchor="middle" class="tb">Running (R)</text>
      <text x="535" y="84" text-anchor="middle" class="m">on a CPU now</text>

      <!-- second row: sleeping, zombie -->
      <rect x="200" y="210" width="160" height="56" rx="8" class="box-b" />
      <text x="280" y="234" text-anchor="middle" class="tb">Sleeping (S or D)</text>
      <text x="280" y="254" text-anchor="middle" class="m">waiting for an event</text>

      <rect x="450" y="210" width="170" height="56" rx="8" class="box-d" />
      <text x="535" y="234" text-anchor="middle" class="tb">Zombie (Z)</text>
      <text x="535" y="254" text-anchor="middle" class="m">exited, not collected</text>

      <!-- third row: removed -->
      <rect x="450" y="330" width="170" height="50" rx="8" class="ghost" />
      <text x="535" y="352" text-anchor="middle" class="tb">Removed</text>
      <text x="535" y="370" text-anchor="middle" class="m">PID can be reused</text>

      <!-- created -> ready -->
      <path d="M150 68 L200 68" class="ln" marker-end="url(#ps-ah)" />

      <!-- ready <-> running -->
      <path d="M360 58 L450 58" class="ln-a" marker-end="url(#ps-ah)" />
      <text x="405" y="30" text-anchor="middle" class="m">scheduler picks it</text>
      <path d="M450 80 L360 80" class="ln-a" marker-end="url(#ps-ah)" />
      <text x="405" y="116" text-anchor="middle" class="m">time is up</text>

      <!-- running -> sleeping -->
      <path d="M480 96 L360 214" class="ln" marker-end="url(#ps-ah)" />
      <text x="436" y="150" class="m">waits for I/O,</text>
      <text x="436" y="166" class="m">a lock, a timer</text>

      <!-- sleeping -> ready -->
      <path d="M260 210 L260 96" class="ln" marker-end="url(#ps-ah)" />
      <text x="250" y="150" text-anchor="end" class="m">the event happens:</text>
      <text x="250" y="166" text-anchor="end" class="m">data, lock, timer</text>

      <!-- running -> zombie -->
      <path d="M580 96 L580 210" class="ln" marker-end="url(#ps-ah)" />
      <text x="590" y="150" class="m">exits</text>
      <text x="590" y="166" class="m">or killed</text>

      <!-- zombie -> removed -->
      <path d="M535 266 L535 330" class="ln-dash" marker-end="url(#ps-ah)" />
      <text x="525" y="296" text-anchor="end" class="m">parent calls wait()</text>
    </svg>
    <figcaption>
      The main states of a process or thread. A thread is always in exactly one of them. Most spend their
      life moving around the top triangle: ready, running, sleeping, ready again.
    </figcaption>
  </figure>
</template>
