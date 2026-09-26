---
title: 1. What an OS Is
---

<script setup>
import { cards } from './what-is-an-os-review'
</script>

# 1. What an OS Is

An operating system is the software that shares one machine safely between many programs. Deep interview
questions, such as "what does `read()` cost?" or "how do containers isolate code?", start at the boundary
between programs and the <Term id="kernel">kernel</Term>, the core of the OS.

::: info Before you start
- You need to know two things. A CPU runs instructions one after another. Memory is a long row of bytes,
  each with a number called its **address**.
- Everything else is explained here, in plain words, the first time it appears.
- Some ideas, such as virtual memory and scheduling, get a short explanation here and a full chapter later.
  The links point to those chapters, but you do not need them to follow this one.
:::

## What an operating system does

**In short:** the OS shares the hardware between programs, protects them from each other, and gives them
simpler building blocks than raw hardware.

Picture a laptop running a browser, a music player and a compiler at the same time. There is one set of
hardware: a few CPU cores, one block of RAM, one disk, one network card. Somebody has to decide who uses what,
and stop a buggy program from wrecking the others. That somebody is the operating system.

It has three jobs:

- **Referee.** It decides which program runs on which CPU core, and for how long. It stops programs from
  reading or overwriting each other's memory.
- **Illusionist.** It gives each program simpler things to work with than raw hardware. A program sees files
  instead of disk blocks, and its own private memory instead of shared RAM.
- **Service provider.** It offers common services that every program needs: starting programs, reading
  files, sending network data, telling the time.

The kernel is the part of the OS that does all this. The rest of what people call "the OS" is ordinary
programs: the shell, the C library, system services, the desktop. Those have no special power. They ask the
kernel for everything, the same way your own programs do.

A running program is called a <Term id="process">process</Term>. Each process has its own memory and its own
open files. Inside a process, one or more <Term id="thread">threads</Term> run code. A thread is one sequence
of instructions being executed. [Chapter 2](/foundations/processes-and-threads) covers both in depth.

## What "the kernel" actually is

**In short:** the kernel is a program loaded at boot. Its code sits in every process's view of memory, and
runs only when something enters it.

The kernel is a program like any other: compiled code and data, stored in a file. At boot, a small loader
copies it into RAM and jumps to its first instruction. The kernel then sets up the hardware and starts the
first user program. From then on, it stays in memory until the machine shuts down.

A common picture is that the kernel is a background process that watches everything. That picture is wrong.
Most of the time no kernel code is running at all. The kernel runs only when one of three things happens:

1. A program asks it to do something. This is a <Term id="syscall">system call</Term>.
2. A program does something the CPU cannot finish on its own, such as divide by zero. This is an
   <Term id="exception">exception</Term>.
3. A device or a timer needs attention. This is an <Term id="interrupt">interrupt</Term>.

When one of these happens, the CPU jumps into kernel code, the kernel does its work, and the CPU goes back to
running a program. The kernel is less like a manager watching the room and more like a set of doors that the
CPU walks through. The rest of this chapter explains each door.

Where is the kernel in memory? Each process gets its own private view of memory, called its
<Term id="address-space">address space</Term>. The kernel places itself into **every** process's address
space, in a range of addresses that the process is not allowed to touch. So when a process enters the
kernel, the kernel's code is already there. [Chapter 4](/memory/virtual-memory) explains how.

::: details Going deeper: the kernel on disk and kernel threads
- On Linux, the kernel file is usually `/boot/vmlinuz-<version>`, a compressed image. A boot loader (such as
  GRUB) or the machine's firmware loads it. Extra pieces, such as drivers, can be loaded later as
  **modules** (`lsmod` lists them). Modules become part of the kernel and run with full privilege.
- On x86-64 Linux the kernel lives in the top half of every address space (addresses starting with
  `0xffff…`). It also maps all of physical RAM there, so it can reach any byte of memory directly.
- The kernel does have some threads of its own, for background work: writing data to disk, reclaiming memory,
  handling network traffic. `ps -ef` shows them in square brackets, such as `[kthreadd]`, `[kworker/0:1]` and
  `[ksoftirqd/0]`. They run only kernel code and have no user program attached.
:::

## User mode and kernel mode

**In short:** the CPU has a privilege switch. Normal programs run with it off, in
<Term id="user-mode">user mode</Term>. The kernel runs with it on, in kernel mode, and only it may control the
hardware.

Imagine a buggy program that could run any CPU instruction. It could turn off the timer, and then never give
the CPU back. It could reprogram the disk controller and erase another user's files. It could change which
memory tables are in use, and read every other process's memory. No software rule could stop it, because the
rule would itself be software running on that same CPU.

So the protection has to be in the hardware. The CPU keeps a small piece of state that says how much the
current code is trusted. There are two levels that matter:

- In **user mode**, the CPU refuses some instructions. These include turning off interrupts, talking to
  devices directly, and switching memory tables. It also refuses to touch memory marked as kernel-only.
- In **kernel mode**, everything is allowed.

What happens if user code tries anyway? The CPU does not run the instruction. It jumps into the kernel
instead, which usually ends the program. On Linux the kernel sends the program a **signal**, a notification
that by default kills it. You see "Segmentation fault" or "Illegal instruction".

### The one-way door

The key design point is **how** the CPU gets from user mode into kernel mode. User code cannot flip the
switch and keep running its own code. The only ways in are a few fixed entry points. The kernel chose those
entry addresses at boot and told the CPU about them.

So every time the CPU enters kernel mode, it starts running **kernel** code, at a place the kernel picked.
User code can ask, but it cannot decide what runs next. Going back from kernel mode to user mode is easy: the
kernel runs a "return to user mode" instruction.

### Privilege rings

You will hear the word **ring** in interviews. On x86 CPUs, the privilege levels are numbered 0 to 3, called
rings. Ring 0 is the most trusted. Linux, Windows and macOS use only two: **ring 0** for the kernel and
**ring 3** for programs. Rings 1 and 2 exist but are practically unused.

Other CPUs use different names for the same idea. ARM calls them **exception levels**: EL0 for programs, EL1
for the kernel. The idea is the same everywhere: a few levels, and hardware-enforced ways to move between them.

::: details Going deeper: more levels, below the kernel
- Hardware virtualization adds a level more trusted than the kernel, for the hypervisor: the program that runs
  virtual machines. People informally call it "ring −1". On ARM it is EL2.
  [Chapter 18](/systems/virtualization) covers this.
- ARM has EL3 for secure firmware. x86 has System Management Mode, used by the firmware.
- On x86, the current level is kept in the lowest two bits of the code segment register (CS). Each page table
  entry has a "User" flag that says whether ring 3 may touch that memory.
- RISC-V uses U (user), S (supervisor, the kernel) and M (machine, the firmware) modes.
:::

## Three ways into the kernel: interrupts, exceptions and traps

**In short:** the CPU enters the kernel for three reasons. Something outside needs attention (interrupt),
the current instruction failed (exception), or the program asked on purpose (trap).

Here are three situations:

- A program is in the middle of a long calculation. A network packet arrives. Someone must copy it out of the
  network card before the card runs out of space.
- A program reads a memory address that the kernel has not set up yet.
- A program wants to write text to the terminal. Only the kernel may talk to the terminal.

In each case the CPU stops running the program and jumps into the kernel. But the cause, the timing and what
happens afterwards are different.

<KernelEntryDiagram />

An **interrupt** comes from **outside the running program**. A device, a timer or another CPU core raises a
line to the CPU, asking for attention. The CPU finishes its current instruction, then jumps to the kernel's
handler for that interrupt. Afterwards, the program continues exactly where it stopped. It cannot even tell
it was interrupted, except that time passed.

An **exception** is caused by **the current instruction**, which the CPU could not complete. Examples are
dividing by zero, using a bad address, or running a privileged instruction in user mode. The kernel then
decides what to do. Sometimes it fixes the problem and runs the same instruction again. Otherwise it kills
the program.

A <Term id="trap">trap</Term> is an exception the program causes **on purpose**, with a special instruction.
It is how a program asks the kernel for help. Afterwards, the program continues at the **next** instruction.
System calls, covered next, are the main example. A debugger's breakpoint is another.

| | Interrupt | Exception | Trap |
|---|---|---|---|
| Caused by | A device, a timer or another core | The current instruction failing | The program, deliberately |
| Timing | Any moment | Always at that instruction | Always at that instruction |
| Example | Packet arrived, disk read done, timer tick | Page fault, divide by zero | System call, breakpoint |
| Afterwards | Continue where it stopped | Re-run the instruction, or kill | Continue at the next instruction |

::: warning These words are not used consistently
CPU manuals, textbooks and kernels use these words differently. Intel calls page faults and breakpoints both
"exceptions", and splits them into faults, traps and aborts. Some books call all three "interrupts". In an
interview, describe the **mechanism** (outside or not, deliberate or not, where it resumes) and the words
will not trip you up.
:::

### The page fault: an exception that is not an error

One exception deserves a special mention, because it happens thousands of times a second on any busy
machine. Programs use addresses that the hardware translates to real RAM locations, using a table called
the <Term id="page-table">page table</Term>. When the table has no usable entry for an address, the CPU
raises a <Term id="page-fault">page fault</Term>.

Usually this is not a bug. The kernel often hands out memory lazily, only when a program first touches it.
The page fault is its cue to do that work now. The kernel sets up the memory, and the CPU re-runs the
instruction, which now succeeds. [Chapter 4](/memory/virtual-memory) covers this in full.

### The timer interrupt: how the kernel gets the CPU back

Suppose a program runs `while (1) {}`. It never makes a system call and never faults. How does the kernel
ever get to run another program on that core?

At boot, the kernel programs a hardware timer to interrupt each core regularly, often hundreds of times per
second. On each timer interrupt, the kernel runs. It checks whether the current thread has used up its time.
If so, it saves the thread's state and switches the core to another thread. This is
<Term id="preemption">preemption</Term>: taking the CPU away from a thread without its cooperation.

The part of the kernel that picks which thread runs next is the <Term id="scheduler">scheduler</Term>.
[Chapter 8](/cpu/scheduling) covers how it decides. [Chapter 16](/systems/time-and-timers) covers the timers,
including why modern kernels stop the regular tick on idle cores.

::: details Going deeper: interrupt handling on x86 and Linux
- At boot, the kernel fills in a table of handler addresses, the **interrupt descriptor table (IDT)**. It has
  256 slots, called vectors. Slots 0–31 are for exceptions: 0 is divide error, 3 is breakpoint, 13 is
  general protection (the "not allowed" exception), 14 is page fault. The rest are for interrupts.
- On x86, the CPU records the address that caused a page fault in a register called CR2.
- Interrupt handlers must be quick, because other interrupts may wait while they run. Linux splits the work.
  The handler does the urgent minimum (the "top half"). The rest runs soon after as a **softirq**, in a
  kernel thread, or in a work queue (the "bottom half"). [Chapter 15](/io/networking) shows this for network
  packets.
- Interrupts sent from one core to another are called **inter-processor interrupts (IPIs)**. The kernel uses
  them to wake idle cores and to tell other cores to drop stale memory translations.
- `cat /proc/interrupts` shows how many interrupts of each kind each core has handled. The `in` column of
  `vmstat 1` shows the total rate.
:::

## System calls, step by step

**In short:** a system call is a trap that asks the kernel to do something. The same thread runs the kernel
code, then returns with the result.

Your program wants to print "hello". Printing means writing to the terminal, and only the kernel may do that.
So the program must ask the kernel, with a system call, or **syscall** for short. Opening files, reading from
the network, getting memory and starting programs all work the same way.

The request travels in <Term id="register">registers</Term>. A register is a small, fast storage slot inside
the CPU. Here is what happens when a C program calls `write(1, "hello\n", 6)`. The `1` is a
<Term id="file-descriptor">file descriptor</Term>: a small number that stands for an open file. `1` means
standard output, normally the terminal.

<SyscallPathDiagram />

1. **Your code calls `write`.** This is an ordinary function call into the C standard library, called
   <Term id="libc">libc</Term>. It is not a call into the kernel yet.
2. **libc fills registers.** It puts the number of the system call in one register. Every system call has a
   number; on x86-64 Linux, `write` is number 1. It puts the three arguments in other registers.
3. **libc runs a special instruction** (on x86-64 it is called `syscall`). This is the trap.
4. **The CPU switches to kernel mode** and jumps to the entry address the kernel set up at boot.
5. **The kernel saves the program's registers**, so it can restore them later. It checks that the number is
   valid and finds the function that handles it.
6. **The handler does the work.** First it checks every argument. Is `1` an open file? Does the address of
   `"hello\n"` really belong to this process? Then it copies the 6 bytes and passes them to the terminal.
7. **The kernel puts the result in a register** (here, 6 bytes written) and runs the return instruction. The
   CPU drops back to user mode, right after the `syscall` instruction.
8. **libc checks the result** and returns it to your code.

### It is the same thread, not a different one

Look at the diagram again. Nothing in it switches to another program. The same thread keeps running; only
the privilege level changed. This is a **mode switch**, not a
<Term id="context-switch">context switch</Term>. A context switch means the kernel stops one thread and
starts a different one.

A context switch **can** happen inside a system call. If `read` asks for network data that has not arrived
yet, the thread cannot continue. The kernel marks it as waiting and runs another thread. When the data
arrives, an interrupt wakes the thread, and its `read` finally returns. This is what a "blocking" call means.
[Chapter 12](/io/io-models) builds on this.

### The kernel trusts nothing from user mode

Step 6 is where many kernel security bugs live. Every argument comes from code the kernel does not trust.
A pointer might point to kernel memory, to nothing, or to memory another thread is changing at that moment.

So the kernel never follows a user pointer directly. It uses special copy functions that check the address
belongs to user memory and handle a fault safely. A bad pointer makes the system call fail with the error
`EFAULT` ("bad address"). The kernel does not crash, and neither does the program.

::: details Going deeper: the x86-64 and ARM64 details
- **x86-64 Linux:** the system call number goes in `rax`. Arguments go in `rdi`, `rsi`, `rdx`, `r10`, `r8`,
  `r9`, so at most six. The result comes back in `rax`.
- The `syscall` instruction saves the return address in `rcx` and the flags in `r11`. That is why the fourth
  argument uses `r10`, not `rcx` as in normal function calls. The entry address comes from a special
  configuration register (the `LSTAR` MSR) that the kernel wrote at boot.
- `syscall` does **not** switch stacks. The kernel's entry code (`entry_SYSCALL_64`) first switches to the
  thread's own kernel stack, then calls `do_syscall_64`, which dispatches on the number. It returns with
  `sysret`.
- **ARM64:** the instruction is `svc #0`. The number goes in `x8`, arguments in `x0`–`x5`, the result in `x0`.
- System call numbers differ by architecture. `write` is 1 on x86-64 but 64 on ARM64. Linux has a few hundred
  system calls in total.
- Old 32-bit x86 code used `int 0x80`, a software interrupt, which is slower.
- A CPU feature called SMAP (on ARM, PAN) stops the kernel from touching user memory by accident. The copy
  functions (`copy_from_user`, `copy_to_user`) lift it briefly.
:::

## System calls from C

**In short:** you almost never make system calls directly. libc wraps them, turns errors into `errno`, and
sometimes avoids the system call entirely.

Every C program links against libc. On Linux it is usually glibc, or musl on Alpine. Most other languages
sit on top of libc or do the same job themselves; Go, for example, makes system calls on its own.

libc has three kinds of functions:

- **Thin wrappers** such as `write`, `read`, `open` and `close`. Each one makes one system call.
- **Functions that sometimes make system calls.** `printf` collects output in a buffer. It calls `write`
  only when the buffer is full, at the end of a line on a terminal, or at exit. `malloc` asks the kernel for
  memory only when its own supply runs out.
- **Functions that never do.** `strlen` and `memcpy` run entirely in user mode.

There is also a generic function, `syscall()`, which makes any system call by its number. It is useful when
libc has no wrapper yet for a new system call.

### How errors are reported

The kernel reports an error by returning a small negative number, such as −9 for "bad file descriptor". The
libc wrapper turns that into the C convention: the function returns `-1`, and the error code goes into a
variable called <Term id="errno">`errno`</Term>. Each thread has its own `errno`, so threads do not overwrite
each other's errors.

`errno` is only meaningful right after a call has failed. A successful call does not reset it, and may even
change it. So always check the return value first.

### Try it: three ways to write

This program writes through the libc wrapper, then through the generic `syscall()`, and then triggers an
error. File descriptor `1` is the terminal; `42` is not open.

```c
// hello.c: gcc hello.c -o hello && ./hello
#define _GNU_SOURCE
#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <sys/syscall.h>
#include <unistd.h>

int main(void) {
    write(1, "via libc\n", 9);                     // libc wrapper
    syscall(SYS_write, 1, "via syscall()\n", 14);  // generic wrapper, by number

    // An error: file descriptor 42 is not open.
    long r = write(42, "x", 1);
    printf("write returned %ld, errno = %d (%s)\n", r, errno, strerror(errno));
    return 0;
}
```

Expected output:

```text
via libc
via syscall()
write returned -1, errno = 9 (Bad file descriptor)
```

### Watching system calls with strace

<Term id="strace">`strace`</Term> is a Linux tool that runs a program and prints every system call it makes,
with arguments and results. Run it on the program above:

```text
$ strace -e trace=write ./hello
write(1, "via libc\n", 9)                     = 9
write(1, "via syscall()\n", 14)               = 14
write(42, "x", 1)                             = -1 EBADF (Bad file descriptor)
write(1, "write returned -1, errno = 9 (Ba"..., 51) = 51
```

The program's own output is left out above for clarity. Notice two things. Both kinds of call look the same
to the kernel. And `printf` became a single `write` at the end.

Without `-e`, you would see about 30 more system calls before `main` even runs. They load the program's
libraries into memory and set up the process. [Chapter 3](/foundations/linking-and-loading) explains them.

Useful options:

- `strace -c ./prog` counts calls and errors, and totals the time per system call.
- `strace -f` also follows threads and child processes.
- `strace -T` shows how long each call took.
- `strace -p <pid>` attaches to a running process.

::: warning strace is slow
`strace` stops the traced program twice on every system call and switches to the `strace` process to print
it. A program that makes many system calls can run many times slower. On a production server, prefer
`perf trace` or eBPF tools such as `bpftrace`, which cost far less. [Chapter 19](/systems/performance) covers
them.
:::

::: details Going deeper: interrupted calls and missing wrappers
- A system call that is waiting (for example, `read` on a network connection) can be interrupted by a
  signal. It may then fail with `EINTR`, and the program must retry it. Many libc functions and runtimes
  retry for you. [Chapter 2](/foundations/processes-and-threads) covers signals.
- Some system calls have no glibc wrapper. `futex` never had one. `gettid` got one only in glibc 2.30. For
  `io_uring`, programs use the separate `liburing` library.
- The raw kernel return value for an error is between −4095 and −1. That is how the wrapper tells an error
  from a large valid result.
:::

## What a system call costs

**In short:** entering and leaving the kernel costs on the order of 100 nanoseconds, about 100 times a
function call. Hidden costs, such as disturbed caches, can add more.

A function call inside your program costs about a nanosecond. A system call does much more:

- The CPU changes privilege level twice, and each change interrupts its usual tricks for running fast.
- The kernel saves and restores registers, checks arguments, and runs its dispatch code.
- Protections against CPU security flaws add work on each entry and exit (more on this below).

Together, a trivial system call such as `getppid` (get the parent process's ID) costs roughly **50 to a few
hundred nanoseconds** on modern hardware. That seems small. But a server handling a million small requests a
second, with a few system calls each, spends a real share of each core on this alone.

### The hidden cost

The direct cost is only part of the story. While the kernel runs, it fills the CPU's caches with its own code
and data. It also overwrites the CPU's record of which way recent branches (if-statements) went, which the
CPU uses to guess ahead. When the program resumes, it runs slower for a while until it refills them.

A study by Soares and Stumm (the FlexSC paper, OSDI 2010) measured this. They found that for
system-call-heavy programs, this lingering slowdown can cost more than the system call itself. The work inside
the call matters too: a `read` that copies a megabyte is dominated by the copy, not by entering the kernel.

### Try it: a function call, the vDSO, and a real system call

This program times four things: a plain function call, `clock_gettime` through libc, the `getppid` system
call through `syscall()`, and `clock_gettime` forced through a real system call. The second one uses a trick
called the vDSO, explained two sections below.

```c
// syscost.c: gcc -O2 syscost.c -o syscost && ./syscost
#define _GNU_SOURCE
#include <stdio.h>
#include <sys/syscall.h>
#include <time.h>
#include <unistd.h>

#define N 1000000

static double now_ns(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1e9 + ts.tv_nsec;
}

__attribute__((noinline)) static long plain_function(void) {
    __asm__ volatile("" ::: "memory");   // stop the compiler removing the call
    return 42;
}

int main(void) {
    struct timespec ts;
    double t0;

    t0 = now_ns();
    for (int i = 0; i < N; i++) plain_function();
    printf("plain function call      : %6.1f ns\n", (now_ns() - t0) / N);

    t0 = now_ns();
    for (int i = 0; i < N; i++) clock_gettime(CLOCK_MONOTONIC, &ts);
    printf("clock_gettime (vDSO)     : %6.1f ns\n", (now_ns() - t0) / N);

    t0 = now_ns();
    for (int i = 0; i < N; i++) syscall(SYS_getppid);
    printf("getppid (real syscall)   : %6.1f ns\n", (now_ns() - t0) / N);

    t0 = now_ns();
    for (int i = 0; i < N; i++) syscall(SYS_clock_gettime, CLOCK_MONOTONIC, &ts);
    printf("clock_gettime (syscall)  : %6.1f ns\n", (now_ns() - t0) / N);
    return 0;
}
```

Output from one run, on a virtual machine with a recent Intel server CPU:

```text
plain function call      :    1.7 ns
clock_gettime (vDSO)     :   26.3 ns
getppid (real syscall)   :  100.1 ns
clock_gettime (syscall)  :  127.5 ns
```

Your numbers will differ, perhaps by several times. They depend on the CPU, the kernel version, which
security protections are on, and whether you run in a virtual machine. The **ratios** are the lesson. A
function call is about a nanosecond, the vDSO takes tens of nanoseconds, and a real system call takes about a
hundred or more.

### Why system calls got more expensive in 2018

In January 2018, researchers published **Meltdown**, a flaw in many CPUs, mostly Intel ones. It let user
code read kernel memory, even though the permission check said no. The CPU guesses ahead and runs
instructions before it knows they are allowed. It throws the results away, but they leave traces in its
caches, and a program can measure those traces.

The Linux fix is <Term id="kpti">kernel page-table isolation (KPTI)</Term>. Normally the kernel sits in every
process's memory view, as described earlier. With KPTI, the process runs with a memory view that has almost
no kernel in it. Every system call, interrupt and exception must switch to the full view on entry, and back
on exit.

Programs that make many system calls got noticeably slower, while programs that mostly compute barely
changed. Newer CPUs fixed Meltdown in hardware, and Linux turns KPTI off on them. But protections against
related flaws, such as Spectre, still add cost to each kernel entry. [Chapter 17](/systems/security)
explains these flaws and fixes.

::: details Going deeper: checking your machine
- `cat /sys/devices/system/cpu/vulnerabilities/meltdown` shows `Mitigation: PTI` if KPTI is on, or
  `Not affected`. The other files in that folder list the other flaws and their protections.
- Switching the memory view means changing the register that points to the page table (CR3 on x86). Without
  tagged translation caches (a feature called PCID), each switch would throw away all cached address
  translations. [Chapter 4](/memory/virtual-memory) explains that cache, the TLB.
- Booting with `mitigations=off` removes most of this cost. It is sometimes done on single-tenant benchmark
  machines, never on shared ones.
:::

## Doing fewer system calls

**In short:** fast systems make fewer, larger system calls, or avoid the kernel entirely on the hot path.

If each system call costs around 100 nanoseconds plus hidden costs, the fix is to make fewer of them. There
are four main strategies, and each comes back later in the book:

- **Buffer.** Collect small pieces of work in user memory, then make one big call. `printf` does this.
  So do database logs and logging libraries.
- **Batch.** Use calls that do many things at once. `writev` writes several buffers in one call.
  `recvmmsg` receives many network packets in one call. `epoll_wait` reports many ready connections in one
  call ([Chapter 12](/io/io-models)).
- **Share a queue with the kernel.** <Term id="io-uring">io_uring</Term> gives the program two queues in
  memory shared with the kernel. The program adds many requests and makes one system call, or none at all in
  one mode. [Chapter 12](/io/io-models) covers it.
- **Skip the kernel.** Some work never needs it. Reading the time uses the vDSO (next section). Taking a free
  lock needs one atomic instruction, which the CPU completes without interference from other cores. A
  <Term id="futex">futex</Term> system call happens only when a thread must wait
  ([Chapter 10](/cpu/concurrency-2)).

The most extreme option is <Term id="kernel-bypass">kernel bypass</Term>. The program talks to the device
directly, through memory the kernel mapped for it once at startup. After that, sending a network packet or
reading from an SSD involves no system call. DPDK (networking), SPDK (storage) and RDMA (network cards that
copy data straight into another machine's memory) work this way. [Chapter 15](/io/networking) covers them.

## The vDSO: system calls that are not system calls

**In short:** the vDSO is a small library that the kernel places in every process. It answers a few
questions, such as "what time is it?", without entering the kernel.

Some programs read the clock millions of times a second. Every log line has a timestamp, every request is
timed, and profilers record time constantly. A real system call for each would waste a lot of CPU.

But reading the time does not need kernel privileges. The kernel keeps the current time in a page of memory.
It maps that page into every process as read-only. It also maps in a small piece of code that knows how to
read it. That code is the <Term id="vdso">vDSO</Term> ("virtual dynamic shared object"). To the program it
looks like a normal shared library, code that programs load at run time, but the kernel supplies it.

When your program calls `clock_gettime`, libc calls the vDSO version. It reads the time the kernel last
stored, then adds the time since, using a counter inside the CPU. No mode switch happens. That is why it
cost tens of nanoseconds instead of a hundred or more in the timing example above.

You can see the vDSO in any process's memory map:

```text
$ grep vdso /proc/self/maps
7feca62f5000-7feca62f7000 r-xp 00000000 00:00 0      [vdso]
```

Only a few functions live there. On x86-64 Linux these are `clock_gettime`, `gettimeofday`, `time` and
`getcpu`. Recent kernels also add `getrandom`. Everything else is a real system call.

::: warning When the vDSO quietly stops working
The vDSO can only read the time if the CPU's counter is reliable and readable from user mode. On some virtual
machines the kernel picks a different time source, and `clock_gettime` quietly falls back to a real system
call. Older AWS instances running on the Xen hypervisor were a known case. Check with
`cat /sys/devices/system/clocksource/clocksource0/current_clocksource`. On x86, `tsc` (the CPU's own counter)
supports the vDSO. Because vDSO calls never enter the kernel, `strace` does not show them.
:::

::: details Going deeper: how libc finds the vDSO
- The kernel places the vDSO at a random address in each process. It tells the new program where, through a
  list of values passed at program start (the auxiliary vector, entry `AT_SYSINFO_EHDR`). `getauxval` reads it.
- The time data lives in a separate read-only area next to it, shown as `[vvar]` in `/proc/<pid>/maps`.
- Before the vDSO, Linux had the **vsyscall** page at a fixed address. A fixed address helps attackers, so
  modern kernels emulate or disable it. [Chapter 16](/systems/time-and-timers) covers clocks in depth.
:::

## Kernel designs: monolithic and microkernel

**In short:** a monolithic kernel runs all OS services in kernel mode, which is fast. A microkernel runs most
of them as separate user programs, which is safer but crosses the boundary more often.

Consider a bug in a USB driver, the code that controls a USB device. Where that code runs decides what the bug
can break. If it runs in kernel mode, it can overwrite any memory, and the whole machine may crash. If it runs
as a normal user-mode program, the damage stays inside that program.

<KernelDesignsDiagram />

A <Term id="monolithic-kernel">monolithic kernel</Term> puts everything in kernel mode: scheduling, memory
management, file systems, the network stack and device drivers. They form one big program and call each other
with ordinary function calls. Linux, FreeBSD and most traditional Unix systems are monolithic. Linux can load
modules at run time, but modules still run in kernel mode, so Linux is still monolithic.

A <Term id="microkernel">microkernel</Term> keeps only the minimum in kernel mode: threads, memory address
spaces, and a way to send messages between processes. File systems, drivers and the network stack run as
separate user-mode programs, called servers. Sending messages between processes is called
<Term id="ipc">inter-process communication (IPC)</Term>. A microkernel lives or dies by how fast its IPC is.

| | Monolithic | Microkernel |
|---|---|---|
| What runs in kernel mode | All OS services | Threads, memory, IPC |
| A `read()` from a file | One trip into the kernel | Several messages through the kernel |
| A driver bug | Can crash or compromise the whole machine | Crashes one server, which can restart |
| Speed | Faster: calls are function calls | Slower: more boundary crossings |
| Examples | Linux, FreeBSD | seL4, QNX, MINIX 3 |

Microkernels are common where reliability matters more than raw speed. QNX runs in many cars and industrial
controllers. seL4 has a machine-checked mathematical proof that its code matches its specification. It is
used in some defence and aerospace systems.

Most real systems sit somewhere between. Windows and macOS started from microkernel ideas, then kept many
services in kernel mode for speed. People call them **hybrid** kernels.

### The line keeps moving

Linux is monolithic, but it now moves some work out of the kernel, and lets some user code run inside it:

- **FUSE** lets a file system run as a user-mode program. Many cloud storage mounts work this way.
- **User-space drivers** (through VFIO) and kernel-bypass libraries hand a device to one program.
- **eBPF** lets programs load small, safety-checked pieces of code into the kernel, for tracing, networking
  and security ([Chapter 19](/systems/performance)).
- **gVisor**, used for sandboxing containers, is a user-mode program that implements Linux system calls
  itself. The container's code talks to it, not to the real kernel ([Chapter 18](/systems/virtualization)).

::: details Going deeper: the debate and the details
- In 1992 Andrew Tanenbaum (author of MINIX) and Linus Torvalds argued in public about this choice. Tanenbaum
  called monolithic kernels obsolete; Torvalds argued they were simpler and faster in practice. The argument
  is still a good summary of the trade-off.
- Early microkernels such as Mach had slow IPC, which gave microkernels a reputation for being slow. The L4
  family, including seL4, showed that IPC can be made very fast with careful design.
- macOS's kernel, XNU, combines the Mach microkernel with BSD Unix code in one kernel-mode program. Windows
  NT runs most of its services, including the core of the window system, in kernel mode.
- Google's Fuchsia uses a microkernel called Zircon.
:::

## Why this matters in real systems

**Chatty logging.** A service that calls `write` for every log line makes one system call per line. At
100,000 lines a second, that alone uses a noticeable share of a core. Buffered logging, which writes every few
kilobytes or every few milliseconds, cuts the number of calls by orders of magnitude.

**Many small files in ML training.** Some data loaders open, read and close one small file per training
example. That is several system calls per example, plus file system lookups. At thousands of examples per
second, the loader cannot keep the GPUs busy. Teams pack examples into large shard files (formats such as
TFRecord or WebDataset tar shards) and read them sequentially in big chunks.

**Timestamps on virtual machines.** A latency-sensitive service reads the clock several times per request.
If its virtual machine uses a time source that the vDSO cannot read, every `clock_gettime` becomes a real
system call. The service gets slower with no code change. Checking the clock source is a standard step when
moving to a new cloud instance type.

**Talking to GPUs.** Starting work on a GPU does not usually cost one system call per launch. The GPU driver
uses system calls once to set up memory shared between the program and the GPU. After that, the user-mode
part of the driver writes commands into that memory directly. This is a form of kernel bypass. It keeps the
CPU cost of each GPU launch in the microseconds.

**Containers share one kernel.** Every container on a host makes system calls into the same kernel. So the
system call interface is the attack surface between containers. Docker's default profile blocks dozens of
rarely needed system calls with <Term id="seccomp">seccomp</Term>. Stronger isolation, such as gVisor or
lightweight virtual machines, puts another layer in front of that interface ([Chapter 17](/systems/security),
[Chapter 18](/systems/virtualization)).

**Network and storage at full speed.** At 100 Gbit/s, the smallest network packets arrive every few
nanoseconds. That is far less than one system call. High-frequency trading, software routers and ML clusters
using RDMA bypass the kernel for this reason.

**How to measure it:**

```bash
strace -c -f ./prog                          # which system calls, how many, how many failed
perf trace -s ./prog                         # a similar summary, much lower overhead
perf stat -e raw_syscalls:sys_enter ./prog   # total number of system calls
cat /proc/interrupts                         # interrupts per core, by source
vmstat 1                                     # "in" = interrupts/s, "cs" = context switches/s
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. What is the difference between user mode and kernel mode, and why do we need both?
The CPU has a privilege level. In user mode, it refuses dangerous instructions, such as turning off
interrupts or talking to devices, and refuses to touch kernel memory. In kernel mode everything is allowed.

We need both because protection must be enforced by hardware. If any program could run any instruction, one
buggy or hostile program could take over the machine. The only ways into kernel mode are entry points the
kernel chose, so user code can ask for things but never decide which kernel code runs.

**Senior add-on:** on x86 these are rings 0 and 3; on ARM, EL0 and EL1. There are more privileged levels
below the kernel for hypervisors (ring −1, EL2) and firmware. Memory protection uses the same idea: each page
table entry has a flag saying whether user mode may access that page.
:::

::: details 2. Walk me through what happens when a program calls read().
1. The program calls the libc `read` function, an ordinary function call.
2. libc puts the system call number and the three arguments (file descriptor, buffer address, length) into
   registers, then runs the `syscall` instruction.
3. The CPU switches to kernel mode and jumps to the kernel's entry point. The kernel saves the program's
   registers and calls the handler for that number.
4. The handler checks the file descriptor, and checks that the buffer is user memory. If the data is ready
   (for example, in the kernel's file cache), it copies it into the buffer. If not, it starts the I/O and puts
   the thread to sleep. The scheduler runs something else until an interrupt says the data arrived.
5. The kernel puts the byte count (or a negative error) in a register and returns to user mode. libc turns
   an error into `-1` plus `errno`.

**Senior add-on:** mention the costs: the mode switch (roughly 100 ns), the copy from kernel to user memory,
cache disturbance, and possible blocking. Mention `EFAULT` for a bad pointer, `EINTR` if a signal arrives
while waiting, and that on x86-64 the number goes in `rax` and arguments in `rdi`, `rsi`, `rdx`.
:::

::: details 3. Is a system call a context switch?
No. A system call is a **mode switch**: the same thread keeps running, now in kernel mode, and returns to the
same place. A context switch means the kernel saves one thread's state and starts running a different thread.

A context switch can happen **during** a system call, if the call must wait (for example, `read` on a network
connection with no data). It also happens on a timer interrupt when a thread's time is up.

**Senior add-on:** the costs differ. A mode switch costs roughly 100 ns. A context switch costs a few
microseconds directly, plus lost cache contents. Switching to a thread of another process also changes the
memory view. [Chapter 8](/cpu/scheduling) covers the details.
:::

::: details 4. What is the difference between an interrupt, an exception and a trap?
An **interrupt** comes from outside the running code: a device, a timer or another core. It can arrive at any
moment, and the program continues where it stopped.

An **exception** is caused by the current instruction failing: a page fault, divide by zero, or a privileged
instruction in user mode. The kernel either fixes the cause and re-runs the instruction, or kills the program.

A **trap** is a deliberate exception, such as a system call or a debugger breakpoint. The program continues
at the next instruction.

**Senior add-on:** say that terminology varies. Intel calls all synchronous events "exceptions" and splits them
into faults (re-run, like page faults), traps (continue after, like breakpoints) and aborts (cannot recover,
like machine checks). On x86, all of them use the same table of handler addresses, the IDT.
:::

::: details 5. A program runs an infinite loop and never makes a system call. How does the OS stop it?
The kernel programs a hardware timer that interrupts each core regularly. On each timer interrupt, the CPU
enters the kernel no matter what the program is doing. The scheduler checks whether the thread has used its
time, and if so, switches the core to another thread. This is preemption.

To kill the program, you send it a signal, for example with Ctrl-C. The kernel records the signal and, if
needed, interrupts the core running the thread. Just before the thread would return to user mode, the kernel
acts on the signal and ends the process.

**Senior add-on:** without a timer interrupt, you only have cooperative multitasking, where programs must give
up the CPU themselves. Classic Mac OS and Windows 3.x worked this way, and one bad program could freeze the
machine. Tickless kernels stop the regular timer on idle cores, and with special settings even on a core
running a single thread.
:::

::: details 6. Why are system calls expensive, and how do high-performance systems avoid them?
Direct costs: two privilege changes, saving and restoring registers, argument checks, and security protections
on entry and exit. Together that is roughly 100 ns, around a hundred times a function call. Indirect costs:
the kernel evicts the program's data from caches, so the program runs slower for a while afterwards.

Ways to avoid them:

- Buffer, and make fewer, bigger calls.
- Batch, with calls such as `writev`, `recvmmsg` and `epoll_wait`, or submit many operations at once with
  `io_uring`.
- Skip the kernel where possible: the vDSO for time, futexes for locks nobody else holds.
- Bypass the kernel entirely with DPDK, SPDK or RDMA.

**Senior add-on:** after Meltdown, KPTI made every kernel entry switch page tables, which hurt
system-call-heavy workloads most. PCID softened it. Measure before optimising: `strace -c` or `perf trace -s`
shows where the calls are.
:::

::: details 7. What is the vDSO, and why does it exist?
It is a small shared library that the kernel maps into every process. It implements a few calls, mainly
reading the clock, entirely in user mode. The kernel keeps the time data in a read-only page shared with the
process, and the vDSO code reads it plus the CPU's own counter.

It exists because some programs read the time millions of times a second. Tens of nanoseconds instead of
a hundred or more adds up.

**Senior add-on:** it only works if the clock source is readable from user mode, such as `tsc` on x86. On some
virtual machines it falls back to a real system call, which is a known cause of unexplained slowdowns.
`strace` does not show vDSO calls. On x86-64 it covers `clock_gettime`, `gettimeofday`, `time`, `getcpu`, and
on recent kernels `getrandom`.
:::

::: details 8. Monolithic kernel or microkernel: what are the trade-offs?
A monolithic kernel runs all OS services in kernel mode, as one program. Calls between them are cheap function
calls, so it is fast. But a bug in any driver can crash or compromise the whole machine.

A microkernel keeps only threads, memory and messaging in kernel mode. Drivers and file systems run as user
processes. A crashed driver can be restarted, and the trusted code is small enough to verify. But each
request passes through several processes, so it costs more boundary crossings.

**Senior add-on:** Linux is monolithic with modules, but increasingly moves pieces out (FUSE, user-space
drivers) or runs checked code inside (eBPF). seL4 is formally verified; QNX is widely used in cars. Windows
and macOS are called hybrids. The L4 family showed that fast IPC makes microkernels competitive.
:::

::: details 9. How does a C program report a failed system call? What can go wrong with errno?
The kernel returns a negative error number. The libc wrapper returns `-1` and stores the positive error code in
`errno`. Each thread has its own `errno`.

Common mistakes:

- Reading `errno` without first checking that the call failed.
- Calling another function, such as `printf`, before reading it. That call may change it.
- Forgetting to retry on `EINTR` when a signal interrupts a waiting call.

**Senior add-on:** some functions, such as `getpriority`, can return `-1` as a valid result. Callers must set
`errno` to 0 before the call and check it afterwards. Raw kernel return values from −4095 to −1 mean errors.
:::

::: details 10. Scenario: after moving a service to new cloud instances, CPU use rose 20% with no code change. What could it be?
Start with `perf top` or a flame graph to see where the time goes. If it shows a lot of time in the kernel's
system call entry code, or in time-related kernel functions, suspect two things:

1. **The clock source.** If `clock_gettime` became a real system call, the vDSO is not working. Check
   `current_clocksource`, and look for many `clock_gettime` calls in `perf trace -s`.
2. **Security protections.** Different CPUs need different protections. Check
   `/sys/devices/system/cpu/vulnerabilities/`. Syscall-heavy code pays more on CPUs that need KPTI or heavier
   Spectre protections.

Also compare the CPU model, virtualization type and kernel version between old and new instances.

**Senior add-on:** fix the root cause (a vDSO-capable clock source), then reduce system calls on the hot path
with buffering or batching. Do not turn protections off on a shared machine.
:::

## Common misconceptions

- **"The kernel is a process that runs in the background."** It is code that runs when something enters it:
  a system call, an exception or an interrupt. It has some helper threads, but they are not "the kernel".
- **"A system call is a context switch."** It is a mode switch on the same thread. A context switch happens
  only if the call must wait.
- **"Every libc function is a system call."** `strlen` makes none, `printf` usually buffers, and
  `clock_gettime` usually uses the vDSO.
- **"Page faults mean something went wrong."** Most are normal: the kernel supplies memory on first use.
- **"Linux loads modules, so it is a microkernel."** Modules still run in kernel mode. Linux is monolithic.
- **"System calls cost microseconds."** A trivial one costs roughly 100 ns. Microseconds come from the work
  inside, from blocking, or from context switches.

## Key takeaways

- The **kernel** is code that runs in the CPU's privileged mode. It runs only when a system call, an
  exception or an interrupt enters it.
- **Hardware enforces** the boundary. User code can enter the kernel only at entry points the kernel chose.
- A **system call** is a deliberate trap: registers carry the request, the same thread runs the kernel code,
  and libc turns errors into `-1` and `errno`.
- A trivial system call costs **roughly 100 ns**, plus hidden cache costs. Fast systems buffer, batch, use the
  **vDSO**, use **io_uring**, or **bypass the kernel**.
- **Monolithic** kernels (Linux) trade isolation for speed; **microkernels** (seL4, QNX) trade speed for
  isolation.

## Review

<Flashcards id="what-is-an-os" :cards="cards" />

<MarkDone id="what-is-an-os" />
