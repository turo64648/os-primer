// Flashcards for the Concurrency II chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'Why can’t a single thread notice memory reordering, while another thread can?',
    a: 'The compiler and the CPU both promise that a thread sees its own operations in program order. They only reorder in ways that thread cannot detect, but another thread reading the same memory can.',
  },
  {
    q: 'What are the two separate sources of reordering, and how do you control both?',
    a: 'The compiler (reordering, caching values in registers) and the CPU (store buffers, early loads). Atomics with memory orderings control both: the compiler avoids forbidden moves and emits the needed barrier instructions.',
  },
  {
    q: 'How does compare-and-swap let you build any atomic update?',
    a: 'Read the value, compute the new one, then CAS: it writes only if the value is unchanged. If another thread got there first, the CAS fails and you retry with the fresh value.',
  },
  {
    q: 'Why does “weak” compare-exchange exist?',
    a: 'On CPUs that build CAS from load-exclusive and store-exclusive, the store can fail for unrelated reasons. Weak CAS may fail spuriously, so it is used inside retry loops.',
  },
  {
    q: 'Why can a shared atomic counter be slow even though each increment is one instruction?',
    a: 'Each update needs exclusive ownership of the cache line, so the line moves between cores on every increment. Per-thread or per-CPU counters, summed on read, avoid this.',
  },
  {
    q: 'What single reordering does x86 allow, and why?',
    a: 'A store followed by a load of a different address. The store waits in the core’s store buffer while the load reads memory. All other pairs stay in order.',
  },
  {
    q: 'Why does code that works on x86 sometimes break on ARM?',
    a: 'ARM can reorder almost any pair of memory accesses, while x86 keeps most in order. Missing acquire/release orderings go unnoticed on x86 and cause rare failures on ARM.',
  },
  {
    q: 'What does a compiler barrier do, and what doesn’t it do?',
    a: 'It stops the compiler from moving memory accesses across it, but emits no instruction. The CPU can still reorder, so on weak hardware it is not enough.',
  },
  {
    q: 'How do release and acquire make a hand-off safe?',
    a: 'A release store keeps earlier accesses before it; an acquire load keeps later accesses after it. If the acquire reads the released value, everything before the release is visible after the acquire.',
  },
  {
    q: 'When is relaxed ordering correct?',
    a: 'When only the variable itself matters and no other data depends on it, such as a statistics counter. It guarantees atomicity but orders nothing else.',
  },
  {
    q: 'What does seq_cst add over acquire/release, and when do you need it?',
    a: 'One global order of all seq_cst operations that every thread agrees on. You need it for “set my flag, then read yours” patterns, where a later load must not pass an earlier store.',
  },
  {
    q: 'Why is <code>volatile</code> not a threading tool in C and C++?',
    a: 'It only forces each access to happen. It gives no atomicity and does not order other memory, and the CPU can still reorder. Use atomics. Java’s volatile is different and does order memory.',
  },
  {
    q: 'What is the ABA problem?',
    a: 'A CAS succeeds because a value looks unchanged, though it changed and changed back, for example a freed node’s address reused. In a lock-free stack this can link freed memory in.',
  },
  {
    q: 'How is ABA prevented?',
    a: 'Pair the pointer with a version counter and CAS both, or never reuse memory while a thread may still hold a pointer to it: hazard pointers, epoch-based reclamation, RCU, or a garbage collector.',
  },
  {
    q: 'Why does an uncontended futex-based mutex need no system call?',
    a: 'The lock is an integer in user memory taken with one atomic CAS. The kernel is only called to sleep when the lock is taken, or to wake someone when a waiter is marked.',
  },
  {
    q: 'How does FUTEX_WAIT avoid lost wakeups?',
    a: 'It sleeps only if the memory still holds the expected value, and the kernel checks this atomically with respect to wakes. If the lock was released just before, the call returns at once.',
  },
  {
    q: 'Why can a reader-writer lock be slower than a mutex?',
    a: 'Every reader still updates a shared reader count atomically, so with short read sections its cache line bounces between cores. It can also starve writers or readers.',
  },
  {
    q: 'How does RCU make reads almost free, and what does it cost?',
    a: 'Readers follow a pointer with no lock or shared write. Writers copy, update, publish a new pointer, then wait a grace period before freeing the old copy. Writes are slow and old versions use memory for a while.',
  },
]
