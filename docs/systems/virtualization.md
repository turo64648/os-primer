---
title: 18. Virtualization & Containers
---

<script setup>
import { cards } from './virtualization-review'
</script>

# 18. Virtualization & Containers

Almost all production code now runs inside a virtual machine, a container, or both. Interviewers ask how
these work underneath: what a hypervisor does, what a container really is, and why the two give such
different isolation, speed and startup time.

::: info Before you start
- The <Term id="kernel">kernel</Term> runs in a privileged CPU mode and controls the hardware. Programs run in
  a restricted <Term id="user-mode">user mode</Term> and ask the kernel for everything through
  <Term id="syscall">system calls</Term>. [Chapter 1](/foundations/what-is-an-os) explains both.
- Each process sees its own memory. The CPU translates its addresses to real RAM using
  <Term id="page-table">page tables</Term> and caches the results in the <Term id="tlb">TLB</Term>.
  [Chapter 4](/memory/virtual-memory) covers this.
- The chapter recaps anything else it needs.
:::

## Two ways to share a machine

**In short:** a virtual machine fakes a whole computer, so each one runs its own kernel. A container is a group
of ordinary processes that share the host's kernel, but see a restricted view of the system.

Suppose you want to run software from ten customers on one physical server. Each must think it has the machine
to itself, and none may see or disturb the others. There are two main ways to do this.

**Pretend to be hardware.** A layer of software shows each customer a fake computer, with its own CPUs, memory,
disks and network card. Each customer installs a full operating system on it, with its own kernel. The fake
computer is a <Term id="virtual-machine">virtual machine</Term> (VM). The layer that creates and runs it is the
<Term id="hypervisor">hypervisor</Term>.

**Share the kernel but restrict the view.** All customers' programs run as normal processes on one kernel. The
kernel shows each group its own list of processes, its own files and its own network, and limits how much CPU
and memory each group can use. Such a group of processes is a <Term id="container">container</Term>.

<VmVsContainerDiagram />

The choice is a trade-off:

- **A VM** is heavier: it boots a whole kernel and reserves memory for it. But the boundary between VMs is
  small and simple: fake hardware.
- **A container** starts as fast as a process and has almost no overhead. But every container talks to the
  same kernel through hundreds of system calls. A bug in the kernel can break the isolation between all of them.

This chapter explains how each one works, then compares them.

## Hypervisors: type 1 and type 2

**In short:** a type 1 hypervisor runs directly on the hardware; a type 2 hypervisor runs as a program on a
normal operating system. In practice the line is blurry, and KVM sits in between.

Hypervisors are traditionally sorted into two types:

- **Type 1 (bare metal):** the hypervisor is the first thing that boots and it controls the hardware directly.
  Every operating system runs in a VM on top of it. Examples: Xen, VMware ESXi, Microsoft Hyper-V. Cloud
  providers use this type.
- **Type 2 (hosted):** the hypervisor is an application running on a normal operating system, such as a
  laptop's. Examples: VirtualBox, VMware Workstation, Parallels.

**KVM**, the Linux hypervisor, does not fit neatly. It is a part of the Linux kernel that turns Linux itself
into a hypervisor. Each VM is an ordinary Linux process. A user-mode program, usually **QEMU** or a lighter
replacement, sets up the VM and pretends to be its devices. Because the hypervisor is in the host kernel, KVM
is usually called type 1. Because the host is a general-purpose OS, some call it type 2.

The labels matter less than the question behind them: how much software sits between the VM and the hardware,
and how much of it could be attacked. Google Cloud, and AWS's current Nitro platform, build on KVM.

## How a CPU runs a virtual machine

**In short:** the guest's code runs directly on the real CPU at full speed. Only the few operations that touch
the machine's real state stop the guest and hand control to the hypervisor. Modern CPUs have a special mode
that makes this efficient.

Running a guest by interpreting every instruction would be far too slow. So a hypervisor lets the guest's code
run directly on the CPU, and steps in only when it must.

### Trap and emulate

Most instructions, such as adding numbers or reading memory, are harmless: they affect only the guest. A few
are **sensitive**: they would change the real machine. Examples are switching page tables, turning off
<Term id="interrupt">interrupts</Term>, or talking to a device.

The classic plan is **trap and emulate**. The hypervisor runs the guest kernel without full privilege. When
the guest kernel tries a sensitive instruction, the CPU refuses and jumps into the hypervisor. This jump is a
<Term id="trap">trap</Term>. The hypervisor then does the same thing to the guest's **fake** state, for example
to the guest's idea of its page table, and resumes the guest.

For many years, x86 CPUs could not do this cleanly. A few sensitive instructions did not trap when run without
privilege; they quietly did something different. Early x86 hypervisors worked around it in two ways:

- **Binary translation** (VMware): scan the guest kernel's code as it runs and rewrite the problem
  instructions into safe sequences.
- **Paravirtualization** (Xen): modify the guest kernel so it calls the hypervisor directly instead of using
  those instructions. Such calls are **hypercalls**.

### Hardware virtualization

Around 2005–2006, Intel and AMD added hardware support: **Intel VT-x** and **AMD-V**. The CPU gains a new
**guest mode**. In guest mode, the guest kernel really runs in kernel mode, with its own page tables and
interrupt setup. But the hypervisor configures a list of events that must stop the guest.

When one of those events happens, the CPU saves the guest's state and switches to the hypervisor. This is a
<Term id="vm-exit">VM exit</Term>. The hypervisor handles the cause, then resumes the guest with a **VM entry**.
Typical exit causes:

- the guest touches a device (the hypervisor must fake the device);
- a real hardware interrupt arrives (the host must handle it);
- the guest runs certain instructions, such as `cpuid` or halt;
- a page fault that the hypervisor must resolve (see the next section).

A VM exit and re-entry take roughly a microsecond or less, depending on the CPU and the cause. That is cheap
once, but a workload causing hundreds of thousands of exits per second loses a lot of time. Much of hypervisor
engineering is about avoiding exits.

::: details Going deeper: the hardware details
- On Intel, the guest's saved state and the exit settings live in a memory structure called the **VMCS**. AMD
  calls it the **VMCB**. The hypervisor's mode is called **VMX root mode** on Intel.
- The formal conditions for a CPU to be virtualizable by trap and emulate were set out by Popek and Goldberg
  in 1974. Pre-2005 x86 did not meet them.
- Features such as **posted interrupts** deliver interrupts to a running guest without an exit. Paravirtual
  clocks and spinlock hints avoid other exits.
- **Nested virtualization** runs a hypervisor inside a VM. It works on modern CPUs, but exits of the inner
  guest become expensive, since each may go through both hypervisors.
:::

## Memory: nested paging

**In short:** inside a VM, addresses are translated twice: by the guest's page tables, then by the
hypervisor's. Modern CPUs do both in hardware, but a TLB miss costs much more.

A guest kernel manages its "physical" memory as if it were real RAM. It builds page tables that map its
processes' addresses to what it believes are physical addresses. But that memory is really just part of the
hypervisor's memory, and can be anywhere in real RAM.

So there are three kinds of addresses, and two translations:

1. **Guest virtual → guest physical**, using the guest's page tables, managed by the guest kernel.
2. **Guest physical → host physical**, using a second set of tables managed by the hypervisor.

<NestedPagingDiagram />

Before hardware support, hypervisors kept **shadow page tables**: combined tables that mapped guest virtual
addresses straight to host physical ones. They had to catch every change the guest made to its own page tables,
which caused many VM exits.

Modern CPUs walk both tables in hardware. This is <Term id="nested-paging">nested paging</Term>, called
**EPT** (extended page tables) on Intel and **NPT** on AMD. The guest changes its own page tables freely, with
no exit.

The cost is on TLB misses. Every step of the guest's page walk reads a guest page-table entry, and the address
of that entry is itself a guest physical address that must be translated. With four levels on each side, one
miss can take up to 24 memory reads instead of 4. This is why <Term id="huge-page">huge pages</Term>, in the
guest and in the hypervisor, help VMs even more than they help bare metal.

::: details Going deeper: memory tricks hypervisors use
- **Overcommit:** a host can promise VMs more memory than it has, because guests rarely use all of theirs.
- **Ballooning:** a driver inside the guest allocates memory on request and hands it back to the hypervisor.
  The guest's own kernel decides what to evict.
- **KSM** (kernel same-page merging) finds identical pages in different VMs, such as the same OS code, and
  shares one copy with copy-on-write. It saves memory but costs CPU, and it has enabled side-channel attacks
  between VMs.
- **Live migration** moves a running VM to another host: it copies memory while the VM runs, re-copies pages
  that changed, then pauses the VM briefly to copy the rest.
:::

## Devices: emulation, virtio and passthrough

**In short:** faking a real device is slow, because every access causes a VM exit. Paravirtual devices use
shared memory queues instead. For full speed, a real device can be handed to the VM directly.

A guest needs disks and network cards. There are three ways to give it one, from slowest to fastest:

- **Emulation.** The hypervisor pretends to be a well-known real device, such as an old Intel network card.
  Any guest has a driver for it. But the guest's driver talks to it through many register reads and writes,
  and each one is a VM exit.
- **Paravirtual devices.** The guest uses a driver written for virtual machines. The standard family is
  <Term id="virtio">virtio</Term>. The guest and host share rings of requests in memory. The guest adds
  many requests and notifies the host once, so exits are rare. This is the default in most clouds.
- **Passthrough.** A real device, such as a GPU or network card, is given to one VM. The guest's own driver
  talks to the hardware with no hypervisor in the way.

Passthrough needs one more piece of hardware. Devices write to memory directly, using
<Term id="dma">DMA</Term>. The guest programs the device with guest physical addresses, and a device must not
be able to write into another VM's memory. The <Term id="iommu">IOMMU</Term> fixes both: it is a translation
unit that sits between devices and RAM, like a page table for devices.

Some devices can split themselves into many virtual devices, each passed to a different VM. This is
**SR-IOV**. It is common for network cards in the cloud.

::: details Going deeper: names you will meet
- On Linux, **VFIO** is the kernel framework used to hand devices to VMs or user programs safely. The IOMMU is
  called **VT-d** on Intel and **AMD-Vi** on AMD.
- **vhost** moves the host side of virtio into the host kernel, or into a separate process, to cut overhead.
- AWS **Nitro** moves networking, storage and management onto dedicated cards. The VM sees these as SR-IOV
  devices, and very little hypervisor software runs on the main CPUs.
- NVIDIA **MIG** splits one data-centre GPU into several isolated slices with their own memory. Each slice
  can be given to a different VM or container.
:::

## What a VM costs in practice

**In short:** CPU-heavy code runs in a VM at close to native speed. The costs show up in TLB misses, VM exits
for I/O and timers, and in sharing the physical CPU with other guests.

On modern hardware, pure computation in a VM runs at nearly the same speed as on the bare machine. Overhead
comes from:

- **TLB misses**, which cost more under nested paging.
- **VM exits**, for I/O, timers and interrupts. A workload that does many small I/O operations suffers most.
- **Shared physical CPUs.** The hypervisor may run other VMs' virtual CPUs on the same physical cores.

The last one is visible from inside the guest. When the guest's virtual CPU is ready to run but the hypervisor
is running something else, the guest loses that time. Linux reports it as <Term id="steal-time">steal
time</Term>, the `st` column in `top` and `vmstat`. Steady steal time above a few percent means the host is
oversubscribed. The guest cannot fix it; it can only move to other hardware or a larger instance type.

Clocks are another source of trouble in VMs. A guest that cannot read time cheaply turns every clock read into
an exit. [Chapter 16](/systems/time-and-timers) covers this.

## Containers: isolation from kernel features

**In short:** a container is not a kernel object. It is a group of processes with four things applied:
namespaces for what they see, cgroups for what they use, security filters for what they may do, and their own
root filesystem.

Linux has no single "container" feature. A container runtime, such as Docker, containerd or Podman, combines
several independent kernel features around a normal group of processes:

<ContainerAnatomyDiagram />

- **Namespaces** give the processes their own view of system resources: their own process IDs, network,
  filesystem mounts, host name and more.
- **cgroups** limit and measure how much CPU, memory and I/O they can use.
- **Security filters** remove privileges and block risky system calls. [Chapter 17](/systems/security) covers
  capabilities, <Term id="seccomp">seccomp</Term> and security modules.
- **A root filesystem** from an image gives them their own files: their own libraries, tools and configuration.

Every process in the container is visible on the host as a normal process, with a normal process ID. `ps` on
the host shows it. There is no guest kernel and no fake hardware.

## Namespaces

**In short:** a namespace gives a group of processes its own private copy of one kind of global resource. There
is a separate namespace type for each kind.

Many things in Linux are global: the list of processes, the network interfaces, the mounted filesystems, the
host name. A <Term id="namespace">namespace</Term> wraps one of these so that processes inside see their own
private version. Processes in different namespaces of the same type see different versions.

| Namespace | What the processes get their own copy of |
|---|---|
| **PID** | Process IDs. The first process inside is PID 1, and processes outside are invisible. |
| **Mount** | The tree of mounted filesystems. |
| **Network** | Network interfaces, IP addresses, routing tables, firewall rules, ports. |
| **UTS** | The host name. |
| **IPC** | Older shared-memory and message-queue objects. |
| **User** | User and group IDs. Root inside can map to an unprivileged user outside. |
| **Cgroup** | The view of the cgroup tree, so the container sees its own group as the root. |
| **Time** | Offsets for the monotonic and boot-time clocks, mainly for moving containers between hosts. |

A process gets new namespaces when it is created with the `clone` system call and the right flags, or later
with `unshare`. `setns` joins an existing namespace, which is how `docker exec` runs a command inside a
running container. Each process's namespaces are listed in `/proc/<pid>/ns/`.

### Try it: a private host name

The child process moves into a new UTS namespace and changes its host name. The parent's host name does not
change:

```c
// ns.c: gcc -O2 ns.c -o ns && sudo ./ns
#define _GNU_SOURCE
#include <sched.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    char name[64];

    pid_t child = fork();
    if (child == 0) {
        if (unshare(CLONE_NEWUTS) != 0) {    // new hostname namespace, for this process only
            perror("unshare");
            return 1;
        }
        if (sethostname("box", strlen("box")) != 0) { perror("sethostname"); return 1; }
        gethostname(name, sizeof name);
        printf("child sees hostname:  %s\n", name);
        return 0;
    }
    waitpid(child, NULL, 0);
    gethostname(name, sizeof name);
    printf("parent sees hostname: %s\n", name);
    return 0;
}
```

Output (the parent shows your machine's real host name):

```text
child sees hostname:  box
parent sees hostname: vm
```

It needs `sudo` because creating most namespaces requires privilege. The PID namespace works the same way.
Here the `unshare` command starts a shell in a new PID namespace:

```text
$ sudo unshare --pid --fork --mount-proc sh -c 'sleep 100 & ps -o pid,comm'
    PID COMMAND
      1 sh
      2 sleep
      3 ps
```

The shell believes it is PID 1, and no other process on the machine is visible. Being PID 1 has special
duties, such as collecting finished child processes. [Chapter 2](/foundations/processes-and-threads) explains
why that matters in containers.

::: details Going deeper: user namespaces and rootless containers
- A user namespace maps IDs: user 0 (root) inside can be, say, user 100000 outside. Inside, the process has
  full privileges over its own namespaces. Outside, it has none.
- Because of this, an unprivileged user can create a user namespace, and inside it create the other
  namespaces. This is how **rootless containers** (Podman, rootless Docker) work.
- User namespaces also expose more kernel code to unprivileged users, and several kernel bugs were reachable
  only through them. Some distributions restrict their use for that reason.
:::

## cgroups

**In short:** cgroups put processes into a tree of groups and set limits on each group: CPU, memory, I/O and
number of processes. Every container is one group.

Namespaces control what a container sees. They do nothing about how much it uses. One container could still
use all the CPU or all the memory. <Term id="cgroup">Control groups</Term> (cgroups) fix this.

A cgroup is a group of processes. Groups form a tree, and each group's limits apply to everything below it. The
tree appears as directories under `/sys/fs/cgroup`. You manage it with ordinary file operations:

```bash
mkdir /sys/fs/cgroup/demo                     # create a group
echo 500M > /sys/fs/cgroup/demo/memory.max    # at most 500 MB of memory
echo "50000 100000" > /sys/fs/cgroup/demo/cpu.max   # 50 ms of CPU per 100 ms
echo 100 > /sys/fs/cgroup/demo/pids.max       # at most 100 processes
echo $$ > /sys/fs/cgroup/demo/cgroup.procs    # move this shell into it
```

Children of a process start in the same group, and a process cannot leave its group on its own. Each kind of
resource is handled by a **controller**:

- **cpu:** a share of CPU time when cores are busy, and optionally a hard quota per period. A quota can
  **throttle** a container even when the machine is idle. [Chapter 8](/cpu/scheduling) covers this in depth.
- **memory:** a hard limit, with an OOM kill inside the group if it cannot be met, and softer limits for
  throttling and protection. Page cache counts too. [Chapter 5](/memory/kernel-memory) covers this.
- **io:** weights and limits on disk reads and writes per device.
- **pids:** a maximum number of processes and threads. This stops a runaway `fork` loop from taking down the
  host.
- **cpuset:** which CPU cores and memory nodes the group may use.

::: details Going deeper: cgroup v1 and v2
- **cgroup v1** had a separate tree for each controller, so a process could be in different places in the CPU
  tree and the memory tree. This made coordinated limits hard.
- **cgroup v2** has one tree for all controllers and cleaner rules. It adds pressure information per group
  (`memory.pressure`, `cpu.pressure`, `io.pressure`) and better accounting of memory write-back. Most current
  distributions use v2 by default, and Kubernetes supports it fully.
- systemd puts every service in its own cgroup, so the same tools work for services and containers.
  `systemd-cgls` shows the tree and `systemd-cgtop` shows usage per group.
:::

## Images and root filesystems

**In short:** a container image is a stack of read-only file layers. At start, the runtime stacks them with a
writable layer on top, using an overlay filesystem, and makes the result the container's root.

A container needs its own files: a Linux distribution's libraries, the application, its configuration. An
image provides them as a series of **layers**. Each layer is a set of files: a base OS layer, a layer with the
language runtime, a layer with the application.

At start, the runtime combines the layers with <Term id="overlayfs">overlayfs</Term>. It shows several
directories stacked as one: the image layers are read-only at the bottom, and a fresh, empty writable layer is
on top.

- **Reading** a file finds it in the highest layer that has it.
- **Writing** to a file from a lower layer first copies the whole file to the writable layer. This is
  **copy-up**, and it can be slow for large files.
- **Deleting** a file records a marker in the writable layer that hides it.

Then the runtime makes this combined directory the root, `/`, for the container's mount namespace. Many
containers from the same image share the read-only layers, both on disk and in the page cache. The writable
layer disappears with the container, which is why persistent data belongs in a **volume**, a host directory
mounted into the container.

::: details Going deeper: who does what
- **Docker** and **Kubernetes** call **containerd** (or CRI-O), which manages images and container lifecycles.
  It calls a low-level runtime, usually **runc**, which creates the namespaces and cgroups and starts the first
  process. The formats are standardised by the OCI (Open Container Initiative).
- A Kubernetes **pod** is several containers that share a network namespace (and so share `localhost`), and
  optionally other namespaces. A tiny "pause" container holds the shared namespaces open.
- The runtime switches the root with `pivot_root`, then unmounts the old root, so the host's files are not
  reachable.
:::

## What containers do not isolate

**In short:** all containers share one kernel, so they share its bugs, its global settings and many
resources that cgroups do not divide. Several tools also report host values inside a container.

Namespaces cover many resources, but not all. Things that are still shared or visible:

- **The kernel itself.** A bug in any system call reachable from a container can let it take over the host.
  This is the main reason containers are a weaker boundary than VMs.
- **Kernel-wide settings and resources.** Many kernel settings are global. The kernel log and some `/proc`
  files show host-wide information.
- **Hardware contention.** CPU caches, memory bandwidth and disk queues are shared. A noisy neighbour can slow
  your container while staying inside all its limits.
- **Host-sized numbers.** `/proc/meminfo`, `free` and `top` inside a container usually show the **host's**
  memory. Tools that count CPUs see all the host's cores unless a cpuset restricts them; a CPU quota is
  invisible to them.

The last point breaks programs that size themselves from the machine. A runtime that reads "256 GB of RAM,
64 cores" inside a container limited to 4 GB and 2 CPUs creates far too many threads and a heap far too big.
Modern JVMs, Go (for CPU, since 1.25) and others read the cgroup files instead. Check what your runtime does.

## Containers vs VMs vs microVMs

**In short:** microVMs and sandboxed runtimes aim for VM-level isolation at container-like speed. They cut the VM
down to almost nothing, or put a second kernel-like layer in front of the host kernel.

Cloud providers that run code from many customers on one host cannot rely on the shared kernel alone. But full
VMs boot slowly and use a lot of memory. Two designs sit between them:

- A <Term id="microvm">microVM</Term> is a VM with the minimum possible virtual hardware: a few virtio devices,
  no BIOS, no USB, no graphics. A small user-mode program replaces QEMU. **Firecracker**, built by AWS on KVM,
  runs AWS Lambda and Fargate. Its authors report boot times around a hundred milliseconds and a few MiB of
  overhead per VM. **Kata Containers** runs each Kubernetes pod in its own lightweight VM.
- A **user-space kernel** intercepts the container's system calls and implements them itself, using only a
  small set of host system calls. **gVisor** from Google works this way. The host kernel sees far fewer kinds
  of calls, but system-call-heavy workloads run slower.

| | Container | microVM | Full VM |
|---|---|---|---|
| Isolation boundary | Shared host kernel (system calls) | Virtual hardware, minimal | Virtual hardware |
| Own kernel | No | Yes, small | Yes |
| Start time | Milliseconds | Around a hundred milliseconds or more | Seconds to minutes |
| Memory overhead | Almost none | A few MiB plus the guest kernel | Hundreds of MiB and up |
| Typical use | Trusted services, CI, dev | Serverless and multi-tenant containers | General cloud servers, other OSes |

Many real deployments stack them: containers run inside VMs. The VM separates customers; the containers
package and limit services within one customer.

## Why this matters in real systems

**Serverless functions.** A serverless platform must start a function in milliseconds and pack thousands of
customers onto one host, without letting them attack each other. A container per function starts fast but
shares the kernel. A full VM is safe but slow. That is why AWS built Firecracker: a VM with only a few
devices, fast enough to start per request burst.

**A container escape.** In 2019, a bug in runc (CVE-2019-5736) let a malicious container overwrite the host's
runc program and run code as root on the host. Kernel bugs such as Dirty Pipe (2022) could also be used from
inside containers. Teams running untrusted code add layers: user namespaces, strict seccomp profiles, gVisor or
microVMs.

**GPU containers.** A container that uses a GPU talks to the host's GPU driver: the kernel part is shared, and
the NVIDIA container toolkit mounts the matching user-space driver libraries into the container. So the
container's CUDA version must be compatible with the host driver. To split a GPU between tenants with real
isolation, clouds use VM passthrough or MIG slices.

**CPU throttling in Kubernetes.** A latency-sensitive service with a CPU limit shows p99 spikes at low average
CPU. Its threads use up the quota early in each 100 ms period and are throttled for the rest. The container
looks idle but is not allowed to run. [Chapter 8](/cpu/scheduling) covers the fix.

**Noisy neighbours in the cloud.** A service on a cloud VM gets slower at random times with no change in load.
`top` inside the VM shows steal time rising: another guest is using the same physical cores. Options are
larger or dedicated instances, or tolerating it by spreading load.

**How to measure it:**

```bash
systemd-detect-virt                    # are we in a VM or container, and which kind?
lsns                                   # namespaces on this host and their processes
ls -l /proc/<pid>/ns/                  # which namespaces a process is in
cat /proc/<pid>/cgroup                 # which cgroup a process is in
cat /sys/fs/cgroup/<group>/cpu.stat    # CPU use and throttling
vmstat 1                               # "st" column = steal time inside a VM
perf kvm stat live                     # on a KVM host: VM exits by reason
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. What is the difference between a container and a virtual machine?
A VM is a fake computer. The hypervisor provides virtual CPUs, memory and devices, and each VM runs its own
kernel. A container is a group of normal processes on the host's kernel. Namespaces give them their own view,
and cgroups limit what they use.

So VMs are heavier to start and run, but separated by a small interface: virtual hardware. Containers are
nearly free, but share one kernel, and a kernel bug can break the isolation between all of them.

**Senior add-on:** mention the middle ground, microVMs (Firecracker, Kata) and user-space kernels (gVisor), and
that production systems often run containers inside VMs to get both.
:::

::: details 2. What is a Linux container made of?
Ordinary processes, plus four kernel features: namespaces (what they can see: PIDs, network, mounts, host name,
users), cgroups (how much CPU, memory, I/O and how many processes they can use), security filters
(capabilities, seccomp, AppArmor or SELinux), and a root filesystem built from image layers with overlayfs.

**Senior add-on:** there is no container object in the kernel. The runtime (runc under containerd) makes the
system calls: `clone` or `unshare` with namespace flags, writes to cgroup files, `pivot_root`, then `exec`.
:::

::: details 3. How does hardware virtualization work? What is a VM exit?
The CPU has a guest mode. The guest kernel runs in it with real kernel privileges over its own state, so almost
all instructions run at full speed. The hypervisor configures which events must stop the guest: device
access, certain instructions, some interrupts and faults.

When one happens, the CPU saves the guest's state and switches to the hypervisor. That is a VM exit. The
hypervisor handles it, for example by faking a device register, then resumes the guest.

**Senior add-on:** before VT-x and AMD-V, x86 was not cleanly virtualizable, so VMware used binary translation
and Xen used paravirtualization. Today the performance work is about avoiding exits: virtio, posted
interrupts, passthrough.
:::

::: details 4. How is memory translated inside a VM? Why do TLB misses cost more?
Twice. The guest's page tables map guest virtual to guest physical addresses. The hypervisor's nested tables
(EPT or NPT) map guest physical to real physical addresses. The CPU walks both in hardware.

Each step of the guest walk reads a guest page-table entry, whose address must itself be translated through the
nested tables. With four levels on each side, one miss can take up to 24 memory reads.

**Senior add-on:** huge pages in the guest and on the host shorten both walks, so they matter more in VMs.
Before nested paging, hypervisors used shadow page tables and trapped every guest page-table change.
:::

::: details 5. What are type 1 and type 2 hypervisors? Where does KVM fit?
Type 1 runs directly on the hardware and hosts all operating systems as guests: Xen, ESXi, Hyper-V. Type 2 runs
as an application on a normal OS: VirtualBox, VMware Workstation.

KVM is a Linux kernel module that makes Linux itself the hypervisor. VMs are Linux processes, with QEMU or a
lighter program providing devices. It is usually counted as type 1.

**Senior add-on:** what matters in practice is the size of the trusted software under the guest and the path
I/O takes. Clouds move device handling to dedicated hardware, as AWS Nitro does, to shrink both.
:::

::: details 6. Why are containers considered a weaker security boundary than VMs? How do you harden them?
All containers on a host share one kernel and reach it through hundreds of system calls. A bug in any of them
can let code escape to the host. A VM's boundary is a much smaller set of virtual hardware operations.

Hardening: run as a non-root user, use user namespaces so root inside is unprivileged outside, drop
capabilities, apply a strict seccomp profile, use read-only root filesystems, and keep the host kernel
patched. For untrusted code, use gVisor or a microVM.

**Senior add-on:** mention real escapes, such as the runc bug of 2019 and kernel bugs like Dirty Pipe, and
that hardening layers are about shrinking the reachable kernel surface.
:::

::: details 7. Inside a container, free shows 256 GB of RAM, but the container is limited to 4 GB. Why, and why does it matter?
`free` reads `/proc/meminfo`, which is not namespaced: it shows the host. The container's limit lives in its
cgroup, in `memory.max`.

It matters because programs that size themselves from the machine will get it wrong: a runtime might size its
heap for 256 GB and be OOM-killed at 4 GB, or start 64 worker threads for 2 CPUs.

**Senior add-on:** modern JVMs and other runtimes read cgroup limits. Otherwise, pass limits explicitly (for
example `-Xmx`, `GOMEMLIMIT`, `GOMAXPROCS`), or use LXCFS, which presents container-specific `/proc` files.
:::

::: details 8. Compare emulated devices, virtio and passthrough.
Emulation fakes a real device, so any guest works, but every register access is a VM exit: slow. Virtio is a
device designed for VMs: shared-memory queues let the guest batch many requests per notification: fast and the
cloud default. Passthrough hands a real device to the VM, with the IOMMU keeping its DMA inside the VM's
memory: native speed, but the device is tied to one VM and live migration is harder.

**Senior add-on:** SR-IOV splits one physical device into many virtual functions, each passed through to a
different VM. It is how clouds give VMs near-native networking.
:::

::: details 9. A service on a cloud VM slows down at random times with no change in its load. What do you check?
1. **Steal time** (`st` in `vmstat` or `top`): another guest using the same physical cores.
2. **CPU throttling**, if it runs in a container with a CPU limit: `nr_throttled` in `cpu.stat`.
3. **Burstable instance credits**, on instance types that allow short bursts and then slow down.
4. **Noisy neighbours** on shared disks or networks: rising I/O latency with the same request rate.
5. Inside the guest, the usual suspects: garbage collection, memory reclaim, other processes.

**Senior add-on:** confirm by correlating the slowdowns with those metrics over time. The fixes, such as
dedicated hosts, larger instances or removing CPU limits, are mostly outside the application.
:::

## Common misconceptions

- **"A container is a lightweight VM."** It has no kernel of its own and no virtual hardware. It is a group of
  host processes with a restricted view.
- **"Code in a VM runs through an emulator."** Guest code runs directly on the CPU. Only specific events exit to
  the hypervisor.
- **"Namespaces limit resources."** Namespaces limit what is visible. cgroups limit what is used.
- **"Root in a container is harmless."** Without a user namespace, root inside is root on the host kernel,
  restricted only by capabilities and filters.
- **"Tools inside a container show the container's resources."** Many show the host's memory and CPUs.

## Key takeaways

- **VMs** fake hardware and run their own kernel. **Containers** share the host kernel and get a restricted
  view. The trade-off is isolation against overhead and start time.
- Hardware virtualization runs guest code natively. **VM exits** hand specific events to the hypervisor, and
  avoiding them is most of VM performance work.
- In VMs, memory is translated twice (**nested paging**), so TLB misses cost more and huge pages help more.
- A container is **namespaces + cgroups + security filters + an image filesystem**, applied to ordinary
  processes.
- **microVMs** and **gVisor** sit in between, for running untrusted code quickly and safely.

## Review

<Flashcards id="virtualization" :cards="cards" />

<MarkDone id="virtualization" />
