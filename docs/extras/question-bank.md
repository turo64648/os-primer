---
title: A. Interview Question Bank
---

# A. Interview Question Bank

This page collects every interview question from the book, one chapter after another, followed by harder
questions that combine several chapters. Use it in the week before your interviews, to find the gaps you
still have.

::: info How to use this page
1. **Answer out loud first.** Read the question and answer it as you would in an interview, before you open
   the box. Talking through an answer shows gaps that reading does not.
2. **Then open the box.** It holds the core of a good answer in one or two sentences. If you missed it, or
   could not explain it simply, mark the question.
3. **Follow the links for anything you marked.** "Full answer" goes to the chapter's interview questions,
   where the model answer and its senior add-on live. "Section" goes to the part of the chapter that explains
   the topic.
4. **Finish with the senior curveballs** at the end. They mix topics from several chapters, as real
   interviews do.
:::

## 1. What an OS Is

[Chapter 1](/foundations/what-is-an-os)

::: details 1.1 What is the difference between user mode and kernel mode, and why do we need both?
The CPU refuses dangerous instructions and kernel memory in user mode, so protection is enforced by
hardware. Programs enter kernel mode only through entry points the kernel chose.

Full answer: [Chapter 1, Q1](/foundations/what-is-an-os#interview-questions) · Section: [User mode and kernel mode](/foundations/what-is-an-os#user-mode-and-kernel-mode)
:::

::: details 1.2 Walk me through what happens when a program calls read().
libc puts the call number and arguments in registers and traps into the kernel. The kernel checks the
arguments, copies ready data or sleeps the thread until it arrives, then returns a byte count or an error.

Full answer: [Chapter 1, Q2](/foundations/what-is-an-os#interview-questions) · Section: [System calls, step by step](/foundations/what-is-an-os#system-calls-step-by-step)
:::

::: details 1.3 Is a system call a context switch?
No. It is a mode switch: the same thread runs kernel code and returns. A context switch, to a different
thread, can happen during the call if it must wait.

Full answer: [Chapter 1, Q3](/foundations/what-is-an-os#interview-questions) · Section: [It is the same thread](/foundations/what-is-an-os#it-is-the-same-thread-not-a-different-one)
:::

::: details 1.4 What is the difference between an interrupt, an exception and a trap?
An interrupt comes from outside the running code, such as a device or timer. An exception is the current
instruction failing, like a page fault. A trap is a deliberate exception, like a system call.

Full answer: [Chapter 1, Q4](/foundations/what-is-an-os#interview-questions) · Section: [Three ways into the kernel](/foundations/what-is-an-os#three-ways-into-the-kernel-interrupts-exceptions-and-traps)
:::

::: details 1.5 A program runs an infinite loop and never makes a system call. How does the OS stop it?
A hardware timer interrupts every core regularly, so the kernel always gets the CPU back and can preempt the
thread. A signal such as Ctrl-C is acted on when the thread next returns to user mode.

Full answer: [Chapter 1, Q5](/foundations/what-is-an-os#interview-questions) · Section: [The timer interrupt](/foundations/what-is-an-os#the-timer-interrupt-how-the-kernel-gets-the-cpu-back)
:::

::: details 1.6 Why are system calls expensive, and how do high-performance systems avoid them?
About 100 ns of direct cost for crossing into the kernel, plus disturbed caches afterwards. Fast systems
buffer, batch, share queues with the kernel (io_uring), skip it (vDSO, futex), or bypass it.

Full answer: [Chapter 1, Q6](/foundations/what-is-an-os#interview-questions) · Section: [Doing fewer system calls](/foundations/what-is-an-os#doing-fewer-system-calls)
:::

::: details 1.7 What is the vDSO, and why does it exist?
A small library the kernel maps into every process. It answers a few calls, mainly reading the clock, in user
mode, because some programs read the time millions of times a second.

Full answer: [Chapter 1, Q7](/foundations/what-is-an-os#interview-questions) · Section: [The vDSO](/foundations/what-is-an-os#the-vdso-system-calls-that-are-not-system-calls)
:::

::: details 1.8 Monolithic kernel or microkernel: what are the trade-offs?
Monolithic runs all services in kernel mode: fast calls, but any driver bug can take down the machine. A
microkernel runs services as processes: better isolation, but more boundary crossings per request.

Full answer: [Chapter 1, Q8](/foundations/what-is-an-os#interview-questions) · Section: [Kernel designs](/foundations/what-is-an-os#kernel-designs-monolithic-and-microkernel)
:::

::: details 1.9 How does a C program report a failed system call? What can go wrong with errno?
The wrapper returns -1 and puts the error code in the per-thread `errno`. Mistakes: reading `errno` without
checking for failure, reading it after another call changed it, and not retrying on `EINTR`.

Full answer: [Chapter 1, Q9](/foundations/what-is-an-os#interview-questions) · Section: [How errors are reported](/foundations/what-is-an-os#how-errors-are-reported)
:::

::: details 1.10 Scenario: after moving a service to new cloud instances, CPU use rose 20% with no code change. What could it be?
Profile first. Suspect a clock source that turned vDSO time reads into real system calls, and CPU security
protections that make each kernel entry cost more on the new hardware.

Full answer: [Chapter 1, Q10](/foundations/what-is-an-os#interview-questions) · Section: [Why system calls got more expensive in 2018](/foundations/what-is-an-os#why-system-calls-got-more-expensive-in-2018)
:::

## 2. Processes & Threads

[Chapter 2](/foundations/processes-and-threads)

::: details 2.1 What happens when you type ls in a shell and press Enter?
The shell forks a child, the child calls `exec` to become `ls`, and the shell waits. When `ls` exits, the
shell's `waitpid` collects its exit code and the prompt returns.

Full answer: [Chapter 2, Q1](/foundations/processes-and-threads#interview-questions) · Section: [Creating processes](/foundations/processes-and-threads#creating-processes-fork-exec-wait)
:::

::: details 2.2 What is the difference between a process and a thread?
A process has its own address space and open files. Threads inside one process share them, and each has
only its own registers and stack: cheaper, but no isolation.

Full answer: [Chapter 2, Q2](/foundations/processes-and-threads#interview-questions) · Section: [Threads: what they share](/foundations/processes-and-threads#threads-what-they-share)
:::

::: details 2.3 Why does fork return twice? How do you tell parent and child apart?
`fork` creates a copy of the process at the same point in the code, so both return from it. The child gets
0; the parent gets the child's PID, or -1 on failure.

Full answer: [Chapter 2, Q3](/foundations/processes-and-threads#interview-questions) · Section: [fork returns twice](/foundations/processes-and-threads#fork-returns-twice)
:::

::: details 2.4 What is a zombie process? An orphan? How do you get rid of zombies?
A zombie has exited but its parent has not collected its exit code. An orphan's parent has exited, so it is
adopted by PID 1. Make the parent call `wait`, or kill the parent.

Full answer: [Chapter 2, Q4](/foundations/processes-and-threads#interview-questions) · Section: [Zombies](/foundations/processes-and-threads#zombies)
:::

::: details 2.5 What is the difference between SIGTERM and SIGKILL? How should a service shut down?
`SIGTERM` is a request the program can handle; `SIGKILL` cannot be caught. On `SIGTERM`, stop taking new
work, finish in-flight work before a deadline, close resources, and exit.

Full answer: [Chapter 2, Q5](/foundations/processes-and-threads#interview-questions) · Section: [SIGTERM, SIGKILL and graceful shutdown](/foundations/processes-and-threads#sigterm-sigkill-and-graceful-shutdown)
:::

::: details 2.6 Why can't you call printf inside a signal handler? What do you do instead?
The signal may arrive while `printf` or `malloc` holds a lock, so calling them again can deadlock or corrupt
data. Set a flag, write to a pipe, or use `signalfd`.

Full answer: [Chapter 2, Q6](/foundations/processes-and-threads#interview-questions) · Section: [Writing signal handlers safely](/foundations/processes-and-threads#writing-signal-handlers-safely)
:::

::: details 2.7 Why do large or multithreaded programs avoid fork? What do they use instead?
A large process pays to copy page tables. In a threaded process, locks held by other threads stay locked in
the child. They use `posix_spawn` or `vfork` plus `exec`.

Full answer: [Chapter 2, Q7](/foundations/processes-and-threads#interview-questions) · Section: [Why large programs avoid fork](/foundations/processes-and-threads#why-large-programs-avoid-fork)
:::

::: details 2.8 Your service in a container takes 10 seconds to stop and never logs its shutdown. Why?
It is PID 1 without a `SIGTERM` handler, and the kernel ignores unhandled signals to PID 1. Or a shell is PID 1
and does not forward the signal. After 10 seconds, `SIGKILL` arrives.

Full answer: [Chapter 2, Q8](/foundations/processes-and-threads#interview-questions) · Section: [PID 1 and containers](/foundations/processes-and-threads#pid-1-and-containers)
:::

::: details 2.9 How does Linux implement threads?
As tasks, like processes. `pthread_create` calls `clone` with flags that share the address space, files and
signal handlers; `fork` is `clone` without them.

Full answer: [Chapter 2, Q9](/foundations/processes-and-threads#interview-questions) · Section: [Everything is a task](/foundations/processes-and-threads#how-linux-does-it-everything-is-a-task)
:::

::: details 2.10 Ctrl-C stops a whole pipeline. How does the terminal know which processes to signal?
The shell puts each pipeline in its own process group and makes it the terminal's foreground group. Ctrl-C
sends `SIGINT` to every process in that group.

Full answer: [Chapter 2, Q10](/foundations/processes-and-threads#interview-questions) · Section: [Process groups, sessions and the terminal](/foundations/processes-and-threads#process-groups-sessions-and-the-terminal)
:::

::: details 2.11 A process is in state D and kill -9 does nothing. What is going on?
It is in uninterruptible sleep inside a kernel operation, usually disk or network file system I/O. The
signal waits until the operation finishes; check what it is waiting on.

Full answer: [Chapter 2, Q11](/foundations/processes-and-threads#interview-questions) · Section: [Two kinds of sleep](/foundations/processes-and-threads#two-kinds-of-sleep)
:::

## 3. Linking, Loading & Program Startup

[Chapter 3](/foundations/linking-and-loading)

::: details 3.1 What happens between running gcc and your main() starting?
Compile to object files, link symbols and relocations into an ELF file. At run time the kernel maps it and the
loader, the loader maps libraries and fixes addresses, and start-up code calls `main`.

Full answer: [Chapter 3, Q1](/foundations/linking-and-loading#interview-questions) · Section: [From source code to a running program](/foundations/linking-and-loading#from-source-code-to-a-running-program)
:::

::: details 3.2 What is the difference between static and dynamic linking?
Static copies library code into the executable: self-contained but bigger and harder to patch. Dynamic loads
shared libraries at start-up: shared in RAM and patched once, but versions must match.

Full answer: [Chapter 3, Q2](/foundations/linking-and-loading#interview-questions) · Section: [Static and dynamic linking](/foundations/linking-and-loading#static-and-dynamic-linking)
:::

::: details 3.3 What are the PLT and the GOT, and why do they exist?
Libraries load at unknown addresses, and shared code cannot be patched. Calls go through a PLT stub that jumps
via a GOT slot, a per-process table of addresses the loader fills in.

Full answer: [Chapter 3, Q3](/foundations/linking-and-loading#interview-questions) · Section: [PLT and GOT](/foundations/linking-and-loading#plt-and-got-calling-a-library-function)
:::

::: details 3.4 How does LD_PRELOAD work, and when does it not work?
The loader takes the first definition of each symbol, and preloaded libraries come first. It does not work for
static or setuid programs, or for calls that do not go through dynamic symbols.

Full answer: [Chapter 3, Q4](/foundations/linking-and-loading#interview-questions) · Section: [LD_PRELOAD and symbol interposition](/foundations/linking-and-loading#ld-preload-and-symbol-interposition)
:::

::: details 3.5 What are sections and segments in ELF? Why both?
Sections are the linker's view: many named pieces of one kind. Segments are the loader's view: a few ranges to
map with one set of permissions.

Full answer: [Chapter 3, Q5](/foundations/linking-and-loading#interview-questions) · Section: [ELF: sections and segments](/foundations/linking-and-loading#elf-sections-and-segments)
:::

::: details 3.6 A binary fails with "cannot open shared object file". How do you debug it?
The loader could not find the library. Check what the binary needs (`readelf -d`), whether it is installed
with the right name, and the search path; `LD_DEBUG=libs` shows every place tried.

Full answer: [Chapter 3, Q6](/foundations/linking-and-loading#interview-questions) · Section: [Where the loader looks](/foundations/linking-and-loading#where-the-loader-looks)
:::

::: details 3.7 What does exec do to the process's memory?
It throws away the old address space, maps the new program's segments and the loader, and builds a fresh stack
with arguments and environment. The PID and open files stay.

Full answer: [Chapter 3, Q7](/foundations/linking-and-loading#interview-questions) · Section: [How exec builds the address space](/foundations/linking-and-loading#how-exec-builds-the-address-space)
:::

::: details 3.8 Why must shared libraries be position-independent?
They load at different, random addresses in each process. Fixed addresses would mean patching code per
process, which breaks sharing and needs writable code.

Full answer: [Chapter 3, Q8](/foundations/linking-and-loading#interview-questions) · Section: [Position-independent code](/foundations/linking-and-loading#position-independent-code)
:::

## 4. Virtual Memory

[Chapter 4](/memory/virtual-memory)

::: details 4.1 What is virtual memory, and why do we need it?
Each process gets a private address space that hardware translates to RAM on every access, using tables the
kernel keeps. It gives protection, a simple layout, sharing, memory on demand and cheap `fork`.

Full answer: [Chapter 4, Q1](/memory/virtual-memory#interview-questions) · Section: [The problem virtual memory solves](/memory/virtual-memory#the-problem-virtual-memory-solves)
:::

::: details 4.2 What happens when a program reads from a virtual address?
The CPU checks the TLB, then walks the page table on a miss. If the page is missing or forbidden, a page fault
lets the kernel supply it or kill the process, and the instruction runs again.

Full answer: [Chapter 4, Q2](/memory/virtual-memory#interview-questions) · Section: [Walking the tree](/memory/virtual-memory#walking-the-tree)
:::

::: details 4.3 Why is the page table a multi-level tree? What is the trade-off?
A flat table would be huge and mostly empty; a tree only has tables for the parts in use. Each level costs one
more memory read on a TLB miss.

Full answer: [Chapter 4, Q3](/memory/virtual-memory#interview-questions) · Section: [Page tables](/memory/virtual-memory#page-tables)
:::

::: details 4.4 What is the TLB, and what happens to it on a context switch?
A per-core cache of recent translations. Switching process means cleared or tagged entries; switching
between threads of one process changes nothing.

Full answer: [Chapter 4, Q4](/memory/virtual-memory#interview-questions) · Section: [The TLB](/memory/virtual-memory#the-tlb)
:::

::: details 4.5 What is the difference between minor and major page faults? How would you measure them?
Minor faults are solved from RAM, in about a microsecond. Major faults read from disk. Measure with
`/usr/bin/time -v`, `ps -o min_flt,maj_flt` or `perf stat`.

Full answer: [Chapter 4, Q5](/memory/virtual-memory#interview-questions) · Section: [Page faults](/memory/virtual-memory#page-faults)
:::

::: details 4.6 A program allocates 10 GB on a machine with 8 GB of RAM, and it succeeds. How? What happens next?
Allocation only reserves addresses; RAM is used on first write. If it writes everything, the kernel reclaims
and swaps, then the OOM killer kills a process at some random write.

Full answer: [Chapter 4, Q6](/memory/virtual-memory#interview-questions) · Section: [Memory on demand](/memory/virtual-memory#memory-on-demand)
:::

::: details 4.7 What are huge pages? When would you use them, and when would you avoid them?
Pages of 2 MiB or 1 GiB, so each TLB entry covers far more memory. Use them for large, dense, long-lived
memory; avoid them where memory is sparse or latency matters.

Full answer: [Chapter 4, Q7](/memory/virtual-memory#interview-questions) · Section: [Huge pages](/memory/virtual-memory#huge-pages)
:::

::: details 4.8 What is a TLB shootdown, and when does it hurt?
When the kernel changes a mapping, it must interrupt other cores to drop their cached copy. It hurts
many-threaded processes that often unmap or change memory.

Full answer: [Chapter 4, Q8](/memory/virtual-memory#interview-questions) · Section: [TLB shootdowns](/memory/virtual-memory#tlb-shootdowns)
:::

::: details 4.9 Scenario: p99 latency spikes every few minutes, but CPU use is low. How could memory be involved?
Check major faults and swapping, huge-page compaction, direct reclaim under pressure, a large `fork`, and TLB
shootdowns. Confirm each with counters before changing anything.

Full answer: [Chapter 4, Q9](/memory/virtual-memory#interview-questions) · Section: [Why this matters in real systems](/memory/virtual-memory#why-this-matters-in-real-systems)
:::

::: details 4.10 mmap a file or read() it: what are the trade-offs?
`mmap` saves a copy and loads lazily, but disk reads happen in page faults you cannot schedule, and errors
arrive as `SIGBUS`. `read` costs a copy but gives full control.

Full answer: [Chapter 4, Q10](/memory/virtual-memory#interview-questions) · Section: [Why this matters in real systems](/memory/virtual-memory#why-this-matters-in-real-systems)
:::

::: details 4.11 How can two processes use the same address for different data? How do they share memory?
Each process has its own page table, so the same address maps to different frames. To share, both tables point
to the same frames.

Full answer: [Chapter 4, Q11](/memory/virtual-memory#interview-questions) · Section: [The process address space](/memory/virtual-memory#the-process-address-space)
:::

## 5. Kernel Memory Management

[Chapter 5](/memory/kernel-memory)

::: details 5.1 What happens, step by step, when a process calls fork and then the child writes to a variable?
`fork` copies the page table and marks shared pages read-only in both processes. The child's write faults, and
the kernel copies that one page and makes it writable.

Full answer: [Chapter 5, Q1](/memory/kernel-memory#interview-questions) · Section: [Copy-on-write and fork](/memory/kernel-memory#copy-on-write-and-fork)
:::

::: details 5.2 Explain the four kinds of mmap: private or shared, file-backed or anonymous.
Private file: read a file, writes stay private (code). Shared file: writes reach the file. Private anonymous:
plain memory (heap). Shared anonymous: memory shared with children.

Full answer: [Chapter 5, Q2](/memory/kernel-memory#interview-questions) · Section: [mmap](/memory/kernel-memory#mmap-asking-the-kernel-for-memory-regions)
:::

::: details 5.3 A Linux server shows 1 GB free out of 64 GB. Is that a problem?
Usually not: spare RAM holds page cache that can be dropped. Look at "available" memory, swap-in activity,
direct reclaim and memory pressure instead.

Full answer: [Chapter 5, Q3](/memory/kernel-memory#interview-questions) · Section: [Why "free" memory is low](/memory/kernel-memory#why-free-memory-is-low)
:::

::: details 5.4 What does the kernel do when RAM runs low?
It reclaims pages not used recently: drops clean file pages, writes back dirty ones, swaps anonymous ones.
kswapd works in the background; if it falls behind, allocating threads reclaim themselves.

Full answer: [Chapter 5, Q4](/memory/kernel-memory#interview-questions) · Section: [Reclaim](/memory/kernel-memory#reclaim-freeing-memory-when-ram-runs-low)
:::

::: details 5.5 Why does Linux allow overcommit? What are the alternatives?
Programs reserve far more than they use, especially `fork`. The cost is that failure comes late, as an OOM
kill. Strict mode makes allocations fail early instead.

Full answer: [Chapter 5, Q5](/memory/kernel-memory#interview-questions) · Section: [Overcommit](/memory/kernel-memory#overcommit)
:::

::: details 5.6 How does the OOM killer choose its victim, and how do you protect a process?
It kills the process whose death frees the most memory, adjusted by `oom_score_adj`. Protect a process with a
negative adjustment, and put limits on the others.

Full answer: [Chapter 5, Q6](/memory/kernel-memory#interview-questions) · Section: [The OOM killer](/memory/kernel-memory#the-oom-killer)
:::

::: details 5.7 Your container was OOMKilled, but the application's heap was only half the limit. What could it be?
Memory outside the heap: stacks, native buffers, runtime overhead, tmpfs or `/dev/shm` files, dirty page
cache. Check `memory.stat` and `memory.events`, and remember short spikes.

Full answer: [Chapter 5, Q7](/memory/kernel-memory#interview-questions) · Section: [Memory limits for containers](/memory/kernel-memory#memory-limits-for-containers)
:::

::: details 5.8 What is the difference between RSS, VSZ and PSS? Which would you use to size a machine?
VSZ is reserved addresses. RSS is what is in RAM, counting shared pages in full. PSS splits shared pages
fairly, so sum PSS to size a machine.

Full answer: [Chapter 5, Q8](/memory/kernel-memory#interview-questions) · Section: [Measuring memory](/memory/kernel-memory#measuring-memory-vsz-rss-and-pss)
:::

::: details 5.9 Should production servers run with swap?
A little swap lets the kernel move truly cold pages out and keep more useful cache. Latency-critical services
may limit it or lock memory, because swapping a hot page back in is a long stall.

Full answer: [Chapter 5, Q9](/memory/kernel-memory#interview-questions) · Section: [Is swap bad?](/memory/kernel-memory#is-swap-bad)
:::

::: details 5.10 write() returned successfully, then the machine lost power. Is the data on disk?
Not necessarily. `write` only reached the page cache, and write-back happens later. Only `fsync` or
`fdatasync` makes it durable.

Full answer: [Chapter 5, Q10](/memory/kernel-memory#interview-questions) · Section: [Writes go to the cache first](/memory/kernel-memory#writes-go-to-the-cache-first)
:::

::: details 5.11 Scenario: kswapd uses a lot of CPU and latency is bad, but "available" memory looks fine. What do you check?
Memory pressure (PSI), direct reclaim counts, fragmentation that forces compaction, one full NUMA node, and a
container near its own memory limit.

Full answer: [Chapter 5, Q11](/memory/kernel-memory#interview-questions) · Section: [kswapd and direct reclaim](/memory/kernel-memory#who-does-the-work-kswapd-and-direct-reclaim)
:::

## 6. User-Space Allocators

[Chapter 6](/memory/allocators)

::: details 6.1 How does malloc get memory from the operating system?
Small requests come from a heap that grows with `brk`; large ones get their own `mmap` region. In both cases
the kernel only reserves addresses until the pages are touched.

Full answer: [Chapter 6, Q1](/memory/allocators#interview-questions) · Section: [How malloc gets memory from the kernel](/memory/allocators#how-malloc-gets-memory-from-the-kernel)
:::

::: details 6.2 How does free() know how big the block is?
The size sits in a small header just before the block. Allocators with one size class per page look the size
up from the page instead.

Full answer: [Chapter 6, Q2](/memory/allocators#interview-questions) · Section: [How free knows the size](/memory/allocators#how-free-knows-the-size)
:::

::: details 6.3 Design a simple malloc. What would you do?
Get big chunks from the kernel, round requests to size classes with a free list each, and give large requests
their own mapping. Add per-thread caches for multi-threaded use.

Full answer: [Chapter 6, Q3](/memory/allocators#interview-questions) · Section: [Inside the allocator](/memory/allocators#inside-the-allocator-headers-free-lists-and-size-classes)
:::

::: details 6.4 What is the difference between internal and external fragmentation?
Internal: waste inside a block from rounding up. External: free memory split into pieces too small to use.

Full answer: [Chapter 6, Q4](/memory/allocators#interview-questions) · Section: [Fragmentation](/memory/allocators#fragmentation)
:::

::: details 6.5 A service frees a large cache, but its RSS does not go down. Why?
`free` returns memory to the allocator, not the kernel. The allocator keeps it, or cannot return partly used
pages; only blocks with their own `mmap` go back at once.

Full answer: [Chapter 6, Q5](/memory/allocators#interview-questions) · Section: [Why RSS does not shrink after free()](/memory/allocators#why-rss-does-not-shrink-after-free)
:::

::: details 6.6 Why do jemalloc and tcmalloc often beat glibc malloc in multi-threaded servers?
Per-thread or per-CPU caches avoid shared locks, one size class per page limits fragmentation, and they
return unused memory gradually.

Full answer: [Chapter 6, Q6](/memory/allocators#interview-questions) · Section: [Modern allocators](/memory/allocators#modern-allocators-jemalloc-tcmalloc-mimalloc)
:::

::: details 6.7 Memory grows slowly in a long-running service. How do you tell a leak from fragmentation?
A leak grows without limit and live bytes grow too. Fragmentation levels off, with live bytes flat while RSS
stays much higher. A heap profiler or allocator statistics tell them apart.

Full answer: [Chapter 6, Q7](/memory/allocators#interview-questions) · Section: [Fragmentation](/memory/allocators#fragmentation)
:::

::: details 6.8 When would you write your own allocator?
When objects follow a known pattern: many of one size (a pool) or many that die together (an arena). Measure
first, and keep debugging tools working.

Full answer: [Chapter 6, Q8](/memory/allocators#interview-questions) · Section: [Custom allocators](/memory/allocators#custom-allocators-pools-and-arenas)
:::

::: details 6.9 Why can't you call malloc in a signal handler?
The signal may arrive while `malloc` holds its lock or has lists half updated. Calling it again can deadlock or
corrupt the heap.

Full answer: [Chapter 6, Q9](/memory/allocators#interview-questions) · Section: [Threads: arenas and thread caches](/memory/allocators#threads-arenas-and-thread-caches)
:::

## 7. CPU Caches & NUMA

[Chapter 7](/memory/caches-and-numa)

::: details 7.1 Why is summing a 2-D array row by row much faster than column by column?
Rows are stored in order, so each 64-byte cache line is fully used and the prefetcher helps. Column order uses
one value per line and jumps every step.

Full answer: [Chapter 7, Q1](/memory/caches-and-numa#interview-questions) · Section: [Cache lines](/memory/caches-and-numa#cache-lines)
:::

::: details 7.2 What is a cache line, and why should a programmer care?
The 64-byte unit caches move. Data used together should sit together, and data written by different threads
should sit apart.

Full answer: [Chapter 7, Q2](/memory/caches-and-numa#interview-questions) · Section: [Cache lines](/memory/caches-and-numa#cache-lines)
:::

::: details 7.3 What is false sharing? How do you find and fix it?
Threads write different variables in the same cache line, so the line bounces between cores. Find it with
`perf c2c`; fix it by padding or per-thread copies.

Full answer: [Chapter 7, Q3](/memory/caches-and-numa#interview-questions) · Section: [False sharing](/memory/caches-and-numa#false-sharing)
:::

::: details 7.4 Explain cache coherence. What is MESI?
Hardware keeps copies of a line consistent: many readers or one writer, which invalidates other copies first.
MESI names the states: Modified, Exclusive, Shared, Invalid.

Full answer: [Chapter 7, Q4](/memory/caches-and-numa#interview-questions) · Section: [Cache coherence](/memory/caches-and-numa#cache-coherence-keeping-cores-in-agreement)
:::

::: details 7.5 Iterating over an array and over a linked list are both O(n). Why is the array much faster?
The array is contiguous and prefetched. Each list node can be anywhere, and its address is known only after the
previous node arrives, so misses happen one after another.

Full answer: [Chapter 7, Q5](/memory/caches-and-numa#interview-questions) · Section: [Data-oriented design](/memory/caches-and-numa#data-oriented-design)
:::

::: details 7.6 What is NUMA? How would you run a memory-heavy, multi-threaded service on a 2-socket server?
Each socket has local memory; remote memory is slower. Run one instance per node, pinned, or interleave memory,
and initialise data from the threads that use it.

Full answer: [Chapter 7, Q6](/memory/caches-and-numa#interview-questions) · Section: [NUMA](/memory/caches-and-numa#numa-memory-that-is-near-and-far)
:::

::: details 7.7 A program gets slower per thread as you add threads. What could be happening in the memory system?
False or true sharing of written data, a shared cache running out, memory bandwidth saturation, remote NUMA
memory, or a contended lock.

Full answer: [Chapter 7, Q7](/memory/caches-and-numa#interview-questions) · Section: [Why this matters in real systems](/memory/caches-and-numa#why-this-matters-in-real-systems)
:::

::: details 7.8 What does it mean for a program to be memory-bound, and how can you tell?
Its speed is set by getting data from memory, not by computing. Signs: low instructions per cycle, many
last-level cache misses, and no gain from faster cores.

Full answer: [Chapter 7, Q8](/memory/caches-and-numa#interview-questions) · Section: [The cache hierarchy](/memory/caches-and-numa#the-cache-hierarchy)
:::

## 8. Scheduling & Context Switches

[Chapter 8](/cpu/scheduling)

::: details 8.1 What does a CPU scheduler try to optimise, and why can't it get everything?
Throughput, response time, fairness and low overhead. They conflict: short slices help response but cost
switches, and favouring short jobs starves long ones.

Full answer: [Chapter 8, Q1](/cpu/scheduling#interview-questions) · Section: [What "good" means](/cpu/scheduling#what-good-means)
:::

::: details 8.2 Compare FCFS, SJF and round robin.
FCFS is simple but short jobs wait behind long ones. SJF minimises average wait but needs job lengths and can
starve. Round robin gives good response, at the cost of switches.

Full answer: [Chapter 8, Q2](/cpu/scheduling#interview-questions) · Section: [The classic algorithms](/cpu/scheduling#the-classic-algorithms)
:::

::: details 8.3 How does a multi-level feedback queue work? How could a program game it?
Threads start at high priority and move down when they use their whole allowance. A program could block just
before its slice ends to stay on top; counting total time per level fixes it.

Full answer: [Chapter 8, Q3](/cpu/scheduling#interview-questions) · Section: [MLFQ](/cpu/scheduling#multi-level-feedback-queue-mlfq)
:::

::: details 8.4 How does the Linux scheduler work for normal threads? What changed with EEVDF?
It tracks each thread's CPU time scaled by weight and runs the one furthest behind. EEVDF picks, among threads
not ahead of their share, the one with the earliest virtual deadline.

Full answer: [Chapter 8, Q4](/cpu/scheduling#interview-questions) · Section: [How Linux schedules](/cpu/scheduling#how-linux-schedules-cfs-and-eevdf)
:::

::: details 8.5 What happens during a context switch, and what does it cost?
The kernel saves one thread's registers, switches page tables if the process changes, and loads another's.
Direct cost is microseconds; cold caches and TLB can cost more.

Full answer: [Chapter 8, Q5](/cpu/scheduling#interview-questions) · Section: [Context switches](/cpu/scheduling#context-switches)
:::

::: details 8.6 How do you tell whether a service suffers from CPU contention or from blocking?
Many involuntary context switches mean threads were preempted: contention or CPU limits. Many voluntary ones
mean they keep blocking. Also check run-queue wait and throttling.

Full answer: [Chapter 8, Q6](/cpu/scheduling#interview-questions) · Section: [Voluntary and involuntary switches](/cpu/scheduling#voluntary-and-involuntary-switches)
:::

::: details 8.7 What is the difference between nice and real-time priority? What is the risk of SCHED_FIFO?
Nice changes a thread's share of CPU. A real-time thread always runs before normal ones, so a buggy one in a loop
can starve everything else on its core.

Full answer: [Chapter 8, Q7](/cpu/scheduling#interview-questions) · Section: [Priorities, nice and real-time classes](/cpu/scheduling#priorities-nice-and-real-time-classes)
:::

::: details 8.8 Scenario: a service in Kubernetes has p99 spikes of about 100 ms, but CPU use is only 40% of its limit. What is going on?
CPU throttling. Many threads burn the quota early in each 100 ms period, then the container stops until the
next period. Check `nr_throttled` in `cpu.stat`.

Full answer: [Chapter 8, Q8](/cpu/scheduling#interview-questions) · Section: [Quota: a hard budget per period](/cpu/scheduling#quota-a-hard-budget-per-period)
:::

::: details 8.9 A Go service runs fine on a laptop but badly in a container limited to 2 CPUs on a 64-core host. Why?
Older Go runtimes set `GOMAXPROCS` to the 64 visible cores, so many threads spent the 2-CPU quota fast and
were throttled. Set it to the limit, or use Go 1.25 or newer.

Full answer: [Chapter 8, Q9](/cpu/scheduling#interview-questions) · Section: [The GOMAXPROCS problem](/cpu/scheduling#the-gomaxprocs-problem)
:::

::: details 8.10 When would you pin threads to cores or isolate cores? What does it cost?
When cache warmth, NUMA locality or steady latency matter more than flexibility. Pinned threads cannot use idle
cores elsewhere, and isolated cores sit idle when unused.

Full answer: [Chapter 8, Q10](/cpu/scheduling#interview-questions) · Section: [CPU affinity, pinning and isolation](/cpu/scheduling#cpu-affinity-pinning-and-isolation)
:::

::: details 8.11 The load average is 40 on a 16-core machine. Is the CPU overloaded?
Not necessarily. Linux load counts runnable threads plus threads in uninterruptible sleep, often waiting for
disk. Check `vmstat` and pressure stall information.

Full answer: [Chapter 8, Q11](/cpu/scheduling#interview-questions) · Section: [Why this matters in real systems](/cpu/scheduling#why-this-matters-in-real-systems)
:::

## 9. Concurrency I: Locks & Deadlock

[Chapter 9](/cpu/concurrency-1)

::: details 9.1 What is a race condition? Give an example.
The result depends on thread timing, and some timings are wrong. Two threads doing `counter++` can both load
the old value and lose an increment.

Full answer: [Chapter 9, Q1](/cpu/concurrency-1#interview-questions) · Section: [Race conditions](/cpu/concurrency-1#race-conditions)
:::

::: details 9.2 Spinlock or mutex: how do you choose?
Spin only for very short sections when the holder is surely running, as in the kernel. Otherwise use a mutex,
which sleeps and frees the core.

Full answer: [Chapter 9, Q2](/cpu/concurrency-1#interview-questions) · Section: [Spinlocks](/cpu/concurrency-1#spinlocks)
:::

::: details 9.3 What is the difference between a mutex and a semaphore?
A mutex is a lock with an owner, for protecting data. A semaphore is a counter any thread may post, for
limiting concurrency or signalling.

Full answer: [Chapter 9, Q3](/cpu/concurrency-1#interview-questions) · Section: [Semaphores](/cpu/concurrency-1#semaphores)
:::

::: details 9.4 Why must you call wait on a condition variable inside a while loop?
When the thread wakes, another thread may already have changed the condition, and spurious wake-ups are
allowed. So it must check again.

Full answer: [Chapter 9, Q4](/cpu/concurrency-1#interview-questions) · Section: [The three rules](/cpu/concurrency-1#the-three-rules)
:::

::: details 9.5 What are the four conditions for deadlock, and how do you prevent it in practice?
Mutual exclusion, hold and wait, no preemption, circular wait. In practice, break circular wait with a fixed
global lock order.

Full answer: [Chapter 9, Q5](/cpu/concurrency-1#interview-questions) · Section: [The four conditions](/cpu/concurrency-1#the-four-conditions)
:::

::: details 9.6 Design a thread-safe transfer between two bank accounts.
Lock both accounts in a fixed order, such as lower ID first, then check and move the money. Handle a transfer to
the same account separately.

Full answer: [Chapter 9, Q6](/cpu/concurrency-1#interview-questions) · Section: [Prevention: break a condition](/cpu/concurrency-1#prevention-break-a-condition)
:::

::: details 9.7 A production service has stopped responding and uses 0% CPU. How do you find out whether it is deadlocked?
Dump every thread's stack, see who holds and who waits for each lock, and look for a cycle. No cycle suggests a
thread blocked on I/O while holding a lock.

Full answer: [Chapter 9, Q7](/cpu/concurrency-1#interview-questions) · Section: [Detection and recovery](/cpu/concurrency-1#detection-and-recovery)
:::

::: details 9.8 What is priority inversion, and how is it fixed?
A high-priority thread waits for a lock held by a low-priority one, which a medium one keeps preempting.
Priority inheritance lends the holder the waiter's priority.

Full answer: [Chapter 9, Q8](/cpu/concurrency-1#interview-questions) · Section: [Priority inversion](/cpu/concurrency-1#priority-inversion)
:::

::: details 9.9 Is i++ atomic? What about in Java with volatile?
No: it is load, add, store. Java's `volatile` makes each access visible but not the three steps atomic; use an
atomic type or a lock.

Full answer: [Chapter 9, Q9](/cpu/concurrency-1#interview-questions) · Section: [The lost update](/cpu/concurrency-1#the-lost-update)
:::

::: details 9.10 What is a livelock? How is it different from deadlock and starvation?
Deadlocked threads sleep forever. Livelocked threads keep reacting to each other without progress. A starved
thread never gets its turn while others progress.

Full answer: [Chapter 9, Q10](/cpu/concurrency-1#interview-questions) · Section: [Deadlock](/cpu/concurrency-1#deadlock)
:::

## 10. Concurrency II: Atomics & Memory Ordering

[Chapter 10](/cpu/concurrency-2)

::: details 10.1 What is compare-and-swap, and how do you build an atomic update from it?
CAS replaces a value only if it still holds the expected one. Read, compute, CAS, and retry if another thread
changed it first.

Full answer: [Chapter 10, Q1](/cpu/concurrency-2#interview-questions) · Section: [Compare-and-swap](/cpu/concurrency-2#compare-and-swap)
:::

::: details 10.2 Why can the message-passing example print 0 instead of 42?
The compiler or the CPU may reorder the data store and the flag store, or the reader's loads. A release store
and an acquire load fix it.

Full answer: [Chapter 10, Q2](/cpu/concurrency-2#interview-questions) · Section: [The surprise](/cpu/concurrency-2#the-surprise-memory-operations-can-appear-out-of-order)
:::

::: details 10.3 Explain acquire, release, relaxed and seq_cst.
Relaxed is atomic but orders nothing. Release and acquire pair up so writes before the release are visible
after the acquire. Seq_cst adds one global order.

Full answer: [Chapter 10, Q3](/cpu/concurrency-2#interview-questions) · Section: [C11 and C++ memory orderings](/cpu/concurrency-2#c11-and-c-memory-orderings)
:::

::: details 10.4 What does the x86 memory model allow that sequential consistency does not?
A store followed by a load of a different address can appear reordered, because stores wait in a store
buffer. Other orders are kept.

Full answer: [Chapter 10, Q4](/cpu/concurrency-2#interview-questions) · Section: [What x86 does](/cpu/concurrency-2#what-x86-does-only-one-reordering)
:::

::: details 10.5 What is the ABA problem? How do you fix it?
A value changes from A to B and back, so CAS succeeds although the state changed. Fix it with version counters
or safe memory reclamation.

Full answer: [Chapter 10, Q5](/cpu/concurrency-2#interview-questions) · Section: [The ABA problem](/cpu/concurrency-2#the-aba-problem)
:::

::: details 10.6 How does a futex-based mutex work?
Locking is an atomic operation in user memory. Only when the lock is taken does the thread call the kernel to
sleep, and unlock wakes a waiter only if one exists.

Full answer: [Chapter 10, Q6](/cpu/concurrency-2#interview-questions) · Section: [futex](/cpu/concurrency-2#futex-how-user-space-locks-sleep)
:::

::: details 10.7 When does a reader-writer lock help, and when does it hurt?
It helps with many long reads and few writes. With short reads, the shared reader count bounces between cores
and a mutex may be as fast.

Full answer: [Chapter 10, Q7](/cpu/concurrency-2#interview-questions) · Section: [Reader-writer locks](/cpu/concurrency-2#reader-writer-locks)
:::

::: details 10.8 Explain RCU. What are its trade-offs?
Readers take no lock. Writers publish a new copy with a pointer swap and free the old one after all earlier
readers finish. Reads are nearly free; writes are slow.

Full answer: [Chapter 10, Q8](/cpu/concurrency-2#interview-questions) · Section: [RCU](/cpu/concurrency-2#rcu-read-copy-update)
:::

::: details 10.9 Is volatile enough to share a flag between threads in C? In Java?
In C and C++, no: it gives no atomicity or ordering; use atomics. In Java, a `volatile` flag is enough for
publishing, but `count++` on it is still not atomic.

Full answer: [Chapter 10, Q9](/cpu/concurrency-2#interview-questions) · Section: [Other languages](/cpu/concurrency-2#other-languages)
:::

::: details 10.10 A shared atomic counter is a bottleneck on a 64-core machine. What do you do?
Every increment moves the counter's cache line between cores. Give each thread or CPU its own padded counter,
and sum them when reading.

Full answer: [Chapter 10, Q10](/cpu/concurrency-2#interview-questions) · Section: [What atomics cost](/cpu/concurrency-2#what-atomics-cost)
:::

## 11. Inter-Process Communication

[Chapter 11](/cpu/ipc)

::: details 11.1 How does a shell pipeline like ls | grep work?
The shell makes a pipe and forks two children, wiring one's output and the other's input to it. The kernel
buffer blocks the writer when full and the reader when empty.

Full answer: [Chapter 11, Q1](/cpu/ipc#interview-questions) · Section: [How a pipe works](/cpu/ipc#how-a-pipe-works)
:::

::: details 11.2 A program reading from a pipe hangs after the writer finished. Why?
End-of-file comes only when every write end is closed. Some process, often the reader itself after `fork`,
still holds one.

Full answer: [Chapter 11, Q2](/cpu/ipc#interview-questions) · Section: [Pipes and FIFOs](/cpu/ipc#pipes-and-fifos)
:::

::: details 11.3 What can a Unix domain socket do that a TCP socket on localhost cannot?
Pass open file descriptors, report the caller's verified process and user ID, and use file permissions. It also
skips the TCP/IP stack.

Full answer: [Chapter 11, Q3](/cpu/ipc#interview-questions) · Section: [Unix domain sockets](/cpu/ipc#unix-domain-sockets)
:::

::: details 11.4 What does passing a file descriptor actually transfer?
A reference to the same open file in the kernel. The receiver gets a new number for it and shares its offset
and flags.

Full answer: [Chapter 11, Q4](/cpu/ipc#interview-questions) · Section: [Passing file descriptors](/cpu/ipc#passing-file-descriptors)
:::

::: details 11.5 When would you use shared memory, and what are its pitfalls?
For large or very frequent data where copying costs too much. You must synchronise everything yourself, handle
crashed lock holders, and store offsets instead of pointers.

Full answer: [Chapter 11, Q5](/cpu/ipc#interview-questions) · Section: [Shared memory](/cpu/ipc#shared-memory)
:::

::: details 11.6 Pipe, Unix socket, shared memory or message queue: how do you choose for a new local service?
A Unix socket for request-response, a pipe for streaming to a child, shared memory plus a notification channel
for bulk data. Design for TCP if the peer may move.

Full answer: [Chapter 11, Q6](/cpu/ipc#interview-questions) · Section: [Choosing an IPC mechanism](/cpu/ipc#choosing-an-ipc-mechanism)
:::

::: details 11.7 Why is a pipe or stream socket not a message channel? How do you send messages over it?
A stream has no boundaries; reads can merge or split writes. Add framing, such as a length before each message,
or use a message-based socket type.

Full answer: [Chapter 11, Q7](/cpu/ipc#interview-questions) · Section: [How a pipe works](/cpu/ipc#how-a-pipe-works)
:::

::: details 11.8 What happens when a process writes to a pipe whose reader has exited?
The writer gets `SIGPIPE`, which kills it by default. If it ignores the signal, the write fails with `EPIPE`.

Full answer: [Chapter 11, Q8](/cpu/ipc#interview-questions) · Section: [How a pipe works](/cpu/ipc#how-a-pipe-works)
:::

::: details 11.9 Scenario: PyTorch data-loader workers crash with "bus error" inside a container. What is going on?
Workers pass batches through `/dev/shm`, which Docker limits to 64 MB. Writing past it raises `SIGBUS`; give
the container more shared memory.

Full answer: [Chapter 11, Q9](/cpu/ipc#interview-questions) · Section: [Why this matters in real systems](/cpu/ipc#why-this-matters-in-real-systems)
:::

## 12. I/O Models

[Chapter 12](/io/io-models)

::: details 12.1 What is the difference between blocking, non-blocking and asynchronous I/O?
Blocking sleeps until done. Non-blocking returns `EAGAIN` at once and pairs with a readiness API. Asynchronous
takes the whole request and reports when it is finished.

Full answer: [Chapter 12, Q1](/io/io-models#interview-questions) · Section: [Readiness and completion](/io/io-models#asynchronous-i-o-readiness-and-completion)
:::

::: details 12.2 Why is epoll faster than select or poll with many connections?
select and poll pass and scan the whole list on every call. epoll keeps the list in the kernel and returns only
ready sockets, so cost follows ready connections, not watched ones.

Full answer: [Chapter 12, Q2](/io/io-models#interview-questions) · Section: [epoll](/io/io-models#epoll)
:::

::: details 12.3 Explain level-triggered versus edge-triggered epoll. When would you choose each?
Level-triggered keeps reporting a readable socket. Edge-triggered reports only new events, so you must drain
until `EAGAIN`. Default to level-triggered.

Full answer: [Chapter 12, Q3](/io/io-models#interview-questions) · Section: [Level-triggered and edge-triggered](/io/io-models#level-triggered-and-edge-triggered)
:::

::: details 12.4 Thread per connection or an event loop? How do you decide?
Threads give simple code and suit a few thousand busy connections. Event loops suit many mostly idle
connections, but one blocking handler stalls them all.

Full answer: [Chapter 12, Q4](/io/io-models#interview-questions) · Section: [The C10K problem](/io/io-models#the-c10k-problem)
:::

::: details 12.5 Your Node.js service has high latency but low CPU. What might be going on?
Something blocks the event loop, or libuv's small thread pool is saturated by file, DNS or crypto work.

Full answer: [Chapter 12, Q5](/io/io-models#interview-questions) · Section: [The rule: never block the loop](/io/io-models#the-rule-never-block-the-loop)
:::

::: details 12.6 Why can't you use epoll for regular files? What do runtimes do instead?
File data is always "there", only slow to fetch, so there is no readiness event. Runtimes use thread pools, let
the thread block, or use io_uring.

Full answer: [Chapter 12, Q6](/io/io-models#interview-questions) · Section: [Regular files are always "ready"](/io/io-models#regular-files-are-always-ready)
:::

::: details 12.7 What is io_uring, and why is it faster?
Two queues in memory shared with the kernel, one for requests and one for results. Many operations need one
system call or none, and it is truly asynchronous for files.

Full answer: [Chapter 12, Q7](/io/io-models#interview-questions) · Section: [io_uring](/io/io-models#io-uring)
:::

::: details 12.8 What is the thundering herd problem, and how does Linux address it?
One event wakes many waiters though only one can use it. `EPOLLEXCLUSIVE` wakes one; `SO_REUSEPORT` gives each
worker its own listening socket.

Full answer: [Chapter 12, Q8](/io/io-models#interview-questions) · Section: [The thundering herd](/io/io-models#the-thundering-herd)
:::

::: details 12.9 How does sendfile avoid copies? When does zero-copy not apply?
It moves file data to a socket inside the kernel, never through your buffer. It does not apply when you must
change the data, such as compressing or encrypting it.

Full answer: [Chapter 12, Q9](/io/io-models#interview-questions) · Section: [Zero-copy](/io/io-models#zero-copy-sendfile-and-splice)
:::

::: details 12.10 A proxy's memory keeps growing when some clients are slow. What is wrong?
No backpressure. When a write to a slow client returns `EAGAIN`, stop reading from the upstream side until the
pending data drains.

Full answer: [Chapter 12, Q10](/io/io-models#interview-questions) · Section: [Backpressure](/io/io-models#backpressure)
:::

::: details 12.11 How does Go let you write blocking code that scales like an event loop?
Sockets are non-blocking underneath. On `EAGAIN` the runtime parks the goroutine, and its epoll-based
netpoller wakes it when the socket is ready.

Full answer: [Chapter 12, Q11](/io/io-models#interview-questions) · Section: [How real systems map onto this](/io/io-models#how-real-systems-map-onto-this)
:::

## 13. File Systems

[Chapter 13](/io/file-systems)

::: details 13.1 What is an inode? Where is the file name stored?
An inode holds everything about a file except its name: owner, size, permissions, data location, link count.
Names live in directories.

Full answer: [Chapter 13, Q1](/io/file-systems#interview-questions) · Section: [Inodes](/io/file-systems#inodes-what-a-file-really-is)
:::

::: details 13.2 What is the difference between a hard link and a symbolic link?
A hard link is another name for the same inode. A symbolic link is a small file holding a path, which can cross
file systems and can dangle.

Full answer: [Chapter 13, Q2](/io/file-systems#interview-questions) · Section: [Directories and links](/io/file-systems#directories-and-links)
:::

::: details 13.3 You deleted a 50 GB log file, but disk usage did not go down. Why?
`rm` removes a name. The space is freed only when no process still has the file open, and the logger does. Find
it with `lsof +L1`.

Full answer: [Chapter 13, Q3](/io/file-systems#interview-questions) · Section: [Deleting is unlinking](/io/file-systems#deleting-is-unlinking)
:::

::: details 13.4 After fork, parent and child write to the same inherited file descriptor. What happens?
They share one open file description and so one offset, so their writes follow each other. Separate `open`
calls would each have their own offset.

Full answer: [Chapter 13, Q4](/io/file-systems#interview-questions) · Section: [File descriptors and the open file table](/io/file-systems#file-descriptors-and-the-open-file-table)
:::

::: details 13.5 write() returned success. Is the data on disk? How do you make sure?
No, it is in the page cache. Call `fsync` or `fdatasync` and check the result; for a new file, also `fsync` the
directory.

Full answer: [Chapter 13, Q5](/io/file-systems#interview-questions) · Section: [Making data durable](/io/file-systems#making-data-durable-fsync-and-friends)
:::

::: details 13.6 How do you atomically replace a file so a crash never leaves it half-written?
Write a temporary file in the same directory, `fsync` it, `rename` it over the target, then `fsync` the
directory.

Full answer: [Chapter 13, Q6](/io/file-systems#interview-questions) · Section: [The atomic replace pattern](/io/file-systems#the-atomic-replace-pattern)
:::

::: details 13.7 fsync returned an error. What should a database do?
Treat it as fatal, not retryable: Linux reports the error once and may mark the pages clean. Crash and recover
from the write-ahead log.

Full answer: [Chapter 13, Q7](/io/file-systems#interview-questions) · Section: [The fsyncgate lesson](/io/file-systems#when-fsync-fails-the-fsyncgate-lesson)
:::

::: details 13.8 What is the difference between fsync, fdatasync, O_SYNC, O_DSYNC and O_DIRECT?
`fsync` flushes data and all metadata; `fdatasync` skips metadata not needed to read the data. The sync flags do
that on every write. `O_DIRECT` skips the page cache and guarantees no durability.

Full answer: [Chapter 13, Q8](/io/file-systems#interview-questions) · Section: [The calls](/io/file-systems#the-calls)
:::

::: details 13.9 What does a journaling file system guarantee after a crash, and what does it not?
The file system's own structures stay consistent. Your file contents do not: unsynced writes can be lost, and
interrupted overwrites can leave a mix.

Full answer: [Chapter 13, Q9](/io/file-systems#interview-questions) · Section: [What the journal protects](/io/file-systems#what-the-journal-protects-and-what-it-does-not)
:::

::: details 13.10 Why might a database use O_DIRECT instead of the page cache?
It has its own cache, so the page cache would hold everything twice and evict against its wishes. It also gets
control over when I/O happens.

Full answer: [Chapter 13, Q10](/io/file-systems#interview-questions) · Section: [O_DIRECT is not a durability flag](/io/file-systems#o-direct-is-not-a-durability-flag)
:::

::: details 13.11 Scenario: writes on a service are usually fast but sometimes stall for seconds. What could the file system be doing?
Throttling writers when too much data is dirty, a large `fsync` or forced journal commit, a slow or
garbage-collecting device, or a nearly full file system.

Full answer: [Chapter 13, Q11](/io/file-systems#interview-questions) · Section: [The page cache and write-back](/io/file-systems#the-page-cache-and-write-back)
:::

## 14. The Storage Stack

[Chapter 14](/io/storage-stack)

::: details 14.1 Why is a random read on a hard disk so much slower than on an SSD?
A hard disk must move its arm and wait for rotation, about 5 to 10 ms per random read. An SSD has no moving
parts and reads in tens of microseconds.

Full answer: [Chapter 14, Q1](/io/storage-stack#interview-questions) · Section: [Hard disks](/io/storage-stack#hard-disks)
:::

::: details 14.2 The SSD's data sheet says 1 million IOPS, but your service gets 15,000. Why?
Queue depth: one request at a time is limited to 1 / latency. Throughput equals requests in flight divided by
latency, so keep many in flight.

Full answer: [Chapter 14, Q2](/io/storage-stack#interview-questions) · Section: [Latency, throughput and queue depth](/io/storage-stack#latency-throughput-and-queue-depth)
:::

::: details 14.3 What is the flash translation layer, and why does an SSD need it?
Flash cannot be overwritten in place, only erased in large blocks. The FTL maps each logical block to its
current flash page and writes every update somewhere fresh.

Full answer: [Chapter 14, Q3](/io/storage-stack#interview-questions) · Section: [The translation layer](/io/storage-stack#the-translation-layer)
:::

::: details 14.4 What is write amplification, and how do you reduce it?
The SSD writes more than the host asked, because garbage collection copies live pages. Reduce it with free
space, TRIM and large sequential writes.

Full answer: [Chapter 14, Q4](/io/storage-stack#interview-questions) · Section: [Garbage collection and write amplification](/io/storage-stack#garbage-collection-and-write-amplification)
:::

::: details 14.5 Why do SSDs sometimes have terrible tail latency?
Garbage collection competes with requests, and a read can wait behind a millisecond erase, worst when the drive
is full. Consumer drives also run out of fast write cache.

Full answer: [Chapter 14, Q5](/io/storage-stack#interview-questions) · Section: [Garbage collection and write amplification](/io/storage-stack#garbage-collection-and-write-amplification)
:::

::: details 14.6 fsync returned. What had to happen in the hardware for the data to be really durable?
The data had to leave the drive's volatile cache for stable media, forced by a cache flush or FUA write. Drives
with power-loss protection make the cache itself safe.

Full answer: [Chapter 14, Q6](/io/storage-stack#interview-questions) · Section: [What durability actually guarantees](/io/storage-stack#what-durability-actually-guarantees)
:::

::: details 14.7 What is a torn write, and how do databases handle it?
Only a sector is written atomically, so a larger database page can be half written at power loss. Databases
keep a full copy first: full-page writes or a doublewrite buffer.

Full answer: [Chapter 14, Q7](/io/storage-stack#interview-questions) · Section: [Torn writes](/io/storage-stack#torn-writes)
:::

::: details 14.8 Which I/O scheduler would you use for an NVMe drive, and why?
Usually `none`: there are no seeks to avoid and the drive reorders internally. `mq-deadline` helps hard disks.

Full answer: [Chapter 14, Q8](/io/storage-stack#interview-questions) · Section: [I/O schedulers](/io/storage-stack#i-o-schedulers)
:::

::: details 14.9 Compare RAID 1, 5, 6 and 10. Which would you pick for a write-heavy database?
RAID 1 mirrors; RAID 5 and 6 use one or two parity chunks and pay four or six I/Os per small write; RAID 10
stripes mirrors. For a write-heavy database, RAID 10.

Full answer: [Chapter 14, Q9](/io/storage-stack#interview-questions) · Section: [RAID basics](/io/storage-stack#raid-basics)
:::

::: details 14.10 Scenario: database latency rose sharply on a cloud VM, but CPU is low. How do you check storage?
Check `iostat -x` latency and queue depth, the volume's provisioned limits and credits, whether the working set
still fits in RAM, and other writers on the volume.

Full answer: [Chapter 14, Q10](/io/storage-stack#interview-questions) · Section: [Reading iostat](/io/storage-stack#reading-iostat)
:::

## 15. Networking in the Kernel

[Chapter 15](/io/networking)

::: details 15.1 write() on a TCP socket returned successfully. What do you know?
Only that the data is in the kernel's send buffer. Only a reply from the other program proves it arrived.

Full answer: [Chapter 15, Q1](/io/networking#interview-questions) · Section: [Sockets and socket buffers](/io/networking#sockets-and-socket-buffers)
:::

::: details 15.2 Walk through what happens when a packet arrives at the network card.
The card writes it to RAM and interrupts; a NAPI poll takes a batch; IP and TCP process it; TCP adds it to the
receive buffer and wakes the reader, whose `read` copies it out.

Full answer: [Chapter 15, Q2](/io/networking#interview-questions) · Section: [Receiving](/io/networking#receiving)
:::

::: details 15.3 What is TIME_WAIT, why does it exist, and when is it a problem?
The side that closes first waits 60 s, to resend a lost final ACK and let old packets expire. Clients making many
short connections to one destination can run out of ports.

Full answer: [Chapter 15, Q3](/io/networking#interview-questions) · Section: [TIME_WAIT](/io/networking#time-wait-working-as-designed)
:::

::: details 15.4 A server has thousands of connections in CLOSE_WAIT. What does that mean?
The other side closed, and your program never called `close`. It is a socket leak in the application.

Full answer: [Chapter 15, Q4](/io/networking#interview-questions) · Section: [CLOSE_WAIT](/io/networking#close-wait-a-bug-in-your-program)
:::

::: details 15.5 What does the backlog argument to listen() control? What happens when it is exceeded?
It sizes the accept queue of finished handshakes. When full, Linux ignores new SYNs, and clients retry after 1
s, then 3 s.

Full answer: [Chapter 15, Q5](/io/networking#interview-questions) · Section: [SYN queue, accept queue and backlog](/io/networking#syn-queue-accept-queue-and-backlog)
:::

::: details 15.6 How do SYN cookies work?
When the SYN queue is full, the kernel stores nothing and encodes the connection's details in its SYN-ACK
sequence number. Only a real client echoes it back.

Full answer: [Chapter 15, Q6](/io/networking#interview-questions) · Section: [SYN floods and SYN cookies](/io/networking#syn-floods-and-syn-cookies)
:::

::: details 15.7 Why might a small request-response protocol see 40 ms delays? How do you fix it?
Nagle's algorithm holds a small second write for an ACK, and the receiver delays that ACK. Send each message in
one write, or set `TCP_NODELAY`.

Full answer: [Chapter 15, Q7](/io/networking#interview-questions) · Section: [Nagle's algorithm and delayed ACKs](/io/networking#nagle-s-algorithm-and-delayed-acks)
:::

::: details 15.8 What are NAPI and RSS, and what problems do they solve?
NAPI takes one interrupt and then polls in batches, avoiding interrupt overload. RSS hashes connections to many
queues and cores, so receive work spreads out.

Full answer: [Chapter 15, Q8](/io/networking#interview-questions) · Section: [Interrupts, NAPI and spreading work across cores](/io/networking#interrupts-napi-and-spreading-work-across-cores)
:::

::: details 15.9 When would you use kernel bypass, and what does it cost?
When per-packet kernel costs are the limit: huge packet rates or microsecond latency. It costs busy dedicated
cores, lost kernel tools, and your own protocol stack.

Full answer: [Chapter 15, Q9](/io/networking#interview-questions) · Section: [Kernel bypass and its cousins](/io/networking#kernel-bypass-and-its-cousins)
:::

::: details 15.10 A single TCP transfer between two regions is slow, though both links are fast. Why?
The bandwidth-delay product: the connection needs bandwidth × round-trip time of data in flight, and its
buffers are smaller. Loss makes it worse.

Full answer: [Chapter 15, Q10](/io/networking#interview-questions) · Section: [How big should the buffers be?](/io/networking#how-big-should-the-buffers-be)
:::

## 16. Time & Timers

[Chapter 16](/systems/time-and-timers)

::: details 16.1 What is the difference between CLOCK_REALTIME and CLOCK_MONOTONIC? When do you use each?
The realtime clock is wall time and can jump; use it for timestamps people read. The monotonic clock never goes
backwards; use it for durations and timeouts.

Full answer: [Chapter 16, Q1](/systems/time-and-timers#interview-questions) · Section: [Two kinds of clock](/systems/time-and-timers#two-kinds-of-clock)
:::

::: details 16.2 How does clock_gettime work without a system call?
The kernel maps a time record into every process. The vDSO reads it plus the CPU's counter and computes the time
in user mode.

Full answer: [Chapter 16, Q2](/systems/time-and-timers#interview-questions) · Section: [Reading the time fast](/systems/time-and-timers#reading-the-time-fast)
:::

::: details 16.3 What is the timer tick, and what does a tickless kernel change?
A periodic interrupt per core for accounting, preemption and timers. Tickless kernels stop it on idle cores, or
on cores running a single thread, to save power or remove jitter.

Full answer: [Chapter 16, Q3](/systems/time-and-timers#interview-questions) · Section: [The timer tick](/systems/time-and-timers#the-timer-tick)
:::

::: details 16.4 How does the kernel manage millions of timers efficiently?
Timeouts that are usually cancelled go in a cheap, coarse timer wheel. Timers that must be precise go in a
sorted tree of high-resolution timers.

Full answer: [Chapter 16, Q4](/systems/time-and-timers#interview-questions) · Section: [Timers](/systems/time-and-timers#timers-timer-wheels-and-hrtimers)
:::

::: details 16.5 Why does sleep(10 ms) in a loop not give you a 10 ms period? How do you fix it?
Each period adds the work time and wake-up delay, and the error accumulates. Sleep until absolute monotonic
deadlines instead.

Full answer: [Chapter 16, Q5](/systems/time-and-timers#interview-questions) · Section: [Periodic work drifts](/systems/time-and-timers#periodic-work-drifts-if-you-sleep-relative-times)
:::

::: details 16.6 How does NTP correct a clock, and what can go wrong?
It estimates the offset from several servers and slews small errors, stepping only large ones. Steps break
wall-clock durations, and asymmetric paths bias the estimate.

Full answer: [Chapter 16, Q6](/systems/time-and-timers#interview-questions) · Section: [NTP and PTP](/systems/time-and-timers#keeping-the-wall-clock-correct-ntp-and-ptp)
:::

::: details 16.7 Two servers write the same key with timestamps, and the later write is lost. Why, and how do you design around it?
Clock skew gave the later write an earlier timestamp. Use a single leader with sequence numbers, versions,
logical clocks, or bounded uncertainty.

Full answer: [Chapter 16, Q7](/systems/time-and-timers#interview-questions) · Section: [Clock skew in distributed systems](/systems/time-and-timers#clock-skew-in-distributed-systems)
:::

::: details 16.8 Why is a 50 µs nanosleep often 100 µs or more?
Timer slack lets the kernel fire it up to 50 µs late, waking and scheduling the thread takes time, and deep
sleep states are slow to leave.

Full answer: [Chapter 16, Q8](/systems/time-and-timers#interview-questions) · Section: [Timer slack](/systems/time-and-timers#timer-slack-why-your-sleep-is-late)
:::

## 17. Security & Isolation

[Chapter 17](/systems/security)

::: details 17.1 What is a setuid program, and why is it risky?
It runs with its file owner's user ID, often root. Any bug in it gives the attacker that owner's power.

Full answer: [Chapter 17, Q1](/systems/security#interview-questions) · Section: [setuid programs](/systems/security#setuid-programs)
:::

::: details 17.2 What are Linux capabilities? Give examples.
Root's power split into separate privileges, such as binding low ports or configuring the network. A process
holds only the ones it needs.

Full answer: [Chapter 17, Q2](/systems/security#interview-questions) · Section: [Capabilities](/systems/security#capabilities-splitting-root-into-pieces)
:::

::: details 17.3 What is seccomp, and how do containers use it?
A filter the kernel runs on every system call, allowing or refusing it by number and arguments. Containers use a
default profile that blocks rarely needed calls.

Full answer: [Chapter 17, Q3](/systems/security#interview-questions) · Section: [seccomp](/systems/security#seccomp-filtering-system-calls)
:::

::: details 17.4 How do NX, ASLR and stack canaries each defend against a buffer overflow?
Canaries detect an overwritten return address, NX stops injected code from running, and ASLR hides where useful
code is.

Full answer: [Chapter 17, Q4](/systems/security#interview-questions) · Section: [Memory bugs and the defences against them](/systems/security#memory-bugs-and-the-defences-against-them)
:::

::: details 17.5 Explain Meltdown and how KPTI fixes it.
Affected CPUs let user code speculatively read kernel memory and leak it through cache timing. KPTI removes the
kernel from the page tables while user code runs.

Full answer: [Chapter 17, Q5](/systems/security#interview-questions) · Section: [Meltdown](/systems/security#meltdown)
:::

::: details 17.6 How is Spectre different from Meltdown, and why is it harder to fix?
Spectre tricks a victim's own code into speculatively leaking its data by training the branch predictor.
Prediction is everywhere, so fixes are many and scattered.

Full answer: [Chapter 17, Q6](/systems/security#interview-questions) · Section: [Spectre](/systems/security#spectre)
:::

::: details 17.7 Why did system calls become more expensive after 2018? What can a service do about it?
Protections run on every kernel entry and exit. Make fewer system calls: buffer, batch, use io_uring and the
vDSO, or run on CPUs fixed in hardware.

Full answer: [Chapter 17, Q7](/systems/security#interview-questions) · Section: [Why system calls got more expensive](/systems/security#why-system-calls-got-more-expensive)
:::

::: details 17.8 How would you harden a container that runs untrusted user code?
Non-root user, no capabilities, strict seccomp, read-only root, resource limits. Because the kernel is shared,
add gVisor or a microVM for truly untrusted code.

Full answer: [Chapter 17, Q8](/systems/security#interview-questions) · Section: [Containers and sandboxes](/systems/security#putting-the-layers-together-containers-and-sandboxes)
:::

## 18. Virtualization & Containers

[Chapter 18](/systems/virtualization)

::: details 18.1 What is the difference between a container and a virtual machine?
A VM runs its own kernel on virtual hardware. A container is ordinary processes on the host kernel with a
private view and limits: lighter, but a weaker boundary.

Full answer: [Chapter 18, Q1](/systems/virtualization#interview-questions) · Section: [Two ways to share a machine](/systems/virtualization#two-ways-to-share-a-machine)
:::

::: details 18.2 What is a Linux container made of?
Normal processes plus namespaces (what they see), cgroups (what they use), security filters, and a root file
system built from image layers.

Full answer: [Chapter 18, Q2](/systems/virtualization#interview-questions) · Section: [Containers: isolation from kernel features](/systems/virtualization#containers-isolation-from-kernel-features)
:::

::: details 18.3 How does hardware virtualization work? What is a VM exit?
The guest runs directly in a special CPU mode. Chosen events, such as device access, stop it and switch to the
hypervisor: a VM exit.

Full answer: [Chapter 18, Q3](/systems/virtualization#interview-questions) · Section: [Hardware virtualization](/systems/virtualization#hardware-virtualization)
:::

::: details 18.4 How is memory translated inside a VM? Why do TLB misses cost more?
Twice: guest tables, then the hypervisor's nested tables. Every step of the guest walk needs its own nested walk,
up to 24 reads per miss.

Full answer: [Chapter 18, Q4](/systems/virtualization#interview-questions) · Section: [Memory: nested paging](/systems/virtualization#memory-nested-paging)
:::

::: details 18.5 What are type 1 and type 2 hypervisors? Where does KVM fit?
Type 1 runs on the hardware; type 2 runs as an application on an OS. KVM turns Linux itself into the hypervisor
and is usually counted as type 1.

Full answer: [Chapter 18, Q5](/systems/virtualization#interview-questions) · Section: [Hypervisors](/systems/virtualization#hypervisors-type-1-and-type-2)
:::

::: details 18.6 Why are containers considered a weaker security boundary than VMs? How do you harden them?
All containers share one kernel with hundreds of system calls to attack. Harden with non-root users, user
namespaces, fewer capabilities, seccomp, and a sandbox for untrusted code.

Full answer: [Chapter 18, Q6](/systems/virtualization#interview-questions) · Section: [What containers do not isolate](/systems/virtualization#what-containers-do-not-isolate)
:::

::: details 18.7 Inside a container, free shows 256 GB of RAM, but the container is limited to 4 GB. Why, and why does it matter?
`/proc/meminfo` shows the host; the limit lives in the cgroup. Programs that size themselves from the machine
will overshoot and be OOM-killed.

Full answer: [Chapter 18, Q7](/systems/virtualization#interview-questions) · Section: [What containers do not isolate](/systems/virtualization#what-containers-do-not-isolate)
:::

::: details 18.8 Compare emulated devices, virtio and passthrough.
Emulation works with any guest but exits on every access. Virtio batches requests through shared queues.
Passthrough gives native speed but ties the device to one VM.

Full answer: [Chapter 18, Q8](/systems/virtualization#interview-questions) · Section: [Devices](/systems/virtualization#devices-emulation-virtio-and-passthrough)
:::

::: details 18.9 A service on a cloud VM slows down at random times with no change in its load. What do you check?
Steal time from other guests, CPU throttling, burst credits, noisy neighbours on disk or network, then the usual
in-guest causes.

Full answer: [Chapter 18, Q9](/systems/virtualization#interview-questions) · Section: [What a VM costs in practice](/systems/virtualization#what-a-vm-costs-in-practice)
:::

## 19. Performance & Debugging

[Chapter 19](/systems/performance)

::: details 19.1 A service's latency went up. Walk me through how you would investigate.
Define the problem precisely, run the USE method to find a resource, split on-CPU from off-CPU time, drill down
with profiles, fix one thing and confirm.

Full answer: [Chapter 19, Q1](/systems/performance#interview-questions) · Section: [The method in one page](/systems/performance#the-method-in-one-page)
:::

::: details 19.2 What is the USE method?
For every resource, check utilization, saturation and errors, so you do not skip a resource you forgot about.

Full answer: [Chapter 19, Q2](/systems/performance#interview-questions) · Section: [Step 2: the USE method](/systems/performance#step-2-the-use-method)
:::

::: details 19.3 How does a sampling profiler work, and how do you read a flame graph?
It records the running stack at a fixed rate, so frequent stacks used more CPU. In a flame graph, width is time
share and each box sits on its caller.

Full answer: [Chapter 19, Q3](/systems/performance#interview-questions) · Section: [Flame graphs](/systems/performance#flame-graphs)
:::

::: details 19.4 What is off-CPU analysis, and when do you need it?
It measures time threads spend waiting, which CPU profiles cannot see. Use it when wall time is much larger than
CPU time.

Full answer: [Chapter 19, Q4](/systems/performance#interview-questions) · Section: [Step 4: off-CPU analysis](/systems/performance#step-4-off-cpu-analysis)
:::

::: details 19.5 Why is strace dangerous in production? What would you use instead?
It stops the process on every system call, which can slow it many times. Use `perf trace` or eBPF tools, which
work inside the kernel.

Full answer: [Chapter 19, Q5](/systems/performance#interview-questions) · Section: [strace and ltrace](/systems/performance#strace-and-ltrace)
:::

::: details 19.6 Why does latency rise sharply as utilization approaches 100%?
Bursts queue behind each other and drain slowly. In the simplest model the wait is busy / (1 − busy) service
times: 9 at 90%, 19 at 95%.

Full answer: [Chapter 19, Q6](/systems/performance#interview-questions) · Section: [Queues explode near full utilization](/systems/performance#queues-explode-near-full-utilization)
:::

::: details 19.7 A request fans out to 100 backends. Each has a 1% chance of being slow. What does the user see?
About 63% of requests hit at least one slow backend, so the backends' tail becomes the user's normal. Use hedged
requests and timeouts.

Full answer: [Chapter 19, Q7](/systems/performance#interview-questions) · Section: [Fan-out multiplies the tail](/systems/performance#fan-out-multiplies-the-tail)
:::

::: details 19.8 The p99 latency looks fine in your load test but bad in production. What could explain it?
Coordinated omission in the load generator, different traffic, a different environment, or percentiles averaged
across hosts.

Full answer: [Chapter 19, Q8](/systems/performance#interview-questions) · Section: [Measuring tails correctly](/systems/performance#measuring-tails-correctly)
:::

::: details 19.9 perf shows high CPU in a function, but making it faster did not reduce latency. Why?
The requests were not limited by that CPU time: they were waiting off-CPU, the function ran off the request path,
or the bottleneck was elsewhere.

Full answer: [Chapter 19, Q9](/systems/performance#interview-questions) · Section: [Where time goes](/systems/performance#where-time-goes-on-cpu-and-off-cpu)
:::

## Senior curveballs

**In short:** these questions mix several chapters, as real senior interviews do. There is no single right
answer. Interviewers want a list of plausible causes, how you would tell them apart, and what you would check
first.

::: details C1. p99 latency doubled after moving the service into containers, with the same hardware and traffic. What OS-level causes would you check?
CPU throttling from a quota, runtimes sizing thread pools from the host's cores, memory limits causing reclaim
or OOM kills, and extra network hops (connection tracking, overlay networks). Check `cpu.stat`,
`memory.events` and PSI first.

Chapters: [CPU limits in containers](/cpu/scheduling#cpu-limits-in-containers) · [Memory limits for containers](/memory/kernel-memory#memory-limits-for-containers) · [What containers do not isolate](/systems/virtualization#what-containers-do-not-isolate)
:::

::: details C2. Database commits got ten times slower after moving from bare metal to a cloud VM. Why?
Commit speed is `fsync` speed. The old drives may have had power-loss protection; the cloud volume adds network
round trips, replication and per-volume limits, and the hypervisor adds its own layer.

Chapters: [What does fsync cost?](/io/file-systems#what-does-fsync-cost) · [Drives that do not need flushing](/io/storage-stack#drives-that-do-not-need-flushing) · [What a VM costs in practice](/systems/virtualization#what-a-vm-costs-in-practice)
:::

::: details C3. Redis has latency spikes and nearly doubles its memory every time it saves a snapshot. Explain.
Saving forks the process. `fork` copies the page tables, which pauses Redis, and every page written afterwards
is copied. Transparent huge pages make each copy 2 MiB.

Chapters: [What fork still costs](/memory/kernel-memory#what-fork-still-costs) · [Huge pages](/memory/virtual-memory#huge-pages) · [Why large programs avoid fork](/foundations/processes-and-threads#why-large-programs-avoid-fork)
:::

::: details C4. A multi-threaded service scales well to 8 cores, then gets slower at 32. What would you look for?
Lock contention, a hot shared atomic or false sharing moving cache lines between cores, memory bandwidth
limits, and threads on the second socket reading remote NUMA memory. Measure with `perf c2c` and per-thread
throughput curves.

Chapters: [Lock granularity and contention](/cpu/concurrency-1#lock-granularity-and-contention) · [False sharing](/memory/caches-and-numa#false-sharing) · [What atomics cost](/cpu/concurrency-2#what-atomics-cost)
:::

::: details C5. GPUs on a training job sit at 40% utilization. What OS-level causes would you check?
The input pipeline cannot keep up: too few reads in flight, small random reads from network storage, a small
`/dev/shm` for workers, data loaders on the wrong NUMA node, or gradient exchange over TCP instead of RDMA.

Chapters: [Queue depth](/io/storage-stack#latency-throughput-and-queue-depth) · [Shared memory](/cpu/ipc#shared-memory) · [NUMA: what you can do](/memory/caches-and-numa#what-you-can-do) · [Kernel bypass](/io/networking#kernel-bypass-and-its-cousins)
:::

::: details C6. Under load a server starts failing with "Too many open files", and ss shows thousands of CLOSE_WAIT connections. What is happening?
The program is not closing sockets after clients leave, so descriptors leak until the per-process limit is
hit. Raising the limit only delays the failure; find the code path that skips `close`.

Chapters: [File descriptors](/io/file-systems#file-descriptors-and-the-open-file-table) · [CLOSE_WAIT](/io/networking#close-wait-a-bug-in-your-program)
:::

::: details C7. A service has latency spikes at regular intervals, every few seconds. What periodic OS activity could cause them?
Dirty-page write-back or journal commits flushing at intervals, CPU quota periods throttling the container,
allocators returning memory and causing TLB shootdowns, and periodic `fork`-based snapshots. Match the interval
to the setting.

Chapters: [Writes go to the cache first](/memory/kernel-memory#writes-go-to-the-cache-first) · [Quota per period](/cpu/scheduling#quota-a-hard-budget-per-period) · [Where OS-level tails come from](/systems/performance#where-os-level-tails-come-from)
:::

::: details C8. A container exits with code 137, but its application logs show nothing unusual. Who killed it, and why?
137 is 128 + 9: `SIGKILL`. Candidates are the cgroup OOM killer, a `SIGKILL` after an ignored `SIGTERM`
grace period, or the orchestrator (failed health check, eviction). Check `memory.events`, `dmesg` and the
orchestrator's events.

Chapters: [SIGTERM and SIGKILL](/foundations/processes-and-threads#sigterm-sigkill-and-graceful-shutdown) · [The OOM killer](/memory/kernel-memory#the-oom-killer) · [cgroups](/systems/virtualization#cgroups)
:::

::: details C9. Design a crash-safe, high-throughput append-only log on one machine.
Append to pre-allocated files, commit many records per `fdatasync` (group commit), and checksum records to detect
torn writes. Keep many writes in flight, for example with io_uring, and treat an `fsync` error as fatal.

Chapters: [What does fsync cost?](/io/file-systems#what-does-fsync-cost) · [Torn writes](/io/storage-stack#torn-writes) · [io_uring](/io/io-models#io-uring)
:::

::: details C10. A service spends most of its CPU time in the kernel doing millions of small system calls. What do you do?
Confirm with `perf trace -s`, then make fewer, larger calls: buffer, batch, use epoll or io_uring well, and read
the time through the vDSO. Check which CPU security protections are active, since they raise each call's cost.

Chapters: [Doing fewer system calls](/foundations/what-is-an-os#doing-fewer-system-calls) · [Why system calls got more expensive](/systems/security#why-system-calls-got-more-expensive) · [io_uring](/io/io-models#io-uring)
:::

::: details C11. Timeouts in a distributed service fire far too early on some VMs and never on others. What would you suspect?
Timeouts measured with the wall clock, which NTP steps or VM migrations can move. Timeouts must use the
monotonic clock, and VM clocks need a stable, readable clock source.

Chapters: [Timeouts must use the monotonic clock](/systems/time-and-timers#timeouts-must-use-the-monotonic-clock) · [Time in VMs and containers](/systems/time-and-timers#time-in-virtual-machines-and-containers)
:::

<MarkDone id="question-bank" />
