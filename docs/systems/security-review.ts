// Flashcards for the Security & Isolation chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'How does the kernel decide whether a process may open a file?',
    a: 'It compares the process\'s user and group IDs with the file\'s owner and group, and checks the matching read, write or execute bits. Root (UID 0) bypasses most of these checks.',
  },
  {
    q: 'Why is every setuid-root program a security risk?',
    a: 'It runs with root\'s user ID no matter who starts it. Any bug in it, such as a buffer overflow, gives the attacker root.',
  },
  {
    q: 'What problem do capabilities solve?',
    a: 'Root is all or nothing. Capabilities split its powers into about 40 pieces, so a process can hold only what it needs, such as CAP_NET_BIND_SERVICE to bind port 80.',
  },
  {
    q: 'Why is <code>CAP_SYS_ADMIN</code> called "the new root"?',
    a: 'It covers a huge range of operations, including mounting file systems and many administrative calls. A process holding it can usually gain full control.',
  },
  {
    q: 'What does a security module like SELinux or AppArmor add beyond permissions?',
    a: 'Mandatory access control: an administrator\'s policy that the kernel enforces on every process, including root. Owners and root cannot override it.',
  },
  {
    q: 'How does seccomp reduce the risk of kernel bugs?',
    a: 'It filters system calls, so a process cannot reach kernel code for calls it never needs. Many kernel exploits go through rarely used system calls.',
  },
  {
    q: 'Why should seccomp profiles be allow lists, and why check the architecture?',
    a: 'Deny lists miss equivalent calls, such as mkdirat for mkdir. On x86-64, 32-bit system calls use different numbers, so without an architecture check they can slip past the filter.',
  },
  {
    q: 'Why can\'t seccomp restrict which files a process opens?',
    a: 'Filters see only the raw argument values, not the memory a pointer refers to. Checking a path would also race with other threads changing it. LSMs or Landlock handle paths.',
  },
  {
    q: 'How does a stack buffer overflow take control of a program?',
    a: 'Writing past a local buffer overwrites the saved return address above it. When the function returns, the CPU jumps to the address the attacker wrote.',
  },
  {
    q: 'What does NX stop, and how do attackers get around it?',
    a: 'It makes stack, heap and data non-executable, so injected code cannot run. Attackers reuse existing code instead, chaining short snippets with return-oriented programming (ROP).',
  },
  {
    q: 'Why is ASLR a secret, not a wall?',
    a: 'It only hides where code and data are. If one address leaks, the rest of that library can be computed, so real exploits pair a leak bug with a control bug.',
  },
  {
    q: 'How does a stack canary detect an overflow?',
    a: 'The compiler places a random value between local buffers and the return address and checks it before returning. An overflow that reaches the return address changes it, and the program aborts.',
  },
  {
    q: 'How can speculative execution leak data if wrong results are thrown away?',
    a: 'The cache is not rolled back. A secret used during speculation to pick which memory to load leaves that line cached, and timing reads reveals which one it was.',
  },
  {
    q: 'What did Meltdown allow, and how does KPTI fix it?',
    a: 'User code could speculatively read kernel memory before the permission check stopped it. KPTI unmaps the kernel while user code runs, so there is nothing to read.',
  },
  {
    q: 'Why does Spectre have no single fix?',
    a: 'It abuses branch prediction, which almost every fast CPU needs. Defences are spread out: index clamping, retpolines, predictor controls in microcode, and process isolation.',
  },
  {
    q: 'Why did system calls get slower after 2018?',
    a: 'Mitigations run on every kernel entry and exit: page-table switches for KPTI, branch-predictor controls, and buffer clearing. System-call-heavy workloads on affected CPUs lost noticeable throughput.',
  },
  {
    q: 'What does namespace isolation not protect against, and what adds a stronger boundary?',
    a: 'Containers still share one kernel, so a reachable kernel bug breaks isolation. gVisor (a user-mode kernel) or microVMs such as Firecracker add a much smaller attack surface.',
  },
]
