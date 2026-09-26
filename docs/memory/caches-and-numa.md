---
title: 7. CPU Caches & NUMA
---

<script setup>
import { cards } from './caches-and-numa-review'
</script>

# 7. CPU Caches & NUMA

A CPU core can do hundreds of operations in the time it takes to fetch one value from main memory. Caches hide
that gap, and whether your data layout works with them or against them often matters more than the
algorithm. Senior interviews probe this through questions about false sharing, "why is this loop 20 times
slower?", and how to place work on a server with more than one CPU socket.

::: info Before you start
- Programs use memory through **addresses**, and the hardware translates them to real RAM locations.
  [Chapter 4](/memory/virtual-memory) explains this, including the <Term id="tlb">TLB</Term>, a separate
  cache for those translations.
- A <Term id="thread">thread</Term> is one sequence of instructions running inside a
  <Term id="process">process</Term>. Threads of one process share its memory and can run on different CPU
  cores at the same time.
- You need nothing else. Every hardware term is explained here when it first appears.
:::

## Why caches exist

**In short:** main memory is about a hundred times slower than the CPU core. Small, fast memories close to the
core keep copies of recently used data, so most accesses never wait for main memory.

A modern core can run several instructions every nanosecond. Reading a value from main memory, the DRAM chips
on the motherboard, takes about 100 nanoseconds. If every access went to main memory, the core would spend
almost all its time waiting.

So the CPU keeps copies of recently used memory in small, fast memories built into the chip. These are
<Term id="cpu-cache">CPU caches</Term>. When the core reads an address, it checks the caches first. If the
data is there, a **cache hit**, the read takes a few nanoseconds or less. If not, a **cache miss**, it goes
further out, and the data is copied into the caches on the way back.

Caches work because programs are predictable in two ways. This is called
<Term id="locality">locality</Term>:

- **Time:** data used recently is likely to be used again soon, such as a loop counter or a hot object.
- **Space:** data next to recently used data is likely to be used soon, such as the next element of an array.

Programs with good locality run almost entirely from cache. Programs without it run at the speed of main
memory. The rest of this chapter is about telling the two apart and moving code from the second group to the
first.

## The cache hierarchy

**In short:** there are usually three levels of cache. Each level is bigger and slower than the one before.
The first two belong to one core; the last is shared by all cores.

One cache cannot be both big and fast: a bigger memory takes longer to search and is farther from the core.
So CPUs use a hierarchy of caches:

<CacheHierarchyDiagram />

| Level | Typical size | Rough latency | Shared by |
|---|---|---|---|
| **L1** | 32–64 KiB per core, for data (plus as much for code) | about 1 ns (a few cycles) | one core |
| **L2** | 256 KiB to a few MiB per core | about 3–5 ns | one core |
| **L3** | several MiB to hundreds of MiB | about 10–40 ns | all cores on the chip |
| **Main memory** | GiB to TiB | about 80–120 ns | everyone |

These numbers vary with each CPU generation. Remember the ratios: L1 is roughly 100 times faster than main
memory, and each level is several times slower than the one above.

A useful way to think about it: if your program's frequently used data fits in L2, it is fast. If it fits in
L3, it is fine. If it is scattered across gigabytes, every access that misses costs about 100 ns.

::: details Going deeper: more cache details
- L1 is split into an **instruction cache** for code and a **data cache** for data. L2 and L3 hold both.
- Some L3 caches are **inclusive** (they hold a copy of everything in the L1 and L2 caches below them) and
  some are not. This affects how much total data fits, and how a core finds data in another core's cache.
- On many AMD chips, the L3 is shared by one group of cores (a "core complex"), not the whole chip. Two
  threads in different groups communicate at a cost closer to main memory.
- Caches are **write-back**: a write changes the cached copy only. The changed line is written to main memory
  later, when it is evicted.
- Two hardware threads on one core (hyper-threading, or SMT) share that core's L1 and L2. They compete for
  the same cache space.
:::

## Cache lines

**In short:** caches move memory in fixed blocks of 64 bytes, called cache lines. Reading one byte loads its
whole line, so data that sits together is cheap to read together.

The caches never fetch a single byte. They move memory in fixed-size blocks called
<Term id="cache-line">cache lines</Term>, 64 bytes on x86 and on most ARM chips. Reading one `int` from main
memory brings in the 64 bytes around it. The next 15 `int`s of the array are now in cache for free.

This is why the order in which you visit memory matters so much. Consider a matrix stored row by row, the
way C stores a 2-D array. Summing it row by row reads memory in order: each line fetched is fully used.
Summing it column by column jumps a whole row ahead on each step: each line fetched is used for one value,
then evicted before the next column comes back to it.

### Try it: rows versus columns

```c
// traverse.c: gcc -O2 traverse.c -o traverse && ./traverse
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define N 8192                               // 8192 x 8192 ints = 256 MiB

static double now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1e3 + ts.tv_nsec / 1e6;
}

int main(void) {
    int *m = malloc(sizeof(int) * N * N);
    if (!m) return 1;
    for (long i = 0; i < (long)N * N; i++) m[i] = 1;

    long sum = 0;
    double t0 = now_ms();
    for (int row = 0; row < N; row++)        // row by row: neighbours in memory
        for (int col = 0; col < N; col++)
            sum += m[(long)row * N + col];
    double t1 = now_ms();
    for (int col = 0; col < N; col++)        // column by column: jumps 32 KiB each step
        for (int row = 0; row < N; row++)
            sum += m[(long)row * N + col];
    double t2 = now_ms();

    printf("row by row:       %6.0f ms\n", t1 - t0);
    printf("column by column: %6.0f ms\n", t2 - t1);
    printf("(sum %ld)\n", sum);
    return 0;
}
```

Output on a 4-core cloud virtual machine (your numbers will differ):

```text
row by row:           33 ms
column by column:    922 ms
(sum 134217728)
```

Same data, same number of additions, about 28 times slower. Nothing about the algorithm changed; only the
order of memory accesses did.

### Prefetching

The row-by-row loop is fast for a second reason. The CPU notices that the program reads addresses in order,
and starts loading the next cache lines before the program asks for them. This is called
<Term id="prefetching">prefetching</Term>. It works for any regular pattern: forwards, backwards, or fixed
steps.

Prefetching cannot help when the next address depends on the data just read. Walking a linked list is the
classic case: the address of the next node is inside the current node. The CPU cannot fetch node 5 before it
has node 4. Every step is a full cache miss, one after another. This is called **pointer chasing**.

That is why iterating over an array can be many times faster than iterating over a linked list with the same
elements, even though both are O(n).

::: details Going deeper: why misses are not all equal
- A modern core can keep many cache misses in flight at once, around ten or more per core. Independent
  accesses, such as reading many array elements, overlap their waits. Pointer chasing cannot, because each
  address depends on the previous result. This ability is called **memory-level parallelism**.
- Programs can ask for a prefetch explicitly with `__builtin_prefetch(addr)` in GCC and Clang. It helps only
  when you know the address well ahead of time, for example a few iterations ahead in a hash join.
- Misses are often grouped into "three Cs": **compulsory** (first touch of that data), **capacity** (the
  working data is bigger than the cache) and **conflict** (too many lines compete for the same spot in the
  cache). A fourth, **coherence** misses, comes from other cores writing the line; see the next section.
- **Conflict misses:** each address can live in only a few places (ways) in the cache, chosen from part of
  the address. Accesses separated by a large power of two, such as 4 KiB or 32 KiB, compete for the same
  few places. The column loop above suffers from this too. Padding each row by one cache line can help.
- The TLB matters for the same access patterns. Jumping 32 KiB each step also touches a new page each step.
:::

## Cache coherence: keeping cores in agreement

**In short:** every core has its own caches, so the hardware must make sure no core reads a stale copy. It
does this by tracking, per cache line, which core may write it. Writing a line forces other cores to drop
their copies.

Suppose core 0 and core 1 both have a copy of the same cache line. Core 0 writes to it. Core 1's copy is now
out of date. If core 1 then read its stale copy, shared-memory programs would be impossible to write.

So the caches follow a protocol that keeps all copies consistent. This is
<Term id="cache-coherence">cache coherence</Term>. The basic rule is simple: **many cores may hold a line for
reading, but only one may hold it for writing.** Before a core writes, it tells every other core holding the
line to throw its copy away.

The most common protocol is called **MESI**, after the four states a cache line can be in, in each core's
cache:

| State | Meaning | Can this core write it without asking? |
|---|---|---|
| **Modified** | Only this cache has it, and it has been changed. Main memory is out of date. | Yes |
| **Exclusive** | Only this cache has it, unchanged. | Yes, and it becomes Modified |
| **Shared** | Several caches may have it, unchanged. | No: it must first tell the others to drop theirs |
| **Invalid** | This cache's copy is not usable. | No: it must fetch the line first |

What this means for performance:

- **Reading shared data is cheap.** Any number of cores can hold a line in the Shared state.
- **Writing shared data is expensive.** Each write by a new core must remove the line from every other core,
  and the next reader must fetch it back from the writer. The line "bounces" between cores. Each bounce costs
  tens of nanoseconds or more.

This is why one counter updated by every thread scales badly, even with atomic instructions and no locks.
Every update moves the same line to another core.

::: details Going deeper: variants and how the messages travel
- Intel uses a variant called **MESIF** (adding Forward, the one sharer that answers requests), and AMD uses
  **MOESI** (adding Owned, which lets a changed line be shared without writing it to memory first).
- Cores within a chip find each other's copies through the shared L3 or a directory that records which cores
  hold each line. Between sockets, the messages cross the link between chips, which is much slower.
- Coherence makes all cores agree on each single cache line. It does not decide in what order a core's writes
  to **different** addresses become visible to others. That is the job of the memory model, covered in
  [Chapter 10](/cpu/concurrency-2).
:::

## False sharing

**In short:** two threads write different variables that happen to sit in the same cache line. The hardware
treats it as sharing, and the line bounces between their cores. The fix is to put the variables in
separate lines.

Picture two threads, each counting events in its own counter. The threads never touch each other's counter.
There is no data race and no lock. But the two counters are declared next to each other, so they sit in the
same 64-byte cache line.

Coherence works per cache line, not per variable. So every time thread A writes counter `a`, the line must be
taken away from thread B's core. Every time thread B writes `b`, it must be taken back. The line bounces
constantly, and both threads crawl. This is <Term id="false-sharing">false sharing</Term>: the hardware sees
sharing that the program never intended.

<FalseSharingDiagram />

### Try it: false sharing

Two threads each increment their own counter 50 million times. In the first run, the counters are 8 bytes
apart. In the second, they are 128 bytes apart:

```c
// falseshare.c: gcc -O2 -pthread falseshare.c -o falseshare && ./falseshare
#include <pthread.h>
#include <stdalign.h>
#include <stdatomic.h>
#include <stdio.h>
#include <time.h>

#define ITERS 50000000L

struct together { atomic_long a; atomic_long b; };                        // 8 bytes apart
struct apart { alignas(128) atomic_long a; alignas(128) atomic_long b; }; // 128 bytes apart

static struct together together;
static struct apart apart;

static void *count(void *arg) {
    atomic_long *counter = arg;
    for (long i = 0; i < ITERS; i++)
        atomic_fetch_add_explicit(counter, 1, memory_order_relaxed);
    return NULL;
}

static double run(atomic_long *x, atomic_long *y) {
    struct timespec t0, t1;
    pthread_t tx, ty;
    clock_gettime(CLOCK_MONOTONIC, &t0);
    pthread_create(&tx, NULL, count, x);     // each thread has its own counter
    pthread_create(&ty, NULL, count, y);
    pthread_join(tx, NULL);
    pthread_join(ty, NULL);
    clock_gettime(CLOCK_MONOTONIC, &t1);
    return (t1.tv_sec - t0.tv_sec) * 1e3 + (t1.tv_nsec - t0.tv_nsec) / 1e6;
}

int main(void) {
    printf("counters in the same cache line: %5.0f ms\n", run(&together.a, &together.b));
    printf("counters in separate lines:      %5.0f ms\n", run(&apart.a, &apart.b));
    return 0;
}
```

Output on a 4-core cloud virtual machine (your numbers will differ):

```text
counters in the same cache line:  1342 ms
counters in separate lines:        333 ms
```

The code does the same work in both runs. Only the distance between the two counters changed, and the first
run is about 4 times slower. On machines with more cores or two sockets, the gap is often larger.

The fixes all put data written by different threads into different cache lines:

- **Pad or align** per-thread data to the cache line size, as `alignas(128)` does above.
- **Use per-thread (or per-core) data** and combine it only when someone reads the total. Many metrics
  libraries count this way.
- **Group data by who writes it**, not by what it means. Fields written by one thread belong together; fields
  written by another thread belong in a different line.

::: details Going deeper: 64 or 128 bytes, and finding false sharing
- Some Intel CPUs fetch cache lines in adjacent pairs, so two lines 64 bytes apart can still interfere.
  That is why many libraries pad to 128 bytes. Apple's M-series chips use 128-byte lines.
- C++17 offers `std::hardware_destructive_interference_size` for this padding. Rust's crossbeam has
  `CachePadded`, and Java has the `@Contended` annotation.
- `perf c2c` on Linux finds cache lines that bounce between cores and shows which fields and code lines are
  involved.
- In simple tests, plain non-atomic writes sometimes show a smaller gap than atomic ones, depending on the
  CPU. The problem is still real in production code.
:::

## NUMA: memory that is near and far

**In short:** on servers with several CPU sockets, each socket has its own memory. Every core can use all
memory, but memory attached to its own socket is faster. The kernel tries to place memory near the threads
that use it.

A large server often has two CPU chips, each in its own socket on the motherboard. Each chip has its own
memory controller and its own set of RAM modules. The chips are joined by a fast link.

A core can read any memory address. But reading RAM attached to the other chip means crossing that link. It
takes longer, often 1.5 to 2 times the local latency, and the link has less bandwidth than local memory. This
design is called <Term id="numa">NUMA</Term>, non-uniform memory access. Each chip with its local memory is a
**NUMA node**.

<NumaDiagram />

### Where does memory end up?

By default, Linux places a page on the node of the CPU that **first touches** it: the thread that first
writes to the page, causing the page fault that gives it RAM. This is the **first-touch** policy.

It works well when each thread initialises the data it later uses. It goes wrong when one thread initialises
everything. For example, a loader thread fills a 100 GB table, then 64 worker threads spread across both
sockets use it. The whole table sits on the loader's node. Half the workers always read remote memory, and
that node's memory bandwidth becomes the bottleneck.

The kernel can also move threads between nodes to balance CPU load. A thread moved away from its memory now
reads everything remotely.

### What you can do

- **Keep a process on one node** when it fits there. Pin its threads and memory with
  `numactl --cpunodebind=0 --membind=0 ./prog`. Many services run one instance per node for this reason.
- **Interleave** memory across nodes with `numactl --interleave=all` when every thread uses all the data.
  Average latency is then the same for everyone, and bandwidth adds up across nodes. Databases that share one
  big cache across all cores often recommend this.
- **Initialise data in parallel**, with each thread touching the part it will later use.
- **Let the kernel help.** Automatic NUMA balancing watches which node uses each page and moves pages, or
  threads, to match. It helps many workloads, but the scanning and moving has its own cost.

::: details Going deeper: tools and details
- `lscpu` and `numactl --hardware` show the nodes, their CPUs and memory, and a distance table (10 means
  local; larger means farther). `lstopo` from hwloc draws the full layout, including caches and devices.
- `numastat -p <pid>` shows how much of a process's memory is on each node.
- Automatic NUMA balancing is the setting `kernel.numa_balancing`. It works by periodically making pages
  inaccessible, so the next access faults and the kernel learns which node used it.
- Single chips can be NUMA too. Large AMD EPYC and Intel Xeon chips can be configured to expose several
  nodes per socket (called NPS or sub-NUMA clustering). CXL memory expanders appear as extra nodes with no
  CPUs.
- The `vm.zone_reclaim_mode` setting makes the kernel reclaim local memory rather than use a remote node.
  Turned on, it can cause surprising reclaim stalls, so most servers keep it off, which is the default.
:::

## Data-oriented design

**In short:** lay out data so that each cache line you fetch is full of bytes you will use. Group hot fields
together, prefer arrays to pointers, and split data by how it is accessed.

The earlier sections point to one idea: memory is fetched in cache lines, so arrange data so that every
fetched byte is useful. This way of designing programs around data layout is often called
**data-oriented design**.

### Arrays of structs versus structs of arrays

Imagine a simulation with a million particles:

```c
struct particle {           // "array of structs"
    float x, y, z;          // position: used every step
    float vx, vy, vz;       // velocity: used every step
    char  name[64];         // used only for debugging
    int   flags;
};
struct particle particles[1000000];
```

The update loop reads only the position and velocity: 24 bytes. But each particle is 92 bytes, and whole
cache lines are fetched. So only about a quarter of the bytes the loop pulls from memory are useful. The rest
is names and flags that the loop never reads.

The alternative is one array per field, a "struct of arrays":

```c
struct particles {          // "struct of arrays"
    float x[1000000], y[1000000], z[1000000];
    float vx[1000000], vy[1000000], vz[1000000];
    char  name[1000000][64];
    int   flags[1000000];
};
```

Now the loop reads six arrays in order. Every byte fetched is used, prefetching works perfectly, and the
compiler can use SIMD instructions that process several values at once. Column-oriented databases, which store
each column separately, apply the same idea to analytics queries.

### Other habits that follow

- **Split hot and cold fields.** Keep fields used on every request in a small struct. Move rarely used fields
  to a separate struct behind a pointer.
- **Prefer arrays to linked structures.** A `std::vector` beats a `std::list` for iteration almost always. A
  B-tree, with many keys per node, beats a binary tree, whose every step is a cache miss.
- **Use compact hash tables.** Open-addressing tables that store entries in one array avoid a pointer
  dereference per lookup.
- **Keep per-thread data apart**, to avoid false sharing, and keep data a thread uses close together, for
  locality.

## Why this matters in real systems

**LLM inference is limited by memory bandwidth.** Generating one token with a large language model reads every
weight of the model once, but does only a few arithmetic operations per weight. So the speed of single-request
generation is set by how fast the GPU can read its memory, not by its arithmetic power. This is why GPUs use
high-bandwidth memory (several TB/s), and why serving systems batch many requests: each weight read is then
reused for many tokens.

**Metrics counters that do not scale.** A service adds a global request counter that every thread increments
atomically. On a 64-core machine, that single cache line bounces between cores on every request, and
throughput drops. Per-thread or per-core counters, summed when read, fix it.

**GPUs and network cards have a home node.** Each PCIe device is attached to one socket. A data loader
running on the other socket copies every batch across the link between chips. Pinning loader threads and their
memory to the GPU's node, shown by `nvidia-smi topo -m`, avoids this. The same applies to network cards in
high-throughput servers.

**The bigger machine that was slower.** A service moves from a 1-socket to a 2-socket machine with twice the
cores and gets slower per request. Its big shared cache now sits mostly on one node, and its locks and
counters bounce across sockets. Running two instances, one pinned per node, often recovers the performance.

**Thread migration.** When the scheduler moves a thread to another core, its data in the old core's L1 and L2
stays behind. The thread runs slower until the new caches warm up. Latency-critical services pin threads to
cores for this reason ([Chapter 8](/cpu/scheduling)).

**How to measure it:**

```bash
lscpu                                                   # cache sizes, sockets, NUMA nodes
perf stat -e cycles,instructions,cache-references,cache-misses ./prog
perf stat -e L1-dcache-load-misses,LLC-load-misses ./prog
perf c2c record ./prog && perf c2c report               # find false sharing
numactl --hardware                                      # nodes and distances
numastat -p <pid>                                       # a process's memory per node
```

Instructions per cycle (IPC), which `perf stat` prints, is a quick first check. An IPC well below 1 on a
modern core often means the program is waiting on memory. [Chapter 19](/systems/performance) covers
profiling in depth.

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. Why is summing a 2-D array row by row much faster than column by column?
C stores the array row by row. Row-by-row access reads memory in order: each 64-byte cache line brought in is
fully used, and the hardware prefetcher loads the next lines early. Column-by-column access jumps a whole row
each step, so each line fetched is used for one value and is usually evicted before it is needed again.

**Senior add-on:** with a power-of-two row length, column access also causes conflict misses: all those
addresses compete for the same few cache slots. It also touches a new page per access, which strains the TLB.
:::

::: details 2. What is a cache line, and why should a programmer care?
It is the unit the caches move, 64 bytes on most CPUs. Reading one byte brings in its whole line. So data used
together should sit together, and data written by different threads should sit in different lines.

**Senior add-on:** it explains spatial locality, false sharing, why struct layout and field order matter, and
why arrays beat pointer-based structures.
:::

::: details 3. What is false sharing? How do you find and fix it?
Two threads write different variables in the same cache line. Coherence works per line, so the line bounces
between their cores on every write, and both slow down badly, even though they share no data.

Find it with `perf c2c`, or suspect it when adding threads makes per-thread work slower. Fix it by padding or
aligning per-thread data to separate lines (64 or 128 bytes), or by keeping per-thread copies and combining
them when read.

**Senior add-on:** mention 128-byte padding because of adjacent-line prefetch on some Intel CPUs, and standard
helpers such as `std::hardware_destructive_interference_size`, crossbeam's `CachePadded`, and Java's
`@Contended`.
:::

::: details 4. Explain cache coherence. What is MESI?
Each core has private caches, so the hardware keeps copies of a line consistent. Many cores may hold a line
for reading, but only one may write it. Before writing, a core invalidates all other copies.

MESI names the four states of a line in a cache: Modified (only copy, changed), Exclusive (only copy,
unchanged), Shared (possibly several copies, unchanged), and Invalid.

**Senior add-on:** reads of shared data scale; writes to shared data do not, because each write moves the line.
Coherence covers single lines. The order in which writes to different addresses become visible is the memory
model, a separate topic.
:::

::: details 5. Iterating over an array and over a linked list are both O(n). Why is the array much faster?
The array is contiguous: each cache line holds several elements, and the prefetcher loads ahead. The list's
nodes can be anywhere in memory. Each next address is only known after the current node arrives, so every
step can be a full memory access of about 100 ns, one after another.

**Senior add-on:** big-O counts operations, not memory latency. Pointer chasing also kills memory-level
parallelism, because the CPU cannot overlap dependent misses.
:::

::: details 6. What is NUMA? How would you run a memory-heavy, multi-threaded service on a 2-socket server?
Each socket has its own local memory. Every core can reach all memory, but remote memory is slower, often
1.5 to 2 times, with less bandwidth. Linux places pages on the node that first touches them.

Options: run one instance per node, pinned with `numactl --cpunodebind --membind`. Or, if all threads must
share all the data, interleave memory across nodes. Initialise data from the threads that will use it, and
keep devices such as GPUs and NICs used by the threads on the same node.

**Senior add-on:** check with `numastat`. Automatic NUMA balancing can help, but costs some overhead. Watch for
one node's memory filling up while the other is empty, which can cause reclaim or swapping on that node.
:::

::: details 7. A program gets slower per thread as you add threads. What could be happening in the memory system?
- **False sharing** or true sharing of hot, written data: lines bounce between cores.
- **Shared cache capacity:** more threads means more working data competing for the same L3.
- **Memory bandwidth saturation:** a few cores can use most of a socket's bandwidth. More cores add nothing.
- **NUMA:** new threads land on the other socket and read remote memory.
- **Lock contention**, which also bounces the lock's cache line.

**Senior add-on:** measure IPC and cache misses per thread count with `perf stat`, and use `perf c2c` for
contended lines. Scaling curves that flatten at a fixed total throughput usually point to bandwidth.
:::

::: details 8. What does it mean for a program to be memory-bound, and how can you tell?
Its speed is set by how fast it can get data from memory, not by how fast it can compute. Doubling CPU speed
would barely help, but a better data layout or fewer bytes moved would.

Signs: low instructions per cycle, many last-level cache misses, and speed that does not improve with faster
cores. Profilers such as `perf` and Intel VTune can break down where cycles are spent.

**Senior add-on:** the **roofline** idea compares operations per byte moved with the machine's ratio of compute
to bandwidth. LLM token generation has very few operations per byte and is bandwidth-bound; batching raises
the ratio.
:::

## Common misconceptions

- **"Big-O tells you which is faster."** Memory access patterns can change speed by 10 to 100 times at the same
  big-O.
- **"If threads do not share variables, they do not interfere."** They do if their variables share a cache
  line.
- **"Atomic operations are cheap because there is no lock."** An atomic write to a line other cores use still
  moves the line between cores.
- **"All RAM is equally fast."** On multi-socket servers, remote memory is noticeably slower.
- **"Caches are the hardware's problem."** The hardware only exploits the locality your data layout provides.

## Key takeaways

- Main memory is about **100 times slower** than L1. Caches hide this only if the program has locality.
- Memory moves in **64-byte cache lines**. Sequential access is fast; pointer chasing and large strides are
  slow.
- **Coherence** lets many cores read a line but only one write it. Shared writes, including **false sharing**,
  make lines bounce between cores.
- On **NUMA** servers, place threads and memory on the same node, or interleave on purpose. Linux uses
  first-touch placement.
- **Lay out data** so each fetched line is full of useful bytes: struct of arrays, hot and cold splitting,
  arrays over pointers.

## Review

<Flashcards id="caches-and-numa" :cards="cards" />

<MarkDone id="caches-and-numa" />
