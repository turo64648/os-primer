// Flashcards for the I/O Models chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'What is the difference between blocking, non-blocking and asynchronous I/O?',
    a: 'Blocking: the call sleeps until done. Non-blocking: the call returns <code>EAGAIN</code> at once if it cannot progress. Asynchronous: you submit the whole operation and are told when it has finished.',
  },
  {
    q: 'Why did thread per connection struggle at 10,000 connections (C10K)?',
    a: 'Each connection cost a thread: stack memory, context switches, scheduler and lock pressure. Most of those threads were idle, waiting on slow clients.',
  },
  {
    q: 'Why is non-blocking I/O useless on its own?',
    a: 'Without a way to sleep until something is ready, the program must keep retrying every socket, which burns a CPU core. It needs a readiness API such as epoll.',
  },
  {
    q: 'Why do select and poll get slow with many connections?',
    a: 'The whole list of descriptors goes into the kernel on every call, and both the kernel and the program scan all of it. The cost grows with connections watched, not connections ready.',
  },
  {
    q: 'How does epoll avoid scanning every socket?',
    a: 'The watch list lives in the kernel, registered once. A hook on each socket moves it to a ready list when its state changes, and <code>epoll_wait</code> returns only that list.',
  },
  {
    q: 'Level-triggered vs edge-triggered: what does each report?',
    a: 'Level-triggered reports a state (“still readable”) on every wait. Edge-triggered reports a change (“new data arrived”), so leftover data is not reported again.',
  },
  {
    q: 'What rule must edge-triggered code follow, and what is its trap?',
    a: 'Keep reading or writing until <code>EAGAIN</code>, or data can sit unreported. But draining one busy socket forever starves the others, so cap the work per turn.',
  },
  {
    q: 'What is the one rule of an event loop, and why?',
    a: 'Never block it. All connections on the loop share one thread, so a slow handler or a blocking call delays every one of them.',
  },
  {
    q: 'Why can’t epoll help with regular files?',
    a: 'File data is always “there”, just slow to fetch, so there is no readiness event. epoll refuses files with <code>EPERM</code>, poll says “ready”, and a page cache miss blocks.',
  },
  {
    q: 'How do Node.js and Tokio read files without blocking the event loop?',
    a: 'They hand file operations to a thread pool and get an event when each finishes. libuv’s pool has only 4 threads by default, so it can become a queue.',
  },
  {
    q: 'Readiness vs completion: what is the difference?',
    a: 'Readiness (epoll) says “you can call read now without waiting”. Completion (io_uring, IOCP) takes the whole request and says “done, the data is in your buffer”.',
  },
  {
    q: 'How does io_uring cut system calls?',
    a: 'Requests and results travel through two queues in memory shared with the kernel. A whole batch needs one <code>io_uring_enter</code>, or none with a polling kernel thread.',
  },
  {
    q: 'When is io_uring not worth it?',
    a: 'When system calls are not the bottleneck, when security policy restricts it (seccomp cannot see its operations; Google and many container platforms limit it), on older kernels, or when the added complexity is not justified.',
  },
  {
    q: 'What copies does sendfile avoid?',
    a: 'The two CPU copies through your buffer: page cache to user memory, and user memory to the socket buffer. With scatter-gather, the network card reads straight from the page cache.',
  },
  {
    q: 'When does zero-copy not apply?',
    a: 'When the program must change the data: compress, parse or encrypt it. TLS broke sendfile until kernel TLS moved encryption into the kernel.',
  },
  {
    q: 'What is the thundering herd, and how does Linux avoid it for servers?',
    a: 'One event wakes many waiting threads though only one can use it. <code>EPOLLEXCLUSIVE</code> wakes just one; <code>SO_REUSEPORT</code> gives each worker its own listening socket.',
  },
  {
    q: 'What is the downside of SO_REUSEPORT?',
    a: 'The kernel assigns connections by hash, without knowing load. A stuck worker keeps getting new connections, which wait even while other workers are idle.',
  },
  {
    q: 'What is backpressure in an event loop?',
    a: 'When a write returns <code>EAGAIN</code>, keep the data, wait for <code>EPOLLOUT</code>, and stop reading from the source. The pause spreads back to the producer instead of buffers growing without limit.',
  },
  {
    q: 'How does Go let goroutines block on sockets cheaply?',
    a: 'Sockets are non-blocking underneath. On <code>EAGAIN</code> the runtime parks the goroutine, and its epoll-based netpoller wakes it when the socket is ready. No OS thread sleeps on a socket.',
  },
]
