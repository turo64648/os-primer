// Flashcards for the Kernel Memory Management chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'Why are some pages much cheaper for the kernel to free than others?',
    a: 'A clean file page can be dropped, because the file still has the data. A dirty file page must be written back first. An anonymous page has no file, so it can only be freed by writing it to swap.',
  },
  {
    q: 'What are the two choices you make when you create a region with mmap?',
    a: 'Where the data comes from (a file, or anonymous zero-filled memory) and who sees the writes (private: only this process; shared: every process mapping it, and the file).',
  },
  {
    q: 'How does fork avoid copying the parent’s memory?',
    a: 'It copies only the page table and marks writable pages read-only in both processes. When either one writes, the page fault handler copies that single page. This is copy-on-write.',
  },
  {
    q: 'What does fork still cost for a very large process?',
    a: 'Copying the page table, about 8 bytes per 4 KiB page, which can pause the parent for tens to hundreds of milliseconds. Afterwards, every page either process writes costs a fault and a copy.',
  },
  {
    q: 'Why is “free” memory near zero on a healthy Linux server?',
    a: 'The kernel fills unused RAM with the page cache, cached file data it can drop quickly. The number to watch is “available” memory, which includes that cache.',
  },
  {
    q: 'Why is a successful write() not the same as data on disk?',
    a: 'write() copies data into the page cache and marks it dirty. Kernel threads write it to disk later, typically within about 30 seconds. Only fsync waits for it to reach the disk.',
  },
  {
    q: 'How does the kernel guess which pages to evict?',
    a: 'It approximates least-recently-used order with an active and an inactive list. It checks the Accessed flag the MMU sets, promotes pages used again, and evicts from the end of the inactive list.',
  },
  {
    q: 'What is the difference between kswapd and direct reclaim?',
    a: 'kswapd is a background kernel thread that frees memory when free RAM falls below a low mark, so nobody waits. If it cannot keep up, threads that allocate must free memory themselves, which adds latency.',
  },
  {
    q: 'What is thrashing?',
    a: 'The working sets of running programs do not fit in RAM, so the kernel keeps evicting pages that are needed again at once. The machine spends its time moving pages, not doing work.',
  },
  {
    q: 'Why can a machine without swap freeze under memory pressure?',
    a: 'Anonymous memory cannot leave RAM, so the kernel can only evict file pages, including program code. Programs keep faulting their own code back in, and the OOM killer acts only much later.',
  },
  {
    q: 'Why does Linux overcommit memory by default?',
    a: 'Programs reserve much more than they use, and fork would otherwise need the parent’s whole size promised again. The price is that running out shows up later as an OOM kill, not as malloc failing.',
  },
  {
    q: 'How does the OOM killer choose, and how can you influence it?',
    a: 'It kills the process with the highest score, mostly its RAM and swap use, to free the most memory. oom_score_adj shifts the score from −1000 (never kill) to +1000 (kill first).',
  },
  {
    q: 'Why can a container be OOM-killed while the host has free RAM?',
    a: 'A memory cgroup has its own limit (memory.max). When the group cannot reclaim enough to stay under it, the OOM killer runs inside that group only.',
  },
  {
    q: 'Does page cache count towards a container’s memory limit? Does it cause kills?',
    a: 'Yes, it counts. Clean cache is reclaimed first, so it rarely causes kills. tmpfs, /dev/shm and shared memory also count and cannot be dropped, so they can.',
  },
  {
    q: 'What does memory PSI tell you that “available” memory does not?',
    a: 'How much time tasks actually lost waiting for memory. “some” is time at least one task stalled; “full” is time all active tasks stalled at once.',
  },
  {
    q: 'Why should you sum PSS rather than RSS across a service’s processes?',
    a: 'RSS counts every shared page in full in each process, so shared libraries and fork-shared data are counted many times. PSS splits each shared page between its users, so the sum is the real total.',
  },
  {
    q: 'How can merely reading data after fork make Python workers use more memory?',
    a: 'Python updates a reference count inside each object it touches. That write triggers copy-on-write, so each worker slowly gets its own copy of the shared pages.',
  },
]
