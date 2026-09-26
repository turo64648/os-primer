// Flashcards for the CPU Caches & NUMA chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'Why do CPUs have caches?',
    a: 'Main memory takes about 100 ns per access, while a core can run several instructions per nanosecond. Small, fast caches near the core keep recently used data, so most accesses do not wait for main memory.',
  },
  {
    q: 'What two kinds of locality do caches rely on?',
    a: 'Time: data used recently is likely to be used again. Space: data next to recently used data is likely to be used soon.',
  },
  {
    q: 'Why is there a hierarchy of caches instead of one big one?',
    a: 'A memory cannot be both big and fast. So small, very fast L1 and L2 caches sit next to each core, and a bigger, slower L3 is shared by all cores.',
  },
  {
    q: 'What is a cache line, and why does it matter?',
    a: 'The fixed block, usually 64 bytes, that caches move. Reading one byte loads its whole line, so data used together should sit together.',
  },
  {
    q: 'Why is row-by-row traversal of a C 2-D array faster than column-by-column?',
    a: 'Rows are contiguous, so every fetched line is fully used and the prefetcher works. Columns jump a whole row per step, so each fetched line gives one value before it is evicted.',
  },
  {
    q: 'Why can’t the prefetcher help a linked list?',
    a: 'The next address is inside the node being read, so the CPU cannot know it in advance. Each step waits for a full memory access, one after another.',
  },
  {
    q: 'What is the basic rule of cache coherence?',
    a: 'Many cores may hold a line for reading, but only one may hold it for writing. Before writing, a core invalidates every other copy.',
  },
  {
    q: 'What do the MESI states mean?',
    a: 'Modified: only copy, changed. Exclusive: only copy, unchanged. Shared: possibly several copies, unchanged. Invalid: not usable.',
  },
  {
    q: 'Why does a single atomic counter shared by all threads scale badly?',
    a: 'Every increment needs the counter’s cache line in the writing core, so the line moves between cores on every update. Per-thread counters summed when read avoid this.',
  },
  {
    q: 'What is false sharing?',
    a: 'Threads write different variables that sit in the same cache line. The hardware treats it as sharing, and the line bounces between cores.',
  },
  {
    q: 'How do you fix false sharing?',
    a: 'Put data written by different threads in different cache lines: pad or align to 64 or 128 bytes, or keep per-thread copies. perf c2c helps find it.',
  },
  {
    q: 'What is NUMA?',
    a: 'A design where each CPU socket has its own local memory. Every core can reach all memory, but remote memory is slower (often 1.5–2×) and has less bandwidth.',
  },
  {
    q: 'Where does Linux place a new page on a NUMA machine by default, and what can go wrong?',
    a: 'On the node of the CPU that first touches it. If one thread initialises all the data, it all lands on one node, and threads on other nodes read it remotely.',
  },
  {
    q: 'When would you interleave memory across NUMA nodes instead of binding to one?',
    a: 'When all threads on all nodes use all the data, such as one big shared cache. Interleaving evens out latency and adds up bandwidth across nodes.',
  },
  {
    q: 'Why can a struct of arrays be faster than an array of structs?',
    a: 'A loop that uses only a few fields reads only those arrays, so every fetched byte is useful. The accesses are sequential and suit prefetching and SIMD.',
  },
  {
    q: 'Why is LLM token generation limited by memory bandwidth?',
    a: 'Each token reads every weight once but does little arithmetic per weight. Batching many requests reuses each weight read for more work.',
  },
]
