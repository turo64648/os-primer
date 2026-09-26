---
title: '10. Concurrency II: Atomics & Memory Ordering'
---

<script setup>
import { cards } from './concurrency-2-review'
</script>

# 10. Concurrency II: Atomics & Memory Ordering

Locks are built from atomic instructions, and those instructions come with rules about the order in which
other cores see memory change. This chapter explains those rules, the tools built on them (futexes,
reader-writer locks, RCU), and the classic traps. Senior interviewers probe here to see whether you know why
code that works on your laptop can break on another CPU.

::: info Before you start
- A **race condition** is a bug where the result depends on thread timing, such as two threads losing an
  update to a counter. A **mutex** is a lock whose waiters sleep. [Chapter 9](/cpu/concurrency-1) covers both.
- Each CPU core has its own caches. Hardware keeps them consistent, but moving data between cores takes time.
  [Chapter 7](/memory/caches-and-numa) covers caches.
- Code examples use C11 atomics (`<stdatomic.h>`). C++ `std::atomic`, Rust and Java offer the same ideas
  under similar names.
:::

## The surprise: memory operations can appear out of order

**In short:** neither the compiler nor the CPU promises to perform your loads and stores in the order you
wrote them. Within one thread you cannot tell. Between threads you can.

Here is the simplest way threads hand data to each other. Thread 1 prepares some data and then raises a flag.
Thread 2 waits for the flag and then reads the data:

```c
int data = 0;
int ready = 0;

// thread 1                    // thread 2
data = 42;                     while (ready == 0) { }
ready = 1;                     printf("%d\n", data);
```

It looks as if thread 2 must print 42. It is not guaranteed, for two separate reasons.

**The compiler may reorder or remove accesses.** It optimises each thread as if no other thread existed. It
may store `ready` before `data`, because within thread 1 nothing can tell the difference. In thread 2, it may
read `ready` once, keep it in a register and loop forever, because nothing in the loop changes it.

**The CPU may reorder accesses.** Even if the machine code is in the right order, a core does not wait for
each store to reach memory before moving on. It may also start loads early. Another core can therefore see
thread 1's stores in a different order than they were written.

Within one thread, both kinds of reordering are invisible. The compiler and the CPU both promise that a single
thread sees its own operations in program order. The problem only appears when **another thread** looks at
memory. That is why ordinary single-threaded reasoning fails for shared data.

In C and C++, the code above has a **data race**: two threads access `ready` and `data` without
synchronisation, and one of them writes. Chapter 9 explained that this makes the program's behaviour
undefined. The fix is to tell the compiler and the CPU which orderings you need, using atomic operations.

## Atomic operations

**In short:** an atomic operation reads or writes memory as one step that no other thread can see half done.
Compare-and-swap is the building block for locks and lock-free code.

An <Term id="atomic-operation">atomic operation</Term> happens as one indivisible step. In C11 you get them
by declaring a variable `_Atomic` (or `atomic_int` and similar) and using these operations:

| Operation | What it does in one step | Typical use |
|---|---|---|
| `atomic_load`, `atomic_store` | Read or write the whole value | Flags, published pointers |
| `atomic_fetch_add` | Add, return the old value | Counters, handing out tickets |
| `atomic_exchange` | Write a new value, return the old one | Simple spinlocks |
| `atomic_compare_exchange` | If the value equals what you expected, replace it | Everything else |

### Compare-and-swap

<Term id="cas">Compare-and-swap (CAS)</Term> takes three things: an address, the value you expect to find
there, and the new value. If the address still holds the expected value, CAS writes the new value and
reports success. If another thread changed it in the meantime, CAS writes nothing and reports failure, along
with the value it found.

With CAS you can make any update atomic, using a retry loop. Read the current value, compute the new one,
and try to swap it in. If someone else got there first, try again with the fresh value:

```c
// Atomically set *max to v if v is larger.
void atomic_max(atomic_long *max, long v) {
    long cur = atomic_load(max);
    while (cur < v && !atomic_compare_exchange_weak(max, &cur, v))
        ;   // on failure, cur now holds the latest value; loop and re-check
}
```

The **weak** version may fail even when the value matched, so it belongs inside a loop. It exists because
some CPUs implement CAS with a pair of instructions that can fail for unrelated reasons (see below). The
**strong** version never fails spuriously. Use it when you are not in a loop.

::: details Going deeper: how CPUs implement atomics
- **x86** adds a `lock` prefix to ordinary instructions: `lock xadd` for fetch-and-add, `lock cmpxchg` for
  CAS. `xchg` with memory is always locked. The core takes exclusive ownership of the cache line for the
  duration.
- **ARM** traditionally uses a pair: **load-exclusive** (`ldxr`) reads and marks the location, and
  **store-exclusive** (`stxr`) writes only if nobody touched it since. If anything interfered, the store fails
  and the loop retries. That is where "weak" CAS comes from. ARMv8.1 added single atomic instructions (`cas`,
  `ldadd` and others, called LSE), which scale better under contention.
- **Double-width CAS** swaps two adjacent words at once: `cmpxchg16b` on x86-64, `casp` on ARMv8.1. It is used
  for pointer-plus-counter tricks (see ABA below).
:::

### What atomics cost

An atomic read-modify-write on a cache line that the core already owns costs on the order of tens of CPU
cycles. That is more than a plain add, but still only a few nanoseconds.

The real cost comes from **contention**. Only one core can own a cache line for writing at a time. When many
cores update the same atomic variable, the line moves from core to core on every update. Each move costs tens
to hundreds of nanoseconds, more across sockets. A single shared counter updated by 32 cores can be slower than
one core doing all the work.

The fixes are about data layout, not about better instructions:

- **Split the variable.** Give each thread or core its own counter, and add them up when someone reads the
  total. Linux does this with per-CPU counters.
- **Avoid false sharing.** Two unrelated variables on the same cache line (typically 64 bytes) bounce
  together, even though no data is shared. Pad or align hot per-thread data to a cache line.
  [Chapter 7](/memory/caches-and-numa) covers this.

## The memory model

**In short:** a memory model is the contract that says which values a load may return when threads share
memory. Hardware models differ between CPUs; the C/C++ model lets you state what you need once, and the
compiler maps it to each CPU.

### Sequential consistency: the model in your head

The simplest possible contract is **sequential consistency**, defined by Leslie Lamport in 1979. The result is
as if all threads' operations were interleaved into one single order, with each thread's operations in
program order. It is what most people assume without thinking.

No mainstream CPU gives sequential consistency for plain loads and stores. It would force each core to wait
for every store to become visible before continuing, which would be too slow.

### What x86 does: only one reordering

x86 CPUs follow a fairly strong model called **total store order (TSO)**. Each core puts its stores into a
private queue, its **store buffer**, and continues right away. The stores drain to the cache later, in order.

That produces exactly one visible reordering: **a store followed by a load of a different address**. The
load can complete while the earlier store still sits in the store buffer. Here is the classic test:

```text
x = 0, y = 0 at the start

thread 1          thread 2
x = 1             y = 1
r1 = y            r2 = x

Can both r1 and r2 end up 0?
```

Under sequential consistency, no. Whichever store comes first in the single order, the other thread's load
comes after it and sees 1. On x86, yes: both stores wait in store buffers while both loads read the old
values.

<StoreBufferDiagram />

Everything else stays in order on x86. Loads are not reordered with other loads, stores are not reordered with
other stores, and a store is not moved before an earlier load. All cores also agree on the order in which
stores become visible. Locked instructions (such as `lock xadd`) and the `mfence` instruction drain the
store buffer and act as full barriers.

### What ARM does: almost anything

ARM (phones, Apple silicon, AWS Graviton, many servers) and POWER have **weak** memory models. Without
explicit ordering, a core may reorder all four combinations: load-load, load-store, store-store and
store-load. In the message-passing example at the top, thread 2 can see `ready == 1` and still read the old
`data`, even if the compiler kept the code in order.

So ARM code needs ordering instructions where x86 needs none. ARMv8 has special load and store instructions
for this: **load-acquire** (`ldar`) and **store-release** (`stlr`), plus full barriers (`dmb`).

::: warning Works on x86, breaks on ARM
x86 already gives you most orderings for free. Code with missing or wrong memory orderings often passes every
test on x86 laptops and servers, then fails rarely on ARM machines. As more servers move to ARM, this bug
class shows up in production. The fix is to state the orderings correctly in the source, not to rely on the
CPU.
:::

::: details Going deeper: multi-copy atomicity
There is a subtler question: do all other cores see a given store at the same moment? On x86 and ARMv8, yes
(ARMv8 calls this "other-multi-copy atomic"): once a store leaves the store buffer, every other core sees it.
POWER does not promise this, so two readers on different cores can disagree about the order of two
independent stores. The C++ `seq_cst` ordering hides this difference, at a cost on POWER.
:::

### Compiler reordering is a separate problem

CPU ordering and compiler ordering are two layers, and you must control both:

- **Compiler barrier only.** `asm volatile("" ::: "memory")` (GCC and Clang), or `atomic_signal_fence`, stops
  the compiler from moving memory accesses across it. It emits no instruction, so the CPU may still reorder.
- **CPU barrier.** An instruction such as `mfence` or `dmb` orders the hardware. But if the compiler has
  already moved an access across it, it is too late.

C11 atomics with memory orderings handle both layers at once. You state the ordering you need; the compiler
avoids the forbidden reorderings and emits whatever barrier instructions the target CPU requires. That is
why you should use atomics instead of hand-written barriers.

::: warning volatile is not an atomic in C and C++
In C and C++, `volatile` means "every access must really happen", for memory-mapped hardware registers. It
does not make `x++` atomic, and it does not order other memory accesses around it. It is not a tool for
threads. Java's `volatile` is different: it gives atomic loads and stores of the variable and strong
ordering, close to `seq_cst` below.
:::

## C11 and C++ memory orderings

**In short:** every atomic operation takes an ordering. Relaxed gives atomicity only. Release on a store and
acquire on a load make a hand-off safe. Sequentially consistent, the default, adds one global order.

C11 and C++11 define one memory model for all CPUs. Each atomic operation takes a `memory_order` argument.
Here are the ones you need to know.

### Relaxed

`memory_order_relaxed` makes the operation itself atomic, and nothing more. There is no ordering with any
other memory access. All threads still agree on the order of updates to that one variable.

This is right when the variable itself is all that matters. The typical example is a statistics counter:
you need every increment counted, but no other data depends on the counter's value.

```c
atomic_fetch_add_explicit(&requests_served, 1, memory_order_relaxed);
```

### Release and acquire

These two work as a pair, and they fix the message-passing example:

- A **release** store says: every memory access I did **before** this store must be visible to anyone who
  sees this store. Nothing before it may move after it.
- An **acquire** load says: every memory access I do **after** this load must happen after it. Nothing after
  it may move before it.

When an acquire load reads the value written by a release store, the two threads **synchronise**. Everything
thread 1 did before the release is guaranteed visible to thread 2 after the acquire. The standard calls this
relationship **happens-before**.

```c
int data;                 // plain variable
atomic_int ready;

// thread 1
data = 42;
atomic_store_explicit(&ready, 1, memory_order_release);

// thread 2
while (atomic_load_explicit(&ready, memory_order_acquire) == 0)
    ;
printf("%d\n", data);     // guaranteed to print 42
```

Think of release as sealing an envelope and acquire as opening it. Everything put in before sealing is there
when it is opened. Locks work the same way: taking a lock is an acquire, releasing it is a release. That is
why data protected by a lock is always seen correctly by the next thread that takes the lock.

A read-modify-write operation, such as CAS, can be both at once with `memory_order_acq_rel`.

### Sequentially consistent

`memory_order_seq_cst` is the default when you write `atomic_load(&x)` or `x.load()`. It includes acquire and
release, and adds one thing: all `seq_cst` operations, on all variables, fall into **one single order** that
every thread agrees on.

Release and acquire do not fix the store-buffering test above. Each thread's store and load touch different
variables, and release/acquire does not stop a later load from moving before an earlier store. Only `seq_cst`
on all four operations forbids `r1 = r2 = 0`. Patterns like this appear in some lock algorithms and in
"set my flag, then check yours" handshakes.

| Ordering | Guarantees | Use for |
|---|---|---|
| `relaxed` | Atomicity of this variable only | Counters, statistics |
| `acquire` (loads) | Later accesses stay after it | Reading a flag or pointer before using the data |
| `release` (stores) | Earlier accesses stay before it | Publishing data, then setting a flag or pointer |
| `acq_rel` (read-modify-write) | Both | CAS in lock-free structures, lock acquisition |
| `seq_cst` (default) | Acquire/release plus one global order of all `seq_cst` operations | The default; "check each other's flag" patterns |

**Rule of thumb:** use the default `seq_cst` unless profiling shows the atomic is a bottleneck and you can
prove a weaker ordering is correct. A wrong weaker ordering is a bug that tests rarely find.

::: details Going deeper: what the orderings compile to
These mappings are what GCC and Clang typically emit:

| Operation | x86-64 | ARMv8 (AArch64) |
|---|---|---|
| relaxed load / store | `mov` / `mov` | `ldr` / `str` |
| acquire load | `mov` | `ldar` (or `ldapr` on ARMv8.3+) |
| release store | `mov` | `stlr` |
| seq_cst load | `mov` | `ldar` |
| seq_cst store | `xchg` (or `mov` + `mfence`) | `stlr` |
| read-modify-write | `lock`-prefixed instruction | `ldaxr`/`stlxr` loop, or an LSE instruction |

On x86, acquire and release cost nothing extra in hardware; only the compiler is restricted. Only the
`seq_cst` store pays for draining the store buffer. On ARMv8, `ldar` and `stlr` were designed so that
`seq_cst` needs no extra barriers.

There is also `memory_order_consume`, meant for data that depends on a loaded pointer. Compilers treat it as
`acquire`, and newer standards discourage it. Avoid it.

The Linux kernel predates C11 and has its own model and API: `READ_ONCE`, `WRITE_ONCE`, `smp_load_acquire`,
`smp_store_release` and `smp_mb`. Its formal model is documented in `tools/memory-model/`.
:::

### Try it: catch the CPU reordering

This program runs the store-buffering test many times, first with relaxed atomics and then with the default
`seq_cst`. It counts how often both threads read 0:

```c
// sb.c: gcc -O2 -pthread sb.c -o sb && ./sb
#include <pthread.h>
#include <semaphore.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>

#define RUNS 200000

static atomic_int x, y;
static int r1, r2, strong;            // strong = 1: use seq_cst
static sem_t go1, go2, done;

static void pause_randomly(unsigned *seed) {
    while (rand_r(seed) % 8 != 0) {}  // make the two threads overlap
}

static void *t1(void *arg) {
    unsigned seed = 1;
    (void)arg;
    for (int i = 0; i < RUNS; i++) {
        sem_wait(&go1);
        pause_randomly(&seed);
        if (strong) { atomic_store(&x, 1); r1 = atomic_load(&y); }
        else {
            atomic_store_explicit(&x, 1, memory_order_relaxed);
            r1 = atomic_load_explicit(&y, memory_order_relaxed);
        }
        sem_post(&done);
    }
    return NULL;
}

static void *t2(void *arg) {
    unsigned seed = 2;
    (void)arg;
    for (int i = 0; i < RUNS; i++) {
        sem_wait(&go2);
        pause_randomly(&seed);
        if (strong) { atomic_store(&y, 1); r2 = atomic_load(&x); }
        else {
            atomic_store_explicit(&y, 1, memory_order_relaxed);
            r2 = atomic_load_explicit(&x, memory_order_relaxed);
        }
        sem_post(&done);
    }
    return NULL;
}

static void run(int s) {
    pthread_t a, b;
    int both_zero = 0;
    strong = s;
    pthread_create(&a, NULL, t1, NULL);
    pthread_create(&b, NULL, t2, NULL);
    for (int i = 0; i < RUNS; i++) {
        atomic_store(&x, 0);
        atomic_store(&y, 0);
        sem_post(&go1);
        sem_post(&go2);
        sem_wait(&done);
        sem_wait(&done);
        if (r1 == 0 && r2 == 0) both_zero++;
    }
    pthread_join(a, NULL);
    pthread_join(b, NULL);
    printf("%-8s r1 = r2 = 0 in %d of %d runs\n", s ? "seq_cst:" : "relaxed:", both_zero, RUNS);
}

int main(void) {
    sem_init(&go1, 0, 0);
    sem_init(&go2, 0, 0);
    sem_init(&done, 0, 0);
    run(0);
    run(1);
    return 0;
}
```

Example output on an x86-64 machine with 4 cores (it takes a few seconds; counts vary):

```text
relaxed: r1 = r2 = 0 in 25 of 200000 runs
seq_cst: r1 = r2 = 0 in 0 of 200000 runs
```

The "impossible" outcome appeared 25 times with relaxed atomics, and never with `seq_cst`. On x86, the
compiler emits an `xchg` for each `seq_cst` store, which drains the store buffer. The rarity is the point: a
bug that shows up a few times in 200,000 runs will pass most tests.

::: details Going deeper: why the numbers are small
The two threads only overlap by chance, within a window of a few nanoseconds, because each run starts with a
semaphore wake-up. Tools such as `herd7` and the `litmus7` test harness explore such tests systematically,
and the Linux kernel ships a catalogue of them.
:::

### A classic trap: double-checked locking

A common pattern is lazy initialisation: create an object on first use, and skip the lock afterwards.

```c
static struct config *_Atomic cfg;
static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;

struct config *get_config(void) {
    struct config *c = atomic_load_explicit(&cfg, memory_order_acquire);
    if (c == NULL) {
        pthread_mutex_lock(&m);
        c = atomic_load_explicit(&cfg, memory_order_relaxed);   // check again under the lock
        if (c == NULL) {
            c = load_config();                                  // fill in all fields
            atomic_store_explicit(&cfg, c, memory_order_release);
        }
        pthread_mutex_unlock(&m);
    }
    return c;
}
```

Before C11 and C++11, people wrote this with a plain pointer. Another thread could see the pointer before the
object's fields, and use a half-built object. The release store and the acquire load fix it. Java had the same
bug until Java 5 gave `volatile` its current meaning. In practice, use the library: `pthread_once`, C++
function-local statics, or Java's holder-class idiom.

### Other languages

- **Java:** `volatile` fields and the `java.util.concurrent.atomic` classes behave like `seq_cst`. Newer
  `VarHandle` methods offer acquire, release and relaxed ("opaque", "plain") access.
- **Go:** the `sync/atomic` functions are sequentially consistent. Go offers no weaker orderings.
- **Rust:** uses the C++ orderings under the same names (`Ordering::Relaxed`, `Acquire`, `Release`, `AcqRel`,
  `SeqCst`).

## Lock-free programming and the ABA problem

**In short:** lock-free code uses CAS loops instead of locks, so a stalled thread cannot block the others. The
hard part is memory reuse: a CAS can succeed on a value that looks unchanged but is not, which is the ABA
problem.

A data structure is **lock-free** if some thread always makes progress, even if other threads are paused at
any point. With a lock, a thread that is preempted while holding it stops everyone waiting for it. Lock-free
code avoids that. **Wait-free** is stronger: every thread finishes in a bounded number of steps.

Lock-free does not mean faster. Under heavy contention, CAS loops retry a lot and the cache line still
bounces. The main benefits are that no thread can block others, and that code can be safe in places where
locks are not allowed, such as signal handlers.

### A lock-free stack

The simplest lock-free structure is a stack (known as the Treiber stack). The top is an atomic pointer.
To push, point the new node at the current top, then CAS the top from the old value to the new node. If the
CAS fails, another thread changed the top, so re-read and retry. Pop works the same way in reverse:

```c
struct node { struct node *next; int value; };
static struct node *_Atomic top;

struct node *pop(void) {
    struct node *old = atomic_load(&top);
    while (old && !atomic_compare_exchange_weak(&top, &old, old->next))
        ;                           // top changed: old now holds the new top; retry
    return old;
}
```

### The ABA problem

CAS checks that the value is the **same**, not that **nothing happened**. Watch what can go wrong in `pop`:

1. Thread 1 reads `top = A` and `A->next = B`. It is about to CAS `top` from A to B. It gets preempted.
2. Thread 2 pops A, pops B, and frees B.
3. Thread 2 pushes A back. Or it allocates a new node that happens to reuse A's address.
4. Thread 1 resumes. Its CAS sees `top == A`, as expected, and succeeds. It sets `top` to B, which has been
   freed.

The stack now points to freed memory. The value went from A to B and back to A, hence the name
<Term id="aba-problem">ABA problem</Term>.

Fixes:

- **Tagged pointers:** keep a counter next to the pointer and increase it on every change. CAS both together,
  with a double-width CAS or spare pointer bits. A reused A now has a different tag.
- **Safe memory reclamation:** never free or reuse a node while any thread might still hold a pointer to it.
  **Hazard pointers** (each thread announces the pointers it is using) and **epoch-based reclamation** do
  this. So does RCU, below.
- **Garbage collection:** in Java or Go, a node cannot be reused while a thread still references it. That
  removes the most common form of ABA, which is one reason lock-free code is easier in those languages.

::: tip In practice
Use well-tested libraries for lock-free structures (for example `java.util.concurrent`, Rust's `crossbeam`,
or Folly and Abseil in C++). Interviewers want you to understand CAS, the ABA problem and why memory
reclamation is the hard part. They rarely expect you to write a lock-free queue on a whiteboard.
:::

## futex: how user-space locks sleep

**In short:** a futex lets a lock live in ordinary user memory. Locking and unlocking are plain atomic
operations. Only when a thread must wait does it make a system call, and the kernel puts it to sleep on that
address.

Before futexes, every lock operation on Linux needed a system call, even when nobody else wanted the lock.
The <Term id="futex">futex</Term> ("fast user-space mutex"), added in Linux 2.6, fixed that. It has two main
operations:

- **`FUTEX_WAIT(addr, expected)`:** if the integer at `addr` still equals `expected`, sleep until woken.
  Otherwise, return at once.
- **`FUTEX_WAKE(addr, n)`:** wake up to `n` threads sleeping on `addr`.

The value check in `FUTEX_WAIT` is the key. The kernel checks and goes to sleep as one step, with respect to
wake-ups. If the lock was released between the thread's last look and the system call, the value no longer
matches, and the thread does not sleep. This is how futexes avoid the lost-wakeup problem from
[Chapter 9](/cpu/concurrency-1).

The kernel has no futex object to create or destroy. When no one waits, the kernel knows nothing about the
lock. When someone waits, the kernel keeps a queue for that address in a hash table.

### Try it: a mutex from a futex

This is a simplified version of the mutex in Ulrich Drepper's paper "Futexes Are Tricky". The lock word
has three states, so that unlocking can skip the system call when nobody is asleep:

```c
// futex.c: gcc -O2 -pthread futex.c -o futex && ./futex
#define _GNU_SOURCE
#include <linux/futex.h>
#include <pthread.h>
#include <stdatomic.h>
#include <stdio.h>
#include <sys/syscall.h>
#include <unistd.h>

// Lock word: 0 = unlocked, 1 = locked, 2 = locked and someone may be asleep.
static atomic_int lock_word;
static long counter;
static atomic_long sleeps;                        // how often a thread slept

static void futex_wait(atomic_int *addr, int expected) {
    atomic_fetch_add_explicit(&sleeps, 1, memory_order_relaxed);
    syscall(SYS_futex, addr, FUTEX_WAIT_PRIVATE, expected, NULL, NULL, 0);
}
static void futex_wake_one(atomic_int *addr) {
    syscall(SYS_futex, addr, FUTEX_WAKE_PRIVATE, 1, NULL, NULL, 0);
}

static void lock(void) {
    int c = 0;
    if (atomic_compare_exchange_strong(&lock_word, &c, 1))
        return;                                   // fast path: no system call
    if (c != 2) c = atomic_exchange(&lock_word, 2);
    while (c != 0) {                              // slow path: sleep in the kernel
        futex_wait(&lock_word, 2);                // sleeps only if still 2
        c = atomic_exchange(&lock_word, 2);
    }
}

static void unlock(void) {
    if (atomic_exchange(&lock_word, 0) == 2)      // someone may be waiting
        futex_wake_one(&lock_word);
}

static void *work(void *arg) {
    (void)arg;
    for (int i = 0; i < 1000000; i++) {
        lock();
        counter++;
        unlock();
    }
    return NULL;
}

int main(void) {
    pthread_t t[4];
    for (int i = 0; i < 4; i++) pthread_create(&t[i], NULL, work, NULL);
    for (int i = 0; i < 4; i++) pthread_join(t[i], NULL);
    printf("counter = %ld (expected 4000000)\n", counter);
    printf("slept in the kernel %ld times\n", atomic_load(&sleeps));
    return 0;
}
```

Example output on a 4-core machine:

```text
counter = 4000000 (expected 4000000)
slept in the kernel 202371 times
```

Four threads fight over one lock as hard as they can, yet about 95% of the 4 million lock operations never
entered the kernel. In a real program, where threads do other work between locks, the share is usually much
higher. That is why an uncontended mutex costs about as much as one atomic instruction.

::: details Going deeper: more futex features
- **`FUTEX_REQUEUE`** moves waiters from one futex to another without waking them. Condition variables use it
  so a broadcast does not wake every waiter only to have them fight for the mutex.
- **Priority-inheritance futexes** (`FUTEX_LOCK_PI`) let the kernel boost a lock holder, as described in
  Chapter 9. The kernel must then know the owner, so the lock word holds the owner's thread ID.
- **`futex_waitv`** (Linux 5.16) waits on several futexes at once. It was added for Windows games running
  under Wine and Proton.
- Everything built on futexes, such as glibc mutexes, condition variables, semaphores and Go's runtime locks,
  shows up in `strace` and off-CPU profiles as `futex` calls. Lots of time in `futex` usually means lock
  contention.
:::

## Reader-writer locks

**In short:** a reader-writer lock lets many readers in at once, or one writer alone. It helps only when
reads are frequent and long; for short sections it can be slower than a mutex.

Much shared data is read far more often than it is written: configuration, routing tables, caches. A mutex
lets only one reader in at a time, which wastes parallelism. A <Term id="rwlock">reader-writer lock</Term>
has two modes:

- **Read (shared):** any number of readers may hold it at once.
- **Write (exclusive):** one writer, and no readers.

It sounds like a free win, but there are catches:

- **Readers still write memory.** Taking a read lock updates a shared count of readers, with an atomic
  operation on one cache line. With short read sections on many cores, that line bounces between cores, and a
  plain mutex can be as fast or faster.
- **Someone can starve.** If new readers keep arriving, a waiting writer may never get in. If writers get
  priority, readers may wait. Implementations pick a policy. glibc's default prefers readers, so writers can
  starve.
- **Upgrading deadlocks.** Two readers that both try to become writers while holding the read lock each wait
  for the other to leave.

### Seqlocks

A **sequence lock** (seqlock) takes the idea further for small data that is written rarely. The writer
increases a counter before and after each update, so the counter is odd while a write is in progress. A
reader reads the counter, reads the data, and reads the counter again. If the counter changed or was odd, the
reader retries.

Readers never write to shared memory at all, so they scale perfectly. The costs are retries, and that readers
may briefly see torn data, which they must not act on before checking. Linux uses seqlocks for timekeeping:
the <Term id="vdso">vDSO</Term> reads the clock this way from user space.

## RCU: read-copy-update

**In short:** with RCU, readers take no lock at all. A writer copies the data, changes the copy, publishes it
by swapping a pointer, and frees the old copy only after every reader that might see it has finished.

<Term id="rcu">RCU</Term> is the Linux kernel's favourite tool for read-mostly data, and it is used in
thousands of places: routing tables, the file-name cache, lists of modules and much more. It works like this:

1. **Readers** mark the start and end of their read section (`rcu_read_lock`, `rcu_read_unlock`), follow
   the pointer, and read. In many kernel builds, marking the section costs almost nothing: no atomic
   operation, no shared write.
2. **A writer** makes a **copy** of the object, changes the copy, and then **publishes** it by storing the
   new pointer with release ordering. New readers see the new version. Readers already running may still use
   the old one.
3. The writer then waits for a **grace period**: until every reader that started before the publish has
   finished. After that, no one can hold the old pointer, so the writer frees it.

<RcuDiagram />

How does the kernel know all old readers have finished, without tracking them? In the classic design,
readers may not sleep or be preempted inside a read section. So once every CPU has passed through a context
switch, or been idle, or run user code, no old reader can remain. The grace period is over.

The trade-off is clear:

- **Readers** are as fast as reading without any synchronisation, and never wait.
- **Writers** are slow: copying, and waiting for grace periods of milliseconds. Writers still need a lock
  among themselves.
- **Memory** for old versions stays allocated until the grace period ends.

RCU is also a memory-reclamation scheme, the problem that makes lock-free code hard. It solves ABA-style
reuse, because nothing is freed while a reader might still hold it. Outside the kernel, the `liburcu` library
provides RCU for user-space programs.

## Why this matters in real systems

**Code ported to ARM.** Services moving to ARM servers such as AWS Graviton, or to Apple silicon, sometimes
hit rare crashes in hand-written lock-free code or double-checked locking. The orderings were wrong all along;
x86 hid the bug.

**Metrics and counters.** A global atomic counter updated on every request can become the hottest cache line
in a busy service. Per-thread or per-CPU counters, summed when read, fix it. Java's `LongAdder` does this.

**Configuration and routing tables.** Read constantly, written rarely. Good designs publish a new immutable
version through an atomic pointer, and readers load the pointer with acquire. That is RCU in spirit, and in
garbage-collected languages it needs no grace-period machinery.

**Lock contention shows up as futex.** When `strace -c` or an off-CPU profile shows lots of time in `futex`,
threads are waiting for locks or condition variables. The fix is usually in data layout: shard the lock, or
stop sharing the data.

**ML and GPU systems.** Data loaders, parameter servers and inference servers use lock-free queues and
ring buffers between threads. The same release/acquire hand-off also appears between a CPU and a device, where
the "other thread" is a GPU or network card reading memory. Device drivers use barriers for exactly this
reason.

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. What is compare-and-swap, and how do you build an atomic update from it?
CAS atomically checks that a memory location holds an expected value and, if so, replaces it with a new
value. It reports whether it succeeded.

To update atomically, read the current value, compute the new one, and CAS. If the CAS fails, another thread
changed the value first, so re-read and retry.

**Senior add-on:** "weak" CAS may fail spuriously because ARM implements it with load-exclusive and
store-exclusive, so use it in loops. Under heavy contention, CAS loops retry a lot and the cache line bounces;
fetch-and-add or per-thread data scale better.
:::

::: details 2. Why can the message-passing example print 0 instead of 42?
Two reasons. The compiler may reorder the two stores, or keep the flag in a register, because it optimises
each thread alone. The CPU may make the stores visible to other cores in a different order, or perform the
reader's loads early.

The fix is a release store for the flag and an acquire load in the reader. Then everything written before the
release is visible after the acquire. In C and C++, without atomics the code has a data race, which is
undefined behaviour.

**Senior add-on:** on x86 the hardware would keep this example in order, so only the compiler would break it.
On ARM, the hardware alone can break it.
:::

::: details 3. Explain acquire, release, relaxed and seq_cst.
**Relaxed:** the operation is atomic, but orders nothing else. Good for counters.

**Release (on a store):** accesses before it cannot move after it. **Acquire (on a load):** accesses after it
cannot move before it. When an acquire reads what a release wrote, everything before the release is visible
after the acquire. That is how locks and hand-offs work.

**Seq_cst:** acquire and release, plus one global order of all seq_cst operations that all threads agree on.
It is the default.

**Senior add-on:** only seq_cst prevents the store-buffering outcome (each thread writes one flag and reads the
other's). On x86, acquire and release are free in hardware; a seq_cst store costs an `xchg`. On ARMv8 they map
to `ldar`/`stlr`.
:::

::: details 4. What does the x86 memory model allow that sequential consistency does not?
x86 uses total store order. Each core's stores go into a store buffer. A later load of a different address can
complete before the store is visible to others. So "store, then load another address" can appear reordered.
The store-buffering test can give `r1 = r2 = 0`.

Other orders are preserved: load-load, store-store and load-store.

**Senior add-on:** `mfence` or any `lock`-prefixed instruction drains the store buffer. ARM and POWER allow all
four reorderings, so code tested only on x86 can hide ordering bugs.
:::

::: details 5. What is the ABA problem? How do you fix it?
A CAS only checks that a value is the same as before. If the value changed from A to B and back to A, the CAS
succeeds, though the state underneath changed. In a lock-free stack, a popped and freed node's address can be
reused and pushed back, and a stale CAS then links freed memory into the stack.

Fixes: add a version counter next to the pointer and CAS both (tagged pointers, double-width CAS), or make sure
memory is not reused while any thread may hold a pointer to it: hazard pointers, epochs, RCU, or garbage
collection.

**Senior add-on:** the deeper problem is safe memory reclamation in lock-free code. ARM's load-exclusive and
store-exclusive detect any intervening write, but compilers expose them only as CAS, so the ABA problem stays.
:::

::: details 6. How does a futex-based mutex work?
The lock is an integer in user memory. Locking is a CAS from unlocked to locked, with no system call. If the
lock is taken, the thread marks it "contended" and calls `FUTEX_WAIT`. The kernel puts it to sleep only if the
value is still what the thread expected. Unlocking sets the value to unlocked and, only if it was marked
contended, calls `FUTEX_WAKE`.

**Senior add-on:** the check in `FUTEX_WAIT` is what prevents lost wakeups. The kernel keeps no state for a
futex without waiters. Condition variables use requeue; priority-inheritance futexes store the owner's thread
ID in the lock word.
:::

::: details 7. When does a reader-writer lock help, and when does it hurt?
It helps when reads are much more frequent than writes and the read sections are long enough that running
them in parallel matters.

It hurts when read sections are short. Every read lock and unlock still writes a shared counter, and that
cache line bounces between cores, so a plain mutex may be as fast. It can also starve writers or readers,
depending on the policy, and upgrading from read to write can deadlock.

**Senior add-on:** for read-mostly data where reads must scale, readers must not write shared memory at all:
use a seqlock, RCU, or per-CPU reader counts.
:::

::: details 8. Explain RCU. What are its trade-offs?
Readers take no lock and do not write shared memory; they follow a pointer and read. A writer copies the data,
changes the copy, and publishes it by swapping the pointer with release ordering. It then waits for a grace
period, until every reader that started before the swap has finished, and frees the old copy.

Readers are nearly free and never block. Writers are slow, must coordinate among themselves, and old versions
use memory until the grace period ends.

**Senior add-on:** in the classic kernel design, readers cannot be preempted, so once every CPU has context
switched or been idle, the grace period is over. RCU is also a safe memory-reclamation scheme, the same
problem that hazard pointers and epochs solve for lock-free code.
:::

::: details 9. Is volatile enough to share a flag between threads in C? In Java?
In C and C++, no. `volatile` only stops the compiler from removing or merging accesses. It gives no atomicity
and no ordering of other memory, and the CPU can still reorder. Use `_Atomic` or `std::atomic`.

In Java, a `volatile` flag is fine for publishing: its writes and reads are atomic and ordered, and data
written before the volatile write is visible after the volatile read. But `count++` on a volatile is still
not atomic.

**Senior add-on:** Java's `volatile` gives roughly sequentially consistent semantics; C++'s `volatile` is for
memory-mapped hardware.
:::

::: details 10. A shared atomic counter is a bottleneck on a 64-core machine. What do you do?
Every increment needs exclusive ownership of the counter's cache line, so the line moves between cores on
every update. The fix is to stop sharing: give each thread or CPU its own counter, padded to its own cache
line, and sum them when reading. Relaxed ordering is enough for pure statistics.

**Senior add-on:** Java's `LongAdder` and Linux's per-CPU counters do this. Also check for false sharing:
unrelated hot variables that happen to share a cache line with the counter.
:::

## Common misconceptions

- **"If each instruction is atomic, the program is correct."** Atomicity and ordering are separate. A relaxed
  flag can be seen before the data it protects.
- **"x86 is sequentially consistent."** It allows store-then-load reordering, which breaks "set my flag, check
  yours" code unless you use `seq_cst` or a fence.
- **"A compiler barrier is enough."** It stops the compiler, not the CPU. On ARM, the hardware still reorders.
- **"Lock-free means faster."** It means no thread can block others. Under contention, CAS retries and cache
  line bouncing can make it slower than a good lock.
- **"Reader-writer locks always beat mutexes for read-heavy data."** With short read sections, the shared
  reader count becomes the bottleneck.
- **"`volatile` makes a variable thread-safe."** Not in C or C++. In Java it gives visibility and ordering,
  but not atomic read-modify-write.

## Key takeaways

- The **compiler and the CPU both reorder** memory accesses. Only other threads can tell, so shared data needs
  atomics or locks.
- **x86** only reorders a store with a later load (store buffer). **ARM** can reorder almost anything. Correct
  orderings in the source work on both.
- **Release/acquire** makes hand-offs safe; **seq_cst** (the default) adds one global order; **relaxed** is for
  counters. When unsure, use the default.
- **CAS** builds atomic updates and lock-free structures. The **ABA problem** and safe memory reclamation are
  the hard parts.
- **Futexes** make uncontended locks free of system calls. **Reader-writer locks**, **seqlocks** and **RCU**
  trade writer cost for reader speed.

## Review

<Flashcards id="concurrency-2" :cards="cards" />

<MarkDone id="concurrency-2" />
