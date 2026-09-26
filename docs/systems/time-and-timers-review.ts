// Flashcards for the Time & Timers chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'Why should you measure durations with the monotonic clock, not the wall clock?',
    a: 'The wall clock can be stepped forwards or backwards by time sync, an administrator or a leap second, so a difference of two readings can be wrong or negative. The monotonic clock never goes backwards.',
  },
  {
    q: 'How do <code>CLOCK_MONOTONIC</code>, <code>CLOCK_MONOTONIC_RAW</code> and <code>CLOCK_BOOTTIME</code> differ?',
    a: 'MONOTONIC never jumps but is slewed by NTP to track real seconds. MONOTONIC_RAW is not slewed at all. BOOTTIME is like MONOTONIC but keeps counting during suspend.',
  },
  {
    q: 'How does the kernel turn a hardware counter into the current time?',
    a: 'It keeps a record "at counter value C, the time was T" and a conversion factor. Time now = T + (counter now − C) converted to nanoseconds. The record is updated regularly.',
  },
  {
    q: 'How can <code>clock_gettime</code> run without entering the kernel?',
    a: 'The kernel maps its time record read-only into every process. The vDSO code reads it and the CPU\'s counter (the TSC) in user mode, using a sequence counter to retry if an update happened meanwhile.',
  },
  {
    q: 'When does <code>clock_gettime</code> quietly become a real system call?',
    a: 'When the kernel\'s clocksource cannot be read from user mode, for example HPET or some hypervisor clocks, or after the TSC is marked unstable. The call then costs several times more.',
  },
  {
    q: 'What does the kernel do on each timer tick?',
    a: 'It accounts CPU time to the running thread and lets the scheduler preempt it, updates timekeeping, and runs expired coarse (timer wheel) timers.',
  },
  {
    q: 'Why do modern kernels stop the tick on idle cores?',
    a: 'A periodic tick wakes idle cores hundreds of times a second for nothing, wasting power and host CPU for idle VMs. Tickless idle programs the timer for the next real event instead.',
  },
  {
    q: 'What does <code>nohz_full</code> give a latency-sensitive thread, and what does it cost?',
    a: 'The tick stops on a core running a single thread, removing a periodic interruption. Kernel entries on that core cost a bit more, and at least one other core must keep the tick for housekeeping.',
  },
  {
    q: 'Why is a timer wheel a good fit for network timeouts?',
    a: 'Most timeouts are cancelled before they fire, so adding and cancelling must be cheap. A wheel does both in constant time by dropping timers into per-tick buckets, at the cost of precision.',
  },
  {
    q: 'When does the kernel use hrtimers instead of the timer wheel?',
    a: 'For timers that must fire precisely: nanosleep, timerfd, POSIX timers, the scheduler. They are kept in a sorted tree per core, and the hardware timer is programmed for the earliest one.',
  },
  {
    q: 'Why does a 50 µs sleep usually take noticeably longer?',
    a: 'Timer slack lets the kernel fire it up to 50 µs late to batch wake-ups, and waking and scheduling the thread takes more time. <code>PR_SET_TIMERSLACK</code> reduces the first part.',
  },
  {
    q: 'How do you run periodic work without drift?',
    a: 'Sleep until absolute deadlines on the monotonic clock: add the period to the previous deadline and use <code>clock_nanosleep</code> with <code>TIMER_ABSTIME</code>, or a periodic timerfd.',
  },
  {
    q: 'Why is <code>pthread_cond_timedwait</code> a trap by default?',
    a: 'Its deadline is on the wall clock, so a clock step makes the wait end far too early or far too late. Set the condition variable\'s clock to CLOCK_MONOTONIC.',
  },
  {
    q: 'What is the difference between slewing and stepping a clock?',
    a: 'Slewing runs the clock slightly fast or slow until the error is gone, so time never jumps. Stepping sets the new value at once, which can move the wall clock backwards.',
  },
  {
    q: 'What is leap smearing, and what is its catch?',
    a: 'Time servers spread a leap second over many hours instead of repeating a second. During the smear, smeared and unsmeared clocks disagree by up to half a second, so a fleet must not mix sources.',
  },
  {
    q: 'Why can last-write-wins with timestamps lose writes?',
    a: 'Clocks on different machines are skewed. A later write from a machine whose clock is behind can carry an earlier timestamp and be discarded.',
  },
  {
    q: 'How do systems order events safely despite clock skew?',
    a: 'A single leader with sequence numbers, logical or hybrid logical clocks that never go backwards, or bounded-uncertainty clocks like Spanner\'s TrueTime with a commit wait.',
  },
]
