---
title: 15. Networking in the Kernel
---

<script setup>
import { cards } from './networking-review'
</script>

# 15. Networking in the Kernel

Between your program's `write` and a packet on the wire sits a large part of the kernel: socket buffers, the
TCP state machine, queues, interrupts and the network card's driver. Interviewers probe it through production
symptoms, such as thousands of connections in <Term id="time-wait">`TIME_WAIT`</Term>, one-second connection delays, or dropped packets
under load. Those symptoms only make sense once you know the path.

::: info Before you start
- A <Term id="socket">socket</Term> is the kernel object a program uses to talk over the network. The program
  refers to it by a <Term id="file-descriptor">file descriptor</Term> and uses `read`, `write` and friends.
- Devices signal the CPU with an <Term id="interrupt">interrupt</Term>, and copy data to and from RAM by
  themselves with <Term id="dma">DMA</Term>.
- [Chapter 12](/io/io-models) covers how programs wait for many sockets (epoll, event loops). This chapter
  covers what happens inside the kernel below that.
:::

## Sockets and socket buffers

**In short:** every TCP socket has a send buffer and a receive buffer in the kernel. `write` copies into the
send buffer and returns; it does not mean the data was sent, let alone received.

A TCP connection is a two-way stream of bytes. For each connection, the kernel keeps two buffers:

- **The send buffer** holds data your program has written but the other side has not yet acknowledged. TCP
  must keep it until then, in case it needs to send it again.
- **The receive buffer** holds data that arrived but your program has not read yet.

When your program calls `write`, the kernel copies the bytes into the send buffer and returns. The data may
leave a moment later, or much later if the network is slow. A successful `write` says nothing about whether
the other side got it. Only a reply from the other program can tell you that.

When a buffer fills, things slow down on purpose:

- **Send buffer full:** a blocking `write` sleeps; a non-blocking one fails with `EAGAIN`. This is how a slow
  receiver slows your program down. [Chapter 12](/io/io-models) calls this backpressure.
- **Receive buffer full:** TCP tells the sender how much space is left in every packet it sends back (the
  **receive window**). As the buffer fills, the window shrinks. At zero, the sender stops. This is **flow
  control**.

### How big should the buffers be?

To keep a connection busy, the sender must have enough data in flight to fill the network path while it
waits for acknowledgements. That amount is the <Term id="bandwidth-delay-product">**bandwidth-delay product**</Term>:

```text
bandwidth × round-trip time = data in flight
1 Gbit/s  × 100 ms          = 12.5 MB
```

If buffers are smaller than that, a single connection cannot use the full bandwidth, however fast the link.
Linux grows each connection's buffers automatically, up to a system-wide maximum. On long-distance, high
bandwidth paths, such as between regions, that maximum can be the bottleneck.

::: details Going deeper: buffer settings
- `net.ipv4.tcp_rmem` and `tcp_wmem` hold three values: minimum, default and maximum buffer size. Automatic
  tuning grows buffers up to the maximum (a few MiB by default).
- Setting `SO_RCVBUF` or `SO_SNDBUF` on a socket turns off automatic tuning for it. The kernel also doubles
  the value you set, to leave room for its own bookkeeping. Setting them by hand often makes things worse.
- In the kernel, each packet is held in a structure called an **sk_buff** (socket buffer): the data plus
  headers and metadata. The whole stack passes sk_buffs from layer to layer.
- `ss -tm` shows each connection's buffer use; `ss -ti` shows its round-trip time, window and
  retransmissions.
:::

## The path of a packet

**In short:** sending goes down through TCP, IP, a queue and the driver to the card. Receiving comes up from
the card through a polling loop, IP and TCP into the socket's buffer, then wakes the reader.

<PacketPathDiagram />

### Sending

1. **`write`** copies your data into the socket's send buffer.
2. **TCP** decides how much it may send now. That depends on the receiver's window and on **congestion
   control**, TCP's estimate of how much the network can take without losing packets. It cuts the data into
   segments and adds its header.
3. **IP** picks a route, adds its header, and runs firewall rules.
4. **The queueing discipline** is a per-interface queue that decides the order and pace of outgoing packets.
5. **The driver** places the packet on the card's **send ring**: a circular list in RAM of packets for the
   card to send.
6. **The network card** reads the packet from RAM with DMA and puts it on the wire. It raises an interrupt
   later so the driver can free the memory.

### Receiving

1. **The network card** writes the incoming packet into RAM, into a buffer the driver prepared in advance on
   the card's **receive ring**. Then it raises an interrupt.
2. **The driver** does almost nothing in the interrupt itself. It schedules a polling loop (NAPI, next
   section) that takes a batch of packets off the ring.
3. **IP** checks whether the packet is for this machine and runs firewall rules.
4. **TCP** finds the connection, puts data in order, sends acknowledgements, and appends the data to the
   receive buffer.
5. **The kernel wakes the reader**: a thread blocked in `read`, or an epoll instance.
6. **`read`** copies the data from the receive buffer into your program's memory.

Every step costs CPU. At high packet rates, the cost per packet, not the cost per byte, becomes the limit.
Much of the rest of this chapter is about reducing it.

::: details Going deeper: offloads
Network cards take over some per-packet work:
- **Checksum offload:** the card computes and checks TCP/IP checksums.
- **Segmentation offload (TSO, GSO):** the kernel hands the card one large chunk, up to 64 KiB, and the card
  (or the driver, as late as possible) cuts it into packets.
- **Receive merging (GRO):** the kernel merges consecutive packets of the same connection into one large
  sk_buff before passing it up, so TCP processes one big piece instead of many small ones.
- `ethtool -k <iface>` lists which offloads are on. They are one reason `tcpdump` can show packets larger
  than the network allows.
:::

## Interrupts, NAPI and spreading work across cores

**In short:** an interrupt per packet would overwhelm the CPU, so Linux takes one interrupt and then polls for
a batch. Modern cards have many queues and spread connections across cores by hashing.

### NAPI: interrupt once, then poll

A 10 Gbit/s link can deliver over a million packets per second. If each raised an interrupt, the CPU would
spend all its time entering and leaving interrupt handlers. Under overload it would stop doing useful work
entirely.

So Linux uses a hybrid, called <Term id="napi">**NAPI**</Term> (the "new API"):

1. The first packet raises an interrupt. The driver turns further interrupts off for that queue and
   schedules a poll.
2. The poll runs soon after, as a **softirq**: deferred kernel work that runs outside the interrupt handler.
   It takes packets off the ring in batches, up to a budget.
3. When the ring is empty, the driver turns interrupts back on.

At low load, each packet gets fast interrupt-driven handling. At high load, the kernel polls and processes
packets in efficient batches. If softirq work piles up, the kernel moves it to a per-core kernel thread
called `ksoftirqd`, so user programs still get some CPU. A `ksoftirqd` thread using a lot of CPU in `top` is a
sign of heavy network load.

### RSS: many queues, many cores

One core cannot process 10 or 100 Gbit/s of traffic. Modern network cards have many receive queues, each
with its own interrupt, usually one per core. For each incoming packet, the card hashes the connection's
addresses and ports and picks a queue. This is <Term id="receive-side-scaling">**receive side scaling (RSS)**</Term>.

Hashing by connection has an important property. All packets of one connection go to the same queue, and so
to the same core. They stay in order, and that connection's data stays in one core's caches. Different
connections spread across cores.

The flip side: one very busy connection still lands on one core. A single elephant flow cannot use more than
one core's worth of receive processing.

::: details Going deeper: RPS, RFS, coalescing and busy polling
- **RPS** (receive packet steering) does RSS's job in software, for cards with few queues. **RFS** (receive
  flow steering) sends a connection's packets to the core where the program reading it last ran. Some cards
  do this in hardware (aRFS). **XPS** picks the send queue by core.
- **Interrupt coalescing** makes the card wait for a few packets or a few microseconds before interrupting.
  It saves CPU but adds latency. `ethtool -c` shows it.
- **Busy polling** (`SO_BUSY_POLL`, `net.core.busy_poll`) lets a thread waiting for data poll the card's
  queue directly, skipping the interrupt. It trades CPU for lower latency.
- NAPI's budget is set by `net.core.netdev_budget` (packets) and `netdev_budget_usecs` (time) per softirq
  run. `/proc/net/softnet_stat` counts runs that stopped because the budget ran out.
- `/proc/interrupts` shows how the card's queue interrupts spread across cores; `irqbalance` or manual
  affinity settings decide that spread.
:::

### Where packets get dropped

Packets can be dropped at several points, each with its own counter:

| Where | Why | How to see it |
|---|---|---|
| Card's receive ring | The kernel did not empty the ring fast enough. | `ethtool -S <iface>` (names vary: `rx_missed`, `rx_no_buffer`…) |
| Per-core backlog | Too much queued for software processing. | `/proc/net/softnet_stat` (second column) |
| Firewall or connection tracking | A rule, or the connection-tracking table is full. | `dmesg`, `conntrack -S` |
| Socket receive buffer | The program reads too slowly. | `nstat` (`TcpExtTCPRcvQDrop`, `UdpRcvbufErrors`) |
| Listen queue | Too many connections waiting for `accept`. | `nstat` (`TcpExtListenOverflows`) |

## The life of a TCP connection

**In short:** a connection opens with a three-way handshake and closes with a FIN and an ACK in each
direction. The side that closes first waits in `TIME_WAIT`; the side that has not closed yet sits in
`CLOSE_WAIT`.

### Opening

A client calls `connect`. Its kernel sends a **SYN** packet ("I want to connect; my numbering starts
here"). The server's kernel replies **SYN-ACK**, and the client's kernel answers **ACK**. The connection is
now **ESTABLISHED** on both sides. This is the **three-way handshake**. `connect` returns on the client when
the SYN-ACK arrives, one round trip after it started.

Notice who did the work: both kernels. The server program was not involved at all. The next section shows
where the finished connection waits until the program asks for it.

### Closing

Each direction of a TCP connection is closed separately. When a program calls `close`, its kernel sends a
**FIN** ("I will send nothing more"), and the other side acknowledges it. The other side sends its own FIN
when its program closes. Each step has a state name:

<TcpCloseDiagram />

Two of these states cause most production questions.

### CLOSE_WAIT: a bug in your program

`CLOSE_WAIT` means the other side has closed, and the kernel is waiting for **your program** to call
`close`. The kernel cannot finish on its own. If a server shows thousands of connections in `CLOSE_WAIT`, it
almost always has a leak: some code path, often an error path, forgets to close the socket. Each one holds a
file descriptor and kernel memory until the process exits.

### TIME_WAIT: working as designed

The side that closes first ends in `TIME_WAIT`, and stays there for twice the maximum lifetime of a packet
on the network. On Linux this is fixed at **60 seconds**. It has two jobs:

- **Resend the final ACK** if it was lost. Without it, the other side would retry its FIN and get an error.
- **Absorb late packets.** A delayed packet from the old connection could arrive later. If a new connection
  with the same addresses and ports existed by then, that packet could corrupt it. Waiting until old packets
  have expired prevents this.

A `TIME_WAIT` entry is small, and many thousands of them cost little memory. The real problem is **port
exhaustion** on clients. A connection is identified by four values: source address and port, destination
address and port. A client that opens and closes many short connections to the same server address and port
uses a new local port each time. Each port then stays in `TIME_WAIT` for 60 seconds. With the default range
of about 28,000 local ports, that allows only about 470 new connections per second to one destination.

Fixes, best first:

1. **Reuse connections.** HTTP keep-alive and connection pools avoid the problem entirely, and save the
   handshake too.
2. **`tcp_tw_reuse`** lets the kernel reuse a `TIME_WAIT` port for a new outgoing connection when TCP
   timestamps make it safe.
3. **More ports or more destinations:** widen `ip_local_port_range`, or spread traffic over several server
   addresses.

::: warning Settings to avoid
`tcp_tw_recycle` was a more aggressive option that broke clients behind NAT, where many machines share one
address. Linux removed it in 4.12. Advice to turn it on is out of date. Lowering `tcp_fin_timeout` does not
shorten `TIME_WAIT` on Linux; it controls a different state (`FIN_WAIT_2`).
:::

::: details Going deeper: resets, keepalive and dead peers
- A **RST** (reset) aborts a connection immediately, with no `TIME_WAIT`. The kernel sends one when a packet
  arrives for a port nobody listens on, or when a program closes a socket that still has unread data. The
  other side's next call fails with `ECONNRESET`.
- Writing to a connection the other side has reset raises the `SIGPIPE` signal, which kills the process by
  default. Servers ignore `SIGPIPE` or pass `MSG_NOSIGNAL` to `send`.
- If the other machine loses power, no FIN or RST ever arrives. An idle connection can look alive forever.
  TCP keepalive probes detect this, but Linux waits 2 hours by default before the first probe.
  Applications usually use their own heartbeats, or `TCP_USER_TIMEOUT`.
- When a process exits or crashes, the kernel closes all its sockets, sending FINs (or RSTs if unread data
  remains). The other side sees a normal close or a reset, not a hang.
- `SO_REUSEADDR` lets a restarted server bind its port while old connections to it are still in
  `TIME_WAIT`. Almost every server sets it.
:::

## SYN queue, accept queue and backlog

**In short:** a listening socket has two queues: half-finished handshakes and finished connections waiting
for `accept`. If the program accepts too slowly, the second queue fills, and new clients wait for a
retransmit: a delay of one second or more.

The kernel completes handshakes by itself. Finished connections wait in the listening socket until the
program calls `accept`. There are two queues:

<AcceptQueueDiagram />

- **The SYN queue** holds handshakes in progress: a SYN arrived and the SYN-ACK went out, but the final ACK
  has not arrived yet.
- <Term id="accept-queue">**The accept queue**</Term> holds connections whose handshake is complete, waiting for the program's `accept`.

The `backlog` argument of `listen(fd, backlog)` sets the size of the **accept queue**. The kernel caps it at
the `net.core.somaxconn` setting, which is 4096 on kernels since 5.4 and was 128 before.

### When the accept queue is full

If the program is slow to call `accept`, for example because all its threads are busy, the accept queue
fills. Linux then **ignores** new SYNs (and final ACKs) for that socket. It does not refuse them. The client
hears nothing, so it waits and sends the SYN again, after 1 second, then 2 more seconds, then 4, and so on.

This produces a very recognisable symptom: connection latency that jumps by **exactly 1 second, or 3
seconds**, under load. Whenever you see that pattern, check the listen queue.

### Try it: fill an accept queue

This program listens with a backlog of 2, never calls `accept`, and then connects to itself six times:

```c
// backlog.c: gcc -O2 -Wall backlog.c -o backlog && ./backlog
// A server that listens with a tiny backlog and never calls accept(). Watch what connect() does.
#include <arpa/inet.h>
#include <netinet/in.h>
#include <stdio.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <time.h>
#include <unistd.h>

#define PORT 9001

static double now_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1e3 + ts.tv_nsec / 1e6;
}

int main(void) {
    struct sockaddr_in addr = { .sin_family = AF_INET, .sin_port = htons(PORT) };
    inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);

    int lfd = socket(AF_INET, SOCK_STREAM, 0);
    int one = 1;
    setsockopt(lfd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
    if (bind(lfd, (struct sockaddr *)&addr, sizeof addr) < 0 || listen(lfd, 2) < 0) {
        perror("bind/listen");
        return 1;
    }
    // Note: we never call accept(). The kernel still completes handshakes on its own.

    for (int i = 1; i <= 6; i++) {
        int c = socket(AF_INET, SOCK_STREAM, 0);
        struct timeval limit = { .tv_sec = 5 };          // give up on connect() after 5 s
        setsockopt(c, SOL_SOCKET, SO_SNDTIMEO, &limit, sizeof limit);
        double t = now_ms();
        int r = connect(c, (struct sockaddr *)&addr, sizeof addr);
        printf("connection %d: %-9s after %6.0f ms\n", i, r == 0 ? "connected" : "timed out",
               now_ms() - t);
        // keep c open, so it stays in the accept queue
    }
    printf("now run: ss -lnt 'sport = :%d'   (Ctrl-C to quit)\n", PORT);
    pause();
}
```

Output (Linux 6.x):

```text
connection 1: connected after      0 ms
connection 2: connected after      0 ms
connection 3: connected after      0 ms
connection 4: timed out after   5151 ms
connection 5: timed out after   5120 ms
connection 6: timed out after   5120 ms
now run: ss -lnt 'sport = :9001'   (Ctrl-C to quit)
```

Three connections complete at once, though the program never accepted them: the kernel did the handshakes
and queued them. Linux allows one more than the backlog. The fourth client's SYNs are ignored, and it gives
up after 5 seconds of retries. In another terminal, `ss` shows the queue:

```text
$ ss -lnt 'sport = :9001'
State   Recv-Q  Send-Q  Local Address:Port   Peer Address:Port
LISTEN  3       2           127.0.0.1:9001        0.0.0.0:*
```

For a listening socket, `Recv-Q` is the number of connections waiting in the accept queue, and `Send-Q` is
its limit. A `Recv-Q` at or above `Send-Q` means the queue is full and clients are being delayed.

### SYN floods and SYN cookies

An attacker can send huge numbers of SYNs from fake addresses and never finish the handshakes. The SYN queue
fills with half-open entries, and real clients cannot get in. This is a **SYN flood**.

The defence is **SYN cookies**. When the SYN queue is full, the kernel stops storing half-open entries.
Instead, it encodes what it needs to remember into the sequence number of its SYN-ACK. A real client echoes
that number back in its ACK, and the kernel rebuilds the connection from it. Fake clients never answer, and
cost nothing. Linux enables SYN cookies by default (`tcp_syncookies = 1`), only when the queue overflows.

::: details Going deeper: tuning the listen queues
- Raise the `backlog` in `listen` **and** `net.core.somaxconn`; the smaller one wins. Many frameworks pass
  their own default backlog, often 511 or 1024.
- The SYN queue's limit comes from `net.ipv4.tcp_max_syn_backlog`, combined with the backlog.
- `tcp_abort_on_overflow = 1` makes the kernel reset connections instead of ignoring them when the accept
  queue is full. Clients then fail fast instead of waiting, which can be better behind a load balancer.
- A full accept queue is usually a symptom, not the disease. The real question is why the program is not
  calling `accept` fast enough: all workers busy, a blocked event loop, or garbage collection pauses.
- With `SO_REUSEPORT`, each worker has its own listening socket and its own queues ([Chapter
  12](/io/io-models)).
:::

## Nagle's algorithm and delayed ACKs

**In short:** two separate TCP optimisations, one on each side, can combine to add about 40 milliseconds to
small request-response exchanges. `TCP_NODELAY` turns off the sending side's half.

Two old optimisations each make sense alone:

- **Nagle's algorithm** (sender): while earlier data is still unacknowledged, hold back small segments and
  combine them into one. This stops a program that writes one byte at a time from flooding the network with
  tiny packets.
- **Delayed ACK** (receiver): wait a little before acknowledging, hoping to combine the ACK with reply data.
  On Linux the wait is at least about 40 ms.

Now picture a client that sends a request in two small writes: a header, then a body. The header goes out at
once. Nagle holds the body, waiting for the header's ACK. The server's kernel delays that ACK, waiting for a
reply the server cannot send until it has the body. Both wait until the delayed-ACK timer fires, about 40 ms
later. The request takes 40 ms instead of a fraction of a millisecond.

The fixes:

- **Build the whole message, then write it once** (or use `writev`). This is the best fix.
- **Set `TCP_NODELAY`** to turn off Nagle's algorithm. Most RPC frameworks, databases and HTTP clients set it
  by default.
- For large responses, `TCP_CORK` (or `MSG_MORE`) does the opposite: it tells the kernel more data is coming,
  so it can send full packets.

## Kernel bypass and its cousins

**In short:** at tens of millions of packets per second, even a tuned kernel stack costs too much per packet.
Kernel bypass hands the network card to a program directly. XDP and RDMA are middle grounds.

A 100 Gbit/s link carrying the smallest packets delivers about 150 million packets per second. That leaves
under 10 nanoseconds per packet, less than one cache miss. The kernel's per-packet work (sk_buffs, layers,
system calls, wake-ups) cannot fit. Most servers never get close to this, because real packets are bigger.
But packet-processing systems such as load balancers, firewalls and trading systems do.

<Term id="kernel-bypass">Kernel bypass</Term> removes the kernel from the data path:

- **DPDK** runs the network card's driver in a user program. Dedicated cores poll the card's rings in a tight
  loop, with no interrupts and no system calls. The program brings its own protocol handling, or none.
- <Term id="rdma">**RDMA**</Term> (remote direct memory access) lets a network card write straight into another machine's memory,
  without either CPU handling the data. InfiniBand and RoCE networks provide it. GPU training clusters use it
  heavily: NCCL moves gradients between machines over RDMA, and **GPUDirect RDMA** lets the card read and
  write GPU memory directly.

Between the full kernel stack and full bypass, Linux offers <Term id="xdp">**XDP**</Term>. It runs a small, verified program (an
eBPF program) inside the driver, on each packet, **before** the kernel builds an sk_buff. The program can
drop the packet, send it back out, redirect it, or pass it up the normal stack. DDoS filters and load
balancers use it: Cloudflare drops attack traffic this way, and Meta's Katran load balancer is built on it.
**AF_XDP** sockets hand selected packets straight to a user program.

The costs of bypass are real:

- **Dedicated, busy cores.** Poll-mode cores run at 100% even when idle.
- **Lost tools.** `tcpdump`, `ss`, firewall rules and the kernel's TCP implementation do not see the traffic.
- **Your own stack.** You must handle protocols, security and edge cases the kernel handled for you.

For most services, a well-tuned kernel stack is enough, and far easier to run.

## Why this matters in real systems

**The one-second latency spike.** A service's p99 latency shows steps at exactly 1 s and 3 s. Those are SYN
retransmission times. The accept queue is overflowing: check `ss -lnt` and the `ListenOverflows` counter.
The fix is to find out why the server accepts slowly, then raise the backlog.

**CLOSE_WAIT build-up.** A service slowly runs out of file descriptors, and `ss -tan state close-wait` shows
thousands of entries. Some code path does not close sockets, often after an error or a timeout. The fix is in
the code, not in kernel settings.

**Port exhaustion behind a proxy.** A service calls another service through a local proxy with a new
connection per request. Under load, `connect` fails with `EADDRNOTAVAIL`: all local ports to that
destination are in `TIME_WAIT`. Connection pooling fixes it.

**Kubernetes and connection tracking.** Service routing in Kubernetes often relies on the kernel tracking
every connection (`conntrack`). A busy node can fill that table, and then the kernel drops new connections,
logging `nf_conntrack: table full`. Raising the table size or reducing short-lived connections helps.

**ML training networks.** Distributed training exchanges huge gradient tensors between GPUs on many machines
every step. Going through the kernel's TCP stack would waste CPU and add copies. Clusters use RDMA
(InfiniBand or RoCE) with GPUDirect, so network cards move data straight between GPU memories.

**How to look:**

```bash
ss -s                                  # summary: counts per TCP state
ss -tan state time-wait | wc -l        # connections in TIME_WAIT
ss -lnt                                # listening sockets: Recv-Q = queued, Send-Q = backlog
ss -tinm                               # per connection: RTT, window, retransmits, buffers
nstat -az | grep -i -E 'listen|drop|retrans'   # kernel TCP counters
ethtool -S eth0 | grep -i -E 'drop|miss'       # card-level drops
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. write() on a TCP socket returned successfully. What do you know?
Only that the data was copied into the kernel's send buffer. It may not have left the machine yet. Even once
sent, it may be lost and retransmitted, and the other program may never read it. Only an
application-level reply confirms it was received and processed.

**Senior add-on:** if the send buffer is full, a blocking `write` sleeps and a non-blocking one returns
`EAGAIN`. That is how a slow receiver pushes back on the sender. On `close`, data still in the send buffer is
sent in the background, unless `SO_LINGER` says otherwise.
:::

::: details 2. Walk through what happens when a packet arrives at the network card.
The card writes the packet into a buffer the driver prepared on its receive ring, using DMA, and raises an
interrupt. The driver turns further interrupts off and schedules a NAPI poll. The poll runs as a softirq and
takes a batch of packets off the ring. For each, the kernel builds an sk_buff, merges related packets (GRO),
runs IP (routing and firewall) and TCP (ordering, ACKs). TCP appends the data to the socket's receive buffer
and wakes the reader, either a blocked `read` or an epoll instance. Finally `read` copies the data to user
memory.

**Senior add-on:** RSS picked which receive queue, and therefore which core, handled the packet, by hashing
the connection's addresses and ports. Drops can happen at the ring, the per-core backlog, the firewall, or
the socket buffer, each with its own counter.
:::

::: details 3. What is TIME_WAIT, why does it exist, and when is it a problem?
The side that closes a connection first stays in `TIME_WAIT` for 60 seconds on Linux. It exists to resend
the final ACK if it was lost, and to make sure delayed packets from the old connection cannot corrupt a new
connection that reuses the same addresses and ports.

It is a problem for clients that make many short connections to the same destination. Each uses a local
port that stays busy for 60 seconds, and the roughly 28,000 default ports run out.

**Senior add-on:** fix it with connection reuse first, then `tcp_tw_reuse` for outgoing connections, a
wider port range, or more destination addresses. Do not use `tcp_tw_recycle` (removed in 4.12, it broke NAT
users). `tcp_fin_timeout` does not change `TIME_WAIT`.
:::

::: details 4. A server has thousands of connections in CLOSE_WAIT. What does that mean?
The other side has closed, and the kernel is waiting for the server program to call `close`. The program
never does, so this is a socket leak in the application, usually on an error or timeout path.

**Senior add-on:** confirm with `ss -tanp state close-wait` to find the process, then look for code that
returns early without closing: exceptions, missing `finally` or `defer`, connection pools that do not detect
dead connections. Kernel tuning will not help.
:::

::: details 5. What does the backlog argument to listen() control? What happens when it is exceeded?
It sets the size of the accept queue: connections whose handshake is complete, waiting for the program to
call `accept`. The kernel caps it at `net.core.somaxconn`.

When the queue is full, Linux ignores new SYNs and final ACKs for that socket. Clients retransmit after 1
second, then 3 seconds in total, and so on. So connection times jump by whole seconds under load.

**Senior add-on:** `ss -lnt` shows the queue length (`Recv-Q`) against the limit (`Send-Q`), and
`ListenOverflows` counts overflows. There is a separate SYN queue for half-open handshakes, protected against
floods by SYN cookies.
:::

::: details 6. How do SYN cookies work?
When the SYN queue is full, the kernel stops storing state for half-open connections. It encodes the
connection's key details (such as a hash of its addresses and a timestamp) in the sequence number of its
SYN-ACK. A real client sends that number back in its ACK, and the kernel checks it and rebuilds the
connection. Fake clients never reply and use no memory.

**Senior add-on:** because there is little room in a sequence number, some TCP options could historically
be lost with cookies. Linux uses TCP timestamps to carry more of them. Cookies only activate under overflow.
:::

::: details 7. Why might a small request-response protocol see 40 ms delays? How do you fix it?
Nagle's algorithm on the sender holds back a small segment while earlier data is unacknowledged. Delayed ACK
on the receiver holds back the acknowledgement, hoping to combine it with a reply. If a request is sent in
two small writes, the second waits for an ACK that the receiver is delaying. Both wait for the delayed-ACK
timer, about 40 ms on Linux.

Fix it by sending each message in one write, or by setting `TCP_NODELAY`.

**Senior add-on:** `TCP_CORK` and `MSG_MORE` are the opposite tool, for batching large responses into full
packets. `TCP_QUICKACK` affects the receiver side but is not sticky.
:::

::: details 8. What are NAPI and RSS, and what problems do they solve?
NAPI solves interrupt overload. The first packet raises an interrupt, then the driver turns interrupts off and
polls the ring in batches until it is empty. At high rates, that is far cheaper than one interrupt per packet.

RSS solves the single-core limit. The card has many receive queues, each with its own interrupt on its own
core, and hashes each connection to one queue. Connections spread across cores, while each connection stays
on one core and in order.

**Senior add-on:** one heavy connection still uses one core for receive processing. RPS and RFS do similar
steering in software, and RFS steers to the core where the reading thread runs.
:::

::: details 9. When would you use kernel bypass, and what does it cost?
When per-packet kernel costs are the bottleneck: tens of millions of packets per second, or microsecond
latency needs. Examples are load balancers, packet filters, trading systems and storage networks. DPDK runs
the driver in user space with polling cores; RDMA lets cards write into remote memory directly.

The costs are dedicated cores spinning at 100%, losing kernel tools like `tcpdump`, `ss` and firewall rules,
and having to implement or bring your own protocol stack.

**Senior add-on:** XDP is the middle ground: an eBPF program in the driver handles or drops packets before
the kernel builds an sk_buff, while everything else still uses the normal stack. ML clusters rely on RDMA
with GPUDirect to move gradients between GPUs.
:::

::: details 10. A single TCP transfer between two regions is slow, though both links are fast. Why?
Probably the bandwidth-delay product. To fill a path, the sender needs bandwidth × round-trip time of data in
flight: 1 Gbit/s at 100 ms is 12.5 MB. If the socket buffers, or the maximum automatic tuning allows, are
smaller, the connection spends time waiting for acknowledgements. Packet loss makes it worse, because
congestion control cuts the sending rate.

**Senior add-on:** check `ss -ti` for the window, round-trip time and retransmissions. Raise the `tcp_rmem`
and `tcp_wmem` maximums, consider a different congestion control algorithm such as BBR, or use several
parallel connections.
:::

## Common misconceptions

- **"A successful `write` means the data was sent."** It means the data is in the kernel's send buffer.
- **"`TIME_WAIT` is a leak."** It is normal and cheap. It only hurts clients that churn through ports to one
  destination. `CLOSE_WAIT` is the one that signals a bug.
- **"The server program performs the handshake."** The kernel does. The program only sees finished
  connections, through `accept`.
- **"A full accept queue refuses connections."** Linux silently ignores them by default, so clients wait and
  retry.
- **"More interrupts mean faster networking."** Under load, NAPI polling in batches is what keeps the
  machine responsive.
- **"Kernel bypass is always faster."** It wins on packet rate and latency, at the cost of cores, tools and
  your own stack. Most services do not need it.

## Key takeaways

- Each TCP socket has a **send buffer** and a **receive buffer**. `write` fills the first; full buffers push
  back on the sender. Buffers must cover the **bandwidth-delay product**.
- Receiving uses **NAPI** (one interrupt, then batch polling) and **RSS** (hash each connection to a queue
  and a core).
- The side that closes first waits in **`TIME_WAIT`** for 60 s; many of them exhaust client ports.
  **`CLOSE_WAIT`** piling up means the program is not closing sockets.
- The kernel finishes handshakes into the **accept queue**. When it overflows, clients wait **1 s, 3 s…** to
  retry. SYN cookies defend the SYN queue against floods.
- **Kernel bypass** (DPDK, RDMA) and **XDP** trade tools and cores for packet rate and latency.

## Review

<Flashcards id="networking" :cards="cards" />

<MarkDone id="networking" />
