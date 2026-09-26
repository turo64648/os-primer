---
title: 12. I/O Models
---

<script setup>
import { cards } from './io-models-review'
</script>

# 12. I/O Models

An I/O model is the way a program waits for slow things: network data, disk reads, new connections. It
decides how many connections one machine can serve, and why nginx, Redis, Node.js and Go look the way they
do. That makes it a favourite starting point for system design and "how does this server scale?" questions.

::: info Before you start
- A <Term id="syscall">system call</Term> is how a program asks the <Term id="kernel">kernel</Term> to do
  something, such as read from the network. It costs on the order of 100 nanoseconds.
- A <Term id="file-descriptor">file descriptor</Term> is a small number that stands for an open file,
  socket or pipe.
- A <Term id="thread">thread</Term> is one line of execution. When it must wait, the kernel runs another
  thread in its place: a <Term id="context-switch">context switch</Term>.

[Chapter 1](/foundations/what-is-an-os) explains all three. You need nothing else.
:::

## The problem: waiting

**In short:** most I/O calls can wait for a long time. The question of this chapter is what your thread does
while it waits.

A web server has a connection open to a phone. It calls `read` to get the next request. The phone is on a
slow mobile network, so the next bytes arrive 200 milliseconds later. For a CPU, that is an age: enough time
to run hundreds of millions of instructions.

Something must happen in those 200 milliseconds. There are three broad answers:

- **The thread sleeps inside `read`** until the data arrives. This is **blocking I/O**.
- **`read` returns at once** with "nothing yet", and the program does other work and asks again later. This
  is **non-blocking I/O**.
- **The program asks the kernel to do the read** and tell it when the data is in the buffer. The program
  never waits inside the call. This is **asynchronous I/O**.

The rest of the chapter explains each answer, what it costs, and which real systems use it. The network
connection in this example is a <Term id="socket">socket</Term>: the kernel object a program reads and writes
to talk over a network. [Chapter 15](/io/networking) covers how sockets work inside.

## Blocking I/O

**In short:** a blocking call puts the thread to sleep until it can finish. It is the simplest model, and it
leads naturally to one thread per connection.

When a thread calls `read` on a socket with no data, the kernel marks the thread as waiting and runs another
one. When a packet arrives, the network card raises an <Term id="interrupt">interrupt</Term>. The kernel
puts the data in the socket's buffer and marks the thread as runnable again. Later the thread gets a CPU,
copies the data out, and `read` returns. [Chapter 1](/foundations/what-is-an-os) describes this path.

This is <Term id="blocking-io">blocking I/O</Term>, and it is the default for every file descriptor. The
code is easy to read, because it runs top to bottom:

```c
for (;;) {
    int conn = accept(listener, NULL, NULL);  // sleeps until a client connects
    handle(conn);                             // read request, write reply, close
}
```

This server has a serious flaw. While `handle` waits for one slow client, nobody calls `accept`, so every
other client waits too. The obvious fix is to give each connection its own thread:

```c
for (;;) {
    int conn = accept(listener, NULL, NULL);
    start_thread(handle, conn);   // this connection gets a thread of its own
}
```

This is the **thread-per-connection** model. Each thread blocks on its own client, and the kernel's
<Term id="scheduler">scheduler</Term> runs whichever threads have data. Apache's classic design, early Java
servlet containers and most database servers work like this. PostgreSQL even uses a whole process per
connection.

## The C10K problem

**In short:** in 1999 Dan Kegel asked how one server could handle 10,000 connections at once. With one thread
each, the costs of threads, not the network, became the limit.

Thread per connection works well for hundreds of connections. At tens of thousands, the costs add up:

- **Memory.** Each thread reserves a stack. On Linux with glibc the default reservation is 8 MiB. Only the
  pages a thread touches use RAM, but each thread still costs tens of KiB in practice, including a stack
  inside the kernel.
- **Context switches.** Each wake-up costs a few microseconds once you count the refilled CPU caches. With
  many threads waking for tiny pieces of work, switching can use more CPU than the work itself.
- **Scheduler and lock pressure.** More runnable threads mean longer queues and more fighting over shared
  locks.
- **Mostly idle threads.** A chat server or a push service keeps connections open for hours. Almost every
  thread sleeps almost all of the time, yet each one still costs memory.

Kegel's essay, called "The C10K problem", listed the ways out. The main one: stop dedicating a thread to
each connection. Instead, let **one thread watch many connections** and serve whichever ones are ready. The
rest of this chapter is about the tools that make that possible.

::: tip Threads are cheaper than their reputation
Modern Linux handles tens of thousands of threads. For a few thousand busy connections, thread per
connection is often fine and much simpler. The event-loop approach wins when connections are many and mostly
idle, which is where "C10M" (ten million) discussions start.
:::

::: details Going deeper: the numbers
- The default thread stack comes from `ulimit -s` (8 MiB on most distros). You can set a smaller one per
  thread with `pthread_attr_setstacksize`.
- Each thread also has a kernel stack: 16 KiB on x86-64.
- A direct context switch costs around a microsecond or two. The indirect cost of refilling caches and the
  TLB can be several times more. [Chapter 8](/cpu/scheduling) covers this.
- Limits you will hit first: `ulimit -u` (processes per user), `kernel.threads-max`, and
  `vm.max_map_count` (each thread stack is a memory region).
:::

## Non-blocking I/O

**In short:** a non-blocking call never sleeps. If it cannot make progress right now, it fails with the
error `EAGAIN`, and the program tries again later.

You can switch any socket into non-blocking mode. Now a `read` with no data does not sleep. It returns `-1`
at once, with <Term id="errno">`errno`</Term> set to `EAGAIN` ("try again"). A `write` to a full socket
buffer does the same. This is <Term id="non-blocking-io">non-blocking I/O</Term>.

```c
fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK);   // switch fd to non-blocking

ssize_t n = read(fd, buf, sizeof buf);
if (n < 0 && errno == EAGAIN) {
    // no data yet: do something else, come back later
}
```

This alone does not solve anything. A thread with 10,000 non-blocking sockets could loop over them and try
each one. But that burns a whole CPU core asking "anything yet?" 10,000 times. What it needs is a way to
**sleep until any one of them is ready**. That is what select, poll and epoll do.

Keep one idea from this section: non-blocking I/O and "readiness" go together. The kernel says "this socket
is ready", and the program then makes the non-blocking call, which now succeeds.

::: details Going deeper: EAGAIN, EWOULDBLOCK and friends
- `EWOULDBLOCK` is the same value as `EAGAIN` on Linux. Portable code checks both.
- `accept4(..., SOCK_NONBLOCK)` and `socket(..., SOCK_NONBLOCK, ...)` create a descriptor that is already
  non-blocking, saving one system call.
- A non-blocking `connect` returns `EINPROGRESS`. The socket becomes writable when the connection completes,
  and `getsockopt(SO_ERROR)` tells you whether it worked.
- `O_NONBLOCK` has no effect on regular files. A later section explains why.
:::

## Waiting for many sockets: select and poll

**In short:** select and poll let one thread sleep until any of a list of descriptors is ready. Their flaw is
that the whole list crosses into the kernel, and gets scanned, on every call.

Picture a waiter with ten tables. Standing at one table until it orders is blocking I/O. A better waiter
scans the room and walks to whichever table raises a hand. `select` and `poll` let a program do that.

With `poll`, the program passes an array: "these descriptors, and for each, whether I care about reading or
writing". The kernel checks each one. If none is ready, the thread sleeps until one becomes ready or a
timeout passes. On return, the kernel has marked which entries are ready, and the program handles them.

This is **I/O multiplexing**: one thread, many connections. It works, and it is how the first event-driven
servers were built. But look at what happens with 10,000 connections and 3 of them active:

- The program passes all 10,000 entries into the kernel on every call.
- The kernel checks all 10,000, and registers the thread as a waiter on each one, then unregisters it.
- The program then scans all 10,000 results to find the 3 ready ones.

So each call costs work in proportion to the number of connections **watched**, not the number **ready**.
Under load the server spends most of its time scanning.

`select` is the older version. It has an extra limit: it uses a fixed-size bitmap, so it cannot watch
descriptor numbers of 1024 or more. `poll` removed that limit but kept the scanning.

::: details Going deeper: select's traps
- `FD_SETSIZE` is 1024 in glibc. Passing a descriptor number of 1024 or more to `FD_SET` writes past the end
  of the bitmap and corrupts memory. It does not return an error.
- `select` modifies the sets you pass in, so you must rebuild them before every call.
- `select` is still useful for tiny programs and is available almost everywhere, including Windows (for
  sockets only).
:::

## epoll

**In short:** epoll keeps the watch list inside the kernel. The kernel adds a socket to a ready list when
data arrives, and a wait call returns only that list.

The fix for the scanning is to stop re-sending the list. Linux's <Term id="epoll">epoll</Term> splits the
job into two steps:

1. **Register once.** The program creates an epoll instance and adds each socket to it once, saying which
   events it cares about. The kernel keeps this **watch list**.
2. **Wait many times.** Each wait call returns only the sockets that are ready now.

How does the kernel know what is ready without scanning? When a socket is added, epoll hooks into it. When a
packet arrives and the socket becomes readable, that hook puts the socket on the epoll instance's **ready
list** and wakes any waiting thread. So the work happens once, when data arrives, not on every wait.

<EpollDiagram />

There are three calls:

| Call | What it does |
|---|---|
| `epoll_create1` | Creates an epoll instance. It is itself a file descriptor. |
| `epoll_ctl` | Adds, changes or removes one descriptor on the watch list. |
| `epoll_wait` | Sleeps until something is ready, then fills an array with the ready events. |

Each event carries a 64-bit value that you chose when you registered the socket. Programs store the
descriptor number there, or a pointer to their own per-connection object. This saves a lookup on every
event.

Other systems have the same idea under other names. BSD and macOS have **kqueue**, which appeared around the
same time and can also watch timers, signals and processes. Windows takes a different approach, covered in
the section on asynchronous I/O.

::: details Going deeper: epoll internals
- The watch list is a red-black tree, so adding or removing a descriptor costs O(log n). The ready list is a
  linked list.
- epoll registers a callback on each socket's wait queue. The network stack calls it when the socket's state
  changes, and the callback moves the socket onto the ready list.
- epoll watches the underlying open file, not the descriptor number. If you `dup` a descriptor and close one
  copy, the registration stays. This surprises people who close a socket and still get events for it.
- `epoll_wait` itself costs a system call. Busy servers wake with many events at once, so that cost is shared
  across them.
:::

### Level-triggered and edge-triggered

**In short:** level-triggered epoll keeps reporting a socket while it has data. Edge-triggered epoll reports
it only when something new happens, so you must read everything each time.

Suppose 8 KiB arrive on a socket, and your program reads only 4 KiB, then calls `epoll_wait` again. What
should happen?

- **Level-triggered** (the default): the socket still has data, so `epoll_wait` reports it again. It reports
  a **state**: "is readable". This is how `poll` behaves too, and it is forgiving.
- **Edge-triggered** (the `EPOLLET` flag): the socket already had data last time, and nothing new has
  arrived, so `epoll_wait` does **not** report it. It reports a **change**: "new data came". If no more data
  ever comes, the remaining 4 KiB sit there forever and the connection hangs.

<Term id="edge-triggered">Edge-triggered</Term> mode has one strict rule: **when a socket is reported, keep
reading (or writing) until you get `EAGAIN`**. Only then do you know you have drained it, and the next
report will come when something new arrives.

Why use it at all? It avoids repeated reports of the same socket, which saves wake-ups when several threads
share one epoll instance. Go's runtime, Netty's native transport and many Rust runtimes use it. The price is
a class of bugs where one forgotten loop hangs a connection.

::: warning The fairness trap
With edge-triggered mode, "read until `EAGAIN`" can starve other connections. A client that sends data
nonstop keeps your loop busy on its socket forever. Real event loops read a limited amount per turn, remember
that the socket still has data, and come back to it after serving the others.
:::

::: details Going deeper: EPOLLONESHOT and EPOLLRDHUP
- `EPOLLONESHOT` disables a socket's registration after one event. The thread that handles it re-enables it
  with `epoll_ctl(EPOLL_CTL_MOD)` when done. This makes sure only one thread handles a socket at a time when
  many threads call `epoll_wait` on the same instance.
- `EPOLLRDHUP` reports that the other side closed its sending direction, without a `read` that returns 0.
- Edge-triggered epoll may report a socket again when more data arrives, even if you had not drained it. The
  rule "drain until `EAGAIN`" still applies; do not rely on getting exactly one report.
:::

### Try it: an epoll echo server

This server accepts connections and sends back everything it receives. One thread serves every client. It
uses level-triggered mode, the simpler one.

```c
// echo.c: gcc -O2 -Wall echo.c -o echo && ./echo   (then: nc localhost 9000)
#define _GNU_SOURCE
#include <errno.h>
#include <netinet/in.h>
#include <stdio.h>
#include <sys/epoll.h>
#include <sys/socket.h>
#include <unistd.h>

#define PORT 9000
#define MAX_EVENTS 64

int main(void) {
    // 1. A listening socket. SOCK_NONBLOCK: accept() returns EAGAIN instead of waiting.
    int lfd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0);
    int one = 1;
    setsockopt(lfd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
    struct sockaddr_in addr = { .sin_family = AF_INET,
                                .sin_port = htons(PORT),
                                .sin_addr.s_addr = htonl(INADDR_ANY) };
    if (bind(lfd, (struct sockaddr *)&addr, sizeof addr) < 0 || listen(lfd, 128) < 0) {
        perror("bind/listen");
        return 1;
    }

    // 2. An epoll instance, watching the listening socket for "readable" (= a new connection).
    int ep = epoll_create1(0);
    struct epoll_event ev = { .events = EPOLLIN, .data.fd = lfd };
    epoll_ctl(ep, EPOLL_CTL_ADD, lfd, &ev);
    printf("echo server on port %d\n", PORT);

    struct epoll_event ready[MAX_EVENTS];
    char buf[4096];
    for (;;) {
        // 3. Sleep until at least one socket is ready. This is the only place we wait.
        int n = epoll_wait(ep, ready, MAX_EVENTS, -1);
        for (int i = 0; i < n; i++) {
            int fd = ready[i].data.fd;
            if (fd == lfd) {
                // 4a. New connection: accept it and add it to the watch list.
                int cfd = accept4(lfd, NULL, NULL, SOCK_NONBLOCK);
                if (cfd < 0) continue;              // EAGAIN: someone else got it
                ev = (struct epoll_event){ .events = EPOLLIN, .data.fd = cfd };
                epoll_ctl(ep, EPOLL_CTL_ADD, cfd, &ev);
                printf("fd %d connected\n", cfd);
            } else {
                // 4b. Data on a connection: read what is there and send it back.
                ssize_t r = read(fd, buf, sizeof buf);
                if (r < 0 && errno == EAGAIN) continue;     // nothing there after all
                // Simplification: if the reply does not fit in the send buffer at once,
                // drop the client. A real server keeps the rest and waits for EPOLLOUT.
                if (r <= 0 || write(fd, buf, r) != r) {     // r == 0: the client closed
                    printf("fd %d closed\n", fd);
                    close(fd);                              // also removes it from epoll
                }
            }
        }
    }
}
```

Run it, then open two more terminals and connect from each with `nc localhost 9000`. Type a line in either
one: it comes straight back. Press Ctrl-C in an `nc` terminal to disconnect. The server prints:

```text
echo server on port 9000
fd 5 connected
fd 6 connected
fd 5 closed
fd 6 closed
```

The exact descriptor numbers may differ. Things to notice:

- A listening socket is "readable" when a new connection is waiting. So accepting is one more event, handled
  by the same loop.
- The only place the thread sleeps is `epoll_wait`. Every other call is non-blocking.
- Run `strace -f ./echo` and you will see the rhythm of an event loop: `epoll_wait`, then a few `read` and
  `write` calls, then `epoll_wait` again.

::: details Going deeper: turning it edge-triggered
Add `EPOLLET` to the client's events. Then wrap the `read` in a loop that runs until `read` returns `-1` with
`EAGAIN`. Without that loop, send a line longer than 4096 bytes and watch the tail of it get stuck until you
type something else. To make it correct under load, also keep unsent data per connection, and register
`EPOLLOUT` only while that data exists.
:::

## Event loops

**In short:** an event loop is one thread that waits for events, runs a short handler for each, and waits
again. Its one rule: a handler must never block.

The echo server is a tiny <Term id="event-loop">event loop</Term>. Real ones add timers ("close this
connection if idle for 60 seconds") and a queue of work posted by other threads. The loop then looks like
this:

```text
forever:
    timeout = time until the next timer is due
    events  = epoll_wait(timeout)
    for each event: run its handler (read, parse, write a bit)
    run the timers that are due
    run the work posted by other threads
```

This design is also called the **reactor** pattern. Its strength is that one thread with a small amount of
memory per connection can serve tens of thousands of connections. Each connection is only a small state
object, not a thread with a stack.

### The rule: never block the loop

Everything on an event loop shares one thread. If one handler takes 50 milliseconds, every other connection
waits 50 milliseconds. Common ways to block a loop by accident:

- A long computation: parsing a huge JSON body, compressing, hashing passwords.
- A blocking call hidden in a library: a DNS lookup through `getaddrinfo`, a synchronous log write, a
  database driver that is not event-based.
- A disk read. This one is surprising enough to get its own section below.

The fix is always the same. Move that work to a separate pool of threads, and have it post the result back
to the loop.

### Many cores

One event loop uses one core. To use a 64-core machine, servers run **one event loop per core**. Each loop
owns its own set of connections, so the loops rarely need to share data or locks. This is the shape of
nginx, Netty, Envoy, and many others.

### How real systems map onto this

| System | Design |
|---|---|
| **nginx** | A few worker processes, usually one per core, each running its own epoll loop. Blocking file reads can go to a thread pool. |
| **Redis** | One main thread runs an epoll loop and executes every command, so a slow command stalls every client. Since Redis 6, extra threads can do socket reads and writes, but commands still run on one thread. |
| **Node.js** | One JavaScript thread on top of libuv's event loop (epoll on Linux, kqueue on macOS, IOCP on Windows). File access, DNS lookups and some crypto run on a libuv thread pool. |
| **Netty (Java)** | A group of event-loop threads, each with its own set of connections. On Linux it can use its own epoll transport, edge-triggered by default. |
| **Go** | Goroutines call blocking-looking `Read`. Underneath, the socket is non-blocking. On `EAGAIN` the runtime parks the goroutine, and its "netpoller" (epoll, edge-triggered) wakes it when the socket is ready. |
| **Tokio (Rust)** | `async` tasks on a multi-threaded scheduler. The mio library wraps epoll or kqueue. File operations run on a separate blocking thread pool. |

Go and Tokio show the modern trend. The runtime runs an event loop underneath, but the programmer writes
code that reads top to bottom, like the thread-per-connection version. Java's virtual threads (Java 21) do
the same. You get the simple code of blocking I/O with the scaling of an event loop.

### Backpressure

**In short:** when a consumer is slower than a producer, something must tell the producer to slow down.
Otherwise buffers grow until memory runs out.

Imagine a proxy that reads from a fast server and writes to a slow phone. Reads succeed quickly, but writes
to the phone's socket start returning `EAGAIN`, because the socket's send buffer is full. If the proxy keeps
reading and queuing the data in memory, that queue grows without limit. With enough slow clients, the
process runs out of memory.

The fix is <Term id="backpressure">backpressure</Term>: let the slow side's pressure flow back to the fast
side. In an event loop:

1. When a write hits `EAGAIN`, keep the unsent data and register interest in "writable" (`EPOLLOUT`).
2. **Stop reading** from the source connection while that data is pending. Its kernel buffer fills, TCP's
   flow control tells the sender to pause, and the pressure reaches the real producer.
3. When the socket becomes writable, send the rest, remove `EPOLLOUT`, and resume reading.

Registering `EPOLLOUT` all the time is a classic mistake. A socket is almost always writable, so a
level-triggered loop would spin at 100% CPU. Frameworks expose backpressure in different ways: "high and low
water marks" on buffers (Netty), `write()` returning `false` plus a `'drain'` event (Node.js streams), or
bounded channels (Go, Tokio).

## The thundering herd

**In short:** when many threads wait for the same event, one event can wake all of them, though only one can
use it. The kernel has flags to wake only one, or to give each thread its own socket.

A server runs 32 worker processes, and each one waits for new connections on the same listening socket. One
client connects. If the kernel wakes all 32 workers, one wins `accept`, and 31 get `EAGAIN` and go back to
sleep. That is 31 wasted wake-ups per connection. Under a high connection rate, this
<Term id="thundering-herd">thundering herd</Term> wastes a lot of CPU.

Linux fixed the plain case long ago: threads sleeping in `accept` itself are woken one at a time. The
problem came back with epoll, because each worker has its own epoll instance watching the same listening
socket. There are two modern fixes:

- **`EPOLLEXCLUSIVE`** (Linux 4.5): a flag when registering the socket. The kernel wakes one waiting epoll
  instance (or a few) instead of all of them.
- **`SO_REUSEPORT`** (Linux 3.9): each worker opens **its own** listening socket on the same port. The kernel
  spreads incoming connections across them by hashing the connection's addresses. There is no shared queue,
  so no herd and no lock contention.

`SO_REUSEPORT` scales best, and nginx offers it with the `reuseport` option. Its downside is that the kernel
assigns connections without knowing how busy each worker is. A worker stuck on slow work still gets its
share of new connections, which then wait. With one shared socket, an idle worker would have picked them up.
[Chapter 15](/io/networking) explains the listening socket's queues.

## Regular files are always "ready"

**In short:** readiness makes no sense for disk files, so epoll refuses them and poll says "ready" at once.
Disk reads block the event loop, which is why runtimes use thread pools for files.

Everything above assumes a socket. A socket's data arrives from outside, whenever the other side sends it.
"Ready" means "data is here now". A regular file on disk is different. The data is always there; it may only
be slow to fetch. There is no event to wait for until you ask for a specific range.

So the readiness APIs do not help with files:

- `poll` and `select` always report a regular file as readable and writable.
- `epoll_ctl` refuses to add a regular file and fails with `EPERM`.
- `O_NONBLOCK` is ignored. A `read` of data that is not in the <Term id="page-cache">page cache</Term> (the
  kernel's in-memory copy of file data) sleeps until the disk delivers it.

For an event loop, that is a problem. A read that misses the page cache takes around 100 microseconds on an
SSD and around 10 milliseconds on a hard disk. During that time the whole loop, and every connection on it,
stops. [Chapter 13](/io/file-systems) explains the page cache.

Runtimes took three routes around this:

1. **A thread pool for files.** The loop hands the blocking call to a pool of helper threads and gets an
   event when it finishes. This is what libuv (Node.js), Tokio, and nginx's `aio threads` do. It works
   everywhere, but costs a thread hand-off per operation, and a small pool can become a queue. libuv's pool
   has only 4 threads by default.
2. **Let the thread block, and replace it.** Go's runtime notices when a goroutine's OS thread is stuck in a
   system call, and moves the other goroutines to another thread.
3. **A real asynchronous interface** for files. Linux's first attempt, "native AIO", had serious limits. The
   second attempt is io_uring, covered below.

::: details Going deeper: Linux native AIO and POSIX AIO
- Linux native AIO (`io_submit`, `io_getevents`, available since 2.6) is only truly asynchronous with
  `O_DIRECT`, which bypasses the page cache. Even then it can block, for example when the file system must
  read metadata to find where the data lives. Databases that manage their own cache, such as MySQL's InnoDB
  and ScyllaDB, used it anyway.
- POSIX AIO (`aio_read`) exists in glibc, but glibc implements it with a pool of user threads.
- `preadv2` with `RWF_NOWAIT` (Linux 4.14) reads only what is already in the page cache and returns `EAGAIN`
  otherwise. An event loop can try it first and fall back to a thread pool on a miss.
:::

## Asynchronous I/O: readiness and completion

**In short:** readiness APIs tell you "you can read now, without waiting". Completion APIs take the whole
request and tell you "it is done, the data is in your buffer".

epoll is a **readiness** interface. It says a socket is ready; your program then makes the `read` call
itself. That is two steps and at least two system calls, but the second one never waits.

A **completion** interface works the other way. You hand over the whole request: "read 4 KiB from this file
at this offset into this buffer". The call returns at once. Later you get a notification that the read has
finished, with the byte count. The kernel did the waiting and the copy. This is true
**asynchronous I/O**, and it works for files as well as sockets.

| | Blocking | Non-blocking + readiness | Asynchronous (completion) |
|---|---|---|---|
| **Does the call sleep?** | Yes, until done | No | No |
| **What you learn** | The result | "Ready, now call read" | "Done, here is the result" |
| **Who copies the data** | Kernel, during your call | Kernel, during your second call | Kernel, in the background |
| **Works for disk files** | Yes (by sleeping) | No | Yes |
| **Examples** | Plain `read` | epoll, kqueue, poll | io_uring, Windows IOCP |

Completion has one new rule. Your buffer belongs to the kernel until the operation completes. You must not
free it, reuse it, or let it go out of scope in the meantime. This is why Rust's io_uring libraries need
buffers the runtime owns, and why cancelling an operation is harder than it looks.

Windows has used the completion model for decades, through **I/O completion ports (IOCP)**. Linux got a
general one in 2019, with io_uring.

## io_uring

**In short:** io_uring gives the program and the kernel two shared queues in memory. The program writes
requests into one and reads results from the other, and many operations need one system call, or none.

<Term id="io-uring">io_uring</Term> arrived in Linux 5.1 in 2019, written by Jens Axboe. It solves two
problems at once: a true asynchronous interface for files, and fewer system calls for everything.

At setup, the kernel creates two ring-shaped queues in memory that both the program and the kernel can see:

- The **submission queue** holds requests. Each request says what to do (read, write, accept, send, and
  dozens more), on which descriptor, with which buffer, plus a 64-bit tag you choose.
- The **completion queue** holds results. Each result carries your tag and a return value, such as the byte
  count or a negative error.

<IoUringDiagram />

A typical loop:

1. The program writes several requests into the submission queue. This is a plain memory write, not a system
   call.
2. It makes **one** system call, `io_uring_enter`, to tell the kernel "there are new requests". The same call
   can also wait until some results arrive.
3. The kernel runs the operations. Results appear in the completion queue as each one finishes, in any
   order. The tag tells the program which request each result belongs to.
4. The program reads results straight from memory, again without a system call.

Ten reads and five writes cost one system call instead of fifteen. With **polling mode** (`SQPOLL`), a
kernel thread watches the submission queue, and a busy program makes no system calls at all. The cost is a
CPU core partly spent spinning.

::: details Going deeper: features that matter in practice
- **Fixed files and buffers.** Registering descriptors and buffers once saves the kernel from looking them up
  and pinning memory on every operation.
- **Linked requests.** A flag chains requests so that the next starts only when the previous one succeeds,
  for example "write, then fsync".
- **Multishot requests.** One `accept` or `recv` request keeps producing results for every new connection or
  message, instead of being submitted again each time (Linux 5.19 and 6.0).
- **How the kernel runs requests.** For sockets, it tries the operation at once. If the socket is not ready,
  it uses an internal readiness hook, much like epoll. For work that would block, such as some file system
  operations, it hands the request to its own pool of kernel worker threads (io-wq). So io_uring is
  sometimes a kernel-side thread pool.
- Features appear release by release. Code that uses them must probe for support. `liburing` is the usual
  library for this.
:::

### When io_uring is not worth it

io_uring is powerful, but it is not a free upgrade. Reasons to stay with epoll or a thread pool:

- **Few, busy connections.** If the server makes a few thousand system calls a second, saving them saves
  almost nothing. The gains show up at very high operation rates and with disk I/O.
- **Security policy.** io_uring has had many serious kernel bugs. Its operations also bypass system call
  filters such as <Term id="seccomp">seccomp</Term>, which see only `io_uring_enter`, not what it does.
  Google reported in 2023 that it restricts io_uring on Android, ChromeOS and its production servers. Many
  container platforms block it by default, and Linux 6.6 added a setting to turn it off.
- **Portability and kernel versions.** It is Linux-only, and useful features need recent kernels. Many
  production fleets run older ones.
- **Complexity.** Buffer ownership, cancellation and error handling are harder than with epoll. Most
  frameworks still use epoll for networking.

A good interview answer: io_uring is the right tool for storage-heavy systems (databases, storage engines,
file-serving proxies) and for very high operation rates. For a typical web service, epoll and a runtime like
Go or Tokio are already fast, and the bottleneck is usually elsewhere.

## Zero-copy: sendfile and splice

**In short:** sending a file with `read` and `write` makes the CPU copy the data twice. `sendfile` and
`splice` move data between descriptors inside the kernel, without copying it into your program.

A static file server or a Kafka broker spends its life sending file contents to sockets. The naive version
looks like this:

```c
while ((n = read(file, buf, sizeof buf)) > 0)
    write(sock, buf, n);
```

Follow one chunk of data. The disk puts it into the page cache using <Term id="dma">DMA</Term>: the device
copies into RAM by itself. `read` makes the CPU copy it into `buf`. `write` makes the CPU copy it again, into
the socket's buffer. The network card then fetches it with DMA. That is two CPU copies and two system calls
per chunk, and your program never even looked at the data.

<ZeroCopyDiagram />

**`sendfile(sock, file, &offset, count)`** does the whole transfer inside the kernel with one system call.
The data never enters your program's memory. Most server network cards can collect one packet from several
places in RAM (called scatter-gather). With such a card, the socket buffer holds only pointers into the page
cache, the card reads straight from there, and the CPU copies nothing. This is what people mean by
<Term id="zero-copy">zero-copy</Term>.

**`splice`** is the general version. It moves data between any descriptor and a **pipe**, again inside the
kernel. Chaining two splices (socket to pipe, pipe to socket) lets a proxy forward data without touching it.

Zero-copy has limits:

- **You cannot change the data.** If you need to compress, encrypt or parse it, it must pass through your
  program anyway.
- **TLS breaks it**, because encryption normally happens in user space. Kernel TLS (kTLS) moves encryption
  into the kernel, so sendfile works for HTTPS again. Netflix's video cache servers (which run FreeBSD) use
  sendfile with kernel TLS.
- **Small transfers gain little.** The saved copies only matter for large amounts of data.

::: details Going deeper: MSG_ZEROCOPY and other variants
- `MSG_ZEROCOPY` (Linux 4.14) lets `send` transmit straight from your buffer. The kernel pins your pages and
  later tells you, through the socket's error queue, when you may reuse the buffer. The kernel documentation
  says it generally only pays off for writes larger than about 10 KB.
- `vmsplice` maps user pages into a pipe; `tee` duplicates pipe data without consuming it.
- With `sendfile`, if another process changes the file while it is being sent, the receiver may see the new
  data. The kernel sends whatever is in the page cache at that moment.
- Java's `FileChannel.transferTo` uses `sendfile` on Linux. Kafka relies on this to send log segments to
  consumers.
:::

## Why this matters in real systems

**Redis latency spikes.** Redis runs every command on one event-loop thread. A single `KEYS *` or a large
`DEL` blocks every other client for as long as it runs. That is why Redis added `SCAN`, and `UNLINK`, which
frees memory on a background thread.

**Node.js stalls on the thread pool.** A Node service that does many file reads, DNS lookups
(`dns.lookup`) and `crypto.pbkdf2` calls shares libuv's 4 default threads between them. Under load, the
queue for those threads grows, and requests wait even though the CPU is idle. Raising `UV_THREADPOOL_SIZE`
is a common fix.

**The accept imbalance.** A multi-process server with one shared listening socket can end up with most
connections on one or two busy workers, because the worker that was most recently awake tends to win. Switching to
`SO_REUSEPORT` spreads the connections evenly by hash. It also brings the opposite risk described above:
connections queued on a stuck worker.

**Databases and io_uring.** Storage engines need many disk reads in flight at once to keep an NVMe SSD busy.
With blocking reads, that means many threads. With io_uring, one thread can keep dozens or hundreds of reads
in flight. Newer databases and storage engines have adopted it for this reason.
[Chapter 14](/io/storage-stack) explains why SSDs need many requests in flight.

**ML data loading.** Training input pipelines read many small files or shards and must keep GPUs fed.
They usually use thread pools or many worker processes, because each blocking read occupies a thread while it
waits. Asynchronous reads are one way to keep many requests in flight with fewer threads.

**How to see it:**

```bash
strace -f -e trace=epoll_wait,read,write -p <pid>   # watch an event loop's rhythm
ss -tanp | head                                      # connections and their owners
cat /proc/<pid>/fdinfo/<epoll fd>                    # what an epoll instance watches
perf trace -s -p <pid>                               # system call counts and time
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. What is the difference between blocking, non-blocking and asynchronous I/O?
**Blocking:** the call sleeps until it can finish, then returns the result.

**Non-blocking:** the call never sleeps. If it cannot make progress, it returns `EAGAIN` at once. It is used
with a readiness API such as epoll, which tells you when the call will succeed.

**Asynchronous:** you submit the whole operation and get a notification when it has finished, with the data
already in your buffer.

**Senior add-on:** name the distinction as readiness versus completion. epoll and kqueue are readiness APIs;
io_uring and Windows IOCP are completion APIs. Readiness does not work for regular files; completion does.
With completion, the buffer belongs to the kernel until the result arrives.
:::

::: details 2. Why is epoll faster than select or poll with many connections?
select and poll pass the full list of descriptors into the kernel on every call. The kernel checks all of
them, and the program scans all the results. So each call costs work in proportion to the connections
**watched**.

epoll keeps the watch list in the kernel, registered once. When a socket becomes ready, the kernel puts it
on a ready list. `epoll_wait` returns only that list, so its cost follows the connections **ready**.

**Senior add-on:** with few connections, or when almost all are active, the difference is small. select also
cannot handle descriptor numbers of 1024 or more. epoll needs an `epoll_ctl` system call whenever interest
changes, which is why frameworks avoid toggling `EPOLLOUT` more than needed.
:::

::: details 3. Explain level-triggered versus edge-triggered epoll. When would you choose each?
Level-triggered reports a socket as long as it is readable. If you read only part of the data, you are told
again. Edge-triggered reports only when something new happens, such as new data arriving. You must read until
`EAGAIN`, or the leftover data may never be reported.

Choose level-triggered by default: it is forgiving. Choose edge-triggered when you want fewer repeated
reports, for example with several threads on one epoll instance, and your code always drains sockets.

**Senior add-on:** drain carefully. Reading until `EAGAIN` from one busy socket can starve the others, so cap
the work per turn. With several threads, combine with `EPOLLONESHOT` so only one thread handles a socket at a
time.
:::

::: details 4. Thread per connection or an event loop? How do you decide?
Thread per connection gives simple, top-to-bottom code and uses all cores naturally. It costs memory and
context switches per connection, which hurts with tens of thousands of mostly idle connections.

An event loop uses a small state object per connection and scales to very many connections. The price is
harder code, and one blocking handler stalls every connection on that loop.

For a few thousand busy connections, threads are often fine. For many idle connections (chat, push, proxies),
use event loops, one per core.

**Senior add-on:** Go goroutines, Java virtual threads and Rust async runtimes give you both: code that looks
blocking, running on an event loop underneath. The remaining trap is CPU-heavy or truly blocking work, which
must still go to a separate pool.
:::

::: details 5. Your Node.js service has high latency but low CPU. What might be going on?
Two classic causes. First, something blocks the event loop: a large synchronous JSON parse, a synchronous
file call, a regular expression with catastrophic backtracking. Measure event-loop delay to confirm.

Second, libuv's thread pool is saturated. File operations, `dns.lookup` and some crypto functions share 4
threads by default, so requests queue behind each other while the CPU sits idle.

**Senior add-on:** fixes are moving CPU work to worker threads, using asynchronous APIs, using a DNS resolver
that does not go through the pool, and raising `UV_THREADPOOL_SIZE`. Also check downstream services: low CPU
with high latency often means waiting on something else.
:::

::: details 6. Why can't you use epoll for regular files? What do runtimes do instead?
Readiness means "data is here now". A disk file's data is always available; it is only slow to fetch.
There is no event until you request a specific range. So `epoll_ctl` refuses regular files with `EPERM`,
and poll reports them as always ready. A read that misses the page cache blocks.

Runtimes send file operations to a thread pool (libuv, Tokio, nginx), let the thread block and move other
work away from it (Go), or use a completion interface such as io_uring.

**Senior add-on:** `preadv2` with `RWF_NOWAIT` tries a read that only succeeds from the page cache, and the
program falls back to the pool on a miss. Linux native AIO only works well with `O_DIRECT` and can still block
on metadata.
:::

::: details 7. What is io_uring, and why is it faster?
It is two ring-shaped queues in memory shared by the program and the kernel. The program writes requests
into the submission queue and reads results from the completion queue. One `io_uring_enter` call can submit a
whole batch. In polling mode, a kernel thread picks up requests with no system call at all.

It is faster because it batches many operations per system call and is truly asynchronous for files.
Features like registered buffers and multishot requests remove more per-operation overhead.

**Senior add-on:** know when not to use it: the security record (Google restricts it, many container
platforms block it), older kernels, and harder buffer ownership and cancellation. For typical network
services, epoll is rarely the bottleneck.
:::

::: details 8. What is the thundering herd problem, and how does Linux address it?
Many threads or processes wait on the same event, such as a new connection on a shared listening socket.
One event wakes all of them, one wins, and the rest go back to sleep, wasting CPU.

Linux wakes only one thread for waiters in `accept` itself. For epoll, the `EPOLLEXCLUSIVE` flag wakes one
waiter instead of all. `SO_REUSEPORT` gives each worker its own listening socket on the same port, and the
kernel spreads connections by hash.

**Senior add-on:** `SO_REUSEPORT` removes contention but balances blindly: a stuck worker keeps receiving
new connections. A shared socket balances by who is free, at the cost of contention.
:::

::: details 9. How does sendfile avoid copies? When does zero-copy not apply?
With `read` and `write`, the CPU copies data from the page cache into the program's buffer, then from that
buffer into the socket buffer. `sendfile` does the transfer inside the kernel. With a network card that
supports scatter-gather, the card reads straight from the page cache. The CPU copies nothing, and the
program makes one system call.

It does not apply when the program must change the data: compression, parsing, or encryption. TLS broke it
until kernel TLS moved encryption into the kernel.

**Senior add-on:** mention `splice` through a pipe for socket-to-socket proxying, and `MSG_ZEROCOPY` for
sending from user buffers (worth it only above about 10 KB per send). Kafka uses sendfile through Java's
`transferTo`.
:::

::: details 10. A proxy's memory keeps growing when some clients are slow. What is wrong?
It lacks backpressure. It keeps reading from the fast upstream side and queuing data for clients whose
sockets are full. The queues grow without limit.

The fix: when a write to a client returns `EAGAIN`, keep the pending data and watch for the socket to become
writable. Stop reading from the upstream connection until the pending data drains. Then TCP's flow control
slows the sender.

**Senior add-on:** set limits on every buffer (high and low water marks), and time out clients that stay
slow. Do not register `EPOLLOUT` permanently; a writable socket would make a level-triggered loop spin.
:::

::: details 11. How does Go let you write blocking code that scales like an event loop?
Every Go socket is non-blocking underneath. When a goroutine's `Read` gets `EAGAIN`, the runtime parks the
goroutine and relies on its netpoller, which uses epoll. When the socket becomes ready, the runtime makes the
goroutine runnable again. OS threads never sleep on sockets, so a few threads run many thousands of
goroutines.

**Senior add-on:** file reads and other blocking system calls do block an OS thread. The runtime detects
this and hands that thread's other goroutines to a different thread, creating more threads if needed. So a
Go program doing heavy disk I/O can grow many OS threads.
:::

## Common misconceptions

- **"Non-blocking means asynchronous."** A non-blocking call returns at once, but you still do the I/O
  yourself when the socket is ready. Asynchronous means the kernel does it and tells you when it is done.
- **"epoll is always faster than poll."** Its advantage is with many connections of which few are active.
  With a handful of descriptors, poll is as good.
- **"`O_NONBLOCK` makes file reads non-blocking."** It has no effect on regular files. A page cache miss
  still blocks.
- **"Event loops are faster than threads."** They use less memory per connection. For a few thousand busy
  connections, threads can be as fast and simpler.
- **"io_uring should replace epoll everywhere."** It shines for disk I/O and very high operation rates. It
  adds complexity and security concerns that many services do not need.
- **"Zero-copy means no copies at all."** The devices still move data with DMA. Zero-copy means the CPU does
  not copy it, and even that needs network card support.

## Key takeaways

- The core question is **what a thread does while it waits**: sleep (blocking), ask again (non-blocking), or
  let the kernel finish the job (asynchronous).
- **epoll** keeps the watch list in the kernel, so its cost follows ready connections, not watched ones.
  Edge-triggered mode requires draining until `EAGAIN`.
- An **event loop** serves many connections on one thread, one loop per core. Never block it, and apply
  **backpressure** when a consumer is slow.
- Regular files are always "ready", so runtimes use **thread pools** for disk I/O. **io_uring** gives a true
  completion interface with batched system calls.
- **sendfile** and **splice** move data inside the kernel. They help when you forward data without changing
  it.

## Review

<Flashcards id="io-models" :cards="cards" />

<MarkDone id="io-models" />
