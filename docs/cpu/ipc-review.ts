// Flashcards for the Inter-Process Communication chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'Why do processes need the kernel to communicate?',
    a: 'Each process has its own private memory. Either the kernel copies data between them (pipes, sockets, queues), or it maps the same physical pages into both (shared memory).',
  },
  {
    q: 'What gives a pipe built-in backpressure?',
    a: 'Its kernel buffer is limited (64 KiB by default on Linux). When it is full, the writer blocks until the reader catches up, so a fast producer cannot run far ahead.',
  },
  {
    q: 'Why does a pipe reader sometimes hang after the writer is done?',
    a: 'End-of-file only comes when every copy of the write end is closed. A leftover copy, often the reader’s own from <code>fork</code>, keeps the pipe open.',
  },
  {
    q: 'What happens when a process writes to a pipe with no readers?',
    a: 'The kernel sends it SIGPIPE, which kills it by default. If the signal is ignored or handled, <code>write</code> fails with EPIPE instead.',
  },
  {
    q: 'Why can’t you treat each read on a pipe or stream socket as one message?',
    a: 'A stream has no boundaries: writes can be merged or split. Add framing, such as a length prefix, or use a message-preserving socket type.',
  },
  {
    q: 'How does a FIFO differ from a pipe?',
    a: 'It has a path in the file system, so unrelated processes can open it. The data still goes through a kernel buffer, not the disk.',
  },
  {
    q: 'Why use a Unix domain socket instead of TCP on localhost?',
    a: 'It skips the TCP/IP stack, so it is faster. It also offers kernel-verified peer credentials, file permissions on its path, message-preserving types and file descriptor passing.',
  },
  {
    q: 'What does passing a file descriptor over a Unix socket actually transfer?',
    a: 'A reference to the same open file in the kernel. The receiver gets a new descriptor number pointing to it, sharing the file position and flags.',
  },
  {
    q: 'How do proxies restart without refusing connections?',
    a: 'The old process passes its listening socket to the new one over a Unix socket with SCM_RIGHTS. The listening socket and its queue of waiting connections stay open throughout.',
  },
  {
    q: 'Why is access to a daemon’s control socket, such as docker.sock, so sensitive?',
    a: 'Whoever can connect can make the daemon act for them. Controlling Docker lets you start a container with the host’s root file system mounted, which amounts to root on the host.',
  },
  {
    q: 'What makes shared memory fast, and what does it leave to you?',
    a: 'Both processes map the same physical pages, so there are no copies or system calls. You must do all synchronisation, notification and crash handling yourself.',
  },
  {
    q: 'Why should data in shared memory store offsets instead of pointers?',
    a: 'The shared object may be mapped at a different address in each process, so a pointer written by one process can be meaningless in the other.',
  },
  {
    q: 'What goes wrong if a process dies while holding a mutex in shared memory, and what helps?',
    a: 'The mutex stays locked and every other process blocks forever. A robust mutex tells the next locker that the owner died, so it can repair the data and continue.',
  },
  {
    q: 'How do kernel message queues differ from pipes, and why are they rarely used now?',
    a: 'They keep whole messages, with priorities. But limits are small, and Unix datagram or seqpacket sockets give message boundaries plus credentials and fd passing.',
  },
  {
    q: 'For small messages between processes, what dominates the cost?',
    a: 'System calls and waking the receiver, which usually means scheduling it and a context switch. For large data, the copies dominate.',
  },
  {
    q: 'Why do PyTorch data loaders crash with “bus error” in containers?',
    a: 'Workers pass batches through /dev/shm, which Docker limits to 64 MB by default. Writing past the limit raises SIGBUS. Raise the limit with --shm-size or an in-memory volume.',
  },
]
