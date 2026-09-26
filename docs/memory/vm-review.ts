// Flashcards and quiz for the Virtual Memory chapter. Strings may contain inline HTML.

export const cards = [
  { q: 'What two parts is a virtual address split into (4 KiB pages)?', a: 'The <b>virtual page number</b> (upper bits, addr &gt;&gt; 12) and the <b>page offset</b> (low 12 bits). Only the page number is translated; the offset is copied unchanged.' },
  { q: 'Why can’t x86-64 use a single flat page table?', a: '2<sup>36</sup> pages × 8 B per entry = <b>512 GiB per process</b>. A multi-level (radix tree) table only allocates the parts of the address space that are actually used.' },
  { q: 'How is a 48-bit x86-64 virtual address divided for the page walk?', a: '9 + 9 + 9 + 9 bits of index (PML4, PDPT, PD, PT) + 12 bits of offset. Each table is 512 × 8 B = exactly one 4 KiB page.' },
  { q: 'What does CR3 hold?', a: 'The physical address of the current process’s top-level page table (PML4). Writing CR3 switches address spaces.' },
  { q: 'Name five important bits in a page table entry.', a: '<b>Present</b>, <b>Read/Write</b>, <b>User/Supervisor</b>, <b>Accessed</b>, <b>Dirty</b> (also NX, Global, and the page-size bit for huge pages).' },
  { q: 'Who sets the Accessed and Dirty bits, and who reads them?', a: 'The <b>MMU hardware</b> sets them. The <b>kernel</b> reads them: Accessed to approximate LRU during reclaim, Dirty to know whether a page must be written back before it can be freed.' },
  { q: 'What is the TLB?', a: 'A small, fast per-core cache of recent virtual-page → physical-frame translations (plus permissions). A hit avoids the page walk entirely.' },
  { q: 'What is “TLB reach”?', a: 'Number of TLB entries × page size: how much memory can be accessed without TLB misses. ~1.5K entries × 4 KiB ≈ 6 MiB; with 2 MiB pages ≈ 3 GiB.' },
  { q: 'What are PCID / ASID for?', a: 'They tag TLB entries with an address-space ID so a context switch doesn’t have to flush the whole TLB. Entries from other processes just don’t match.' },
  { q: 'Why is switching between two threads of the same process cheaper than between two processes?', a: 'Threads share one address space (same page tables, same CR3), so there is no page-table switch and the TLB stays warm.' },
  { q: 'What is a TLB shootdown?', a: 'When the kernel changes or removes a mapping, it must invalidate stale TLB entries on <b>other cores</b> too, by sending them inter-processor interrupts (IPIs). Expensive and scales with core count.' },
  { q: 'Minor vs major page fault?', a: '<b>Minor</b>: resolved without I/O (fresh zeroed page, page already in the page cache, CoW copy). ~µs. <b>Major</b>: needs disk or swap I/O. ~100 µs on SSD, ~10 ms on HDD.' },
  { q: 'When does a page fault become a SIGSEGV?', a: 'When the faulting address is in no VMA, or the access violates the VMA’s permissions (e.g. write to read-only, execute NX memory).' },
  { q: 'What is demand paging?', a: 'Physical frames are only assigned when a page is first touched. mmap/malloc reserve <i>virtual</i> space; the page-fault handler supplies memory lazily.' },
  { q: 'VSZ vs RSS?', a: '<b>VSZ</b>: total virtual address space mapped (can be huge and mostly unbacked). <b>RSS</b>: pages currently resident in physical RAM.' },
  { q: 'Two ways to use huge pages on Linux?', a: '<b>hugetlbfs</b>: explicit, pre-reserved, never swapped. <b>Transparent Huge Pages (THP)</b>: the kernel uses 2 MiB pages automatically (modes: always / madvise / never), with khugepaged collapsing pages in the background.' },
  { q: 'Why do some databases recommend disabling THP?', a: 'Latency spikes from compaction and khugepaged, memory bloat from partly-used 2 MiB pages, and more expensive copy-on-write after fork.' },
  { q: 'Why does fork() of a process with 50 GB RSS take noticeable time even with CoW?', a: 'The kernel must copy the <b>page tables</b> (~8 B per 4 KiB page ≈ 100 MB) and mark pages read-only. Data is copied later, page by page, as either side writes.' },
  { q: 'What is a canonical address on x86-64?', a: 'One whose bits 63–48 all equal bit 47. That splits the space into a user half (low) and kernel half (high) with a huge unusable hole between.' },
  { q: 'Why is the kernel mapped into every process’s address space?', a: 'So a syscall or interrupt can run kernel code without switching page tables. The U/S bit stops user mode from touching it. (KPTI, the Meltdown fix, partly undoes this.)' },
]

export const quiz = [
  {
    q: 'A process calls <code>malloc(1 &lt;&lt; 30)</code> (1 GiB) and never touches the memory. What happens to RSS?',
    options: ['Grows by 1 GiB immediately', 'Barely changes', 'Grows by 1 GiB once the next page fault occurs', 'malloc fails unless 1 GiB of RAM is free'],
    answer: 1,
    explain: 'Large mallocs become anonymous mmaps. Only virtual space is reserved; frames are assigned on first touch, page by page.',
  },
  {
    q: 'On a TLB miss with 4-level paging and no caching of page-table entries, how many memory reads happen before the data itself is read?',
    options: ['1', '2', '4', '8'],
    answer: 2,
    explain: 'One read per level: PML4, PDPT, PD, PT. In practice paging-structure caches and the CPU data caches often shortcut some of these.',
  },
  {
    q: 'Which of these is a <b>major</b> page fault?',
    options: ['First write to a fresh anonymous page', 'Write to a copy-on-write page after fork()', 'Reading a mmap’d file page that is not in the page cache', 'Reading a file page already in the page cache but not yet mapped'],
    answer: 2,
    explain: 'Only the file read needs I/O. The others are satisfied from memory, so they are minor faults.',
  },
  {
    q: 'Why does a context switch between two threads of the same process not need to flush the TLB?',
    options: ['Threads have separate TLBs', 'Threads share the same page tables', 'The kernel disables the TLB for threads', 'PCID is only used for threads'],
    answer: 1,
    explain: 'Same address space, same CR3, so every cached translation is still valid.',
  },
  {
    q: 'With a 1,536-entry TLB, roughly how much memory can be covered using 2 MiB pages vs 4 KiB pages?',
    options: ['6 MiB vs 3 GiB', '3 GiB vs 6 MiB', '1.5 GiB vs 1.5 MiB', 'The same, the TLB size is what matters'],
    answer: 1,
    explain: '1,536 × 2 MiB = 3 GiB; 1,536 × 4 KiB = 6 MiB. That 512× gain in reach is the main reason huge pages help random-access workloads.',
  },
  {
    q: 'A heavily multithreaded service calls <code>munmap</code> and <code>madvise(MADV_DONTNEED)</code> very frequently and scales badly with cores. What is a likely cause?',
    options: ['Major page faults', 'TLB shootdown IPIs to all cores running the process', 'Running out of PCIDs', 'The page cache is too small'],
    answer: 1,
    explain: 'Removing mappings requires invalidating TLB entries on every core that might cache them. Each call interrupts other cores, which gets worse with more cores.',
  },
  {
    q: 'Which statement is <b>false</b>?',
    options: [
      'Virtual memory works even on a system with no swap',
      'The MMU, not the kernel, translates addresses on a TLB hit or walk',
      'Every context switch between processes must flush the entire TLB',
      'A page can be valid in a VMA but have no physical frame',
    ],
    answer: 2,
    explain: 'With PCID/ASID tagging, entries from different processes can coexist; and global kernel entries are never flushed on a switch.',
  },
  {
    q: 'You enable THP=always on a latency-sensitive service and p99 gets worse, though average throughput improves. Which is the most plausible explanation?',
    options: [
      'Huge pages make TLB misses more frequent',
      'Occasional page faults now zero 2 MiB or trigger compaction, causing stalls',
      'Huge pages cannot be cached in the TLB',
      'THP disables demand paging',
    ],
    answer: 1,
    explain: 'Throughput improves thanks to TLB reach, but individual faults get much more expensive (zeroing 512× more memory, direct compaction), which shows up in the tail.',
  },
]
