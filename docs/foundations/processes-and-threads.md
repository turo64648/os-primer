---
title: 2. Processes & Threads
---

<script setup>
import { cards } from './processes-and-threads-review'
</script>

# 2. Processes & Threads

A process is a running program, and a thread is one line of execution inside it. Interviewers use them to
probe isolation, cost and failure: why `fork` is fast, why a container ignores its stop signal, why zombies
pile up.

::: info Before you start
- The <Term id="kernel">kernel</Term> is the core of the operating system. Programs ask it for things with
  <Term id="syscall">system calls</Term>, which switch the CPU into a privileged mode and back.
- Each process gets its own private view of memory, its <Term id="address-space">address space</Term>. The
  hardware translates every address through tables the kernel keeps for that process.
- A hardware timer lets the kernel take the CPU away from a running program. This is
  <Term id="preemption">preemption</Term>.

[Chapter 1](/foundations/what-is-an-os) and [Chapter 4](/memory/virtual-memory) cover these ideas in full.
You can follow this chapter without them.
:::

## What a process is

**In short:** a process is a running program plus everything the kernel tracks for it: its memory, its open
files, its identity and at least one thread of execution.

Run `python train.py` in two terminals. There is one program file on disk, but two separate running copies.
Each has its own variables, its own open files and its own progress through the code. If one crashes, the
other keeps going. Each running copy is a <Term id="process">process</Term>.

A process owns a bundle of resources:

- **Memory:** its address space, holding code, global variables, the heap and stacks.
- **Open files:** a table of <Term id="file-descriptor">file descriptors</Term>. A file descriptor is a
  small number, such as `3`, that stands for an open file, socket or pipe.
- **Identity:** a process ID, the user it runs as, its current directory.
- **Signal settings:** what to do when notifications arrive (covered later in this chapter).
- **One or more threads:** the parts that actually run code.

Each process has a number, its <Term id="pid">process ID (PID)</Term>. Every process also has a parent, the
process that created it. `ps -ef` lists processes with their PID and their parent's PID (PPID).

### The process control block

The kernel needs a record for every process: which state it is in, where its memory is, which files it has
open. Textbooks call this record the <Term id="pcb">process control block (PCB)</Term>. On Linux it is a C
structure called `task_struct`. It mostly holds pointers to other structures: one for memory, one for the
file table, one for signal handlers, and so on.

When the kernel stops a thread to run another one, it saves the thread's CPU registers. A register is a small
storage slot inside the CPU. The kernel restores them when the thread runs again. This save and restore is a
<Term id="context-switch">context switch</Term>. [Chapter 8](/cpu/scheduling) covers what it costs.

::: details Going deeper: task_struct and /proc
- `task_struct` is defined in `include/linux/sched.h`. It is several kilobytes and has hundreds of fields.
  Key pointers: `mm` (the address space), `files` (the file descriptor table), `fs` (current and root
  directory), `sighand` (signal handlers), `signal` (process-wide signal state), `cred` (user and group IDs).
- Each task also has its own kernel stack, used while it runs kernel code. On x86-64 it is 16 KiB.
- `/proc/<pid>/status` shows much of it as text: `State`, `Tgid`, `Pid`, `PPid`, `Threads`, and bitmasks of
  blocked, ignored and caught signals (`SigBlk`, `SigIgn`, `SigCgt`).
- PIDs are recycled. The upper limit is in `/proc/sys/kernel/pid_max`. The kernel default is 32768, and many
  distributions raise it to about 4 million.
:::

## Process states

**In short:** at any moment a thread is running, ready to run, sleeping while it waits for something,
stopped, or finished but not yet collected (a zombie).

A web server thread spends most of its life waiting: for a request, for the database, for the disk. While it
waits, it needs no CPU. So the kernel tracks a **state** for every thread, and the scheduler only looks at
threads that can use a CPU right now.

<ProcessStatesDiagram />

- **Running:** on a CPU at this moment.
- **Ready (runnable):** able to run, waiting for a free CPU. The <Term id="scheduler">scheduler</Term> picks
  among these.
- **Sleeping:** waiting for an event, such as data from the network, a lock, or a timer. When the event
  happens, the kernel marks the thread ready again.
- **Stopped:** paused on purpose, for example by Ctrl-Z in a terminal or by a debugger.
- **Zombie:** the process has exited, but its parent has not yet collected its exit code. A later section
  explains this.

Linux does not separate "ready" and "running": both show as `R`. The `ps` command shows the state in its
`STAT` column: `R`, `S`, `D`, `T` or `Z`.

### Two kinds of sleep

Linux has two kinds of sleep, and the difference matters in production:

- **Interruptible sleep (`S`).** The normal kind. A signal can wake the thread. A thread waiting for a network
  request is in this state.
- **Uninterruptible sleep (`D`).** The thread is in the middle of an operation the kernel cannot safely
  abandon, usually disk or network file system I/O. Signals wait until it finishes. Even `kill -9` has no
  effect until the thread wakes up.

A process stuck in `D` for minutes usually means a hung disk or a network file system (NFS) server that
stopped answering. You cannot kill it; you fix the storage.

::: details Going deeper: load average and killable sleep
- On Linux, the **load average** (from `uptime`) counts threads in `R` **and** `D`. So a high load average
  with idle CPUs often means many threads waiting on slow storage. Other Unix systems count only `R`.
- Since Linux 2.6.25 there is a third kind, `TASK_KILLABLE`: like `D`, but a fatal signal such as `SIGKILL`
  can still wake it. Some slow paths, including parts of NFS, use it.
- Other `ps` codes: `t` (stopped by a debugger), `I` (an idle kernel thread), `X` (dead, rarely seen).
  Extra letters after the state: `s` session leader, `l` multithreaded, `+` in the foreground process group.
:::

## Creating processes: fork, exec, wait

**In short:** `fork` makes a copy of the calling process. `exec` replaces the program running in a process.
`wait` lets a parent collect a child's exit code. Every command a shell runs uses all three.

You type `ls` in a shell. The shell must start a new program, but it must also keep running itself, so it
can show the next prompt. Unix splits this into steps:

1. **The shell calls <Term id="fork">`fork`</Term>.** The kernel creates a new process, the **child**, as a
   copy of the shell. Both continue from the same line of code, right after `fork` returns.
2. **The child calls <Term id="exec">`exec`</Term>** with the path of `ls`. The kernel throws away the
   child's program and memory, loads `ls`, and starts it from the beginning. The PID stays the same.
3. **The shell calls <Term id="waitpid">`wait`</Term>** (in practice `waitpid`). The shell sleeps until the
   child exits, then receives its exit code.

<ForkExecWaitDiagram />

### fork returns twice

`fork` is called once but returns twice: once in the parent and once in the child. The return value tells
them apart:

- In the **child**, `fork` returns `0`.
- In the **parent**, it returns the child's PID.
- On failure, it returns `-1` in the parent, and there is no child.

Copying all of a process's memory would be slow, so `fork` does not copy it. Parent and child share the same
physical memory, marked read-only. When either one writes to a page (a 4 KiB block of memory), the kernel
copies that one page. This is <Term id="copy-on-write">copy-on-write</Term>, and
[Chapter 5](/memory/kernel-memory) covers it in depth.

### Try it: fork, exec, wait

```c
// spawn.c: gcc spawn.c -o spawn && ./spawn
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    printf("parent: my pid is %d\n", getpid());
    fflush(stdout);                 // empty the buffer before fork (see below)

    pid_t pid = fork();
    if (pid < 0) { perror("fork"); return 1; }

    if (pid == 0) {                 // fork returned 0: we are the child
        printf("child: my pid is %d, my parent is %d\n", getpid(), getppid());
        fflush(stdout);
        execlp("echo", "echo", "hello from echo", (char *)NULL);
        perror("execlp");           // reached only if exec failed
        _exit(127);
    }

    int status;                     // fork returned the child's pid: we are the parent
    waitpid(pid, &status, 0);       // sleep until the child exits
    if (WIFEXITED(status))
        printf("parent: child %d exited with code %d\n", pid, WEXITSTATUS(status));
    return 0;
}
```

Expected output (your PIDs will differ):

```text
parent: my pid is 4460
child: my pid is 4461, my parent is 4460
hello from echo
parent: child 4461 exited with code 0
```

Three details in this code come up in interviews:

- **`exec` does not return** when it works. The old program is gone, so there is nothing to return to. Code
  after `exec` runs only if it failed.
- **The `fflush` before `fork`.** `printf` collects output in a buffer in the process's memory, and `fork`
  copies that buffer. Without the flush, when output goes to a file or pipe, the parent's first line would be
  printed twice, once by each process.
- **The child exits with `_exit`, not `exit`.** `exit` flushes the C library's buffers and runs cleanup
  handlers, which belong to the parent's copy of the program. `_exit` ends the process at once.

### Why fork and exec are separate

Other systems have one call that starts a program; Windows has `CreateProcess`. Unix splits it in two, and
the gap between the two calls is useful. After `fork` and before `exec`, the child is still running the
shell's code. It can change its own setup, and `exec` keeps most of that setup.

This is how shells build redirections and pipelines. For `ls > out.txt`, the child opens `out.txt`, moves it
onto file descriptor 1 (standard output) with `dup2`, then calls `exec`. The new program writes to file
descriptor 1 as usual and never knows it was redirected. For `ls | grep x`, the shell creates a pipe, a
one-way channel between processes, and gives one end to each child ([Chapter 11](/cpu/ipc)).

::: details Going deeper: what exec keeps and what it resets
- **Kept:** the PID and parent, open file descriptors, current directory, user and group IDs (unless the
  program file is setuid), resource limits, the signal mask, and signals that are set to be ignored.
- **Reset:** the whole address space, all threads but one, and signal handlers. A handler is code in the old
  program, so it cannot survive. Handled signals go back to their default action.
- A file descriptor opened with the `O_CLOEXEC` flag closes automatically on `exec`. Libraries should
  always use it. Otherwise their private files and sockets leak into every program the process starts.
  A leaked listening socket in a long-lived child is a classic cause of "address already in use" after a
  restart.
- "exec" is a family of libc functions (`execl`, `execvp`, `execve`, …). They all end in one system call,
  `execve`. [Chapter 3](/foundations/linking-and-loading) shows how it builds the new address space.
:::

## Why large programs avoid fork

**In short:** `fork` in a big or multithreaded process is slow and risky. Modern code starts programs with
`posix_spawn` or `vfork`, which skip the copy.

Copy-on-write makes `fork` cheap for a small shell. It is not cheap for a service using 50 GB of memory.
There are three problems.

**The page tables are still copied.** The kernel does not share the process's
<Term id="page-table">page tables</Term>, the tables that map its memory. Copying them takes about 8 bytes
per 4 KiB page: about 100 MB for 50 GB. The parent is paused while that happens, for tens to hundreds of
milliseconds. Afterwards, each page either process writes gets copied, one fault at a time.

**Memory accounting can refuse.** If the kernel is set to strict memory accounting, it must be able to back
a full second copy. A `fork` of a 30 GB process on a 48 GB machine can then fail with `ENOMEM`, even if the
child would call `exec` a microsecond later.

**Threads do not survive fork.** Only the thread that called `fork` exists in the child. The other threads
vanish, but the memory they were using is copied as it was. If one of them held a lock, the child has a lock
that nobody will ever release. The next call that needs it, say inside a logging library, hangs forever.
POSIX says a child of a multithreaded process may only call a short list of safe functions until it calls
`exec`.

### The alternatives

- **<Term id="posix-spawn">`posix_spawn`</Term>** starts a new program in one call. It takes a list of file
  actions (open, close, `dup2`) to apply before the program starts. It does not copy the parent. Prefer it
  when you only want to run a command.
- **`vfork`** creates a child that borrows the parent's memory instead of copying it. The parent is paused
  until the child calls `exec` or `_exit`. The child must do almost nothing else, because any change it
  makes lands in the parent's memory.

Some programs still `fork` without `exec`, on purpose. Redis forks to write a snapshot: the child sees a
frozen copy of the data while the parent keeps serving. Pre-fork servers such as Gunicorn fork worker
processes that share the parent's already-loaded code.

::: details Going deeper: how glibc, Python and others start programs
- Since glibc 2.24, `posix_spawn` on Linux uses `clone` with `CLONE_VM | CLONE_VFORK` (`clone` is explained
  below). The child borrows the parent's memory, runs on its own small stack, and the parent waits until
  `exec`. It is about as cheap as `vfork` and much safer.
- The cost of `fork` grows with the size of the parent. `vfork` and `posix_spawn` cost about the same for
  any parent size.
- Strict accounting is `vm.overcommit_memory = 2`. Redis recommends setting it to `1` (always allow) so that
  its snapshot `fork` does not fail. [Chapter 5](/memory/kernel-memory) covers overcommit.
- `pthread_atfork` lets a library register code that runs around `fork` to take and release its locks. Few
  libraries use it, and it cannot cover every case.
- Python's `multiprocessing` used `fork` by default on Linux for years. Python 3.12 warns when a process
  with threads forks, and Python 3.14 changed the default on Linux to `forkserver`.
:::

## Exiting: exit codes, zombies and orphans

**In short:** a finished child stays as a zombie until its parent collects its exit code with `wait`. If
the parent dies first, the child is handed to another process that will collect it.

### Exit codes

A process ends by calling `exit` (or returning from `main`), or by being killed by a signal. Its parent
learns which one happened, and gets a number:

- **Exited normally:** the <Term id="exit-status">exit status</Term>, from 0 to 255. By convention, `0` means
  success and anything else is failure. Only the low 8 bits survive, so `exit(256)` looks like success.
- **Killed by a signal:** the signal's number. Shells report this as **128 + the signal number**. `SIGKILL`
  is 9, so a killed process shows 137. `SIGTERM` is 15, so 143.

That is why "exit code 137" in Docker or Kubernetes means "killed by SIGKILL". Very often the sender was the
<Term id="oom-killer">out-of-memory (OOM) killer</Term>, because a container went over its memory limit.
Shells also use 127 for "command not found" and 126 for "found but not executable".

### Zombies

When a process exits, the kernel frees almost everything: its memory, its open files, its threads. It keeps
one small record: the PID, the exit status and some usage counters, because the parent may still want them.
A finished process that is waiting to be collected is a <Term id="zombie">zombie</Term>. `ps` shows it as
`Z`, often with `<defunct>` after its name.

When the parent calls `wait` or `waitpid`, the kernel hands over the status and deletes the record. This is
called **reaping** the child. The kernel also sends the parent the `SIGCHLD` signal when a child exits, so a
busy parent can reap only when needed.

```c
// zombie.c: gcc zombie.c -o zombie && ./zombie
#include <stdio.h>
#include <stdlib.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    pid_t pid = fork();
    if (pid == 0) _exit(3);         // child: exit at once with code 3

    sleep(1);                       // parent: do not wait yet
    char cmd[64];
    snprintf(cmd, sizeof cmd, "ps -o pid,ppid,stat,comm -p %d", pid);
    system(cmd);                    // the child is now a zombie

    int status;
    waitpid(pid, &status, 0);       // collect it
    printf("reaped %d, exit code %d\n", pid, WEXITSTATUS(status));
    fflush(stdout);
    system(cmd);                    // now it is gone
    return 0;
}
```

Expected output:

```text
  PID  PPID STAT COMMAND
 4471  4470 Z    zombie
reaped 4471, exit code 3
  PID  PPID STAT COMMAND
```

A zombie uses no CPU and almost no memory. The danger is that it holds its PID. A program that starts
children and never reaps them leaks one PID per child. Eventually `fork` fails with `EAGAIN`, because the
system or the container has run out of PIDs. You cannot kill a zombie: it is already dead. You fix or kill
the **parent**.

### Orphans and reparenting

What if the parent exits first? The child becomes an <Term id="orphan">orphan</Term>. The kernel gives it a
new parent, which is called **reparenting**. Normally the new parent is PID 1, the first process started at
boot (`systemd` on most Linux systems). PID 1 reaps any orphan that exits, so orphans do not become
permanent zombies.

A process can also ask to adopt orphans from among its own descendants, by becoming a **subreaper**. Service
managers and container runtimes do this to keep track of everything a service started.

::: details Going deeper: reaping patterns and pidfds
- Setting `SIGCHLD` to `SIG_IGN` tells the kernel to reap children automatically. The parent then cannot get
  their exit codes.
- A `SIGCHLD` handler should loop `waitpid(-1, &status, WNOHANG)` until it returns 0. Standard signals do not
  queue (see below), so one `SIGCHLD` may stand for several dead children.
- A subreaper is set with `prctl(PR_SET_CHILD_SUBREAPER, 1)` (Linux 3.4 and later).
- PIDs are reused, so "send a signal to PID 4471" can hit an unrelated process if 4471 was reaped and its
  number given out again. A **pidfd** is a file descriptor that refers to one specific process.
  `pidfd_open` (Linux 5.3), `pidfd_send_signal` and `waitid(P_PIDFD, …)` avoid the race.
- The classic "double fork" for daemons forks twice so the daemon becomes an orphan, adopted by PID 1, and
  its original parent does not need to reap it.
:::

## Threads: what they share

**In short:** threads of one process share memory, open files and signal handlers. Each thread has only its
own registers, stack and a few small settings.

A web server wants to handle 100 requests at once. It could start 100 processes, but they could not easily
share a cache, and each would need its own memory. Instead it runs 100 <Term id="thread">threads</Term> in
one process. Each thread runs its own sequence of instructions, but they all see the same memory. One thread
can put an item in a cache, and another can read it at once.

Here is what threads of one process share, compared with a parent and child after `fork`:

| | Threads of one process | Parent and child after `fork` |
|---|---|---|
| Memory (code, globals, heap) | One shared copy | Separate copies (copy-on-write) |
| Stack and registers | Each thread has its own | Each has its own |
| File descriptor table | Shared: one thread's `close` affects all | Separate tables, pointing to the same open files |
| Signal handlers | Shared | Copied |
| Signal mask (which signals are blocked) | Each thread has its own | Copied |
| Process ID | Same PID; each thread has its own thread ID | Different PIDs |

Sharing is the point of threads, and also their danger. Two threads can update the same variable at the same
time and corrupt it; [Chapter 9](/cpu/concurrency-1) covers locks. And there is no isolation. If one thread
writes to a bad address, the whole process gets a <Term id="sigsegv">segmentation fault</Term>, and every
thread dies.

Threads are cheaper than processes in three ways. Creating one does not copy page tables. Switching between
two threads of the same process keeps the same address space, so the CPU's cache of address translations
stays valid ([Chapter 4](/memory/virtual-memory)). And sharing data needs no copying.

::: warning Shared file offsets after fork
After `fork`, parent and child have separate descriptor tables, but each entry points to the **same** open
file, with one shared read/write position. If both write to an inherited log file, their writes interleave.
If both read from an inherited file, each read moves the position for the other one.
:::

::: details Going deeper: per-thread details
- Each thread has its own `errno` and other **thread-local storage**: variables declared `_Thread_local` (or
  `__thread`), where each thread gets its own copy.
- glibc gives each new thread an 8 MiB stack by default (taken from the stack size limit, `ulimit -s`). It is
  reserved address space. Only the pages the thread touches use RAM.
- On Linux, user and group IDs are stored per thread in the kernel. glibc makes `setuid` apply to all
  threads by signalling each of them. Raw system calls do not.
:::

## How Linux does it: everything is a task

**In short:** the Linux kernel has one kind of schedulable thing, the task. A "thread" is a task that shares
memory and files with other tasks; a "process" is a group of such tasks.

Many operating systems have one structure for processes and another for threads. Linux does not. Every
thread is a task with its own `task_struct`. The scheduler only sees tasks. It does not know or care which
tasks belong together.

What makes tasks "threads of one process" is sharing. New tasks are created with the
<Term id="clone">`clone`</Term> system call, which takes a set of flags. Each flag names one thing to share
instead of copy:

- `CLONE_VM`: share the address space.
- `CLONE_FILES`: share the file descriptor table.
- `CLONE_SIGHAND`: share signal handlers.
- `CLONE_THREAD`: join the same thread group, which is what users see as one process.

`fork` is `clone` with no sharing flags. `pthread_create` is `clone` with all of them. Everything in between
is possible too. Container runtimes use other flags to give a new task its own namespaces
([Chapter 18](/systems/virtualization)).

<ThreadsVsProcessesDiagram />

### PIDs and thread IDs

This design explains a confusing detail. In the kernel, every task has its own ID. The kernel calls it the
PID, but user space calls it the **thread ID (TID)**. The ID of the whole thread group, which is the TID of
its first thread, is what user space calls the PID.

```c
// tids.c: gcc tids.c -o tids -pthread && ./tids
#define _GNU_SOURCE
#include <pthread.h>
#include <stdio.h>
#include <unistd.h>

static int shared = 0;              // one copy, seen by every thread

static void *worker(void *arg) {
    (void)arg;
    shared = 42;
    printf("thread: pid %d, tid %d\n", getpid(), gettid());
    return NULL;
}

int main(void) {
    printf("main:   pid %d, tid %d\n", getpid(), gettid());
    pthread_t t;
    pthread_create(&t, NULL, worker, NULL);
    pthread_join(t, NULL);
    printf("main:   shared = %d\n", shared);
    return 0;
}
```

Expected output (needs glibc 2.30 or later for `gettid`):

```text
main:   pid 4486, tid 4486
thread: pid 4486, tid 4487
main:   shared = 42
```

Both threads report the same PID, and the main thread's TID equals the PID. The worker's write to `shared`
is visible to `main`, because there is one copy of the memory. Each thread appears as a directory under
`/proc/<pid>/task/`, and `top -H` or `ps -eLf` list threads one per line.

::: details Going deeper: clone flags, clone3 and user-level threads
- glibc's `pthread_create` calls `clone` with roughly `CLONE_VM | CLONE_FS | CLONE_FILES | CLONE_SIGHAND |
  CLONE_THREAD | CLONE_SYSVSEM | CLONE_SETTLS | CLONE_PARENT_SETTID | CLONE_CHILD_CLEARTID`.
- `CLONE_CHILD_CLEARTID` makes the kernel clear a memory word and wake a <Term id="futex">futex</Term> when
  the thread exits. That is how `pthread_join` waits without polling.
- `clone3` (Linux 5.3) is a newer version that takes a structure instead of packed arguments.
- The kernel's own threads (`[kworker/0:1]` and so on in `ps`) are tasks with no user address space.
- Go, Erlang and Java's virtual threads run many lightweight user-level threads on a few kernel threads. The
  language runtime, not the kernel, switches between them. This is called **M:N threading**. The kernel sees
  only the few real threads underneath.
:::

## Signals

**In short:** a signal is a small notification sent to a process at any moment. Each signal has a default
action, usually "terminate". A program can instead ignore it or run its own function, called a handler.

You press Ctrl-C and a program stops. A program reads a bad address and dies with "Segmentation fault". A
container platform tells your service to shut down. All three are <Term id="signal">signals</Term>: numbered
notifications that the kernel delivers to a process. They are one of the oldest parts of Unix, and they
interrupt whatever the process was doing.

Signals come from three places:

- **The kernel**, when the process did something wrong (`SIGSEGV` for a bad address) or something happened
  to it (`SIGCHLD` when a child exits, `SIGPIPE` when it writes to a pipe nobody reads).
- **Other processes**, with the `kill` system call. Despite the name, `kill` can send any signal.
- **The terminal**, when you press Ctrl-C (`SIGINT`) or Ctrl-Z (`SIGTSTP`).

For each signal, a process chooses one of three **dispositions**: take the default action, ignore it, or run
a <Term id="signal-handler">signal handler</Term>, a function in the program. A program can also **block** a
signal for a while. A blocked signal stays pending and is delivered when it is unblocked.

| Signal | Number | Default action | Can be caught or ignored? | Typical source |
|---|---|---|---|---|
| `SIGINT` | 2 | Terminate | Yes | Ctrl-C |
| `SIGTERM` | 15 | Terminate | Yes | `kill`, `docker stop`, Kubernetes |
| `SIGKILL` | 9 | Terminate | **No** | `kill -9`, the OOM killer |
| `SIGSEGV` | 11 | Terminate and dump core | Yes | Bad memory access |
| `SIGPIPE` | 13 | Terminate | Yes | Writing to a closed pipe or socket |
| `SIGCHLD` | 17 | Ignore | Yes | A child exited or stopped |
| `SIGHUP` | 1 | Terminate | Yes | Terminal closed; often reused for "reload config" |
| `SIGSTOP` | 19 | Stop | **No** | `kill -STOP`, debuggers |

Signal numbers are the same on x86 and ARM Linux, but differ on a few other architectures. Use the names in
code. Servers usually ignore `SIGPIPE`, so that a client hanging up causes a write error instead of killing
the server.

### How a signal is delivered

Sending a signal only sets a "pending" flag in the target's kernel record. Nothing happens to the target
until it next passes through the kernel on its way back to user mode, after a system call or an interrupt. At
that point the kernel checks for pending signals. If the target is in an interruptible sleep, the kernel
wakes it. If it is running on another core, the kernel interrupts that core.

To run a handler, the kernel sets up the thread's stack so that it "returns" into the handler instead of the
code it was running. When the handler finishes, a special system call puts the thread back exactly where it
was. The program was interrupted at an arbitrary instruction, which is why handlers are dangerous (see
below).

In a multithreaded process, a signal sent to the process goes to any one thread that does not block it. A
signal caused by a thread, such as `SIGSEGV`, goes to that thread.

::: details Going deeper: queuing, EINTR and core dumps
- Standard signals do not queue. If `SIGCHLD` is sent three times while it is pending, it is delivered once.
- **Real-time signals** (`SIGRTMIN` to `SIGRTMAX`) do queue, and can carry a small value.
- If a handler runs while the thread is blocked in a slow system call, such as `read` on a socket, that call
  fails with `EINTR`. The `SA_RESTART` flag in `sigaction` makes most such calls restart automatically. Some
  never restart, such as `epoll_wait` and `nanosleep`.
- Use `sigaction`, not the older `signal` function, whose behaviour differs across systems.
- A "core dump" is a file with the process's memory, written for later debugging. Whether one appears
  depends on `ulimit -c` and `/proc/sys/kernel/core_pattern`. Many systems hand it to `systemd-coredump`.
:::

## SIGTERM, SIGKILL and graceful shutdown

**In short:** `SIGTERM` asks a process to exit and lets it clean up. `SIGKILL` ends it at once, with no
cleanup. Platforms send `SIGTERM`, wait a grace period, then send `SIGKILL`.

A deploy replaces a running server. If the old process vanishes instantly, requests in flight fail,
half-written files stay half-written, and messages that were taken from a queue but not processed are lost.
So there are two ways to stop a process:

- <Term id="sigterm">`SIGTERM`</Term> is the polite request. The process can catch it and shut down
  cleanly. This is what `kill` sends by default.
- <Term id="sigkill">`SIGKILL`</Term> is the kernel ending the process. It cannot be caught, blocked or
  ignored. The process runs no more code. The kernel closes its files, but anything still in the program's
  own buffers is lost.

`SIGKILL` has to exist so that a buggy or hostile program can always be stopped. That is also why it cannot
be caught: a handler could refuse to die. `SIGSTOP` is uncatchable for the same reason.

### The shutdown sequence

`docker stop` sends `SIGTERM`, waits 10 seconds by default, then sends `SIGKILL`. Kubernetes does the same
with a default grace period of 30 seconds, and `systemd` with a configurable timeout. In that window, a
well-behaved server should:

1. **Stop taking new work.** Stop accepting connections, or fail its readiness check so the load balancer
   stops sending traffic.
2. **Finish the work in progress,** with a deadline shorter than the grace period.
3. **Flush and close:** write buffered logs, commit queue offsets, close database connections.
4. **Exit with code 0.**

### Try it: catching SIGTERM

This program "serves requests" in a loop until it gets `SIGTERM` or `SIGINT`. The handler only sets a flag.
The main loop sees the flag and shuts down in normal code.

```c
// graceful.c: gcc graceful.c -o graceful   (run it as shown below)
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

static volatile sig_atomic_t stop = 0;

static void on_term(int sig) { (void)sig; stop = 1; }   // only set a flag

int main(void) {
    struct sigaction sa;
    memset(&sa, 0, sizeof sa);
    sa.sa_handler = on_term;
    sigaction(SIGTERM, &sa, NULL);
    sigaction(SIGINT, &sa, NULL);

    int handled = 0;
    while (!stop) {
        usleep(100 * 1000);         // pretend to serve one request
        handled++;
    }
    // Back in normal code: safe to log, flush and close things.
    printf("stopping after %d requests\n", handled);
    return 0;
}
```

Run it in the background, then send each signal:

```text
$ ./graceful & sleep 1; kill -TERM $!; wait $!; echo "exit code $?"
stopping after 10 requests
exit code 0
$ ./graceful & sleep 1; kill -KILL $!; wait $!; echo "exit code $?"
Killed
exit code 137
```

With `SIGTERM`, the program ran its shutdown code and exited with 0. With `SIGKILL`, it ran nothing more,
and the shell reports 128 + 9 = 137.

## Writing signal handlers safely

**In short:** a handler can interrupt the program in the middle of anything, so it may only call a short list
of safe functions. The robust pattern is to turn the signal into an event that the main loop reads.

Suppose the main code is inside `malloc`, halfway through updating its lists of free memory, when a signal
arrives. The handler runs and calls `printf`, which calls `malloc`. Now `malloc` runs on half-updated data,
or waits for a lock that the interrupted code already holds. The program crashes or hangs. The bug appears
once in a million runs and is very hard to reproduce.

So POSIX lists the functions a handler may call. These are
<Term id="async-signal-safe">async-signal-safe</Term> functions: `write`, `read`, `_exit`, `kill`, `waitpid`
and a few dozen more. `printf`, `malloc`, `free`, and anything that takes a lock are not on the list. The
safest handler does one thing: set a flag of type `volatile sig_atomic_t`, as in the example above.

A flag works for a loop that wakes up often. A server that sleeps in `epoll_wait` or `poll` needs to be woken
up. There are three standard ways to turn a signal into something the event loop can wait on:

- **The self-pipe trick.** The program creates a pipe and watches its read end. The handler writes one byte
  into the pipe (`write` is safe). The event loop wakes, sees the pipe is readable, and handles the signal in
  normal code.
- **`signalfd` (Linux).** The program blocks the signals, then asks the kernel for a file descriptor that
  becomes readable when one of them arrives. There is no handler at all. Reading the descriptor says which
  signal came.
- **A dedicated signal thread.** Block the signals in every thread, and have one thread call `sigwait` in a
  loop. That thread receives signals as ordinary return values.

Event loops such as libuv (under Node.js), Python's `asyncio` and Tokio (Rust) use one of these internally.
[Chapter 12](/io/io-models) covers event loops.

```c
// sigfd.c: gcc sigfd.c -o sigfd && ./sigfd
#include <poll.h>
#include <signal.h>
#include <stdio.h>
#include <sys/signalfd.h>
#include <unistd.h>

int main(void) {
    sigset_t mask;
    sigemptyset(&mask);
    sigaddset(&mask, SIGTERM);
    sigprocmask(SIG_BLOCK, &mask, NULL);           // stop normal delivery
    int sfd = signalfd(-1, &mask, SFD_CLOEXEC);    // signals arrive here instead

    kill(getpid(), SIGTERM);                       // send ourselves SIGTERM

    struct pollfd p = { .fd = sfd, .events = POLLIN };
    poll(&p, 1, -1);                               // a server would use epoll here
    struct signalfd_siginfo si;
    read(sfd, &si, sizeof si);
    printf("got signal %u from pid %u\n", si.ssi_signo, si.ssi_pid);
    return 0;
}
```

Expected output:

```text
got signal 15 from pid 5016
```

::: details Going deeper: signalfd pitfalls
- The signals must be blocked in **every** thread. Otherwise the kernel may deliver them to a thread that
  does not block them, and `signalfd` never sees them. Block them in `main` before creating threads, because
  new threads inherit the mask.
- Blocked signals stay blocked across `exec`. A program that uses `signalfd` should unblock them in a child
  before calling `exec`, or the new program will never receive them.
- Like any standard signal, several identical signals may arrive as one read.
:::

## Process groups, sessions and the terminal

**In short:** processes are grouped into jobs (process groups), and jobs into login sessions. Ctrl-C signals
a whole job, and closing a terminal signals its whole session.

You run `cat big.log | grep error | less` and press Ctrl-C. All three processes stop, not only one. How does
the terminal know which processes to signal? The shell put all three in one
<Term id="process-group">process group</Term>: a set of processes that receive terminal signals together.
A process group is what the shell calls a **job**.

Process groups are gathered into a <Term id="session">session</Term>, which usually means one login or one
terminal window. The terminal attached to a session is its **controlling terminal**:

- At any time, one process group in the session is in the **foreground**. It can read from the terminal,
  and it receives `SIGINT` (Ctrl-C), `SIGQUIT` (Ctrl-\\) and `SIGTSTP` (Ctrl-Z).
- The other groups are in the **background**. If one of them tries to read from the terminal, the kernel
  stops it.
- When the terminal closes, for example when an SSH connection drops, the kernel sends `SIGHUP` to the
  session's leader, normally the shell. The shell then sends `SIGHUP` to its jobs.

This explains familiar habits. `nohup` makes a command ignore `SIGHUP` so it survives logout. `tmux` and
`screen` keep their own session alive with no terminal attached. A daemon calls `setsid` to start a new
session with no controlling terminal, so no terminal can signal it.

### Killing a group of processes

Process groups are also a tool. `kill(-pgid, SIGTERM)`, with a minus sign, sends the signal to every process
in the group. Test runners and the `timeout` command use this to stop a command together with every helper
process it started.

It is not airtight: a child can move itself into a new group or session and escape. For a guarantee, use a
<Term id="cgroup">cgroup</Term>, a kernel grouping of processes that no member can leave on its own.
`systemd` stops a service by killing every process in its cgroup. Container runtimes do the same for a
container.

::: details Going deeper: the IDs and the system calls
- Each process has a process group ID (PGID) and a session ID (SID). `ps -o pid,pgid,sid,tty,stat,comm` shows
  them. A group's leader is the process whose PID equals the PGID; the same goes for sessions.
- `setpgid` moves a process into a group. `setsid` creates a new session and group. A process group leader
  cannot call `setsid`, which is one reason daemons fork first.
- `tcsetpgrp` tells the terminal which group is in the foreground. Shells call it for `fg` and `bg`.
- Background reads get `SIGTTIN`. Background writes get `SIGTTOU` only if the terminal has the `tostop`
  setting on.
:::

## PID 1 and containers

**In short:** the first process in a container is PID 1, which the kernel treats specially. It ignores
signals it has no handler for, and it must reap orphans. Many programs were never written to do either.

A team puts a Node.js service in a container. `docker stop` takes 10 seconds every time, and the logs show
no shutdown. Another team's container slowly fills up with `<defunct>` processes. Both problems have the same
cause: which program runs as PID 1.

A container has its own set of PIDs, called a PID namespace. The first process started inside it gets PID 1
in that namespace. The kernel treats any <Term id="pid-1">PID 1</Term> in two special ways:

1. **No default signal actions.** A signal that PID 1 has no handler for is dropped, not acted on. This
   protects a normal system's init from being killed by accident. So if your program never installed a
   `SIGTERM` handler, `SIGTERM` does nothing. After the grace period, the platform sends `SIGKILL`, which
   works when sent from outside the container.
2. **It adopts orphans.** Every process in the container whose parent dies is reparented to PID 1. If PID 1
   never calls `wait`, those orphans stay zombies after they exit. This happens with programs that start
   helpers, such as a test runner launching browsers.

Many language runtimes do not install a `SIGTERM` handler by default; Node.js is a common example. As a
normal process, the default action would kill it. As PID 1, nothing happens.

### A shell in the middle

A second trap is the Dockerfile's shell form. `CMD python app.py` runs `/bin/sh -c "python app.py"`. Now
the shell may be PID 1, with Python as its child. `SIGTERM` goes to the shell, which does not pass it on,
and Python never hears about the shutdown. Some shells replace themselves with the command in this simple
case, but an entrypoint script with more than one line keeps the shell in place.

### The fixes

- **Use the exec form:** `CMD ["python", "app.py"]`. Your program is PID 1 with no shell in between.
- **In entrypoint scripts, end with `exec "$@"`** or `exec python app.py`. `exec` replaces the shell with
  your program, which keeps PID 1.
- **Handle `SIGTERM` explicitly** in the program, as in the shutdown example.
- **Run a tiny init as PID 1.** <Term id="tini">tini</Term> or `dumb-init` starts your program as a child,
  forwards signals to it, and reaps every zombie. `docker run --init` adds tini for you.

::: details Going deeper: exactly which signals reach PID 1
- The kernel marks a namespace's init as unkillable by signals it has not set up a handler for. Signals from
  **inside** the namespace are dropped, even `SIGKILL`. From the **parent** namespace (the host), `SIGKILL`
  and `SIGSTOP` are delivered; other unhandled signals are dropped.
- When PID 1 of a namespace exits, the kernel kills every other process in that namespace with `SIGKILL`. So
  the container ends when its first process ends.
- In Kubernetes, setting `shareProcessNamespace: true` on a pod makes a small `pause` process PID 1 for all
  containers in the pod, and it reaps zombies.
:::

## Why this matters in real systems

**Deploys that drop requests.** A service in Kubernetes ignores `SIGTERM`, or exits the moment it gets it.
Either way, requests fail during every rollout. The fix is a real shutdown path: stop accepting, drain,
exit. Kubernetes removes the pod from load balancers at about the same time as it sends `SIGTERM`, so the two
race. Many teams add a short sleep in a `preStop` hook so traffic stops arriving before the server stops
listening.

**Exit code 137.** A container restarts in a loop with exit code 137. That is 128 + 9: something sent
`SIGKILL`. Kubernetes shows `OOMKilled` if the memory limit was hit. Otherwise, the grace period may have run
out during shutdown. Code 143 means the process died from an unhandled `SIGTERM`.

**PyTorch data loaders and fork.** PyTorch's `DataLoader` starts worker processes, by default with `fork` on
Linux. If the parent has already used CUDA, workers that touch the GPU fail with "Cannot re-initialize CUDA
in forked subprocess". The fix is the `spawn` start method. Forked workers can also grow in memory over time:
Python updates reference counts inside objects, which writes to shared pages and triggers copy-on-write
copies. Storing the dataset in NumPy arrays instead of lists of Python objects avoids most of it.

**Starting tools from a large process.** A 40 GB service calls out to a small command-line tool. If that
uses a plain `fork`, every call copies large page tables, and it can fail under strict memory accounting.
Modern libc and language runtimes launch commands with `posix_spawn` or `vfork` where they can. Check what
yours does before writing your own launcher.

**Zombie build-up in CI.** A test container runs a test runner as PID 1. Each test starts a headless browser
that forks helper processes. The helpers are orphaned and never reaped. After a few thousand tests, the
container hits its PID limit and every `fork` fails. Running tini as PID 1 fixes it.

**How to look:**

```bash
ps -eo pid,ppid,pgid,sid,stat,comm   # parents, groups, sessions and states
ps -eLf                              # one line per thread
cat /proc/<pid>/status               # state, threads, blocked/caught signals
ls /proc/<pid>/task                  # the thread IDs of a process
strace -f -e trace=process ./prog    # every fork, clone, exec, wait and exit
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. What happens when you type ls in a shell and press Enter?
The shell calls `fork`. The kernel creates a child process as a copy of the shell, sharing memory with
copy-on-write. In the child, `fork` returns 0; the child sets up any redirections, then calls `exec` with the
path of `ls`. The kernel replaces the child's program with `ls`, keeping the PID and open files. Meanwhile
the parent calls `waitpid` and sleeps. When `ls` exits, it is a zombie until the shell's `waitpid` collects
its exit code. Then the shell prints the next prompt.

**Senior add-on:** the shell first searches `PATH` for `ls`. The child is put in its own process group, and
the shell makes that group the terminal's foreground group, so Ctrl-C reaches `ls` and not the shell. Some
shells use `vfork` instead of a plain `fork`.
:::

::: details 2. What is the difference between a process and a thread?
A process is a running program with its own address space, file table and signal handlers. A thread is one
line of execution inside a process. Threads of one process share memory and files. Each thread has only its
own registers, stack, signal mask and thread-local variables.

So threads are cheaper to create and switch between, and share data without copying. But they have no
isolation: one thread's bad memory write crashes the whole process, and shared data needs locks.

**Senior add-on:** on Linux both are tasks, created by `clone`, and the flags decide what is shared. A
"process" is a thread group. `getpid` returns the thread group ID, and `gettid` returns the task's own ID.
:::

::: details 3. Why does fork return twice? How do you tell parent and child apart?
`fork` creates a second process that is a copy of the first, including its position in the code. Both
processes then return from the same `fork` call. The return value differs: 0 in the child, the child's PID in
the parent, and -1 in the parent if it failed.

**Senior add-on:** the child gets a copy of everything in memory, including unflushed `stdio` buffers, which
is why output can appear twice. Only the calling thread is copied. A child that does not `exec` should end
with `_exit`.
:::

::: details 4. What is a zombie process? An orphan? How do you get rid of zombies?
A **zombie** has exited, but its parent has not collected its exit code with `wait`. The kernel has freed its
memory and files, and keeps only a small record with its PID and status.

An **orphan** is a running process whose parent has exited. The kernel reparents it to PID 1 or to a
subreaper, which will reap it when it exits.

You cannot kill a zombie, because it is already dead. You make the parent call `wait`, or kill the parent.
Then the zombie is orphaned, adopted by PID 1, and reaped.

**Senior add-on:** zombies are cheap but hold PIDs, so a leak eventually makes `fork` fail with `EAGAIN`.
Reap in a `SIGCHLD` handler with a `waitpid(-1, …, WNOHANG)` loop, because signals do not queue. In
containers, the usual cause is a PID 1 that does not reap. Use tini.
:::

::: details 5. What is the difference between SIGTERM and SIGKILL? How should a service shut down?
`SIGTERM` is a request to exit. The program can catch it, finish its work and exit cleanly. `SIGKILL` is
enforced by the kernel. It cannot be caught, blocked or ignored, and the process runs no more code.

On `SIGTERM`, a service should stop accepting new work, finish in-flight work within a deadline, flush and
close resources, and exit 0. Platforms send `SIGTERM`, wait a grace period (10 s for Docker, 30 s by default
in Kubernetes), then send `SIGKILL`.

**Senior add-on:** `SIGKILL` cannot take effect while a task is in uninterruptible sleep (`D`); it applies when
the task wakes. Exit codes 143 and 137 are 128 + 15 and 128 + 9. In Kubernetes, add a `preStop` delay,
because endpoint removal races with `SIGTERM`.
:::

::: details 6. Why can't you call printf inside a signal handler? What do you do instead?
A signal can interrupt the program at any instruction, including inside `printf` or `malloc` while they hold
a lock or have data half-updated. If the handler calls them again, it can deadlock or corrupt memory. Only
async-signal-safe functions, such as `write` and `_exit`, are allowed.

Instead, set a `volatile sig_atomic_t` flag and act on it in the main loop. For event loops, write a byte to
a pipe (the self-pipe trick), use `signalfd` on Linux, or block signals and use a dedicated `sigwait` thread.

**Senior add-on:** `signalfd` only works if the signals are blocked in every thread, and blocked signals
survive `exec`, so children must unblock them. Handlers also cause `EINTR` on slow system calls unless
`SA_RESTART` is set.
:::

::: details 7. Why do large or multithreaded programs avoid fork? What do they use instead?
For a large process, `fork` must copy the page tables, which can pause it for tens to hundreds of
milliseconds. Under strict memory accounting, it may fail, because the kernel must be able to back a full
second copy. Afterwards, writes cause many copy-on-write faults.

For a multithreaded process, only the calling thread exists in the child. Locks held by other threads stay
locked forever, so the child can hang in any library call.

They use `posix_spawn`, or `vfork` followed at once by `exec`. Both borrow the parent's memory instead of
copying it.

**Senior add-on:** glibc's `posix_spawn` uses `clone(CLONE_VM | CLONE_VFORK)` since 2.24. Python 3.14 moved
`multiprocessing` on Linux from `fork` to `forkserver` by default.
:::

::: details 8. Your service in a container takes 10 seconds to stop and never logs its shutdown. Why?
`docker stop` sent `SIGTERM`, nothing happened, and after 10 seconds it sent `SIGKILL`. Likely causes:

1. The program is PID 1 and has no `SIGTERM` handler. The kernel drops unhandled signals to PID 1, so the
   default "terminate" never happens.
2. A shell is PID 1 (shell-form `CMD`, or an entrypoint script without `exec`), and it does not forward the
   signal to the program.

Fixes: use the exec form of `CMD`, end entrypoint scripts with `exec`, handle `SIGTERM` in the program, or run
tini (`docker run --init`) as PID 1.

**Senior add-on:** from the host, only `SIGKILL` and `SIGSTOP` are forced on a namespace's PID 1. A PID 1 that
does not reap also collects zombies. The `SigCgt` line in `/proc/<pid>/status` shows which signals have a
handler installed.
:::

::: details 9. How does Linux implement threads?
As tasks, the same as processes. Each thread has its own `task_struct` and is scheduled independently.
`pthread_create` calls `clone` with flags that make the new task share the address space, file table, signal
handlers and thread group with its creator. `fork` is `clone` without those flags.

**Senior add-on:** the thread group ID is what `getpid` returns; the per-task ID is the TID. Threads appear
under `/proc/<pid>/task`. `CLONE_CHILD_CLEARTID` plus a futex lets `pthread_join` sleep until the thread
exits. Container runtimes use other clone flags to create namespaces.
:::

::: details 10. Ctrl-C stops a whole pipeline. How does the terminal know which processes to signal?
The shell puts each pipeline in its own process group and tells the terminal which group is in the
foreground. When you press Ctrl-C, the terminal driver in the kernel sends `SIGINT` to every process in the
foreground group. Process groups live inside a session, usually one per terminal.

**Senior add-on:** closing the terminal sends `SIGHUP` to the session leader, and the shell forwards it to its
jobs. That is why long-running jobs need `nohup`, `tmux` or `setsid`. `kill(-pgid, sig)` signals a whole
group, but a child can escape with `setsid`. cgroups are the reliable way to kill a whole tree.
:::

::: details 11. A process is in state D and kill -9 does nothing. What is going on?
`D` is uninterruptible sleep. The task is inside a kernel operation, usually disk or network file system I/O,
that cannot be safely abandoned. Signals, including `SIGKILL`, stay pending until it finishes. So the process
dies only when the I/O completes or fails.

Look at what it is waiting on: `cat /proc/<pid>/stack` (as root) or the `wchan` column in `ps`. Common causes
are a hung NFS server, a failing disk, or a stuck device driver.

**Senior add-on:** Linux counts `D` tasks in the load average, so load can be high while CPUs are idle. Some
waits use `TASK_KILLABLE`, which fatal signals can interrupt.
:::

## Common misconceptions

- **"fork copies all of the parent's memory."** It copies page tables and marks pages copy-on-write. Data is
  copied only when written.
- **"You can kill a zombie."** It is already dead. You reap it through its parent.
- **"kill sends SIGKILL."** `kill` sends `SIGTERM` by default. `kill -9` sends `SIGKILL`.
- **"Linux has separate process and thread objects."** It has tasks. Threads are tasks that share memory,
  files and handlers.
- **"A signal takes effect the moment it is sent."** It is marked pending. The target acts on it when it
  next returns to user mode, or later if it blocks the signal or is in `D` state.
- **"Every process dies on SIGTERM by default."** A PID 1 without a handler ignores it.

## Key takeaways

- A **process** is a running program with its own memory and files. A **thread** is a line of execution
  inside it. Threads share memory and files; on Linux both are **tasks** created with `clone`.
- Unix starts programs with **fork, exec, wait**. The gap between `fork` and `exec` is where shells set up
  redirection. Large or multithreaded programs use **`posix_spawn`** or `vfork` instead.
- An exited child is a **zombie** until its parent calls `wait`. Orphans are **reparented** to PID 1 or a
  subreaper.
- **SIGTERM** asks, **SIGKILL** forces. Handle `SIGTERM` with a flag, a self-pipe or `signalfd`, and never do
  real work inside a handler. Exit code **128 + N** means "killed by signal N".
- In containers, **PID 1** ignores signals it has no handler for, and must reap orphans. Use the exec form,
  `exec`, or **tini**.

## Review

<Flashcards id="processes-and-threads" :cards="cards" />

<MarkDone id="processes-and-threads" />
