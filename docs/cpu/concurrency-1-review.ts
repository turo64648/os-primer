// Flashcards for the Concurrency I chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'Why can two threads running <code>counter++</code> lose an update?',
    a: 'The increment is three steps: load, add, store. If both threads load the old value before either stores, both write the same result and one increment disappears.',
  },
  {
    q: 'Why do races happen even on a single-core machine?',
    a: 'The scheduler can switch threads between any two instructions. Stopping one thread between its load and its store is enough to lose an update.',
  },
  {
    q: 'Why is a data race worse than “a few wrong numbers” in C and C++?',
    a: 'It is undefined behaviour. The compiler assumes it never happens and may, for example, keep a shared variable in a register, so the program can misbehave in ways the source does not suggest.',
  },
  {
    q: 'What is a check-then-act race? Give an example.',
    a: 'A thread checks a condition, then acts on it, but another thread changes things in between. Example: two threads both see a cache key missing and both load it; or TOCTOU with files.',
  },
  {
    q: 'Why can’t you build a lock from ordinary loads and stores efficiently?',
    a: '“Check the flag, then set it” is itself a check-then-act race. The CPU must provide an atomic read-and-write instruction, such as exchange or compare-and-swap.',
  },
  {
    q: 'When is a spinlock the right choice?',
    a: 'When the critical section is very short and the holder is certainly running on another core. The kernel guarantees that by disabling preemption; interrupt handlers must spin because they cannot sleep.',
  },
  {
    q: 'What does a mutex cost when free, and when contended?',
    a: 'Free: one atomic instruction in user space, tens of nanoseconds. Contended: a futex system call to sleep, a wake-up and context switches, so microseconds.',
  },
  {
    q: 'Why does fine-grained locking help, and what does it cost?',
    a: 'More threads can work at once on different parts of the data. But there are more locks to get right, and more chances of taking them in inconsistent orders, which causes deadlocks.',
  },
  {
    q: 'Why must condition variable wait release the mutex and sleep as one step?',
    a: 'Otherwise another thread could change the state and signal in the gap, before the waiter sleeps. The signal would be lost and the waiter might sleep forever.',
  },
  {
    q: 'Why is <code>wait</code> always called in a <code>while</code> loop?',
    a: 'A woken thread only becomes runnable; another thread may change the state before it runs. POSIX also allows spurious wakeups. So it must check the condition again.',
  },
  {
    q: 'How does a semaphore differ from a mutex?',
    a: 'A semaphore is a counter with no owner: any thread may post. That suits limiting concurrency and signalling, but allows no priority inheritance or misuse checks. A mutex has an owner.',
  },
  {
    q: 'What is a monitor?',
    a: 'Data plus a lock that every method takes automatically, plus condition variables for waiting. Java’s <code>synchronized</code>, <code>wait</code> and <code>notify</code> are the best-known example.',
  },
  {
    q: 'What are the four conditions for deadlock?',
    a: 'Mutual exclusion, hold and wait, no preemption, and circular wait. All four must hold at once, so breaking any one prevents deadlock.',
  },
  {
    q: 'What is the most practical way to prevent deadlocks?',
    a: 'Always take locks in one global order, for example by ID or address. Then a cycle of waiting threads cannot form. Also avoid calling unknown code while holding a lock.',
  },
  {
    q: 'How do databases handle deadlocks?',
    a: 'They let them happen, find cycles in a wait-for graph, abort one victim transaction with an error, and expect the application to retry.',
  },
  {
    q: 'How does a livelock differ from a deadlock?',
    a: 'In a deadlock, threads sleep forever. In a livelock, they keep running and reacting to each other, such as retrying in step, but make no progress. Random back-off fixes it.',
  },
  {
    q: 'Why is <code>fork</code> in a multithreaded program dangerous?',
    a: 'The child copies memory, including locks held by other threads, but not those threads. A lock held at fork time, such as malloc’s, is never released in the child.',
  },
  {
    q: 'What is priority inversion, and how does priority inheritance fix it?',
    a: 'A high-priority thread waits for a lock held by a low-priority one, which medium threads keep off the CPU. With inheritance, the holder runs at the waiter’s high priority until it releases the lock.',
  },
]
