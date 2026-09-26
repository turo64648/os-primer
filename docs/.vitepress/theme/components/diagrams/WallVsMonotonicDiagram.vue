<script setup lang="ts">
// Wall clock vs monotonic clock when NTP steps the wall clock backwards.
// Both lines rise at the same rate; the wall clock jumps down at the step.
</script>

<template>
  <figure class="figure">
    <svg viewBox="0 0 640 320" role="img" aria-label="Graph of two clocks over real time. The monotonic clock rises steadily. The wall clock rises at the same rate but jumps backwards when NTP corrects it, so a duration measured across the jump comes out too short">
      <defs>
        <marker id="wm-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="arrowhead" />
        </marker>
      </defs>

      <!-- axes -->
      <path d="M60 260 L610 260" class="ln" marker-end="url(#wm-ah)" />
      <path d="M60 260 L60 20" class="ln" marker-end="url(#wm-ah)" />
      <text x="610" y="284" text-anchor="end" class="m">real time passing</text>
      <text x="48" y="140" text-anchor="middle" class="m" transform="rotate(-90 48 140)">clock reading</text>

      <!-- legend -->
      <path d="M80 34 L120 34" class="ln-a" />
      <text x="128" y="39" class="t">monotonic clock</text>
      <path d="M80 60 L120 60" class="ln-b" />
      <text x="128" y="65" class="t">wall clock</text>

      <!-- monotonic: straight line -->
      <path d="M60 250 L600 40" class="ln-a" />

      <!-- wall clock: same slope, steps back at x=330 -->
      <path d="M60 244 L330 139" class="ln-b" />
      <path d="M330 139 L330 199" class="ln-dash" marker-end="url(#wm-ah)" />
      <path d="M330 199 L600 94" class="ln-b" />
      <text x="340" y="228" class="m">NTP steps the wall</text>
      <text x="340" y="244" class="m">clock back</text>

      <!-- a duration measured across the step -->
      <path d="M250 262 L250 270 M420 262 L420 270" class="ln" />
      <path d="M250 266 L420 266" class="ln-dash" />
      <text x="335" y="300" text-anchor="middle" class="m">a timer or duration measured here with the wall clock comes out too short</text>
    </svg>
    <figcaption>
      Both clocks tick at the same rate. The wall clock can jump when it is corrected; the monotonic clock
      never goes backwards. Measure durations and timeouts with the monotonic clock.
    </figcaption>
  </figure>
</template>
