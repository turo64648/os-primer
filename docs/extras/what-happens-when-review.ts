// Flashcards for the What Happens When… capstone. Strings may contain inline HTML.

export const cards = [
  {
    q: 'Which four mechanisms appear in almost every “what happens when” walkthrough?',
    a: 'System calls (asking the kernel), page faults (memory filled in on first use), interrupts (devices and timers), and sleep and wake-up through the scheduler.',
  },
  {
    q: 'How should you structure an answer to “walk me through what happens when…”?',
    a: 'Name the big stages in one breath, then walk through each with its key mechanism, offer depth where the interviewer wants it, and finish with where it could be slow or fail.',
  },
  {
    q: 'Why does fork not copy the parent’s memory?',
    a: 'It copies the page tables and marks pages read-only and shared. A page is copied only when one process writes to it (copy-on-write). The child usually calls exec soon anyway.',
  },
  {
    q: 'What does exec do, and what does it leave for later?',
    a: 'It replaces the address space: maps the program’s segments and the dynamic loader, and builds a stack with arguments and environment. The contents are loaded later, page by page, through page faults.',
  },
  {
    q: 'What runs between exec and main?',
    a: 'The dynamic loader maps and links shared libraries and runs their initialisers. Then libc sets itself up and runs constructors, and finally calls main.',
  },
  {
    q: 'Why does a finished process stay as a zombie, and what removes it?',
    a: 'The kernel keeps its exit status until the parent collects it with wait or waitpid. When the parent does, the record disappears.',
  },
  {
    q: 'What decides whether read() takes a microsecond or a millisecond?',
    a: 'Whether the data is in the page cache. A hit is a copy from RAM. A miss goes through the file system, block layer and device, and the thread sleeps until an interrupt says the data arrived.',
  },
  {
    q: 'What is the thread doing while its read() waits for the disk, and what side effect does that have?',
    a: 'It sleeps in uninterruptible state (D) and the core runs other threads. On Linux, D-state threads count in the load average, so heavy I/O raises the load with idle CPUs.',
  },
  {
    q: 'Who completes a TCP handshake: the kernel or the server program?',
    a: 'The kernel. It answers the SYN and moves finished connections into the accept queue. The program’s accept only takes a connection off that queue.',
  },
  {
    q: 'How does an incoming packet wake a server thread blocked in epoll_wait?',
    a: 'The card DMAs it into RAM and interrupts; NAPI processes it up through IP and TCP into the socket’s buffer. The socket becomes ready, epoll adds it to its ready list, and the kernel wakes the waiting thread.',
  },
  {
    q: 'Connection times jump by exactly 1 or 3 seconds under load. Where do you look?',
    a: 'The listen socket’s accept queue. When it is full, the kernel drops handshake packets and the client retries after 1 s, then 2 s more. Check ListenOverflows in nstat and ss -lnt.',
  },
  {
    q: 'In what order does Linux respond as memory runs out?',
    a: 'kswapd reclaims in the background, dropping cache and swapping. Then allocating threads must reclaim themselves (direct reclaim). The machine may thrash. Finally the OOM killer sends SIGKILL to a process.',
  },
  {
    q: 'Why can a container be OOM-killed while the host has plenty of free RAM?',
    a: 'Its limit is its cgroup’s memory.max. When the group cannot reclaim enough below that limit, the OOM killer acts inside the group, whatever the host has free.',
  },
  {
    q: 'How does Ctrl-C become a signal?',
    a: 'The terminal emulator sends byte 0x03. The kernel’s terminal layer, in normal mode, turns it into SIGINT for every process in the terminal’s foreground process group.',
  },
  {
    q: 'When does a signal actually take effect on its target?',
    a: 'The kernel marks it pending, then acts on it when the target next returns to user mode. It interrupts a running target and wakes a sleeping one, but a thread in D state must wait for its I/O.',
  },
  {
    q: 'What does a container runtime do between pulling an image and running the entry point?',
    a: 'It stacks the layers with overlayfs, creates namespaces, places the process in a cgroup with limits, switches the root, sets up networking, drops capabilities and installs seccomp, then calls execve.',
  },
  {
    q: 'Why is a service slow for a few minutes after each deploy?',
    a: 'Everything starts cold: code pages load by page faults, files miss the page cache, JIT compilers have not optimised hot code, and in-process caches and pools are empty.',
  },
  {
    q: 'What is a quick way to estimate where time goes on a path?',
    a: 'Count boundary crossings: system calls cost about 100 ns, sleeps and wake-ups microseconds, and device trips microseconds to milliseconds. Then look for queues that can fill.',
  },
]
