<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

// A tiny single-core scheduler simulator. The reader enters a few jobs
// (arrival time, CPU burst) and compares FCFS, SJF, SRTF and round robin on
// Gantt charts that share one time scale. An optional context-switch cost
// shows why very short time slices waste CPU.

interface Job {
  arrival: number
  burst: number
}
interface Seg {
  kind: 'run' | 'switch' | 'idle'
  job: number
  start: number
  end: number
}
interface Result {
  segs: Seg[]
  finish: number[]
  firstRun: number[]
  switches: number
  switchTime: number
}

const NAMES = ['A', 'B', 'C', 'D', 'E', 'F']
const MAX_JOBS = 6

const presets: Record<string, { label: string; jobs: Job[] }> = {
  mixed: { label: 'Mixed', jobs: [{ arrival: 0, burst: 8 }, { arrival: 1, burst: 4 }, { arrival: 2, burst: 9 }, { arrival: 3, burst: 5 }] },
  convoy: { label: 'Convoy', jobs: [{ arrival: 0, burst: 20 }, { arrival: 1, burst: 2 }, { arrival: 2, burst: 2 }, { arrival: 3, burst: 2 }] },
  equal: { label: 'Equal jobs', jobs: [{ arrival: 0, burst: 6 }, { arrival: 0, burst: 6 }, { arrival: 0, burst: 6 }] },
}

const jobs = reactive<Job[]>(presets.mixed.jobs.map((j) => ({ ...j })))
const slice = ref(2)
const cost = ref(0)

function loadPreset(key: string) {
  jobs.splice(0, jobs.length, ...presets[key].jobs.map((j) => ({ ...j })))
}
function addJob() {
  if (jobs.length < MAX_JOBS) jobs.push({ arrival: jobs.length ? jobs[jobs.length - 1].arrival + 1 : 0, burst: 3 })
}
function removeJob(i: number) {
  if (jobs.length > 1) jobs.splice(i, 1)
}

const clamp = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt
}
// Sanitised copy used by the simulation.
const clean = computed<Job[]>(() =>
  jobs.map((j) => ({ arrival: clamp(j.arrival, 0, 50, 0), burst: clamp(j.burst, 1, 30, 1) })),
)

const r3 = (x: number) => Math.round(x * 1000) / 1000

function builder(n: number, c: number) {
  const res: Result = { segs: [], finish: Array(n).fill(0), firstRun: Array(n).fill(-1), switches: 0, switchTime: 0 }
  let t = 0
  let last = -1 // -1: the CPU was idle (or nothing has run yet)
  return {
    res,
    now: () => t,
    idleUntil(u: number) {
      if (u > t) {
        res.segs.push({ kind: 'idle', job: -1, start: t, end: u })
        t = u
        last = -1
      }
    },
    switchTo(j: number) {
      if (last !== -1 && last !== j) {
        res.switches++
        if (c > 0) {
          res.segs.push({ kind: 'switch', job: -1, start: t, end: r3(t + c) })
          t = r3(t + c)
          res.switchTime = r3(res.switchTime + c)
        }
      }
      last = j
    },
    run(j: number, d: number) {
      if (res.firstRun[j] < 0) res.firstRun[j] = t
      const end = r3(t + d)
      const prev = res.segs[res.segs.length - 1]
      if (prev && prev.kind === 'run' && prev.job === j && prev.end === t) prev.end = end
      else res.segs.push({ kind: 'run', job: j, start: t, end })
      t = end
    },
    finish(j: number) {
      res.finish[j] = t
    },
  }
}

// Stable order: by arrival, then by position in the list.
const byArrival = (js: Job[]) => js.map((_, i) => i).sort((a, b) => js[a].arrival - js[b].arrival || a - b)

function fcfs(js: Job[], c: number): Result {
  const b = builder(js.length, c)
  for (const j of byArrival(js)) {
    b.idleUntil(js[j].arrival)
    b.switchTo(j)
    b.run(j, js[j].burst)
    b.finish(j)
  }
  return b.res
}

function sjf(js: Job[], c: number): Result {
  const b = builder(js.length, c)
  const done = Array(js.length).fill(false)
  for (let k = 0; k < js.length; k++) {
    let avail = js.map((_, i) => i).filter((i) => !done[i] && js[i].arrival <= b.now())
    if (!avail.length) {
      b.idleUntil(Math.min(...js.filter((_, i) => !done[i]).map((x) => x.arrival)))
      avail = js.map((_, i) => i).filter((i) => !done[i] && js[i].arrival <= b.now())
    }
    avail.sort((x, y) => js[x].burst - js[y].burst || js[x].arrival - js[y].arrival || x - y)
    const j = avail[0]
    b.switchTo(j)
    b.run(j, js[j].burst)
    b.finish(j)
    done[j] = true
  }
  return b.res
}

function srtf(js: Job[], c: number): Result {
  const b = builder(js.length, c)
  const rem = js.map((x) => x.burst)
  let guard = 0
  while (rem.some((x) => x > 0) && guard++ < 10000) {
    const avail = js.map((_, i) => i).filter((i) => rem[i] > 0 && js[i].arrival <= b.now())
    if (!avail.length) {
      b.idleUntil(Math.min(...js.filter((_, i) => rem[i] > 0).map((x) => x.arrival)))
      continue
    }
    avail.sort((x, y) => rem[x] - rem[y] || js[x].arrival - js[y].arrival || x - y)
    const j = avail[0]
    b.switchTo(j)
    const later = js.map((x) => x.arrival).filter((a) => a > b.now())
    const next = later.length ? Math.min(...later) : Infinity
    const d = Math.min(rem[j], r3(next - b.now()))
    b.run(j, d)
    rem[j] = r3(rem[j] - d)
    if (rem[j] <= 0) b.finish(j)
  }
  return b.res
}

function rr(js: Job[], c: number, q: number): Result {
  const b = builder(js.length, c)
  const rem = js.map((x) => x.burst)
  const order = byArrival(js)
  const added = Array(js.length).fill(false)
  const queue: number[] = []
  const admit = () => {
    for (const i of order) {
      if (!added[i] && js[i].arrival <= b.now()) {
        queue.push(i)
        added[i] = true
      }
    }
  }
  let done = 0
  let guard = 0
  admit()
  while (done < js.length && guard++ < 10000) {
    if (!queue.length) {
      b.idleUntil(Math.min(...js.filter((_, i) => !added[i]).map((x) => x.arrival)))
      admit()
      continue
    }
    const j = queue.shift()!
    b.switchTo(j)
    admit() // jobs that arrived during the switch
    const d = Math.min(q, rem[j])
    b.run(j, d)
    rem[j] = r3(rem[j] - d)
    admit() // new arrivals join the queue before the preempted job
    if (rem[j] > 0) queue.push(j)
    else {
      b.finish(j)
      done++
    }
  }
  return b.res
}

const fmt = (x: number) => (Math.round(x * 10) / 10).toString()

const rows = computed(() => {
  const js = clean.value
  const c = cost.value
  const list = [
    { key: 'fcfs', name: 'FCFS', desc: 'first come, first served', res: fcfs(js, c) },
    { key: 'sjf', name: 'SJF', desc: 'shortest job first', res: sjf(js, c) },
    { key: 'srtf', name: 'SRTF', desc: 'shortest remaining time first (preemptive SJF)', res: srtf(js, c) },
    { key: 'rr', name: `RR (slice ${slice.value})`, desc: 'round robin', res: rr(js, c, slice.value) },
  ]
  return list.map((r) => {
    const n = js.length
    const tat = js.map((x, i) => r.res.finish[i] - x.arrival)
    const wait = js.map((x, i) => tat[i] - x.burst)
    const resp = js.map((x, i) => r.res.firstRun[i] - x.arrival)
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / n
    return { ...r, wait: avg(wait), tat: avg(tat), resp: avg(resp) }
  })
})

const best = computed(() => {
  const min = (k: 'wait' | 'tat' | 'resp') => Math.min(...rows.value.map((r) => r[k]))
  return { wait: min('wait'), tat: min('tat'), resp: min('resp') }
})
const isBest = (v: number, b: number) => Math.abs(v - b) < 1e-6

const span = computed(() => Math.max(1, ...rows.value.map((r) => r.res.segs.at(-1)?.end ?? 0)))
const ticks = computed(() => {
  const s = span.value
  const raw = s / 5
  const step = [1, 2, 5, 10, 20, 50, 100].find((x) => x >= raw) ?? 100
  const out: number[] = []
  for (let v = 0; v <= s + 1e-9; v += step) out.push(v)
  return out
})
const pct = (x: number) => `${(x / span.value) * 100}%`
const segStyle = (s: Seg) => ({ left: pct(s.start), width: pct(s.end - s.start) })
const showLabel = (s: Seg) => (s.end - s.start) / span.value >= 0.04
</script>

<template>
  <div class="widget sched">
    <h4>Try it: compare scheduling algorithms</h4>
    <p class="intro">
      One CPU core. Each job arrives at some time and needs some CPU time (its burst). Times are in abstract
      units, say milliseconds. All charts share one time scale.
    </p>

    <div class="row presets">
      <span class="plabel">Examples:</span>
      <button v-for="(p, k) in presets" :key="k" @click="loadPreset(k as string)">{{ p.label }}</button>
    </div>

    <div class="jobs">
      <div class="jhead">Job</div>
      <div class="jhead">Arrives at</div>
      <div class="jhead">CPU burst</div>
      <div></div>
      <template v-for="(j, i) in jobs" :key="i">
        <div class="jname"><span class="chip" :class="'j' + i">{{ NAMES[i] }}</span></div>
        <input v-model.number="j.arrival" type="number" min="0" max="50" inputmode="numeric" :aria-label="`Job ${NAMES[i]} arrival time`" />
        <input v-model.number="j.burst" type="number" min="1" max="30" inputmode="numeric" :aria-label="`Job ${NAMES[i]} CPU burst`" />
        <button class="rm" :disabled="jobs.length <= 1" :aria-label="`Remove job ${NAMES[i]}`" @click="removeJob(i)">×</button>
      </template>
    </div>
    <div class="row">
      <button :disabled="jobs.length >= MAX_JOBS" @click="addJob">+ Add job</button>
    </div>

    <div class="controls">
      <label>
        <span>Round-robin time slice: <b>{{ slice }}</b></span>
        <input v-model.number="slice" type="range" min="1" max="10" step="1" />
      </label>
      <label>
        <span>Cost of each context switch</span>
        <select v-model.number="cost">
          <option :value="0">0 (free)</option>
          <option :value="0.1">0.1</option>
          <option :value="0.25">0.25</option>
          <option :value="0.5">0.5</option>
          <option :value="1">1</option>
        </select>
      </label>
    </div>

    <div class="gantts">
      <div v-for="r in rows" :key="r.key" class="grow">
        <div class="gname"><b>{{ r.name }}</b> <span>{{ r.desc }}</span></div>
        <div class="bar">
          <div
            v-for="(s, i) in r.res.segs"
            :key="i"
            class="seg"
            :class="s.kind === 'run' ? ['run', 'j' + s.job] : s.kind"
            :style="segStyle(s)"
            :title="s.kind === 'run' ? `${NAMES[s.job]}: ${s.start}–${s.end}` : s.kind === 'switch' ? `context switch: ${s.start}–${s.end}` : `idle: ${s.start}–${s.end}`"
          >
            <span v-if="s.kind === 'run' && showLabel(s)">{{ NAMES[s.job] }}</span>
          </div>
        </div>
      </div>
      <div class="axis">
        <span v-for="t in ticks" :key="t" :style="{ left: pct(t) }">{{ t }}</span>
      </div>
    </div>
    <p v-if="cost > 0" class="legend"><span class="sw"></span> striped = time lost to context switches</p>

    <div class="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Algorithm</th>
            <th>Avg wait</th>
            <th>Avg turnaround</th>
            <th>Avg response</th>
            <th>Switches</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.key">
            <td>{{ r.name }}</td>
            <td :class="{ best: isBest(r.wait, best.wait) }">{{ fmt(r.wait) }}</td>
            <td :class="{ best: isBest(r.tat, best.tat) }">{{ fmt(r.tat) }}</td>
            <td :class="{ best: isBest(r.resp, best.resp) }">{{ fmt(r.resp) }}</td>
            <td>{{ r.res.switches }}<span v-if="cost > 0" class="lost"> ({{ fmt(r.res.switchTime) }} lost)</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="defs">
      <b>Wait</b>: time spent ready but not running. <b>Turnaround</b>: arrival to finish.
      <b>Response</b>: arrival to first run. Lower is better; the best in each column is highlighted.
    </p>
  </div>
</template>

<style scoped>
.sched {
  --j4: #cdf3f7;
  --j4s: #0e7490;
  --j5: #fdefc8;
  --j5s: #b45309;
}
:global(.dark) .sched {
  --j4: #123a40;
  --j4s: #5fd4e6;
  --j5: #3d2f0f;
  --j5s: #f2c14e;
}
.intro,
.defs,
.legend {
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  margin: 0 0 12px;
}
.defs {
  margin: 10px 0 0;
  font-size: 13px;
}
.plabel {
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.presets button {
  padding: 4px 10px;
  font-size: 13px;
}
.jobs {
  display: grid;
  grid-template-columns: 44px minmax(0, 90px) minmax(0, 90px) 36px;
  gap: 6px 8px;
  align-items: center;
  margin: 14px 0 8px;
}
.jhead {
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.jobs input {
  width: 100%;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}
.widget .rm {
  padding: 4px 0;
  width: 32px;
}
.chip {
  display: inline-block;
  width: 28px;
  text-align: center;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  border: 1px solid;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  margin: 14px 0 6px;
  font-size: 14px;
}
.controls label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 200px;
}
.controls input[type='range'] {
  padding: 0;
  width: 100%;
}
.gantts {
  margin-top: 14px;
}
.grow {
  margin-bottom: 10px;
}
.gname {
  font-size: 13px;
  margin-bottom: 3px;
}
.gname span {
  color: var(--vp-c-text-2);
}
.bar {
  position: relative;
  height: 28px;
  border-radius: 6px;
  background: var(--vp-c-bg);
  overflow: hidden;
}
.seg {
  position: absolute;
  top: 0;
  bottom: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  overflow: hidden;
}
.seg.run {
  border: 1px solid;
  border-radius: 3px;
}
.seg.switch,
.sw {
  background: repeating-linear-gradient(135deg, var(--d-muted) 0 2px, transparent 2px 5px);
}
.sw {
  display: inline-block;
  width: 18px;
  height: 12px;
  vertical-align: middle;
  border-radius: 2px;
}
.j0 { background: var(--d-a-soft); border-color: var(--d-a); }
.j1 { background: var(--d-b-soft); border-color: var(--d-b); }
.j2 { background: var(--d-c-soft); border-color: var(--d-c); }
.j3 { background: var(--d-d-soft); border-color: var(--d-d); }
.j4 { background: var(--j4); border-color: var(--j4s); }
.j5 { background: var(--j5); border-color: var(--j5s); }
.axis {
  position: relative;
  height: 18px;
  margin: 0;
  font-size: 11px;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}
.axis span {
  position: absolute;
  transform: translateX(-50%);
}
.tablewrap {
  overflow-x: auto;
  margin-top: 10px;
}
.tablewrap table {
  display: table;
  width: 100%;
  margin: 0;
  font-size: 13px;
  border-collapse: collapse;
}
.tablewrap th,
.tablewrap td {
  padding: 5px 6px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.tablewrap th:first-child,
.tablewrap td:first-child {
  text-align: left;
}
.tablewrap td.best {
  color: var(--ok);
  font-weight: 700;
}
.lost {
  color: var(--vp-c-text-2);
}
@media (max-width: 520px) {
  .sched {
    padding: 14px;
  }
  .tablewrap th,
  .tablewrap td {
    padding: 4px 3px;
    font-size: 12px;
    white-space: normal;
  }
}
</style>
