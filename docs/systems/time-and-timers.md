---
title: 16. Time & Timers
---

<script setup>
import { cards } from './time-and-timers-review'
</script>

# 16. Time & Timers

Every computer answers two different questions: "what time is it?" and "how long did that take?". Mixing
them up causes negative latencies, timeouts that fire at the wrong moment, and lost writes in distributed
databases, which is why interviewers probe clocks, timers and clock sync.

::: info Before you start
- The <Term id="kernel">kernel</Term> is the core of the OS. Programs ask it for things with
  <Term id="syscall">system calls</Term>, which cost roughly 100 nanoseconds each.
- An <Term id="interrupt">interrupt</Term> is a hardware signal that makes a CPU core stop and run kernel
  code. A timer interrupt is how the kernel takes the CPU back from a running program.
- The <Term id="vdso">vDSO</Term> is a small library the kernel places in every process, so it can read the
  time without a system call.

[Chapter 1](/foundations/what-is-an-os) covers all three. You can follow this chapter without it.
:::

## Two kinds of clock

**In short:** the wall clock tells you the date and time, and can jump when it is corrected. The monotonic
clock only moves forward, and is the one to use for measuring durations and timeouts.

A service logs "request took −3 ms". Nothing is wrong with the service. It measured the request by reading
the time before and after, and in between, the machine's clock was corrected backwards by a few
milliseconds. The code asked the wrong clock.

Linux offers several clocks through `clock_gettime`. Two matter most:

- **The wall clock**, `CLOCK_REALTIME`. It counts seconds since 1 January 1970 (UTC), the **Unix epoch**.
  It is what you show to people and store in logs. But it can be **stepped**: set forwards or backwards by an
  administrator, by time synchronisation software, or at boot.
- **The monotonic clock**, `CLOCK_MONOTONIC`. It counts from an arbitrary starting point, on Linux usually
  boot. Its value means nothing as a date. But it never goes backwards, so the difference between two
  readings is a real duration.

<WallVsMonotonicDiagram />

The rule is short. Use the <Term id="wall-clock">wall clock</Term> for timestamps that people or other
machines read. Use the <Term id="monotonic-clock">monotonic clock</Term> for everything that measures time
passing: latencies, timeouts, rate limits, retry back-off, cache expiry.

Most languages offer both:

| Language | Wall clock | Monotonic clock |
|---|---|---|
| C | `clock_gettime(CLOCK_REALTIME)` | `clock_gettime(CLOCK_MONOTONIC)` |
| Python | `time.time()` | `time.monotonic()`, `time.perf_counter()` |
| Java | `System.currentTimeMillis()` | `System.nanoTime()` |
| Go | `time.Now()` (also carries a monotonic reading) | used automatically by `time.Since` and `Sub` |
| Rust | `SystemTime` | `Instant` |

### The other clocks

Linux has a few more clocks for special cases:

- `CLOCK_BOOTTIME` is monotonic but keeps counting while the machine is suspended. `CLOCK_MONOTONIC` stops
  during suspend. Laptops and phones care; servers rarely suspend.
- `CLOCK_MONOTONIC_RAW` is monotonic and also ignores the small rate corrections that time sync applies
  (explained below). It is useful for measuring the hardware itself.
- `CLOCK_REALTIME_COARSE` and `CLOCK_MONOTONIC_COARSE` return the time as of the last timer interrupt. They
  are a few times cheaper to read, but only accurate to a few milliseconds.
- `CLOCK_PROCESS_CPUTIME_ID` and `CLOCK_THREAD_CPUTIME_ID` count CPU time used, not time passed.

### Try it: reading the clocks

```c
// clocks.c: gcc clocks.c -o clocks && ./clocks
#define _GNU_SOURCE
#include <stdio.h>
#include <time.h>

static void show(const char *name, clockid_t id) {
    struct timespec t, res;
    clock_gettime(id, &t);
    clock_getres(id, &res);
    printf("%-22s %12ld.%09ld s   (resolution %ld ns)\n", name, (long)t.tv_sec, t.tv_nsec, res.tv_nsec);
}

int main(void) {
    show("CLOCK_REALTIME", CLOCK_REALTIME);
    show("CLOCK_MONOTONIC", CLOCK_MONOTONIC);
    show("CLOCK_BOOTTIME", CLOCK_BOOTTIME);
    show("CLOCK_MONOTONIC_COARSE", CLOCK_MONOTONIC_COARSE);
    return 0;
}
```

Output from one run:

```text
CLOCK_REALTIME           1790418796.705776282 s   (resolution 1 ns)
CLOCK_MONOTONIC                4563.786331148 s   (resolution 1 ns)
CLOCK_BOOTTIME                 4563.786331635 s   (resolution 1 ns)
CLOCK_MONOTONIC_COARSE         4563.780501419 s   (resolution 4000000 ns)
```

The wall clock shows about 1.79 billion seconds since 1970. The monotonic clock shows about 76 minutes: the
time since this machine booted. The coarse clock is a few milliseconds behind and has 4 ms resolution. That tells you this
kernel's timer interrupt runs 250 times a second (explained later).

::: details Going deeper: TAI, leap seconds and the epoch
- `CLOCK_REALTIME` follows UTC and ignores leap seconds: every day has exactly 86,400 seconds in Unix time.
  During a leap second, the clock repeats a second or is smeared (see below).
- `CLOCK_TAI` follows International Atomic Time, which has no leap seconds. It is ahead of UTC by 37 seconds
  (since 2017), but only if time sync software has told the kernel the offset. Otherwise it equals
  `CLOCK_REALTIME`.
- A signed 32-bit count of seconds since 1970 overflows in January 2038. 64-bit Linux uses 64-bit `time_t`.
  32-bit systems needed new system calls, added in Linux 5.1, and a rebuild of programs.
:::

## Where time comes from

**In short:** the hardware provides a fast counter that ticks at a steady rate. The kernel converts counter
readings into nanoseconds, using a starting point it updates regularly.

A computer has no built-in knowledge of the time. It has hardware counters driven by a quartz crystal, which
count up at a fixed rate. The kernel's job is to turn "the counter now reads 91,234,567,890" into "it is
10:33:16.705 UTC".

The kernel picks one counter as its <Term id="clocksource">clocksource</Term>. On x86 machines, the best one
is the **time stamp counter (TSC)**: a 64-bit counter in every core, readable with one instruction. On ARM,
the equivalent is the "generic timer" counter. Slower fallbacks exist, such as the HPET, a separate chip that
takes about a microsecond to read.

To tell the time, the kernel keeps a record of the form: "at counter value C, the time was T". It updates
the record regularly, on timer interrupts. To read the time, it computes:

**time now = T + (counter now − C) × (nanoseconds per count)**

When the machine boots, the kernel takes the starting wall-clock time from a battery-backed clock chip, the
**real-time clock (RTC)**. From then on, the counter and the record carry the time forward. Time sync
software, covered later, keeps the result close to true time.

```text
$ cat /sys/devices/system/clocksource/clocksource0/current_clocksource
tsc
$ cat /sys/devices/system/clocksource/clocksource0/available_clocksource
tsc kvm-clock
```

::: details Going deeper: when the TSC can be trusted
- Early TSCs changed speed with the CPU frequency and stopped in deep sleep. Modern x86 CPUs have an
  **invariant TSC**: it ticks at a fixed rate in all power states. `/proc/cpuinfo` shows the flags
  `constant_tsc` and `nonstop_tsc`.
- On machines with several sockets, the TSCs must be synchronised with each other. The kernel checks this at
  boot.
- The kernel's clocksource watchdog compares the TSC against another counter. If they disagree too much, it
  logs "Marking clocksource 'tsc' as unstable" and switches to a slower source. After that, every
  `clock_gettime` may become a real system call.
- Virtual machines often use a paravirtual clock, such as `kvm-clock` on KVM or the Hyper-V clock. The
  hypervisor shares scaling information with the guest so it can still read time fast.
- `rdtsc` reads the TSC directly from user mode in tens of CPU cycles. It is not ordered with nearby
  instructions; benchmarks use `rdtscp` or add a fence instruction. Converting counts to nanoseconds needs the
  TSC frequency, which is not always easy to find, so most code should use `clock_gettime`.
:::

## Reading the time fast

**In short:** `clock_gettime` usually runs entirely in user mode through the vDSO, in tens of nanoseconds. It
reads the kernel's time record from shared memory and the counter from the CPU.

Some programs read the clock millions of times a second: for log timestamps, request timing, tracing and
profiling. A system call each time would cost about 100 nanoseconds plus side effects.

So the kernel places its time record in a read-only page that is mapped into every process. The vDSO's
`clock_gettime` reads the record, reads the TSC, and does the calculation above, without entering the kernel.
[Chapter 1](/foundations/what-is-an-os) measured this: tens of nanoseconds through the vDSO, against about
100 or more for a real system call.

There is one subtlety. The kernel may be updating the record while a program reads it. The vDSO uses a
**sequence counter**: the kernel increments it before and after each update. The reader notes the counter,
reads the record, and checks the counter again. If it changed, or was odd, the reader retries. Readers never
block the kernel, and writes are rare, so retries are rare.

::: warning When reading the time becomes slow
The vDSO only works if the clocksource can be read from user mode, like the TSC. If the kernel falls back to
a source such as HPET or the Xen clock, `clock_gettime` quietly becomes a real system call, costing several
times more. Check `current_clocksource` when a service gets slower after moving to new machines. `strace`
does not show vDSO calls, but it does show the fallback system calls.
:::

## The timer tick

**In short:** the kernel programs a hardware timer to interrupt each core regularly, often 250 or 1000 times a
second. Modern kernels stop this tick on idle cores to save power, and can stop it on busy cores too.

The kernel needs to run regularly even when no program asks it to. It must take the CPU away from a thread
whose turn is over, update its time record, and fire timers that have come due. For this it uses a timer
interrupt on each core, the <Term id="timer-tick">tick</Term>.

The tick rate is a kernel build setting called **HZ**. Common values are 100, 250 and 1000 ticks per second,
so the tick period is 10, 4 or 1 ms. The kernel counts ticks in a variable called **jiffies**. A higher rate
gives finer scheduling and more precise low-resolution timers. It also costs more interrupts and more power.

On each tick, the kernel:

- **Accounts CPU time** to the running thread, and asks the <Term id="scheduler">scheduler</Term> whether
  that thread should be preempted ([Chapter 8](/cpu/scheduling)).
- **Updates the time record** used by `clock_gettime`.
- **Runs expired low-resolution timers** (next section).

### Tickless kernels

A periodic tick wastes energy. An idle core that could sleep deeply for 200 ms is woken 50 or 250 times only
to find nothing to do. On a laptop that drains the battery. In a data centre, it wastes power across thousands
of machines. With many idle virtual machines on one host, it wastes the host's CPU.

<TickModesDiagram />

So Linux has two tickless modes:

- **Tickless idle** (`NO_HZ_IDLE`, the usual default). When a core goes idle, the kernel stops its tick and
  sets the hardware timer to fire only when the next timer is actually due. The core can sleep for a long
  time.
- **Full tickless** (`NO_HZ_FULL`, enabled per core with the `nohz_full=` boot option). The tick also stops
  on a core that runs exactly one thread. That thread then runs without being interrupted every few
  milliseconds. High-frequency trading, telecom and some HPC setups use this, together with pinning threads
  to cores and moving device interrupts elsewhere ([Chapter 8](/cpu/scheduling)).

Full tickless is not free. Entering and leaving the kernel on those cores costs a bit more, because the
kernel must account CPU time at those moments instead of on each tick. At least one core must keep the tick,
for housekeeping.

::: details Going deeper: clock event devices
- The hardware that raises timer interrupts is a **clock event device**. On x86 it is usually the local
  APIC timer in each core, often in TSC-deadline mode: the kernel writes the TSC value at which to interrupt.
  On ARM it is the generic timer.
- Without periodic ticks, the kernel reprograms this device each time it goes idle or the next timer changes.
- `grep LOC /proc/interrupts` shows local timer interrupts per core. On an idle core with tickless idle, the
  count barely grows.
- The kernel starts `jiffies` near the value where a 32-bit counter wraps around, so that wrap-around bugs
  show up five minutes after boot instead of after 49 days.
:::

## Timers: timer wheels and hrtimers

**In short:** the kernel keeps two kinds of timer. Timeouts that are usually cancelled go in a cheap, coarse
timer wheel. Timers that must fire precisely go in high-resolution timers, kept in a sorted tree.

A busy server has a timer for almost everything: a retransmit timer for each TCP connection, an idle timeout
for each keep-alive connection, a timeout for each `poll` call. That can be millions of timers. Most never
fire: the data arrives and the timeout is cancelled. So adding and cancelling must be very cheap. Firing
exactly on time matters less.

### The timer wheel

A <Term id="timer-wheel">timer wheel</Term> works like a row of buckets, one per tick. To add a timer that
expires in 5 ticks, put it in the bucket 5 places ahead of "now". On each tick, move "now" one bucket forward
and run whatever is in that bucket. Adding and removing a timer are constant-time list operations, no matter
how many timers exist.

<TimerWheelDiagram />

A single row of buckets cannot cover hours at one-tick precision. So the wheel has **levels**: the first level
has one bucket per tick, the next one bucket per 8 ticks, the next one per 64 ticks, and so on. A timer due in
10 minutes goes into a coarse bucket, and may fire a little late. That is fine for a timeout that will almost
always be cancelled.

### High-resolution timers

Some timers must be precise: `nanosleep` of 50 microseconds, a periodic 1 ms control loop, the scheduler's own
deadline. For these, Linux has <Term id="hrtimer">high-resolution timers (hrtimers)</Term>.

hrtimers are kept per core, sorted by expiry time in a balanced tree. The kernel programs the hardware timer to
fire at the exact moment the earliest one is due, not at the next tick. Adding one costs a tree insert, more
than a wheel bucket, which is fine for the smaller number of precise timers.

| | Timer wheel | hrtimer |
|---|---|---|
| Used for | Timeouts that are usually cancelled | Timers that must fire on time |
| Precision | One tick or coarser | Close to nanoseconds, limited by hardware and wake-up time |
| Add or cancel | Constant time | A tree insert or remove |
| Examples | TCP retransmit, network timeouts | `nanosleep`, `timerfd`, POSIX timers, scheduler |

### Timer slack: why your sleep is late

Ask Linux to sleep 50 microseconds and you usually get more. Part of it is the time to wake up and be
scheduled. Part of it is deliberate: **timer slack**. By default, each thread allows its timers to fire up to
50 microseconds late. The kernel uses that freedom to fire several timers in one interrupt, which saves wake-ups
and power.

```c
// slack.c: gcc -O2 slack.c -o slack && ./slack
#include <stdio.h>
#include <sys/prctl.h>
#include <time.h>

static long now_ns(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec * 1000000000L + t.tv_nsec;
}

static void measure(const char *label) {
    struct timespec req = { 0, 50 * 1000 };      // ask to sleep 50 microseconds
    long total = 0;
    for (int i = 0; i < 1000; i++) {
        long t0 = now_ns();
        nanosleep(&req, NULL);
        total += now_ns() - t0;
    }
    printf("%-20s asked 50 us, slept %.1f us on average\n", label, total / 1000 / 1000.0);
}

int main(void) {
    measure("default slack:");
    prctl(PR_SET_TIMERSLACK, 1);                 // allow at most 1 ns of lateness
    measure("slack = 1 ns:");
    return 0;
}
```

Output from one run, on a virtual machine:

```text
default slack:       asked 50 us, slept 130.0 us on average
slack = 1 ns:        asked 50 us, slept 75.8 us on average
```

Removing the slack saved about 50 microseconds. The remaining 25 microseconds of lateness is wake-up and
scheduling cost, which is larger on a virtual machine. On bare metal it is often a few microseconds. Real-time
threads get no slack by default.

::: details Going deeper: wheel levels and user-space timers
- The current Linux timer wheel, redesigned in Linux 4.8, never moves ("cascades") timers between levels.
  Instead, a timer in a coarse level fires at that level's granularity, so long timeouts can be late by
  roughly an eighth of their length. For timeouts that is acceptable.
- hrtimers were merged in Linux 2.6.16. Each core keeps them in a red-black tree.
- `/proc/<pid>/timerslack_ns` shows and sets a thread's slack.
- The same designs appear in user space. Netty's `HashedWheelTimer` and Kafka's request purgatory use
  timer wheels. Go's runtime keeps timers in a heap per scheduler. libuv uses a heap.
:::

## Sleeping and timeouts in your code

**In short:** measure deadlines with the monotonic clock, sleep until absolute times for periodic work, and
make timers readable events with `timerfd` when you use an event loop.

### Periodic work drifts if you sleep relative times

A loop that does work and then sleeps 10 ms does not run every 10 ms. Each iteration takes 10 ms plus the work
plus the wake-up delay. Over an hour, the loop falls seconds behind. The fix is to sleep until an **absolute**
time: compute the next deadline by adding 10 ms to the previous deadline, and call
`clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &deadline, NULL)`. Lateness in one iteration does not carry
over into the next.

### Timeouts must use the monotonic clock

A timeout of "5 seconds from now" computed with the wall clock breaks when the wall clock steps. If the clock
steps forward an hour, the timeout fires at once. If it steps back, the timeout waits an extra hour. Two
common traps:

- `pthread_cond_timedwait` takes a wall-clock deadline by default. Set the condition variable's clock with
  `pthread_condattr_setclock(&attr, CLOCK_MONOTONIC)`.
- Code that computes `deadline = time.time() + 5` in Python, or `System.currentTimeMillis() + 5000` in Java.
  Use `time.monotonic()` or `System.nanoTime()`.

### Timers as file descriptors

An event loop waits in one call, such as `epoll_wait` ([Chapter 12](/io/io-models)). It is convenient if a
timer can wake that same call. <Term id="timerfd">`timerfd`</Term> gives a
<Term id="file-descriptor">file descriptor</Term>, a number that stands for an open file or similar object,
which becomes readable when the timer expires. It can be one-shot or periodic, on the monotonic or wall clock.
Reading it returns how many times the timer expired since the last read. Many event loops instead keep their
own timer heap and pass the time until the earliest timer as `epoll_wait`'s timeout.

::: details Going deeper: other timer interfaces
- `alarm` and `setitimer` deliver a signal when a timer expires. Signals are awkward to handle safely
  ([Chapter 2](/foundations/processes-and-threads)), so new code prefers `timerfd`.
- POSIX timers (`timer_create`) can deliver a signal or start a thread, and support any clock.
- `epoll_wait` takes its timeout in milliseconds. `epoll_pwait2` (Linux 5.11) accepts nanoseconds.
- A `timerfd` on `CLOCK_REALTIME` with `TFD_TIMER_CANCEL_ON_SET` reports when someone steps the wall clock.
  That is useful for "run at 09:00" schedulers.
:::

## Keeping the wall clock correct: NTP and PTP

**In short:** every clock drifts, by seconds per day. Time sync daemons compare against time servers and
correct the clock, normally by gently speeding it up or slowing it down, sometimes by stepping it.

Quartz crystals are not perfect. A typical one is off by tens of parts per million, and changes with
temperature. 50 parts per million is about 4 seconds per day. Left alone, the clocks of two servers drift
apart by seconds within a day or two.

The <Term id="ntp">Network Time Protocol (NTP)</Term> fixes this. A daemon on each machine (`chronyd`, `ntpd` or
`systemd-timesyncd`) asks several time servers for the time. It measures the network round trip to estimate
how long each answer took to arrive, and works out how far off the local clock is.

It then corrects the clock in one of two ways:

- **Slewing.** Run the clock slightly fast or slow, by up to a fraction of a percent, until the error is gone.
  Time keeps moving forward, and no reading ever jumps. This is the normal case.
- **Stepping.** Set the clock to the right value at once. This is used for large errors, usually right after
  boot. It is the step that makes wall-clock durations negative.

Slewing affects `CLOCK_MONOTONIC` too: it runs at the corrected rate, so it stays close to real seconds. It
still never jumps. Only `CLOCK_MONOTONIC_RAW` ignores slewing.

How accurate is it? Over the internet, NTP typically keeps a clock within a few milliseconds of true time.
Inside a data centre, with nearby time servers, well under a millisecond is common. For more, the **Precision
Time Protocol (PTP)** uses network cards that record exactly when packets leave and arrive. It reaches
microseconds or better. Cloud providers now offer PTP-based or hardware-backed time services in some regions.

::: details Going deeper: daemons, steps and checking your clock
- `chronyc tracking` (chrony) or `timedatectl timesync-status` (systemd-timesyncd) shows the current offset, the rate correction and
  the source. `ntpq -p` does the same for ntpd.
- ntpd steps the clock when the offset is above 128 ms, by default. chrony steps only when configured to, for
  example with `makestep 1 3`: step if the error is over 1 s, during the first 3 updates.
- Slewing uses the kernel's `adjtimex` interface. The kernel adjusts the conversion from counter to
  nanoseconds, so `clock_gettime` in the vDSO picks it up automatically.
- An NTP server's **stratum** is its distance from a reference clock: stratum 1 is attached to GPS or an
  atomic clock, stratum 2 syncs from stratum 1, and so on.
:::

### Leap seconds

The Earth's rotation is slightly irregular. To keep UTC in line with it, a **leap second** was added 27 times
between 1972 and 2016, as an extra 23:59:60 at the end of a day. Unix time cannot represent 23:59:60, so the
kernel repeats the second 23:59:59. Timestamps then go backwards by one second.

Leap seconds have broken real systems. In 2012, a Linux kernel bug around the leap second made many Java
programs and MySQL servers spin at 100% CPU. At the start of 2017, Cloudflare's DNS service failed partly
because code computed a negative duration across the leap second using the wall clock.

Large companies now use **leap smearing** instead. Their time servers spread the extra second over many hours,
running clocks slightly slow, so no second is repeated. Google smears over 24 hours. The catch: during a smear,
smeared and unsmeared clocks disagree by up to half a second, so all machines should use the same source. In
2022 the international body that governs time decided to stop adding leap seconds by 2035.

## Clock skew in distributed systems

**In short:** clocks on different machines never agree exactly. Code that orders events or expires leases by
comparing timestamps across machines must allow for the difference, or use logical clocks instead.

Two servers write the same key. The database keeps the write with the latest timestamp, "last write wins".
Server A's clock is 50 ms ahead of server B's. A writes, then B writes 20 ms later in real time. B's
timestamp is 30 ms **earlier** than A's, so the database keeps A's older value and silently drops B's.

The difference between two machines' clocks is <Term id="clock-skew">clock skew</Term>. Even with good NTP,
it is rarely zero, and it can spike when a daemon fails or a virtual machine pauses. Designs deal with it in
a few ways:

- **Do not compare clocks across machines** for ordering. Use a single leader, sequence numbers, or version
  counters.
- **Logical clocks.** A Lamport clock is a counter attached to every message; it orders events by cause, not
  by time. **Hybrid logical clocks** combine wall time with a counter, so timestamps stay close to real time
  but never go backwards. CockroachDB and others use them.
- **Bounded uncertainty.** Google Spanner's **TrueTime** returns an interval, "now is between *earliest* and
  *latest*", using GPS and atomic clocks. A transaction waits until its timestamp is certainly in the past
  before it commits. The interval was a few milliseconds in the original paper. AWS offers a similar idea with
  ClockBound.
- **Leases with margins.** A node that holds a lock lease "until 10:00:05" should stop acting on it early, by
  more than the maximum skew. The lease holder should also measure its lease with its own monotonic clock.

## Time in virtual machines and containers

**In short:** containers share the host's clock. Virtual machines have their own, which can jump when the VM
is paused or moved to another host.

A container is a group of processes on the shared host kernel ([Chapter 18](/systems/virtualization)), so it
reads the same wall clock and monotonic clock as the host. A container cannot set its own wall clock. Linux
5.6 added **time namespaces**, which let a container see a different `CLOCK_MONOTONIC` and `CLOCK_BOOTTIME`
offset. They exist mainly so that a checkpointed container can be restored on another machine without its
monotonic clock jumping. There is no per-container wall clock.

A virtual machine reads a clock that the hypervisor provides. When the hypervisor pauses the VM, for a
snapshot or a live migration to another host, the guest's time stops, then must catch up. A guest may see its
wall clock step forward by seconds. Services that treat a sudden gap as "the other side is dead" may then
fail over unnecessarily.

## Why this matters in real systems

**Negative latencies and bad percentiles.** Metrics code that measures with `time.time()` records negative or
huge durations whenever the wall clock is stepped. Tail-latency dashboards then show nonsense. Switching to a
monotonic clock fixes it.

**Timeouts that fire early.** A job scheduler computes deadlines with the wall clock. After a VM migration
steps the clock forward by 30 seconds, hundreds of jobs time out at once and retry, overloading a downstream
service.

**Slow clocks on new instances.** A service moves to a new instance type and uses more CPU. The clocksource
turns out to be one the vDSO cannot read, so every timestamp is a real system call. Checking
`current_clocksource` finds it in seconds.

**Distributed training and tracing.** Distributed traces and multi-node training logs are merged by timestamp.
A node with a skewed clock makes a span appear to finish before it started, or makes one GPU worker look slow
when it is not. Use NTP or PTP on every node, and compare durations measured on one machine, not across two.

**Lost writes from clock skew.** A last-write-wins store behind several application servers loses updates when
one server's NTP daemon dies and its clock drifts. The fix is monitoring clock offset as a health metric, and
not relying on timestamps for correctness.

**Latency-critical threads.** A trading or packet-processing thread shows jitter of a few microseconds every
millisecond. That is the tick interrupting it. Isolating the core, moving device interrupts away and booting
with `nohz_full=` removes most of it.

**How to look:**

```bash
cat /sys/devices/system/clocksource/clocksource0/current_clocksource   # tsc is best on x86
timedatectl                          # is NTP active, is the clock synchronised
chronyc tracking                     # current offset and rate correction (chrony)
grep LOC /proc/interrupts            # timer interrupts per core
cat /proc/<pid>/timerslack_ns        # a thread's timer slack
perf trace -s ./prog                 # many clock_gettime syscalls = vDSO not in use
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. What is the difference between CLOCK_REALTIME and CLOCK_MONOTONIC? When do you use each?
`CLOCK_REALTIME` is the wall clock: seconds since 1970 in UTC. It can be stepped forwards or backwards by an
administrator or by time sync. Use it for timestamps that people or other systems read.

`CLOCK_MONOTONIC` counts from an arbitrary point, usually boot, and never goes backwards. Use it for
everything that measures elapsed time: latencies, timeouts, rate limiting, retries.

**Senior add-on:** monotonic is still slewed by NTP, so it tracks real seconds; `CLOCK_MONOTONIC_RAW` is not.
`CLOCK_BOOTTIME` includes suspend. Leap seconds are handled by repeating or smearing a wall-clock second. Go's
`time.Now` carries both readings, and `Sub` uses the monotonic one.
:::

::: details 2. How does clock_gettime work without a system call?
The kernel keeps a time record, "at counter value C the time was T", plus a conversion factor. It maps that
record read-only into every process. The vDSO's `clock_gettime` reads the record, reads the CPU's time stamp
counter, and computes T plus the elapsed counts converted to nanoseconds, all in user mode. It costs tens of
nanoseconds instead of about 100 or more for a system call.

**Senior add-on:** a sequence counter lets readers detect a concurrent update and retry, without locks. It
needs a user-readable clocksource with a stable rate: an invariant TSC, or a paravirtual clock in VMs. If the
kernel falls back to HPET or another source, the call silently becomes a system call.
:::

::: details 3. What is the timer tick, and what does a tickless kernel change?
The tick is a periodic timer interrupt on each core, typically 100 to 1000 times a second. On each tick the
kernel accounts CPU time, lets the scheduler preempt the running thread, updates timekeeping and runs expired
coarse timers.

A tickless idle kernel stops the tick on idle cores and programs the timer for the next real event, so idle
cores sleep longer and save power. Full tickless (`nohz_full`) also stops it on cores running a single thread,
removing periodic interruptions for latency-sensitive work.

**Senior add-on:** full tickless makes kernel entries a little more expensive, needs a housekeeping core, and
is combined with CPU isolation and interrupt affinity. Timer interrupts per core are visible in the `LOC` line
of `/proc/interrupts`.
:::

::: details 4. How does the kernel manage millions of timers efficiently?
It splits them by need. Timeouts that are usually cancelled, such as TCP retransmits and poll timeouts, go in a
timer wheel: an array of buckets per tick, with coarser levels for later times. Adding, cancelling and firing
cost constant time, at the price of precision.

Timers that must be precise, such as `nanosleep` and `timerfd`, are high-resolution timers kept in a per-core
sorted tree. The kernel programs the hardware timer for the earliest one.

**Senior add-on:** since Linux 4.8, the wheel does not cascade, so long timeouts can fire late by around an eighth
of their length. Timer slack (50 µs by default) lets the kernel batch nearby hrtimers into one interrupt.
User-space systems use the same structures: hashed timer wheels in Netty and Kafka, heaps in Go and libuv.
:::

::: details 5. Why does sleep(10 ms) in a loop not give you a 10 ms period? How do you fix it?
Each iteration takes the work time plus 10 ms plus the wake-up delay, so the period is longer than 10 ms and
the error accumulates. The fix is to sleep until absolute deadlines on the monotonic clock: add 10 ms to the
previous deadline and use `clock_nanosleep` with `TIMER_ABSTIME`. Late iterations do not shift later ones.

**Senior add-on:** wake-up still has jitter from timer slack, scheduling and interrupts. For tight periods,
lower the slack (`PR_SET_TIMERSLACK`), use a real-time scheduling class, and isolate the core. A `timerfd` in
periodic mode also keeps absolute timing and reports missed expirations.
:::

::: details 6. How does NTP correct a clock, and what can go wrong?
The daemon asks several servers for the time, subtracts the estimated network delay, and computes the local
offset. Small offsets are corrected by slewing: the clock runs slightly fast or slow until it catches up,
without jumps. Large offsets, usually at boot, are corrected by stepping, which jumps the wall clock.

What goes wrong: steps break code that measures durations with the wall clock. Asymmetric network paths bias
the estimate. A dead daemon lets the clock drift by seconds per day. Leap seconds repeat a second unless
smeared.

**Senior add-on:** chrony only steps when configured (`makestep`); ntpd steps above 128 ms by default. Smeared
and unsmeared sources disagree by up to half a second during a smear, so a fleet should not mix them. PTP with
hardware timestamping reaches microseconds.
:::

::: details 7. Two servers write the same key with timestamps, and the later write is lost. Why, and how do you design around it?
Their clocks are skewed. If the first server's clock is ahead by more than the time between the writes, the
second write gets an earlier timestamp. Last-write-wins then keeps the older value.

Designs: route writes for a key through one leader that assigns sequence numbers. Use version numbers or
compare-and-set. Use logical or hybrid logical clocks, which never go backwards and respect causality. Or
bound the uncertainty, as Spanner's TrueTime does, and wait it out before committing.

**Senior add-on:** monitor clock offset on every node, and make systems like CockroachDB refuse to run when the
offset exceeds their configured maximum. For leases, give up the lease early by more than the maximum skew, and
time it with a monotonic clock.
:::

::: details 8. Why is a 50 µs nanosleep often 100 µs or more?
Three reasons. Timer slack: by default Linux may fire a thread's timer up to 50 µs late, to batch wake-ups.
Wake-up cost: the interrupt, making the thread runnable, and scheduling it, possibly behind another thread.
Power states: a core in deep sleep takes time to wake up.

**Senior add-on:** `prctl(PR_SET_TIMERSLACK, 1)` removes the slack; real-time threads have none by default.
Virtual machines add hypervisor wake-up cost. For microsecond precision, some systems busy-poll the clock
instead of sleeping, trading a whole core for accuracy.
:::

## Common misconceptions

- **"System time never goes backwards."** The wall clock can be stepped back by time sync, an administrator or
  a leap second. Only the monotonic clock is guaranteed not to.
- **"The monotonic clock is not adjusted by NTP."** It is not stepped, but it is slewed. `CLOCK_MONOTONIC_RAW`
  is the unadjusted one.
- **"Nanosecond resolution means nanosecond accuracy."** Resolution is the unit. Reading the clock costs tens
  of nanoseconds, and sleeps are late by microseconds.
- **"Servers with NTP have the same time."** They differ by microseconds to milliseconds, more when a daemon
  fails. Never rely on cross-machine timestamps for correctness.
- **"The kernel wakes up every millisecond no matter what."** Tickless idle stops the tick on idle cores, and
  `nohz_full` on busy ones.

## Key takeaways

- Use the **wall clock** (`CLOCK_REALTIME`) for timestamps and the **monotonic clock** for durations,
  timeouts and deadlines. The wall clock can jump.
- Time is a **hardware counter** (the TSC on x86) plus a kernel record. The **vDSO** reads both in user mode, in
  tens of nanoseconds, if the clocksource allows it.
- The **tick** drives scheduling and coarse timers. **Tickless** modes stop it on idle cores, or on isolated
  cores running one thread.
- The kernel uses a **timer wheel** for cheap, usually-cancelled timeouts and **hrtimers** for precise ones.
  Timer slack makes sleeps late on purpose.
- **NTP** slews and sometimes steps clocks; **clock skew** between machines never reaches zero. Do not order
  distributed events by comparing wall clocks.

## Review

<Flashcards id="time-and-timers" :cards="cards" />

<MarkDone id="time-and-timers" />
