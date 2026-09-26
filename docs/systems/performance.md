---
title: 19. Performance & Debugging
---

<script setup>
import { cards } from './performance-review'
</script>

# 19. Performance & Debugging

This chapter is about finding out why a system is slow, using one repeatable method instead of guessing with
random tools. "The service got slower; how would you find out why?" is one of the most common senior interview
questions. It is graded on method as much as on knowledge.

::: info Before you start
- A <Term id="process">process</Term> runs one or more <Term id="thread">threads</Term>. The kernel's
  <Term id="scheduler">scheduler</Term> decides which thread runs on each CPU core. Threads that are ready but
  not running wait in a **run queue** ([Chapter 8](/cpu/scheduling)).
- Programs ask the kernel for services through <Term id="syscall">system calls</Term>
  ([Chapter 1](/foundations/what-is-an-os)).
- Earlier chapters describe many causes of slowness: page faults, cache misses, reclaim, lock contention, CPU
  throttling. This chapter is about **finding** which one you have. It links back to them.
:::

## The method in one page

**In short:** define the problem precisely, check every resource for overload, then find where the time goes:
running on a CPU, or waiting. Change one thing and measure again.

Performance work goes wrong in a predictable way. Someone sees a slow service, remembers the last problem they
fixed, and tunes that. Sometimes it works. Often it changes nothing, or makes things worse, and nobody can say
why. Interviewers have seen this many times, which is why they ask about method.

This chapter follows one method, in five steps:

1. **Define the problem.** Which metric, how bad, since when, for whom, and what changed?
2. **Check every resource with the USE method.** For each resource, is it busy, overloaded, or failing?
3. **Split the time: on-CPU or off-CPU?** Is the slow work running on a CPU, or waiting for something?
4. **Drill down.** Profile on-CPU time with `perf` and flame graphs. Trace off-CPU time to find what threads
   wait for.
5. **Fix one thing and measure again**, with the same metric as step 1.

The steps narrow the search from the whole system down to one resource, then to one code path. Each step has
a small set of tools, described in the sections below.

## Step 1: define the problem

**In short:** "it is slow" is not a problem statement. Pin down the metric, the percentile, the time it started
and what changed, before touching any tool.

Ask these questions first. They often solve the problem on their own:

- **What exactly is slow?** Request latency, throughput, a batch job's run time, or startup?
- **How is it measured?** Averages hide most problems. Look at percentiles (explained below).
- **Since when?** A sudden change points to an event: a deploy, a config change, a traffic shift, a noisy
  neighbour. A slow drift points to growth: more data, a leak, fragmentation.
- **Who is affected?** All requests, or one endpoint, one customer, one host, one availability zone?
- **What changed?** Code, dependencies, kernel, instance type, traffic mix, data size.

### Percentiles and tail latency

Suppose 99 requests take 10 ms and one takes 1 second. The average is about 20 ms, which describes no real
request. **Percentiles** describe the distribution instead. The 50th percentile (p50, the median) is the time
that half the requests beat. The 99th percentile (p99) is the time that 99% of requests beat.

The slow end of the distribution, p99 and above, is the <Term id="tail-latency">tail latency</Term>. It
matters more than it seems. A user's page load may make dozens of requests, so most users hit the tail
regularly. The tail is also where OS effects show up first: page faults, reclaim stalls, lock waits, CPU
throttling. A later section explains why tails exist.

## Step 2: the USE method

**In short:** for every resource, check utilization (how busy), saturation (how much work is waiting) and
errors. It finds the overloaded resource quickly and makes sure you do not skip one.

The <Term id="use-method">USE method</Term>, from Brendan Gregg, is a checklist. List the system's resources:
CPUs, memory, disks, network interfaces, and software resources such as locks and thread pools. For each one,
check three things:

- **Utilization:** the share of time the resource was busy. A disk busy 90% of the time.
- **Saturation:** extra work that has to wait because the resource is busy. Threads in the run queue, requests
  queued on the disk. Saturation is where latency comes from.
- **Errors:** failures such as dropped packets, disk errors, or memory allocation failures. They are cheap to
  check and often overlooked.

Here is where to look on Linux:

| Resource | Utilization | Saturation | Errors |
|---|---|---|---|
| **CPU** | `mpstat -P ALL 1`: busy % per core | `vmstat 1`: `r` (run queue) above core count; CPU PSI; cgroup throttling | rare; machine-check logs in `dmesg` |
| **Memory** | `free`: "available" low | PSI memory; swapping (`vmstat` `si`/`so`); direct reclaim | OOM kills in `dmesg` |
| **Disk** | `iostat -xz 1`: `%util` | `iostat`: `aqu-sz` (queue length), `await` rising; I/O PSI | `dmesg`, SMART errors |
| **Network** | `sar -n DEV 1`: throughput vs link speed | drops, retransmits: `nstat`, `ss -ti` | `ip -s link`: errors, drops |
| **Software** | thread pool or connection pool in use | requests queued for a pool or lock | timeouts, rejected work |

A few rules for reading these:

- **Look per core and per device, not only totals.** One core at 100% while the rest sit idle shows up as
  low average CPU. A single-threaded bottleneck hides this way.
- **Saturation matters more than utilization.** A resource can be 60% busy on average and still queue work
  heavily during bursts.
- **Utilization lies for some devices.** An SSD can serve many requests at once. Its `%util` means "busy at
  least part of each interval", so 100% does not mean it is full.

::: tip The first 60 seconds on a Linux host
Brendan Gregg's well-known checklist covers most of the USE table in a minute:

```bash
uptime                 # load averages: rising or falling?
dmesg -T | tail        # OOM kills, disk errors, network errors
vmstat 1               # run queue, swap, CPU split
mpstat -P ALL 1        # per-core busy: one hot core?
pidstat 1              # which processes use CPU
iostat -xz 1           # per-disk utilization, queue, latency
free -m                # available memory
sar -n DEV 1           # network throughput per interface
sar -n TCP,ETCP 1      # connections, retransmits
top                    # overall check
```

Add `cat /proc/pressure/{cpu,memory,io}` for PSI, which measures time lost waiting for each resource
([Chapter 5](/memory/kernel-memory)).
:::

## Where time goes: on-CPU and off-CPU

**In short:** a request's latency is time running on a CPU plus time waiting. CPU profilers only see the first
part. Finding what threads wait for needs different tools.

Follow one slow request through a server. It runs some code, then waits for a lock, then runs more code. Next it
waits for a disk read, and then for a free core. Finally it runs the code that sends the reply.

<OnOffCpuDiagram />

Two kinds of time make up its latency:

- **On-CPU time:** the thread is running instructions. Slow code, cache misses and page faults all show up
  here.
- **Off-CPU time:** the thread is not running. It is blocked on a lock, a disk read, a network reply, a sleep,
  or it is ready but waiting for a core.

The split tells you which tools to use next. A quick check: compare a thread's CPU time with its wall-clock
time. If a request takes 200 ms of wall time but uses 20 ms of CPU, then 90% of it is off-CPU. Profiling CPU
time will not find the problem.

`pidstat -u 1` shows CPU use per process; `pidstat -w 1` shows how often threads block and give up the CPU,
which hints at off-CPU time.

## Step 3: profiling on-CPU time with perf

**In short:** a sampling profiler interrupts each CPU many times a second and records the call stack that was
running. Functions that appear in many samples are where CPU time goes. Flame graphs make the result readable.

### Sampling

You could time every function call, but that would slow the program down a lot and distort the results.
Instead, a <Term id="sampling-profiler">sampling profiler</Term> interrupts each CPU at a fixed rate, for
example 99 times a second. Each time, it records which function was running and the chain of calls that led
to it, the **stack trace**. After 30 seconds, a function that used 40% of the CPU appears in about 40% of the
samples. The overhead is small, so it is safe to use in production.

On Linux, the standard tool is `perf`. It samples both user code and kernel code.

### Try it: profile a program

This program imitates a server: for each "request" it parses a buffer, then does 16 random lookups in a
512 MiB table:

```c
// hot.c: gcc -O2 -g -fno-omit-frame-pointer hot.c -o hot && ./hot
#include <stdio.h>
#include <stdlib.h>

#define TABLE (64UL << 20)                   // 64 Mi entries, 512 MiB

__attribute__((noinline, noclone))
static unsigned long parse(const unsigned char *buf, int n) {
    unsigned long sum = 0;                   // stands in for request parsing
    for (int i = 0; i < n; i++)
        sum = sum * 31 + buf[i];
    return sum;
}

__attribute__((noinline, noclone))
static unsigned long lookup(const unsigned long *table, unsigned long key) {
    unsigned long v = 0;                     // stands in for an index lookup:
    for (int i = 0; i < 16; i++) {           // 16 random reads, mostly cache misses
        key = key * 6364136223846793005UL + 1442695040888963407UL;
        v += table[key % TABLE];
    }
    return v;
}

int main(void) {
    unsigned long *table = malloc(TABLE * sizeof *table);
    unsigned char buf[2048];
    if (!table) return 1;
    for (unsigned long i = 0; i < TABLE; i++) table[i] = i;
    for (int i = 0; i < 2048; i++) buf[i] = (unsigned char)i;

    unsigned long total = 0;
    for (unsigned long req = 0; req < 3000000; req++) {   // handle 3 million "requests"
        buf[req % 2048] = (unsigned char)req;           // each request differs
        total += parse(buf, 2048);
        total += lookup(table, req);
    }
    printf("%lu\n", total);
    return 0;
}
```

Record a profile with call stacks (`-g`), sampling 999 times a second, and print a summary:

```text
$ perf record -F 999 -g ./hot
$ perf report --no-children --sort symbol
    56.93%  [.] parse
    21.50%  [.] lookup
    18.67%  [k] clear_page_erms
     0.60%  [.] main
     0.47%  [k] do_user_addr_fault
```

`[.]` marks user code and `[k]` marks kernel code. Three things stand out:

- **`parse` uses most of the time**, even though `lookup` is the part that misses the cache. Its 2,048 steps
  per request add up. Guessing would likely have pointed at `lookup`.
- **Almost a fifth of the time is in the kernel**, clearing pages. That is the program's first write to its
  512 MiB table: each new page causes a page fault, and the kernel fills a fresh page with zeros
  ([Chapter 4](/memory/virtual-memory)). A real service pays this at startup, or on its first requests.
- **`main` itself is almost free.** All the cost is in what it calls.

Your percentages will differ with the CPU and the run.

### Flame graphs

A text report is hard to read once the program has thousands of call paths. A
<Term id="flame-graph">flame graph</Term> draws all the sampled stacks at once:

<FlameGraphDiagram />

- Each box is a function. The box below it is its caller.
- The **width** of a box is the share of samples in which that function was on the stack. Wide boxes are
  where time goes, including everything they call.
- The order from left to right is alphabetical. It does **not** show time passing.
- Look for wide boxes near the top ("plateaus"): functions that use the CPU themselves, not only through
  their children.

To make one, collect stacks with `perf record -g`, then run `perf script` and pass the output through Brendan
Gregg's FlameGraph scripts. Many profilers and continuous-profiling services draw them directly.

::: warning Broken stacks
Profiles are only useful if the stacks are complete and have names. Common problems:
- **Missing frame pointers.** Compilers often use the register that marks each call's stack frame for other
  work, which breaks stack walking. Build with `-fno-omit-frame-pointer`, or use `perf record --call-graph
  dwarf`. Some distributions, including Fedora and Ubuntu 24.04, now build their packages with frame
  pointers for this reason.
- **Missing symbols.** Stripped binaries show only addresses. Keep debug symbols available.
- **JIT-compiled code** (Java, Node.js, Python 3.12+) needs the runtime to publish a map of its generated code,
  for example with a `perf-<pid>.map` file.
:::

### Counting events with perf stat

`perf stat` does not sample. It counts events for the whole run: CPU time, context switches, page faults,
and, where the CPU exposes them, hardware counters such as cycles, instructions and cache misses.

The most useful derived number is **instructions per cycle (IPC)**. A modern core can finish several
instructions per cycle. An IPC well below 1 usually means the core spends most of its time waiting for memory
([Chapter 7](/memory/caches-and-numa)). An IPC of 2 or more means the code keeps the core busy, and speedups
must come from doing less work.

Hardware counters are often unavailable inside cloud virtual machines. There, `perf stat` prints
`<not supported>` for them. Software events, such as CPU time and page faults, still work.

## Step 4: off-CPU analysis

**In short:** to explain time spent waiting, record where threads block and for how long. eBPF tools do this
with low overhead by running small programs inside the kernel.

If the time is off-CPU, the question becomes: **what are threads waiting for, and from which code?** The
kernel knows the answer. Every time a thread blocks, the scheduler takes it off the CPU, and every time it
becomes runnable again, the scheduler notes it. **Off-CPU analysis** records these events together with the
thread's stack. The result shows, for example, "40% of wall time is spent in `pthread_mutex_lock` called from
`cache_get`", or "in `read` from `load_config`, on every request".

### eBPF: small programs inside the kernel

Recording every scheduler event from user space would be far too slow. Modern Linux solves this with
<Term id="ebpf">eBPF</Term>. It lets you load a small program into the kernel and attach it to an event, such
as "a thread is switched out" or "a disk request completes". The kernel checks the program first to make sure
it cannot crash or hang the kernel. The program runs in the kernel on each event and summarises the data there,
for example into a histogram. Only the summary goes to user space.

The overhead is low enough for production. Two families of tools use it:

- **Ready-made tools** from the BCC and libbpf-tools projects. `offcputime` records off-CPU stacks and can
  feed an off-CPU flame graph. `runqlat` shows how long threads wait in the run queue. `biolatency` shows disk
  I/O latency as a histogram. `execsnoop` lists new processes. `tcpretrans` shows TCP retransmits.
- **bpftrace**, a small language for one-line questions:

```bash
# Which processes make the most system calls?
bpftrace -e 'tracepoint:raw_syscalls:sys_enter { @[comm] = count(); }'

# Histogram of read() latency for one process
bpftrace -e 'tracepoint:syscalls:sys_enter_read /pid == 1234/ { @s[tid] = nsecs; }
  tracepoint:syscalls:sys_exit_read /@s[tid]/ { @us = hist((nsecs - @s[tid]) / 1000); delete(@s[tid]); }'
```

### strace and ltrace

<Term id="strace">`strace`</Term> shows every system call a process makes, with arguments, results and, with
`-T`, the time spent in each. `strace -c` gives a summary table. It answers questions like "is it waiting on a
file, a socket or a lock?" in seconds.

But `strace` stops the traced process on every system call, so it can make it many times slower
([Chapter 1](/foundations/what-is-an-os)). Use it on test systems or briefly, not on a busy production
process. `perf trace` and eBPF tools show similar information at far lower cost.

`ltrace` does the same for calls into shared libraries, such as `malloc` or `strlen`. It is even slower.

### Common off-CPU causes and where to look

- **Locks:** threads sleep in `futex` system calls. Off-CPU stacks show which lock and which caller.
  [Chapter 9](/cpu/concurrency-1) covers lock contention.
- **Disk:** threads block in `read`, `fsync` or major page faults. Check `biolatency` and `iostat`.
- **Network:** threads wait for replies from other services. Off-CPU stacks show which call. Distributed tracing
  shows which downstream service is slow.
- **Run queue:** threads are ready but wait for a core. Check `runqlat`, CPU PSI and cgroup throttling
  ([Chapter 8](/cpu/scheduling)).
- **Memory:** threads stall in direct reclaim or swap-in. Check memory PSI and `/proc/vmstat`
  ([Chapter 5](/memory/kernel-memory)).

## Reasoning about tail latency

**In short:** tails come from queueing and from rare stalls. Queues grow sharply as a resource nears full use,
and requests that fan out to many servers almost always hit someone's tail.

### Queues explode near full utilization

Every resource with a queue in front of it, such as a CPU, a disk or a thread pool, behaves like a checkout
line. When the cashier is idle half the time, customers rarely wait. When the cashier is busy 95% of the time,
the line is long, and small bursts make it much longer.

<QueueingDiagram />

In the simplest queue model, the average wait is `busy / (1 − busy)` times the time to serve one request. At
50% busy, that is 1 service time. At 90% it is 9, and at 95% it is 19. Real systems do not follow the formula
exactly, but they have the same shape. This is why services keep headroom and why saturation, not
utilization, predicts latency.

### Fan-out multiplies the tail

A request to a search or feed service may call 100 backend servers in parallel and wait for all of them.
Suppose each backend is slow on 1% of requests. The chance that at least one of the 100 is slow is
`1 − 0.99^100`, about 63%. **Most** user requests now see a backend's p99.

This is the point of the well-known paper *The Tail at Scale* (Dean and Barroso, 2013). At scale, rare slowness
in components becomes common slowness for users. Mitigations include:

- **Hedged requests:** if a backend has not answered within its p95 time, send the same request to another
  replica and use whichever answers first.
- **Tight timeouts and partial results:** answer with 98 of 100 backends rather than wait for the last two.
- **Removing stall sources** in each component: garbage collection pauses, reclaim, throttling, noisy
  neighbours.

### Where OS-level tails come from

Many earlier chapters describe rare stalls that barely move the average but dominate p99 and p999:

- CPU quota throttling in containers, and run-queue waits ([Chapter 8](/cpu/scheduling)).
- Direct reclaim, swap-in and major page faults ([Chapter 5](/memory/kernel-memory)).
- Huge page compaction and `fork` of large processes ([Chapter 4](/memory/virtual-memory)).
- Lock holders being descheduled while others wait ([Chapter 9](/cpu/concurrency-1)).
- Write-back stalls and `fsync` ([Chapter 13](/io/file-systems)), and steal time on virtual machines
  ([Chapter 18](/systems/virtualization)).

### Measuring tails correctly

- **Record histograms, not averages.** Keep a latency histogram per interval, so percentiles can be computed
  and combined correctly.
- **Never average percentiles.** The average of ten hosts' p99 values is not the fleet's p99. Merge the
  histograms instead.
- **Beware coordinated omission.** A load generator that waits for each response before sending the next
  request sends fewer requests exactly when the server stalls. The stall hides from the results. Use tools
  that send at a fixed rate and measure from the intended send time, such as `wrk2`.

## Latency numbers every engineer should know

**In short:** knowing rough costs lets you check whether a result makes sense. The ratios matter more than the
exact values, which change with each hardware generation.

| Operation | Rough time |
|---|---|
| L1 cache hit | about 1 ns |
| Branch mispredict | a few ns |
| L3 cache hit | about 10–40 ns |
| Uncontended mutex lock and unlock | tens of ns |
| Main memory access | about 100 ns |
| System call (simple) | about 100 ns |
| Minor page fault | about 1 µs |
| Context switch | about 1–5 µs, plus cold caches afterwards |
| Read 1 MB sequentially from memory | tens of µs |
| Random 4 KiB read from an NVMe SSD | about 100 µs |
| Round trip inside one data centre | tens to hundreds of µs |
| Read 1 MB sequentially from an SSD | hundreds of µs to about 1 ms |
| Hard disk seek | about 5–10 ms |
| Round trip across a continent or ocean | about 50–150 ms |

Use them for quick estimates. A service doing 16 main-memory lookups per request spends about 1.6 µs on them.
A request that makes 5 sequential calls to another service in the same data centre spends at least a
millisecond on round trips. If a measurement disagrees with such an estimate by 100 times, question the
measurement first.

## A worked example

Here is the method applied to a typical case. The details are illustrative.

**The report.** After a Tuesday deploy, the p99 latency of an API rose from 40 ms to 120 ms. p50 barely moved.
Throughput is unchanged.

**Step 1: define.** Only the tail moved, so look for something intermittent, not uniformly slower code. It
started with the deploy, on all hosts. The new version added a response cache and upgraded a JSON library.

**Step 2: USE.** CPU is 45% busy on average, but `cpu.stat` in the container's cgroup shows `nr_throttled`
rising sharply since the deploy. Memory, disk and network look normal. CPU saturation is the lead.

**Step 3: on-CPU or off-CPU?** Slow requests take much longer in wall time than in CPU time, so they spend the
extra time off-CPU. `runqlat` and the throttling counters agree: threads are waiting for CPU, not for I/O.

**Step 4: drill down.** A CPU flame graph compared before and after the deploy shows a new wide box: the new
JSON library building a large object on every cache hit. The extra CPU per request makes the service's threads
use up its CPU quota early in each 100 ms period. Requests arriving in the rest of the period wait.

**Step 5: fix and verify.** Revert the library, and raise the CPU limit to leave headroom. p99 returns to
40 ms. The team adds throttling to its dashboards.

## Why this matters in real systems

**Continuous profiling.** Large companies sample CPU stacks on every production host all the time, at a low
rate, and store them. When a regression appears, they compare flame graphs from before and after instead of
reproducing the problem. Google-Wide Profiling is a well-known example, and open-source tools such as Parca and
Pyroscope do the same.

**GPU training that is not GPU-bound.** An ML training job shows the GPUs busy only half the time. The GPU
looks like the bottleneck but is waiting. USE on the host shows the data loader's CPUs saturated, or the disk
serving training data at its limit. Profiling the input pipeline, not the model, finds the fix.

**The hidden single-threaded bottleneck.** A 32-core server shows 10% CPU and cannot handle more traffic.
Per-core `mpstat` shows one core at 100%: a single thread handles all network interrupts, or all requests pass
through one event loop thread. Averages hid it.

**Off-CPU surprises.** A service is slow, and its CPU flame graph shows nothing unusual. An off-CPU flame graph
shows most time in a logging library's `write` call under a lock: one slow disk was blocking every request
that logged a line.

**How to measure it:**

```bash
perf record -F 99 -g -p <pid> -- sleep 30    # sample one process's stacks for 30 s
perf report                                  # browse the profile
perf stat -p <pid> -- sleep 10               # counts: CPU time, switches, faults, IPC
perf trace -s -p <pid>                       # system call summary, lower overhead than strace
offcputime -p <pid> 30                       # off-CPU stacks (BCC / libbpf-tools)
runqlat 10 1                                 # run-queue wait histogram
biolatency 10 1                              # disk latency histogram
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. A service's latency went up. Walk me through how you would investigate.
1. **Define it:** which metric and percentile, since when, which hosts or endpoints, and what changed.
2. **USE method:** for CPU, memory, disk, network and software pools, check utilization, saturation and errors.
   This points at a resource.
3. **On-CPU or off-CPU:** compare CPU time with wall time for slow requests.
4. **Drill down:** CPU flame graph for on-CPU time; off-CPU stacks, run-queue latency, I/O latency for waits.
5. **Fix one thing** and confirm with the metric from step 1.

**Senior add-on:** say what you would rule out cheaply first (recent deploys, `dmesg`, throttling counters,
steal time), and that you would compare before and after profiles rather than read one in isolation.
:::

::: details 2. What is the USE method?
A checklist: for every resource, check **Utilization** (share of time busy), **Saturation** (work waiting
because the resource is busy) and **Errors**. Resources include CPUs, memory, disks, network interfaces and
software resources such as locks and thread pools.

Its value is that it is complete: you do not skip a resource because you did not think of it.

**Senior add-on:** saturation predicts latency better than utilization. Look per core and per device, since
totals hide single hot resources. SSD `%util` is misleading because the device works in parallel.
:::

::: details 3. How does a sampling profiler work, and how do you read a flame graph?
It interrupts each CPU at a fixed rate, such as 99 times a second, and records the running call stack. Functions
that appear in more samples used more CPU time. Overhead is low, so it is safe in production.

In a flame graph, each box is a function and the box below it is its caller. Width is the share of samples.
Left-to-right order is alphabetical, not time. Look for wide boxes, especially wide tops, which use CPU
themselves.

**Senior add-on:** stacks need frame pointers or DWARF unwinding, and symbols. JIT runtimes need perf maps. A
sampling rate like 99 Hz avoids running in step with periodic activity in the program.
:::

::: details 4. What is off-CPU analysis, and when do you need it?
It measures time threads spend **not** running: blocked on locks, disk, network or sleeps, or waiting in the run
queue. CPU profilers cannot see this time at all.

You need it when wall time is much larger than CPU time, for example a 200 ms request that uses 20 ms of CPU.
Tools record where threads block, with stacks, and how long they wait: `offcputime`, off-CPU flame graphs,
`runqlat`, `biolatency`.

**Senior add-on:** these tools use eBPF, which runs verified programs in the kernel on scheduler events and
aggregates there, so the overhead stays low.
:::

::: details 5. Why is strace dangerous in production? What would you use instead?
It uses the kernel's debugging interface to stop the traced process on every system call and report it. A
process making many system calls can slow down many times, which can cause an outage.

Instead, use `perf trace`, or eBPF tools and bpftrace, which collect the same events inside the kernel with
far less overhead.

**Senior add-on:** `strace -c` for a few seconds on one process can still be acceptable. Know the cost before
you use it.
:::

::: details 6. Why does latency rise sharply as utilization approaches 100%?
Requests arrive in bursts. When a resource is nearly always busy, each burst queues behind the previous one, and
the queue takes long to drain. In the simplest model, the wait is `busy / (1 − busy)` service times: 1 at 50%,
9 at 90%, 19 at 95%.

**Senior add-on:** that is why capacity plans target a utilization well below 100% for latency-sensitive
services, and why saturation metrics (queue lengths, PSI) are better alarms than utilization.
:::

::: details 7. A request fans out to 100 backends. Each has a 1% chance of being slow. What does the user see?
The chance that at least one backend is slow is `1 − 0.99^100`, about 63%. So most user requests are as slow as
the slowest backend's tail. The backends' p99 becomes the user's typical latency.

Mitigations: hedged requests to another replica after a short delay, timeouts with partial results, and
reducing tail latency in each backend.

**Senior add-on:** cite *The Tail at Scale* (Dean and Barroso). Hedging adds only a few percent of load if it
triggers only after the p95 time.
:::

::: details 8. The p99 latency looks fine in your load test but bad in production. What could explain it?
- **Coordinated omission:** a load generator that waits for each reply before sending the next request sends
  fewer requests during stalls, so the stalls hide from the results.
- **Different traffic:** production has a different mix of requests, data sizes and cache hit rates.
- **Different environment:** noisy neighbours, CPU limits, background jobs, garbage collection under real heap
  sizes, cold caches after deploys.
- **Averaged percentiles:** averaging per-host p99 values instead of merging histograms.

**Senior add-on:** use a fixed-rate load generator (such as wrk2), replay real traffic, and compare latency
histograms from production directly.
:::

::: details 9. perf shows high CPU in a function, but making it faster did not reduce latency. Why?
The requests were probably not limited by that CPU time. Common reasons:
- Most of the latency was off-CPU: waiting on locks, I/O or other services.
- The function ran in a background thread, not on the request path.
- The bottleneck was elsewhere, so the saved CPU simply went idle.

**Senior add-on:** check the on-CPU versus off-CPU split for the slow requests first, and profile the request
path specifically, for example with distributed tracing that shows where each request's time goes.
:::

## Common misconceptions

- **"The average latency is fine, so users are fine."** Users feel the tail. Look at p99 and above.
- **"Low CPU utilization means the CPU is not the problem."** One saturated core, or a throttled container, can
  be the bottleneck at low average CPU.
- **"A CPU profile shows where the time goes."** It shows where CPU time goes. Waiting time needs off-CPU
  analysis.
- **"strace is a harmless way to look at production."** It can slow the traced process down severely.
- **"You can average p99s across hosts."** Percentiles do not average. Merge histograms instead.

## Key takeaways

- Use a **method**: define the problem, check resources with **USE**, split **on-CPU from off-CPU**, drill down,
  then change one thing and measure.
- **Saturation** (work waiting) predicts latency better than utilization. Look per core and per device.
- **Sampling profilers and flame graphs** show on-CPU time. **eBPF-based off-CPU analysis** shows waiting time.
- **Tail latency** comes from queueing near full utilization and from rare stalls, and **fan-out** turns
  component tails into common user latency.
- Know rough **latency numbers** to check whether results make sense.

## Review

<Flashcards id="performance" :cards="cards" />

<MarkDone id="performance" />
