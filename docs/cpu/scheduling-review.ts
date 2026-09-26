// Flashcards for the Scheduling & Context Switches chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'Why do only some of a machine’s threads compete for the CPU?',
    a: 'Most threads are blocked, waiting for I/O, a lock or a timer. Only runnable threads (running, or ready and waiting in a run queue) need a core.',
  },
  {
    q: 'Why can’t one scheduler be best at everything?',
    a: 'The goals conflict. Short slices improve response time but add switching, which lowers throughput. Shortest-first minimises average wait but can starve long jobs.',
  },
  {
    q: 'What is the convoy effect, and which algorithm suffers from it?',
    a: 'Short jobs stuck waiting behind one long job. It happens in first come, first served, because nothing interrupts the long job.',
  },
  {
    q: 'Why is shortest job first optimal but not used directly?',
    a: 'Running short jobs first means each job delays the others as little as possible. But the scheduler cannot know a job’s length in advance, and long jobs can starve.',
  },
  {
    q: 'How does the time slice length change round robin?',
    a: 'A very long slice turns it into first come, first served. A very short slice gives quick response but wastes a large share of the CPU on context switches.',
  },
  {
    q: 'When does round robin give the worst turnaround?',
    a: 'When all jobs have the same length. They take turns until the end, so all of them finish late, instead of one after another.',
  },
  {
    q: 'How does a multi-level feedback queue guess which threads are interactive?',
    a: 'From behaviour. Threads that use up their CPU allowance move down to lower priority; threads that block early stay high. A periodic reset stops starvation.',
  },
  {
    q: 'How does Linux decide which normal thread runs next?',
    a: 'Each thread has a virtual runtime: CPU time received, scaled by its weight. The scheduler favours the thread furthest behind its fair share. CFS picked the lowest; EEVDF (Linux 6.6+) picks the eligible thread with the earliest virtual deadline.',
  },
  {
    q: 'What does EEVDF let a thread express that CFS could not?',
    a: '“Run me soon, but not more.” A shorter requested slice gives earlier deadlines, so lower latency after waking, without a larger share of the CPU.',
  },
  {
    q: 'Why does each core have its own run queue, and what does that require?',
    a: 'One shared queue would need a lock that all cores fight over. Per-core queues need a load balancer that moves threads so no core sits idle while others are busy.',
  },
  {
    q: 'Why does the load balancer prefer nearby cores?',
    a: 'A moved thread loses its warm cache. Moving to a core that shares a cache, or at least the same NUMA node, costs much less than moving across sockets.',
  },
  {
    q: 'What does nice change, and what does it not change?',
    a: 'It changes a thread’s weight, so its share of the CPU when threads compete (about 10% per step). It does not help when the CPU is idle, and it is not a latency tool.',
  },
  {
    q: 'How do real-time policies differ from nice, and what is the danger?',
    a: 'A runnable SCHED_FIFO or SCHED_RR thread always runs before every normal thread. A real-time thread stuck in a loop can starve its core; Linux keeps 5% of each second back as a safety net.',
  },
  {
    q: 'What does the kernel save in a context switch?',
    a: 'The thread’s registers: general-purpose, instruction pointer, stack pointer, floating-point and vector state, and the thread-local storage pointer. For a switch to another process it also changes the page table.',
  },
  {
    q: 'Why is the indirect cost of a context switch often larger than the direct cost?',
    a: 'The switch itself takes about a microsecond or a few. Afterwards the thread runs slower until it refills the caches, TLB and branch predictor that the other thread overwrote.',
  },
  {
    q: 'What do many involuntary vs many voluntary context switches tell you?',
    a: 'Involuntary: the thread wanted to run but was preempted, so there is CPU contention or a CPU limit. Voluntary: the thread keeps blocking on I/O, locks or sleeps. See <code>/proc/&lt;pid&gt;/status</code> or <code>pidstat -w</code>.',
  },
  {
    q: 'Why can a container with low average CPU use have p99 latency spikes?',
    a: 'A CPU limit is a budget per period (often 100 ms) shared by all threads. A burst of many threads spends it early, and the whole container is throttled until the period ends. <code>nr_throttled</code> in <code>cpu.stat</code> shows it.',
  },
  {
    q: 'Why did Go services run badly under container CPU limits, and how is it fixed?',
    a: 'Before Go 1.25, GOMAXPROCS defaulted to the host’s visible cores, not the quota, so dozens of threads burned the budget and got throttled. Set GOMAXPROCS, use automaxprocs, or use Go 1.25+, which reads the cgroup limit.',
  },
  {
    q: 'What does pinning a thread buy, and what does it cost?',
    a: 'Warm caches, NUMA locality and predictable latency. But the thread cannot use idle cores elsewhere; for the best latency you must also keep other threads and interrupts off its cores.',
  },
]
