<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

// A toy x86-64 MMU: 48-bit virtual addresses, 4 KiB pages, a 4-level page
// table and a tiny fully-associative LRU TLB (4 entries, so misses are easy
// to provoke). The "process" has three mapped regions (VMAs).

const TLB_SIZE = 4
const PAGE = 4096n

interface Vma {
  name: string
  start: bigint
  end: bigint // exclusive
  prefault: boolean // present from the start (e.g. already touched)
}

const vmas: Vma[] = [
  { name: 'code (r-x)', start: 0x400000n, end: 0x410000n, prefault: true },
  { name: 'heap (rw-)', start: 0x600000n, end: 0x700000n, prefault: false },
  { name: 'stack (rw-)', start: 0x7ffffffde000n, end: 0x800000000000n, prefault: true },
]

interface Step {
  kind: 'info' | 'hit' | 'miss' | 'fault' | 'error' | 'ok'
  text: string
}

const state = reactive({
  pageTable: new Map<bigint, bigint>(), // VPN -> PFN
  tlb: [] as { vpn: bigint; pfn: bigint }[], // index 0 = most recently used
  nextPfn: 0x1a3n,
  stats: { accesses: 0, hits: 0, misses: 0, faults: 0, walkRefs: 0, segv: 0 },
})

function initState() {
  state.pageTable = new Map()
  state.tlb = []
  state.nextPfn = 0x1a3n
  state.stats = { accesses: 0, hits: 0, misses: 0, faults: 0, walkRefs: 0, segv: 0 }
  // Pre-populate a few pages of code and the top of the stack.
  for (const v of vmas.filter((v) => v.prefault)) {
    const last = v.name.startsWith('stack') ? v.end : v.start + 4n * PAGE
    const first = v.name.startsWith('stack') ? v.end - 2n * PAGE : v.start
    for (let a = first; a < last; a += PAGE) state.pageTable.set(a / PAGE, state.nextPfn++)
  }
}
initState()

const input = ref('0x401a2c')
const steps = ref<Step[]>([])
const summary = ref('')

const hex = (n: bigint, pad = 0) => '0x' + n.toString(16).padStart(pad, '0')

function parse(s: string): bigint | null {
  const t = s.trim().replace(/_/g, '').toLowerCase()
  if (!/^(0x)?[0-9a-f]{1,16}$/.test(t)) return null
  return BigInt(t.startsWith('0x') ? t : '0x' + t)
}

const parsed = computed(() => parse(input.value))
const fields = computed(() => {
  const va = parsed.value
  if (va === null) return null
  return [
    { name: 'L4 (PML4)', bits: '47–39', value: (va >> 39n) & 0x1ffn, cls: 'f1' },
    { name: 'L3 (PDPT)', bits: '38–30', value: (va >> 30n) & 0x1ffn, cls: 'f2' },
    { name: 'L2 (PD)', bits: '29–21', value: (va >> 21n) & 0x1ffn, cls: 'f3' },
    { name: 'L1 (PT)', bits: '20–12', value: (va >> 12n) & 0x1ffn, cls: 'f4' },
    { name: 'Offset', bits: '11–0', value: va & 0xfffn, cls: 'f5' },
  ]
})

function tlbLookup(vpn: bigint) {
  const i = state.tlb.findIndex((e) => e.vpn === vpn)
  if (i < 0) return null
  const [e] = state.tlb.splice(i, 1)
  state.tlb.unshift(e)
  return e.pfn
}

function tlbFill(vpn: bigint, pfn: bigint): bigint | null {
  state.tlb.unshift({ vpn, pfn })
  if (state.tlb.length > TLB_SIZE) return state.tlb.pop()!.vpn
  return null
}

/** Translate one address. When `log` is set, record each hardware/kernel step. */
function access(va: bigint, log: Step[] | null): bigint | null {
  const push = (kind: Step['kind'], text: string) => log?.push({ kind, text })
  state.stats.accesses++
  if (va >= 0x800000000000n) {
    state.stats.segv++
    push('error', `${hex(va)} is in the kernel half / non-canonical range. User mode may not touch it → fault → SIGSEGV.`)
    return null
  }
  const vpn = va / PAGE
  const off = va % PAGE

  const hit = tlbLookup(vpn)
  if (hit !== null) {
    state.stats.hits++
    push('hit', `TLB hit for VPN ${hex(vpn)} → frame ${hex(hit)}. No page-table memory accesses needed.`)
    const pa = hit * PAGE + off
    push('ok', `Physical address = frame ${hex(hit)} × 4096 + offset ${hex(off)} = ${hex(pa)}`)
    return pa
  }

  state.stats.misses++
  push('miss', `TLB miss for VPN ${hex(vpn)}. The MMU walks the page table, starting at CR3.`)
  for (let attempt = 0; attempt < 2; attempt++) {
    const idx = [39n, 30n, 21n, 12n].map((s) => (va >> s) & 0x1ffn)
    const names = ['PML4', 'PDPT', 'PD', 'PT']
    const pfn = state.pageTable.get(vpn)
    if (attempt === 1) push('info', 'Retry: the TLB still has no entry, so the MMU walks the table again.')
    // Simplification: upper-level tables always exist, so only the last level can be missing.
    for (let l = 0; l < 4; l++) {
      state.stats.walkRefs++
      const last = l === 3
      if (last && pfn === undefined) {
        push('info', `Read ${names[l]}[${idx[l]}] (memory access ${l + 1}/4): Present bit = 0.`)
      } else {
        push('info', `Read ${names[l]}[${idx[l]}] (memory access ${l + 1}/4) → ${last ? 'frame ' + hex(pfn!) : 'next-level table'}`)
      }
    }
    if (pfn !== undefined) {
      const evicted = tlbFill(vpn, pfn)
      push('info', `Fill TLB with VPN ${hex(vpn)} → ${hex(pfn)}${evicted !== null ? ` (evicts LRU entry VPN ${hex(evicted)})` : ''}.`)
      const pa = pfn * PAGE + off
      push('ok', `Physical address = ${hex(pa)}`)
      return pa
    }

    // Page fault: trap into the kernel.
    const vma = vmas.find((v) => va >= v.start && va < v.end)
    if (!vma) {
      state.stats.segv++
      push('error', `Page fault → kernel finds no VMA containing ${hex(va)} → sends SIGSEGV. (Segmentation fault.)`)
      return null
    }
    state.stats.faults++
    const frame = state.nextPfn++
    state.pageTable.set(vpn, frame)
    push('fault', `Page fault (#PF). Kernel finds VMA "${vma.name}", allocates zeroed frame ${hex(frame)}, writes the PTE and returns. The CPU re-executes the instruction.`)
  }
  return null
}

function translate() {
  const va = parsed.value
  summary.value = ''
  if (va === null) {
    steps.value = [{ kind: 'error', text: 'Enter a hex address such as 0x401a2c.' }]
    return
  }
  const log: Step[] = []
  access(va, log)
  steps.value = log
}

function preset(a: string) {
  input.value = a
  translate()
}

function sweep(start: bigint, bytes: bigint, stride: bigint, label: string) {
  const before = { ...state.stats }
  for (let a = start; a < start + bytes; a += stride) access(a, null)
  const d = (k: keyof typeof before) => state.stats[k] - before[k]
  steps.value = []
  summary.value = `${label}: ${d('accesses')} accesses → ${d('hits')} TLB hits, ${d('misses')} TLB misses, ${d('faults')} page faults, ${d('walkRefs')} extra memory reads for page walks.`
}

function reset() {
  initState()
  steps.value = []
  summary.value = ''
}
</script>

<template>
  <div class="widget translator">
    <h4>Try it: virtual → physical translation</h4>
    <p class="intro">
      A toy x86-64 MMU with a 4-entry TLB. Mapped regions: code <code>0x400000–0x40ffff</code> (first 4 pages already
      resident), heap <code>0x600000–0x6fffff</code> (nothing resident yet), stack near <code>0x7ffffffff000</code>.
    </p>

    <div class="row">
      <input v-model="input" class="addr" spellcheck="false" aria-label="Virtual address" @keyup.enter="translate" />
      <button class="primary" @click="translate">Translate</button>
      <button @click="reset">Reset</button>
    </div>

    <div v-if="fields" class="fields">
      <div v-for="f in fields" :key="f.name" class="field" :class="f.cls">
        <span class="fname">{{ f.name }}</span>
        <span class="fval">{{ f.value.toString() }}</span>
        <span class="fbits">bits {{ f.bits }}</span>
      </div>
    </div>

    <div class="row presets">
      <span class="plabel">Single access:</span>
      <button @click="preset('0x401a2c')">code</button>
      <button @click="preset('0x401ff0')">same page</button>
      <button @click="preset('0x6000a0')">heap (first touch)</button>
      <button @click="preset('0x7ffffffffe10')">stack</button>
      <button @click="preset('0x0')">NULL</button>
      <button @click="preset('0xffff888000001000')">kernel</button>
    </div>
    <div class="row presets">
      <span class="plabel">Loops:</span>
      <button @click="sweep(0x620000n, 16384n, 64n, 'Sequential scan of 16 KiB, 64 B stride')">sequential 16 KiB</button>
      <button @click="sweep(0x640000n, 8n * 4096n, 4096n, 'Stride of 4096 B across 8 pages')">stride 4 KiB × 8 pages</button>
    </div>

    <ol v-if="steps.length" class="steps">
      <li v-for="(s, i) in steps" :key="i" :class="s.kind">{{ s.text }}</li>
    </ol>
    <p v-if="summary" class="summary">{{ summary }} Run it again to see the difference once pages are resident.</p>

    <div class="stats">
      <div><b>{{ state.stats.accesses }}</b><span>accesses</span></div>
      <div><b>{{ state.stats.hits }}</b><span>TLB hits</span></div>
      <div><b>{{ state.stats.misses }}</b><span>TLB misses</span></div>
      <div><b>{{ state.stats.faults }}</b><span>page faults</span></div>
      <div><b>{{ state.stats.segv }}</b><span>SIGSEGV</span></div>
    </div>
    <div class="tlb">
      <span class="plabel">TLB (most recent first):</span>
      <code v-for="e in state.tlb" :key="e.vpn.toString()">{{ hex(e.vpn) }} → {{ hex(e.pfn) }}</code>
      <span v-if="!state.tlb.length" class="empty">empty</span>
    </div>
  </div>
</template>

<style scoped>
.intro {
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  margin: 0 0 12px;
}
.addr {
  font-family: var(--vp-font-family-mono) !important;
  width: 210px;
  flex: 1 1 180px;
  max-width: 260px;
}
.fields {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  margin: 14px 0;
}
.field {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 2px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.3;
  text-align: center;
}
.fname {
  font-weight: 600;
}
.fval {
  font-family: var(--vp-font-family-mono);
  font-size: 16px;
  font-weight: 600;
}
.fbits {
  color: var(--vp-c-text-2);
}
.f1 { background: var(--d-a-soft); }
.f2 { background: var(--d-c-soft); }
.f3 { background: var(--d-d-soft); }
.f4 { background: var(--d-b-soft); }
.f5 { background: var(--vp-c-default-soft); }
.presets {
  margin-top: 8px;
}
.presets button {
  padding: 4px 10px;
  font-size: 13px;
}
.plabel {
  font-size: 13px;
  color: var(--vp-c-text-2);
  min-width: 90px;
}
.steps {
  margin: 16px 0 0;
  padding-left: 22px;
  font-size: 14px;
  line-height: 1.55;
}
.steps li {
  margin: 4px 0;
}
.steps .hit, .steps .ok { color: var(--ok); }
.steps .miss { color: var(--d-a); }
.steps .fault { color: var(--d-d); }
.steps .error { color: var(--bad); }
.summary {
  font-size: 14px;
  margin: 14px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--vp-c-bg);
}
.stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  margin-top: 16px;
  text-align: center;
}
.stats div {
  display: flex;
  flex-direction: column;
  padding: 6px 2px;
  border-radius: 8px;
  background: var(--vp-c-bg);
}
.stats b {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.stats span {
  font-size: 11px;
  color: var(--vp-c-text-2);
}
.tlb {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 12px;
  font-size: 13px;
}
.empty {
  color: var(--vp-c-text-3);
}
@media (max-width: 520px) {
  .fields {
    grid-template-columns: repeat(3, 1fr);
  }
  .stats {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
