// Single source of truth for the book's structure.
// Used by the sidebar (config.mts), the home page chapter list, and stub pages.

export interface Chapter {
  id: string
  num: string
  title: string
  link: string
  ready: boolean
  topics: string[]
}

export interface Part {
  title: string
  chapters: Chapter[]
}

export const parts: Part[] = [
  {
    title: 'I. Foundations',
    chapters: [
      {
        id: 'what-is-an-os', num: '1', title: 'What an OS Is', link: '/foundations/what-is-an-os', ready: true,
        topics: ['Kernel vs user mode, privilege rings', 'System calls: the mechanism and the cost', 'Interrupts, exceptions and traps', 'Monolithic vs microkernel', 'The vDSO'],
      },
      {
        id: 'processes-and-threads', num: '2', title: 'Processes & Threads', link: '/foundations/processes-and-threads', ready: false,
        topics: ['fork / exec / wait', 'Process states and the PCB (task_struct)', 'Threads vs processes: what is shared', 'Signals, SIGTERM vs SIGKILL, graceful shutdown', 'Zombies, orphans, reparenting, process groups and sessions'],
      },
      {
        id: 'linking-and-loading', num: '3', title: 'Linking, Loading & Program Startup', link: '/foundations/linking-and-loading', ready: false,
        topics: ['ELF: sections and segments', 'Static vs dynamic linking', 'PLT / GOT and lazy binding', 'LD_PRELOAD and symbol interposition', 'How exec builds the address space'],
      },
    ],
  },
  {
    title: 'II. Memory',
    chapters: [
      {
        id: 'virtual-memory', num: '4', title: 'Virtual Memory', link: '/memory/virtual-memory', ready: true,
        topics: ['Pages, frames and address translation', 'Multi-level page tables', 'The TLB, PCID and shootdowns', 'Page faults and demand paging', 'Huge pages'],
      },
      {
        id: 'kernel-memory', num: '5', title: 'Kernel Memory Management', link: '/memory/kernel-memory', ready: true,
        topics: ['mmap: file-backed vs anonymous', 'Copy-on-write and fork', 'Page cache and reclaim (LRU lists, kswapd)', 'Swap, overcommit and the OOM killer', 'RSS vs VSZ vs PSS'],
      },
      {
        id: 'allocators', num: '6', title: 'User-Space Allocators', link: '/memory/allocators', ready: false,
        topics: ['How malloc gets memory (brk, mmap)', 'Free lists, size classes, arenas', 'Fragmentation: internal and external', 'jemalloc / tcmalloc / mimalloc', 'Why RSS does not shrink after free()'],
      },
      {
        id: 'caches-and-numa', num: '7', title: 'CPU Caches & NUMA', link: '/memory/caches-and-numa', ready: false,
        topics: ['Cache hierarchy and latency numbers', 'Cache lines, locality, prefetching', 'Coherence (MESI) and false sharing', 'NUMA topology and locality', 'Data-oriented design in practice'],
      },
    ],
  },
  {
    title: 'III. CPU & Concurrency',
    chapters: [
      {
        id: 'scheduling', num: '8', title: 'Scheduling & Context Switches', link: '/cpu/scheduling', ready: false,
        topics: ['FCFS, SJF, round robin, MLFQ', 'Linux CFS and EEVDF', 'Context switch: what is saved and what it costs', 'Priorities, nice, real-time classes', 'CPU affinity and cgroup CPU limits'],
      },
      {
        id: 'concurrency-1', num: '9', title: 'Concurrency I: Locks & Deadlock', link: '/cpu/concurrency-1', ready: false,
        topics: ['Race conditions and critical sections', 'Mutexes, spinlocks, condition variables', 'Semaphores and monitors', 'Deadlock: conditions, prevention, detection', 'Priority inversion'],
      },
      {
        id: 'concurrency-2', num: '10', title: 'Concurrency II: Atomics & Memory Ordering', link: '/cpu/concurrency-2', ready: false,
        topics: ['Atomic operations and CAS', 'Memory ordering: acquire / release / seq_cst', 'The ABA problem', 'futex: how user-space locks block', 'Reader-writer locks and RCU'],
      },
      {
        id: 'ipc', num: '11', title: 'Inter-Process Communication', link: '/cpu/ipc', ready: false,
        topics: ['Pipes and FIFOs', 'Unix domain sockets and fd passing', 'Shared memory', 'Message queues', 'Choosing an IPC mechanism'],
      },
    ],
  },
  {
    title: 'IV. I/O & Storage',
    chapters: [
      {
        id: 'io-models', num: '12', title: 'I/O Models', link: '/io/io-models', ready: true,
        topics: ['Blocking vs non-blocking vs async', 'select / poll / epoll (level vs edge triggered)', 'io_uring', 'Zero-copy: sendfile, splice', 'The C10K problem and event loops'],
      },
      {
        id: 'file-systems', num: '13', title: 'File Systems', link: '/io/file-systems', ready: false,
        topics: ['Inodes, directories, links', 'File descriptors and the open file table', 'The page cache and write-back', 'fsync, fdatasync, O_DIRECT', 'Journaling and crash consistency'],
      },
      {
        id: 'storage-stack', num: '14', title: 'The Storage Stack', link: '/io/storage-stack', ready: false,
        topics: ['The block layer and I/O schedulers', 'HDD vs SSD vs NVMe', 'SSD internals: FTL, write amplification', 'What durability actually guarantees', 'RAID basics'],
      },
      {
        id: 'networking', num: '15', title: 'Networking in the Kernel', link: '/io/networking', ready: false,
        topics: ['Sockets and socket buffers', 'TCP states, TIME_WAIT', 'SYN and accept queues, backlog', 'From syscall to NIC: the packet path', 'Interrupts, NAPI, RSS, kernel bypass'],
      },
    ],
  },
  {
    title: 'V. Systems',
    chapters: [
      {
        id: 'time-and-timers', num: '16', title: 'Time & Timers', link: '/systems/time-and-timers', ready: false,
        topics: ['Wall clock vs monotonic clock', 'clock_gettime and the vDSO', 'Timer interrupts, tickless kernels', 'hrtimers and timer wheels', 'Clock skew and NTP'],
      },
      {
        id: 'security', num: '17', title: 'Security & Isolation', link: '/systems/security', ready: false,
        topics: ['Users, permissions, capabilities', 'seccomp', 'ASLR, stack canaries, NX', 'Spectre, Meltdown and KPTI', 'Why syscalls got more expensive'],
      },
      {
        id: 'virtualization', num: '18', title: 'Virtualization & Containers', link: '/systems/virtualization', ready: false,
        topics: ['Hypervisors: type 1 vs type 2', 'Hardware virtualization and nested paging', 'Namespaces', 'cgroups', 'Containers vs VMs vs microVMs'],
      },
      {
        id: 'performance', num: '19', title: 'Performance & Debugging', link: '/systems/performance', ready: false,
        topics: ['The USE method', 'perf and flame graphs', 'strace, ltrace, bpftrace', 'Reasoning about tail latency', 'Latency numbers every engineer should know'],
      },
    ],
  },
  {
    title: 'Capstone & Appendix',
    chapters: [
      {
        id: 'what-happens-when', num: 'C', title: 'What Happens When…', link: '/extras/what-happens-when', ready: false,
        topics: ['…you run ./a.out', '…you call read() on a file', '…a server accepts a connection', '…a process runs out of memory'],
      },
      {
        id: 'question-bank', num: 'A', title: 'Interview Question Bank', link: '/extras/question-bank', ready: false,
        topics: ['All questions, indexed by chapter'],
      },
    ],
  },
]

export const allChapters: Chapter[] = parts.flatMap((p) => p.chapters)
