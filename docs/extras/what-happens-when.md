---
title: C. What Happens When…
---

<script setup>
import { cards } from './what-happens-when-review'
</script>

# C. What Happens When…

This chapter follows six everyday events from start to finish, through every layer of the system. Each step
links to the chapter that explains it. "Walk me through what happens when…" is one of the most common senior
interview questions. It is really a test of whether you can connect the pieces.

::: info Before you start
- This chapter is a map, not a textbook. It names each step in a sentence or two and links to where the book
  explains it. Follow a link when a step is unfamiliar.
- Each walkthrough ends with a table of **where it can be slow or fail**, and how you would see it. That is
  where interviews usually go next.
- You can read the walkthroughs in any order. They share many steps, which is the point: the same few
  mechanisms appear everywhere.
:::

## How to use these walkthroughs

**In short:** answer at two depths. First give the whole path in a few plain steps. Then go deeper wherever
the interviewer points.

A good answer to "what happens when…" has a shape:

1. **Name the big stages first**, in one breath. For example: "the shell forks, the child execs, the kernel
   loads the program, the loader links libraries, `main` runs, the process exits, the shell collects it."
2. **Then walk through each stage**, naming the key mechanism: a system call, a page fault, an interrupt, a
   context switch.
3. **Offer depth, do not dump it.** Say "I can go deeper on how the loader finds libraries" and let the
   interviewer choose.
4. **Say where it could go wrong or be slow.** That turns a recital into engineering.

Four mechanisms carry almost every walkthrough. Recognise them and you can reason about paths you have never
studied:

- **The <Term id="syscall">system call</Term>**: the program asks the kernel to do something
  ([Chapter 1](/foundations/what-is-an-os)).
- **The <Term id="page-fault">page fault</Term>**: memory is filled in on first use
  ([Chapter 4](/memory/virtual-memory)).
- **The <Term id="interrupt">interrupt</Term>**: a device or timer gets the CPU's attention
  ([Chapter 1](/foundations/what-is-an-os)).
- **Sleep and wake-up**: a thread blocks, the <Term id="scheduler">scheduler</Term> runs something else, and
  an event later makes the thread runnable again ([Chapter 8](/cpu/scheduling)).

## …you run ./a.out

**In short:** the shell forks a child and the child calls exec. The kernel maps the program and its loader.
The loader links the libraries, `main` runs, the process exits, and the shell collects its exit status.

You type `./a.out` in a terminal and press Enter.

1. **The shell reads the line.** It was blocked in `read` on the terminal. Your keystrokes arrived from the
   keyboard, the terminal emulator wrote them into a pseudo-terminal, and the kernel woke the shell.
   ([Chapter 12](/io/io-models) covers blocking reads.)
2. **The shell parses the command.** `./a.out` contains a slash, so there is no `PATH` search.
3. **The shell calls <Term id="fork">`fork`</Term>.** The kernel creates a child process with a copy of the
   shell's page tables. No memory is copied yet: both share every page, marked read-only, and a page is copied
   only when one of them writes to it. This is <Term id="copy-on-write">copy-on-write</Term>
   ([Chapter 2](/foundations/processes-and-threads), [Chapter 5](/memory/kernel-memory)).
4. **The child prepares.** It puts itself in a new <Term id="process-group">process group</Term> and the shell
   makes that group the terminal's foreground job, so Ctrl-C will reach it. It applies any redirections, such
   as `> out.txt`, by rearranging its file descriptors ([Chapter 2](/foundations/processes-and-threads)).
5. **The child calls `execve("./a.out", argv, envp)`.** The kernel checks permissions, reads the file's first
   bytes, and recognises an <Term id="elf">ELF</Term> executable
   ([Chapter 3](/foundations/linking-and-loading)).
6. **The kernel replaces the child's memory.** It throws away the shell's address space, maps the program's
   segments (code read-only and executable, data writable), and maps the
   <Term id="dynamic-loader">dynamic loader</Term> named in the file. It builds a new stack with the
   arguments, the environment and the auxiliary vector. Nothing is read from disk yet
   ([Chapter 3](/foundations/linking-and-loading)).
7. **The kernel returns to user mode at the loader's entry point.** The first instructions cause page faults.
   Each one maps a page of the loader or program from the <Term id="page-cache">page cache</Term>, reading it
   from disk only if it is not cached ([Chapter 4](/memory/virtual-memory)).
8. **The loader links the program.** It finds `libc.so.6` and other libraries through `/etc/ld.so.cache`,
   maps them with <Term id="mmap">`mmap`</Term>, fills in the addresses the program needs, and runs the
   libraries' initialisers ([Chapter 3](/foundations/linking-and-loading)).
9. **libc starts up and calls `main`.** Constructors run first.
10. **`main` runs and is scheduled like any thread.** It gets a core when it is runnable, is preempted by the
    timer if others are waiting, and sleeps whenever it blocks ([Chapter 8](/cpu/scheduling)). Its
    `printf` becomes a `write` system call on file descriptor 1, the terminal.
11. **The program exits.** `main` returns, libc flushes buffers and runs `atexit` handlers, then calls the
    `_exit` system call. The kernel closes all file descriptors, releases the memory, and keeps a small record
    with the exit status. The process is now a <Term id="zombie">zombie</Term>. The kernel sends the shell
    `SIGCHLD` ([Chapter 2](/foundations/processes-and-threads)).
12. **The shell collects the child.** It was blocked in `waitpid`. It wakes, reads the exit status into `$?`,
    and the zombie disappears. The shell takes back the terminal's foreground and prints a new prompt.

::: details Going deeper: the details interviewers like
- **fork cost** is mostly copying page tables, not memory. For a very large parent that can still take
  milliseconds, which is why some programs use `posix_spawn` or `vfork`-style creation
  ([Chapter 2](/foundations/processes-and-threads)).
- **Scripts:** if the file starts with `#!`, the kernel runs the named interpreter with the script as an
  argument.
- **Security steps inside exec:** setuid bits, capabilities and the no-new-privileges flag are applied here,
  and the address space layout is randomised ([Chapter 17](/systems/security)).
- **The vDSO** is mapped into every new process, so later calls such as `clock_gettime` need no system call
  ([Chapter 16](/systems/time-and-timers)).
- **Watch it:** `strace -f -e trace=process,memory ./a.out` shows `execve`, the loader's `mmap` calls and
  `exit_group`. `LD_DEBUG=libs ./a.out` shows the library search.
:::

### Where it can be slow or fail

| Step | What goes wrong | How you see it |
|---|---|---|
| fork | Huge parent: copying page tables takes a long time | Latency spikes in the parent at fork time |
| exec | Wrong architecture, missing interpreter, no execute permission | `Exec format error`, `No such file or directory` for a file that exists |
| Loader | Library not found or wrong version | `error while loading shared libraries`; `ldd ./a.out` |
| Startup page faults | Cold page cache: code must be read from disk | Slow first run, fast second run; major faults in `/usr/bin/time -v` |
| Running | Waiting for a core, or throttled in a container | Run-queue latency, `nr_throttled` in `cpu.stat` |
| Exit | Parent never calls `wait` | `<defunct>` processes in `ps` |

## …you call read() on a file

**In short:** the system call finds the open file, then looks in the page cache. On a hit, the kernel copies
from RAM and returns in microseconds. On a miss, it sends a request down to the device and the thread sleeps
until an interrupt says the data has arrived.

A program calls `read(fd, buf, 4096)` on a file it opened earlier.

1. **libc makes the system call.** It puts the call number and arguments in registers and traps into the
   kernel ([Chapter 1](/foundations/what-is-an-os)).
2. **The kernel finds the open file.** The <Term id="file-descriptor">file descriptor</Term> indexes the
   process's descriptor table. The entry points to an
   <Term id="open-file-description">open file description</Term>, which holds the current position and
   points to the file's <Term id="inode">inode</Term> ([Chapter 13](/io/file-systems)).
3. **The VFS hands the call to the file system.** The <Term id="vfs">virtual file system</Term> layer calls the
   right code for ext4, XFS or whatever holds the file. For ordinary reads, that code goes through the page
   cache ([Chapter 13](/io/file-systems)).
4. **The kernel looks in the page cache.** It checks whether the pages covering this part of the file are
   already in RAM ([Chapter 5](/memory/kernel-memory)).

**On a hit:**

5. The kernel copies the bytes from the cached page into `buf`, advances the file position and returns the
   number of bytes. No device is involved. This takes around a microsecond or less for 4 KiB.

**On a miss:**

5. **The kernel allocates page-cache pages** and marks them as "being read". If the program has been reading
   in order, it also reads ahead: it asks for the next pages before they are needed
   ([Chapter 13](/io/file-systems)).
6. **The file system maps file offsets to disk blocks**, using the inode's map of where the data lives.
7. **The block layer queues a request**, merging it with neighbours if it can, and passes it to the driver
   ([Chapter 14](/io/storage-stack)).
8. **The driver sends the command to the device.** For an NVMe SSD, it writes the command into a queue in
   memory and tells the device.
9. **The thread goes to sleep.** It waits in uninterruptible sleep (state `D`) for the page. The scheduler
   runs another thread on the core ([Chapter 8](/cpu/scheduling)).
10. **The device does the work.** An SSD looks up where the data really is in flash and reads it. It copies
    the data straight into the page-cache pages with <Term id="dma">DMA</Term>
    ([Chapter 14](/io/storage-stack)).
11. **The device raises an interrupt.** The kernel's completion handler marks the pages as ready and wakes the
    waiting thread ([Chapter 1](/foundations/what-is-an-os)).
12. **The thread runs again** when the scheduler gives it a core. It copies the data into `buf` and returns.

The difference between the two paths is huge: around a microsecond for a hit; tens to hundreds of
microseconds for a miss on a local NVMe SSD; around ten milliseconds on a hard disk. On a cloud machine whose
"disk" is a network service, a miss can take a millisecond or more ([Chapter 14](/io/storage-stack)).

::: details Going deeper: variations
- **`mmap` instead of `read`:** no system call per access. A miss happens as a page fault instead, and the
  faulting thread sleeps the same way ([Chapter 5](/memory/kernel-memory)).
- **`O_DIRECT`:** skips the page cache and moves data straight between the device and `buf`. Databases use it
  to manage their own cache ([Chapter 13](/io/file-systems)).
- **`io_uring`:** submits the read without blocking and collects the result later
  ([Chapter 12](/io/io-models)).
- **Regular files are always "ready"** for `epoll`, so an event loop that reads files can block on a miss.
  That is why Node.js and others use a thread pool for file I/O ([Chapter 12](/io/io-models)).
- **A write** follows the same path down to the page cache, marks pages dirty and returns. The device is
  involved only later, during write-back, or at `fsync` ([Chapter 13](/io/file-systems)).
:::

### Where it can be slow or fail

| Step | What goes wrong | How you see it |
|---|---|---|
| Page cache | Working set larger than RAM, so reads keep missing | Low cache hit rate, many reads in `iostat` |
| Block layer and device | Queue full, device saturated, or slow cloud volume | High `await` and utilisation in `iostat -x` |
| Sleeping in `D` state | Many threads waiting on I/O | High load average with idle CPUs ([Chapter 8](/cpu/scheduling)) |
| Memory pressure | Reading evicts other useful pages | Page-cache churn, rising refaults in `/proc/vmstat` |
| Device errors | Failing disk or network volume | `EIO` from `read`; errors in `dmesg` |

## …a server accepts and serves a connection

**In short:** the kernel completes the TCP handshake by itself and parks the new connection in the accept
queue. The server's event loop is woken, accepts it, and from then on every request arrives as packets that
the kernel turns into bytes in a socket buffer.

A client connects to a web server that uses `epoll` with one event loop per core.

**Setting up the connection:**

1. **The client's SYN packet arrives.** The network card copies it into RAM with DMA, into a buffer on its
   receive ring. It picks a ring by hashing the connection's addresses and ports, so each connection sticks to
   one core. Then it raises an interrupt ([Chapter 15](/io/networking)).
2. **The kernel processes packets in a batch.** The interrupt handler only schedules a polling loop,
   <Term id="napi">NAPI</Term>. That loop runs as deferred kernel work, takes packets off the ring and passes
   them up through IP and firewall rules to TCP ([Chapter 15](/io/networking)).
3. **TCP answers with a SYN-ACK.** It records the half-open connection in the listening socket's SYN queue.
   The server program is not involved at all.
4. **The client's ACK completes the handshake.** TCP creates a new socket for the connection and moves it to
   the <Term id="accept-queue">accept queue</Term> ([Chapter 15](/io/networking)).
5. **The listening socket becomes readable.** The kernel puts it on the ready list of every
   <Term id="epoll">epoll</Term> instance watching it, and wakes a thread sleeping in `epoll_wait`
   ([Chapter 12](/io/io-models)).
6. **The event loop thread gets a core.** It waits in the run queue until the scheduler runs it
   ([Chapter 8](/cpu/scheduling)).
7. **It calls `accept`.** The kernel takes the connection off the accept queue and gives it a new file
   descriptor. The server makes it non-blocking and adds it to epoll ([Chapter 12](/io/io-models)).

**Serving a request:**

8. **Request packets arrive** by the same path: card, ring, interrupt, NAPI, IP, TCP. TCP puts the bytes in
   order in the socket's receive buffer and sends acknowledgements ([Chapter 15](/io/networking)).
9. **epoll wakes the loop again**, and the server calls `read`. The kernel copies the bytes from the receive
   buffer into the program's memory.
10. **The server does its work.** This is ordinary user-space code: parsing, maybe a database call over
    another socket, maybe a file read (the previous walkthrough).
11. **The server calls `write`.** The kernel copies the response into the socket's send buffer and returns at
    once. TCP sends it when the congestion and receive windows allow. The packets go down through IP and a
    queue to the driver, and the card sends them with DMA ([Chapter 15](/io/networking)).
12. **The connection is reused or closed.** With keep-alive, the loop waits for the next request. When one side
    closes, TCP exchanges FIN packets. The side that closed first keeps a `TIME_WAIT` entry for a while
    ([Chapter 15](/io/networking)).

::: details Going deeper: many cores, one port
- Several event loops can share one listening port with `SO_REUSEPORT`. The kernel then gives each loop its
  own accept queue and spreads connections by hash. Without it, one wake-up can wake many loops for one
  connection: the <Term id="thundering-herd">thundering herd</Term> ([Chapter 12](/io/io-models)).
- `sendfile` or `splice` can send a file's page-cache pages to a socket without copying them into the program
  ([Chapter 12](/io/io-models)).
- TLS adds a handshake in user space after TCP's, and encryption on every read and write, unless the kernel's
  TLS offload is used.
:::

### Where it can be slow or fail

| Step | What goes wrong | How you see it |
|---|---|---|
| Card and ring | Packets arrive faster than the kernel drains the ring | Drop counters in `ethtool -S` |
| NAPI and softirq | One core does all packet processing | A busy `ksoftirqd` thread; uneven `/proc/interrupts` |
| Accept queue | The server accepts too slowly | Connection times jump by 1 or 3 seconds; `ListenOverflows` in `nstat`; `ss -lnt` |
| Run queue | The loop thread waits for a core, or is throttled | Run-queue latency, `nr_throttled` ([Chapter 8](/cpu/scheduling)) |
| The event loop | Something blocks the loop: a file read, a lock, a slow call | All connections on that loop stall together |
| Small writes | Nagle's algorithm meets delayed ACKs | Replies stuck for about 40 ms ([Chapter 15](/io/networking)) |
| Buffers | Receive or send buffer too small for a long, fast path | Throughput capped below the link speed |

## …a process runs out of memory

**In short:** memory is promised freely and supplied on first use. As RAM fills, the kernel reclaims cache and
swaps, first in the background and then in the allocating thread itself. If nothing more can be freed, the OOM
killer ends a process. In a container, all of this happens inside the container's limit.

A service keeps allocating memory, for example a cache that never evicts.

1. **`malloc` asks for memory.** For small blocks, the allocator reuses free space it already has. For large
   blocks, or when its pools are empty, it asks the kernel with `brk` or `mmap`
   ([Chapter 6](/memory/allocators)).
2. **The kernel only records a region.** Linux promises memory freely; this is
   <Term id="overcommit">overcommit</Term>. `malloc` succeeds even if RAM is short
   ([Chapter 5](/memory/kernel-memory)).
3. **First writes cause page faults.** On each first touch, the kernel gives the page a zero-filled frame
   ([Chapter 4](/memory/virtual-memory)).
4. **Free memory runs low.** Most "used" memory on a busy machine is page cache, which can be dropped. When
   free memory falls below a threshold, the background thread `kswapd` starts
   <Term id="reclaim">reclaim</Term>: it drops clean file pages, writes dirty ones back, and moves anonymous
   pages to <Term id="swap">swap</Term> if there is any ([Chapter 5](/memory/kernel-memory)).
5. **Allocating threads start doing reclaim themselves.** If `kswapd` cannot keep up, a thread that needs a
   page must free some first. This is <Term id="direct-reclaim">direct reclaim</Term>, and it adds
   milliseconds to whatever that thread was doing, such as a request ([Chapter 5](/memory/kernel-memory)).
6. **The machine may thrash.** Pages that were evicted are needed again and read back, over and over. The
   machine becomes very slow but keeps running. <Term id="psi">Pressure stall information</Term> shows
   how much time tasks lose waiting for memory ([Chapter 5](/memory/kernel-memory)).
7. **Reclaim fails.** When nothing more can be freed, the <Term id="oom-killer">OOM killer</Term> picks the
   process whose death frees the most memory, adjusted by `oom_score_adj`, and sends it `SIGKILL`. The kernel
   logs the kill in `dmesg` ([Chapter 5](/memory/kernel-memory)).
8. **The memory returns.** The killed process exits, its pages are freed, and allocations succeed again. Its
   parent or supervisor sees it died from signal 9 and may restart it.

**In a container**, the same steps happen against the container's <Term id="cgroup">cgroup</Term> limit
(`memory.max`), not the machine's RAM. Reclaim targets only that group's pages, including its share of the page
cache. If it fails, the OOM killer picks a process **inside the group**, even if the host has free memory. The
container exits with status 137 (128 + 9), which Kubernetes shows as `OOMKilled`
([Chapter 5](/memory/kernel-memory), [Chapter 18](/systems/virtualization)).

::: details Going deeper: variations
- **A language runtime can run out first.** A JVM with a heap limit throws `OutOfMemoryError` when its heap
  is full, long before the kernel is involved. That is a different event with a different fix.
- **With `vm.overcommit_memory = 2`**, the failure moves to step 2: `malloc` or `fork` returns an error
  instead of a kill later.
- **`memory.high`** slows a container's allocations and forces reclaim, without killing it.
- **Early killers** such as `systemd-oomd` watch PSI and kill before the machine thrashes.
- **Shared memory counts.** Files in `/dev/shm` and memory-backed volumes live in RAM and count towards the
  limit ([Chapter 11](/cpu/ipc)).
:::

### Where it can be slow or fail

| Stage | What you notice | How you see it |
|---|---|---|
| Direct reclaim | Latency spikes with no obvious cause | `allocstall` in `/proc/vmstat`, `memory.pressure` |
| Swapping | Everything slow, disk busy | `si`/`so` in `vmstat 1`, major faults |
| Thrashing | Machine nearly unresponsive but alive | PSI `full` values high, refaults rising |
| Kernel OOM kill | A process vanishes without an error message | `dmesg` "Out of memory: Killed process" |
| Container OOM kill | Container restarts, exit code 137 | `OOMKilled` in Kubernetes, `oom_kill` in `memory.events` |

## …you press Ctrl-C

**In short:** the terminal turns Ctrl-C into a `SIGINT` signal for every process in the foreground job. The
kernel marks the signal pending and acts on it the next time each process passes through the kernel. By
default the process dies, and the shell reports it.

A long command is running in your terminal, and you press Ctrl-C.

1. **The terminal emulator sends a byte.** Ctrl-C is the byte `0x03`. The emulator writes it to the
   pseudo-terminal that connects it to your shell's session.
2. **The terminal layer in the kernel recognises it.** In the normal mode, the kernel's terminal code treats
   that byte as "interrupt" instead of passing it on as input. It sends `SIGINT` to the terminal's
   **foreground process group**: every process in the current job, such as all three in
   `cat log | grep x | less` ([Chapter 2](/foundations/processes-and-threads)).
3. **The kernel marks the signal pending** on each of those processes. Nothing else happens yet
   ([Chapter 2](/foundations/processes-and-threads)).
4. **Each process notices on its next pass through the kernel.**
   - If it is **running on another core**, the kernel interrupts that core, so the process enters the kernel.
   - If it is **sleeping interruptibly**, for example in `read` or `sleep`, the kernel wakes it. The system
     call ends early, with `EINTR` or by restarting after the handler.
   - If it is in **uninterruptible sleep** (state `D`, waiting for disk), the signal waits until the I/O
     completes ([Chapter 2](/foundations/processes-and-threads)).
5. **On the way back to user mode, the kernel acts on the signal.**
   - With no handler, the default action for `SIGINT` is to terminate. The process exits as in the first
     walkthrough.
   - With a <Term id="signal-handler">signal handler</Term>, the kernel makes the thread jump into it. Python
     raises `KeyboardInterrupt` this way. Many servers use it to shut down cleanly.
6. **The shell reaps the job.** It wakes from `waitpid`, sees that the child was killed by signal 2, sets `$?`
   to 130 (128 + 2), takes the terminal back, and prints a prompt.

::: details Going deeper: when Ctrl-C does not work
- **Raw mode:** programs such as `vim`, `ssh` and `tmux` switch the terminal off its normal mode. They get the
  `0x03` byte as input and decide what to do. Over SSH, the byte travels to the remote machine, whose own
  pseudo-terminal turns it into `SIGINT` there.
- **Blocked or ignored:** a program can ignore `SIGINT` or block it. `SIGKILL` can be neither caught nor
  ignored, which is why `kill -9` always works, except on a process stuck in state `D`.
- **In a container:** the first process is PID 1 in its namespace, and the kernel drops signals that PID 1
  has no handler for. A program that ignores Ctrl-C in `docker run` usually has no `SIGINT` handler and runs as
  PID 1. `docker run --init` puts a small init in front of it
  ([Chapter 2](/foundations/processes-and-threads)).
- **Threads:** the signal goes to one thread of the process that does not block it. Libraries often block
  signals in worker threads so that one chosen thread handles them.
:::

## …a container starts

**In short:** `docker run` asks a daemon, which asks lower-level tools, to prepare the image's files and then
start one ordinary process with new namespaces, a cgroup, restricted privileges and the image as its root.
From `exec` onward, it is the first walkthrough again.

You run `docker run -p 8080:80 nginx`.

1. **The CLI calls the daemon.** The `docker` command sends an HTTP request over the Unix socket
   `/var/run/docker.sock` ([Chapter 11](/cpu/ipc)).
2. **The image is fetched if needed.** The daemon, through `containerd`, downloads the image's layers and
   unpacks each one into a directory. Layers already on the machine are reused
   ([Chapter 18](/systems/virtualization)).
3. **The root file system is assembled.** The layers are stacked read-only, with a fresh writable layer on top,
   using <Term id="overlayfs">overlayfs</Term> ([Chapter 18](/systems/virtualization)).
4. **The low-level runtime, `runc`, creates the process.** It creates new
   <Term id="namespace">namespaces</Term>: PID, mount, network, host name, IPC, and possibly user. Inside
   them, the process has its own PID 1, its own mounts and its own network interfaces
   ([Chapter 18](/systems/virtualization)).
5. **It places the process in a new cgroup** and writes the limits: `memory.max`, `cpu.max`, `pids.max`
   ([Chapter 18](/systems/virtualization); limits in [Chapter 5](/memory/kernel-memory) and
   [Chapter 8](/cpu/scheduling)).
6. **It switches the root.** It mounts `/proc`, `/dev` and volumes, then makes the overlay directory the new
   root and detaches the host's file system.
7. **It connects the network.** A virtual cable, a veth pair, links the container's network namespace to a
   bridge on the host. A NAT rule forwards port 8080 on the host to port 80 inside
   ([Chapter 18](/systems/virtualization)).
8. **It drops privileges.** It removes most capabilities, sets no-new-privileges, and installs a
   <Term id="seccomp">seccomp</Term> filter that blocks risky system calls
   ([Chapter 17](/systems/security)).
9. **It calls `execve` on the image's entry point.** From here on, it is the `./a.out` walkthrough: the kernel
   loads `nginx`, its loader links its libraries from the image's files, and `main` runs as PID 1 in its
   namespace.
10. **The runtime steps back.** `runc` exits. A small shim process stays as the container's parent, collects
    its exit status and keeps its logs flowing to the daemon.

On the host, `ps` shows `nginx` as a normal process with a normal PID. There is no guest kernel. Every system
call it makes goes to the host's kernel, filtered by seccomp and scoped by namespaces and cgroups
([Chapter 18](/systems/virtualization)).

### Where it can be slow or fail

| Step | What goes wrong | How you see it |
|---|---|---|
| Image pull | Large layers, slow registry | Most of the start time; `docker pull` progress |
| Overlay writes | First write to a big file copies it up | Slow first writes inside the container |
| cgroup limits | CPU throttling, OOM kills, `pids.max` reached | `cpu.stat`, `memory.events`, `fork` failing with `EAGAIN` |
| PID 1 | No signal handling, zombies pile up | `docker stop` takes the full timeout; `<defunct>` processes |
| Networking | NAT and connection-tracking table full | Dropped connections; `conntrack -S` |

## Why this matters in real systems

**Incident debugging is a walkthrough in reverse.** A symptom, such as "p99 went up", sits at the end of a path.
You walk back through the steps and check each one's evidence: run-queue latency, throttling, page-cache
misses, accept-queue overflows, direct reclaim. [Chapter 19](/systems/performance) gives the method.

**Queues are everywhere.** Every walkthrough passes through queues: the card's ring, the accept queue, the
run queue, the block layer's queue, the socket buffers. Each can fill up, and a full queue turns into waiting
time. When latency grows, ask which queue is filling.

**The same mechanisms recur.** A slow first request after a deploy is page faults on cold code (walkthrough 1)
plus page-cache misses (walkthrough 2). A 1-second connection delay is the accept queue (walkthrough 3). A
container restarting with code 137 is walkthrough 4. A container that ignores `docker stop` is the PID 1 rule
from walkthrough 5.

**Cost follows the boundary crossings.** A path that stays in user space is fast. Each system call costs
around 100 ns. Each sleep and wake-up costs microseconds. Each trip to a device costs from microseconds to
milliseconds. Counting these crossings is a quick way to estimate where time goes.

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. Walk me through what happens when you type ls in a shell and press Enter.
The shell wakes from `read` on the terminal with the line. It searches `PATH` and finds `/usr/bin/ls`. It
forks. The child joins a new process group, becomes the terminal's foreground job, and calls `execve`.

The kernel replaces the child's memory with `ls`'s segments and the dynamic loader, and builds a stack with
the arguments and environment. The loader maps libc and other libraries, links them, and calls `main`. Code
pages load through page faults, usually from the page cache.

`ls` opens the directory, reads entries with `getdents64`, calls `stat` on files if needed, and writes the
output to the terminal. It exits. The kernel frees its memory and sends `SIGCHLD`, and the shell's `waitpid`
returns the exit status. The shell prints a new prompt.

**Senior add-on:** mention copy-on-write in fork, lazy loading through page faults, and where time goes. For a
tiny program, start-up is dominated by exec, the loader and page faults, not by the program's own work.
`strace -f` would show every step.
:::

::: details 2. A program's first read() of a file takes 5 ms; the second takes 2 µs. Explain.
The first read missed the page cache. The kernel sent a request through the file system and the block layer
to the device, and the thread slept until the device's interrupt said the data was in RAM. The second read
found the data in the page cache and only needed a copy.

**Senior add-on:** 5 ms suggests a hard disk or a network volume; a local NVMe miss is closer to 100 µs.
Read-ahead may mean later sequential reads also hit. `iostat -x` and the major fault count confirm it.
Databases that need predictable latency pre-warm the cache or manage their own with `O_DIRECT`.
:::

::: details 3. Walk me through what happens between a client's connect() and the server's accept() returning.
The client sends a SYN. The server's card copies it into RAM and raises an interrupt. The kernel processes it
in a NAPI polling loop, through IP to TCP. TCP records a half-open connection and replies with a SYN-ACK. When
the client's ACK arrives, TCP creates the connection's socket and puts it in the listening socket's accept
queue. All of this happens in the kernel, without the server program.

The listening socket becomes readable. epoll marks it ready and wakes the server's thread. When the scheduler
runs that thread, it calls `accept`, which takes the connection off the queue and returns a new file
descriptor.

**Senior add-on:** the client's `connect` returns after the SYN-ACK, before the server has called `accept`. If
the accept queue is full, the kernel drops the handshake packets and the client retries after 1 s, then 3 s in
total, which is the classic latency signature. `SO_REUSEPORT` gives each worker its own queue.
:::

::: details 4. Where could a request to a web service spend time, from the network card to the response?
Start at the bottom:

- The card's receive ring and the softirq processing, if one core handles too many packets.
- The accept queue, if the server accepts too slowly.
- The run queue, waiting for a core, or CPU throttling in a container.
- The event loop, if something blocks it: file I/O, a lock, a slow dependency.
- Page faults and page-cache misses in the handler, especially after a deploy.
- Direct reclaim, if memory is short.
- Lock contention between threads.
- The send buffer and TCP's windows, and Nagle's algorithm meeting delayed ACKs for small writes.

**Senior add-on:** say how you would tell them apart: CPU profiles for on-CPU time, off-CPU profiles for
waiting, `nstat` and `ss` for network queues, `cpu.stat` for throttling, PSI for pressure. Then fix the
biggest one first.
:::

::: details 5. A pod is restarted with exit code 137. Walk through what happened.
137 is 128 + 9: the process was killed by `SIGKILL`. The most common cause is the memory cgroup's OOM
killer. The container's processes used more memory than `memory.max`. The kernel tried to reclaim pages from
that group, failed, and killed a process inside it. Kubernetes reports `OOMKilled` and restarts the container.

**Senior add-on:** check `memory.events` for `oom_kill`, and `memory.stat` to see what filled the limit:
anonymous memory, shared memory in `/dev/shm`, or dirty page cache. Other causes of 137 are a `SIGKILL` after
a failed graceful shutdown, or a kill by the node when it runs short of memory. The fix depends on which one it
was.
:::

::: details 6. You press Ctrl-C but the program keeps running. What could be going on?
Several things:

- The program handles or ignores `SIGINT`, for example to finish work first.
- The terminal is in raw mode, as in `vim` or `ssh`, so Ctrl-C is sent as input instead of a signal.
- The process is in uninterruptible sleep (`D`), for example waiting for a hung network file system. The
  signal waits until the I/O finishes.
- It runs as PID 1 in a container without a `SIGINT` handler, so the kernel drops the signal.
- Only part of the job stopped; a child moved to its own process group and did not get the signal.

**Senior add-on:** check the state with `ps -o stat`, the signal handling with the `SigCgt` and `SigIgn` masks
in `/proc/<pid>/status`, and the kernel stack with `/proc/<pid>/stack`. `kill -9` works in every case except
state `D`.
:::

::: details 7. Walk me through docker run. What makes a container different from a VM?
The CLI sends a request over the Docker socket. The daemon, through containerd, pulls and unpacks the image
layers and stacks them with overlayfs. `runc` creates the process with new namespaces, places it in a cgroup
with limits, mounts `/proc` and volumes, switches the root to the overlay, connects a veth pair to a bridge,
drops capabilities, installs a seccomp filter, and calls `execve` on the entry point.

A VM runs its own kernel on virtual hardware. A container is a normal process on the host's kernel, with a
restricted view and restricted resources.

**Senior add-on:** start-up time is dominated by pulling images; after that it is roughly the time to create
namespaces, the cgroup and mounts, plus the program's own start-up. The shared kernel is why container
isolation is weaker than a VM's, and why sandboxes such as gVisor and Firecracker exist.
:::

::: details 8. A service is slow for the first few minutes after every deploy, then fine. Why?
The new process starts cold. Its code and libraries load through page faults. Data files it reads miss the
page cache until they have been read once. Just-in-time compilers in the JVM or V8 have not compiled the hot
code yet. Connection pools, caches inside the program, and branch predictors and CPU caches are all empty.

**Senior add-on:** fixes are warm-up traffic before joining the load balancer, pre-touching memory
(`MAP_POPULATE`, `-XX:+AlwaysPreTouch`), reading key files at start, and rolling deploys slowly enough that
the remaining instances absorb the load.
:::

::: details 9. The machine has plenty of free memory, but a container keeps getting OOM-killed. How?
The OOM kill is inside the container's cgroup. Its limit, `memory.max`, is what counts, not the host's free
RAM. When the group reaches its limit and cannot reclaim enough, the kernel kills a process in that group.

**Senior add-on:** look at what fills the limit. Anonymous memory without swap cannot be reclaimed. Shared
memory in `/dev/shm` and memory-backed volumes count too. A runtime that sizes its heap from the host's RAM
instead of the limit, such as an old JVM, will overshoot. Page cache is usually not the cause, because clean
cache is reclaimed first.
:::

## Common misconceptions

- **"fork copies the parent's memory."** It copies page tables; memory is shared copy-on-write.
- **"exec loads the program from disk."** It maps the file. Pages load later, through page faults, usually from
  the page cache.
- **"read() goes to the disk."** Most reads on a warm system are page-cache hits and never reach a device.
- **"The server accepts connections."** The kernel accepts them. The program's `accept` only takes them off
  a queue.
- **"Ctrl-C kills the program."** It sends `SIGINT` to the foreground job. The program may handle it, ignore
  it, or not get it at all.
- **"A container is a lightweight VM."** It is a process on the host kernel, with namespaces and cgroups.

## Key takeaways

- Every walkthrough is built from four mechanisms: **system calls, page faults, interrupts, and sleep and
  wake-up**.
- Much of the work happens **before or without your program**: the kernel loads pages lazily, completes
  handshakes, and reads ahead.
- **Queues** sit between every pair of steps. When latency grows, find the queue that is filling.
- Answer in two passes: **the whole path first**, then depth where asked, then **where it could go wrong**.
- Containers change the **limits and the view**, not the path. The same walkthroughs apply inside them.

## Review

<Flashcards id="what-happens-when" :cards="cards" />

<MarkDone id="what-happens-when" />
