---
title: 5. Kernel Memory Management
---

<script setup>
import { cards } from './kernel-memory-review'
</script>

# 5. Kernel Memory Management

This chapter is about how the <Term id="kernel">kernel</Term> decides what lives in RAM, and what happens when
there is not enough room. "Why was my container OOM-killed?", "why is free memory always near zero?" and "what
does `fork` really copy?" are standard senior interview questions, and they all come from here.

::: info Before you start
- Each <Term id="process">process</Term> sees its own private memory. The hardware translates its addresses to
  real RAM in blocks of 4 KiB called <Term id="page">pages</Term>. A 4 KiB block of RAM that holds a page is a
  <Term id="frame">frame</Term>. The kernel records which frame holds each page in a
  <Term id="page-table">page table</Term>.
- When the hardware cannot translate an address, the CPU stops and asks the kernel to fix it. This is a
  <Term id="page-fault">page fault</Term>. The kernel uses faults on purpose, to supply memory only when it is
  first used.
- [Chapter 4](/memory/virtual-memory) explains all of this in full. This chapter recaps what it needs.
:::

## The kernel's job: deciding what stays in RAM

**In short:** RAM holds process memory, cached file data and kernel data. The kernel keeps as much useful data
in RAM as it can, and must free some when a new request arrives and RAM is full.

Think of RAM on a busy server. Some frames hold a database's data structures. Some hold parts of files that
programs read recently. Some hold the kernel's own tables. Almost none are empty, and that is on purpose:
empty RAM does no useful work.

So the real question is not "how much RAM is free?" but "how quickly can the kernel free a frame when someone
needs one?". That depends on what the frame holds. A process's memory comes in two kinds:

- <Term id="file-backed-memory">**File-backed memory**</Term> holds the contents of a file, such as a
  program's code or a data file it reads. A copy of the data exists on disk.
- <Term id="anonymous-memory">**Anonymous memory**</Term> has no file behind it: the heap, the stack, and
  memory from `malloc`. It is called anonymous because it has no file name. If the kernel throws it away, the
  data is gone.

File-backed memory is cheap to free when it has not changed: the kernel drops it and reads it from the file
again if needed. A page that was changed since it was read is called **dirty**. A
<Term id="dirty-page">dirty page</Term> must be written back to its file before its frame can be reused.
Anonymous memory can only be freed by writing it to a special disk area called <Term id="swap">swap</Term>.

<PageKindsDiagram />

Keep this picture in mind. Almost every topic in this chapter comes back to it: which pages are cheap to
free, which are expensive, and which cannot be freed at all.

::: details Going deeper: how the kernel tracks every frame
Linux keeps a small descriptor, `struct page`, for every 4 KiB frame of RAM. It records who uses the frame,
how many users it has, and flags such as dirty or locked. It takes about 64 bytes per frame, so roughly 1.5%
of RAM. Newer kernels are moving to **folios**, which describe a group of pages at once to cut per-page
overhead.
:::

## How the kernel hands out frames

**In short:** the kernel keeps free frames in blocks of power-of-two sizes, so it can find large continuous
blocks. It carves small objects for its own use out of those frames.

The kernel needs RAM for many things: pages for processes, cached files, and its own small objects, such as
one record per open file. It uses two layers for this.

**The page allocator** hands out whole frames. It keeps free frames in lists by block size: 1 frame, 2
frames, 4, 8, and so on up to about 4 MiB. To serve a request for 4 frames, it takes a free block of 4. If
none is free, it splits a block of 8 into two halves of 4. When a block is freed and its neighbouring "buddy"
block is also free, the two merge back into a bigger block. This scheme is called the
<Term id="buddy-allocator">buddy allocator</Term>.

**The slab allocator** sits on top. The kernel creates many small objects of the same type, often millions of
them. The slab allocator takes whole frames and cuts them into slots of one object size. A freed slot is
reused for the next object of the same type. There is one <Term id="slab-allocator">slab cache</Term> for each
common object type.

Some slab caches can be shrunk when memory is short. The biggest are the caches of file names and file
metadata, which the kernel keeps so it does not have to read directories from disk again.

::: details Going deeper: kmalloc, vmalloc, and where to see it
- Kernel code asks for small memory with `kmalloc`, which uses general-purpose slab caches in sizes like 64,
  128 and 256 bytes. The memory is physically continuous.
- `vmalloc` gives memory that is continuous only in virtual addresses, built from scattered frames. It is
  used for large buffers that do not need physical continuity.
- The current slab implementation is **SLUB**. The older SLOB and SLAB were removed in kernels 6.4 and 6.8.
- `/proc/buddyinfo` shows how many free blocks exist of each size. Few large blocks means RAM is fragmented,
  which makes huge pages hard to get. `slabtop` and `/proc/slabinfo` show slab caches by size.
- The file-name cache is the **dentry cache**; the file metadata cache is the **inode cache**.
  [Chapter 13](/io/file-systems) explains both.
:::

## mmap: asking the kernel for memory regions

**In short:** `mmap` adds a region to a process's address space. The region is either backed by a file or
anonymous, and either private to the process or shared with others.

A process's memory is a set of regions. A <Term id="vma">memory region</Term> is a continuous range of
addresses with one set of permissions and one source of data, such as the heap, the stack, or a mapped file.
The <Term id="syscall">system call</Term> <Term id="mmap">`mmap`</Term> creates a new region. A system call is
how a program asks the kernel to do something for it.

`mmap` only records the region. As [Chapter 4](/memory/virtual-memory) showed, no RAM is used until the
program touches each page. The first touch causes a page fault, and the kernel supplies the page then.

When you create a region, you make two choices:

1. **Where does the data come from?** From a file, or from nowhere (anonymous memory, which starts as zeros).
2. **Who sees the writes?** With a **private** mapping, writes stay in this process. With a **shared**
   mapping, writes are visible to every process that maps the same thing, and for a file they reach the file.

That gives four combinations:

| | Private | Shared |
|---|---|---|
| **File-backed** | Program code and libraries. Reads come from the file; writes make a private copy and never reach the file. | Editing a file through memory. Writes reach the file and are seen by every process that maps it. |
| **Anonymous** | Heap, stack and large `malloc` blocks. The most common kind. | Memory shared between a parent process and the children it creates. |

A mapped file and a file read with `read` use the **same** cached copy of the file in RAM. With `mmap`, the
process's page table points straight at those cached frames. With `read`, the kernel copies the data from
them into the program's buffer. The page cache section below explains this cache.

### Try it: private and shared mappings

The system call <Term id="fork">`fork`</Term> creates a copy of the running process, called the child. The
next section explains how it works. This program creates one private and one shared page, then lets a child
write to both:

```c
// shared.c: gcc -O2 shared.c -o shared && ./shared
#include <stdio.h>
#include <sys/mman.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    int *priv = mmap(NULL, 4096, PROT_READ | PROT_WRITE,
                     MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    int *shared = mmap(NULL, 4096, PROT_READ | PROT_WRITE,
                       MAP_SHARED | MAP_ANONYMOUS, -1, 0);
    if (priv == MAP_FAILED || shared == MAP_FAILED) { perror("mmap"); return 1; }

    *priv = 1;
    *shared = 1;

    if (fork() == 0) {          // child
        *priv = 2;              // the child gets its own copy of this page
        *shared = 2;            // this page really is shared
        return 0;
    }
    wait(NULL);                 // parent: wait for the child to finish
    printf("parent sees: private = %d, shared = %d\n", *priv, *shared);
    return 0;
}
```

Output:

```text
parent sees: private = 1, shared = 2
```

The child's write to the private page did not reach the parent. Its write to the shared page did.

::: details Going deeper: flags and calls that come up in interviews
- `munmap` removes a region. `mprotect` changes its permissions.
- `msync` asks the kernel to write a shared file mapping's changes to disk now, instead of later.
- `madvise` gives hints: `MADV_WILLNEED` (read ahead), `MADV_SEQUENTIAL` or `MADV_RANDOM` (access pattern),
  `MADV_DONTNEED` (drop these pages now; anonymous pages read back as zeros), `MADV_FREE` (drop them only if
  memory gets tight).
- `MAP_POPULATE` fills in all pages during the `mmap` call. `mlock` keeps pages in RAM and out of swap.
- Accessing a page of a mapped file beyond the file's end raises `SIGBUS`, for example if another process
  shrank the file.
- For a private file mapping, POSIX leaves it unspecified whether later changes to the file show up in pages
  the process has not written yet. On Linux they usually do.
- Named shared memory between unrelated processes (`shm_open`, `memfd_create`) is covered in
  [Chapter 11](/cpu/ipc). How `malloc` uses `mmap` is in [Chapter 6](/memory/allocators).
:::

## Copy-on-write and fork

**In short:** `fork` does not copy the parent's memory. Parent and child share every page read-only, and the
kernel copies a page only when one of them writes to it.

`fork` creates a new process, the child, as a copy of the calling process, the parent. The child starts with
the same memory contents. Copying gigabytes of memory on every `fork` would be very slow. It would also be
wasted work, because most children soon call `exec` to run a different program, which throws that memory
away.

So the kernel cheats. It does not copy any data. Instead:

1. It copies the parent's page table, so the child's pages point at the **same frames** as the parent's.
2. It marks every writable private page as **read-only**, in both processes.
3. It counts how many processes use each shared frame.

Reading is free: both processes read the same frames. When either process **writes** to one of these pages,
the hardware sees a write to a read-only page and raises a page fault. The kernel sees that the page is
really writable, only shared. It copies the page to a new frame, points the writer's page table at the copy,
marks it writable, and runs the write again. This is <Term id="copy-on-write">copy-on-write</Term> (CoW).

<CowDiagram />

If only one user of a frame is left, the kernel does not copy at all. It marks the page writable again. So
each page is copied at most once, and only if someone writes to it.

### Try it: count the copies

The parent fills 256 MiB, then forks. The child reads all of it, then writes to a quarter of it:

```c
// cow.c: gcc -O2 cow.c -o cow && ./cow
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <unistd.h>

static long minor_faults(void) {
    struct rusage ru;
    getrusage(RUSAGE_SELF, &ru);
    return ru.ru_minflt;
}

int main(void) {
    const size_t size = 256UL << 20;          // 256 MiB
    const long page = sysconf(_SC_PAGESIZE);  // usually 4096
    char *p = malloc(size);
    if (!p) return 1;
    memset(p, 1, size);                       // parent touches every page

    if (fork() == 0) {                        // child
        long f0 = minor_faults();
        long sum = 0;
        for (size_t off = 0; off < size; off += page)
            sum += p[off];                    // read every page
        long f1 = minor_faults();
        for (size_t off = 0; off < size / 4; off += page)
            p[off] = 2;                       // write to the first quarter
        long f2 = minor_faults();
        printf("child read  256 MiB: %6ld faults (sum %ld)\n", f1 - f0, sum);
        printf("child wrote  64 MiB: %6ld faults\n", f2 - f1);
        return 0;
    }
    wait(NULL);
    return 0;
}
```

Typical output:

```text
child read  256 MiB:      0 faults (sum 65536)
child wrote  64 MiB:  16384 faults
```

Reading costs nothing, because the copied page table already points at the shared frames. Writing 64 MiB
causes one fault and one 4 KiB copy per page: 64 MiB / 4 KiB = 16,384.

### What fork still costs

Copy-on-write makes `fork` cheap, but not free:

- **The page table is copied.** That is about 8 bytes per 4 KiB page, so about 100 MB for a process with
  50 GB of memory. Copying it can take tens to hundreds of milliseconds, and the parent is paused meanwhile.
- **Every later write costs a fault and a copy.** A parent that keeps writing while the child runs slowly
  duplicates its memory. In the worst case, memory use doubles.
- **Promises of memory.** The kernel may have to promise that every shared page could be copied. The
  overcommit section below explains why that can make `fork` fail.

When the child will only run another program, `posix_spawn` or `vfork` avoid copying the page table at all.
The child borrows the parent's memory until it calls `exec`. [Chapter 2](/foundations/processes-and-threads)
covers process creation in full.

::: details Going deeper: the edge cases
- Linux can skip copying page table entries for shared file mappings that have no private pages. The child
  fills them in later with cheap page faults.
- With <Term id="huge-page">huge pages</Term> (2 MiB instead of 4 KiB), one small write can copy 2 MiB, or
  make the kernel split the huge page first. This is one reason Redis recommends turning transparent huge
  pages off.
- `madvise(MADV_DONTFORK)` leaves a region out of the child entirely. `MADV_WIPEONFORK` gives the child zeros
  instead, which is useful for random-number state that must not be shared.
- Pages mapped with `MAP_SHARED` stay shared after `fork`. They are never copied on write.
:::

## The page cache

**In short:** the kernel keeps file data it has read or written in otherwise unused RAM. This cache is why
"free" memory on a healthy Linux machine is close to zero.

Reading from an SSD takes around 100 microseconds. Reading from RAM takes around 100 nanoseconds, a thousand
times less. So when a program reads part of a file, the kernel keeps that data in RAM after the read. The next
read of the same data, by any process, is served from RAM. This cache of file data is the
<Term id="page-cache">page cache</Term>.

The page cache holds file data in page-sized pieces. Every file-backed page from the first section lives
here, whether the process reached it with `read` or with `mmap`. The cache has no fixed size. It grows into
any RAM that programs are not using, and shrinks when they need more.

### Writes go to the cache first

When a program calls `write` on a file, the kernel copies the data into the page cache and marks those pages
dirty. Then `write` returns. The data is **not on disk yet**.

Later, kernel <Term id="thread">threads</Term> write the dirty pages to disk. This is called
<Term id="write-back">write-back</Term>. It happens when either:

- a page has been dirty for a while (about 30 seconds by default), or
- dirty pages take up too large a share of memory.

If programs create dirty data faster than the disk can take it, the kernel slows them down. Their `write`
calls start to block until write-back catches up.

::: warning write() is not durable
If the machine loses power after `write` returns, the data can be lost. A program that must not lose data,
such as a database, calls `fsync` to force it to disk and wait. [Chapter 13](/io/file-systems) covers
`fsync` and what it really guarantees.
:::

::: details Going deeper: write-back settings
- Dirty pages older than `vm.dirty_expire_centisecs` (default 3000, so 30 s) are written back. The flusher
  threads wake every `vm.dirty_writeback_centisecs` (default 500, so 5 s).
- When dirty pages pass `vm.dirty_background_ratio` (default 10% of available memory), write-back starts in
  the background. When they pass `vm.dirty_ratio` (default 20%), writing processes are made to wait.
- On machines with lots of RAM, 20% can be tens of GB of dirty data. Flushing that much takes a long time and
  can cause stalls, so some teams set the `_bytes` versions of these limits instead.
- `O_DIRECT` bypasses the page cache for a file. Databases that keep their own cache use it to avoid holding
  the same data twice.
:::

### Why "free" memory is low

Here is `free` on a typical long-running server (example numbers):

```text
$ free -h
               total        used        free      shared  buff/cache   available
Mem:            62Gi        21Gi       1.2Gi       1.0Gi        40Gi        39Gi
Swap:          8.0Gi       0.2Gi       7.8Gi
```

Only 1.2 GiB is "free", but nothing is wrong. 40 GiB is page cache that the kernel can shrink at any time.
The column to read is **available**: the kernel's estimate of how much memory programs could get without
swapping. It counts free memory plus the page cache and other caches that can be dropped cheaply.

Low "free" memory is a healthy machine using its RAM. Low "available" memory is the warning sign.

::: tip Dropping the cache is not a fix
`echo 3 > /proc/sys/vm/drop_caches` empties the clean page cache. "Free" memory jumps, and then every program
has to read its files from disk again. It is useful for benchmarks that need a cold cache, not as a fix in
production.
:::

## Reclaim: freeing memory when RAM runs low

**In short:** when free memory runs low, the kernel frees pages that seem least likely to be needed soon. A
background thread usually does this. If it cannot keep up, the programs asking for memory must do it
themselves, and they wait.

Taking back frames that hold data, so they can be reused, is called <Term id="reclaim">reclaim</Term>.
Reclaim has two questions to answer: **which** pages to free, and **who** does the work.

### Which pages: the LRU lists

The ideal choice would be the page that will not be needed for the longest time. The kernel cannot see the
future, so it guesses: a page that has not been used for a while probably will not be used soon. This is the
**least recently used (LRU)** idea.

Tracking the exact order of every access would be far too slow. Instead, the kernel uses a cheaper
approximation with two lists:

- **Active list:** pages used more than once recently. The kernel treats them as in use now.
- **Inactive list:** pages that are candidates for eviction.

New pages usually start on the inactive list. If a page is used again while there, it moves to the active
list. Reclaim takes pages from the end of the inactive list. When the inactive list gets too short, pages from
the end of the active list move down to it.

How does the kernel know a page was used? It does not see individual memory accesses. But the
<Term id="mmu">MMU</Term>, the part of the CPU that translates addresses, sets an **Accessed** flag in the page
table entry on every access. The kernel checks and clears these flags as it scans. A page whose flag is set
again gets a second chance.

The kernel keeps separate lists for file-backed and anonymous pages. That lets it decide how much to take from
each: dropping clean file pages is cheap, while anonymous pages need a write to swap.

::: details Going deeper: swappiness, refaults and MGLRU
- `vm.swappiness` (0 to 200, default 60) sets the balance between reclaiming anonymous pages (to swap) and
  file pages. Higher means "swap anonymous memory more readily". 0 does not disable swap; it makes the kernel
  strongly prefer file pages.
- **Refault detection:** when a file page is evicted, the kernel leaves a small note in its place. If the page
  is read back soon, the kernel knows it evicted something still in use, and puts it straight on the active
  list.
- **MGLRU** (multi-generational LRU), merged in Linux 6.1, replaces the two lists with several age
  generations and scans page tables more efficiently. Some distributions enable it by default. Check
  `/sys/kernel/mm/lru_gen/enabled`.
- Pages that can never be evicted, such as `mlock`ed memory, go on a separate **unevictable** list.
:::

### Who does the work: kswapd and direct reclaim

The kernel keeps three thresholds for free memory, called **watermarks**: *high*, *low* and *min*.

- When free memory falls below **low**, the kernel wakes a background thread called **kswapd**. It reclaims
  pages until free memory is back above **high**. Programs keep running and their allocations succeed at once.
- If programs allocate faster than kswapd can free, free memory falls below **min**. Now a thread that asks for
  memory must reclaim pages itself before it gets any. This is
  <Term id="direct-reclaim">direct reclaim</Term>.

<ReclaimWatermarksDiagram />

Direct reclaim is a common hidden source of latency spikes. A request handler that needs one page may end up
scanning lists, writing dirty pages or waiting for swap. That can take milliseconds, or longer under heavy
pressure. It shows up as slow requests with no obvious cause in the application.

If reclaim cannot free enough memory at all, the kernel is out of memory. Then a part of the kernel called
the <Term id="oom-killer">OOM killer</Term> (out-of-memory killer) ends a process to free its memory. A
section below covers it.

::: details Going deeper: watermark settings and counters
- The watermarks are derived from `vm.min_free_kbytes`. `vm.watermark_scale_factor` widens the gap between
  them, which wakes kswapd earlier and makes direct reclaim less likely.
- There is one kswapd thread per NUMA node (a group of CPUs with its own local RAM, see
  [Chapter 7](/memory/caches-and-numa)). Watermarks apply per memory zone.
- In `/proc/vmstat`, `pgscan_kswapd` and `pgscan_direct` count pages scanned by each path. `allocstall_*`
  counts how often threads entered direct reclaim. A rising `allocstall` is a strong hint of latency trouble.
- Reclaim also shrinks the reclaimable slab caches (file names and metadata).
:::

### Thrashing

The set of pages a program is using right now is its <Term id="working-set">working set</Term>. When the
working sets of all running programs do not fit in RAM, reclaim evicts pages that are needed again almost
immediately. They get read back, which evicts other needed pages, and so on.

The machine then spends most of its time moving pages between RAM and disk, and little doing real work. This
is <Term id="thrashing">thrashing</Term>. Adding CPU does not help. Only a smaller working set or more RAM
does.

## Swap

**In short:** swap gives anonymous pages a place on disk, so the kernel can evict cold heap memory instead of
hot file data. Without swap, anonymous memory can never leave RAM.

Recall the first picture: the kernel can drop a clean file page, because the file still has the data. An
anonymous page has no file. Without somewhere to put it, the kernel can never free it, even if the program
has not touched it for days.

Swap is disk space for this. The kernel writes an unused anonymous page to swap, frees the frame, and records
the page's swap location in its page table entry. If the program touches the page again, it gets a **major
page fault**: the thread waits while the kernel reads the page back from disk.

### Is swap bad?

Heavy swapping is bad: a program whose working set is in swap runs at disk speed. But having swap is usually
good. Consider a server whose processes hold 2 GB of memory they touched once at startup and never again:

- **With swap**, the kernel moves those 2 GB out and uses the RAM for hot file data.
- **Without swap**, those 2 GB stay in RAM forever. Under pressure, the kernel can only evict file pages. That
  includes the code of running programs, which is also file-backed. Programs then fault their own code back in
  constantly.

This is why a Linux machine without swap often freezes for minutes under memory pressure before the OOM
killer acts. It is thrashing on program code. A small amount of swap with a low swappiness is a common
middle ground.

::: tip Compressed swap in RAM: zram and zswap
Instead of a disk, the kernel can compress cold pages and keep them in RAM, often 2 to 4 times smaller.
**zram** is a compressed RAM disk used as a swap device. **zswap** is a compressed cache in front of a real
swap device. Phones, laptops and some Linux distributions use zram by default, because compressing is much
faster than disk I/O.
:::

::: details Going deeper: swap details
- **Swap cache:** a page read back from swap keeps its swap copy for a while. If it is evicted again without
  being changed, no write is needed. `SwapCached` in `/proc/meminfo` counts these pages.
- Kubernetes long required swap to be off on nodes. Newer versions support swap on cgroup v2 hosts, with
  limits per container.
- Latency-critical programs use `mlock` or `mlockall` so their memory is never swapped out.
:::

## Overcommit and the OOM killer

**In short:** Linux promises processes more memory than it has, because most of it is never used. When the
promises come due and nothing can be freed, it kills a process.

### Overcommit

When a program asks for 10 GB with `malloc` or `mmap`, the kernel only records a region. RAM is used as pages
are first touched. So at the time of the request, the kernel must decide: should it promise memory it may not
be able to supply later?

By default, Linux says yes in most cases. Promising more than it has is called
<Term id="overcommit">overcommit</Term>. There are good reasons for it:

- **fork.** A 50 GB process that forks would otherwise need 50 GB more promised, in case every page gets
  copied. Most never are.
- **Sparse use.** Programs reserve large ranges and use little: thread stacks (often 8 MiB each), language
  runtimes such as Go and Java, and memory allocators.

The price is that running out of memory shows up late. `malloc` succeeds, and the failure comes later, at a
page fault somewhere in the program, when the kernel cannot find a frame.

Linux has three modes, set with `vm.overcommit_memory`:

| Mode | Behaviour | When it fails |
|---|---|---|
| **0: heuristic** (default) | Refuses only requests that obviously cannot fit, such as one allocation larger than RAM plus swap. | Mostly later, at page fault time. |
| **1: always** | Never refuses. | Only later, at page fault time. |
| **2: strict** | Keeps a running total of promised memory and refuses once it passes a limit. | At `malloc` or `fork` time, with an error. |

Strict mode sounds safer, but it counts memory that is reserved and never used. Programs that reserve a lot
then fail to start, even when most RAM is idle.

::: details Going deeper: the numbers behind strict mode
- In mode 2 the limit is `CommitLimit` = swap + RAM × `vm.overcommit_ratio` / 100 (default ratio 50). Both
  `CommitLimit` and the current total, `Committed_AS`, are in `/proc/meminfo`.
- Mostly private writable memory counts towards the total. Read-only and shared file mappings can always be
  dropped and re-read, so they do not count.
- Redis prints a warning at startup unless `vm.overcommit_memory = 1`. Under mode 0 the kernel's heuristic can
  refuse the large `fork` it uses for snapshots when memory is tight.
:::

### The OOM killer

When reclaim fails and no frame can be found, the kernel has to make memory free somehow. The OOM killer
picks a process and kills it with `SIGKILL`, a signal that cannot be caught or ignored.

It picks the process whose death frees the most memory. Each process gets a score, mostly its share of RAM
and swap. The process with the highest score is killed. You can see the score in `/proc/<pid>/oom_score`.

You can shift the score with `/proc/<pid>/oom_score_adj`, from −1000 to +1000:

- **−1000** means never kill this process. Critical system daemons use it.
- **+1000** means kill this process first. Good for disposable work such as batch jobs.

The kernel logs every kill. `dmesg` shows a line such as
`Out of memory: Killed process 4321 (java) total-vm:… anon-rss:…`, after a table of all processes and their
memory. This is the first place to look when a process vanished without an error message.

::: warning The kernel OOM killer acts late
The kernel only kills when reclaim has completely failed. Before that point, the machine can thrash for a
long time: badly slow, but not dead. Tools such as **systemd-oomd** and **earlyoom** watch memory pressure (see
PSI below) and kill earlier, before the machine becomes unusable.
:::

::: details Going deeper: how the score is computed
The kernel's "badness" of a process is its resident memory + swap use + page table size, in pages. It then
adds `oom_score_adj` × (total RAM + swap) / 1000. So an adjustment of +500 counts as if the process used half
of all memory. Setting `vm.panic_on_oom` makes the kernel crash and restart instead, which some clusters
prefer to an unpredictable kill. Kubernetes sets `oom_score_adj` per container: −997 for its highest
priority class, 1000 for its lowest.
:::

## Memory limits for containers

**In short:** a memory cgroup puts a limit on a group of processes. The group's page cache counts towards the
limit, and when the group cannot stay under it, the OOM killer runs inside that group only.

Containers use a Linux feature called <Term id="cgroup">cgroups</Term> to limit what a group of processes can
use. For memory, the kernel counts every page the group's processes bring into RAM: anonymous memory, page
cache, shared memory, and kernel memory used on their behalf. [Chapter 18](/systems/virtualization) covers
cgroups in general. Here is what matters for memory, using cgroup version 2:

- **`memory.max`** is the hard limit. When the group reaches it, the kernel reclaims pages from that group
  only. If that fails, the OOM killer kills a process in the group, even if the machine has plenty of free
  RAM.
- **`memory.high`** is a softer limit. Above it, the kernel reclaims hard from the group and slows down its
  allocations. It never kills.
- **`memory.low`** and **`memory.min`** protect a group: the kernel avoids reclaiming its memory below these
  amounts while other groups can give up memory instead.

### The page cache counts

A page of a file is charged to the group whose process first brought it into RAM. So a container that reads
a 20 GB file may show 20 GB of memory use, even though its program is small. This surprises many people, but
it rarely causes a kill: clean page cache is reclaimed first when the group nears its limit.

Kills happen when the memory cannot be reclaimed:

- **Anonymous memory**, when the container has no swap.
- **Shared memory and in-memory file systems (tmpfs).** Files in `/dev/shm`, or in a Kubernetes memory-backed
  volume, live in RAM and count towards the limit. They look like files but behave like anonymous memory.
- **Dirty pages** that cannot be written back fast enough.

::: details Going deeper: where to look inside a container
- `memory.current` is the group's total usage. `memory.stat` splits it into `anon`, `file`, `shmem`,
  `file_dirty`, `slab` and more. `memory.events` counts how often the group hit `high` and `max`, and how many
  `oom_kill`s happened.
- Kubernetes reports a container's **working set** as usage minus inactive file pages. Its eviction decisions
  and most dashboards use this number, not raw usage.
- A container killed by the OOM killer exits with status 137: 128 + 9, the number of `SIGKILL`. Kubernetes
  shows it as `OOMKilled`.
- `memory.oom.group = 1` makes the OOM killer kill the whole group together, instead of leaving it half
  alive.
- Language runtimes must know the limit to size their heaps. Recent JVMs read the cgroup limit
  (`-XX:MaxRAMPercentage` sets the heap share). Go has the `GOMEMLIMIT` setting.
:::

## Memory pressure: PSI

**In short:** pressure stall information (PSI) measures how much time tasks lose waiting for memory. It shows
memory trouble earlier and more directly than "available" memory does.

"How much memory is free?" does not tell you whether anyone is suffering. A machine can have little available
memory and run fine, or have some left and still spend a lot of time in reclaim. What you want to know is:
how much time are programs losing because memory is short?

Linux measures this directly, since kernel 4.20, as
<Term id="psi">pressure stall information (PSI)</Term>:

```text
$ cat /proc/pressure/memory
some avg10=2.31 avg60=0.87 avg300=0.21 total=48213511
full avg10=0.45 avg60=0.12 avg300=0.03 total=9923140
```

- **some**: the percentage of time at least one task was stalled waiting for memory, for example in direct
  reclaim or reading a page back from swap.
- **full**: the percentage of time **all** active tasks were stalled at once. Nobody was doing useful work.
- `avg10`, `avg60` and `avg300` are averages over 10 s, 60 s and 5 minutes. `total` is the total stall time in
  microseconds.

Every cgroup has its own `memory.pressure` file in the same format. This is how systemd-oomd and similar
tools decide to act: they kill or throttle a group when its pressure stays high, well before the kernel OOM
killer would. PSI also exists for CPU and I/O.

## Measuring memory: VSZ, RSS and PSS

**In short:** virtual size counts reserved addresses. Resident size counts RAM, but counts shared pages in
every process. Proportional size splits shared pages fairly between their users.

"How much memory does this process use?" has several honest answers:

- <Term id="vsz">**VSZ (virtual size)**</Term>: the total size of all the process's regions. It includes
  reserved addresses that have no RAM behind them. It is often huge and rarely useful.
- <Term id="rss">**RSS (resident set size)**</Term>: how much of the process's memory is in RAM right now. It
  counts shared pages, such as libraries, in full.
- <Term id="pss">**PSS (proportional set size)**</Term>: like RSS, but each shared page is divided by the
  number of processes sharing it.
- **USS (unique set size)**: only the pages no other process uses. It is what you would get back by killing
  the process.

Here is why the difference matters. A server forks 10 worker processes. They share 1 GB of data loaded before
the fork, and each has 100 MB of its own:

| Measure | Per worker | Sum over 10 workers | Real RAM used |
|---|---|---|---|
| RSS | 1.1 GB | 11 GB | about 2 GB |
| PSS | 0.2 GB | 2 GB | about 2 GB |
| USS | 0.1 GB | 1 GB | (misses the shared 1 GB) |

Adding up RSS over-counts shared memory. Adding up PSS gives the true total. That is why PSS is the number to
use for "how much memory does this whole service use?".

Linux shows these numbers per region in `/proc/<pid>/smaps`, and summed for the whole process in
`/proc/<pid>/smaps_rollup` (trimmed here):

```text
$ cat /proc/self/smaps_rollup
Rss:                1580 kB
Pss:                 327 kB
Shared_Clean:       1436 kB
Private_Clean:        36 kB
Private_Dirty:       108 kB
Anonymous:           108 kB
Swap:                  0 kB
```

This small `cat` process has 1.6 MB resident, but almost all of it is shared library code. Its fair share is
327 kB. `Private_Clean` plus `Private_Dirty` is its USS.

::: details Going deeper: which tool shows what
- `ps` and `top` show VSZ and RSS. `smem` and `pmap -X` show PSS and USS.
- `/proc/<pid>/status` splits resident memory into `RssAnon`, `RssFile` and `RssShmem`. `VmSwap` shows how
  much of the process is in swap. RSS does not include swapped-out pages.
- Reading `smaps` walks the process's page tables. On very large processes it is slow, and it briefly holds a
  lock that can stall the process.
- Memory freed with `MADV_FREE` stays in RSS until the kernel needs it, so RSS can look higher than real use.
  [Chapter 6](/memory/allocators) explains why RSS often does not shrink after `free`.
:::

### Reading /proc/meminfo

`/proc/meminfo` is the system-wide view. These are the lines to know:

| Line | What it means |
|---|---|
| `MemFree` | RAM holding nothing at all. Usually small on a healthy machine. |
| `MemAvailable` | Estimate of memory programs can get without swapping. The number to watch. |
| `Cached` | Page cache, including shared memory and tmpfs files. |
| `Active(file)`, `Inactive(file)` | Page cache on each LRU list. Inactive file pages are the cheapest to reclaim. |
| `AnonPages` | Anonymous memory of all processes. |
| `Shmem` | Shared memory and tmpfs. Counted in `Cached`, but cannot be dropped, only swapped. |
| `Dirty`, `Writeback` | Changed file pages waiting to be written to disk, or being written now. |
| `SReclaimable`, `SUnreclaim` | Kernel slab memory that can or cannot be reclaimed. |
| `Committed_AS`, `CommitLimit` | Memory promised to processes, and the limit used in strict overcommit mode. |

A classic trap is `Shmem`. Large shared memory or tmpfs use shows up under `Cached`, so the machine looks
like it has lots of reclaimable cache. That memory cannot be dropped.

## Why this matters in real systems

**Redis snapshots.** Redis saves its data by forking. The child writes the snapshot while the parent keeps
serving. Every page the parent changes meanwhile gets copied. A write-heavy instance can nearly double its
memory during a snapshot. That is why Redis's guidance says to leave spare RAM, set
`vm.overcommit_memory = 1` and turn transparent huge pages off.

**Python workers and "copy-on-read".** ML data loaders and web servers often load data, then fork workers to
share it. But Python updates a reference counter inside every object it touches. So merely reading a shared
Python object writes to its page, and copy-on-write duplicates it. Each worker's memory grows until it holds
its own copy. Fixes include keeping data in NumPy arrays or other flat buffers, and calling `gc.freeze()`
before forking.

**Loading model weights with mmap.** Mapping a weights file lets many processes on one machine share a single
copy in the page cache. Loading is also lazy, so a process can start before all weights are read. Formats
such as safetensors are designed to be mapped this way. The first requests touch pages that are not in RAM yet
and pay for major faults, so servers often read the file once at startup to warm the cache.

**Databases and the page cache.** PostgreSQL keeps its own buffer cache and also reads through the page cache,
so hot data can sit in RAM twice. The common advice is to give its own cache about a quarter of RAM and leave
the rest to the kernel. Other databases use `O_DIRECT` to skip the page cache and do all caching themselves.

**The container that was killed with memory to spare.** A service in Kubernetes is `OOMKilled`, but its heap
is small. One common cause is files in a memory-backed volume or `/dev/shm`. Another is a runtime that sizes
its heap from the host's RAM instead of the container limit. A third is memory outside the heap, such as
thread stacks and native buffers. `memory.stat` shows which kind it is.

**Latency spikes from reclaim.** A service with steady CPU use shows p99 spikes. `/proc/vmstat` shows
`allocstall` rising, and memory PSI `some` is above zero: threads are doing direct reclaim. Often a batch job on
the same host is filling the page cache by reading large files. Fixes include putting the batch job in a
cgroup with `memory.high`, raising the watermark scale factor so kswapd starts earlier, or having the batch job
use `O_DIRECT` or `posix_fadvise(POSIX_FADV_DONTNEED)`.

**How to measure it:**

```bash
free -h                                  # look at "available", not "free"
vmstat 1                                 # si/so = swap in/out per second
grep -E 'allocstall|pgscan|pgsteal|oom_kill' /proc/vmstat
cat /proc/pressure/memory                # PSI; per cgroup: memory.pressure
cat /proc/<pid>/smaps_rollup             # RSS, PSS, private vs shared
dmesg | grep -i 'killed process'         # OOM kills
cat /sys/fs/cgroup/<group>/memory.stat   # what a container's memory is made of
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. What happens, step by step, when a process calls fork and then the child writes to a variable?
`fork` creates the child with a copy of the parent's page table. Both now point at the same frames. The kernel
marks all private writable pages read-only in both processes and counts the users of each frame.

When the child writes, the hardware sees a write to a read-only page and raises a page fault. The kernel sees
the page is shared copy-on-write. It copies the page to a new frame, points the child's entry at it, makes it
writable, and runs the write again. The parent still has the original.

**Senior add-on:** the page table copy itself is not free: roughly 8 bytes per 4 KiB page, which can pause a
large process for tens to hundreds of milliseconds. Use `posix_spawn` or `vfork` when the child will only call
`exec`.
:::

::: details 2. Explain the four kinds of mmap: private or shared, file-backed or anonymous.
- **Private file:** read a file through memory; writes make a private copy and never reach the file. Used for
  program code and libraries.
- **Shared file:** writes go to the page cache and later to the file. Other processes mapping it see them.
- **Private anonymous:** plain zero-filled memory. This is the heap, the stack and big `malloc` blocks.
- **Shared anonymous:** zero-filled memory that stays shared with children after `fork`.

**Senior add-on:** a file mapping and `read` of the same file use the same page cache frames. `mmap` avoids a
copy, but moves disk reads into page faults, which the program cannot schedule and whose errors arrive as
`SIGBUS`.
:::

::: details 3. A Linux server shows 1 GB free out of 64 GB. Is that a problem?
Usually not. Linux uses spare RAM for the page cache, which holds file data it can drop quickly. Look at
**available** memory in `free`, or `MemAvailable` in `/proc/meminfo`. That estimates what programs could get
without swapping.

The real signs of trouble are low available memory, steady swap-in activity, rising direct reclaim counts, or
memory PSI above zero.

**Senior add-on:** check `Shmem` too. Shared memory and tmpfs files show up as cache but cannot be dropped.
:::

::: details 4. What does the kernel do when RAM runs low?
It reclaims. It picks pages that have not been used recently, using active and inactive lists that
approximate least-recently-used order. Clean file pages are dropped. Dirty file pages are written back first.
Anonymous pages are written to swap, if there is swap.

A background thread, kswapd, does this when free memory falls below a "low" mark. If allocations outpace it
and free memory falls below "min", the allocating threads must reclaim themselves (direct reclaim). If nothing
can be freed, the OOM killer kills a process.

**Senior add-on:** mention swappiness (the balance between anonymous and file pages), refault detection, and
that direct reclaim is a classic hidden cause of tail latency, visible in `allocstall` and PSI.
:::

::: details 5. Why does Linux allow overcommit? What are the alternatives?
Programs reserve far more than they use: thread stacks, runtime heaps, sparse arrays, and above all `fork`,
which would otherwise need the parent's whole size promised again. Refusing these would waste RAM or break
programs.

The cost is that running out shows up late, as an OOM kill at some page fault, not as `malloc` returning
`NULL`. The alternative is strict mode (`vm.overcommit_memory = 2`). The kernel then refuses to promise more
than swap plus a share of RAM. Failures become clean errors, but programs that reserve a lot fail early.

**Senior add-on:** to protect one critical service, use cgroup limits, pre-touch or `mlock` its memory, and
set `oom_score_adj`, instead of changing the system-wide mode.
:::

::: details 6. How does the OOM killer choose its victim, and how do you protect a process?
It gives each process a score, mostly the RAM, swap and page tables it uses, so that killing it frees the most
memory. The highest score is killed with `SIGKILL`. `oom_score_adj` shifts the score, from −1000 (never kill)
to +1000 (kill first).

**Senior add-on:** in a container, the OOM killer runs within the cgroup that hit its `memory.max`, even if the
host has free RAM. Kubernetes sets `oom_score_adj` by priority class. User-space killers like systemd-oomd act
earlier based on PSI, because the kernel only acts after reclaim has fully failed.
:::

::: details 7. Your container was OOMKilled, but the application's heap was only half the limit. What could it be?
Something other than the heap filled the limit. Candidates:

1. **Memory outside the heap:** thread stacks, native libraries, direct buffers, the runtime's own overhead.
2. **tmpfs or `/dev/shm` files**, which count as memory and cannot be dropped.
3. **A runtime sized for the host**, not the container, so it grows past the limit.
4. **Dirty page cache** from heavy writes that cannot be flushed fast enough.

Clean page cache is rarely the cause, because it is reclaimed first. Look at `memory.stat` (`anon`, `shmem`,
`file_dirty`), `memory.events`, and the kill message in `dmesg`.

**Senior add-on:** dashboards sample memory every few seconds. A short allocation spike can hit the limit and
trigger a kill without ever appearing on the graph.
:::

::: details 8. What is the difference between RSS, VSZ and PSS? Which would you use to size a machine?
VSZ is all reserved addresses, mostly without RAM behind them. RSS is what is in RAM now, counting shared pages
in full for every process. PSS divides each shared page between the processes that share it.

To size a machine for a service with many processes, sum PSS. Summing RSS counts shared libraries and
fork-shared data many times.

**Senior add-on:** RSS leaves out swapped pages, and freed memory can stay in RSS (`MADV_FREE`, allocator
caches). Use `smaps_rollup` for PSS, and cgroup `memory.current` for the whole container including page cache.
:::

::: details 9. Should production servers run with swap?
It depends on what you prefer when memory runs out. Without swap, cold anonymous memory can never leave RAM.
Under pressure the kernel evicts file pages, including program code, and the machine can freeze for a long
time before the OOM killer acts. With a little swap, the kernel can move out truly cold pages and keep more
useful cache.

For latency-critical services, swapping a hot page back in is a long stall, so many teams limit swap or use
`mlock`.

**Senior add-on:** compressed swap in RAM (zram or zswap) gives much of the benefit without disk latency.
Pairing swap with PSI-based early OOM handling avoids long thrashing periods.
:::

::: details 10. write() returned successfully, then the machine lost power. Is the data on disk?
Not necessarily. `write` copies data into the page cache and marks it dirty. Kernel threads write it to disk
later: after about 30 seconds, or sooner if there is a lot of dirty data. Until then, a power loss loses it.

To make it durable, call `fsync` (or `fdatasync`) and check its result.

**Senior add-on:** if too much data is dirty, the kernel makes writers wait, so a burst of writes can suddenly
make `write` slow. [Chapter 13](/io/file-systems) covers `fsync` and its pitfalls.
:::

::: details 11. Scenario: kswapd uses a lot of CPU and latency is bad, but "available" memory looks fine. What do you check?
1. **PSI** in `/proc/pressure/memory`: is anyone actually stalling?
2. **`/proc/vmstat`:** `allocstall` for direct reclaim, and `pgscan` against `pgsteal`. Many pages scanned but
   few freed means reclaim is struggling.
3. **Fragmentation.** The kernel may need continuous blocks, for huge pages or some drivers. Then reclaim and
   compaction run even with plenty free in total. Check `/proc/buddyinfo` and `compact_stall`.
4. **NUMA imbalance.** One memory node may be full while others are not. kswapd works per node.
5. **Per-cgroup limits.** A container near `memory.high` reclaims hard while the host looks fine.

**Senior add-on:** fixes include raising `vm.watermark_scale_factor`, setting transparent huge pages to
`madvise`, moving noisy batch jobs into their own cgroup, and fixing NUMA placement.
:::

## Common misconceptions

- **"Free memory near zero means the machine needs more RAM."** It means the page cache is using spare RAM.
  Watch available memory and pressure.
- **"fork copies the process's memory."** It copies the page table. Data is copied page by page, only on write.
- **"malloc returns NULL when memory runs out."** On Linux with default settings, the process is usually killed
  later instead.
- **"Swap is always bad."** Heavy swapping is bad. Having some swap lets the kernel move cold memory out and
  often avoids long freezes.
- **"RSS is how much memory a process costs."** It counts shared pages in full. PSS gives the fair share.
- **"Page cache in a container is free."** It counts towards the container's limit. Clean cache is reclaimed
  first, but tmpfs and shared memory cannot be.

## Key takeaways

- Pages differ in how cheaply they can be freed: **clean file pages** are dropped, **dirty** ones written back
  first, **anonymous** ones need swap, and some cannot be freed at all.
- **Copy-on-write** makes `fork` copy only the page table. Each page is copied on its first write.
- The **page cache** fills spare RAM. Judge memory by available memory and **PSI**, not by free memory.
- **Reclaim** runs in the background (kswapd) until it cannot keep up. Then threads reclaim directly and wait.
  If nothing can be freed, the **OOM killer** kills a process, inside a cgroup if its limit was hit.
- Measure a service's memory with **PSS** or cgroup usage, not by summing RSS.

## Review

<Flashcards id="kernel-memory" :cards="cards" />

<MarkDone id="kernel-memory" />
