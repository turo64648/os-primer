---
title: 4. Virtual Memory
---

<script setup>
import { cards, quiz } from './vm-review'
</script>

# 4. Virtual Memory

Virtual memory is the single most important idea in a modern OS. Processes, `fork`, shared libraries,
`mmap`, containers' memory limits and most "why is my service slow" stories about memory all rest on it.
It's also the favourite source of interview follow-ups, because a good answer naturally chains from
definitions into hardware, kernel and production behaviour.

::: info What you'll be able to explain after this chapter
- How a virtual address becomes a physical one, step by step, on x86-64
- Why page tables are trees, and what each entry contains
- What the TLB is, what a miss costs, and what happens to it on a context switch
- The kinds of page fault, what each costs, and how to measure them
- When huge pages help and when they hurt
- How all of this shows up in databases, `fork`, `mmap` and latency-sensitive services
:::

## The problem virtual memory solves

Imagine programs used **physical** addresses directly, as early computers and today's small
microcontrollers do. Several problems appear at once:

- **No isolation.** A stray pointer in one program can overwrite another program, or the kernel.
- **Relocation.** Every program must be loaded at a different physical address, so either the compiler must
  know where it will run, or the loader must patch every address.
- **Fragmentation.** Programs start and exit, leaving holes in RAM. A new program needing 100 MB may not
  fit in any single hole even when 1 GB is free in total.
- **Limited to physical RAM**, and no easy way to share memory between programs only where you want to.

Virtual memory solves all of these with **one level of indirection, enforced by hardware on every memory
access**. Each process gets its own private address space. Every load, store and instruction fetch uses a
*virtual* address, which the CPU's **memory management unit (MMU)** translates to a *physical* address using
tables that the **kernel** maintains.

That indirection is what makes all of these possible:

| Feature | How the indirection enables it |
|---|---|
| Isolation | A process can only reach frames that its own page table points to. |
| Simple loading | Every program can use the same virtual layout, wherever it sits in RAM. |
| No external fragmentation | Contiguous virtual pages can map to scattered physical frames. |
| Sharing | Two page tables can point at the same frame (shared libraries, shared memory). |
| Lazy allocation | A virtual page can be valid but have no frame until it's first touched. |
| Copy-on-write | `fork` shares frames read-only and copies only on write. |
| Memory-mapped files | A virtual page can be backed by a file, filled on demand from the page cache. |
| Protection | Per-page read / write / execute / user permissions. |
| Swapping | A page's contents can be moved to disk and brought back on access. |

::: tip Remember the split of responsibilities
The **hardware** translates every access and raises a fault when it can't. The **kernel** decides what the
mappings are, and handles faults. On a normal access the kernel isn't involved at all.
:::

## Pages and frames

Translating each byte individually would need absurdly large tables, so memory is managed in fixed-size
blocks:

- A **page** is a block of *virtual* memory, usually **4 KiB** (4096 bytes).
- A **frame** (or page frame) is a block of *physical* memory of the same size.
- The page table maps **virtual page numbers (VPN)** to **physical frame numbers (PFN)**.

Because 4096 = 2<sup>12</sup>, the low 12 bits of an address are the **offset** within the page and the
rest is the page number. Only the page number is translated; the offset is copied unchanged.

```text
virtual address   0x00007f3a12345678
page number       0x00007f3a12345      (address >> 12)
offset                         0x678   (address & 0xfff)

if the page table maps VPN 0x7f3a12345 -> PFN 0x1b2c4, then
physical address  0x1b2c4678           (PFN << 12 | offset)
```

<VmOverviewDiagram />

Fixed-size pages are what eliminate external fragmentation: any free frame will do for any page. The price is
**internal fragmentation**, since a 100-byte allocation still occupies part of a 4 KiB page. That trade-off
comes back when we discuss huge pages.

## Page tables

### Why not one big array?

The simplest page table is an array indexed by page number. On x86-64, user space has 2<sup>47</sup> bytes
of virtual addresses, which is 2<sup>35</sup> pages (the full 48-bit space is 2<sup>36</sup>). With 8 bytes
per entry that is **hundreds of GiB of page table per process**, almost all of it describing addresses the
process never uses.

Real address spaces are **sparse**: a bit of code near the bottom, a heap, some libraries, a stack near the
top, and terabytes of nothing between them. So page tables are **trees** (radix trees) where whole subtrees
are simply absent for unused regions.

### The x86-64 four-level walk

x86-64 uses 48-bit virtual addresses (57-bit with 5-level paging on newer CPUs). The address is split into
four 9-bit indices and a 12-bit offset:

<PageWalkDiagram />

1. The **CR3** register holds the physical address of the top-level table, the **PML4**. Each process has its
   own, and switching processes means loading a new value into CR3.
2. Bits 47–39 index the PML4. The entry found there points to a **PDPT**.
3. Bits 38–30 index the PDPT, which points to a **page directory (PD)**.
4. Bits 29–21 index the PD, which points to a **page table (PT)**.
5. Bits 20–12 index the PT, whose entry holds the **frame number**.
6. Frame number + the 12-bit offset = the physical address.

Notice the design: 9 bits index 512 entries, and 512 entries × 8 bytes = **4096 bytes, exactly one page**.
Every table is itself one page-sized frame, so the kernel allocates page tables with the same allocator as
everything else.

A small process might touch a few megabytes in three or four regions. Its page tables need one PML4 plus a
handful of lower-level tables for each region: a few dozen KiB instead of hundreds of GiB. That is the whole
point of the tree.

::: details Canonical addresses: why there's a huge hole in the middle
With 48-bit addressing, bits 63–48 of a pointer must be copies of bit 47. Addresses that follow this rule are
**canonical**; using any other address raises a fault. This splits the 64-bit space into a *lower half*
(`0x0000000000000000`–`0x00007fffffffffff`, user space on Linux) and an *upper half*
(`0xffff800000000000`–`0xffffffffffffffff`, the kernel), with an enormous unusable gap in between. 5-level
paging (57-bit addresses, 128 PiB) moves the boundary but keeps the idea.
:::

### What's in a page table entry

Each 8-byte entry (PTE) holds a frame number plus flag bits that the hardware checks on every access:

| Bit | Meaning | Why it matters |
|---|---|---|
| **Present (P)** | The entry is valid and points to a frame. | If 0, any access faults. The kernel is free to use the other bits, e.g. to record where a swapped-out page lives. |
| **Read/Write (R/W)** | Writes allowed. | Read-only code; copy-on-write works by clearing this bit. |
| **User/Supervisor (U/S)** | User mode may access. | Keeps the kernel's mappings unreachable from user code. |
| **Accessed (A)** | Set by hardware on any access. | The kernel scans and clears it to approximate "recently used" when choosing pages to evict. |
| **Dirty (D)** | Set by hardware on a write. | A clean file-backed page can simply be dropped; a dirty one must be written back first. |
| **No-execute (NX)** | Instruction fetches forbidden. | Stops injected data (e.g. on the stack) being run as code. |
| **Global (G)** | Not flushed from the TLB on CR3 switches. | Used for kernel mappings, which are identical in every process. |
| **Page size (PS)** | In a PD or PDPT entry: this entry maps a huge page directly. | 2 MiB or 1 GiB pages end the walk early. |

### Who walks the table?

On x86 and ARM, the walk is done by a **hardware page walker** inside the MMU. The kernel only writes the
tables; it never runs code for a normal translation. (Some older architectures such as MIPS used a
*software-managed* TLB, where every TLB miss trapped into the kernel. That's rare today, but a nice
contrast to mention in an interview.)

## The TLB

A four-level walk means up to **four extra, dependent memory reads** before the real read can even begin.
Dependent means each must finish before the next can start, because it supplies the address of the next
table. Doing that on every access would make memory several times slower.

The fix is a cache. The **translation lookaside buffer (TLB)** is a small, very fast, per-core cache of
recent translations: *virtual page → physical frame + permissions*.

- A **TLB hit** costs essentially nothing; the lookup happens in parallel with the L1 cache access.
- A **TLB miss** triggers the page walk. If the page-table entries are in the CPU caches, it costs tens of
  cycles; if they must come from DRAM, it can be hundreds.

Modern cores have a two-level TLB: a small L1 data TLB (tens of entries) and a larger shared L2 TLB
(roughly 1,000–3,000 entries). Exact sizes vary by CPU generation; the order of magnitude is what matters.

### TLB reach

The most useful number to reason with is **TLB reach**: entries × page size.

```text
1,536 entries × 4 KiB  ≈ 6 MiB
1,536 entries × 2 MiB  ≈ 3 GiB
```

A workload whose hot data fits in the reach barely misses. A workload doing **random access over gigabytes**
(hash tables, B-trees, graph traversal, a database buffer pool, embedding tables) misses on almost every
access, and can spend a significant share of its time in page walks. This is the main reason huge pages
exist.

<AddressTranslator />

Things to try in the widget above:

1. Translate the **code** address twice. The first access misses the TLB and walks; the second is a hit.
2. Try **heap (first touch)**: the walk finds `Present = 0`, the kernel handles a page fault, and the access
   retries.
3. Try **NULL** and **kernel**: both end in `SIGSEGV`, for different reasons.
4. Run **sequential 16 KiB**: 256 accesses touch only 4 pages, so almost everything hits.
5. Run **stride 4 KiB × 8 pages** twice: every access is a new page, and with only 4 TLB entries and LRU
   replacement, the TLB thrashes even on the second run.

### The TLB and context switches

TLB entries belong to one address space. When the CPU switches to another process, the old translations are
wrong for the new one. There are two ways to handle this:

- **Flush the TLB** on every switch. This was the classic x86 behaviour on a CR3 write. The new process
  starts with a cold TLB and pays a burst of misses.
- **Tag the entries** with an address-space ID (**PCID** on x86, **ASID** on ARM). Entries from other
  processes simply don't match, so nothing needs flushing, and a process switched back in may still find its
  entries warm.

Kernel mappings are the same in every process, so they're marked **Global** and survive switches either way.

This is also one concrete reason **switching between threads of the same process is cheaper than switching
between processes**: threads share one address space, so CR3 doesn't change and the TLB stays valid.

::: warning Meltdown and KPTI
After the Meltdown vulnerability (2018), Linux adopted **kernel page-table isolation (KPTI)** on affected
CPUs: user space runs with page tables that map almost none of the kernel, so every syscall and interrupt
switches CR3 twice. Without PCID that would flush the TLB on every syscall; PCID is what keeps KPTI's cost
tolerable. More in [Security & Isolation](/systems/security).
:::

### TLB shootdowns

TLBs are **not** kept coherent with page tables by hardware. If the kernel changes or removes a mapping, for
example on `munmap`, `mprotect`, page migration or reclaim, other cores running the same process may still
hold the old translation.

The kernel must therefore send an **inter-processor interrupt (IPI)** to each of those cores, telling them to
invalidate the entry, and usually wait for them to acknowledge. This is a **TLB shootdown**.

Shootdowns are expensive and grow with the number of cores the process runs on. A heavily multithreaded
program that frequently unmaps memory (for instance, an allocator returning memory to the OS with
`madvise(MADV_DONTNEED)` on every free) can lose a lot of time to them. On Linux you can see the count in
`/proc/interrupts` on the `TLB` line.

## Page faults

When the MMU can't complete a translation, because the entry isn't present or the access isn't permitted,
it raises a **page fault** exception. The CPU saves the faulting address (in CR2 on x86) and jumps into the
kernel's page-fault handler.

<PageFaultDiagram />

The handler first looks up the faulting address in the process's list of **virtual memory areas (VMAs)**.
A VMA describes one contiguous region: its start and end, permissions, and what backs it (a file, or
anonymous memory). You'll see VMAs again in `/proc/<pid>/maps`. The outcome is one of:

| Kind | What happened | Typical cost |
|---|---|---|
| **Minor fault** | The page can be provided without I/O: first touch of anonymous memory (a fresh zeroed frame), a file page already in the page cache but not yet mapped by this process, or a copy-on-write copy. | Around a microsecond or less |
| **Major fault** | The data must be read from storage: a file page not in the page cache, or a page that was swapped out. The thread blocks. | ~100 µs on SSD, ~10 ms on a spinning disk |
| **Invalid access** | No VMA contains the address, or the access breaks its permissions. | The process gets `SIGSEGV` (or `SIGBUS` in some mmap cases) |

After a successful minor or major fault, the kernel writes the page table entry and returns. The CPU
**re-executes the faulting instruction**, which now succeeds. The program never knows a fault happened, only
that the instruction took longer.

### Demand paging

Linux almost never allocates physical memory when you ask for it. `mmap` and `malloc` only create or extend a
VMA, which is just bookkeeping. Frames are assigned lazily, one page at a time, by the fault handler when a
page is first touched. This is **demand paging**.

Some consequences worth knowing:

- `malloc(1 GiB)` returns immediately and RSS doesn't move until you write to the memory.
- Reading an untouched anonymous page maps a shared, read-only **zero page**; only a write allocates a
  private frame.
- Because allocation is lazy, the kernel can promise more memory than exists (**overcommit**). The bill arrives
  later, at page-fault time, possibly as a visit from the OOM killer. That story is in
  [Kernel Memory Management](/memory/kernel-memory).
- The cost of allocation moves from the `malloc` call to the **first access**, which may be in a hot path.

### Try it: watch page faults happen

This program maps 256 MiB, touches one byte per page twice, and counts minor faults with `getrusage`:

```c
// faults.c: gcc -O2 faults.c -o faults && ./faults
#define _GNU_SOURCE
#include <stdio.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <time.h>
#include <unistd.h>

static long minor_faults(void) {
    struct rusage ru;
    getrusage(RUSAGE_SELF, &ru);
    return ru.ru_minflt;
}

static double now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1e3 + ts.tv_nsec / 1e6;
}

int main(void) {
    const size_t size = 256UL << 20;          // 256 MiB
    const long page = sysconf(_SC_PAGESIZE);  // usually 4096

    char *p = mmap(NULL, size, PROT_READ | PROT_WRITE,
                   MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    if (p == MAP_FAILED) { perror("mmap"); return 1; }

    for (int pass = 1; pass <= 2; pass++) {
        long f0 = minor_faults();
        double t0 = now_ms();
        for (size_t off = 0; off < size; off += page)
            p[off] = 1;                        // touch one byte per page
        printf("pass %d: %6ld minor faults, %7.1f ms\n",
               pass, minor_faults() - f0, now_ms() - t0);
    }
    return 0;
}
```

Typical output:

```text
pass 1:  65536 minor faults,    60.3 ms
pass 2:      0 minor faults,     2.1 ms
```

The first pass takes one fault per page (256 MiB / 4 KiB = 65,536); the second pass takes none and is far
faster. If transparent huge pages are set to `always` on your machine
(`cat /sys/kernel/mm/transparent_hugepage/enabled`), you may see only ~128 faults, one per 2 MiB, which is a
nice preview of the huge pages section. Adding `MAP_POPULATE` to the `mmap` flags moves all the faults into
the `mmap` call itself.

## The process address space

Putting it together, here is a typical Linux x86-64 process:

<AddressSpaceDiagram />

A few things to notice:

- **Text** (code) is read-only and executable, **data** and **heap** are writable but not executable.
  Position-independent executables (the default on modern distros) are loaded near `0x55…` rather than
  `0x400000`.
- The heap grows up (traditionally via `brk`), while the stack and the mmap region grow down. Big `malloc`
  requests usually become their own anonymous `mmap`.
- **ASLR** randomises the starting points of the stack, heap, mmap region and (for PIE) the executable, so
  attackers can't hard-code addresses.
- The **kernel's upper half is mapped into every process**, protected by the U/S bit. That's why a syscall
  doesn't need a page-table switch (KPTI aside).
- Page 0 and the pages around it are never mapped, so dereferencing `NULL` faults instead of reading garbage.

You can inspect the VMAs of any process. Each line is one VMA: address range, permissions (`p` = private,
`s` = shared), file offset, device, inode, and the backing file:

```text
$ cat /proc/self/maps
5604f1e00000-5604f1e02000 r--p 00000000 08:01 1310743   /usr/bin/cat
5604f1e02000-5604f1e07000 r-xp 00002000 08:01 1310743   /usr/bin/cat
5604f2a3b000-5604f2a5c000 rw-p 00000000 00:00 0         [heap]
7f5c8a800000-7f5c8a828000 r--p 00000000 08:01 1314302   /usr/lib/x86_64-linux-gnu/libc.so.6
7f5c8a828000-7f5c8a9bd000 r-xp 00028000 08:01 1314302   /usr/lib/x86_64-linux-gnu/libc.so.6
7ffd5c3f1000-7ffd5c412000 rw-p 00000000 00:00 0         [stack]
7ffd5c5b6000-7ffd5c5b8000 r-xp 00000000 00:00 0         [vdso]
```

::: tip VSZ vs RSS
**VSZ** (virtual size) is the total size of all VMAs. **RSS** (resident set size) is how much is actually in
RAM right now. A huge VSZ is normal and usually harmless: Go and Java runtimes, allocators and GPU drivers
reserve large virtual ranges up front. When someone says "this process uses 40 GB", ask which number they
mean.
:::

## Huge pages

x86-64 can also map memory in larger units by ending the walk early: an entry in the page directory maps a
**2 MiB** page (three-level walk), and an entry in the PDPT maps a **1 GiB** page (two-level walk).

**Benefits:**

- **512× the TLB reach** per entry for 2 MiB pages, so far fewer TLB misses on large working sets.
- **Shorter walks** when a miss does happen.
- **Fewer page-table pages**, which saves memory and makes `fork` cheaper.
- **Fewer page faults** when populating large regions.

**Costs:**

- **Memory bloat.** Touching one byte of a 2 MiB region commits all 2 MiB.
- **Expensive faults.** Each fault must zero 2 MiB instead of 4 KiB.
- **Needs contiguous physical memory.** On a long-running, fragmented system, the kernel may have to
  **compact** memory (move pages around) to create a free 2 MiB block, and that can stall the faulting
  thread.

Linux offers two mechanisms:

- **hugetlbfs**: explicit huge pages, reserved ahead of time (`vm.nr_hugepages`) and used via `mmap` with
  `MAP_HUGETLB` or a hugetlbfs mount. Predictable and never swapped, but must be planned and sized. Common
  for databases like Oracle and PostgreSQL (`huge_pages = on`), DPDK and VMs.
- **Transparent huge pages (THP)**: the kernel uses 2 MiB pages automatically for anonymous memory, either for
  everything (`always`), only for regions marked with `madvise(MADV_HUGEPAGE)` (`madvise`), or not at all
  (`never`). A background thread, `khugepaged`, collapses runs of small pages into huge ones.

::: warning The THP trade-off in practice
Several databases, Redis and MongoDB among them, have long recommended disabling THP (or setting it to
`madvise`) because of latency spikes from compaction and `khugepaged`, memory bloat, and more expensive
copy-on-write after `fork`. Meanwhile JVMs, ML training jobs and HPC codes often turn huge pages **on** for
throughput. The answer depends on whether you care more about **average throughput** or **tail latency**, and
that's precisely the kind of reasoning senior interviews look for.
:::

## Why this matters in real systems

**Page faults in the hot path.** Because allocation is lazy, the first request that touches new memory pays
for the faults. Latency-sensitive systems pre-fault at startup: `MAP_POPULATE`, touching every page, or the
JVM's `-XX:+AlwaysPreTouch`. Systems that can't tolerate a major fault at all (trading, audio, some real-time
control) use `mlock` / `mlockall` to pin their memory in RAM.

**Random access over large memory.** Hash tables, indexes, graph workloads and embedding lookups can be
TLB-bound rather than cache-bound. If `perf` shows many `dTLB-load-misses`, huge pages are often the fix.

**`fork` of a large process.** Redis snapshots (BGSAVE) by forking. `fork` doesn't copy data, thanks to
copy-on-write, but it **does copy page tables**: about 8 bytes per 4 KiB page, so ~100 MB of page tables for
50 GB of RSS. That can freeze the parent for tens to hundreds of milliseconds. After the fork, every page the
parent writes triggers a CoW copy, so a write-heavy parent can nearly double its memory use during a
snapshot.

**`mmap` for file I/O.** Mapping a file lets you read it like memory and lets processes share page-cache
pages. It's a popular way to load model weights (for example, safetensors and llama.cpp mmap weight files)
because loading is lazy and pages are shared between processes. But in a database it hands control of I/O to
the kernel: page faults are blocking I/O you can't schedule, make asynchronous or prioritise, and eviction is
the kernel's decision. See Crotty, Leis and Pavlo, *"Are You Sure You Want to Use MMAP in Your Database
Management System?"* (CIDR 2022), for the case against.

**Containers and memory accounting.** Container limits (cgroups) count resident memory, including page cache,
not virtual size. Understanding RSS vs VSZ vs page cache prevents a lot of wrong conclusions from `top`.

**GPUs and DMA.** Devices that copy memory directly (DMA), such as GPUs and NICs, need the physical frames to
stay put. That's why CUDA has **pinned (page-locked) host memory**: the kernel promises not to swap or move
those pages, which makes host-to-device transfers faster but reduces memory the kernel can manage.

**Measuring it.** Useful tools, from quick to deep:

```bash
/usr/bin/time -v ./prog            # "Minor/Major page faults" and max RSS
ps -o pid,min_flt,maj_flt,rss,vsz -p <pid>
perf stat -e page-faults,major-faults,dTLB-load-misses ./prog
grep -E 'thp|compact' /proc/vmstat # THP allocations, compaction stalls
cat /proc/<pid>/smaps_rollup       # RSS / PSS breakdown, AnonHugePages
```

## Interview questions

Try answering each one out loud before opening the model answer.

::: details 1. What is virtual memory, and why do we need it?
Virtual memory gives each process its own private address space. Every memory access uses a virtual address,
which the MMU translates to a physical address using page tables maintained by the kernel.

It gives us **isolation** (processes can't touch each other's memory), a **simple and uniform layout** for
every program, **no external fragmentation** because pages map to any free frame, **sharing** of libraries
and memory, **lazy allocation** and overcommit, **copy-on-write** `fork`, **memory-mapped files**,
per-page **protection** (read-only code, non-executable stacks), and **swapping**.

Senior add-on: the key design point is that translation is done by hardware on every access, while policy
lives in the kernel and only runs on faults. That's what makes it both fast and flexible.
:::

::: details 2. Walk me through what happens when a program loads from a virtual address.
1. The CPU looks the page number up in the **TLB**. On a hit, it gets the frame number and permissions and
   the load proceeds through the caches as normal.
2. On a miss, the **hardware page walker** starts at **CR3** and follows four levels (PML4 → PDPT → PD → PT),
   using 9 bits of the address at each level. Those reads can hit in the CPU caches.
3. If the final entry is present and permits the access, the translation is inserted in the TLB and the load
   completes.
4. If not, the MMU raises a **page fault**. The kernel looks up the VMA for the address:
   - no VMA or wrong permissions → `SIGSEGV`;
   - otherwise it resolves a **minor** fault (zero page, page-cache hit, CoW copy) or a **major** fault (read
     from disk or swap, blocking the thread), updates the PTE and returns.
5. The CPU **retries** the instruction, which now succeeds.

Mentioning Accessed/Dirty bits being set by hardware, and that the cost ranges from ~1 cycle (TLB hit) to
milliseconds (major fault), makes the answer stand out.
:::

::: details 3. Why are page tables multi-level? What's the trade-off?
A flat table covering a 48-bit address space would need hundreds of GiB per process, and almost all entries
would be empty because address spaces are sparse. A multi-level table is a radix tree: subtrees for unused
regions are simply absent, so memory use is proportional to what the process actually maps.

The trade-off is **walk length**: each level adds a dependent memory read on a TLB miss (4 on x86-64, 5 with
5-level paging). That's mitigated by the TLB, by paging-structure caches in the MMU, by the data caches, and by
huge pages, which shorten the walk.
:::

::: details 4. What is the TLB and what happens to it on a context switch?
It's a per-core cache of virtual → physical translations plus permissions, which avoids a page walk on almost
every access.

On a switch to a different process the translations are no longer valid. Either the TLB is flushed (classic
behaviour on a CR3 write), leaving the new process to warm it up again, or entries are tagged with a
**PCID/ASID** so the old ones just don't match and nothing needs flushing. Kernel entries are **global** and
survive either way. Switching between threads of the same process doesn't touch the TLB at all, since they
share page tables.

Follow-up worth knowing: under KPTI (the Meltdown mitigation), even syscalls switch page tables, which is why
PCID support matters so much for syscall-heavy workloads.
:::

::: details 5. Minor vs major page faults: what are they, and how would you measure them?
A **minor** fault is resolved without I/O: first-touch of anonymous memory, a file page already in the page
cache, or a CoW copy. It costs around a microsecond. A **major** fault needs I/O, either reading a file page
or swapping a page back in, and blocks the thread for ~100 µs (SSD) to ~10 ms (HDD).

Measure per process with `/usr/bin/time -v`, `ps -o min_flt,maj_flt`, `perf stat -e
page-faults,major-faults`, or `getrusage` in code; system-wide with `sar -B` or `vmstat` (look at swap-in
and major faults). A steady stream of major faults on a service usually means memory pressure: the
working set doesn't fit and pages are being evicted and re-read.
:::

::: details 6. A program mallocs 10 GB on a machine with 8 GB of RAM and it succeeds. How? What happens next?
`malloc` for large sizes calls `mmap`, which only creates a VMA; no physical memory is assigned. Linux's
default overcommit heuristics allow this. Frames are assigned lazily as pages are touched.

If the program then writes to all 10 GB, the kernel reclaims page cache, swaps if swap is configured, and
eventually, when it can't free enough, the **OOM killer** picks a process to kill (often this one). The
failure appears as a kill at some random write, not as a `NULL` return from `malloc`. With
`vm.overcommit_memory = 2` (strict accounting), the `malloc` would fail up front instead.
:::

::: details 7. What are huge pages? When would you use or avoid them?
Pages of 2 MiB or 1 GiB instead of 4 KiB, created by ending the page walk early. They increase TLB reach by
512× (or more), shorten walks, reduce page-table memory and reduce the number of faults.

**Use them** for large, long-lived, densely used memory where TLB misses matter: database buffer pools, JVM
heaps, in-memory caches, VMs, HPC and ML workloads.

**Avoid or restrict them** (e.g. THP `madvise` instead of `always`) for latency-sensitive services with sparse
memory use or frequent `fork`: they can cause memory bloat, expensive faults, compaction stalls and costlier
copy-on-write. Explicit hugetlbfs pages avoid the compaction problem because they're reserved up front.
:::

::: details 8. What is a TLB shootdown, and when does it hurt?
TLBs aren't coherent with page tables. When the kernel removes or changes a mapping that other cores may have
cached, it must send them IPIs to invalidate those entries and wait for them. That's a TLB shootdown.

It hurts in processes with many threads spread over many cores that frequently change mappings: allocators
returning memory with `munmap`/`madvise`, frequent `mprotect` (some GCs and JITs), or page migration (NUMA
balancing). The cost grows with core count. Mitigations: batch or avoid unmapping (allocator settings), keep
memory mapped and reuse it, and reduce the number of cores a process's threads spread across.
:::

::: details 9. Scenario: p99 latency spikes every few minutes on a service, but CPU usage is low. How could memory management be involved?
Hypotheses to check, roughly in order:

1. **Major faults / swapping**: check `maj_flt` and `vmstat` swap-in; the working set may not fit.
2. **THP compaction or khugepaged**: look at `compact_stall` and `thp_*` counters in `/proc/vmstat`; try THP
   `madvise` or `never` and compare.
3. **Direct reclaim**: under memory pressure, allocating threads reclaim memory themselves (`allocstall` in
   `/proc/vmstat`, or cgroup `memory.pressure` / PSI).
4. **Large forks** (snapshots, subprocess spawning from a big process) pausing to copy page tables.
5. **TLB shootdowns** from periodic unmapping (look at the `TLB` line in `/proc/interrupts`).
6. Also rule out non-memory causes, like GC pauses, which often correlate with memory growth.

Then confirm with `perf` or eBPF tools (off-CPU analysis, fault tracing) before changing anything. A good
answer shows a hypothesis → evidence → fix loop rather than jumping to a solution.
:::

::: details 10. mmap a file vs read() it: what are the trade-offs?
**`mmap`**: no copy from page cache into a user buffer, simple pointer-based access, lazy loading, pages
shared between processes, and the kernel handles caching. **But**: I/O happens implicitly in page faults,
which block and can't be made async or prioritised; errors arrive as `SIGBUS` instead of return codes;
eviction and write-back timing are up to the kernel; remapping and TLB shootdowns cost; and on 32-bit
systems address space runs out.

**`read`/`pread`** (or `io_uring`): an extra copy, but explicit control over what is read, when, in what
order and asynchronously, plus clean error handling. Databases usually prefer this, often with their own
buffer pool and `O_DIRECT`. Read-mostly workloads where simplicity and sharing matter (loading model weights,
static assets) often prefer `mmap`.
:::

::: details 11. How can two processes use the same virtual address for different data? And how do they share memory?
Each process has its own page tables, so virtual address `0x7f00…` in process A and in process B translate
through different trees to different frames. The address alone means nothing without the address space.

To share, both page tables point at the **same frames**: via `mmap` of the same file with `MAP_SHARED`,
POSIX/System V shared memory, or implicitly for read-only library code and CoW pages after `fork`. The shared
region can even sit at different virtual addresses in each process, which is why shared-memory data
structures use offsets rather than raw pointers.
:::

## Common misconceptions

- **"Virtual memory means swap."** Swap is one feature built on virtual memory. A machine with no swap at all
  still uses virtual memory for every access.
- **"`malloc` allocates physical memory."** It reserves virtual address space. Physical frames arrive on first
  touch.
- **"The kernel translates every address."** The MMU does, in hardware. The kernel only builds the tables and
  handles faults.
- **"A context switch always flushes the TLB."** Not with PCID/ASID, never for global kernel entries, and
  never between threads of the same process.
- **"High VSZ means high memory use."** VSZ counts reservations; RSS and PSS describe real use.
- **"A segmentation fault is about segments."** The name is historical. On x86-64 it almost always means a
  page fault that the kernel couldn't resolve: no mapping, or a permission violation.
- **"Huge pages are always faster."** They usually improve throughput, but can hurt tail latency and memory
  use.

## Key takeaways

- Virtual memory is **hardware translation plus kernel policy**: the MMU translates every access; the kernel
  sets up mappings and handles faults.
- Addresses are split into a page number and an offset; page tables map pages to frames, and are **radix
  trees** because address spaces are sparse.
- The **TLB** makes translation nearly free on hits. Think in terms of **TLB reach**. Context switches and
  unmapping have hidden TLB costs (flushes, shootdowns).
- **Page faults** are normal: they implement lazy allocation, file mapping and CoW. Minor faults cost ~µs,
  major faults cost I/O.
- **Huge pages** trade memory efficiency and tail latency for TLB reach and throughput.

## Review

<Flashcards id="virtual-memory" :cards="cards" />

<Quiz id="virtual-memory" :questions="quiz" />

<MarkDone id="virtual-memory" />
