---
title: 8. Scheduling & Context Switches
---

<script setup>
import { cards } from './scheduling-review'
</script>

# 8. Scheduling & Context Switches

A machine runs thousands of threads on a handful of CPU cores. The scheduler decides who runs, where and for
how long, and each decision can cost a context switch. Interviewers use this topic to test whether you can
connect textbook ideas to real problems, such as latency spikes in containers.

::: info Before you start
- A <Term id="thread">thread</Term> is one line of execution. A <Term id="process">process</Term> is a
  running program with its own memory, and it holds one or more threads.
- The <Term id="kernel">kernel</Term> gets control back from a running thread through a regular timer
  <Term id="interrupt">interrupt</Term>. [Chapter 1](/foundations/what-is-an-os) explains this.
- Threads of one process share memory. Switching between processes also changes the memory view, which has
  a cost in the CPU's translation cache. [Chapter 4](/memory/virtual-memory) explains this.

[Chapter 2](/foundations/processes-and-threads) covers processes, threads and their states in full, but this
chapter restates what it needs.
:::

## What the scheduler decides

**In short:** at any moment, some threads are ready to run and wait for a core. The scheduler picks which one
runs next on each core, and for how long.

Look at any server with `top`. It shows hundreds of threads, but most of them are **blocked**: waiting for a
network packet, a disk read, a lock or a timer. They do not want the CPU. Only the threads that are
**runnable** compete for cores. A runnable thread is either running now, or ready and waiting for its turn.

Each core keeps its waiting runnable threads in a list called its <Term id="run-queue">run queue</Term>. The
<Term id="scheduler">scheduler</Term> is the kernel code that picks the next thread from that queue. It runs
at these moments:

- **A thread blocks**, for example in a `read` with no data. The core needs something else to do.
- **A thread wakes up**, for example when its data arrives. It may deserve the core more than the current one.
- **A timer tick arrives.** The scheduler checks whether the current thread has used up its turn.
- **A thread yields, exits, or its priority changes.**

The length of one turn on the CPU is the <Term id="time-slice">time slice</Term>. When the kernel takes the
core away from a thread that still wants it, that is <Term id="preemption">preemption</Term>.

### What "good" means

There is no single best schedule, because the goals conflict:

| Goal | Question it answers | Who cares |
|---|---|---|
| Throughput | How much work finishes per second? | Batch jobs, ML training |
| Turnaround time | How long from a job's arrival until it finishes? | Batch jobs, builds |
| Response time | How long from arrival until it **first** runs? | Interactive apps, request handlers |
| Fairness | Does every thread get its share, and nobody starve? | Shared machines, multi-tenant systems |

Two more hidden goals matter in practice: keeping caches warm, and keeping the scheduler's own overhead low.

Threads also behave in two broad ways. A **CPU-bound** thread, such as a video encoder, would run forever if
allowed. An **I/O-bound** thread, such as a text editor or a web request handler, runs for a moment and then
blocks. A good scheduler lets the I/O-bound thread run as soon as it wakes. It needs the CPU only briefly, and
someone is often waiting for its result.

## The classic algorithms

**In short:** first come, first served is simple but lets one long job delay everyone. Shortest job first
gives the best average wait but needs to know the future. Round robin takes turns, which gives fast response
at the cost of more switching.

These algorithms are textbook material, but interviewers still ask about them. They are the vocabulary for
talking about real schedulers. To compare them, we use three measures for each job:

- **Waiting time:** time spent ready but not running.
- **Turnaround time:** from arrival until finish.
- **Response time:** from arrival until the job first runs.

### First come, first served (FCFS)

Run jobs in arrival order, each until it finishes. It is simple and fair in one sense: nobody jumps the
queue.

Now suppose a 20 ms job arrives first, followed by three 2 ms jobs. The short jobs wait behind the long one.
Their average wait is about 20 ms for 2 ms of work. This is the **convoy effect**: short jobs stuck behind a
long one, like cars behind a truck on a one-lane road.

### Shortest job first (SJF)

Whenever the core is free, run the waiting job with the shortest CPU burst. A **CPU burst** is how much CPU
time a job needs before it finishes or blocks. Putting short jobs first gives the lowest possible average
waiting time, because each short job delays everyone behind it only a little.

SJF has two problems:

- **It needs to know the future.** The scheduler does not know how long a job will run. Real systems can only
  guess from past behaviour.
- **Long jobs can starve.** If short jobs keep arriving, a long job may never run.

Plain SJF also cannot help once a long job has started, because it never interrupts a running job. The
preemptive version, **shortest remaining time first (SRTF)**, fixes that. When a new job arrives with less work
left than the running one, it takes the core.

### Round robin

Give each job one time slice, then move it to the back of the queue and run the next one. Every waiting job
gets a turn quickly, so response time is good. No job can block the others for long.

The slice length is the key trade-off:

- **Too long**, and round robin becomes FCFS, with its convoys.
- **Too short**, and the core spends a large share of its time switching between jobs instead of working.

Round robin has a weakness that surprises people. If all jobs have the same length, it makes them **all**
finish late. Each one waits for the others' turns until the very end. FCFS would finish the first job early,
the second a bit later, and so on.

<SchedulerSimulator />

Try these in the widget:

1. Load **Convoy**. FCFS gives an average wait of 15. SJF does no better, because the long job A had already
   started when the short ones arrived. SRTF and round robin cut the wait to a few units.
2. Load **Equal jobs** and set the slice to 1. Round robin gives the best response time but the worst
   turnaround: every job finishes near the end.
3. Keep **Equal jobs** with slice 1, and set the switch cost to 0.5. Round robin now loses about a third of
   the core to switching. Raise the slice and watch the lost time shrink.
4. Load **Mixed** and raise the slice to 10. Round robin now produces exactly the FCFS schedule.

### Multi-level feedback queue (MLFQ)

**In short:** MLFQ learns how each thread behaves. Threads that use a lot of CPU sink to lower priority, and
threads that block often stay high, so interactive work stays responsive.

SJF works best, but needs to know job lengths. MLFQ guesses them from behaviour. It keeps several queues, one
per priority level, and follows a few rules:

1. Always run a thread from the highest non-empty queue. Within one queue, use round robin.
2. A new thread starts in the top queue. We do not know yet whether it is short.
3. If a thread uses up its CPU allowance at a level, it moves down one level. It is probably a long job.
4. If it blocks before that, it stays where it is. It is probably interactive.
5. Every so often, move every thread back to the top. This stops long jobs from starving. It also gives a
   thread that changed its behaviour a fresh start.

Lower queues usually get longer time slices. Long jobs run less often, but switch less when they do run.

Rule 3 counts the **total** CPU used at a level, not one slice. Otherwise a program could game the scheduler.
It would run for 99% of a slice, then make a tiny blocking call, and stay at top priority forever.

MLFQ goes back to the CTSS system of the early 1960s. Many schedulers, including those of BSD Unix, Solaris
and Windows, use variations of it.

## How Linux schedules: CFS and EEVDF

**In short:** Linux does not use fixed priority queues for normal threads. It tracks how much CPU time each
thread has received and gives the core to the one that is most behind its fair share. The algorithm that picks
was CFS from 2007 and is EEVDF since Linux 6.6 (2023).

### The idea: fair shares and virtual runtime

Picture an ideal CPU that runs every runnable thread at the same time, each at a fraction of full speed. With
four threads, each would get exactly a quarter. Real cores run one thread at a time. So Linux tries to stay as
close as possible to that ideal over short periods.

To do that, it keeps a counter per thread: the CPU time the thread has received. The scheduler runs the thread
with the **smallest** counter, the one that is furthest behind. As it runs, its counter grows. Soon another
thread has the smallest counter and gets the core.

Priorities fit in by making the counter grow at different speeds. A thread with more **weight** (higher
priority) has its counter grow more slowly, so it gets picked more often. This weighted counter is called
<Term id="vruntime">virtual runtime</Term>.

This handles interactive threads well, with no special rules. A text editor sleeps most of the time, so its
virtual runtime stays low. When it wakes up, it is among the furthest behind, so it runs almost at once.

::: details Going deeper: CFS details
- The <Term id="cfs">Completely Fair Scheduler (CFS)</Term>, written by Ingo Molnár, was merged in Linux
  2.6.23 (2007). It replaced the "O(1)" scheduler, which used priority arrays and guesses about which threads
  were interactive, similar in spirit to MLFQ.
- Runnable threads sit in a red-black tree (a balanced search tree) sorted by virtual runtime. The next thread
  is the leftmost node.
- A thread that wakes after a long sleep does not keep its very low virtual runtime. Otherwise it could bank
  credit and then hog the core. CFS moves it up to near the smallest virtual runtime in the queue.
- CFS aimed to run every runnable thread once within a target period (`sched_latency`, 6 ms scaled up with
  the number of CPUs), but never for less than a minimum slice (`sched_min_granularity`). Since Linux 5.13
  these knobs live in debugfs (`/sys/kernel/debug/sched/`), not in `sysctl`.
- A waking thread preempted the running one only if it was behind by more than a set margin
  (`sched_wakeup_granularity`). This avoided switching too often.
:::

### EEVDF: fairness plus a deadline

CFS was fair, but it had no clean way to express one common need: "I need the CPU **soon**, but not **more
often**". A latency-sensitive thread and a batch thread with equal weight were treated the same. Over the
years, CFS gained many special cases to decide when a waking thread should preempt the running one.

Since Linux 6.6, the fair scheduler picks the next thread with
<Term id="eevdf">EEVDF</Term> (earliest eligible virtual deadline first) instead. It is based on a 1995
research paper by Ion Stoica and Hussein Abdel-Wahab. It keeps the idea of fair shares and adds two things:

- **Eligible.** For each thread, the scheduler tracks its **lag**: the CPU time it should have received so far,
  minus what it did receive. A thread with zero or positive lag is owed time, so it is eligible. A thread that
  got ahead must wait until the others catch up.
- **Virtual deadline.** Each thread asks for a slice of some length. Its deadline is roughly "when it became
  eligible, plus its slice, scaled by its weight". Among eligible threads, the one with the **earliest
  deadline** runs.

A thread that asks for shorter slices gets earlier deadlines. So it runs sooner after waking, but in shorter
pieces. Its **share** of the CPU does not change. That is exactly the "soon, not more" that CFS could not
express.

EEVDF did not replace everything. It changed **how the next thread is picked**. Weights, virtual runtime,
`nice`, cgroup CPU controls and the scheduling policy names stayed the same. Many people and documents still
call the whole thing "CFS".

| Kernel versions | Picks the next normal thread with | Examples of distributions |
|---|---|---|
| 2.6.0 – 2.6.22 | The O(1) scheduler | Very old systems only |
| 2.6.23 – 6.5 | CFS | RHEL 8 (4.18), RHEL 9 (5.14), Ubuntu 22.04 (5.15), Debian 12 (6.1) |
| 6.6 and newer | EEVDF | Ubuntu 24.04 (6.8), Debian 13 (6.12), RHEL 10 (6.12) |

Vendor kernels backport features, so check `uname -r` and the vendor's notes. In an interview, "Linux uses
CFS" is fine for older kernels. Mentioning that 6.6 switched to EEVDF shows you are current.

::: details Going deeper: EEVDF details
- The base slice is set in debugfs as `base_slice_ns`. It is a few milliseconds on typical multi-core
  machines. The old CFS latency knobs were removed.
- Linux 6.12 completed the move, including better handling of the lag of threads that go to sleep. It also lets
  a normal thread request its own slice length through the `sched_runtime` field of `sched_setattr()`.
- Linux 6.12 also added **sched_ext**, which lets a scheduler be written as a BPF program and loaded at run
  time. Companies use it to try workload-specific policies without patching the kernel.
:::

## Per-core run queues and load balancing

**In short:** each core has its own run queue, so cores do not fight over one shared list. The kernel moves
threads between queues to keep all cores busy, preferring nearby cores that share a cache.

A single run queue for the whole machine would need a lock. With 64 or more cores, they would spend much of
their time waiting for it. So Linux gives **each core its own run queue**, and a core only picks threads from
its own queue.

That creates a new problem: one core can have a long queue while another sits idle. The kernel fixes this in
three ways:

- **On wake-up**, it chooses a core for the waking thread. It prefers an idle core close to where the thread
  last ran, or close to the thread that woke it.
- **Periodically**, each core checks whether others are much busier and pulls threads from them.
- **When a core is about to go idle**, it first tries to take work from a busy neighbour.

<RunQueuesDiagram />

Moving a thread is not free. On its old core, its data was in the cache. On the new core, it starts with a
cold cache. So the balancer works in layers. It moves threads first between the two hardware threads of one
core, then between cores that share a cache, and only then between sockets.

On large servers, memory is split between sockets. Each socket reaches its own memory faster than the other
socket's memory. This design is called <Term id="numa">NUMA</Term> (non-uniform memory access). Moving a
thread across sockets can make its memory accesses slower. [Chapter 7](/memory/caches-and-numa) covers it.

::: details Going deeper: scheduling domains
Linux describes this hierarchy as **scheduling domains**: hardware threads of one core (SMT), cores sharing a
last-level cache, then NUMA nodes. Balancing within low levels happens often; across NUMA nodes, rarely. You
can count moves between cores with `perf stat -e cpu-migrations`. Automatic NUMA balancing
(`kernel.numa_balancing`) can also move threads and memory towards each other.
:::

## Priorities, nice and real-time classes

**In short:** `nice` changes a normal thread's share of the CPU. Real-time policies are different: a runnable
real-time thread always runs before every normal thread.

### nice: a weight, not a rank

Every normal thread has a <Term id="nice">nice value</Term> from -20 to 19. The default is 0. A higher value
means "nicer to others", so a lower share. Each step changes the thread's weight by about 25%. Between two
competing threads, that works out to roughly 10% of CPU time per step.

For example, two CPU-bound threads compete for one core. One has nice 0, the other nice 5. The first gets
about 75% of the core and the second about 25%. Neither ever starves.

Two points people get wrong:

- **Nice only matters when there is competition.** A nice-19 thread on an idle core runs at full speed.
- **Nice is not a latency tool.** It mainly changes the share, not how fast a thread runs after waking. For
  latency, real-time policies (below) or CPU isolation are the tools.

Any user can raise nice (lower their own priority) with `nice -n 10 cmd` or `renice`. Lowering it below 0
needs privilege.

::: details Going deeper: weights and autogroups
- Nice 0 has weight 1024. Nice 5 has weight 335, so the split above is 1024 : 335, about 75 : 25. Nice -20 has
  weight 88761 and nice 19 has weight 15.
- On Linux, nice applies to each thread, not the whole process. That differs from what POSIX says.
- Many desktop distributions enable **autogroup**: each terminal session becomes a group, and groups share
  the CPU fairly first. Then `nice` only works between threads of the same session. Check
  `/proc/sys/kernel/sched_autogroup_enabled`. On servers, systemd's cgroups have a similar effect between
  services.
:::

### Scheduling policies

Linux has several policies, in strict order. A runnable thread from a higher class always runs before any
thread from a lower one:

| Policy | Class | How it picks | Typical use |
|---|---|---|---|
| `SCHED_DEADLINE` | Deadline | Each thread declares "X ms of CPU every Y ms"; the kernel checks it can promise that | Industrial control, media |
| `SCHED_FIFO` | Real-time | Fixed priority 1–99. Runs until it blocks, yields, or a higher priority wakes | Audio, robotics, low-latency trading |
| `SCHED_RR` | Real-time | Like FIFO, but threads of equal priority take turns (100 ms slices by default) | Same |
| `SCHED_OTHER` (also called `SCHED_NORMAL`) | Fair | CFS or EEVDF, weighted by nice | Almost everything |
| `SCHED_BATCH` | Fair | Like normal, but never treated as interactive | Batch jobs |
| `SCHED_IDLE` | Fair (lowest) | Runs only when little else wants the core | Background work |

The two real-time policies are <Term id="real-time-scheduling">real-time scheduling</Term>: fixed priorities
with no fairness. A `SCHED_FIFO` thread in an endless loop never gives up its core to normal threads. Only a
higher real-time priority can take it.

That is dangerous, so Linux keeps a safety net. By default, real-time threads may use at most 95% of each
second (`kernel.sched_rt_runtime_us = 950000` out of `1000000`). The remaining 5% lets you log in and kill a
runaway thread. Use `chrt` to set or view policies: `chrt -f 50 ./prog` starts a program as `SCHED_FIFO` with
priority 50.

::: tip Real time is about predictability
A real-time policy does not make code faster. It makes **waiting** predictable: when a real-time thread wakes,
it runs within microseconds instead of waiting for other threads' slices. The kernel itself must also avoid
long stretches that cannot be interrupted. That is the goal of the `PREEMPT_RT` build option, which became
part of the mainline kernel in 6.12.
:::

::: details Going deeper: reading priorities in top and ps
In `top`, the `PR` column shows `20 + nice` for normal threads. It shows a negative number for real-time
threads, and `rt` for the highest real-time priority. `ps -eLo pid,tid,cls,rtprio,ni,comm` shows the class
(`TS` for normal, `FF` for FIFO, `RR`, `DLN` for deadline), the real-time priority and the nice value per
thread. Recent kernels also reserve a small share of time for normal threads in a different way, with a
"deadline server", instead of relying only on the 95% rule.
:::

### Priority inversion

A strict priority order has a trap. Suppose a low-priority thread holds a lock. A high-priority thread wants
that lock and waits. Meanwhile, a medium-priority thread runs, and it keeps the low-priority thread off the
CPU. The high-priority thread is now stuck behind a medium-priority one. This is
<Term id="priority-inversion">priority inversion</Term>.

It famously caused repeated resets on the Mars Pathfinder lander in 1997. The usual fix is **priority
inheritance**: while a thread holds a lock that a higher-priority thread wants, it temporarily runs at that
higher priority. On Linux, pthread mutexes support this with the `PTHREAD_PRIO_INHERIT` option.
[Chapter 9](/cpu/concurrency-1) covers it with locks.

## Context switches

**In short:** a context switch saves one thread's CPU state and loads another's. The direct cost is around a
microsecond or a few. The indirect cost, from cold caches, is often larger.

### What gets saved

A <Term id="context-switch">context switch</Term> is the kernel stopping one thread on a core and starting
another. It always happens inside the kernel. The old thread got there by blocking in a
<Term id="syscall">system call</Term>, or because an interrupt such as the timer tick arrived.

<ContextSwitchDiagram />

A thread's state on the CPU lives in its <Term id="register">registers</Term>, the small storage slots inside
the CPU. The kernel saves these for the old thread:

- **General-purpose registers**, which hold the values the code is working on.
- **The instruction pointer**, which says where the code was.
- **The stack pointer**, which says where its stack is.
- **Floating-point and vector registers**, used by maths and SIMD code. These can take several kilobytes.
- **A pointer to its thread-local storage**, the per-thread variables such as `errno`.

The kernel stores them in its own record for that thread. Then it loads the saved values of the new thread.
Each thread also has its own small stack inside the kernel, and the kernel switches to that stack too.

If the new thread belongs to a **different process**, the kernel also loads that process's page table, which
changes the memory view. Two threads of the same process skip this step.

::: details Going deeper: the Linux and x86 names
- Linux keeps each thread's record in a `task_struct`. The switch happens in `context_switch()`, which calls
  `switch_mm()` (for the memory view) and `switch_to()` (for registers and kernel stack).
- On x86-64, vector state is saved with the `XSAVE` family of instructions. The size depends on the CPU's
  features: a few hundred bytes for SSE, more than 2 KiB with AVX-512, and about 8 KiB more for AMX tiles.
- The thread-local storage pointer is the `FS` base register.
- The page table switch loads `CR3`. With PCID tags, it does not need to empty the
  <Term id="tlb">TLB</Term>. [Chapter 4](/memory/virtual-memory) explains why.
- Some Spectre protections flush branch-predictor state when switching between processes. Whether they do
  depends on the CPU and on kernel settings.
:::

### What it costs

**Direct cost.** Entering the kernel, running the scheduler, saving and loading state, and returning takes on
the order of **one to a few microseconds** on modern hardware. For comparison, a bare system call costs about
100 nanoseconds.

**Indirect cost.** The new thread finds the CPU's caches full of the old thread's data. It runs slower until it
has loaded its own. The same happens to the branch predictor, the part of the CPU that guesses which way `if`
statements will go. After a switch to another process, the TLB may also hold nothing useful. For code that
uses a lot of data, this indirect cost can be several times the direct one.

Three things make switches more expensive:

- **Switching to another process** instead of another thread of the same process: the memory view changes.
- **Moving to another core**: the thread's data is in the old core's cache.
- **Many runnable threads per core**: each gets less time between switches, so a larger share of its time
  goes to warming the cache again.

This is why high-throughput systems try to run **about one busy thread per core**. They handle many tasks
with event loops or user-space scheduling instead of thousands of kernel threads.

### Voluntary and involuntary switches

A thread gives up the core in one of two ways:

- **Voluntary:** it blocks. It waits for I/O, a lock, a sleep or a condition. It had nothing to do.
- **Involuntary:** the kernel preempted it. Its slice ran out, or a more deserving thread woke up. It still
  wanted to run.

The mix tells you what a thread is suffering from. Many involuntary switches mean **CPU contention**: more
runnable threads than cores, or a CPU limit. Many voluntary switches mean the thread **blocks a lot**, for
example on a busy lock or on many small I/O calls.

Linux counts both for every thread:

```bash
$ grep ctxt /proc/<pid>/status
voluntary_ctxt_switches:        1523
nonvoluntary_ctxt_switches:     87

$ pidstat -w -p <pid> 1          # per second: cswch/s (voluntary), nvcswch/s (involuntary)
$ pidstat -wt -p <pid> 1         # the same, per thread
$ vmstat 1                       # "cs" column: switches per second for the whole machine
```

### Try it: measure a context switch

This program makes two processes pass one byte back and forth through two pipes. Both are pinned to one core,
so every hand-over is a real context switch:

```c
// pingpong.c: gcc -O2 pingpong.c -o pingpong && ./pingpong
#define _GNU_SOURCE
#include <sched.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#define ROUNDS 100000

static double now_us(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1e6 + ts.tv_nsec / 1e3;
}

int main(void) {
    int ping[2], pong[2];
    char b = 'x';
    if (pipe(ping) || pipe(pong)) { perror("pipe"); return 1; }

    cpu_set_t one;                      // run on core 0 only;
    CPU_ZERO(&one);                     // the child inherits this
    CPU_SET(0, &one);
    if (sched_setaffinity(0, sizeof one, &one)) { perror("affinity"); return 1; }

    pid_t pid = fork();
    if (pid < 0) { perror("fork"); return 1; }
    if (pid == 0) {                     // child: send every byte back
        for (int i = 0; i < ROUNDS; i++)
            if (read(ping[0], &b, 1) != 1 || write(pong[1], &b, 1) != 1) _exit(1);
        _exit(0);
    }

    double t0 = now_us();
    for (int i = 0; i < ROUNDS; i++)
        if (write(ping[1], &b, 1) != 1 || read(pong[0], &b, 1) != 1) { perror("io"); return 1; }
    double t1 = now_us();
    waitpid(pid, NULL, 0);

    struct rusage ru;
    getrusage(RUSAGE_SELF, &ru);
    printf("round trip: %.2f us (2 switches + 4 system calls)\n", (t1 - t0) / ROUNDS);
    printf("parent: %ld voluntary, %ld involuntary switches\n", ru.ru_nvcsw, ru.ru_nivcsw);
    return 0;
}
```

Example output (numbers vary a lot with the CPU, the kernel and its security settings):

```text
round trip: 2.92 us (2 switches + 4 system calls)
parent: 57814 voluntary, 42187 involuntary switches
```

Each round trip holds two context switches and four small system calls. So one switch costs at most half the
round trip, here under 1.5 µs. The parent gives up the core about 100,000 times, once per round.

Look at how those switches split. A switch is voluntary when the parent blocks in `read`. It is involuntary
when the child, woken by the parent's `write`, preempts the parent before it reaches `read`. How eagerly a
woken thread preempts depends on the kernel's rules, so the split changes between kernel versions. The output
above came from a 6.18 kernel.

::: details Going deeper: variations to try
- Remove the `sched_setaffinity` call. Parent and child can now run on two cores. The round trip changes,
  because a wake-up on another core needs an interrupt between cores, and an idle core may need time to wake.
- `perf bench sched pipe` runs the same experiment.
- Run `perf stat -e context-switches,cpu-migrations ./pingpong` to count switches and moves between cores.
:::

## CPU affinity, pinning and isolation

**In short:** you can restrict which cores a thread may run on. Pinning keeps caches warm and latency
predictable, but gives up the balancer's flexibility.

<Term id="cpu-affinity">CPU affinity</Term> is the set of cores a thread is allowed to run on. By default, it
is all of them. You can change it:

```bash
taskset -c 2,3 ./server      # start a program on cores 2 and 3 only
taskset -pc 4 <pid>          # move a running process to core 4
```

In code, `sched_setaffinity()` does the same. Containers do it with the **cpuset** controller of
<Term id="cgroup">cgroups</Term>, for example `docker run --cpuset-cpus=2,3`.

**Why pin a thread:**

- Its data stays in one core's cache.
- It stays near its memory on a NUMA machine, or near a network card or GPU.
- The balancer does not move it around, so its latency is more predictable.

**The cost:** the thread can only use its own cores. If they are busy, it waits, even when other cores are
idle. Pinning many threads to overlapping cores by hand often works worse than the kernel's balancer.

### Isolating cores for latency-critical work

Pinning keeps your thread on a core. It does not keep **other** work off that core. For the lowest and most
predictable latency, you also clear the core of everything else:

- **Keep other threads away.** The `isolcpus=` boot option, or a cgroup v2 cpuset partition, removes cores
  from normal scheduling. Only threads explicitly pinned there run on them.
- **Move device interrupts away**, by setting their affinity to other cores.
- **Stop the timer tick** with `nohz_full=` on cores that run only one thread.

Trading systems, packet-processing loops (DPDK) and audio engines do this. Often the pinned thread polls in a
loop and never blocks, so it never pays for a wake-up. It is a trade: those cores are reserved and stay busy
even when there is no work.

::: details Going deeper: the isolation checklist
- `isolcpus=` removes cores from load balancing at boot. Cpuset partitions (`cpuset.cpus.partition` set to
  `isolated`) can do similar work at run time.
- Interrupt affinity lives in `/proc/irq/<n>/smp_affinity_list`. Stop or configure `irqbalance` so it does not
  undo your settings.
- `nohz_full=` needs exactly one runnable thread on the core to stop the tick. `rcu_nocbs=` moves some kernel
  housekeeping work off those cores.
- Kubernetes can give a pod exclusive cores with the static CPU manager policy. The pod must request whole
  CPUs, with requests equal to limits.
:::

## CPU limits in containers

**In short:** containers have two CPU controls. A weight shares the CPU when it is contended. A quota is a
hard budget per period. When a container spends its budget early, all its threads stop until the next period,
which causes latency spikes.

Containers get their CPU controls from cgroups. There are two controls, and they behave very differently.

### Weight: a share under contention

`cpu.weight` (default 100) works like `nice` for a whole group. If two containers both want more CPU than
the machine has, one with weight 200 gets twice the CPU of one with weight 100. If the machine has idle CPU,
either container can use it. Nobody is ever stopped for using "too much".

### Quota: a hard budget per period

`cpu.max` holds two numbers: a quota and a period, in microseconds. `200000 100000` means "at most 200 ms of
CPU time in every 100 ms period". That is the same as 2 CPUs, and it is how "a limit of 2 CPUs" is
implemented.

The budget is shared by **all threads of the container**, on all cores. Suppose the container runs 8 busy
threads on a large machine. Together they burn 8 ms of CPU time per millisecond. They spend the 200 ms budget
in 25 ms. Then the kernel stops every thread in the container until the period ends, 75 ms later. This is
<Term id="cpu-throttling">CPU throttling</Term>.

<CpuThrottlingDiagram />

This explains a common production mystery. A service shows **low average CPU use**, well under its limit, but
its **p99 latency has spikes** of tens of milliseconds. Average use is measured over seconds. Throttling
happens within 100 ms windows, during short bursts of work. Garbage collection is a typical burst, because it
often runs many threads at once.

You can see throttling in the container's cgroup directory:

```bash
$ cat /sys/fs/cgroup/<container>/cpu.stat
usage_usec 81234567
nr_periods 36000
nr_throttled 2100         # periods in which the group hit its limit
throttled_usec 95000000   # total time its threads were stopped
```

If `nr_throttled` grows while the service is slow, you have found the cause. Common fixes:

- **Match the thread count to the limit.** Size thread pools and runtime settings for 2 CPUs, not for the
  host's 64.
- **Raise the limit, or remove it.** Many teams keep weights (Kubernetes CPU requests) for fair sharing and
  drop hard limits for latency-sensitive services.
- **Allow short bursts** with `cpu.max.burst` (Linux 5.14 and later), which lets unused budget carry over.

::: details Going deeper: names across versions, and Kubernetes
- In cgroup v1, the same controls are `cpu.shares` (default 1024) and `cpu.cfs_quota_us` with
  `cpu.cfs_period_us`. The mechanism is called **CFS bandwidth control**, and it keeps that name on EEVDF
  kernels.
- The default period is 100 ms. A shorter period shortens each stall but adds overhead.
- The kernel hands out the budget to cores in small pieces (5 ms by default). Kernels before 5.4 had a bug
  that wasted unused pieces, so containers were throttled even when they stayed under their limit. Old
  kernels without the fix may still show this.
- Kubernetes turns a pod's CPU **request** into a cgroup weight and its CPU **limit** into `cpu.max`.
:::

### The GOMAXPROCS problem

Language runtimes size their thread pools from the number of CPUs they see. Inside a container with a CPU
quota, most of them used to see the **whole host**. On a 64-core machine with a 2-CPU limit, the runtime
starts 64 worker threads. They burn the budget in a few milliseconds, and the container is throttled for most
of each period.

- **Go** sets its number of parallel worker threads with `GOMAXPROCS`. Before Go 1.25, it defaulted to the
  number of cores the process may run on, ignoring the quota. The common fix was Uber's `automaxprocs`
  library, or setting `GOMAXPROCS` by hand. Since Go 1.25, the runtime reads the cgroup CPU limit itself.
- **The JVM** has been container-aware since JDK 10 (backported to 8u191). `Runtime.availableProcessors()`
  then reflects the quota, and garbage collector and thread pool sizes follow it. Very old JVMs do not.
- **Other libraries** often still use the host core count. Examples are many OpenMP-based numeric libraries
  and hand-written thread pools. Set their thread counts explicitly, for example with `OMP_NUM_THREADS`.

Note the difference between the two kinds of limit. A cpuset changes which cores a process sees, so runtimes
notice it. A quota does not change the visible cores, so a runtime must read the cgroup files to know.

## Why this matters in real systems

**Latency spikes in Kubernetes.** The most common scheduling issue in production is throttling. A Java or Go
service with a CPU limit shows p99 spikes, while dashboards show 40% CPU use. `nr_throttled` in `cpu.stat`
confirms it. The fix is to align thread counts with the limit, or remove the limit.

**Thread-per-request servers.** A server with thousands of threads under load has many runnable threads per
core. Each request then waits in run queues and pays for switches and cold caches. This is a main reason for
event loops, async runtimes and connection pools. Go and Rust async runtimes switch tasks in user space, which
saves only a few registers and never enters the kernel. PostgreSQL uses one process per connection, so
deployments often put a pooler such as PgBouncer in front of it.

**ML training and data loading.** Data-loader workers, the Python main thread and the threads that feed the
GPU all compete for cores. Too many OpenMP threads per worker can oversubscribe the machine badly. Pinning GPU
feeder threads to cores on the same NUMA node as the GPU helps keep the GPU busy.

**Low-latency systems.** Trading engines and packet processors isolate cores, pin one polling thread per core,
move interrupts away and turn off the tick. They trade whole cores for predictable microsecond latency.

**Virtual machines.** In a VM, your "CPU" is a thread on the host, which has its own scheduler. `top` shows
**steal time** (`st`): time your virtual CPU was ready but the host ran something else. High steal time means
noisy neighbours, not a problem in your code.

**How to measure it:**

```bash
vmstat 1                                  # r: runnable threads; cs: switches/s
pidstat -w -t -p <pid> 1                  # voluntary / involuntary switches per thread
cat /proc/<pid>/schedstat                 # ns on CPU, ns waiting in a run queue, number of slices
perf stat -e context-switches,cpu-migrations -p <pid>
perf sched record -- sleep 5; perf sched latency   # how long threads waited to run
runqlat                                   # (bcc/bpftrace) histogram of run-queue waiting time
cat /sys/fs/cgroup/<group>/cpu.stat       # throttling
chrt -p <pid>; taskset -pc <pid>          # policy and affinity of a process
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. What does a CPU scheduler try to optimise, and why can't it get everything?
It chooses which ready thread runs on each core, and for how long. Goals include throughput, turnaround time,
response time, fairness, and low overhead.

They conflict. Short time slices give fast response but more switching, so lower throughput. Running the
shortest jobs first gives the best average wait but can starve long jobs. Keeping a thread on one core keeps
its cache warm, but may leave other cores idle.

**Senior add-on:** name the workload. A batch cluster wants throughput; an API server wants tail latency; a
multi-tenant host wants fairness and isolation. The right policy follows from that.
:::

::: details 2. Compare FCFS, SJF and round robin.
**FCFS** runs jobs in arrival order. It is simple, but short jobs wait behind long ones (the convoy effect).

**SJF** runs the shortest job first. It gives the lowest average waiting time, but needs to know job lengths
and can starve long jobs. Its preemptive form, SRTF, also interrupts a running job when a shorter one arrives.

**Round robin** gives each job a time slice in turn. Response time is good and nobody starves. Short slices
waste time on switches. Long slices turn it into FCFS.

**Senior add-on:** round robin can have the **worst** turnaround when all jobs are equal, because they all
finish near the end. Real systems estimate job length from past behaviour, which is what MLFQ does.
:::

::: details 3. How does a multi-level feedback queue work? How could a program game it?
It has several queues with different priorities. It runs the highest non-empty queue, with round robin inside
it. New threads start at the top. A thread that uses its whole allowance moves down. A thread that blocks
early stays up. Periodically, everything moves back to the top so long jobs do not starve.

A program could game a naive version. It would run for almost a whole slice, then block briefly, and stay at
top priority forever. The fix is to count total CPU used at a level, not per slice.

**Senior add-on:** MLFQ approximates SJF without knowing job lengths, by learning from behaviour. The price is
tuning: how many levels, what slice lengths, how often to reset.
:::

::: details 4. How does the Linux scheduler work for normal threads? What changed with EEVDF?
Each thread has a virtual runtime: the CPU time it received, scaled by its weight, which comes from its nice
value. The scheduler runs the thread furthest behind, so the CPU is shared in proportion to weights. Sleeping
threads fall behind, so they run soon after waking, which keeps interactive work responsive.

CFS (Linux 2.6.23 to 6.5) picked the lowest virtual runtime. Since 6.6, EEVDF picks, among **eligible**
threads (those not ahead of their fair share), the one with the **earliest virtual deadline**. The deadline
comes from the thread's requested slice. Shorter slices mean earlier deadlines: lower latency, same share.

**Senior add-on:** each core has its own run queue, with load balancing across a hierarchy of hardware
threads, shared caches and NUMA nodes. EEVDF replaced many of CFS's wake-up special cases with one rule. Also
mention that real-time threads always run before normal ones.
:::

::: details 5. What happens during a context switch, and what does it cost?
The thread enters the kernel, by blocking or through a timer interrupt. The kernel saves its registers:
general-purpose, instruction and stack pointers, floating-point and vector state. The scheduler picks the next
thread. If it is in another process, the kernel switches the page table. Then it loads the new thread's
registers and returns to user mode.

The direct cost is roughly one to a few microseconds. The indirect cost comes from cold caches, TLB and branch
predictor, and it can be larger than the direct cost.

**Senior add-on:** a switch between threads of the same process is cheaper, because the memory view stays and
TLB entries stay valid. Moving to another core adds cold-cache cost. Vector state can be kilobytes. Some
Spectre protections add work on process switches.
:::

::: details 6. How do you tell whether a service suffers from CPU contention or from blocking?
Look at context switches per thread with `pidstat -w -t` or `/proc/<pid>/status`. Many **involuntary**
switches mean the thread wanted to keep running but was preempted: too many runnable threads, or a CPU limit.
Many **voluntary** switches mean it keeps blocking: locks, small I/O, sleeps.

Also check run-queue waiting time (`/proc/<pid>/schedstat`, `perf sched latency`, `runqlat`), the `r`
column of `vmstat`, and `cpu.stat` for throttling in a container.

**Senior add-on:** confirm with an off-CPU profile, which shows where threads wait, alongside a normal CPU
profile. [Chapter 19](/systems/performance) covers this.
:::

::: details 7. What is the difference between nice and real-time priority? What is the risk of SCHED_FIFO?
Nice changes a normal thread's **share** of CPU when threads compete. A low-priority thread still runs, only
less.

Real-time policies (`SCHED_FIFO`, `SCHED_RR`) are strict. A runnable real-time thread always runs before every
normal thread, and a FIFO thread keeps the core until it blocks or a higher priority wakes.

The risk: a buggy real-time thread in a loop can starve everything else on its core, including system
services. Linux limits real-time threads to 95% of each second by default as a safety net.

**Senior add-on:** real time also brings priority inversion, so locks shared with lower-priority threads
need priority inheritance. For guaranteed CPU budgets, `SCHED_DEADLINE` checks at admission that it can keep
its promises.
:::

::: details 8. Scenario: a service in Kubernetes has p99 spikes of about 100 ms, but CPU use is only 40% of its limit. What is going on?
The likely cause is CPU throttling. A CPU limit is a budget per 100 ms period, shared by all threads. During a
burst, many threads spend the budget in a fraction of the period. Then the whole container is stopped until
the next period, and requests wait. Average CPU use hides this, because it is measured over seconds.

Check `nr_throttled` and `throttled_usec` in the container's `cpu.stat`. Then compare the runtime's thread
count with the limit.

**Senior add-on:** fixes are to size thread pools to the limit (for Go, `GOMAXPROCS`), raise or remove the
limit while keeping requests, or allow bursts with `cpu.max.burst`. Mention the pre-5.4 kernel bug that
throttled containers even under their limit.
:::

::: details 9. A Go service runs fine on a laptop but badly in a container limited to 2 CPUs on a 64-core host. Why?
Before Go 1.25, the Go runtime set `GOMAXPROCS` to the number of cores it could see: 64. A CPU quota does not
hide cores. So up to 64 threads ran Go code and garbage collection in parallel. They used the 2-CPU budget
in a few milliseconds of each period and were then throttled.

Fix it by setting `GOMAXPROCS=2`, using `automaxprocs`, or upgrading to Go 1.25 or newer, which reads the
cgroup limit.

**Senior add-on:** the same issue affects any runtime or library that sizes pools from the host's core count:
old JVMs, OpenMP, custom thread pools. A cpuset limit does not have this problem, because it changes the set
of visible cores.
:::

::: details 10. When would you pin threads to cores or isolate cores? What does it cost?
Pin when cache warmth, NUMA locality or predictable latency matter more than flexibility. Examples are a
packet-processing loop, a trading engine, or a thread feeding a GPU. For the best latency, also isolate the
cores: keep other threads off them, move device interrupts away, and stop the timer tick.

The cost: pinned threads cannot use idle cores elsewhere, and isolated cores sit reserved even when idle. Bad
manual pinning can be worse than the kernel's balancer.

**Senior add-on:** name the tools: `taskset` or `sched_setaffinity`, cpusets, `isolcpus`, `nohz_full`, IRQ
affinity, and the Kubernetes static CPU manager.
:::

::: details 11. The load average is 40 on a 16-core machine. Is the CPU overloaded?
Not necessarily. On Linux, the <Term id="load-average">load average</Term> counts threads that are runnable
**plus** threads in uninterruptible sleep, which usually means waiting for disk or for some kernel locks. A
load of 40 can come from threads stuck on slow storage while the CPUs are mostly idle.

Check `vmstat 1`: the `r` column shows runnable threads, and `b` shows blocked ones. Compare CPU idle time
with I/O wait. Also look at `/proc/pressure/cpu` and `/proc/pressure/io`, which show how much time tasks
waited for each resource.

**Senior add-on:** other Unix systems count only runnable threads. Linux added uninterruptible threads in
1993, so that the load also reflects demand for disks.
:::

## Common misconceptions

- **"A higher nice value makes a thread wait longer to start."** Nice mainly changes the CPU **share** under
  contention. On an idle machine it has no effect.
- **"Real-time priority makes code faster."** It makes waiting shorter and more predictable. The code itself
  runs at the same speed.
- **"A CPU limit of 2 means the container can use 2 cores at any moment."** It means 2 cores' worth of time
  per period. Eight threads can use it all in a quarter of the period and then stop.
- **"Linux uses CFS."** Kernels from 6.6 on pick normal threads with EEVDF, though much of the CFS machinery
  and its name remain.
- **"A context switch costs a few microseconds, so it is cheap."** The cold caches it leaves behind often cost
  more than the switch itself.
- **"More threads means more throughput."** Beyond about one busy thread per core, extra runnable threads add
  switching and cache misses, not work.

## Key takeaways

- The scheduler picks among **runnable** threads, per core. Throughput, response time and fairness pull in
  different directions.
- Linux shares the CPU by **weighted virtual runtime**. CFS picked the thread furthest behind (2.6.23–6.5);
  **EEVDF** adds eligibility and deadlines (6.6+).
- A **context switch** costs microseconds directly, plus cold caches, TLB and branch predictor afterwards.
  Involuntary switches point to CPU contention; voluntary ones point to blocking.
- **Real-time policies** always beat normal threads; `nice` only changes shares.
- A container **CPU limit** is a budget per period. Bursts cause **throttling** and p99 spikes; match thread
  counts (`GOMAXPROCS`) to the limit.

## Review

<Flashcards id="scheduling" :cards="cards" />

<MarkDone id="scheduling" />
