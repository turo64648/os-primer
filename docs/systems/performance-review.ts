// Flashcards for the Performance & Debugging chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'What are the five steps of the performance method in this chapter?',
    a: 'Define the problem; check every resource with USE; split on-CPU from off-CPU time; drill down with profiles or off-CPU tracing; fix one thing and measure again.',
  },
  {
    q: 'Why look at percentiles instead of averages?',
    a: 'An average hides the slow requests that users actually notice. Percentiles such as p99 describe the slow end of the distribution, where most OS-level stalls show up.',
  },
  {
    q: 'What do the three letters of the USE method check?',
    a: 'Utilization: how busy a resource is. Saturation: how much work waits because it is busy. Errors: failures such as drops or allocation failures.',
  },
  {
    q: 'Why does saturation predict latency better than utilization?',
    a: 'Latency comes from waiting. A resource can look moderately busy on average and still queue lots of work in bursts.',
  },
  {
    q: 'Why check CPU use per core, not just the total?',
    a: 'A single-threaded bottleneck can hold one core at 100% while the machine average looks low.',
  },
  {
    q: 'What is the difference between on-CPU and off-CPU time?',
    a: 'On-CPU time is spent running instructions. Off-CPU time is spent blocked or waiting for a core. A request’s latency is the sum of both.',
  },
  {
    q: 'How can you quickly tell whether slow requests are on-CPU or off-CPU?',
    a: 'Compare CPU time with wall time. If a 200 ms request uses 20 ms of CPU, 90% of its time is waiting, and a CPU profile will not explain it.',
  },
  {
    q: 'How does a sampling profiler find hot code?',
    a: 'It interrupts each CPU at a fixed rate and records the running stack. Code that appears in more samples used more CPU time. The overhead is low.',
  },
  {
    q: 'How do you read a flame graph?',
    a: 'Each box is a function above its caller. Width is its share of samples. Left-to-right order is alphabetical, not time. Look for wide boxes.',
  },
  {
    q: 'Why do profiles sometimes show broken or nameless stacks?',
    a: 'Code built without frame pointers cannot be unwound simply, stripped binaries lack symbols, and JIT code needs the runtime to publish a map.',
  },
  {
    q: 'What does a low IPC (instructions per cycle) suggest?',
    a: 'The core is mostly waiting, usually for memory. The fix is better locality or fewer bytes moved, not fewer instructions.',
  },
  {
    q: 'What is eBPF, and why does it suit production tracing?',
    a: 'A way to run small, kernel-verified programs on kernel events. They summarise data inside the kernel, so tracing costs little.',
  },
  {
    q: 'Why is strace risky on a busy production process?',
    a: 'It stops the process on every system call to report it, which can slow it down many times. perf trace or eBPF tools cost far less.',
  },
  {
    q: 'Why does latency explode near 100% utilization?',
    a: 'Bursts queue behind each other and the queue drains slowly. In the simplest model the wait is busy/(1 − busy) service times: 9× at 90%, 19× at 95%.',
  },
  {
    q: 'Why does fan-out make tail latency worse?',
    a: 'A request that waits for many backends is as slow as the slowest. With 100 backends each slow 1% of the time, about 63% of requests hit a slow one.',
  },
  {
    q: 'What is coordinated omission?',
    a: 'A load generator that waits for each reply sends fewer requests while the server stalls, so the stalls barely appear in the results.',
  },
  {
    q: 'Why can’t you average p99 values across hosts?',
    a: 'Percentiles do not combine by averaging. Merge the underlying latency histograms, then compute the percentile.',
  },
]
