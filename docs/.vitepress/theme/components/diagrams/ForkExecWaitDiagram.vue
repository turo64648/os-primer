<script setup lang="ts">
// A shell runs `ls`: fork, exec, exit, wait. Two lanes over time.
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 290" role="img" aria-label="Timeline of a shell running ls: the shell forks a child, the child calls exec to become ls, ls exits and becomes a zombie, and the shell's wait collects it">
      <defs>
        <marker id="few-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <!-- time axis -->
      <path d="M20 276 L620 276" class="ln-dash" marker-end="url(#few-ah)" />
      <text x="620" y="268" text-anchor="end" class="m">time</text>

      <!-- parent lane -->
      <text x="20" y="28" class="h">Parent: the shell (PID 100)</text>
      <rect x="20" y="42" width="90" height="40" rx="6" class="box-a" />
      <text x="65" y="67" text-anchor="middle" class="t">shell</text>
      <rect x="130" y="42" width="380" height="40" rx="6" class="ghost" />
      <text x="320" y="67" text-anchor="middle" class="m">in waitpid(): asleep until the child exits</text>
      <rect x="530" y="42" width="90" height="40" rx="6" class="box-a" />
      <text x="575" y="67" text-anchor="middle" class="t">prompt</text>
      <path d="M110 62 L130 62" class="ln" />
      <path d="M510 62 L530 62" class="ln" />

      <!-- child lane -->
      <text x="20" y="184" class="h">Child</text>
      <text x="20" y="202" class="m">(PID 101)</text>
      <rect x="130" y="166" width="120" height="40" rx="6" class="box-b" />
      <text x="190" y="191" text-anchor="middle" class="t">copy of shell</text>
      <rect x="275" y="166" width="140" height="40" rx="6" class="box-c" />
      <text x="345" y="191" text-anchor="middle" class="t">ls, same PID</text>
      <rect x="440" y="166" width="70" height="40" rx="6" class="box-d" />
      <text x="475" y="191" text-anchor="middle" class="t">zombie</text>

      <!-- fork -->
      <path d="M100 82 L150 166" class="ln-a" marker-end="url(#few-ah)" />
      <text x="96" y="130" text-anchor="end" class="m mono">fork()</text>

      <!-- exec and exit -->
      <path d="M250 186 L275 186" class="ln-a" marker-end="url(#few-ah)" />
      <text x="262" y="230" text-anchor="middle" class="m mono">exec("ls")</text>
      <path d="M415 186 L440 186" class="ln-a" marker-end="url(#few-ah)" />
      <text x="428" y="248" text-anchor="middle" class="m mono">exit(0)</text>
      <path d="M262 206 L262 216" class="ln" />
      <path d="M428 206 L428 234" class="ln" />

      <!-- reap -->
      <path d="M500 166 L540 82" class="ln-a" marker-end="url(#few-ah)" />
      <text x="530" y="120" class="m">wait returns</text>
      <text x="530" y="136" class="m">exit code 0;</text>
      <text x="530" y="152" class="m">zombie gone</text>
    </svg>
    <figcaption>
      How a shell runs <code>ls</code>. <code>fork</code> makes a copy, <code>exec</code> replaces the copy's
      program but keeps its PID, and the parent's <code>wait</code> collects the exit code. Between exit and
      wait, the child is a zombie.
    </figcaption>
  </figure>
</template>
