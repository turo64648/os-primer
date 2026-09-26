---
title: 17. Security & Isolation
---

<script setup>
import { cards } from './security-review'
</script>

# 17. Security & Isolation

An operating system keeps users, programs and tenants from harming each other with several independent
layers of protection. Interviewers
probe these layers because every sandbox, container platform and cloud relies on them, and because the CPU
flaws of 2018 changed what a system call costs.

::: info Before you start
- The <Term id="kernel">kernel</Term> runs in a privileged CPU mode. Programs run in
  <Term id="user-mode">user mode</Term> and ask the kernel for everything through
  <Term id="syscall">system calls</Term>.
- Each <Term id="process">process</Term> has its own <Term id="address-space">address space</Term>: a private
  view of memory. The kernel is mapped into every address space, in a part user code cannot touch.
- A CPU keeps recently used memory in small, fast **caches**. Reading cached data is much faster than reading
  RAM.

[Chapter 1](/foundations/what-is-an-os) and [Chapter 4](/memory/virtual-memory) explain these in full. You
can follow this chapter without them.
:::

## What isolation has to achieve

**In short:** the OS must keep users away from each other's data, keep processes from taking over the
kernel, and, on shared machines, keep tenants from even observing each other.

Think of a shared GPU server running jobs from several teams, or a cloud host running containers from
different customers. Several things could go wrong:

- One user reads another user's files or model weights.
- A compromised web server uses its access to take over the whole machine.
- A bug in one program lets an attacker run their own code inside it.
- Code on one tenant's virtual machine measures timing and learns another tenant's secret keys.

No single mechanism stops all of these. Linux stacks several layers, each covering a different gap. A system
call has to pass all of them before the kernel does any work:

<SyscallChecksDiagram />

The rest of this chapter goes through the layers, from the oldest and simplest to the newest. It ends with
protections against memory bugs, and the CPU flaws that forced changes to the kernel itself.

## Users, groups and permissions

**In short:** every process runs as a user ID. Files record an owner and read, write and execute bits for
owner, group and everyone else. User 0, root, bypasses these checks.

Every process carries a <Term id="uid">user ID (UID)</Term>, a number such as 1000, and a list of group IDs.
Every file records an owning user, an owning group, and nine permission bits:

```text
$ ls -l /etc/shadow /usr/bin/passwd
-rw-r----- 1 root shadow   652 Mar 31 13:31 /etc/shadow
-rwsr-xr-x 1 root root   64152 May 30  2024 /usr/bin/passwd
```

The bits come in three groups of `rwx` (read, write, execute): for the owner, for the group, and for everyone
else. `/etc/shadow`, which holds password hashes, can be read and written by root, read by the `shadow` group,
and not touched by anyone else. When a process opens a file, the kernel compares the process's IDs with the
file's owner and group, and checks the matching bits.

User ID 0 is <Term id="root">root</Term>. For most checks, the kernel lets root through without looking at
the bits. That is simple, and also dangerous: a process running as root that gets compromised can do almost
anything.

### setuid programs

`passwd` changes your password, which means writing `/etc/shadow`. But you are not root. How does it work?
Look at its bits: `rwsr-xr-x`. The `s` is the **setuid** bit. When you `exec` a setuid program, your new
process takes the **file owner's** user ID, here root, for as long as that program runs.

This is powerful and risky. Every setuid-root program is a door into root. A bug in one, such as a buffer
overflow, gives an attacker root. Hardened systems keep very few setuid programs, and the rest of this chapter
shows ways to give out less than full root.

::: details Going deeper: real, effective and saved IDs
- A process has a **real** UID (who started it), an **effective** UID (used for permission checks) and a
  **saved** UID (so a setuid program can drop privilege and later take it back). A setuid program runs with
  effective UID 0 and real UID of the caller.
- Directories use the same bits differently: `r` lists names, `w` creates and deletes entries, `x` allows
  entering the directory and using names inside it.
- The **sticky bit** on `/tmp` (`drwxrwxrwt`) lets users delete only their own files there.
- **Access control lists** (`getfacl`, `setfacl`) add permissions for specific extra users and groups.
- The permission check happens at `open`. A process that already holds an open file descriptor keeps its
  access even if the file's permissions change later.
:::

## Capabilities: splitting root into pieces

**In short:** Linux splits root's powers into about 40 separate capabilities. A process can hold only the
ones it needs, such as binding to port 80, instead of full root.

A web server needs to listen on port 80. Ports below 1024 are privileged, so traditionally the server started
as root. But root can also read every file, load kernel modules and change any process. The web server needs
none of that.

<Term id="capability">Capabilities</Term> fix this. Linux divides root's special powers into about 40 named
capabilities. The kernel checks for the specific capability instead of "is this root?". Some examples:

- `CAP_NET_BIND_SERVICE`: bind to ports below 1024.
- `CAP_NET_ADMIN`: configure network interfaces, firewall rules and routes.
- `CAP_SYS_PTRACE`: inspect and control other users' processes (debuggers).
- `CAP_DAC_OVERRIDE`: ignore file permission bits.
- `CAP_SYS_ADMIN`: a large grab bag, including mounting file systems. It is so broad that people call it
  "the new root".

A process running as root normally holds all capabilities. A process can drop the ones it does not need, and
they cannot come back. A program file can also carry capabilities (`setcap`), a narrower replacement for the
setuid bit.

### Try it: port 80 without root

Here a Python one-liner runs as the unprivileged user `nobody` (UID 65534). First with no capabilities, then
with only `CAP_NET_BIND_SERVICE`. The `setpriv` tool changes user and capabilities, then runs the command.

```text
$ setpriv --reuid=65534 --regid=65534 --clear-groups \
    python3 -c 'import socket; socket.socket().bind(("127.0.0.1", 80)); print("bound port 80")'
PermissionError: [Errno 13] Permission denied

$ setpriv --reuid=65534 --regid=65534 --clear-groups \
    --inh-caps=+net_bind_service --ambient-caps=+net_bind_service \
    python3 -c 'import socket; socket.socket().bind(("127.0.0.1", 80)); print("bound port 80")'
bound port 80
```

The second process is not root and cannot read `/etc/shadow`. It holds exactly one extra power.

### Capabilities in containers

Docker starts containers with a small default set of about 14 capabilities, such as `CAP_CHOWN` and
`CAP_NET_BIND_SERVICE`. `CAP_SYS_ADMIN` and most others are dropped. `docker run --cap-drop=ALL` removes even
those; `--cap-add` adds specific ones back. `--privileged` gives the container every capability and disables
most other protections. A privileged container is close to root on the host.

::: details Going deeper: capability sets and no_new_privs
- Each process has several capability sets. **Effective**: what the kernel checks now. **Permitted**: what it
  may make effective. **Bounding**: an upper limit that `exec` can never exceed. **Inheritable** and
  **ambient**: what survives `exec` of a normal program. Ambient capabilities (Linux 4.3) made the demo above
  possible.
- `grep Cap /proc/<pid>/status` shows the sets as bitmasks; `capsh --decode=<mask>` names them. In the demo,
  the masks were `0x400`: bit 10, `CAP_NET_BIND_SERVICE`.
- `prctl(PR_SET_NO_NEW_PRIVS, 1)` promises that no later `exec` can gain privileges: setuid bits and file
  capabilities are ignored. It is inherited and cannot be undone. `docker run --security-opt
  no-new-privileges` sets it.
- The privileged-port rule can also be relaxed system-wide with `net.ipv4.ip_unprivileged_port_start`.
:::

## Security modules: rules even root must follow

**In short:** Linux Security Modules such as SELinux and AppArmor add a policy, written by an administrator,
that the kernel enforces on every process, including root.

Permissions and capabilities are **discretionary**: the owner of a file decides who may use it, and root may
override. A compromised root process can therefore do anything. Some systems need rules that no process can
override, for example "the web server may read only `/var/www`, whatever user it runs as".

That is **mandatory access control**. Linux implements it with <Term id="lsm">Linux Security Modules
(LSMs)</Term>: hooks at hundreds of points in the kernel where a module can say no.

- **SELinux** (Red Hat, Fedora, Android) labels every process and file with a type, and a policy lists which
  types may do what to which.
- **AppArmor** (Ubuntu, Debian, SUSE) attaches a profile to a program, listing the paths and operations it may
  use.
- **Landlock** (Linux 5.13) lets an unprivileged program restrict itself, for example to a few directories.

Container runtimes apply a default AppArmor or SELinux policy to every container. When something fails with
"Permission denied" even for root, a security module is a common reason. Its log (`dmesg`, `ausearch`, or
`journalctl`) shows the denial.

## seccomp: filtering system calls

**In short:** seccomp lets a process install a filter that checks every system call it makes, and refuses the
ones it should never need. This shrinks the kernel code an attacker can reach.

Linux has several hundred system calls. A typical web server uses a few dozen. Every other system call is
kernel code that an attacker who takes over the server could call, and some of that code has bugs. Many
serious kernel vulnerabilities were reached through system calls that ordinary programs never use.

<Term id="seccomp">seccomp</Term> ("secure computing") lets a process install a filter on its own system
calls. On every system call, the kernel runs the filter before anything else. The filter sees the system call
number and the raw argument values, and returns a verdict:

- **Allow** the call.
- **Fail it** with an error code, such as `EPERM`, without running it.
- **Kill** the thread or process.
- **Notify** a supervising process, which decides (used by container runtimes).

A filter, once installed, can never be removed or loosened. It is inherited by children and kept across
`exec`. So a program can set up, lock itself down, and then run untrusted input.

### Try it: a tiny seccomp filter

Filters are small programs in <Term id="bpf">BPF</Term>, a simple instruction set that the kernel can check
and run safely. This one makes `mkdir` fail and allows everything else:

```c
// sandbox.c: gcc sandbox.c -o sandbox && ./sandbox   (x86-64 only)
#include <errno.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <stddef.h>
#include <stdio.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <unistd.h>

int main(void) {
    struct sock_filter filter[] = {
        // Refuse to run if this is not an x86-64 system call.
        BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch)),
        BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, AUDIT_ARCH_X86_64, 1, 0),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL_PROCESS),
        // Load the system call number. If it is mkdir, fail it with EPERM.
        BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
        BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_mkdir, 0, 1),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | EPERM),
        // Everything else is allowed.
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
    };
    struct sock_fprog prog = { sizeof filter / sizeof filter[0], filter };

    prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0);          // required to install a filter without root
    if (prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &prog) != 0) { perror("seccomp"); return 1; }

    if (mkdir("/tmp/sandbox-test", 0755) != 0) perror("mkdir");
    printf("still running, pid %d\n", getpid());
    return 0;
}
```

Expected output:

```text
mkdir: Operation not permitted
still running, pid 7909
```

This toy filter shows a classic mistake. It blocks `mkdir` but not `mkdirat`, which does the same thing. A
list of forbidden calls always misses something. Real profiles are **allow lists**: permit what the program
needs, refuse everything else. Nobody writes BPF by hand for that; `libseccomp` or the container runtime
generates it.

### Where seccomp is used

- **Docker and Kubernetes** apply a default profile that refuses several dozen rarely needed system calls,
  such as those for loading kernel modules, rebooting and changing the clock. Kubernetes applies it when a pod
  sets `seccompProfile: RuntimeDefault`.
- **Browsers** (Chrome, Firefox) put their renderer processes, which parse untrusted web pages, behind strict
  filters.
- **Android** applies a filter to every app.
- **systemd** services can set `SystemCallFilter=` in their unit files.

::: details Going deeper: limits and costs
- A filter sees argument **values**, not memory they point to. It cannot filter `open` by path, because
  another thread could change the path after the check. Path rules belong to LSMs or Landlock.
- The architecture check matters. On x86-64, a process can also make 32-bit system calls, which use
  different numbers. Without the check, an attacker could use those numbers to slip past the filter.
- `grep Seccomp /proc/<pid>/status` shows the mode: 0 none, 1 strict, 2 filter.
- **Strict mode**, the original 2005 version, allows only `read`, `write`, `_exit` and `sigreturn`.
- Running a filter costs a little on every system call, usually small next to the call itself. The kernel
  compiles the BPF to machine code, and can cache "always allow" answers for common calls.
- `SECCOMP_RET_USER_NOTIF` (Linux 5.0) passes a call to a supervisor process, which can perform it on the
  caller's behalf. Container tools use it to allow selected operations safely.
:::

## Memory bugs and the defences against them

**In short:** a buffer overflow lets attacker data overwrite a function's return address. Non-executable
memory, address randomisation and stack canaries each block one step of turning that into running
attacker code.

C and C++ do not check array bounds. Consider:

```c
void greet(const char *name) {
    char buf[16];
    strcpy(buf, name);     // copies until the end of name, however long
    ...
}
```

If `name` is longer than 16 bytes, `strcpy` keeps writing past the end of `buf`. What lies there? The
function's **stack frame**. When a function is called, the CPU stores the **return address**: where to continue
when the function finishes. It sits on the stack, directly above the function's local variables.

<StackSmashDiagram />

This is a <Term id="buffer-overflow">buffer overflow</Term>. An attacker who controls `name` controls what
overwrites the return address. When `greet` returns, the CPU jumps wherever the attacker chose. The classic
attack put machine code in the buffer itself and pointed the return address at it.

Modern systems block this with several defences. Each stops a different step.

### Non-executable memory

The classic attack runs code from the stack. But the stack only holds data. So the CPU's page tables mark
memory pages as executable or not, and the OS marks the stack, the heap and data as **not executable**. This
is <Term id="nx">NX</Term> (no-execute; Windows calls it DEP). A jump into the stack now causes a fault
instead of running the attacker's code.

The general rule is **W^X**: a page may be writable or executable, never both. Code is read-only; data is not
executable. [Chapter 3](/foundations/linking-and-loading) showed the result: the `GNU_STACK` header asks for
a non-executable stack.

Attackers adapted. If they cannot add new code, they reuse code that is already there. They find short
instruction sequences that end in a return, called "gadgets", inside the program and its libraries. They
chain them by writing a list of return addresses on the stack. This is
<Term id="rop">return-oriented programming (ROP)</Term>. It needs one thing: the addresses of those gadgets.

### Address space layout randomisation

So hide the addresses. With <Term id="aslr">address space layout randomisation (ASLR)</Term>, the kernel
places the program, its libraries, the heap and the stack at random addresses on every run:

```c
// aslr.c: gcc aslr.c -o aslr && ./aslr && ./aslr
#include <stdio.h>
#include <stdlib.h>

int global;

int main(void) {
    int local;
    void *heap = malloc(16);
    printf("code  %p   global %p   heap %p   libc %p   stack %p\n",
           (void *)main, (void *)&global, heap, (void *)printf, (void *)&local);
    return 0;
}
```

```text
$ ./aslr && ./aslr
code  0x55b758fc2179   global 0x55b758fc5014   heap 0x55b780db72a0   libc 0x7f38b8860100   stack 0x7fffa80fb26c
code  0x555a7c16e179   global 0x555a7c171014   heap 0x555ab58222a0   libc 0x7f5f29460100   stack 0x7fff97535fdc
$ setarch -R ./aslr      # run with randomisation turned off
code  0x555555555179   global 0x555555558014   heap 0x5555555592a0   libc 0x7ffff7c60100   stack 0x7fffffffca0c
```

Every address changes between runs. Notice that the last three hex digits stay the same (`179`, `014`,
`100`): randomisation moves whole pages, so the offset inside a page is fixed.

ASLR is not a wall; it is a secret. An attacker who learns **one** address, through an information leak
bug, can often work out the rest, because everything inside one library moves together. Most real exploits
therefore chain two bugs: one to leak an address and one to take control. The kernel randomises its own
location too (KASLR).

### Stack canaries

A third defence detects the overflow itself. The compiler places a random value, the
<Term id="stack-canary">stack canary</Term>, between the local buffers and the return address. Before the
function returns, it checks the value. An overflow that reaches the return address must overwrite the canary
first. If the canary changed, the program aborts before jumping anywhere.

```c
// canary.c: gcc -O0 -fstack-protector-strong canary.c -o canary && ./canary
#include <stdio.h>
#include <string.h>

static void greet(const char *name) {
    char buf[16];
    strcpy(buf, name);                 // no length check: the bug
    printf("hello, %s\n", buf);
}

int main(void) {
    greet("Ada");
    greet("a name much longer than sixteen bytes, overwriting the stack");
    printf("not reached\n");
    return 0;
}
```

Expected output:

```text
hello, Ada
hello, a name much longer than sixteen bytes, overwriting the stack
*** stack smashing detected ***: terminated
Aborted
```

The overflow still happened, and the second `printf` ran, but the function never returned to a corrupted
address. Built with `-fno-stack-protector`, the same program crashed with a segmentation fault instead: it
jumped to an address made of text. With attacker-chosen input, that jump could have gone somewhere useful to
the attacker.

| Defence | What it stops | How attackers get around it |
|---|---|---|
| NX (W^X) | Running injected code from data pages | Reuse existing code (ROP) |
| ASLR | Knowing where code and data are | Leak an address with a second bug |
| Stack canary | Overwriting the return address unnoticed | Leak the canary, or overwrite something else (function pointers, heap data) |
| Full RELRO | Overwriting library call addresses in the GOT | Target other writable pointers |

::: details Going deeper: newer defences
- **Control-flow integrity.** Intel CET adds a **shadow stack**: a second, protected copy of return
  addresses that the CPU compares on each return. It also adds **indirect branch tracking**, which only allows
  indirect jumps to marked instructions. Linux supports user-space shadow stacks since 6.6. ARM has **pointer authentication**
  (a signature inside pointers) and **BTI**.
- **Memory tagging** (ARM MTE) gives memory and pointers small matching tags, catching many out-of-bounds
  and use-after-free accesses in hardware.
- `-D_FORTIFY_SOURCE` makes the compiler replace calls like `memcpy` and `strcpy` with checked versions when
  it knows the buffer size.
- The canary comes from random bytes the kernel supplies at `exec`. On x86-64 glibc stores it at `%fs:0x28`.
  Its lowest byte is zero, so string functions cannot copy it out.
- `/proc/sys/kernel/randomize_va_space` is 2 on most systems: randomise everything, including the heap. On
  x86-64, libraries get about 28 bits of randomness by default.
- The strongest fix is removing the bug class: memory-safe languages such as Rust, Go and Java do not allow
  out-of-bounds writes. Android, Chrome and the Linux kernel are adding Rust code for this reason.
:::

## Speculative execution attacks: Meltdown and Spectre

**In short:** CPUs run instructions ahead of time and throw away wrong guesses. Those guesses leave traces in
the cache, which a program can measure to read memory it should not see.

To be fast, a CPU does not wait for each instruction to finish before starting the next. When it reaches an
`if` whose condition is not known yet, it guesses the answer and keeps going. This is
<Term id="speculative-execution">speculative execution</Term>. If the guess was wrong, it throws away the
results, and the program behaves as if nothing happened. For decades, that was considered safe.

In January 2018, researchers showed it is not. The results are thrown away, but the **cache** is not rolled
back. Data loaded during speculation stays in the cache, and a program can tell which data is cached by
timing how long a read takes. That turns speculation into a <Term id="side-channel">side channel</Term>: a
way to learn secrets from timing, not from reading them directly.

<SpeculationLeakDiagram />

The attacker cannot read the secret byte directly. But they can make the CPU use it, during speculation, to
pick which of 256 memory locations to load. Afterwards, one of those 256 locations is cached. Timing reveals
which one, and so the secret's value. Repeat for every byte. Reading secrets this way takes many attempts,
but it works: the original papers read kernel memory at kilobytes per second or more.

### Meltdown

<Term id="meltdown">Meltdown</Term> affected mostly Intel CPUs, and a few others. The kernel is mapped into
every process, protected only by a permission check on each page. On affected CPUs, a user-mode load from
kernel memory would fetch the data and pass it on to later instructions **before** the permission check
stopped it. The load then failed, but the data had already left a trace in the cache. Any program could read
all kernel memory, and through it, other processes' data.

The fix is <Term id="kpti">kernel page-table isolation (KPTI)</Term>. While user code runs, the kernel's
memory is not mapped at all, apart from a tiny entry area. Nothing mapped, nothing to read speculatively. The
cost: every system call, interrupt and exception must switch page tables on entry and exit
([Chapter 1](/foundations/what-is-an-os)). CPUs designed after 2018 check permissions before forwarding data,
and Linux turns KPTI off on them.

### Spectre

<Term id="spectre">Spectre</Term> is a family of attacks that affects almost all modern CPUs, from Intel, AMD
and ARM. Instead of breaking a permission check, it tricks a program into speculatively running its own code
the wrong way. There are two original variants:

- **Variant 1 (bounds check bypass).** Code checks `if (i < size)` before reading `array[i]`. The attacker
  trains the branch predictor with valid values of `i`, then passes a huge one. The CPU guesses "in bounds",
  speculatively reads far outside the array, and leaks the value through the cache. This matters wherever
  one program runs code or data from another: a browser running a web page's JavaScript, or a kernel acting on
  system call arguments.
- **Variant 2 (branch target injection).** The CPU also predicts the target of indirect jumps, such as calls
  through function pointers. An attacker trains the predictor so that the kernel, or another process,
  speculatively jumps to a gadget the attacker chose.

Spectre has no single fix, because speculation is how CPUs are fast. The defences are spread out:

- **In code:** after sensitive bounds checks, the kernel clamps the index so even speculation stays in bounds.
- **Retpolines:** a compiler technique that replaces indirect jumps with a sequence the CPU cannot mispredict
  into attacker-chosen targets.
- **CPU features and microcode:** controls to limit or flush branch prediction (IBRS, IBPB, eIBRS), added by
  microcode updates and in newer CPUs.
- **Isolation:** browsers put each site in its own process and made their timers less precise. Clouds avoid
  running two tenants on the two hardware threads of one core.

Many more variants followed: L1TF (Foreshadow), MDS, Retbleed, Downfall, Inception and others. Each got
kernel changes, microcode updates, or both. The kernel reports what applies to the machine:

```text
$ grep . /sys/devices/system/cpu/vulnerabilities/*
/sys/devices/system/cpu/vulnerabilities/l1tf:Not affected
/sys/devices/system/cpu/vulnerabilities/mds:Not affected
/sys/devices/system/cpu/vulnerabilities/meltdown:Not affected
/sys/devices/system/cpu/vulnerabilities/retbleed:Mitigation: Enhanced IBRS
/sys/devices/system/cpu/vulnerabilities/spec_store_bypass:Mitigation: Speculative Store Bypass disabled via prctl
/sys/devices/system/cpu/vulnerabilities/spectre_v1:Mitigation: usercopy/swapgs barriers and __user pointer sanitization
/sys/devices/system/cpu/vulnerabilities/spectre_v2:Mitigation: Enhanced / Automatic IBRS; IBPB: conditional; ...
```

(Trimmed.) This recent Intel server CPU is not affected by Meltdown, so KPTI is off. It still needs Spectre
protections.

## Why system calls got more expensive

**In short:** the fixes for Meltdown and Spectre add work to every entry into and exit from the kernel. On
affected machines, programs that make many system calls got noticeably slower.

[Chapter 1](/foundations/what-is-an-os) showed that a trivial system call costs roughly 100 nanoseconds. After
2018, several fixes added to that, on CPUs that needed them:

- **KPTI** switches page tables on every kernel entry and exit. Without tagged TLB entries (PCID), each switch
  also throws away cached address translations ([Chapter 4](/memory/virtual-memory)).
- **Retpolines and branch-predictor controls** make indirect calls inside the kernel slower, and may flush
  predictor state on entry.
- **Buffer clearing** for MDS-style flaws runs an extra instruction to clear internal CPU buffers when
  returning to user mode.

The effect depends on how often a program enters the kernel. Pure computation barely changed. Workloads that
make hundreds of thousands of system calls per second per core, such as databases, proxies, and servers with
many small reads and writes, lost a noticeable share of throughput on affected hardware. Reported slowdowns
ranged from a few percent to tens of percent for the most system-call-heavy benchmarks.

Three things followed. Newer CPUs fixed the worst flaws in hardware, which made KPTI unnecessary on them. PCID
made KPTI's page-table switches much cheaper. And software moved further towards making fewer system calls:
batching, `io_uring`, and bypassing the kernel ([Chapter 1](/foundations/what-is-an-os)).

::: warning mitigations=off
Booting with `mitigations=off` removes most of these costs. It is only reasonable on a machine where every
program is trusted, such as a dedicated benchmark or HPC node with no untrusted code and no other tenants.
Never on shared hosts, and never on machines that run code from the internet, which includes browsers.
:::

## Putting the layers together: containers and sandboxes

**In short:** a container is ordinary processes, restricted by every layer in this chapter plus namespaces
and cgroups. For untrusted code, add a stronger boundary such as gVisor or a lightweight VM.

A container shares the host's kernel. [Chapter 18](/systems/virtualization) explains the two features that
make it look like a separate machine: <Term id="namespace">namespaces</Term>, which give it its own view of
processes, files and network, and <Term id="cgroup">cgroups</Term>, which limit its resources. Namespaces
control what a process can **see**. The layers in this chapter control what it can **do**.

A reasonable hardening checklist for a container:

- **Run as a non-root user** inside the container, and use a user namespace so root inside is unprivileged
  outside.
- **Drop all capabilities** and add back only what is needed. Never use `--privileged` for application code.
- **Set no-new-privileges**, so setuid binaries inside cannot raise privilege.
- **Keep a seccomp profile** (the runtime default at least) and an AppArmor or SELinux profile.
- **Use a read-only root filesystem** where possible.

All of this still shares one kernel. One kernel bug reachable from inside the container can break all of it.
For code you do not trust at all, such as customer workloads or code written by an AI agent, platforms add a
boundary with a much smaller attack surface. gVisor handles system calls in a user-mode kernel. Firecracker
and Kata run each workload in a lightweight virtual machine ([Chapter 18](/systems/virtualization)).

## Why this matters in real systems

**Container escapes through configuration.** Most real container escapes do not need a kernel bug. A container
runs with `--privileged`, or with `CAP_SYS_ADMIN`, or with the Docker socket (`/var/run/docker.sock`) mounted
inside. Any of these lets code in the container control the host. Auditing for them is one of the first steps
in a security review.

**Running untrusted code for AI products.** Code interpreters, agent tools and notebook services run code that
neither the platform nor the user wrote. These services use gVisor, Firecracker-style microVMs or strict
seccomp sandboxes, with no network by default, instead of plain containers.

**Loading model files.** Python's `pickle` format, used by older PyTorch checkpoints, can run arbitrary code
when loaded. Loading a model from an untrusted source is running untrusted code. Formats such as
`safetensors` store only data, and recent PyTorch versions default to loading only tensor data.

**Performance regressions after patching.** A kernel or microcode update adds a new CPU-flaw mitigation, and a
system-call-heavy service slows down. Checking `/sys/devices/system/cpu/vulnerabilities/` before and after, and
counting system calls with `perf trace -s`, explains it. The fix is usually fewer system calls, not turning
protections off.

**JIT compilers and W^X.** JavaScript engines, the JVM and PyTorch's compilers write machine code at run time,
which conflicts with W^X. They switch pages between writable and executable, or map the same memory twice
with different permissions. Hardened environments may block this, which breaks JIT-based runtimes in
surprising ways.

**Binding low ports.** A service is run as root only to bind port 443. Giving it `CAP_NET_BIND_SERVICE`, or
letting a load balancer or systemd socket activation own the port, removes the need for root.

**How to look:**

```bash
id                                           # user and groups of this shell
grep -E 'Cap|Seccomp|NoNewPrivs' /proc/<pid>/status   # capabilities, seccomp mode, no_new_privs
getcap -r /usr/bin 2>/dev/null               # programs with file capabilities
find / -perm -4000 -type f 2>/dev/null       # setuid programs
grep . /sys/devices/system/cpu/vulnerabilities/*   # CPU flaws and active mitigations
cat /proc/sys/kernel/randomize_va_space      # ASLR mode (2 = full)
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. What is a setuid program, and why is it risky?
A setuid program has a special bit on its file. When someone runs it, the process takes the file owner's user
ID, often root, instead of the caller's. `passwd` uses this to update the password file.

It is risky because any bug in the program, such as a buffer overflow or unsafe handling of environment
variables, gives the attacker the owner's privileges, usually root.

**Senior add-on:** the loader ignores `LD_PRELOAD` and similar variables for setuid programs for this reason.
Safer options are file capabilities (`setcap`) that grant one power, a small privileged helper daemon, or
`no_new_privs`, which makes setuid bits ineffective for a process tree.
:::

::: details 2. What are Linux capabilities? Give examples.
They split root's powers into about 40 separate privileges, checked individually by the kernel. A process can
hold only the ones it needs. Examples: `CAP_NET_BIND_SERVICE` to bind ports below 1024, `CAP_NET_ADMIN` to
configure networking, `CAP_SYS_PTRACE` to debug other processes, `CAP_SYS_ADMIN` for mounting and much more.

**Senior add-on:** `CAP_SYS_ADMIN` is so broad it is nearly root. There are several sets per process
(effective, permitted, bounding, inheritable, ambient). Docker keeps about 14 by default; `--cap-drop=ALL` plus
specific adds is best practice.
:::

::: details 3. What is seccomp, and how do containers use it?
seccomp lets a process install a filter that the kernel runs on every system call it makes. The filter, a
small BPF program, looks at the call number and argument values, and allows the call, fails it with an error,
or kills the process. A filter cannot be removed and is inherited by children.

Container runtimes apply a default profile that refuses dozens of rarely needed system calls, such as loading
kernel modules or rebooting. That removes kernel code an attacker could reach from inside the container.

**Senior add-on:** filters cannot look at memory behind pointers, so they cannot filter by path; use LSMs or
Landlock for that. Check the architecture field, or 32-bit calls can bypass the filter. Use allow lists,
because deny lists miss equivalent calls such as `mkdirat` for `mkdir`.
:::

::: details 4. How do NX, ASLR and stack canaries each defend against a buffer overflow?
A stack buffer overflow can overwrite the return address and redirect execution.

- **Stack canaries** put a random value between buffers and the return address, checked before return. An
  overflow that reaches the return address changes the canary, and the program aborts.
- **NX** marks the stack and heap non-executable, so the attacker cannot run code they injected.
- **ASLR** randomises where code and libraries are, so the attacker does not know where to jump or which
  existing code to reuse.

**Senior add-on:** attackers answer NX with return-oriented programming, and ASLR with an information leak.
So real exploits chain a leak with a control-flow bug. Newer defences: CET shadow stacks, ARM pointer
authentication, memory tagging. The real fix is memory-safe languages.
:::

::: details 5. Explain Meltdown and how KPTI fixes it.
CPUs run instructions speculatively. On affected CPUs, a user-mode load from kernel memory passed the data to
following instructions before the permission check stopped it. Those instructions used the secret to load one
of 256 memory locations. The results were thrown away, but the cache kept that location, and timing revealed
the secret. Any program could read kernel memory.

KPTI removes the kernel from the page tables while user code runs, apart from a small entry area. With
nothing mapped, there is nothing to read. The cost is switching page tables on every kernel entry and exit.

**Senior add-on:** PCID tags TLB entries so the switch does not flush all translations, which cut the cost a
lot. CPUs made after 2018 are not vulnerable, and Linux disables KPTI on them;
`/sys/devices/system/cpu/vulnerabilities/meltdown` shows the state.
:::

::: details 6. How is Spectre different from Meltdown, and why is it harder to fix?
Meltdown breaks a permission check inside the CPU, and one change, KPTI, removes the target. Spectre does not
break a check. It trains the branch predictor so that a victim speculatively runs its own code the wrong way.
The victim, such as the kernel, a browser or another process, then leaks its own data through the cache.

It is harder to fix because branch prediction is essential for speed and exists in almost all modern CPUs.
Fixes are spread out: clamping indexes after bounds checks, retpolines for indirect branches, microcode
features to control predictors, and process isolation in browsers.

**Senior add-on:** variant 1 is bounds-check bypass, variant 2 is branch target injection. Clouds also avoid
sharing a core's hardware threads between tenants (Linux core scheduling helps), and many further variants
(L1TF, MDS, Retbleed, Downfall) each needed their own fixes.
:::

::: details 7. Why did system calls become more expensive after 2018? What can a service do about it?
Mitigations run on every kernel entry and exit: KPTI switches page tables; branch-predictor controls and
retpolines slow indirect calls and flush state; buffer-clearing instructions run on return to user mode. On
affected CPUs, a system call became noticeably slower, and system-call-heavy workloads lost a real share of
throughput.

A service can make fewer system calls: buffer and batch, use `io_uring` or `epoll` well, use the vDSO for
time, or run on newer CPUs where fixes are in hardware.

**Senior add-on:** measure with `perf trace -s` and compare the vulnerabilities files across machines.
`mitigations=off` is acceptable only on single-tenant machines that run no untrusted code.
:::

::: details 8. How would you harden a container that runs untrusted user code?
First, reduce what it can do inside a normal container:

- Run as a non-root user, with a user namespace.
- Drop all capabilities and set no-new-privileges.
- Use a strict seccomp allow list and an LSM profile.
- Use a read-only root filesystem, and no network unless needed.
- Set cgroup limits on memory, CPU and PIDs.

Then accept that all of this shares the host kernel, and one kernel bug breaks it. For truly untrusted code,
add a stronger boundary: gVisor, which answers system calls in a user-mode kernel, or a microVM such as
Firecracker or Kata.

**Senior add-on:** never mount the Docker socket or use `--privileged`. Keep the host kernel patched. Watch
for side channels on shared cores. Treat model files like `pickle` checkpoints as code.
:::

## Common misconceptions

- **"Root inside a container is harmless."** Without a user namespace, it is root on the host kernel, limited
  only by capabilities, seccomp and LSMs.
- **"ASLR prevents exploits."** It makes them need an extra bug to leak an address. It raises the cost; it
  does not remove the bug.
- **"seccomp can restrict which files a process opens."** It sees only argument values, not paths. Use LSMs
  or Landlock.
- **"Meltdown and Spectre are the same bug."** Meltdown broke a permission check and is fixed by KPTI or new
  hardware. Spectre abuses branch prediction and has no single fix.
- **"A non-executable stack stops code execution attacks."** Return-oriented programming reuses existing
  code instead.

## Key takeaways

- Linux isolation is **layered**: user IDs and file bits, **capabilities**, **LSMs** (SELinux, AppArmor),
  **seccomp** filters, then namespaces and cgroups. Each can refuse a system call independently.
- **Capabilities** split root into about 40 powers. Give processes only what they need; `CAP_SYS_ADMIN` is
  nearly root.
- **seccomp** shrinks the kernel attack surface by filtering system calls. Use allow lists and check the
  architecture.
- **NX, ASLR and stack canaries** each block one step of a memory-corruption exploit. Attackers answer with
  ROP and information leaks, so defences are layered.
- **Meltdown** (fixed by KPTI or new hardware) and **Spectre** (many partial fixes) leak data through the
  cache. Their mitigations made system calls more expensive on affected CPUs.

## Review

<Flashcards id="security" :cards="cards" />

<MarkDone id="security" />
