---
title: 4. Virtual Memory
---

<script setup>
import { cards } from './vm-review'
</script>

# 4. Virtual Memory

Virtual memory is the idea that every program gets its own private view of memory. Processes, `fork`,
shared libraries, memory-mapped files and many latency problems all depend on it. That makes it one of the
most common starting points for deeper interview questions.

::: info Before you start
- A <Term id="process">process</Term> is a running program. The <Term id="kernel">kernel</Term> is the core
  of the operating system, which manages all processes.
- Programs run in a restricted <Term id="user-mode">user mode</Term>. The kernel runs in a privileged kernel
  mode and can do anything.
- The CPU reads and writes RAM using **addresses**: numbers that say which byte to use.

You do not need anything else. [Chapter 1](/foundations/what-is-an-os) covers these ideas in full.
:::

## The problem virtual memory solves

**In short:** if programs used real RAM addresses, they could damage each other and would be hard to place
in memory. Virtual memory adds a translation step that fixes this.

Imagine each program used real RAM addresses directly. Small microcontrollers still work this way.
Several problems appear at once:

- **No protection.** A bug in one program can overwrite another program, or the kernel.
- **Placement is hard.** Each program must know where in RAM it was loaded, or all its addresses must be
  patched when it starts.
- **RAM fragments.** As programs start and stop, free RAM breaks into small gaps. A program that needs one
  large block may not fit anywhere, even when enough RAM is free in total.
- **No controlled sharing.** Two programs cannot easily share only some memory.

Virtual memory fixes all of these with one idea. Each process gets its own private
<Term id="address-space">address space</Term>. Programs only ever use
<Term id="virtual-address">virtual addresses</Term>. On every memory access, the hardware translates the
virtual address into a <Term id="physical-address">physical address</Term>, which is a real location in
RAM. It uses tables that the kernel sets up for each process.

Because every access goes through this translation, the kernel gets a lot of control:

| Feature | How translation makes it possible |
|---|---|
| Protection | A process can only reach the RAM that its own table points to. |
| Simple layout | Every program can use the same addresses, wherever it really is in RAM. |
| No fragmentation | Neighbouring virtual addresses can map to scattered pieces of RAM. |
| Sharing | Two processes' tables can point to the same RAM (for example, shared libraries). |
| Memory on demand | An address can be valid but get RAM only when first used. |
| Cheap copies | `fork` shares memory and copies a piece only when someone writes to it. |
| Files as memory | A range of addresses can show a file's contents, loaded when read. |
| Permissions | Each piece of memory can be read-only, writable, or executable. |

::: tip Who does what
The **hardware** translates every access. The **kernel** decides what the translations are, and steps in
only when the hardware cannot translate an address. On a normal memory access, the kernel does nothing.
:::

## Pages and frames

**In short:** memory is translated in fixed blocks of 4 KiB. A block of virtual memory is a page. A block
of RAM is a frame.

Translating every byte separately would need enormous tables. So memory is split into fixed-size blocks,
usually **4 KiB** (4096 bytes):

- A <Term id="page">page</Term> is a 4 KiB block of virtual memory.
- A <Term id="frame">frame</Term> is a 4 KiB block of RAM.
- A <Term id="page-table">page table</Term> records which frame holds each page. Each process has its own
  page table.

Here is how an address splits up. 4096 is 2<sup>12</sup>, so the lowest 12 bits of an address say where
you are **inside** the page. This part is called the **offset**. The remaining bits are the **page
number**. Only the page number is translated. The offset stays the same.

```text
virtual address   0x00007f3a12345678
page number       0x00007f3a12345      (the address without its last 12 bits)
offset                         0x678   (the last 12 bits)

the page table says: page 0x7f3a12345 is in frame 0x1b2c4
physical address  0x1b2c4678           (frame number, then the same offset)
```

<VmOverviewDiagram />

Fixed-size blocks mean RAM cannot fragment: any free frame can hold any page. The cost is some wasted
space. A 100-byte allocation still uses part of a 4 KiB page. This trade-off comes back in the huge pages
section.

## Page tables

**In short:** the page table is a tree, not a list, because most of a process's address space is unused.

### Why not one big list?

The simplest page table would be a list with one entry per page. But a 64-bit process can use about 128 TiB
of addresses. That is about 34 billion pages. At 8 bytes per entry, the list would take **hundreds of GiB for
every process**.

Almost all of those entries would be empty. A real process uses a few small areas: its code, its data, a
stack, some libraries. Between them are huge unused gaps.

So the page table is a **tree**. The top level splits the address space into large parts. Each part that is
in use has its own smaller table below it, and so on. Unused parts have no tables at all. A small process
needs only a few dozen KiB of tables.

### Walking the tree

On x86-64, the tree has **four levels**. The page number is split into four 9-bit pieces, one for each
level. The CPU uses them like this:

<PageWalkDiagram />

1. The CPU keeps the location of the current process's top table in a <Term id="register">register</Term>,
   a small storage slot inside the CPU.
2. It uses the first 9-bit piece to pick an entry in the top table. That entry points to a table on the
   next level.
3. It repeats this with the second and third pieces.
4. The fourth piece picks an entry in the last table. That entry holds the **frame number**.
5. Frame number + offset = the physical address.

Each table has 512 entries (2<sup>9</sup>), and each entry is 8 bytes. So each table is exactly 4 KiB: one
page. This means the kernel stores page tables in ordinary frames, like any other data.

This whole process is called a **page walk**. The part of the CPU that does it is the
<Term id="mmu">memory management unit (MMU)</Term>. The kernel builds the tables, but the MMU reads them. No
kernel code runs during a normal translation.

When the kernel switches to another process, it loads that process's top-table location into the register.
From then on, every address is translated with the new process's tree.

::: details Going deeper: the x86-64 names and details
- The register is called **CR3**. The four levels are called **PML4**, **PDPT**, **PD** (page directory) and
  **PT** (page table).
- x86-64 uses 48-bit virtual addresses: 4 × 9 bits of index + 12 bits of offset. Newer CPUs support
  **5-level paging** with 57-bit addresses.
- **Canonical addresses:** the top 16 bits of a pointer must all copy bit 47. This splits the 64-bit space
  into a low half (user programs on Linux, up to `0x00007fffffffffff`) and a high half (the kernel, from
  `0xffff800000000000`). Any address in the gap between them always faults.
- Some older architectures, such as MIPS, had no hardware walker. Every TLB miss trapped into the kernel,
  which did the walk in software.
:::

### What a page table entry holds

Each entry in the last-level table holds a frame number and a few flag bits. The MMU checks the flags on
every access:

| Flag | Meaning | Why it matters |
|---|---|---|
| **Present** | This page has a frame. | If not set, any access causes a page fault. |
| **Writable** | Writes are allowed. | Code is read-only. Copy-on-write works by turning this off. |
| **User** | User-mode code may access it. | Keeps kernel memory out of reach of programs. |
| **Accessed** | The page was used recently. | The kernel uses it to pick pages that are safe to evict. |
| **Dirty** | The page was written to. | A page that changed must be saved to disk before its frame can be reused. |
| **No-execute** | Code in this page must not run. | Stops attackers from running data (for example, on the stack) as code. |

The MMU sets the Accessed and Dirty flags by itself. The kernel reads and clears them.

::: details Going deeper: more flags
- **Global**: this translation stays in the TLB when the process changes. It is used for kernel memory,
  which looks the same in every process.
- **Page size**: set in a higher-level entry, it means that entry maps a huge page directly and the walk
  stops early.
- When **Present** is not set, the MMU ignores the other bits. Linux uses them to record where a page was
  saved in swap.
:::

## The TLB

**In short:** walking the tree on every access would be very slow, so the CPU caches recent translations in
the TLB.

A page walk needs four memory reads, one per level, before the real read can start. Each read needs the
result of the one before it, so they cannot happen in parallel. Doing this on every access would make
memory several times slower.

So the CPU keeps a small cache of recent translations, "page X is in frame Y, with these permissions". This
cache is the <Term id="tlb">translation lookaside buffer (TLB)</Term>. Each CPU core has its own.

- **TLB hit:** the translation is in the cache. It costs almost nothing.
- **TLB miss:** the CPU must walk the tree. It costs from tens of CPU cycles (if the tables are in the CPU's
  memory caches) to hundreds (if they must come from RAM).

### TLB reach

The TLB holds only a limited number of translations, around 1,500 on a typical modern core. The most useful
number to reason with is its **reach**: how much memory those translations cover.

```text
1,536 translations × 4 KiB pages  ≈ 6 MiB
1,536 translations × 2 MiB pages  ≈ 3 GiB
```

If a program's frequently used data fits within the reach, it rarely misses. A program that jumps around
**gigabytes** of memory at random misses on almost every access. Examples are big hash tables, database
indexes, graph algorithms and embedding lookups. Such programs can spend a large share of their time on page
walks. This is the main reason huge pages exist.

::: details Going deeper: real TLB sizes
Modern cores have two TLB levels: a small first-level data TLB (around 64 entries) and a larger second-level
TLB (around 1,000 to 3,000 entries). Sizes change with each CPU generation, and huge pages may have separate
or fewer entries. The CPU also caches upper levels of the tree separately, so many misses need fewer than
four reads.
:::

<AddressTranslator />

Try these in the widget:

1. Translate the **code** address twice. The first time misses the TLB and walks the tree. The second time
   is a hit.
2. Try **heap (first touch)**. The walk finds the page is not present, so the kernel handles a page fault.
   Then the access runs again.
3. Try **NULL** and **kernel**. Both crash, for different reasons.
4. Run **sequential 16 KiB**. 256 accesses touch only 4 pages, so almost all of them hit.
5. Run **stride 4 KiB × 8 pages** twice. Every access is to a new page. The TLB holds only 4 translations, so
   it keeps throwing out the ones it will need next, even on the second run.

### The TLB when switching processes

**In short:** another process means other translations, so the TLB must be cleared or its entries tagged.
Switching between threads does not have this cost.

TLB entries belong to one address space. When the CPU switches to another process, the cached translations
are wrong for the new process. There are two ways to deal with that:

- **Clear the TLB.** This is simple, but the new process starts with an empty TLB and pays for many misses.
- **Tag each entry** with an ID for its address space. Entries with another ID do not match, so nothing
  needs clearing. When a process runs again, some of its translations may still be there.

A <Term id="thread">thread</Term> is a line of execution inside a process, and threads of one process share
its address space. So a switch between two threads of the same process keeps the same page table and keeps
the TLB valid. This is one concrete reason why a thread switch costs less than a process switch.

::: details Going deeper: PCID, ASID and KPTI
- The tags are called **PCID** on x86 and **ASID** on ARM.
- Kernel translations are marked **Global**, so they stay in the TLB during any switch.
- In 2018 the **Meltdown** attack showed that user programs could read kernel memory through a CPU flaw. The
  Linux fix, **KPTI** (kernel page-table isolation), gives user mode a page table without most kernel
  memory. Now every <Term id="syscall">system call</Term> switches page tables twice. Tagged TLB entries are
  what keep that affordable. [Chapter 17](/systems/security) covers this.
:::

### TLB shootdowns

**In short:** when the kernel changes a translation, it must interrupt other cores to clear their old copy.

The hardware does not keep TLBs up to date with the page tables. Suppose the kernel removes a mapping, for
example because the program released memory. Other cores running the same process may still hold the old
translation in their TLB.

So the kernel sends an <Term id="interrupt">interrupt</Term> to each of those cores, telling them to drop the
entry. It usually waits until all of them confirm. This is called a **TLB shootdown**.

Shootdowns get more expensive as a process runs on more cores. A program with many threads that often
releases memory can lose a lot of time to them. Some memory allocators do this on every `free`.

::: details Going deeper: where to see them
Operations that trigger shootdowns include `munmap`, `mprotect`, `madvise(MADV_DONTNEED)`, moving pages
between NUMA nodes, and reclaiming memory. On Linux, `/proc/interrupts` has a `TLB` line counting them per
core. The interrupts between cores are called IPIs (inter-processor interrupts).
:::

## Page faults

**In short:** when the hardware cannot translate an address, it hands the problem to the kernel. The kernel
either supplies the page, or stops the program.

The MMU cannot always finish a translation. The entry may be marked not present, or the access may not be
allowed, such as a write to a read-only page. Then the CPU stops the instruction and jumps into the kernel.
This is a <Term id="page-fault">page fault</Term>.

<PageFaultDiagram />

The kernel keeps a list of the **memory regions** each process owns. A
<Term id="vma">memory region</Term> is a continuous range of addresses with one set of permissions and one
source of data, such as the heap, the stack, or a mapped file. The kernel first checks which region the
address belongs to. There are three possible outcomes:

| Kind | What happened | Cost |
|---|---|---|
| **Minor fault** | The data is already available in RAM, or the page just needs a new empty frame. | About a microsecond |
| **Major fault** | The data must be read from disk: a file not in memory yet, or a page moved to swap. The thread waits. | About 100 µs on an SSD, about 10 ms on a hard disk |
| **Invalid access** | The address is in no region, or the access is not allowed. | The process gets a <Term id="sigsegv">segmentation fault</Term> and usually crashes |

After a minor or major fault, the kernel fills in the page table entry and returns. The CPU then **runs the
same instruction again**, and this time it works. The program cannot tell a fault happened. The instruction
just took longer.

::: details Going deeper: what "already in RAM" means
A minor fault covers several cases:
- First touch of new memory: the kernel gives the page a fresh frame filled with zeros.
- A file page that is already in the <Term id="page-cache">page cache</Term> because another process or an
  earlier read loaded it.
- A <Term id="copy-on-write">copy-on-write</Term> page after `fork`: the kernel copies it and makes the copy
  writable.

On x86 the CPU records the faulting address in a register called **CR2**. Linux calls memory regions
**VMAs** (virtual memory areas). An access beyond the end of a mapped file raises `SIGBUS` instead of
`SIGSEGV`.
:::

### Memory on demand

**In short:** asking for memory only reserves addresses. RAM is given page by page, the first time each page
is used.

When a program asks for memory with `malloc` or <Term id="mmap">`mmap`</Term>, the kernel only records a new
or bigger memory region. No RAM is used yet. The first time the program touches each page, a page fault
occurs, and the kernel gives that page a frame. This is called **demand paging**.

This has consequences you should know:

- `malloc(1 GiB)` returns immediately. RAM use does not grow until the program writes to that memory.
- Reading a page that was never written returns zeros, without using a new frame. Only writing uses one.
- The kernel can promise more memory than the machine has. If programs then use it all, the kernel runs out
  later, at a page fault, and may kill a process. [Chapter 5](/memory/kernel-memory) covers this.
- The cost of getting memory moves from the `malloc` call to the **first use**, which may be in the middle of
  handling a request.

### Try it: watch page faults happen

This program reserves 256 MiB, writes one byte to each page twice, and counts minor faults each time:

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
            p[off] = 1;                        // write one byte per page
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

The first pass has one fault per page: 256 MiB / 4 KiB = 65,536. The second pass has none and is about 30
times faster. That difference is the cost of demand paging.

::: details Going deeper: variations to try
- If your machine uses huge pages automatically (`cat /sys/kernel/mm/transparent_hugepage/enabled` shows
  `[always]`), you may see only about 128 faults, one per 2 MiB.
- Add `MAP_POPULATE` to the `mmap` flags. The kernel then supplies all pages inside `mmap`, and both passes
  show 0 faults.
:::

## The process address space

**In short:** each process's address space has the same basic layout, with code at the bottom, the stack
near the top, and the kernel above.

Here is a typical Linux x86-64 process:

<AddressSpaceDiagram />

Things to notice:

- **Code** is read-only and executable. **Data**, the **heap** and the **stack** are writable but not
  executable.
- The heap grows up. The stack grows down. Large `malloc` requests usually get their own separate region.
- The starting positions of the stack, heap and libraries are **randomised** on each run. This makes attacks
  harder, because attackers cannot predict addresses.
- **The kernel is mapped into every process**, in the top half, but user code cannot access it. So a system
  call can run kernel code without switching page tables (except with KPTI, described above).
- The lowest addresses are never mapped. That is why using a `NULL` pointer crashes immediately instead of
  reading garbage.

You can list the memory regions of any process. Each line is one region: the address range, the
permissions, and what backs it:

```text
$ cat /proc/self/maps
5604f1e00000-5604f1e02000 r--p 00000000 08:01 1310743   /usr/bin/cat
5604f1e02000-5604f1e07000 r-xp 00002000 08:01 1310743   /usr/bin/cat
5604f2a3b000-5604f2a5c000 rw-p 00000000 00:00 0         [heap]
7f5c8a800000-7f5c8a828000 r--p 00000000 08:01 1314302   /usr/lib/x86_64-linux-gnu/libc.so.6
7f5c8a828000-7f5c8a9bd000 r-xp 00028000 08:01 1314302   /usr/lib/x86_64-linux-gnu/libc.so.6
7ffd5c3f1000-7ffd5c412000 rw-p 00000000 00:00 0         [stack]
```

In the permissions column, `r`, `w` and `x` mean read, write and execute. `p` means private to this
process; `s` would mean shared.

::: tip Two ways to measure memory
- **Virtual size (VSZ):** the total size of all regions. It includes reserved addresses that have no RAM.
- **Resident size (<Term id="rss">RSS</Term>):** how much is actually in RAM right now.

A very large virtual size is normal. Go and Java runtimes, memory allocators and GPU drivers reserve big
address ranges in advance. When someone says "this process uses 40 GB", ask which of the two they mean.
:::

::: details Going deeper: the executable's position
Modern Linux executables are position-independent (PIE), so they load near `0x55…` or `0x56…`, as in the
output above. Older, non-PIE executables load at the fixed address `0x400000`, as in the diagram.
:::

## Huge pages

**In short:** bigger pages mean each TLB entry covers more memory. They speed up programs with large data,
but can cause memory waste and delays.

The tree can also stop early. An entry one level up can map a whole <Term id="huge-page">huge page</Term>
of **2 MiB**. An entry two levels up can map **1 GiB**.

**Benefits:**

- Each TLB entry covers 512 times more memory with 2 MiB pages, so far fewer TLB misses.
- A TLB miss needs fewer reads, because the walk is shorter.
- Page tables are smaller, which also makes `fork` faster.
- Filling a large region takes far fewer page faults.

**Costs:**

- **Wasted memory.** Using one byte of a 2 MiB page still uses all 2 MiB of RAM.
- **Slower faults.** The kernel must fill 2 MiB with zeros instead of 4 KiB.
- **They need 2 MiB of continuous free RAM.** After a machine runs for a long time, free RAM is scattered.
  The kernel may have to move pages around to make space. The thread that caused the fault waits while it
  does this.

Linux offers huge pages in two ways:

- **Reserved huge pages (hugetlbfs):** an administrator reserves them in advance, and programs ask for them
  explicitly. Predictable, but needs planning. Used by databases such as PostgreSQL and Oracle, and by
  virtual machines.
- **Transparent huge pages (THP):** the kernel uses them automatically. It can do this for all memory
  (`always`), only for memory a program marks (`madvise`), or not at all (`never`). A background kernel
  thread also merges small pages into huge ones.

::: warning The trade-off in practice
Several databases, including Redis and MongoDB, have long recommended turning THP off, or setting it to
`madvise`. The reasons are delays from rearranging memory, wasted memory, and more copying after `fork`. On
the other hand, Java servers, ML training and scientific computing often turn huge pages **on** for speed.

The right choice depends on what you care about more: **average throughput** or **worst-case latency**.
Interviewers look for exactly this kind of reasoning.
:::

::: details Going deeper: the kernel names
The background thread that merges pages is `khugepaged`. Rearranging memory to make continuous free space is
called **compaction**. Reserved huge pages are set with the `vm.nr_hugepages` setting and used with
`mmap(..., MAP_HUGETLB)`. A 2 MiB page is mapped by a level-2 entry (page directory) with its page-size flag
set.
:::

## Why this matters in real systems

**Page faults while handling requests.** Memory is supplied on first use, so the first request that touches
new memory pays for the page faults. Services that need steady latency touch all their memory at startup.
Examples are `MAP_POPULATE`, or the JVM's `-XX:+AlwaysPreTouch` flag. Systems that can never wait for disk
use `mlock` to keep their memory in RAM. Trading and audio systems do this.

**Programs that jump around large memory.** Hash tables, indexes, graph workloads and embedding lookups can
be slowed more by TLB misses than by cache misses. If profiling shows many TLB misses, huge pages often
help.

**`fork` of a large process.** Redis saves snapshots by calling <Term id="fork">`fork`</Term> and letting the
child write the data. `fork` does not copy data, thanks to copy-on-write. But it **does copy the page
tables**: about 8 bytes for every 4 KiB page, so about 100 MB for 50 GB of memory. That can pause Redis for
tens to hundreds of milliseconds. Afterwards, each page the parent writes gets copied, so a busy Redis can
almost double its memory use during a snapshot.

**Reading files with `mmap`.** Mapping a file lets a program read it like memory. Several processes can
share the same pages. This is popular for loading ML model weights, because loading is lazy and shared. But
for a database it has a cost: disk reads happen inside page faults. The database cannot schedule them, run
them in the background, or choose what to evict. The paper *"Are You Sure You Want to Use MMAP in Your
Database Management System?"* (Crotty, Leis and Pavlo, 2022) explains the problems.

**Containers.** Container memory limits (set with <Term id="cgroup">cgroups</Term>) count memory that is
really in RAM, including cached file data, not virtual size. Knowing the difference prevents wrong
conclusions from tools like `top`.

**GPUs.** A GPU copies data from RAM by itself, using <Term id="dma">DMA</Term>. For that, the data must
stay at the same physical location. So CUDA offers **pinned memory**: RAM the kernel promises not to move or
<Term id="swap">swap</Term> out. Transfers are faster, but the kernel has less memory it can manage.

**How to measure it:**

```bash
/usr/bin/time -v ./prog            # minor and major page faults, peak memory
ps -o pid,min_flt,maj_flt,rss,vsz -p <pid>
perf stat -e page-faults,major-faults,dTLB-load-misses ./prog
grep -E 'thp|compact' /proc/vmstat # huge page and compaction counters
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. What is virtual memory, and why do we need it?
Each process gets its own private address space. The program uses virtual addresses. On every access, the
hardware translates them to real RAM addresses, using page tables that the kernel keeps for each process.

This gives us protection between processes, the same simple layout for every program, and no fragmentation
of RAM. It also makes possible shared libraries, memory on demand, cheap `fork`, memory-mapped files,
per-page permissions and swap.

**Senior add-on:** the key design choice is the split. Hardware does the translation on every access, so it
is fast. The kernel only runs when the hardware cannot translate, so it keeps full control without slowing
down normal accesses.
:::

::: details 2. What happens when a program reads from a virtual address?
1. The CPU checks the **TLB**. If the translation is there, it reads the data straight away.
2. If not, the CPU **walks the page table**: four levels on x86-64, one memory read each.
3. If the final entry says the page is present and the access is allowed, the CPU saves the translation in
   the TLB and reads the data.
4. Otherwise it raises a **page fault** and the kernel takes over. If the address is not in any region the
   process owns, or the access is not allowed, the process gets a segmentation fault. If it is valid, the
   kernel supplies the page: from memory (minor fault) or from disk (major fault). Then it updates the page
   table.
5. The CPU runs the instruction again, and it succeeds.

**Senior add-on:** mention the cost range. A TLB hit is almost free. A walk costs tens to hundreds of cycles.
A major fault can cost milliseconds. Mention also that the hardware sets the Accessed and Dirty flags, which
the kernel later uses to choose pages to evict.
:::

::: details 3. Why is the page table a multi-level tree? What is the trade-off?
A flat table covering the whole address space would take hundreds of GiB per process. Almost all of it
would be empty, because processes use only small parts of their address space. A tree only has tables for
the parts in use.

The trade-off is that each level adds one memory read when the TLB misses. x86-64 has four levels, and newer
CPUs can use five.

**Senior add-on:** the extra reads are softened by the TLB, by special caches for upper tree levels, by the
normal CPU caches, and by huge pages, which shorten the walk.
:::

::: details 4. What is the TLB, and what happens to it on a context switch?
The TLB is a small cache in each CPU core that holds recent translations. It lets almost every access skip
the page walk.

When the CPU switches to a different process, the cached translations no longer apply. The CPU either clears
the TLB, or it tags each entry with an address-space ID so old entries simply do not match. Switching
between threads of the same process changes nothing, because they share one page table.

**Senior add-on:** the tags are PCID on x86 and ASID on ARM. Kernel entries are marked global and survive any
switch. Since the Meltdown fix (KPTI), even system calls switch page tables, so PCID support matters a lot
for programs that make many system calls.
:::

::: details 5. What is the difference between minor and major page faults? How would you measure them?
A **minor** fault is solved without disk access. Examples: the first write to new memory, a file page already
in the page cache, or a copy-on-write copy. It costs about a microsecond.

A **major** fault needs the disk: a file page not yet in memory, or a page that was moved to swap. The thread
waits for about 100 µs on an SSD, or about 10 ms on a hard disk.

To measure them for one process, use `/usr/bin/time -v`, `ps -o min_flt,maj_flt`, or
`perf stat -e page-faults,major-faults`. For the whole system, use `vmstat` or `sar -B`.

**Senior add-on:** a steady stream of major faults in a service usually means its working data does not fit
in RAM. Pages are being evicted and read back again and again.
:::

::: details 6. A program allocates 10 GB on a machine with 8 GB of RAM, and it succeeds. How? What happens next?
The allocation only reserves addresses. No RAM is used until each page is written. Linux allows reserving more
than it has by default.

If the program then writes all 10 GB, the kernel frees what it can: it drops cached file data, and moves pages
to swap if swap exists. When nothing more can be freed, the <Term id="oom-killer">OOM killer</Term> stops a
process, often this one. So the failure shows up as the process being killed at some random write, not as
`malloc` returning `NULL`.

**Senior add-on:** the setting `vm.overcommit_memory = 2` makes Linux refuse to promise more than it has. Then
`malloc` fails immediately instead.
:::

::: details 7. What are huge pages? When would you use them, and when would you avoid them?
They are pages of 2 MiB or 1 GiB instead of 4 KiB. One TLB entry then covers far more memory. The page walk
is shorter, page tables are smaller, and there are fewer page faults.

**Use them** for large, long-lived memory that is used densely: database buffers, Java heaps, in-memory
caches, virtual machines, ML and scientific workloads.

**Avoid them**, or only enable them for chosen memory, in latency-sensitive services that use memory sparsely
or call `fork` often. There they cause wasted memory, slow faults, pauses while the kernel rearranges memory,
and more copying after `fork`.

**Senior add-on:** reserved huge pages (hugetlbfs) avoid the rearranging pauses, because the memory is set
aside at startup. Transparent huge pages in `madvise` mode are a common middle ground.
:::

::: details 8. What is a TLB shootdown, and when does it hurt?
The hardware does not update other cores' TLBs when a page table changes. So when the kernel removes or
changes a mapping, it must interrupt every other core that might cache it and wait for them to clear it.

It hurts in processes with many threads spread across many cores that often change their memory mappings.
Examples: memory allocators that return memory to the OS often, garbage collectors that change page
permissions, and the kernel moving pages between memory nodes. The cost grows with the number of cores.

**Senior add-on:** fixes include keeping memory mapped and reusing it, tuning the allocator to return memory
less often, and limiting how many cores the process's threads spread over.
:::

::: details 9. Scenario: p99 latency spikes every few minutes, but CPU use is low. How could memory be involved?
Check these, roughly in this order:

1. **Major faults or swapping.** Look at major fault counts and `vmstat`. The working data may not fit in
   RAM.
2. **Huge page rearranging.** Look at the `compact_stall` and `thp_*` counters in `/proc/vmstat`. Try THP
   in `madvise` or `never` mode and compare.
3. **Memory pressure.** Under pressure, threads that allocate memory must free memory themselves first. Look
   at `allocstall` in `/proc/vmstat`, or the memory pressure numbers in `/proc/pressure/memory`.
4. **A large `fork`**, such as a snapshot, pausing while page tables are copied.
5. **TLB shootdowns** from memory being released periodically (the `TLB` line in `/proc/interrupts`).

Also rule out causes outside the OS, such as garbage collection pauses.

**Senior add-on:** show a loop of hypothesis, evidence, then fix. Confirm with `perf` or eBPF tracing before
you change anything.
:::

::: details 10. mmap a file or read() it: what are the trade-offs?
**`mmap`** avoids copying data into a separate buffer, lets you use plain pointers, loads data only when used,
and lets processes share pages. But disk reads happen inside page faults, so you cannot schedule them or do
them in the background. Errors arrive as a signal (`SIGBUS`) instead of an error code. The kernel decides
what to evict and when to write.

**`read`** (or `pread`, or `io_uring`) costs one extra copy, but gives full control: what to read, when, in
what order, in the background, and with clear error codes.

**Senior add-on:** databases usually use `read` with their own cache, often with `O_DIRECT` to bypass the
page cache. Read-mostly data such as model weights or static files often suits `mmap`.
:::

::: details 11. How can two processes use the same address for different data? How do they share memory?
Each process has its own page table. The same virtual address goes through a different tree in each
process, so it reaches a different frame. An address means nothing without knowing which address space it
belongs to.

To share memory, both page tables point to the **same frames**. This happens with `mmap` of the same file
using `MAP_SHARED`, with shared memory calls, and automatically for library code and for pages after `fork`.

**Senior add-on:** the shared memory can appear at different addresses in each process. That is why data
structures in shared memory store offsets, not pointers.
:::

## Common misconceptions

- **"Virtual memory means swap."** Swap is one feature that uses virtual memory. A machine without swap still
  uses virtual memory for every access.
- **"`malloc` uses RAM."** It reserves addresses. RAM is used when each page is first written.
- **"The kernel translates every address."** The MMU hardware does. The kernel only sets up the tables and
  handles page faults.
- **"Every context switch clears the TLB."** Not with tagged entries, and never between threads of the same
  process.
- **"A large virtual size means high memory use."** Virtual size includes reserved addresses. Resident size
  shows real RAM use.
- **"Huge pages are always faster."** They usually raise throughput, but can hurt worst-case latency and
  memory use.

## Key takeaways

- The **hardware translates** every access. The **kernel decides** the translations and handles page faults.
- The page table is a **tree**, because address spaces are mostly empty. Each level costs a memory read.
- The **TLB** caches translations. Think in terms of **TLB reach**. Process switches and releasing memory
  have hidden TLB costs.
- **Page faults are normal.** They supply memory on demand, load files and implement copy-on-write. Minor
  faults cost about a microsecond; major faults cost a disk read.
- **Huge pages** trade memory and worst-case latency for speed on large data.

## Review

<Flashcards id="virtual-memory" :cards="cards" />

<MarkDone id="virtual-memory" />
