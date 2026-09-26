// Flashcards for the What an OS Is chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'Why is it wrong to picture the kernel as a background process watching everything?',
    a: 'Most of the time no kernel code runs. The kernel is code already mapped into every process that runs only when something enters it: a system call, an exception or an interrupt.',
  },
  {
    q: 'Why must the user/kernel boundary be enforced by hardware?',
    a: 'Any software check would itself run on the same CPU, so a hostile program could skip it. Only the CPU can refuse privileged instructions and kernel-only memory in user mode.',
  },
  {
    q: 'Why can user code enter kernel mode but never choose what kernel code runs?',
    a: 'The only ways in are entry points the kernel registered with the CPU at boot. Entering kernel mode always starts at one of those addresses.',
  },
  {
    q: 'How do an interrupt, an exception and a trap differ?',
    a: 'An interrupt comes from outside (device, timer, other core) at any moment. An exception is the current instruction failing. A trap is a deliberate exception, like a system call, and resumes at the next instruction.',
  },
  {
    q: 'Where does the program continue after an interrupt, a page fault, and a system call?',
    a: 'Interrupt: exactly where it stopped. Page fault: the same instruction runs again, now succeeding (or the process is killed). System call: the instruction after the trap.',
  },
  {
    q: 'How does the kernel regain the CPU from a thread stuck in while(1)?',
    a: 'A hardware timer interrupts each core regularly. On each tick the kernel runs, and the scheduler can switch the core to another thread. This is preemption.',
  },
  {
    q: 'How does a system call carry its request into the kernel?',
    a: 'libc puts the call number and up to six arguments in registers, then runs the trap instruction (<code>syscall</code> on x86-64). The result comes back in a register.',
  },
  {
    q: 'Why is a system call not a context switch?',
    a: 'The same thread keeps running, only in kernel mode, and returns to the same place. A context switch runs a different thread; it happens during a system call only if the call must wait.',
  },
  {
    q: 'Why must the kernel treat every system call argument as hostile?',
    a: 'Arguments come from untrusted code. A pointer could aim at kernel memory or nothing at all, so the kernel checks and copies with special functions and returns EFAULT instead of crashing.',
  },
  {
    q: 'How does a failed system call show up in C?',
    a: 'The kernel returns a negative error code. The libc wrapper returns -1 and stores the code in <code>errno</code>, which is per-thread and only meaningful right after a failure.',
  },
  {
    q: 'Roughly what does a trivial system call cost, compared with a function call?',
    a: 'On the order of 100 ns versus about 1 ns. It varies several times by CPU, kernel, security protections and virtualization.',
  },
  {
    q: 'What is the hidden cost of a system call?',
    a: 'Kernel code evicts the program’s data from the CPU caches and disturbs branch prediction, so the program runs slower for a while after returning. This can exceed the direct cost.',
  },
  {
    q: 'Why did system calls get more expensive after Meltdown?',
    a: 'The KPTI fix removes most of the kernel from the process’s page table in user mode, so every kernel entry and exit switches page tables. Syscall-heavy workloads paid most.',
  },
  {
    q: 'How can clock_gettime run without entering the kernel?',
    a: 'Through the vDSO: kernel-supplied code mapped into every process that reads time data the kernel publishes in a read-only page, plus the CPU’s own counter.',
  },
  {
    q: 'When does the vDSO silently stop helping?',
    a: 'When the clock source cannot be read from user mode, as on some virtual machines. clock_gettime then falls back to a real system call, and strace would now show it.',
  },
  {
    q: 'What are the main ways fast systems avoid system call overhead?',
    a: 'Buffer into fewer, bigger calls; batch (writev, recvmmsg, epoll); share queues with the kernel (io_uring); skip it (vDSO, futex fast path); or bypass it (DPDK, SPDK, RDMA).',
  },
  {
    q: 'Why is Linux called monolithic even though it loads modules?',
    a: 'Modules run in kernel mode as part of the one kernel program. A microkernel runs drivers and file systems as separate user-mode processes.',
  },
  {
    q: 'What does a microkernel gain and lose compared with a monolithic kernel?',
    a: 'It gains isolation: a driver crash stays in one restartable process, and the small kernel can be verified (seL4). It loses speed: requests cross the boundary several times as messages.',
  },
]
