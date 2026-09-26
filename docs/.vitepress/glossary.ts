// Plain-language definitions for terms used across chapters.
// Used by <Term id="..."> popovers and the Glossary page.

export interface GlossaryEntry {
  term: string
  def: string
  chapter?: string // link to the chapter that explains it in full
}

export const glossary: Record<string, GlossaryEntry> = {
  kernel: {
    term: 'Kernel',
    def: 'The core of the operating system. It runs with full control of the hardware and manages memory, processes, files and devices for all programs.',
    chapter: '/foundations/what-is-an-os',
  },
  'user-mode': {
    term: 'User mode / kernel mode',
    def: 'Two CPU privilege levels. Normal programs run in user mode and cannot touch hardware or other programs’ memory directly. The kernel runs in kernel mode and can do anything.',
    chapter: '/foundations/what-is-an-os',
  },
  syscall: {
    term: 'System call (syscall)',
    def: 'How a program asks the kernel to do something for it, such as open a file or allocate memory. The CPU switches into kernel mode, runs the kernel code, then returns.',
    chapter: '/foundations/what-is-an-os',
  },
  process: {
    term: 'Process',
    def: 'A running program. It has its own memory (address space), its own open files and one or more threads.',
    chapter: '/foundations/processes-and-threads',
  },
  thread: {
    term: 'Thread',
    def: 'A single sequence of execution inside a process. Threads of the same process share its memory.',
    chapter: '/foundations/processes-and-threads',
  },
  'context-switch': {
    term: 'Context switch',
    def: 'When the CPU stops running one thread and starts running another. The kernel saves the old thread’s state and restores the new one’s.',
    chapter: '/cpu/scheduling',
  },
  register: {
    term: 'Register',
    def: 'A tiny, very fast storage slot inside the CPU. Some hold data being computed; special ones control how the CPU behaves.',
  },
  'address-space': {
    term: 'Address space',
    def: 'The full range of memory addresses a process can use. Each process has its own, so the same address in two processes can refer to different data.',
    chapter: '/memory/virtual-memory',
  },
  'virtual-address': {
    term: 'Virtual address',
    def: 'An address as a program sees it. The hardware translates it to a physical address (a real location in RAM) on every memory access.',
    chapter: '/memory/virtual-memory',
  },
  'physical-address': {
    term: 'Physical address',
    def: 'A real location in RAM.',
    chapter: '/memory/virtual-memory',
  },
  page: {
    term: 'Page',
    def: 'A fixed-size block of virtual memory, usually 4 KiB. Memory is mapped, protected and moved one page at a time.',
    chapter: '/memory/virtual-memory',
  },
  frame: {
    term: 'Frame',
    def: 'A page-sized block of physical memory (RAM). The page table records which frame holds each page.',
    chapter: '/memory/virtual-memory',
  },
  'page-table': {
    term: 'Page table',
    def: 'A data structure, kept by the kernel for each process, that maps virtual pages to physical frames and records each page’s permissions.',
    chapter: '/memory/virtual-memory',
  },
  mmu: {
    term: 'MMU (memory management unit)',
    def: 'The part of the CPU that translates virtual addresses to physical ones on every memory access, using the page table.',
    chapter: '/memory/virtual-memory',
  },
  tlb: {
    term: 'TLB (translation lookaside buffer)',
    def: 'A small, fast cache inside the CPU of recent page-to-frame translations. It lets most memory accesses skip reading the page table.',
    chapter: '/memory/virtual-memory',
  },
  'page-fault': {
    term: 'Page fault',
    def: 'What happens when the hardware cannot translate an address, for example because the page has no frame yet. The CPU stops and asks the kernel to fix it.',
    chapter: '/memory/virtual-memory',
  },
  'huge-page': {
    term: 'Huge page',
    def: 'A larger page, usually 2 MiB or 1 GiB instead of 4 KiB. Fewer, bigger pages mean fewer translations to cache.',
    chapter: '/memory/virtual-memory',
  },
  vma: {
    term: 'Memory region (VMA)',
    def: 'A contiguous range of a process’s address space with one set of permissions and one source of data, such as the heap, the stack or a mapped file. Linux calls it a VMA (virtual memory area).',
    chapter: '/memory/virtual-memory',
  },
  mmap: {
    term: 'mmap',
    def: 'A system call that adds a memory region to a process: either empty memory or the contents of a file, readable like normal memory.',
    chapter: '/memory/kernel-memory',
  },
  'copy-on-write': {
    term: 'Copy-on-write (CoW)',
    def: 'Two processes share the same memory read-only. Only when one of them writes to a page does the kernel make a private copy of that page.',
    chapter: '/memory/kernel-memory',
  },
  'page-cache': {
    term: 'Page cache',
    def: 'File data that the kernel keeps in RAM after reading or before writing it to disk, so repeated access does not need the disk.',
    chapter: '/io/file-systems',
  },
  swap: {
    term: 'Swap',
    def: 'Disk space where the kernel can move memory pages that have not been used recently, to free RAM. Reading them back is slow.',
    chapter: '/memory/kernel-memory',
  },
  rss: {
    term: 'RSS (resident set size)',
    def: 'How much of a process’s memory is actually in RAM right now.',
    chapter: '/memory/virtual-memory',
  },
  'oom-killer': {
    term: 'OOM killer',
    def: 'The Linux kernel feature that kills a process when the system runs out of memory and cannot free any more.',
    chapter: '/memory/kernel-memory',
  },
  interrupt: {
    term: 'Interrupt',
    def: 'A signal that makes the CPU pause what it is doing and run kernel code, for example when a device has data ready or another core needs attention.',
    chapter: '/foundations/what-is-an-os',
  },
  sigsegv: {
    term: 'Segmentation fault (SIGSEGV)',
    def: 'The signal the kernel sends a process that accesses memory it may not use. By default it crashes the process.',
    chapter: '/memory/virtual-memory',
  },
  fork: {
    term: 'fork',
    def: 'The Unix system call that creates a new process as a copy of the current one.',
    chapter: '/foundations/processes-and-threads',
  },
  cgroup: {
    term: 'cgroup',
    def: 'A Linux feature that limits and measures the CPU, memory and I/O a group of processes can use. Containers are built on it.',
    chapter: '/systems/virtualization',
  },
  dma: {
    term: 'DMA (direct memory access)',
    def: 'A device such as a GPU or network card copying data to or from RAM by itself, without the CPU doing the copy.',
  },
}
