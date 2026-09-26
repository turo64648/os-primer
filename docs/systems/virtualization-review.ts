// Flashcards for the Virtualization & Containers chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'What is the basic difference between a VM and a container?',
    a: 'A VM fakes a whole computer and runs its own kernel. A container is a group of host processes that share the host kernel but get a restricted view and limited resources.',
  },
  {
    q: 'Why are VMs usually considered a stronger boundary than containers?',
    a: 'A VM’s boundary is a small set of virtual hardware operations. Containers reach the shared host kernel through hundreds of system calls, and one kernel bug can break isolation.',
  },
  {
    q: 'What is the difference between a type 1 and a type 2 hypervisor?',
    a: 'Type 1 runs directly on the hardware and hosts all operating systems as guests. Type 2 runs as an application on a normal operating system.',
  },
  {
    q: 'How does guest code run at nearly native speed?',
    a: 'It runs directly on the real CPU in a special guest mode. Only chosen events, such as device access, stop the guest and hand control to the hypervisor.',
  },
  {
    q: 'What is a VM exit, and why do hypervisor designers try to avoid them?',
    a: 'The CPU saving the guest’s state and switching to the hypervisor to handle an event. Each round trip costs up to about a microsecond, which adds up at high rates.',
  },
  {
    q: 'Why was x86 hard to virtualize before VT-x and AMD-V?',
    a: 'Some sensitive instructions did not trap when run without privilege; they silently behaved differently. Hypervisors had to rewrite guest code (binary translation) or modify the guest kernel (paravirtualization).',
  },
  {
    q: 'What is nested paging?',
    a: 'Hardware translation in two stages: the guest’s page tables map guest virtual to guest physical, and the hypervisor’s tables map guest physical to real RAM.',
  },
  {
    q: 'Why are TLB misses more expensive in a VM?',
    a: 'Every step of the guest’s page walk needs its own walk of the hypervisor’s tables. With four levels each, one miss can take up to 24 memory reads.',
  },
  {
    q: 'Why is virtio faster than an emulated device?',
    a: 'An emulated device needs a VM exit on every register access. Virtio shares request queues in memory, so the guest batches many requests per notification.',
  },
  {
    q: 'What does the IOMMU do for device passthrough?',
    a: 'It translates and restricts device memory accesses, like a page table for devices, so a device given to one VM can only reach that VM’s memory.',
  },
  {
    q: 'What is steal time?',
    a: 'Time a VM’s virtual CPU was ready to run but the hypervisor ran something else. It shows as “st” in top and vmstat and means the host is oversubscribed.',
  },
  {
    q: 'What four things make up a Linux container?',
    a: 'Namespaces (what it sees), cgroups (how much it uses), security filters such as capabilities and seccomp (what it may do), and a root filesystem from an image.',
  },
  {
    q: 'What is the difference between namespaces and cgroups?',
    a: 'Namespaces limit what processes can see, such as PIDs, network and mounts. cgroups limit how much CPU, memory, I/O and how many processes they can use.',
  },
  {
    q: 'How does a user namespace make rootless containers possible?',
    a: 'It maps IDs, so root inside the namespace is an unprivileged user outside. The process has full power over its own namespaces and none over the host.',
  },
  {
    q: 'How does overlayfs build a container’s filesystem?',
    a: 'It stacks read-only image layers under an empty writable layer. Reads find the highest copy; writing a lower file first copies it up; the writable layer vanishes with the container.',
  },
  {
    q: 'Why can programs misjudge their resources inside a container?',
    a: '/proc/meminfo and CPU counts usually show the host. A runtime that sizes its heap or thread pool from them can exceed the cgroup limits.',
  },
  {
    q: 'What problem do microVMs such as Firecracker solve?',
    a: 'They give VM-level isolation for untrusted, multi-tenant code while starting in around a hundred milliseconds with little memory overhead, by keeping only minimal virtual hardware.',
  },
]
