// Flashcards for the User-Space Allocators chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'Why do programs use an allocator instead of asking the kernel for each object?',
    a: 'The kernel hands out whole pages through system calls, which are slow and coarse. The allocator buys pages in bulk and cuts them into small blocks, with no system call for most requests.',
  },
  {
    q: 'How does glibc malloc get memory for small and for large requests?',
    a: 'Small requests come from the heap, which it grows with brk. Large ones (128 KiB and up by default) get their own mmap region, which free returns to the kernel at once.',
  },
  {
    q: 'How does free() know the size of the block?',
    a: 'The allocator stores the size in a header just before the returned address. Allocators that give each page one size class can find it from the page instead.',
  },
  {
    q: 'Why do allocators use size classes?',
    a: 'Rounding requests to a fixed set of sizes lets each size have its own free list, so malloc and free take a block with no searching. It also limits external fragmentation.',
  },
  {
    q: 'What is internal fragmentation?',
    a: 'Waste inside a block because the request was rounded up, for example a 33-byte request stored in a 48-byte block.',
  },
  {
    q: 'What is external fragmentation?',
    a: 'Free memory split into holes too small for the requests that come. Plenty is free in total, but no single piece is big enough.',
  },
  {
    q: 'Why do allocators have arenas and thread caches?',
    a: 'One shared heap would need one lock, and threads would wait for each other. Separate arenas and small per-thread caches let most calls run without any shared lock.',
  },
  {
    q: 'What do arenas and thread caches cost?',
    a: 'Memory. Free blocks held by one thread or arena cannot be used by another, so a process with many threads can hold far more free memory than it needs.',
  },
  {
    q: 'Why does RSS often not shrink after free()?',
    a: 'free returns memory to the allocator, which keeps it. The heap can only shrink from its end, and a page can be returned only if it is completely free.',
  },
  {
    q: 'How can you tell a leak from allocator retention?',
    a: 'A leak grows without limit. Retention levels off. Compare live bytes from a heap profiler or allocator statistics with RSS: flat live bytes with a big gap means retention or fragmentation.',
  },
  {
    q: 'What does MALLOC_ARENA_MAX do, and why is it a common fix?',
    a: 'It caps how many arenas glibc creates. With many threads, glibc can create many arenas that each hold free memory. Capping them trades a little contention for much less memory.',
  },
  {
    q: 'What design do jemalloc, tcmalloc and mimalloc share?',
    a: 'Per-thread or per-CPU caches, and pages that hold only one size class. That removes per-block headers, limits fragmentation and avoids locks on the common path.',
  },
  {
    q: 'Why is MADV_FREE confusing for monitoring?',
    a: 'It lets the kernel take pages only when memory is short. Until then they still count in RSS, so the process looks bigger than its real use.',
  },
  {
    q: 'When does a custom pool or arena allocator make sense?',
    a: 'When objects follow a known pattern: all the same size (pool), or all dying together at the end of a request (arena, freed at once by resetting a pointer).',
  },
  {
    q: 'Why do memory corruption bugs often crash far from the bug?',
    a: 'Overflows and double frees corrupt the allocator’s headers and free lists. The crash happens later, in some unrelated malloc or free. AddressSanitizer catches the bad access when it happens.',
  },
  {
    q: 'Why does nvidia-smi show more GPU memory in use than PyTorch says is allocated?',
    a: 'PyTorch keeps a caching allocator. It holds freed GPU blocks to reuse them, because asking the driver for memory is slow. The difference is cached memory.',
  },
]
