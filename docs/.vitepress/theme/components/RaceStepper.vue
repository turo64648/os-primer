<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

// Two threads each run `counter++`, which the CPU does in three steps
// (load, add, store). The reader plays the scheduler and picks which thread
// runs its next step. With the mutex turned on, each thread must lock first.

type Kind = 'lock' | 'load' | 'add' | 'store' | 'unlock'
const PLAIN: Kind[] = ['load', 'add', 'store']
const LOCKED: Kind[] = ['lock', 'load', 'add', 'store', 'unlock']
const CODE: Record<Kind, string> = {
  lock: 'lock(m)',
  load: 'r = counter',
  add: 'r = r + 1',
  store: 'counter = r',
  unlock: 'unlock(m)',
}

interface T {
  pc: number
  r: number | null
}
interface Log {
  text: string
  kind: 'ok' | 'warn' | 'info'
}

const useLock = ref(false)
const prog = computed(() => (useLock.value ? LOCKED : PLAIN))
const st = reactive({
  counter: 0,
  owner: -1, // -1 = lock free, else thread index
  th: [{ pc: 0, r: null }, { pc: 0, r: null }] as T[],
  log: [] as Log[],
})
const names = ['T1', 'T2']
let timer: ReturnType<typeof setTimeout> | null = null

function stop() {
  if (timer) clearTimeout(timer)
  timer = null
}
function reset() {
  stop()
  st.counter = 0
  st.owner = -1
  st.th = [{ pc: 0, r: null }, { pc: 0, r: null }]
  st.log = []
}
function setLock(v: boolean) {
  useLock.value = v
  reset()
}
onBeforeUnmount(stop)

const done = (i: number) => st.th[i].pc >= prog.value.length
const blocked = (i: number) => !done(i) && prog.value[st.th[i].pc] === 'lock' && st.owner !== -1 && st.owner !== i
const canRun = (i: number) => !done(i) && !blocked(i)
const finished = computed(() => done(0) && done(1))

/** Run one step of thread i on plain state (used by both the UI and the batch test). */
function exec(s: { counter: number; owner: number; th: T[] }, p: Kind[], i: number): string {
  const t = s.th[i]
  const k = p[t.pc]
  let msg = ''
  switch (k) {
    case 'lock':
      s.owner = i
      msg = 'takes the lock'
      break
    case 'load':
      t.r = s.counter
      msg = `reads counter → r = ${t.r}`
      break
    case 'add':
      t.r = (t.r ?? 0) + 1
      msg = `adds 1 in its register → r = ${t.r}`
      break
    case 'store':
      s.counter = t.r ?? 0
      msg = `writes r back → counter = ${s.counter}`
      break
    case 'unlock':
      s.owner = -1
      msg = 'releases the lock'
      break
  }
  t.pc++
  return msg
}

function step(i: number) {
  if (done(i)) return
  if (blocked(i)) {
    st.log.push({ text: `${names[i]} tries to lock, but ${names[1 - i]} holds the lock, so ${names[i]} sleeps.`, kind: 'warn' })
    return
  }
  const kind = prog.value[st.th[i].pc]
  const msg = exec(st, prog.value, i)
  st.log.push({ text: `${names[i]} ${msg}`, kind: 'info' })
  const other = 1 - i
  if (kind === 'unlock' && !done(other) && prog.value[st.th[other].pc] === 'lock') {
    st.log.push({ text: `The lock is free again, so ${names[other]} can take it.`, kind: 'info' })
  }
  if (finished.value) {
    st.log.push(
      st.counter === 2
        ? { text: 'Both finished: counter = 2. Both increments counted.', kind: 'ok' }
        : { text: `Both finished: counter = ${st.counter}. One increment was lost: a thread overwrote the other’s result with a stale value.`, kind: 'warn' },
    )
  }
}

function play(seq: number[]) {
  reset()
  let k = 0
  const tick = () => {
    if (k >= seq.length) return
    step(seq[k++])
    timer = setTimeout(tick, 650)
  }
  tick()
}
const badOrder = () => play(useLock.value ? [0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1] : [0, 1, 0, 0, 1, 1])
function randomRun() {
  reset()
  const tick = () => {
    const ready = [0, 1].filter(canRun)
    if (!ready.length) return
    step(ready[Math.floor(Math.random() * ready.length)])
    timer = setTimeout(tick, 450)
  }
  tick()
}

const batch = ref<{ runs: number; lost: number } | null>(null)
function runBatch() {
  const p = prog.value
  let lost = 0
  const N = 1000
  for (let n = 0; n < N; n++) {
    const s = { counter: 0, owner: -1, th: [{ pc: 0, r: null }, { pc: 0, r: null }] as T[] }
    for (;;) {
      const ready = [0, 1].filter((i) => {
        if (s.th[i].pc >= p.length) return false
        return !(p[s.th[i].pc] === 'lock' && s.owner !== -1 && s.owner !== i)
      })
      if (!ready.length) break
      exec(s, p, ready[Math.floor(Math.random() * ready.length)])
    }
    if (s.counter !== 2) lost++
  }
  batch.value = { runs: N, lost }
}
</script>

<template>
  <div class="widget race">
    <h4>Try it: two threads run counter++</h4>
    <p class="intro">
      <code>counter++</code> is three steps for the CPU: read the value into a register <code>r</code>, add 1, write it
      back. Each thread has its own register. You are the scheduler: pick which thread runs its next step.
    </p>

    <div class="row modes">
      <button :class="{ primary: !useLock }" @click="setLock(false)">No lock</button>
      <button :class="{ primary: useLock }" @click="setLock(true)">With a mutex</button>
    </div>

    <div class="shared">
      <div><span>counter</span><b>{{ st.counter }}</b></div>
      <div v-if="useLock"><span>lock m</span><b>{{ st.owner === -1 ? 'free' : 'held by ' + names[st.owner] }}</b></div>
    </div>

    <div class="threads">
      <div v-for="(t, i) in st.th" :key="i" class="thread" :class="{ blocked: blocked(i), done: done(i) }">
        <div class="thead">
          <b>{{ names[i] }}</b>
          <span>r = {{ t.r === null ? '?' : t.r }}</span>
        </div>
        <ol class="code">
          <li v-for="(k, j) in prog" :key="j" :class="{ cur: j === t.pc, past: j < t.pc }">
            <code>{{ CODE[k] }}</code>
          </li>
        </ol>
        <button class="primary runbtn" :disabled="!canRun(i)" @click="stop(); step(i)">
          {{ done(i) ? 'finished' : blocked(i) ? 'blocked (sleeping)' : 'Run next step' }}
        </button>
      </div>
    </div>

    <div class="row presets">
      <button @click="badOrder">Play the bad order</button>
      <button @click="randomRun">Random order</button>
      <button @click="runBatch">1000 random orders</button>
      <button @click="reset">Reset</button>
    </div>

    <p v-if="batch" class="batch">
      {{ batch.runs }} random orders {{ useLock ? 'with the mutex' : 'without a lock' }}:
      <b :class="batch.lost ? 'bad' : 'good'">{{ batch.lost }}</b> ended with counter = 1 (a lost update).
    </p>

    <ol v-if="st.log.length" class="log">
      <li v-for="(l, i) in st.log" :key="i" :class="l.kind">{{ l.text }}</li>
    </ol>
  </div>
</template>

<style scoped>
.intro {
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  margin: 0 0 12px;
}
.modes button {
  padding: 4px 12px;
  font-size: 13px;
}
.shared {
  display: flex;
  gap: 8px;
  margin: 14px 0 10px;
}
.shared div {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px;
  border-radius: 8px;
  background: var(--vp-c-bg);
}
.shared span {
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.shared b {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.threads {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.thread {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 8px;
  background: var(--vp-c-bg);
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.thread.blocked {
  border-color: var(--bad);
}
.thread.done {
  opacity: 0.75;
}
.thead {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 14px;
  margin-bottom: 4px;
}
.thead span {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}
.code {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
  flex: 1;
}
.code li {
  margin: 2px 0;
  padding: 2px 6px;
  border-radius: 5px;
  border-left: 3px solid transparent;
}
.code code {
  font-size: 12px;
  background: none;
  padding: 0;
}
.code li.cur {
  background: var(--d-a-soft);
  border-left-color: var(--d-a);
}
.code li.past {
  color: var(--vp-c-text-3);
}
.code li.past code {
  color: var(--vp-c-text-3);
}
.widget .runbtn {
  width: 100%;
  padding: 6px 4px;
  font-size: 13px;
}
.presets {
  margin-top: 12px;
}
.presets button {
  padding: 4px 10px;
  font-size: 13px;
}
.batch {
  font-size: 14px;
  margin: 12px 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--vp-c-bg);
}
.batch .bad {
  color: var(--bad);
}
.batch .good {
  color: var(--ok);
}
.log {
  margin: 12px 0 0;
  padding-left: 22px;
  font-size: 14px;
  line-height: 1.5;
}
.log li {
  margin: 3px 0;
}
.log .ok {
  color: var(--ok);
  font-weight: 600;
}
.log .warn {
  color: var(--bad);
}
</style>
