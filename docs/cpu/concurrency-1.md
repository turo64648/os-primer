---
title: '9. Concurrency I: Locks & Deadlock'
---

<script setup>
import { cards } from './concurrency-1-review'
</script>

# 9. Concurrency I: Locks & Deadlock

When threads share memory, the order in which their steps run can change the result. This chapter covers the
bugs that follow and the tools that prevent them: locks, condition variables, semaphores, and the deadlocks
they can cause. Interviewers ask about these constantly, because they separate people who have debugged real
concurrent code from people who have only read about it.

::: info Before you start
- Threads of one process share the same memory. Each thread has its own registers and stack.
  [Chapter 2](/foundations/processes-and-threads) covers this.
- The scheduler can stop a thread after **any** instruction and run another one, on the same core or on
  another core at the same time. [Chapter 8](/cpu/scheduling) covers this.
- When a thread blocks, the kernel switches the core to another thread. That context switch costs a few
  microseconds.
:::

## Race conditions

**In short:** when two threads touch the same data and at least one writes, the result can depend on timing.
Even `counter++` is not one step.

### The lost update

Two threads each run `counter++` on a shared counter that starts at 0. You expect 2. But the CPU does not
increment memory in one step. It does three:

1. **Load:** copy `counter` from memory into a <Term id="register">register</Term> (a storage slot in the CPU).
2. **Add:** add 1 to the register.
3. **Store:** write the register back to `counter`.

Each <Term id="thread">thread</Term> has its own registers. Suppose thread 1 loads 0, then thread 2 loads 0.
Both add 1 and both store 1. The final value is 1: one increment is lost. This can happen when the scheduler
switches threads between steps on one core. It also happens when two cores run the threads at the same moment.

This is a <Term id="race-condition">race condition</Term>: the result depends on the timing of threads, and
some timings give a wrong answer. The code that touches the shared data, here the three steps, is a
<Term id="critical-section">critical section</Term>. Only one thread at a time should be inside it.

<RaceStepper />

Try these in the widget:

1. Run T1's three steps, then T2's. The counter ends at 2.
2. Press **Play the bad order**. Both threads read 0 before either writes, and the counter ends at 1.
3. Press **1000 random orders**. Many of them lose an update. On a real machine, switches between these
   steps are much rarer, so the bug shows up only now and then. That makes it hard to reproduce.
4. Switch to **With a mutex** and try again. The second thread cannot start its steps until the first one
   finishes, so the answer is always 2.

### Other shapes of the same bug

The lost update is a **read-modify-write** race. Two other shapes are as common:

- **Check-then-act.** `if (!cache.contains(k)) cache.put(k, load(k));` Two threads both see "missing" and
  both load. With files, `if (!exists(path)) create(path)` has the same problem. The name for that case is
  **time-of-check to time-of-use (TOCTOU)**, and it is also a security bug class.
- **Publishing half-built data.** One thread fills in a struct and then sets a pointer to it. Another thread
  sees the pointer but not yet all the fields. [Chapter 10](/cpu/concurrency-2) explains why the CPU and the
  compiler allow this.

::: warning A data race is undefined behaviour in C and C++
In C11 and C++11, two threads accessing the same variable at the same time, with at least one writing and no
synchronisation, is a <Term id="data-race">data race</Term>. The program's behaviour is then undefined. The
compiler assumes data races do not happen and may, for example, keep the variable in a register for a whole
loop. So "it is only a counter, a few lost updates are fine" is not a safe argument in C or C++.
:::

### Try it: lose updates on a real machine

```c
// race.c: gcc -O2 -pthread race.c -o race && ./race
#include <pthread.h>
#include <stdio.h>
#include <time.h>

#define N 10000000

static long counter;                 // shared by both threads
static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
static int use_lock;

static void *work(void *arg) {
    (void)arg;
    for (int i = 0; i < N; i++) {
        if (use_lock) pthread_mutex_lock(&m);
        counter++;                   // load, add, store
        if (use_lock) pthread_mutex_unlock(&m);
    }
    return NULL;
}

static void run(int lock) {
    struct timespec t0, t1;
    pthread_t a, b;
    counter = 0;
    use_lock = lock;
    clock_gettime(CLOCK_MONOTONIC, &t0);
    pthread_create(&a, NULL, work, NULL);
    pthread_create(&b, NULL, work, NULL);
    pthread_join(a, NULL);
    pthread_join(b, NULL);
    clock_gettime(CLOCK_MONOTONIC, &t1);
    double ms = (t1.tv_sec - t0.tv_sec) * 1e3 + (t1.tv_nsec - t0.tv_nsec) / 1e6;
    printf("%-10s counter = %8ld (expected %d), %6.1f ms\n",
           lock ? "mutex:" : "no lock:", counter, 2 * N, ms);
}

int main(void) {
    run(0);
    run(1);
    return 0;
}
```

Example output on a 4-core machine (your numbers will differ):

```text
no lock:   counter = 10746442 (expected 20000000),   25.8 ms
mutex:     counter = 20000000 (expected 20000000),  974.5 ms
```

Without a lock, about half the increments were lost. With a mutex, the answer is right, but the program is
about 40 times slower. The two threads fight over the lock on every increment. The lesson is not "locks are
slow". It is "do not share a hot variable between cores". Giving each thread its own counter and adding them
at the end would be both correct and fast.

::: details Going deeper: why the unlocked version is fast and wrong
Without the lock, each core keeps the counter in its own cache and the threads overwrite each other's
results. The compiler may also legally keep `counter` in a register for many iterations, because of the data
race rule above. A different compiler or flag could print a different wrong number. To make it both correct
and lock-free, use an atomic increment (`atomic_fetch_add`), covered in [Chapter 10](/cpu/concurrency-2).
:::

## Locks

**In short:** a lock lets only one thread at a time into a critical section. A spinlock waits by looping; a
mutex waits by sleeping. Both need special atomic instructions from the CPU.

### What a correct solution needs

A lock must give three properties:

- **Mutual exclusion:** at most one thread is inside the critical section.
- **Progress:** if the lock is free and threads want it, one of them gets it.
- **Bounded waiting:** no thread waits forever while others keep getting in.

You cannot build this efficiently with ordinary loads and stores on modern CPUs. "Check the flag, then set
it" is itself a check-then-act race. So CPUs provide an
<Term id="atomic-operation">atomic operation</Term>: an instruction that reads and writes a memory location
as one step that no other core can split. **Test-and-set** (or **exchange**) writes 1 and returns the old
value in one step. If the old value was 0, you have the lock. [Chapter 10](/cpu/concurrency-2) covers atomic
operations in depth.

### Spinlocks

A <Term id="spinlock">spinlock</Term> is the simplest lock. A thread that wants it runs test-and-set in a
loop until it gets it:

```c
while (atomic_exchange(&lock, 1) == 1)
    ;                                // spin: keep trying
/* critical section */
atomic_store(&lock, 0);              // release
```

Spinning burns CPU, so a spinlock only makes sense when:

- the lock is held for a **very short** time, less than the cost of sleeping and waking, and
- the thread holding it is **running on another core** right now, so it will release it soon.

If the holder is not running, for example because the scheduler preempted it, spinners waste their whole time
slice. On a single core, a spinning thread even stops the holder from running. That is why user-space code
rarely uses pure spinlocks.

Inside the <Term id="kernel">kernel</Term>, spinlocks are common. The kernel turns off preemption while a
spinlock is held, so the holder is always running. Interrupt handlers must use spinlocks, because they are not
allowed to sleep.

::: details Going deeper: better spinlocks
- **Test and test-and-set.** Spinning with an atomic write makes the lock's memory bounce between cores'
  caches. Good spinlocks first spin on a plain read, and only try the atomic write when the lock looks free.
- **The `pause` instruction** (on x86) inside the loop tells the CPU it is spinning. It saves power and helps
  the other hardware thread on the same core.
- **Fairness.** A plain spinlock can let one core win over and over. **Ticket locks** hand out numbers like a
  deli counter. Linux uses **queued spinlocks**, where each waiter spins on its own memory location.
- **In virtual machines**, the holder's virtual CPU may be paused by the host while others spin. This is
  called **lock-holder preemption**. Hypervisors detect long spinning, and Linux has paravirtual spinlocks
  that let a waiter give up its CPU instead.
:::

### Mutexes

A <Term id="mutex">mutex</Term> (from "mutual exclusion") is a lock whose waiters **sleep** instead of spin.
If the lock is taken, the thread asks the kernel to block it. When the holder unlocks, the kernel wakes a
waiter.

A modern mutex is cheap when nobody else wants it. Locking is one atomic instruction in user space, with no
system call: tens of nanoseconds. Only when the lock is **contended** does the thread enter the kernel. On
Linux it does that with the <Term id="futex">futex</Term> system call, which sleeps until the lock's memory
changes. A contended lock then costs a sleep, a wake-up and context switches: microseconds.

Many mutexes are **adaptive**. A waiter spins for a short time first, in case the holder is about to release
the lock, and only then sleeps. glibc offers this as an option, and the Go and Java runtimes do something
similar.

| | Spinlock | Mutex |
|---|---|---|
| Waiting thread | Loops, using its CPU | Sleeps; the core runs something else |
| Cost when free | One atomic instruction | One atomic instruction |
| Cost when contended | CPU time spent spinning | System call, context switches |
| Good for | Very short sections, holder surely running | Everything else |
| Where | Kernel, low-level runtimes | Application code |

::: details Going deeper: kinds of pthread mutex
- **Normal:** locking it twice from the same thread deadlocks.
- **Recursive:** the owner may lock it again; it must unlock the same number of times. Often a sign of
  unclear design, but useful when callbacks re-enter code.
- **Error-checking:** returns an error instead of deadlocking on misuse. Good for debugging.
- **Robust:** if the owner dies while holding it (possible with a mutex in shared memory between processes),
  the next locker gets `EOWNERDEAD` and can repair the data.
:::

### Lock granularity and contention

**Coarse-grained** locking uses one lock for a lot of data. It is simple and hard to get wrong, but threads
queue up behind it. **Fine-grained** locking uses many locks, for example one per hash bucket. It allows more
parallel work, but is harder to get right and makes deadlocks easier.

Famous coarse locks show the trade-off:

- Linux had a **Big Kernel Lock** that serialised much of the kernel. Removing it took years and finished in
  2.6.39 (2011).
- CPython's **global interpreter lock (GIL)** lets only one thread run Python code at a time. Python 3.13
  added an experimental build without it.

Some rules of thumb:

- **Hold locks briefly.** Never do I/O, network calls or other slow work while holding one.
- **Split hot locks.** Use one lock per shard, or per-thread data that is merged later.
- **Measure before refining.** A lock only matters if threads really wait for it. Contention shows up as
  many voluntary context switches, or as time spent in `futex` in an off-CPU profile.

## Condition variables

**In short:** a condition variable lets a thread sleep until another thread says something changed. Always
use it with a mutex, and always re-check the condition in a loop.

A lock stops threads from getting in each other's way. But often a thread needs to **wait for something**: a
consumer waits until a queue has an item. Checking in a loop wastes CPU. Sleeping for a fixed time and
checking again adds delay.

A <Term id="condition-variable">condition variable</Term> solves this. It has two operations:

- **wait(cv, mutex):** release the mutex and go to sleep, **as one step**. When woken, lock the mutex again
  before returning.
- **signal(cv)** wakes one waiting thread. **broadcast(cv)** wakes all of them.

The "as one step" part matters. If a thread released the mutex and then went to sleep separately, another
thread could add an item and signal in between. The signal would reach nobody, and the first thread would
sleep forever. That is a **lost wakeup**.

Here is a bounded queue, the classic producer-consumer example:

```c
// queue.c: gcc -O2 -pthread queue.c -o queue && ./queue
#include <pthread.h>
#include <stdio.h>

#define CAP 4                         // the queue holds at most 4 items

static int buf[CAP], head, count;
static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t not_empty = PTHREAD_COND_INITIALIZER;
static pthread_cond_t not_full = PTHREAD_COND_INITIALIZER;

static void put(int v) {
    pthread_mutex_lock(&m);
    while (count == CAP)              // a loop, not an if
        pthread_cond_wait(&not_full, &m);
    buf[(head + count) % CAP] = v;
    count++;
    pthread_cond_signal(&not_empty);
    pthread_mutex_unlock(&m);
}

static int get(void) {
    pthread_mutex_lock(&m);
    while (count == 0)
        pthread_cond_wait(&not_empty, &m);
    int v = buf[head];
    head = (head + 1) % CAP;
    count--;
    pthread_cond_signal(&not_full);
    pthread_mutex_unlock(&m);
    return v;
}

static void *producer(void *arg) {
    (void)arg;
    for (int i = 1; i <= 100000; i++) put(i);
    put(-1);                          // tell the consumer to stop
    return NULL;
}

int main(void) {
    pthread_t p;
    pthread_create(&p, NULL, producer, NULL);
    long sum = 0;
    for (int v; (v = get()) != -1;) sum += v;
    pthread_join(p, NULL);
    printf("sum = %ld (expected %ld)\n", sum, 100000L * 100001 / 2);
    return 0;
}
```

Output:

```text
sum = 5000050000 (expected 5000050000)
```

### The three rules

1. **Hold the mutex** while you check or change the shared state, and when you call wait.
2. **Wait in a `while` loop, not an `if`.** When a thread wakes, the condition may be false again. Another
   thread may have taken the item first. Also, POSIX allows **spurious wakeups**: a wait may return with
   nobody having signalled.
3. **Change the state before you signal.** The signal says "look again", not "here is your item".

Use **signal** when any one waiter can make progress, as in the queue. Use **broadcast** when the change may
matter to several waiters, or when waiters wait for different conditions on the same variable.

::: details Going deeper: Mesa and Hoare semantics
In the original design by Tony Hoare (1974), a signalled thread ran **immediately**, so the condition was
guaranteed to hold when it woke. Almost all real systems use **Mesa semantics** instead (named after the Mesa
language, 1980). The signalled thread only becomes runnable, and others may run first. That is the deep reason
for the `while` loop. Java's `wait`/`notify`, pthreads, C++ `std::condition_variable` and Go's `sync.Cond` all
use Mesa semantics.
:::

## Semaphores and monitors

**In short:** a semaphore is a counter that threads can wait on, good for limiting concurrency and for
signalling. A monitor packages data, a lock and condition variables together, as Java's `synchronized` does.

### Semaphores

A <Term id="semaphore">semaphore</Term>, invented by Edsger Dijkstra in the 1960s, is an integer with two
operations:

- **wait** (also called P, down or acquire): if the value is above 0, decrease it and continue. Otherwise
  sleep until it is above 0.
- **post** (also called V, up or release): increase the value and wake a waiter, if there is one.

A semaphore that starts at N lets at most N threads through at once. That makes it a natural fit for limits:
at most 10 open database connections, or at most 4 downloads in parallel.

A semaphore that starts at 0 works as a **signal**: one thread waits until another posts. A semaphore that
starts at 1 behaves like a lock, but with one big difference. A mutex has an **owner**: only the thread that
locked it may unlock it. A semaphore has no owner, so any thread may post. That is useful for signalling, but
it means the system cannot detect misuse, and cannot apply priority inheritance (see below).

POSIX offers `sem_wait` and `sem_post`. Linux also has System V semaphores, an older interface shared between
processes.

### Monitors

A <Term id="monitor">monitor</Term> is a language-level package: some data, one lock that is taken
automatically by every method, and condition variables for waiting. You cannot touch the data without holding
the lock, because the language does it for you.

Java is the best-known example. Every object has a built-in lock and one condition variable. A `synchronized`
method takes the lock, and `wait`, `notify` and `notifyAll` use the condition variable. The same three rules
apply, including the `while` loop around `wait`.

Some modern languages go further. In Rust, a `Mutex<T>` **contains** the data, and the compiler refuses code
that touches it without holding the lock. Go encourages passing data over channels, so that only one
goroutine owns it at a time.

## Deadlock

**In short:** a deadlock is a set of threads each waiting for another in the set, so none can ever continue.
It needs four conditions at once; the practical fix is to always take locks in the same order.

### How it happens

A bank moves money between accounts. Each account has a lock, and a transfer locks both accounts:

```c
void transfer(struct account *from, struct account *to, long amount) {
    pthread_mutex_lock(&from->lock);
    pthread_mutex_lock(&to->lock);
    from->balance -= amount;
    to->balance += amount;
    pthread_mutex_unlock(&to->lock);
    pthread_mutex_unlock(&from->lock);
}
```

Thread 1 runs `transfer(A, B)` and thread 2 runs `transfer(B, A)` at the same time. Thread 1 locks A.
Thread 2 locks B. Now thread 1 waits for B, and thread 2 waits for A. Neither will ever let go. This is a
<Term id="deadlock">deadlock</Term>.

<DeadlockDiagram />

The threads use no CPU. They sleep forever. From the outside, the program looks idle and stops responding.

### The four conditions

In 1971, Coffman, Elphick and Shoshani showed that a deadlock needs **all four** of these at once:

1. **Mutual exclusion:** a resource can be held by only one thread at a time.
2. **Hold and wait:** a thread holds one resource while it waits for another.
3. **No preemption:** a resource cannot be taken away; the holder must release it.
4. **Circular wait:** there is a cycle of threads, each waiting for the next one's resource.

Break any one, and deadlock is impossible. That gives a menu of fixes.

### Prevention: break a condition

| Condition to break | How | Catch |
|---|---|---|
| Circular wait | Always lock in one global order, for example by account ID or memory address | Needs discipline across the whole code base |
| Hold and wait | Take all locks at once; or use try-lock, and on failure release everything and retry | Retries can repeat forever (livelock) |
| No preemption | Time out and roll back (databases abort a transaction) | Work is thrown away and redone |
| Mutual exclusion | Avoid the lock: per-thread data, immutable data, lock-free structures | Not always possible |

**Lock ordering is the standard answer.** For the transfer, lock the account with the smaller ID first,
whichever direction the money goes. Then no cycle can form.

Two more habits prevent many real deadlocks:

- **Do not call unknown code while holding a lock.** A callback, a logger or a virtual method may take locks
  of its own in the opposite order.
- **Keep lock nesting shallow.** Every lock taken while holding another is an ordering rule someone must
  remember.

A try-lock with retry can fail in a different way. Two threads each take one lock, fail to get the second,
release, and retry in step, forever. They are busy but make no progress. This is a
<Term id="livelock">livelock</Term>, like two people in a corridor stepping aside the same way. Random
back-off before retrying fixes it. **Starvation** is related: the system progresses, but one unlucky thread
never gets the lock.

::: details Going deeper: avoidance and the banker's algorithm
Instead of forbidding cycles by rule, a system can check each request and refuse ones that could lead to
deadlock later. Dijkstra's **banker's algorithm** does this, but it requires every thread to declare its
maximum needs in advance. General-purpose operating systems do not use it. It appears in textbooks and in
some specialised resource managers.
:::

### Detection and recovery

The other approach is to let deadlocks happen, notice them, and break them.

Detection builds a **wait-for graph**: an arrow from each waiting thread to the thread it waits for. A cycle
in the graph is a deadlock. **Databases** do this routinely. They pick a victim transaction, abort it with an
error, and the application retries. MySQL's InnoDB checks on each lock wait. PostgreSQL first waits a
short time (`deadlock_timeout`, 1 second by default) and only then checks, because most waits end on their
own.

Operating systems usually do not recover from deadlocks between application threads. But tools find them:

- **Linux lockdep** records the order in which kernel locks are taken. It warns the first time two locks are
  taken in opposite orders, even if no deadlock happened yet.
- **The JVM** detects cycles of Java locks: `jstack <pid>` prints "Found one Java-level deadlock".
- **Go** reports "all goroutines are asleep - deadlock!" when every goroutine is blocked.
- **For any process**, take a stack dump of all threads (`gdb -p <pid> -batch -ex "thread apply all bt"`)
  and look for threads blocked on locks, each waiting for a lock another one holds.

### Deadlocks you do not see coming

- **Locking a normal mutex twice** in the same thread. The second lock waits for the first, forever.
- **Locking inside a signal handler.** If the signal arrives while the thread holds the same lock, the handler
  waits for itself. Signal handlers may only call "async-signal-safe" functions, which excludes `malloc` and
  `printf`.
- **`fork` in a multithreaded program.** The child gets a copy of memory, including locks held by other
  threads, but not those threads. If some thread held the `malloc` lock, the child's first `malloc` waits
  forever. POSIX says the child may only call async-signal-safe functions until it calls `exec`. Python's
  multiprocessing on Linux hit this for years, and Python 3.14 stopped using plain `fork` as its default.

## Priority inversion

**In short:** a high-priority thread can end up waiting for a medium-priority one, through a lock held by a
low-priority thread. Priority inheritance fixes it.

Recall from [Chapter 8](/cpu/scheduling) that with strict priorities, the highest-priority runnable thread
always runs. Now add a lock:

1. A **low**-priority thread takes a lock.
2. A **high**-priority thread wakes, runs, and asks for the same lock. It blocks.
3. A **medium**-priority thread wakes. It does not need the lock, but it outranks the low thread, so it runs.
4. The low thread cannot run, so it cannot release the lock. The high thread waits as long as the medium
   thread keeps running.

The high thread is effectively running at the lowest priority. This is
<Term id="priority-inversion">priority inversion</Term>.

<PriorityInversionDiagram />

It is famous because of **Mars Pathfinder** in 1997. The lander kept resetting itself on Mars. A
high-priority task waited for a mutex held by a low-priority weather task, while medium-priority
communication tasks ran. A watchdog saw the high-priority task miss its deadline and reset the system.
Engineers fixed it from Earth by turning on priority inheritance for that mutex.

The fixes:

- **Priority inheritance:** while a thread holds a lock that a higher-priority thread wants, it runs at that
  higher priority. In pthreads, set `PTHREAD_PRIO_INHERIT` on the mutex. On Linux this uses priority-inheriting
  futexes, and the real-time kernel build uses such locks inside the kernel too.
- **Priority ceiling:** a thread that takes the lock immediately runs at a fixed high priority set for that
  lock (`PTHREAD_PRIO_PROTECT`).
- **Design:** avoid sharing locks between threads of very different priorities.

The same pattern appears outside real-time systems. A low-priority background thread, a heavily `nice`d
process, or a throttled container can hold a lock that a latency-critical thread needs. The critical thread
then waits for however long the holder takes to get CPU time.

## Finding concurrency bugs

**In short:** races and deadlocks hide in rare timings, so testing alone rarely finds them. Use tools that
watch every memory access or every lock.

- **ThreadSanitizer (TSan):** compile with `-fsanitize=thread` (GCC or Clang). It reports data races as they
  happen in a run, with both stack traces. The program runs several times slower.
- **Helgrind and DRD** (part of Valgrind) find races and lock-order problems without recompiling, but slower.
- **Go's race detector** (`go test -race`) is TSan built into the toolchain.
- **Static checks:** Clang's thread-safety analysis (`-Wthread-safety`) checks annotations such as "this field
  is guarded by this mutex" at compile time.
- **Stress testing:** run many threads on few cores, add random sleeps, and repeat thousands of times. This
  makes rare orders more likely.

## Why this matters in real systems

**Databases.** Row locks, deadlock detection and "retry on deadlock" are everyday work. Taking rows in a
consistent order, such as by primary key, avoids most deadlocks between transactions.

**Language runtimes.** The Python GIL limits CPU parallelism in one process. That is why Python ML code does
heavy work in native libraries that release the GIL, or uses several processes. Java services often find
`synchronized` hot spots through thread dumps showing many threads `BLOCKED` on one monitor.

**Data loaders and `fork`.** ML data-loading code that forks worker processes after starting threads (for
example after OpenMP or CUDA initialised) can hang in the child on a lock held by a thread that no longer
exists. The usual fix is the `spawn` or `forkserver` start method.

**Connection pools and rate limits.** A pool of N connections, or a limit of N requests in flight, is a
counting semaphore, whatever the library calls it.

**The Linux kernel.** Spinlocks for short sections and interrupt handlers, mutexes where sleeping is allowed,
lockdep to catch ordering bugs during development, and priority-inheriting locks in the real-time build.

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. What is a race condition? Give an example.
A race condition is when the result depends on the timing of threads, and some timings give a wrong result.

Example: two threads run `counter++`. It is really three steps: load, add, store. If both load the same old
value before either stores, both write the same new value, and one increment is lost.

**Senior add-on:** in C and C++, unsynchronised concurrent access with a write is a data race, which is
undefined behaviour, not only a wrong number. Mention other shapes: check-then-act (TOCTOU) and publishing a
pointer to a half-built object.
:::

::: details 2. Spinlock or mutex: how do you choose?
A spinlock waits by looping, burning CPU. A mutex puts the waiter to sleep, so the core can do other work.

Use a spinlock only when the critical section is very short and the holder is surely running on another
core. That is typical in the kernel, where spinlocks disable preemption, and in interrupt handlers, which may
not sleep. Use a mutex everywhere else.

**Senior add-on:** uncontended, both cost one atomic instruction. A contended mutex costs a futex system call
and context switches, microseconds. Many mutexes are adaptive: they spin briefly, then sleep. In user space, a
spinning thread can waste its whole slice if the holder was preempted.
:::

::: details 3. What is the difference between a mutex and a semaphore?
A mutex is a lock with an owner: the thread that locked it must unlock it. A semaphore is a counter: wait
decreases it, or blocks at 0; post increases it. Any thread may post.

Use a mutex to protect data. Use a counting semaphore to limit concurrency to N, and a semaphore at 0 to
signal between threads.

**Senior add-on:** ownership lets a mutex support priority inheritance, error checking and recursive locking.
A semaphore can do none of these, because the system does not know who "holds" it.
:::

::: details 4. Why must you call wait on a condition variable inside a while loop?
When a waiting thread wakes, the condition may not hold any more. Another thread may have run first and
changed it back, for example by taking the item. POSIX also allows spurious wakeups, with no signal at all.
So the thread must check again, and wait again if needed.

**Senior add-on:** this follows from Mesa semantics: signal only makes a waiter runnable, it does not hand it
the lock. Also mention lost wakeups: wait must release the mutex and sleep in one step, and the state must
change under the mutex before the signal.
:::

::: details 5. What are the four conditions for deadlock, and how do you prevent it in practice?
Mutual exclusion, hold and wait, no preemption, and circular wait. All four must hold at once.

In practice, break circular wait with a global lock order. For example, always lock accounts in order of ID.
Other options: take all locks at once, use try-lock with release and random back-off, or use timeouts with
rollback.

**Senior add-on:** do not call unknown code (callbacks, logging) while holding a lock. Tools such as Linux
lockdep, TSan and Helgrind flag lock-order problems before a deadlock actually happens.
:::

::: details 6. Design a thread-safe transfer between two bank accounts.
Each account has a lock. Lock both accounts, always in the same order, for example the lower account ID
first. Check the balance, move the money, and unlock in reverse order.

If `from` and `to` are the same account, lock only once, or reject the transfer.

**Senior add-on:** in a database, the same idea applies: update rows in primary-key order, and handle
deadlock errors by retrying the transaction. If transfers are very frequent, consider sharding accounts or
using a single-writer queue per account.
:::

::: details 7. A production service has stopped responding and uses 0% CPU. How do you find out whether it is deadlocked?
Zero CPU with no progress suggests all threads are blocked. Take a stack dump of every thread:
`jstack` for Java, `gdb -p <pid> -batch -ex "thread apply all bt"` for native code, or a goroutine dump for Go
(`SIGQUIT`, or the pprof goroutine page).

Look for threads blocked on locks, and build the wait-for graph: which thread holds each lock and which
thread waits for it. A cycle is a deadlock. If there is no cycle, look for a thread blocked on I/O or an
external call while holding a lock everyone else needs.

**Senior add-on:** Java's `jstack` detects monitor deadlocks for you. `/proc/<pid>/task/*/wchan` and
`/proc/<pid>/task/*/stack` show where each thread sleeps in the kernel.
:::

::: details 8. What is priority inversion, and how is it fixed?
A low-priority thread holds a lock that a high-priority thread needs. A medium-priority thread runs instead of
the low one, so the lock is not released, and the high thread waits for the medium one.

The fix is priority inheritance: the lock holder temporarily gets the priority of the highest waiter, finishes
its critical section, and releases the lock. Another option is a priority ceiling. Mars Pathfinder is the
classic story.

**Senior add-on:** on Linux, pthread mutexes with `PTHREAD_PRIO_INHERIT` use PI futexes. The same pattern
appears in normal systems when a nice'd, throttled or preempted thread holds a hot lock.
:::

::: details 9. Is i++ atomic? What about in Java with volatile?
No. It is a load, an add and a store, and another thread can run between them. In C and C++, unsynchronised
concurrent `i++` is a data race and undefined behaviour.

Java's `volatile` makes each read and write visible to other threads, but `i++` is still three steps. Two
threads can still lose updates. Use `AtomicInteger.incrementAndGet()` or a lock.

**Senior add-on:** an atomic increment is one instruction such as `lock xadd` on x86. It is correct but still
slow when many cores hit the same variable, because its cache line moves between cores. Per-thread counters
merged later scale better. [Chapter 10](/cpu/concurrency-2) covers this.
:::

::: details 10. What is a livelock? How is it different from deadlock and starvation?
In a deadlock, threads sleep forever, each waiting for another. In a livelock, threads keep running and
reacting to each other, but nobody makes progress. An example is two threads that try-lock, fail, back off
and retry in step. In starvation, the system makes progress, but one thread never gets its turn.

Livelocks are fixed with random back-off. Starvation is fixed with fair locks or queues.

**Senior add-on:** fair locks (ticket locks, FIFO queues of waiters) prevent starvation but reduce throughput,
because a waiting thread must be woken up to take the lock even when a running thread could have taken it
right away.
:::

## Common misconceptions

- **"Races need multiple cores."** A single core can switch threads between any two instructions, which is
  enough.
- **"`volatile` makes code thread-safe."** In C and C++, `volatile` is for hardware registers. It gives neither
  atomicity nor ordering between threads. In Java it gives visibility and ordering, but not atomic `i++`.
- **"Spinlocks are faster than mutexes."** Only for very short sections with the holder running. Otherwise
  they waste CPU, and a good mutex already spins briefly before sleeping.
- **"A binary semaphore is a mutex."** It has no owner, so no priority inheritance and no misuse checks.
- **"Deadlocks show up in testing."** They need rare timing. Lock-order checkers find them far more reliably
  than tests.
- **"Signalling a condition variable hands the waiter what it waited for."** It only wakes it. The waiter must
  re-check the condition.

## Key takeaways

- A **race condition** comes from shared data plus unlucky timing. Even `x++` is three steps. In C/C++, a data
  race is undefined behaviour.
- **Spinlocks** loop and **mutexes** sleep. Both are one atomic instruction when free; contention is what
  costs.
- **Condition variables**: hold the mutex, wait in a `while` loop, change state before signalling.
- **Deadlock** needs four conditions. Break circular wait with a global lock order, and never call unknown
  code while holding a lock.
- **Priority inversion** lets medium work delay high-priority work through a lock. Priority inheritance fixes
  it.

## Review

<Flashcards id="concurrency-1" :cards="cards" />

<MarkDone id="concurrency-1" />
