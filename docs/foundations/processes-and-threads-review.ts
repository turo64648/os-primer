// Flashcards for the Processes & Threads chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'Why does <code>fork</code> return twice, and how do parent and child tell themselves apart?',
    a: 'After <code>fork</code> there are two processes at the same point in the code, and each returns from the call. The child gets 0; the parent gets the child\'s PID (or -1 on failure).',
  },
  {
    q: 'Why does Unix split starting a program into <code>fork</code> and <code>exec</code>?',
    a: 'Between the two calls the child still runs the parent\'s code, so it can set up redirections, pipes and other settings. <code>exec</code> keeps that setup, so the new program inherits it without knowing.',
  },
  {
    q: 'What does <code>exec</code> keep, and what does it throw away?',
    a: 'It keeps the PID, parent, open file descriptors (unless close-on-exec), current directory and signal mask. It replaces the whole address space, and resets signal handlers, since they were code in the old program.',
  },
  {
    q: 'Why is <code>fork</code> cheap for a shell but expensive for a 50 GB service?',
    a: 'Copy-on-write avoids copying data, but the page tables are still copied: about 100 MB for 50 GB, pausing the parent. Later writes then trigger many page copies.',
  },
  {
    q: 'Why is calling <code>fork</code> in a multithreaded program dangerous?',
    a: 'Only the calling thread exists in the child. Locks that other threads held stay locked forever, so the child can hang in any library call until it runs <code>exec</code>.',
  },
  {
    q: 'How do <code>posix_spawn</code> and <code>vfork</code> avoid the cost of <code>fork</code>?',
    a: 'The child borrows the parent\'s memory instead of copying it, and the parent waits until the child calls <code>exec</code>. So the cost does not grow with the parent\'s size.',
  },
  {
    q: 'What is a zombie process, and why can\'t you kill it?',
    a: 'A process that has exited but whose parent has not collected its exit code with <code>wait</code>. It is already dead; only its small record with PID and status remains. You fix or kill the parent.',
  },
  {
    q: 'Why is a zombie leak a real problem if zombies use almost no memory?',
    a: 'Each zombie holds a PID. Enough of them exhaust the system\'s or container\'s PID limit, and then every <code>fork</code> fails.',
  },
  {
    q: 'What happens to a process whose parent exits first?',
    a: 'It becomes an orphan and is reparented to PID 1, or to the nearest ancestor marked as a subreaper. The new parent reaps it when it exits.',
  },
  {
    q: 'What do threads of one process share, and what does each thread have for itself?',
    a: 'They share memory, the file descriptor table, signal handlers and the PID. Each thread has its own registers, stack, signal mask, thread ID and thread-local variables such as <code>errno</code>.',
  },
  {
    q: 'How does Linux implement threads?',
    a: 'As tasks, like processes. <code>clone</code> creates a task, and its flags say what to share: memory, files, signal handlers, thread group. <code>pthread_create</code> shares all of them; <code>fork</code> shares none.',
  },
  {
    q: 'Why can\'t <code>SIGKILL</code> be caught, and what does a process lose when it gets one?',
    a: 'If it could be caught, a buggy or hostile program could refuse to die. The process runs no more code, so nothing in its own buffers is flushed and no cleanup happens.',
  },
  {
    q: 'What should a server do when it receives <code>SIGTERM</code>?',
    a: 'Stop accepting new work, finish in-flight work within a deadline shorter than the grace period, flush and close resources, then exit 0. Otherwise the platform sends <code>SIGKILL</code>.',
  },
  {
    q: 'Why may a signal handler not call <code>printf</code> or <code>malloc</code>?',
    a: 'The handler can interrupt the program inside those same functions, with a lock held or data half-updated. Calling them again can deadlock or corrupt memory. Only async-signal-safe functions are allowed.',
  },
  {
    q: 'How do the self-pipe trick and <code>signalfd</code> make signals safe for an event loop?',
    a: 'They turn a signal into a readable file descriptor. The handler writes a byte to a pipe, or with <code>signalfd</code> the kernel queues the signal on a descriptor. The loop then handles it in normal code.',
  },
  {
    q: 'Why does a container ignore <code>SIGTERM</code> when its program has no handler?',
    a: 'The program is PID 1 in its namespace, and the kernel drops signals that PID 1 has not set a handler for. Handle <code>SIGTERM</code>, or run a small init such as tini as PID 1.',
  },
  {
    q: 'What does exit code 137 mean?',
    a: '128 + 9: the process was killed by <code>SIGKILL</code>. In containers that is often the OOM killer, or a shutdown that ran past its grace period.',
  },
  {
    q: 'How does Ctrl-C reach every process in a pipeline but not the shell?',
    a: 'The shell puts the pipeline in its own process group and makes it the terminal\'s foreground group. The kernel\'s terminal driver sends <code>SIGINT</code> to every process in that group.',
  },
]
