---
title: 6. User-Space Allocators
---

<script setup>
import { cards } from './allocators-review'
</script>

# 6. User-Space Allocators

`malloc` and `free` look like simple calls, but behind them is a small memory manager that runs inside every
process. Interviewers use it to test whether you understand fragmentation, contention between threads and the
classic "we freed the memory but the process did not get smaller" puzzle.

::: info Before you start
- The <Term id="kernel">kernel</Term> gives a <Term id="process">process</Term> memory in
  <Term id="page">pages</Term>: fixed 4 KiB blocks. It does this through
  <Term id="syscall">system calls</Term>, which are requests from a program to the kernel.
- Asking for memory only reserves addresses. RAM is used when each page is first written.
  [Chapter 4](/memory/virtual-memory) explains this.
- A process's resident size (<Term id="rss">RSS</Term>) is how much of its memory is in RAM right now.
  [Chapter 5](/memory/kernel-memory) covers how the kernel manages pages and measures memory.
:::

## Why an allocator exists

**In short:** the kernel hands out memory in whole pages, through slow system calls. An allocator is a library
inside the process that buys pages in bulk and hands them out in small pieces.

Think of a program that builds a tree of one million nodes, 40 bytes each. If it asked the kernel for each
node:

- Each request would be a system call, costing a few hundred nanoseconds or more.
- Each node would take a whole 4 KiB page, since the kernel deals only in pages. One million nodes would use
  4 GB instead of 40 MB.

So programs do not ask the kernel directly. They call `malloc`, which is part of a library loaded into the
process. For C programs on Linux this is usually <Term id="libc">libc</Term>, the C standard library. The
library asks the kernel for large chunks now and then, cuts them into blocks of the sizes the program wants,
and reuses blocks that the program frees. This library is the **memory allocator**.

<AllocatorLayersDiagram />

The allocator has to balance three goals that pull against each other:

- **Speed.** Busy programs call `malloc` and `free` millions of times a second. Each call should take tens of
  nanoseconds.
- **Little waste.** Freed memory should be reused, and blocks should not be much bigger than asked.
- **Scaling with threads.** Many <Term id="thread">threads</Term>, the parallel lines of execution in one
  process, call `malloc` at once. They should not wait for each other.

The rest of this chapter shows how allocators meet these goals, and where they fall short.

## How malloc gets memory from the kernel

**In short:** small requests come from the heap, one region that the allocator grows with `brk`. Large
requests get their own region from `mmap`, which goes back to the kernel on `free`.

A process's memory is a set of regions: ranges of addresses with one purpose, such as code or the stack. One
of these regions is the <Term id="heap">heap</Term>. It sits after the program's data and can grow upwards. The
end of the heap is called the **program break**. The system call <Term id="brk">`brk`</Term> moves this end,
making the heap bigger or smaller.

The allocator uses two ways to get memory:

- **Small requests** come from the heap. When the heap has no free block big enough, the allocator calls `brk`
  to grow it. It usually grows it by more than it needs right now, so the next requests need no system call.
- **Large requests** get their own separate region from <Term id="mmap">`mmap`</Term>, the system call that adds
  a new region of memory. When the program frees such a block, the allocator removes the whole region with
  `munmap`, and the memory goes straight back to the kernel.

In glibc, the usual libc on Linux, "large" starts at 128 KiB by default.

### Try it: see where blocks come from

```c
// where.c: gcc -O2 where.c -o where && ./where
#define _DEFAULT_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(void) {
    void *brk0 = sbrk(0);                   // current end of the heap
    char *small = malloc(100);
    void *brk1 = sbrk(0);
    char *big = malloc(10 << 20);           // 10 MiB
    printf("heap end before: %p\n", brk0);
    printf("small block:     %p\n", (void *)small);
    printf("heap end after:  %p (grew %ld KiB)\n", brk1,
           ((char *)brk1 - (char *)brk0) / 1024);
    printf("big block:       %p\n", (void *)big);
    free(small);
    free(big);
    return 0;
}
```

Output on Linux x86-64 with glibc (addresses change on every run):

```text
heap end before: 0x5573838df000
small block:     0x5573838df2a0
heap end after:  0x557383900000 (grew 132 KiB)
big block:       0x7f3a317ff010
```

A 100-byte request grew the heap by 132 KiB. The allocator took extra, so the next small requests need no
system call. The 10 MiB block is far away, near the shared libraries, in its own `mmap` region.

::: details Going deeper: glibc's thresholds
- The size above which glibc uses `mmap` is `M_MMAP_THRESHOLD`, 128 KiB by default. It is **dynamic**: when
  the program frees an `mmap`ed block, glibc raises the threshold to that block's size, up to 32 MiB on
  64-bit. So a program that keeps allocating and freeing 1 MiB buffers soon gets them from the heap instead.
- When the free space at the end of the heap passes `M_TRIM_THRESHOLD` (128 KiB by default, also dynamic),
  `free` shrinks the heap with `brk`.
- You can set both with `mallopt`, or with the `GLIBC_TUNABLES` environment variable.
- Run `strace -e trace=brk,mmap,munmap ./prog` to watch the allocator talk to the kernel.
:::

## Inside the allocator: headers, free lists and size classes

**In short:** each block has a small header that records its size. Freed blocks are kept in lists, sorted by
size class, so a matching free block can be found without searching.

### How free knows the size

`free(p)` gets only a pointer, not a size. So the allocator stores the size itself, in a small **header** just
before the block it returns. `malloc(40)` finds a block big enough for 40 bytes plus the header, writes the
size into the header, and returns the address right after it. `free(p)` looks just before `p` to read the size.

This is also why writing past the end of a block is so harmful. It overwrites the header of the next block,
and the allocator later crashes or misbehaves far away from the bug.

### Free lists

When the program frees a block, the allocator does not give it back to the kernel. It adds it to a list of
free blocks, the **free list**. The links of this list are stored inside the free blocks themselves, since
nobody else is using those bytes.

<HeapChunksDiagram />

When a request arrives, the allocator looks for a free block that fits:

- If the block it finds is much bigger than needed, it **splits** it and keeps the rest on the free list.
- When a block is freed next to another free block, it **merges** them into one bigger block. Otherwise memory
  would break into ever smaller pieces.

### Size classes

Searching one long list for a block of the right size is slow. So allocators round each request up to one of
a fixed set of sizes, such as 16, 32, 48, 64 and 80 bytes. They keep a separate free list for each size.
These sizes are called <Term id="size-class">size classes</Term>.

Now `malloc(40)` rounds up to 48, takes the first block from the 48-byte list, and is done. `free` puts the
block back at the front of that list. Both take a few instructions, with no searching.

::: details Going deeper: glibc's bins
glibc calls its blocks **chunks** and its free lists **bins**:
- **tcache:** a small per-thread cache with one list per size, for chunks up to about 1 KiB, holding up to 7
  chunks each. Most small `malloc` and `free` calls stop here, without any lock.
- **fastbins:** lists of small chunks that are not merged right away, for speed.
- **small bins** (one exact size each), **large bins** (a range of sizes each), and an **unsorted bin** where
  freed chunks wait before being sorted.

On 64-bit, blocks are 16-byte aligned, the smallest chunk is 32 bytes, and the header is 8 bytes.
`malloc_usable_size(p)` shows how many bytes you really got.
:::

## Fragmentation

**In short:** memory is wasted in two ways: inside blocks, when they are rounded up, and between blocks, when
free memory is split into pieces too small to use.

<Term id="fragmentation">Fragmentation</Term> is memory that is free or unused, but that the program cannot
make use of. It comes in two kinds.

**Internal fragmentation** is waste inside a block. A request for 33 bytes rounds up to a 48-byte size class.
The extra 15 bytes are allocated but never used. Size classes cause this. Allocators choose class sizes so
that this waste stays at a small percentage, bounded by the gap between neighbouring classes.

**External fragmentation** is waste between blocks. Suppose a program allocates a thousand 64-byte blocks,
then frees every other one. Half the memory is free, but only in 64-byte holes. A request for 128 bytes cannot
use any of them. The allocator must get new memory, even though plenty is free in total.

External fragmentation grows when objects of different sizes and lifetimes are mixed. A few long-lived objects
scattered among many short-lived ones pin down the memory around them. Allocators reduce it by:

- keeping objects of one size class together on their own pages, so a freed block always fits the next request
  of that class;
- merging neighbouring free blocks;
- giving large blocks their own regions, so they do not break up the heap.

## Threads: arenas and thread caches

**In short:** one shared heap with one lock would make threads wait for each other. Allocators give threads
separate heaps and small private caches, at the price of more memory.

If every thread used the same free lists, those lists would need a lock. A lock lets only one thread use them
at a time. With 32 threads allocating constantly, much of their time would go into waiting for that lock.

Allocators solve this in two layers:

- **Arenas.** The allocator keeps several independent heaps, each with its own lock and free lists. Each
  thread is assigned to one. Threads on different arenas never wait for each other. One such heap is a
  <Term id="malloc-arena">malloc arena</Term>.
- **Thread caches.** Each thread also keeps a small private stash of free blocks for each size class. Most
  `malloc` and `free` calls take a block from that stash, or put one into it, with no lock at all. The stash is
  refilled from the shared structures, or emptied into them, in batches.

The price is memory. Free blocks sitting in one thread's cache or one arena cannot be used by another thread.
With many threads and many arenas, a process can hold much more free memory than it needs.

A common bad case is a producer and a consumer. Thread A allocates buffers and thread B frees them. The freed
blocks go back to A's arena or into B's cache, not to where new buffers are needed next.

::: details Going deeper: glibc arenas and MALLOC_ARENA_MAX
- glibc creates up to 8 arenas per CPU core on 64-bit systems. Arenas other than the main heap are built from
  `mmap`ed regions of 64 MiB each. That is why heavily threaded processes on glibc, such as Java services,
  often show virtual size growing in 64 MiB steps.
- Services with many threads can see resident memory grow far beyond their real use because of this. Setting
  the environment variable `MALLOC_ARENA_MAX=2` (or 4) is a widely used fix. It trades some contention for
  much less memory.
- `malloc_stats()` and `malloc_info()` print per-arena statistics.
:::

## Why RSS does not shrink after free()

**In short:** `free` returns memory to the allocator, not to the kernel. The allocator keeps it for reuse, and
often cannot give it back, because the heap can only shrink from its end.

A very common production question is: "our service freed a big cache, but its RSS did not go down". Usually,
nothing is leaking. Several effects combine:

1. **The allocator keeps freed memory on purpose.** It expects the program to allocate again soon. Returning
   pages and then asking for them back would cost system calls and page faults.
2. **The heap can only shrink from its end.** `brk` moves the end of the heap. If one block near the end is
   still in use, all the free memory below it stays part of the heap.
3. **Free blocks are mixed with used ones.** A page can go back to the kernel only if it is completely free. One
   live 32-byte object keeps its whole 4 KiB page in RAM.
4. **Returned pages may still be counted.** Some allocators return pages with a "take this if you need it"
   hint (`MADV_FREE`). The kernel takes them only under memory pressure. Until then, they still count in RSS.

Only large blocks that got their own `mmap` region go back to the kernel right away.

### Try it: freed but still resident

This program allocates about 200 MB in 1,000-byte blocks, frees all of them except the last one, then asks
glibc to hand back what it can:

```c
// rss.c: gcc -O2 rss.c -o rss && ./rss
#include <malloc.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static long rss_kib(void) {
    FILE *f = fopen("/proc/self/status", "r");
    char line[256];
    long kib = -1;
    while (fgets(line, sizeof line, f))
        if (sscanf(line, "VmRSS: %ld", &kib) == 1) break;
    fclose(f);
    return kib;
}

#define N 200000
static char *blocks[N];

int main(void) {
    for (int i = 0; i < N; i++) {
        blocks[i] = malloc(1000);           // 200,000 small blocks, about 200 MB
        memset(blocks[i], 1, 1000);
    }
    printf("after malloc:          %6ld MiB\n", rss_kib() / 1024);

    for (int i = 0; i < N - 1; i++)         // free all but the last block
        free(blocks[i]);
    printf("after free:            %6ld MiB\n", rss_kib() / 1024);

    malloc_trim(0);                         // ask glibc to return free pages
    printf("after malloc_trim(0):  %6ld MiB\n", rss_kib() / 1024);
    return 0;
}
```

Output with glibc 2.39:

```text
after malloc:             195 MiB
after free:               195 MiB
after malloc_trim(0):       3 MiB
```

<RssPinnedDiagram />

After `free`, the heap still holds 195 MiB of RAM, because the last block pins the end of the heap.
`malloc_trim` walks the free blocks and tells the kernel it may take back every page that is completely free,
using `madvise(MADV_DONTNEED)`. The address range stays reserved, but the RAM is released.

::: tip How to tell a leak from allocator behaviour
A leak grows without limit as the program runs. Allocator retention levels off: RSS rises to the peak the
program ever needed, then stays there. Compare the allocator's own count of memory in use (from
`malloc_info`, jemalloc's statistics, or a heap profiler) with RSS. A big, stable gap means retention or
fragmentation, not a leak.
:::

::: details Going deeper: how allocators return memory
- `MADV_DONTNEED` frees the RAM at once. The next touch gets a fresh zero-filled page.
- `MADV_FREE` (Linux 4.5+) lets the kernel take the pages only when it needs memory. It is cheaper, but RSS
  stays high until then, which confuses monitoring. Go used it by default from version 1.12 and switched back
  to `MADV_DONTNEED` in 1.16, partly for this reason.
- jemalloc and tcmalloc return free memory gradually, after it has been unused for a while. jemalloc calls
  this **decay**, with settings such as `dirty_decay_ms`.
- Every return costs a system call and, later, page faults. Each `madvise` or `munmap` may also need a
  <Term id="tlb">TLB</Term> shootdown, where the kernel interrupts other cores so they forget old address
  translations. Returning memory too eagerly slows the program down.
:::

## Modern allocators: jemalloc, tcmalloc, mimalloc

**In short:** the well-known alternatives to glibc all use size classes, per-thread or per-CPU caches, and
pages dedicated to one size class. They differ in details and tuning, not in their basic ideas.

glibc's allocator is a general-purpose design from the 1990s, extended over time. Large services often replace
it with an allocator built for many threads and long running times:

| Allocator | Origin | Key idea | Typical users |
|---|---|---|---|
| **jemalloc** | FreeBSD, later developed at Meta | Per-thread caches plus several arenas; detailed statistics and heap profiling; gradual return of memory | Redis (default on Linux), Meta services, many databases |
| **tcmalloc** | Google | Per-CPU caches instead of per-thread ones, so cached memory does not multiply with thread count | Google services, many C++ servers |
| **mimalloc** | Microsoft Research | Small free lists per page, which keeps related memory together and makes each operation very short | Language runtimes and applications that want a small, fast drop-in |

All three share a design that differs from glibc's. They group memory into pages or runs that hold only
**one size class**. A block's size can then be found from the page it lives on, so small blocks need no
header. A freed block always fits the next request of its class, which limits external fragmentation.

Switching is often easy: link the program against the new allocator, or load it at startup with
`LD_PRELOAD=/usr/lib/libjemalloc.so ./prog`. The results depend on the workload. Many services see lower memory
use or better throughput with many threads, but measure with your own traffic.

::: details Going deeper: what each one is known for
- **tcmalloc's per-CPU caches** use restartable sequences (`rseq`), a Linux feature that lets a thread update
  per-CPU data safely without locks. If the thread is moved to another CPU mid-update, the kernel restarts the
  update.
- **jemalloc** exposes detailed statistics and a sampling heap profiler, which makes it popular for finding
  where memory goes in production.
- **mimalloc's "free list sharding"** keeps a free list per page, plus a separate list for frees from other
  threads. The common path touches very little shared state.
- Android replaced jemalloc with **Scudo**, a hardened allocator designed to make memory bugs harder to
  exploit. Security-focused allocators trade some speed for checks.
:::

## Custom allocators: pools and arenas

**In short:** when a program knows how its objects live and die, a simple special-purpose allocator can beat
any general one.

A general-purpose allocator must handle any size, in any order, from any thread. Many programs have more
structure than that, and can use it:

- **Pool allocator.** All objects have one size, such as connection records. Keep a free list of them.
  Allocating and freeing are one pointer operation each, and there is no fragmentation.
- **Arena (region) allocator.** All objects created while handling one request die together when it ends.
  Allocate by moving a pointer forward through a big buffer. Free everything at once by resetting the pointer.
  Compilers, game engines and protobuf arenas use this.

The kernel uses the same idea for its own objects: its slab allocator is a set of pools, one per object type
([Chapter 5](/memory/kernel-memory)).

## Debugging memory bugs

**In short:** memory bugs corrupt the allocator's data, so they crash far from the cause. Tools that check each
access find them at the source.

Allocator bugs in C and C++ come in a few kinds:

- **Leak:** memory is never freed. Resident size grows without limit.
- **Use after free:** the program uses a block after freeing it. The block may already belong to someone else.
- **Double free:** the same block is freed twice, so it appears twice on a free list.
- **Buffer overflow:** writing past the end of a block overwrites the next block or its header.

The last three often crash much later, inside `malloc` or `free`, with messages like `free(): invalid pointer`.
The crash location tells you little about the bug.

Tools that find them:

- **AddressSanitizer** (`gcc -fsanitize=address`): the compiler adds a check to every memory access. It finds
  overflows, use after free and double free at the moment they happen. Programs run about 2 times slower.
- **Valgrind** (`valgrind --leak-check=full ./prog`): runs the program on a simulated CPU and checks
  everything. Very thorough, but tens of times slower.
- **Heap profilers** (heaptrack, jemalloc's and tcmalloc's profilers): record which code allocated the memory
  that is still live. Used to find leaks and growth, including in production.

## Why this matters in real systems

**Services that grow for days.** A long-running C++ or Java service slowly grows in resident size. It levels
off at several times its live data, and nobody can find a leak. The cause is often allocator retention and
fragmentation, made worse by many threads and many glibc arenas. Setting `MALLOC_ARENA_MAX` or switching to
jemalloc or tcmalloc often cuts memory use a lot. Always confirm with measurements.

**Container OOM kills from fragmentation.** A container's memory limit counts resident memory, not what the
program believes it uses. A program with 2 GB of live data whose allocator holds 3.5 GB is killed at a 3 GB
limit. The heap profiler shows 2 GB, and the team is puzzled. Look at allocator statistics next to RSS.

**Language runtimes.** Go, Java and other garbage-collected languages run their own allocators on top of
`mmap`, and show the same effects. A Java heap often stays at the largest size it grew to. Go returns memory
in the background, and `GOMEMLIMIT` tells it how hard to try. Python uses its own allocator for objects up to
512 bytes. It takes large blocks from `malloc` and can keep them for a long time.

**GPU memory in PyTorch.** Asking the GPU driver for memory (`cudaMalloc`) is slow and can force the CPU to
wait for the GPU. So PyTorch keeps a **caching allocator**: it holds freed GPU blocks and reuses them, the same
idea as `malloc`. This is why `nvidia-smi` shows more memory in use than `torch.cuda.memory_allocated()`
reports: the difference is cached. Out-of-memory errors while plenty is "free" are usually fragmentation.
PyTorch's `expandable_segments` option reduces it.

**Latency spikes from returning memory.** An allocator that returns memory to the kernel too eagerly makes the
program pay page faults when it needs the memory again, plus TLB shootdowns across cores. Services tune their
allocator to keep more memory, trading RAM for steadier latency.

**How to measure it:**

```bash
strace -f -e trace=brk,mmap,munmap,madvise ./prog   # allocator talking to the kernel
grep -E 'VmRSS|RssAnon' /proc/<pid>/status          # resident memory
ltrace -e malloc+free ./prog                        # every malloc/free call (very slow)
MALLOC_ARENA_MAX=2 ./prog                           # compare memory with fewer arenas
LD_PRELOAD=libjemalloc.so.2 ./prog                  # try another allocator
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. How does malloc get memory from the operating system?
For small requests, it uses the heap, one region that grows upwards. When the heap has no suitable free block,
`malloc` calls `brk` to extend it, usually by more than needed. For large requests (128 KiB and up in glibc by
default), it creates a separate region with `mmap`, which `free` returns with `munmap`.

Either way, the kernel only reserves addresses. RAM is used when each page is first written.

**Senior add-on:** glibc's threshold is dynamic, and its extra arenas for threads are built from `mmap`ed
regions, not from `brk`. Modern allocators such as jemalloc use `mmap` for everything.
:::

::: details 2. How does free() know how big the block is?
The allocator stores the size in a small header just before the address it returned. `free(p)` reads the size
from there.

**Senior add-on:** allocators that dedicate each page to a single size class can find the size from the page
instead, through a lookup table, so small blocks need no header. jemalloc, tcmalloc and mimalloc work this way.
:::

::: details 3. Design a simple malloc. What would you do?
1. Get memory from the kernel in large chunks, with `mmap` or `brk`.
2. Round each request up to a size class. Keep a free list per class.
3. `malloc` takes a block from the class's free list. If the list is empty, cut a fresh page into blocks of
   that size.
4. `free` puts the block back on its class's list. Find the class from a header or from the page.
5. Give large requests their own `mmap` region.

Then discuss threads: give each thread a small cache per class, refilled in batches from a locked central list.

**Senior add-on:** name the trade-offs. Size classes cause internal fragmentation. Per-thread caches hold
extra memory. Deciding when to return memory to the kernel trades RAM for page faults and TLB shootdowns.
:::

::: details 4. What is the difference between internal and external fragmentation?
**Internal:** waste inside a block, because the request was rounded up. A 33-byte request in a 48-byte block
wastes 15 bytes.

**External:** free memory broken into pieces too small for the requests that come. Plenty is free in total,
but no single piece is big enough.

**Senior add-on:** size classes trade a bounded amount of internal fragmentation for much less external
fragmentation. Mixing objects with very different lifetimes is the main source of external fragmentation in
long-running services.
:::

::: details 5. A service frees a large cache, but its RSS does not go down. Why?
`free` gives memory back to the allocator, not to the kernel. The allocator keeps it for reuse. Often it
cannot return it: the heap only shrinks from its end, and a page can be returned only if it is completely
free. Some allocators also return pages lazily with `MADV_FREE`, which still counts in RSS until the kernel
needs the memory.

Only large blocks that had their own `mmap` region are returned at once.

**Senior add-on:** if RSS levels off, it is usually not a leak. Confirm with the allocator's statistics.
`malloc_trim(0)` in glibc, or the decay settings in jemalloc, make the allocator return free pages.
:::

::: details 6. Why do jemalloc and tcmalloc often beat glibc malloc in multi-threaded servers?
They avoid shared locks on the common path with per-thread or per-CPU caches. They dedicate each page to a
single size class, which limits fragmentation and removes per-block headers. And they return unused memory
gradually.

**Senior add-on:** glibc also has per-thread caches (tcache) and arenas, but it can create many arenas, which
multiplies retained memory. tcmalloc's per-CPU caches bound cached memory by core count, not thread count.
Results depend on the workload, so benchmark with real traffic.
:::

::: details 7. Memory grows slowly in a long-running service. How do you tell a leak from fragmentation?
Watch the shape over time. A leak grows without limit, roughly with traffic or time. Retention and
fragmentation level off at some multiple of the live data.

Then compare two numbers: the bytes the program has live, from a heap profiler or allocator statistics, and
RSS. If live bytes grow, it is a leak, and the profiler shows which code allocated them. If live bytes are flat
and RSS is much higher, it is the allocator.

**Senior add-on:** fixes for fragmentation include fewer arenas (`MALLOC_ARENA_MAX`), another allocator,
tuning how memory is returned, and separating long-lived from short-lived objects, for example with an arena
per request.
:::

::: details 8. When would you write your own allocator?
When the program's objects follow a known pattern that a general allocator cannot exploit. Examples: many
objects of one size (a pool allocator), or many objects that all die at the end of a request or a frame (an
arena, freed all at once).

**Senior add-on:** the gain is speed and no fragmentation. The cost is that tools like AddressSanitizer no
longer see individual objects unless you teach them about your allocator, so bugs get harder to find. Measure
first.
:::

::: details 9. Why can't you call malloc in a signal handler?
A signal can arrive while the thread is in the middle of `malloc`, holding the allocator's lock or with its
lists half updated. If the handler calls `malloc` too, it can deadlock on that lock or corrupt the lists.
`malloc` is not on the list of functions that are safe to call from signal handlers.

**Senior add-on:** the same problem appears after `fork` in a multi-threaded program, if another thread held a
lock at that moment. glibc protects its own allocator locks around `fork`, but other libraries may not. That
is why the child should call only safe functions before `exec`.
:::

## Common misconceptions

- **"free() gives memory back to the operating system."** Usually it gives it back to the allocator, which
  keeps it for reuse.
- **"RSS that does not shrink means a leak."** If it levels off, it is usually retention or fragmentation.
- **"malloc is a system call."** It is a library function. It makes system calls only occasionally.
- **"malloc(1) uses 1 byte."** It uses a whole minimum-sized block: 32 bytes in glibc on 64-bit.
- **"A faster allocator is always better."** Allocators trade speed, memory use and security checks. The best
  one depends on the workload.

## Key takeaways

- The allocator is a library **inside the process**. It buys pages from the kernel with `brk` and `mmap` and
  sells them in small blocks.
- **Headers, free lists and size classes** make `malloc` and `free` fast. Size classes trade some internal
  fragmentation for much less external fragmentation.
- **Arenas and thread caches** let threads allocate without waiting for each other, at the cost of extra
  retained memory.
- **RSS rarely shrinks after `free`**: the allocator keeps memory, and the heap can only shrink from its end.
  A leak grows without limit; retention levels off.
- jemalloc, tcmalloc and mimalloc share one design: **per-thread or per-CPU caches and single-size-class
  pages**. Measure before and after switching.

## Review

<Flashcards id="allocators" :cards="cards" />

<MarkDone id="allocators" />
