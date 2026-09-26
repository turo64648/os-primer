// Flashcards for the Networking in the Kernel chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'What does a successful write() on a TCP socket tell you?',
    a: 'Only that the data is in the kernel’s send buffer. It may not have been sent, and nothing says the other program read it.',
  },
  {
    q: 'Why does TCP keep data in the send buffer after sending it?',
    a: 'Until the other side acknowledges it, the data may need to be sent again if a packet is lost.',
  },
  {
    q: 'How does a slow receiver slow down a fast sender?',
    a: 'Its receive buffer fills, so the window it advertises shrinks to zero and the sender stops. The sender’s send buffer then fills, and its write blocks or returns EAGAIN.',
  },
  {
    q: 'What is the bandwidth-delay product, and why does it matter?',
    a: 'Bandwidth × round-trip time: the data that must be in flight to keep a path full. Buffers smaller than that cap a single connection’s speed.',
  },
  {
    q: 'Why doesn’t Linux take an interrupt for every received packet under load?',
    a: 'At a million packets per second the CPU would do nothing else. NAPI takes one interrupt, turns interrupts off, and polls the ring in batches until it is empty.',
  },
  {
    q: 'What does RSS do, and why hash by connection?',
    a: 'The card spreads packets over many queues and cores. Hashing by connection keeps each connection on one core, so its packets stay in order and its data stays in that core’s caches.',
  },
  {
    q: 'What is the limit of RSS for a single heavy connection?',
    a: 'All its packets go to one queue and one core, so one connection cannot use more than one core’s receive processing.',
  },
  {
    q: 'Who performs the TCP three-way handshake on a server?',
    a: 'The kernel. The program only sees finished connections, which it takes from the accept queue with accept().',
  },
  {
    q: 'What does the listen() backlog control?',
    a: 'The size of the accept queue: finished connections waiting for accept(). The kernel caps it at net.core.somaxconn.',
  },
  {
    q: 'What happens on Linux when the accept queue is full?',
    a: 'New SYNs are silently ignored. Clients retransmit after 1 s, then 2 s more, so connection latency jumps by whole seconds.',
  },
  {
    q: 'How do SYN cookies defend against SYN floods?',
    a: 'When the SYN queue is full, the kernel stores nothing and encodes the connection’s details in its SYN-ACK sequence number. Only real clients echo it back.',
  },
  {
    q: 'What two jobs does TIME_WAIT do?',
    a: 'Resend the final ACK if it was lost, and let delayed packets from the old connection expire before the same addresses and ports are reused.',
  },
  {
    q: 'Why can TIME_WAIT exhaust ports, and what is the best fix?',
    a: 'A client making many short connections to one destination uses a new local port each time, and each stays busy for 60 s. Reuse connections (keep-alive, pools).',
  },
  {
    q: 'What does a pile of CLOSE_WAIT connections mean?',
    a: 'The other side closed, and your program never called close(). It is a socket leak in the application, not a kernel tuning problem.',
  },
  {
    q: 'How do Nagle’s algorithm and delayed ACK cause 40 ms stalls?',
    a: 'Nagle holds a small second write until the first is acknowledged; the receiver delays that ACK hoping to send a reply. Both wait for the ~40 ms delayed-ACK timer.',
  },
  {
    q: 'How do you avoid the Nagle/delayed-ACK stall?',
    a: 'Send each message in one write (or writev), or set TCP_NODELAY, which most RPC frameworks do by default.',
  },
  {
    q: 'Why does kernel bypass exist?',
    a: 'At 100 Gbit/s with small packets there are under 10 ns per packet, less than the kernel’s per-packet work. Bypass lets a program poll the card directly.',
  },
  {
    q: 'What does kernel bypass cost?',
    a: 'Dedicated cores spinning at 100%, losing kernel tools like tcpdump, ss and firewall rules, and bringing your own protocol stack.',
  },
  {
    q: 'What is XDP, and why is it a middle ground?',
    a: 'A verified eBPF program runs in the driver on each packet before the kernel builds an sk_buff. It can drop or redirect packets fast, while other traffic uses the normal stack.',
  },
  {
    q: 'Why do GPU training clusters use RDMA?',
    a: 'Network cards move gradient data straight between machines’ memory, even GPU memory with GPUDirect, without the CPU copying it through the kernel’s TCP stack.',
  },
]
