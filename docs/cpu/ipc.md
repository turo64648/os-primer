---
title: 11. Inter-Process Communication
---

<script setup>
import { cards } from './ipc-review'
</script>

# 11. Inter-Process Communication

Processes cannot see each other's memory, so the kernel offers several ways for them to talk: pipes,
sockets, shared memory and message queues. Interviewers ask which one you would pick and why. That question
tests whether you understand copies, blocking, message boundaries and who pays for synchronisation.

::: info Before you start
- Each <Term id="process">process</Term> has its own private memory. The <Term id="kernel">kernel</Term> must
  help whenever two processes exchange data. [Chapter 4](/memory/virtual-memory) explains why.
- A <Term id="file-descriptor">file descriptor</Term> is a small number, such as 3, that a process uses to
  refer to an open file, pipe or socket. `read` and `write` work on all of them.
- `fork` creates a child process that starts with copies of the parent's file descriptors.
  [Chapter 2](/foundations/processes-and-threads) covers this.
:::

## The options at a glance

**In short:** every mechanism either copies data through the kernel (pipes, sockets, message queues), or lets
processes share memory directly. Copying is simpler and safer; sharing is faster and harder.

<Term id="ipc">Inter-process communication (IPC)</Term> is any way for processes to exchange data or
signals. The main options on Linux:

| Mechanism | Shape of the data | Who can use it | Typical use |
|---|---|---|---|
| Pipe | Byte stream, one direction | Related processes (via `fork`) | Shell pipelines, parent-child |
| FIFO (named pipe) | Byte stream, one direction | Any process that can open the path | Simple local hand-offs |
| Unix domain socket | Stream or messages, both directions; can pass file descriptors | Any process that can reach the path | Local services: Docker, databases, D-Bus |
| Shared memory | Raw memory, no structure | Processes that map the same object | High-volume data: video, ML tensors, databases |
| Message queue | Separate messages, with priorities | Any process that opens the queue by name | Small commands, legacy systems |
| Signal | A number only | Processes with permission | Stop, reload, child exited |
| TCP socket | Stream, both directions | Anyone on the network | Communication between machines |

Signals carry almost no data and are covered in [Chapter 2](/foundations/processes-and-threads). The rest of
this chapter goes through the others.

<IpcCopiesDiagram />

## Pipes and FIFOs

**In short:** a pipe is a one-way byte stream through a buffer in the kernel. The writer blocks when it is
full, and the reader sees end-of-file only when every write end is closed.

### How a pipe works

`pipe(fd)` asks the kernel for a small buffer and returns two file descriptors: `fd[0]` to read from it and
`fd[1]` to write to it. After `fork`, parent and child both hold both ends. Each closes the end it does not
need, and data flows one way.

The shell builds `ls | grep x` this way. It creates a pipe, forks two children, and in each one moves the
pipe end onto standard output or standard input before running the program. Neither `ls` nor `grep` knows a
pipe is involved.

The rules are simple, and each one causes real bugs when forgotten:

- **A full pipe blocks the writer.** The buffer is 64 KiB by default on Linux. When it fills, `write` waits
  until the reader catches up. This is built-in <Term id="backpressure">backpressure</Term>: a fast
  producer cannot run far ahead of a slow consumer.
- **An empty pipe blocks the reader.** `read` waits until data arrives.
- **End-of-file comes only when every write end is closed.** If any process still holds a write end, the
  reader waits forever. The classic bug is a reader that forgets to close its own copy of the write end
  after `fork`.
- **Writing with no readers left** sends the writer the `SIGPIPE` signal, which kills it by default. If the
  signal is ignored, `write` fails with `EPIPE` instead. That is how `yes | head -1` ends: `head` exits, and
  `yes` dies on its next write.
- **A pipe is a stream of bytes.** Two writes of 10 bytes may be read as one read of 20, or as reads of 7 and
  13. If you need messages, you must add your own framing, such as a length before each message.

### Try it: a pipe between parent and child

```c
// pipe.c: gcc -O2 pipe.c -o pipe && ./pipe
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    int fd[2];                         // fd[0] = read end, fd[1] = write end
    if (pipe(fd)) { perror("pipe"); return 1; }

    pid_t pid = fork();
    if (pid < 0) { perror("fork"); return 1; }
    if (pid == 0) {                    // child: reader
        close(fd[1]);                  // without this, read() never sees EOF
        char buf[64];
        ssize_t n;
        while ((n = read(fd[0], buf, sizeof buf)) > 0)
            printf("child read %zd bytes: %.*s", n, (int)n, buf);
        printf("child: end of file\n");
        return 0;
    }

    close(fd[0]);                      // parent: writer
    const char *msgs[] = { "hello\n", "from the parent\n" };
    for (int i = 0; i < 2; i++) {
        if (write(fd[1], msgs[i], strlen(msgs[i])) < 0) perror("write");
        usleep(100000);                // let the child print each one
    }
    close(fd[1]);                      // the child's read() now returns 0
    waitpid(pid, NULL, 0);
    return 0;
}
```

Output:

```text
child read 6 bytes: hello
child read 16 bytes: from the parent
child: end of file
```

Delete the child's `close(fd[1])` and run it again. The child prints both messages and then hangs. The pipe
still has a writer, the child itself, so `read` never returns 0.

::: details Going deeper: pipe details
- Writes of up to `PIPE_BUF` bytes (4096 on Linux) are **atomic**: they are never mixed with other writers'
  data. Larger writes from several writers can interleave.
- `fcntl(fd, F_SETPIPE_SZ, size)` changes the buffer size, up to `/proc/sys/fs/pipe-max-size` (1 MiB by
  default) for unprivileged users.
- `pipe2(fd, O_CLOEXEC)` stops the pipe from leaking into programs started with `exec`. Leaked write ends are
  a common cause of the "reader never sees end-of-file" bug.
- `splice` and `vmsplice` move data into and out of pipes without copying through user space.
  [Chapter 12](/io/io-models) covers zero-copy I/O.
:::

### FIFOs: pipes with a name

A pipe has no name, so only processes that inherit it through `fork` can use it. A **FIFO**, or named pipe,
is a pipe with a path in the file system. `mkfifo /tmp/jobs` creates it. Any process that may open the path
can read or write it. Opening one end blocks until another process opens the other end. The data still
flows through a kernel buffer; nothing is written to disk.

## Unix domain sockets

**In short:** a Unix domain socket is a socket that stays inside one machine. It works in both directions,
can keep message boundaries, tells you who is on the other end, and can pass open file descriptors between
processes.

### Sockets without the network

A <Term id="socket">socket</Term> is a communication endpoint, the same interface used for network
connections. A **Unix domain socket** (`AF_UNIX`) uses the same calls, `socket`, `bind`, `listen`, `accept`
and `connect`, but its address is a file path such as `/run/app.sock`, and data never touches the network
stack.

That makes it the standard way for local services to talk:

- The Docker CLI talks to the daemon over `/var/run/docker.sock`.
- PostgreSQL and MySQL clients use a Unix socket for local connections.
- D-Bus, the Linux desktop message bus, and systemd's logging run over Unix sockets.
- Many sidecars and agents on a Kubernetes node expose a Unix socket to local processes.

Compared with TCP over the loopback address, Unix sockets skip the TCP/IP work: no checksums, no
acknowledgements, no congestion control. Latency is lower and throughput higher. Clients such as gRPC and
HTTP libraries can usually use a `unix:` address with no other changes.

Unix sockets come in three types:

- **`SOCK_STREAM`:** a byte stream, like a pipe but in both directions. You need your own framing.
- **`SOCK_DGRAM`:** separate messages. Unlike UDP, on Linux they are reliable and stay in order.
- **`SOCK_SEQPACKET`:** a connection that keeps message boundaries. Often the most convenient choice for
  request-response protocols.

`socketpair()` creates two connected Unix sockets at once, like a two-way pipe. It is useful between a parent
and child.

### Knowing who is calling

With a Unix socket, the server can ask the kernel who the client is. The `SO_PEERCRED` option returns the
client's process ID, user ID and group ID. The kernel fills these in, so the client cannot lie. Services use
it for access control, such as "only root and the `docker` group may connect".

Access also depends on the socket file's permissions. Treat a socket that controls a privileged daemon as
powerful as the daemon itself. Anyone who can write to `docker.sock` can start a container with the host's
root file system mounted, which is equivalent to root on the host.

::: details Going deeper: abstract sockets
Linux also has an **abstract namespace**: if the path starts with a zero byte, no file is created, and the
name disappears when the last socket closes. There are no file permissions on it. Abstract sockets are scoped
to a network namespace, so a container that shares the host's network namespace can reach the host's abstract
sockets. That has caused real container escapes.
:::

### Passing file descriptors

A Unix socket can carry something no other channel can: **open file descriptors**. The sender attaches them
to a message as `SCM_RIGHTS` ancillary data. The kernel then adds new entries to the **receiver's**
descriptor table that point to the same open files. The numbers may differ, but both processes now share the
same <Term id="open-file-description">open file description</Term>: the same file, the same position, the
same flags.

<FdPassingDiagram />

This makes several important patterns possible:

- **Zero-downtime restarts.** The old server process passes its listening socket to the new one. No
  connection is refused during the switch. Envoy's hot restart and HAProxy's seamless reload work this way.
- **Privilege separation.** A small privileged process opens files or devices, checks permissions, and hands
  descriptors to an unprivileged worker. Chrome's sandbox and the OpenSSH server use this idea.
- **Sharing memory safely.** A process creates a memory object (see `memfd_create` below) and passes its
  descriptor. The receiver maps it. Wayland compositors receive window contents this way.

### Try it: pass a file descriptor to another process

```c
// passfd.c: gcc -O2 passfd.c -o passfd && ./passfd
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <unistd.h>

static void send_fd(int sock, int fd) {
    char byte = 'x';
    struct iovec iov = { .iov_base = &byte, .iov_len = 1 };
    union { struct cmsghdr h; char buf[CMSG_SPACE(sizeof(int))]; } u;
    struct msghdr msg = { .msg_iov = &iov, .msg_iovlen = 1,
                          .msg_control = u.buf, .msg_controllen = sizeof u.buf };
    struct cmsghdr *c = CMSG_FIRSTHDR(&msg);
    c->cmsg_level = SOL_SOCKET;
    c->cmsg_type = SCM_RIGHTS;         // "the payload is file descriptors"
    c->cmsg_len = CMSG_LEN(sizeof(int));
    memcpy(CMSG_DATA(c), &fd, sizeof(int));
    if (sendmsg(sock, &msg, 0) != 1) perror("sendmsg");
}

static int recv_fd(int sock) {
    char byte;
    struct iovec iov = { .iov_base = &byte, .iov_len = 1 };
    union { struct cmsghdr h; char buf[CMSG_SPACE(sizeof(int))]; } u;
    struct msghdr msg = { .msg_iov = &iov, .msg_iovlen = 1,
                          .msg_control = u.buf, .msg_controllen = sizeof u.buf };
    if (recvmsg(sock, &msg, 0) != 1) { perror("recvmsg"); return -1; }
    struct cmsghdr *c = CMSG_FIRSTHDR(&msg);
    if (!c || c->cmsg_type != SCM_RIGHTS) return -1;
    int fd;
    memcpy(&fd, CMSG_DATA(c), sizeof(int));
    return fd;
}

int main(void) {
    int sv[2];
    if (socketpair(AF_UNIX, SOCK_STREAM, 0, sv)) { perror("socketpair"); return 1; }

    pid_t pid = fork();
    if (pid < 0) { perror("fork"); return 1; }
    if (pid == 0) {                    // child: receives an fd it never opened
        close(sv[0]);
        int fd = recv_fd(sv[1]);
        char buf[128];
        ssize_t n = read(fd, buf, sizeof buf - 1);
        buf[n > 0 ? n : 0] = '\0';
        printf("child got fd %d and read: %s", fd, buf);
        return 0;
    }

    close(sv[1]);
    int fd = open("/etc/hostname", O_RDONLY);  // opened by the parent only
    if (fd < 0) { perror("open"); return 1; }
    printf("parent opened fd %d and sends it\n", fd);
    fflush(stdout);
    send_fd(sv[0], fd);
    close(fd);                         // the child's copy stays open
    waitpid(pid, NULL, 0);
    return 0;
}
```

Output (the last word is your machine's host name):

```text
parent opened fd 4 and sends it
child got fd 3 and read: myhost
```

The child never opened the file, and it received it under a different number. The parent could even close its
copy right after sending. In a real system, the two processes need not be related; any two processes connected
by a Unix socket can do this.

## Shared memory

**In short:** shared memory maps the same physical pages into several processes. Data moves with no copies
and no system calls, but the processes must synchronise access themselves.

### How it works

Every process has its own page tables, which map its addresses to physical memory. Shared memory makes two
processes' page tables point to the **same** physical pages. A write by one process is visible to the other
as soon as the CPU makes it visible, with no kernel involvement.

On Linux there are three common ways to set it up:

- **Before `fork`:** `mmap` with `MAP_SHARED | MAP_ANONYMOUS`. The child inherits the mapping.
- **By name:** `shm_open("/name", ...)` creates a named object in `/dev/shm`, a file system that lives in
  RAM. Each process opens it by name, sets its size with `ftruncate`, and maps it with
  <Term id="mmap">`mmap`</Term>.
- **By descriptor:** `memfd_create()` (Linux 3.17 and later) creates an anonymous memory object with no name.
  Its descriptor is passed to the other process over a Unix socket.

The older **System V** interface (`shmget`, `shmat`) still exists. Its segments stay alive until someone
removes them, even after every process has exited. `ipcs -m` lists them.

### The catch: you synchronise everything yourself

The kernel sets up the mapping and then steps aside. There is no notion of "a message has arrived". Two
processes writing the same data at once have exactly the race conditions of two threads, described in
[Chapter 9](/cpu/concurrency-1). You must use one of these:

- **Atomic operations** and memory orderings, as in [Chapter 10](/cpu/concurrency-2). A single-producer,
  single-consumer **ring buffer** with atomic head and tail indexes is the classic design.
- **A process-shared mutex and condition variable**, placed inside the shared memory and created with
  `PTHREAD_PROCESS_SHARED`. Make the mutex **robust** so that a process dying while holding it does not
  block the others forever.
- **A separate notification channel**, such as a Unix socket, an `eventfd` or a futex, to wake the reader
  when new data is ready.

Also, **store offsets, not pointers**. The same shared object can be mapped at a different address in each
process, so a pointer written by one process may be meaningless in the other.

### Try it: shared memory needs atomics too

```c
// shm.c: gcc -O2 shm.c -o shm && ./shm
#include <stdatomic.h>
#include <stdio.h>
#include <sys/mman.h>
#include <sys/wait.h>
#include <unistd.h>

struct shared {
    long plain;                        // an ordinary variable
    atomic_long atomic;                // an atomic one
};

int main(void) {
    // One page that both processes will see after fork.
    struct shared *s = mmap(NULL, sizeof *s, PROT_READ | PROT_WRITE,
                            MAP_SHARED | MAP_ANONYMOUS, -1, 0);
    if (s == MAP_FAILED) { perror("mmap"); return 1; }

    pid_t pid = fork();
    if (pid < 0) { perror("fork"); return 1; }
    for (int i = 0; i < 1000000; i++) {  // parent and child both run this
        s->plain++;
        atomic_fetch_add(&s->atomic, 1);
    }
    if (pid == 0) return 0;

    waitpid(pid, NULL, 0);
    printf("plain:  %ld\natomic: %ld (expected 2000000)\n", s->plain, atomic_load(&s->atomic));
    return 0;
}
```

Example output (the first number changes from run to run):

```text
plain:  1695062
atomic: 2000000 (expected 2000000)
```

Two **processes** lose updates on the plain counter exactly as two threads did in Chapter 9. Without
`MAP_SHARED`, each process would get its own <Term id="copy-on-write">copy-on-write</Term> copy and each
would count to one million on its own.

## Message queues

**In short:** a message queue holds whole messages in the kernel, with priorities. It keeps message
boundaries, unlike a pipe, but it is rarely the best choice today.

A kernel **message queue** stores separate messages. Each send adds one message; each receive takes one whole
message. Nothing is split or merged, so no framing is needed.

Linux has two versions:

- **POSIX message queues:** `mq_open("/name")`, `mq_send`, `mq_receive`. Each message has a priority, and
  higher priorities are received first. `mq_notify` can signal a process when a message arrives. On Linux a
  queue is also a file descriptor, so it works with `epoll`.
- **System V message queues:** `msgget`, `msgsnd`, `msgrcv`. Each message has a type, and a receiver can ask
  for a particular type. Like System V shared memory, queues live until removed.

Both have small default limits. On Linux, a POSIX queue holds 10 messages of up to 8 KiB each by default,
adjustable under `/proc/sys/fs/mqueue/`. In practice, most new designs use a Unix `SOCK_SEQPACKET` or
`SOCK_DGRAM` socket instead. It keeps message boundaries too, and adds credentials, descriptor passing and a
familiar API.

Do not confuse these with **message brokers** such as Kafka or RabbitMQ. Those are separate services that
store messages durably and work across machines. Kernel message queues live in RAM on one machine and vanish
at reboot.

::: details Going deeper: other kernel IPC tools
- **eventfd** is a counter behind a file descriptor. Writing adds to it, and reading returns and resets it.
  It is a cheap "wake up, something is ready" signal that works with `epoll`, often paired with shared memory.
- **Binder** is Android's IPC. A kernel driver passes messages and object references between apps and system
  services, with a single copy.
- **D-Bus** is a message bus for desktops and system services, built on Unix sockets.
- **`process_vm_readv`** copies memory directly from another process, given permission. Debuggers and some
  MPI libraries use it.
:::

## Choosing an IPC mechanism

**In short:** use a Unix socket for most local request-response traffic, a pipe for streaming to a child,
shared memory for bulk data, and TCP when the other side may move to another machine.

Ask these questions, in this order:

1. **Might the other side ever run on a different machine?** Use TCP, or gRPC or HTTP over TCP. Switching to
   a Unix socket for local calls is then a small optimisation, not a redesign.
2. **Is it a stream to or from a child process?** Use a pipe. It is the simplest option and gives
   backpressure for free.
3. **Is it request-response between local services?** Use a Unix socket. It gives two-way communication,
   peer credentials, and fd passing. `SOCK_SEQPACKET` keeps message boundaries.
4. **Is it a lot of data, such as frames, tensors or buffers?** Use shared memory for the data, and a socket
   or `eventfd` for "data is ready" notices. Pass the memory's descriptor over the socket.
5. **Does it need to survive restarts or reach many consumers?** That is a message broker or a database, not
   kernel IPC.

### What it costs

For small messages, the copy is rarely the main cost. A message between two processes costs a system call on
each side, and usually a **wake-up**: the receiver was asleep, so the kernel must schedule it, often with a
context switch. The ping-pong program in [Chapter 8](/cpu/scheduling) measured a round trip of a few
microseconds through pipes. A Unix socket costs about the same order.

For large data, the copies dominate. Moving a gigabyte through a pipe copies it twice, which costs on the order of
a tenth of a second of CPU time or more. Shared memory copies nothing.

Shared memory is not automatically faster for small messages. If the reader sleeps until notified, it still
pays for a wake-up. The fastest designs have the reader **poll** the shared memory on a dedicated core, at
the cost of keeping that core busy. That is the trade made by trading systems and high-speed packet
processors.

## Why this matters in real systems

**ML data loaders and `/dev/shm`.** PyTorch data-loader workers are separate processes. They hand batches to
the training process through shared memory, and pass the memory's descriptor over a Unix socket. Docker gives
containers only 64 MB of `/dev/shm` by default. Workers then crash with a "bus error" as soon as a batch does
not fit. The fix is `--shm-size`, `--ipc=host`, or in Kubernetes an in-memory volume mounted at `/dev/shm`.
NCCL, which moves data between GPUs, also uses shared memory within a machine.

**Zero-downtime deploys.** Proxies such as Envoy and HAProxy pass their listening sockets to the new process
over a Unix socket. The kernel's queue of waiting connections is never closed, so no client sees a refused
connection.

**Container runtimes.** The Docker socket, containerd and the kubelet's plug-in sockets are all Unix sockets.
Mounting `docker.sock` into a container gives that container control of the host.

**Databases.** PostgreSQL's backend processes share their buffer cache through shared memory, with locks and
atomics inside it. Local clients connect through a Unix socket, which is faster than TCP to localhost.

**Browsers.** Chrome splits into many processes. They talk over Unix sockets or pipes, depending on the
platform, and share large buffers such as rendered frames through shared memory passed as descriptors.

**Shell pipelines.** `zcat logs.gz | grep ERROR | sort | uniq -c` runs four processes at once, connected by
pipes. Backpressure keeps memory use flat however big the input is.

**How to inspect it:**

```bash
ls -l /proc/<pid>/fd                  # pipes show as pipe:[inode], sockets as socket:[inode]
ss -xp                                # Unix sockets, with the processes that own them
lsof -U                               # Unix sockets per process
ls -l /dev/shm; df -h /dev/shm        # POSIX shared memory objects and space left
ipcs                                  # System V shared memory, semaphores, message queues
ls /dev/mqueue                        # POSIX message queues (if mounted)
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. How does a shell pipeline like ls | grep work?
The shell calls `pipe` to get a read end and a write end. It forks two children. In the first, it makes the
write end standard output, closes the other descriptors, and runs `ls`. In the second, it makes the read end
standard input and runs `grep`. The parent closes both ends and waits.

`ls` writes into the pipe's kernel buffer and `grep` reads from it. If the buffer is full, `ls` blocks; if it
is empty, `grep` blocks.

**Senior add-on:** every process must close the ends it does not use. If any process keeps a write end open,
`grep` never sees end-of-file and hangs. If `grep` exits early, `ls` gets `SIGPIPE` on its next write.
:::

::: details 2. A program reading from a pipe hangs after the writer finished. Why?
The reader only sees end-of-file when **every** write end of the pipe is closed. Some process still holds one.
Often it is the reader itself, which inherited the write end through `fork` and never closed it. It can also
be another child that inherited the descriptor, or a program started with `exec` that kept it.

Fix it by closing unused ends right after `fork`, and by creating pipes with `O_CLOEXEC` so they do not leak
into other programs.

**Senior add-on:** `ls -l /proc/<pid>/fd` for each process shows which ones hold the pipe. The number in
`pipe:[12345]` identifies the pipe.
:::

::: details 3. What can a Unix domain socket do that a TCP socket on localhost cannot?
It can pass open file descriptors between processes (`SCM_RIGHTS`), and it can tell the server the client's
process ID and user ID with `SO_PEERCRED`, verified by the kernel. It is also protected by file system
permissions on its path. It also skips the TCP/IP stack, so it has lower latency and higher throughput.

**Senior add-on:** its datagram and seqpacket types keep message boundaries and are reliable on Linux. The
cost is that it only works on one machine; and code written against a socket API can often switch between
the two with an address change.
:::

::: details 4. What does passing a file descriptor actually transfer?
It transfers a reference to an open file in the kernel, not a number and not the file's contents. The kernel
creates a new descriptor in the receiver that points to the same open file description. The receiver's number
may differ. Both processes share the file position and flags, and the file stays open until both close it.

**Senior add-on:** uses include handing a listening socket to a new server process for zero-downtime restarts,
privilege separation (a privileged helper opens and hands over), and sharing memory by passing a `memfd`.
:::

::: details 5. When would you use shared memory, and what are its pitfalls?
Use it for large or very frequent data where copying through the kernel would cost too much: video frames,
ML batches, database buffer caches, high-rate market data.

Pitfalls: you must synchronise everything yourself, with atomics or process-shared locks. A process that
crashes while holding a lock can block everyone, unless the mutex is robust. Pointers do not work across
processes if the mapping addresses differ, so store offsets. You still need a way to notify the reader. And a
bug in one process can corrupt data for all of them.

**Senior add-on:** in containers, `/dev/shm` is small by default (64 MB in Docker), a common cause of crashes
in ML data loaders.
:::

::: details 6. Pipe, Unix socket, shared memory or message queue: how do you choose for a new local service?
For request-response between local services, a Unix socket: two-way, credentials, fd passing, and
`SOCK_SEQPACKET` if you want message boundaries. For streaming to or from a child, a pipe. For bulk data,
shared memory plus a small notification channel. Kernel message queues are rarely the best choice now.

If the peer might ever move to another machine, design for TCP, and use a Unix socket only as a local
optimisation.

**Senior add-on:** for small messages the cost is system calls and wake-ups, not copies. For large payloads,
copies dominate. Consider durability too: none of these survive a reboot, so persistent queues need a broker.
:::

::: details 7. Why is a pipe or stream socket not a message channel? How do you send messages over it?
A stream has no boundaries. The kernel may merge two writes into one read, or split one write over several
reads. A reader that assumes "one read = one message" works in tests and breaks under load.

Add framing: send a length before each message, and have the reader loop until it has the whole length. Or use
a delimiter, such as a newline, that cannot appear inside messages. Or use `SOCK_SEQPACKET` or `SOCK_DGRAM`,
which keep boundaries.

**Senior add-on:** on a pipe, writes up to `PIPE_BUF` (4096 bytes on Linux) are atomic, so several writers can
safely send small whole records. Larger writes can interleave.
:::

::: details 8. What happens when a process writes to a pipe whose reader has exited?
The kernel sends the writer the `SIGPIPE` signal. By default, that kills the process. If the process ignores
or handles the signal, the `write` call fails with the error `EPIPE` instead.

**Senior add-on:** network servers usually ignore `SIGPIPE` (or use `MSG_NOSIGNAL` on sockets) so a client that
disconnects cannot kill the server, and they handle `EPIPE` as a normal error.
:::

::: details 9. Scenario: PyTorch data-loader workers crash with "bus error" inside a container. What is going on?
Data-loader workers pass batches to the main process through shared memory in `/dev/shm`. Docker limits
`/dev/shm` to 64 MB by default. When a worker writes to shared memory beyond that limit, the kernel cannot
supply the page, and the process gets `SIGBUS`, a "bus error".

Fix it by giving the container more shared memory: `--shm-size`, `--ipc=host`, or in Kubernetes an `emptyDir`
volume with `medium: Memory` mounted at `/dev/shm`. Setting `num_workers=0` also avoids it, at the cost of
speed.

**Senior add-on:** memory in `/dev/shm` counts against the container's memory limit, so size both together.
:::

## Common misconceptions

- **"Each read on a pipe or stream socket returns one message."** Streams have no boundaries; you must frame
  messages yourself.
- **"Shared memory is always the fastest IPC."** For small messages, wake-ups and synchronisation cost as much
  as the copies you save.
- **"Unix sockets are only for local TCP-style streams."** They also keep message boundaries, verify the
  peer's identity and pass file descriptors.
- **"Closing the write end in the writer is enough for end-of-file."** Every copy of the write end, in every
  process, must be closed.
- **"Kernel message queues are like Kafka."** They are small, in memory and on one machine. They do not
  persist or replicate.

## Key takeaways

- Pipes, sockets and message queues **copy data through the kernel**. Shared memory **maps the same pages**
  and leaves synchronisation to you.
- Pipes give **backpressure** for free. End-of-file needs **every** write end closed, and writing with no
  reader raises **SIGPIPE**.
- **Unix domain sockets** are the default for local services: two-way, message boundaries if needed, peer
  credentials, and **file descriptor passing**.
- Shared memory needs **atomics or process-shared locks**, offsets instead of pointers, and a notification
  channel. Watch `/dev/shm` limits in containers.
- For small messages the cost is **system calls and wake-ups**; for large data it is **copies**.

## Review

<Flashcards id="ipc" :cards="cards" />

<MarkDone id="ipc" />
