// Flashcards for the Virtual Memory chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'Why does every process get its own virtual address space instead of using RAM addresses directly?',
    a: 'So processes cannot see or damage each other’s memory, every program can use the same simple layout, and the kernel can place pages anywhere in RAM, share them, or supply them later.',
  },
  {
    q: 'Who translates addresses, and who decides the mappings?',
    a: 'The hardware (the MMU in the CPU) translates every access. The kernel only writes the page tables and handles the cases the hardware cannot, called page faults.',
  },
  {
    q: 'Why is memory handled in fixed-size pages?',
    a: 'Any free frame can hold any page, so RAM never fragments into unusable holes. Tables stay small because they track pages, not bytes.',
  },
  {
    q: 'How does an address get split for translation?',
    a: 'The low 12 bits (for 4 KiB pages) are the offset inside the page and are kept as they are. The rest is the page number, which the page table maps to a frame number.',
  },
  {
    q: 'Why is the page table a tree and not one big array?',
    a: 'A flat array covering the whole address space would take hundreds of GiB per process, mostly empty. A tree only has branches for the regions the process actually uses.',
  },
  {
    q: 'What does the tree cost?',
    a: 'Each level is one more memory read when translating. On x86-64 that is four reads before the real data read, unless the TLB already has the answer.',
  },
  {
    q: 'Why does the TLB exist, and what is “TLB reach”?',
    a: 'Walking the tree on every access would be far too slow, so the CPU caches recent translations. Reach = entries × page size: about 6 MiB with 4 KiB pages, about 3 GiB with 2 MiB pages.',
  },
  {
    q: 'What kinds of programs suffer most from TLB misses?',
    a: 'Programs that jump randomly around a lot of memory: big hash tables, database indexes, graph algorithms, embedding lookups. Their data is spread over far more pages than the TLB can hold.',
  },
  {
    q: 'Why is switching between threads cheaper than switching between processes?',
    a: 'Threads of one process share one address space. The page table stays the same, so the cached translations in the TLB stay valid.',
  },
  {
    q: 'Why do TLB shootdowns happen and why do they hurt?',
    a: 'When the kernel removes or changes a mapping, other cores may still cache the old translation. It must interrupt each of them to clear it. More cores means more interruptions.',
  },
  {
    q: 'What decides whether a page fault is fine or a crash?',
    a: 'Whether the address is in a region the process owns, with the right permissions. If yes, the kernel supplies the page and the program continues. If no, the process gets SIGSEGV.',
  },
  {
    q: 'Minor vs major page fault: what is the difference and why does it matter?',
    a: 'A minor fault is solved from memory (about a microsecond). A major fault must read from disk (about 100 µs on SSD, 10 ms on HDD). Major faults in a request path show up as latency spikes.',
  },
  {
    q: 'Why does malloc(1 GiB) return instantly without using 1 GiB of RAM?',
    a: 'It only reserves address space. RAM is given one page at a time, when each page is first touched (demand paging).',
  },
  {
    q: 'Why can huge pages make throughput better but tail latency worse?',
    a: 'They multiply TLB reach, so most accesses are faster. But each fault must clear 2 MiB, and the kernel may have to rearrange memory to find a free 2 MiB block, which stalls the thread.',
  },
  {
    q: 'Why does fork() of a process using 50 GB take noticeable time, even though memory is not copied?',
    a: 'The kernel must still copy the page tables, about 8 bytes per 4 KiB page, so around 100 MB. Data pages are copied later, one at a time, when either process writes.',
  },
  {
    q: 'When would you prefer read() over mmap() for file I/O?',
    a: 'When you need control: when to read, in what order, asynchronously, with clear error codes. With mmap, I/O happens hidden inside page faults that block the thread.',
  },
]
