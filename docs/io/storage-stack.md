---
title: 14. The Storage Stack
---

<script setup>
import { cards } from './storage-stack-review'
</script>

# 14. The Storage Stack

The storage stack is everything between a file system and the physical bits: the kernel's block layer, the
device driver, and the drive itself, which has its own processor, memory and firmware. Interviewers probe it
to see whether you can reason about disk latency, why SSDs slow down, and what "the data is safely on disk"
really rests on.

::: info Before you start
- A file system turns named files into numbered **blocks** on a device. <Term id="fsync">`fsync`</Term> is the call that asks for a
  file's data to be made durable. [Chapter 13](/io/file-systems) covers both.
- The kernel keeps file data in RAM in the <Term id="page-cache">page cache</Term>, and writes changed pages
  to disk later.
- A device copies data to and from RAM by itself using <Term id="dma">DMA</Term>, and signals the CPU with an
  <Term id="interrupt">interrupt</Term> when it is done.
:::

## The layers

**In short:** a request goes from the file system to the block layer, which queues it for a driver, which
sends a command to the drive. The drive then runs its own software before anything reaches the media.

<StorageStackDiagram />

Follow one `read` that misses the page cache:

1. **The file system** works out which blocks on the device hold the requested part of the file.
2. **The block layer** turns that into a request: "read 8 blocks starting at block 5,120". It may merge the
   request with its neighbours or reorder it, then puts it on a queue for the device.
3. **The driver** turns the request into the device's own command format and hands it to the hardware.
4. **The drive's controller** runs firmware on its own small processor. On an SSD, it looks up where the data
   really is in flash. On a hard disk, it moves the head.
5. **The device** copies the data into RAM with DMA and raises an interrupt. The request travels back up, and
   the waiting thread wakes.

Two facts from this picture matter for the rest of the chapter. First, the drive is a computer of its own,
with its own RAM cache, and the kernel cannot see inside it. Second, the "disk" may not be local at all. On a
cloud machine it is often a network service that looks like a disk to the kernel.

## Hard disks, SSDs and NVMe

**In short:** a hard disk must physically move to each random location, so it does about a hundred random
reads per second. An SSD has no moving parts and does tens of thousands to over a million.

### Hard disks

A hard disk (HDD) stores data on spinning magnetic platters. A head on an arm reads and writes them. A
random read has two mechanical delays:

- **Seek:** moving the arm to the right track, a few milliseconds.
- **Rotation:** waiting for the right spot to spin under the head. At 7,200 rpm, one turn takes 8.3 ms, so
  about 4 ms on average.

So a random read takes around 5 to 10 milliseconds, and a disk manages roughly **100 to 200 random reads
per second**. Reading **sequentially** avoids both delays and reaches a few hundred MB/s. That gap, 100 times
or more, is why so much storage software was designed around sequential access: logs, log-structured
databases, and Kafka's append-only files.

### SSDs

A solid-state drive (SSD) stores data in **flash memory** chips. There is nothing to move, so a random read
takes tens of microseconds. That is about 100 times faster than a hard disk. An SSD also contains many flash
chips that work in parallel, so it can serve many requests at once.

### The interface: SATA and NVMe

The first SSDs used **SATA**, the connection designed for hard disks. SATA limits throughput to about 550
MB/s, and its command interface has one queue of 32 requests.

**NVMe** connects SSDs directly to the CPU's PCIe bus, with an interface designed for flash. It allows up to
tens of thousands of queues, each with thousands of requests. Linux gives each CPU core its own queue, so
cores do not fight over one lock. A modern NVMe drive reaches several GB/s and hundreds of thousands to over
a million random reads per second, **if** enough requests are in flight.

| | Hard disk | SATA SSD | NVMe SSD |
|---|---|---|---|
| **Random 4 KiB read** | 5–10 ms | about 100 µs | tens of µs |
| **Random reads per second** | 100–200 | tens of thousands | hundreds of thousands to millions |
| **Sequential throughput** | 100–250 MB/s | about 500 MB/s | several GB/s |
| **Parallel requests** | Few help | 1 queue of 32 | many deep queues |

These are orders of magnitude. Exact numbers depend on the model, how full the drive is, and whether you
read or write.

::: details Going deeper: more device details
- Writes to an SSD often complete faster than reads, in around 10 to 30 µs, because the drive acknowledges
  them from its own RAM or fast cache. Sustained writes are a different story (see the SSD internals section).
- **SMR** (shingled) hard disks overlap tracks to fit more data. Random writes to them can be very slow,
  because rewriting one track disturbs its neighbours. They suit archives, not databases.
- Intel's Optane (3D XPoint) drives had read latencies around 10 µs, far below flash, but were discontinued
  in 2022.
- PCIe 4.0 NVMe drives reach about 7 GB/s; PCIe 5.0 about twice that.
:::

## Latency, throughput and queue depth

**In short:** an SSD is fast only when it has many requests to work on at once. A program that issues one
read at a time sees the latency, not the throughput.

Suppose one read takes 100 µs. A thread that reads one block, waits, then reads the next, can do at most
10,000 reads per second (1 second / 100 µs). The drive's data sheet may say 1,000,000. The difference is
**queue depth**: how many requests are in flight at the same time.

This follows a simple rule, known as **Little's law**:

```text
throughput = requests in flight / latency
10,000/s   = 1                  / 100 µs
640,000/s  = 64                 / 100 µs
```

As long as the drive has spare internal parallelism, more requests in flight give more throughput. Past that
point, latency rises instead. So to use a fast SSD, a program must keep many requests in flight:

- **Many threads**, each doing blocking reads.
- **Asynchronous I/O**, such as <Term id="io-uring">io_uring</Term>, where one thread submits many requests
  at once. [Chapter 12](/io/io-models) covers it.
- **Large requests**, which let the drive work on many chips for one request.

### Try it: device latency versus page cache

This program reads random 4 KiB blocks from a file, one at a time. First it bypasses the page cache with
`O_DIRECT`, so every read goes to the device. Then it reads through the page cache, after loading the whole
file into it.

```c
// randread.c: gcc -O2 -Wall randread.c -o randread && ./randread testfile
// Times random 4 KiB reads, one at a time: from the device (O_DIRECT), then from the page cache.
#define _GNU_SOURCE
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define FILE_SIZE (256L << 20)   // 256 MiB
#define BLOCK 4096
#define N 5000

static double now_us(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1e6 + ts.tv_nsec / 1e3;
}
static int cmp(const void *a, const void *b) {
    double x = *(const double *)a, y = *(const double *)b;
    return (x > y) - (x < y);
}

static void measure(const char *label, int fd, char *buf) {
    static double lat[N];
    srand(42);                                   // same offsets for both runs
    for (int i = 0; i < N; i++) {
        off_t off = (off_t)(rand() % (FILE_SIZE / BLOCK)) * BLOCK;
        double t = now_us();
        if (pread(fd, buf, BLOCK, off) != BLOCK) { perror("pread"); exit(1); }
        lat[i] = now_us() - t;
    }
    qsort(lat, N, sizeof lat[0], cmp);
    printf("%-18s p50 %7.1f us   p99 %7.1f us   => about %6.0f reads/s\n",
           label, lat[N / 2], lat[N * 99 / 100], 1e6 / lat[N / 2]);
}

int main(int argc, char **argv) {
    if (argc != 2) { fprintf(stderr, "usage: %s FILE\n", argv[0]); return 1; }
    char *buf;
    if (posix_memalign((void **)&buf, BLOCK, BLOCK)) return 1;   // O_DIRECT needs alignment

    // Create the test file once (written through the page cache, then fsync'd).
    int fd = open(argv[1], O_RDWR | O_CREAT, 0644);
    if (fd < 0) { perror("open"); return 1; }
    memset(buf, 'x', BLOCK);
    if (lseek(fd, 0, SEEK_END) < FILE_SIZE) {
        for (long off = 0; off < FILE_SIZE; off += BLOCK)
            if (pwrite(fd, buf, BLOCK, off) != BLOCK) { perror("pwrite"); return 1; }
        fsync(fd);
    }

    int dfd = open(argv[1], O_RDONLY | O_DIRECT);       // bypasses the page cache
    if (dfd < 0) { perror("open O_DIRECT (tmpfs does not support it)"); return 1; }
    measure("device (O_DIRECT)", dfd, buf);

    for (long off = 0; off < FILE_SIZE; off += BLOCK)   // read it all once: now it is cached
        if (pread(fd, buf, BLOCK, off) != BLOCK) { perror("pread"); return 1; }
    measure("page cache", fd, buf);
    return 0;
}
```

Output from one run on a cloud virtual machine's SSD-backed disk:

```text
device (O_DIRECT)  p50    53.6 us   p99   132.3 us   => about  18653 reads/s
page cache         p50     1.3 us   p99     9.8 us   => about 757575 reads/s
```

Run it on a directory on a real disk, not on `/tmp` if that is `tmpfs`. Your numbers will differ a lot. On a
hard disk the first line shows milliseconds. Two lessons hold everywhere:

- The page cache is 10 to 1,000 times faster than the device. Whether data is cached decides performance.
- One read at a time gives only tens of thousands of reads per second, even from a fast SSD. The drive can
  do far more with more requests in flight.

::: tip Measuring for real
For serious measurements, use `fio`. It controls queue depth, block size, read/write mix and the I/O
interface, and reports latency percentiles. Always test a drive in the state it will run in: a new, empty SSD
is much faster at writing than one that has been full for weeks.
:::

## Inside an SSD: the flash translation layer

**In short:** flash cannot be overwritten in place, only erased in large blocks. The SSD hides this with a
translation layer that writes every change to a fresh location. The cost shows up as garbage collection,
extra writes and wear.

### The rules of flash

Flash memory has awkward rules:

- It is read and written in **pages**, typically 4 to 16 KiB.
- A page can be written only when it is empty. You cannot overwrite it.
- Pages are emptied by **erasing**, and erasing works only on a whole **erase block**: hundreds of pages,
  several MiB.
- Each erase wears the cells a little. After some thousands of erase cycles (fewer for denser flash), a
  block becomes unreliable.

So an SSD cannot do what the OS asks, "overwrite block 2", directly. Erasing a whole erase block to change
4 KiB would be very slow and would wear the flash out quickly.

### The translation layer

Instead, the SSD's firmware runs a <Term id="ftl">flash translation layer (FTL)</Term>. It keeps a map from
each block number the OS uses to the flash page that currently holds it. On every write:

1. It writes the new data to an **empty page**, somewhere else.
2. It updates the map, so the block number points to the new page.
3. It marks the old page **stale**.

<FtlDiagram />

The OS sees the same block numbers it always did. Inside, the data wanders around the flash.

### Garbage collection and write amplification

Stale pages pile up, and empty pages run out. So the SSD runs **garbage collection** in the background:

1. Pick an erase block with many stale pages.
2. Copy its remaining valid pages to empty pages elsewhere.
3. Erase the whole block, making all its pages empty again.

Step 2 is extra writing that the OS never asked for. The ratio between what the SSD writes to flash and what
the OS wrote is called <Term id="write-amplification">write amplification</Term>. A ratio of 3 means every
1 GB your program writes costs 3 GB of flash writes, using up three times the wear and bandwidth.

Garbage collection also competes with your requests. When the drive is nearly full and under heavy writes,
it must collect constantly. Writes slow down, and read latency gets spikes, because a read can wait behind
an erase. This is a common source of **tail latency** on busy databases.

### What helps

- **Free space.** The more empty space the SSD has, the easier it is to find erase blocks that are mostly
  stale. Every SSD hides some extra capacity for this, called **over-provisioning**. Enterprise drives hide
  more. Leaving part of a drive unused has a similar effect.
- **TRIM.** When a file is deleted, the SSD does not know its blocks are free; it keeps copying them during
  garbage collection. The TRIM command (called "discard" in Linux) tells it. Most distributions run
  `fstrim` weekly, or file systems can be mounted with `discard` to send it continuously.
- **Sequential, large writes.** Data written together tends to become stale together, so whole erase blocks
  empty out at once. This is one reason log-structured designs suit flash.

### Wear and the SLC cache

The FTL also spreads writes evenly across all blocks, so no block wears out early. This is **wear
leveling**. Drives state their endurance as total terabytes written (TBW) or drive writes per day (DWPD) over
the warranty period. `smartctl -a` or `nvme smart-log` shows how much has been used.

Many consumer drives store several bits per flash cell (TLC, QLC), which is dense but slow to write. To look
fast, they first write into a part of the flash used in fast one-bit mode (an "SLC cache"). A long burst of
writes can fill that cache. Then write speed drops sharply, sometimes below that of a hard disk. Short
benchmarks never show this.

::: details Going deeper: FTL numbers and newer designs
- The mapping table takes about 4 bytes per 4 KiB page, roughly 1 GB of RAM per TB of flash. Cheap
  "DRAM-less" drives keep only part of it in RAM, or borrow host memory (NVMe's Host Memory Buffer). They slow
  down on random access over large areas.
- Rough flash timings: reading a page takes tens of µs, writing a page hundreds of µs, erasing a block
  milliseconds. The drive hides these with parallelism and caching.
- Software has write amplification too. An LSM-tree database (RocksDB, Cassandra) rewrites data several times
  during compaction. A B-tree database rewrites a whole page to change a few bytes. The factors multiply with
  the SSD's own.
- **Zoned namespaces (ZNS)** and **flexible data placement (FDP)** let the host tell the drive which data
  belongs together, or take over placement entirely, to cut write amplification. Adoption is still limited.
:::

## The block layer and I/O schedulers

**In short:** the block layer merges and queues requests on their way to the driver. On fast NVMe drives it
mostly stays out of the way. Scheduling matters more on hard disks.

The block layer sits between file systems and drivers. It does three main jobs:

- **Merging.** Two requests for neighbouring blocks become one larger request. Fewer, larger requests are
  cheaper for every device.
- **Queueing.** Each CPU core has its own software queue, mapped to the device's hardware queues. This
  design (called **blk-mq**, multi-queue) lets many cores submit I/O without sharing a lock.
- **Scheduling.** An optional I/O scheduler may reorder requests before they reach the device.

### I/O schedulers

On a hard disk, order matters a lot. Serving requests in order of position on the disk avoids seeks, the way
an elevator stops at floors in order instead of in the order the buttons were pressed. On an SSD, position
does not matter, and the drive reorders internally anyway.

| Scheduler | What it does | Typical use |
|---|---|---|
| `none` | No reordering. Lowest CPU overhead. | NVMe SSDs (the usual default) |
| `mq-deadline` | Sorts requests, but gives each a deadline so none waits forever. Favours reads. | Hard disks, SATA SSDs |
| `bfq` | Shares disk time fairly between processes. Higher overhead. | Desktops, slow devices |
| `kyber` | Limits queue depth to hit latency targets. | Fast devices with mixed workloads |

You can see and change the scheduler for each device:

```bash
cat /sys/block/nvme0n1/queue/scheduler       # [none] mq-deadline kyber bfq
```

### Reading iostat

`iostat -x 1` is the first tool for storage questions. The columns that matter most:

- `r/s`, `w/s`: requests per second.
- `rareq-sz`, `wareq-sz`: average request size. Small random requests are the expensive kind.
- `r_await`, `w_await`: average time per request in milliseconds, **including** time spent queued.
- `aqu-sz`: average number of requests in flight: the queue depth.
- `%util`: the share of time the device had at least one request. On an SSD this can read 100% while the
  drive still has plenty of spare capacity, because it serves many requests in parallel. Do not read it as
  "saturated".

::: details Going deeper: block layer details
- A request starts life as a **bio**, a description of one I/O. The block layer merges bios into
  **requests**. Before submitting, a thread briefly **plugs** its queue to collect bios that can be merged,
  then unplugs.
- blk-mq arrived in Linux 3.13, and the old single-queue path was removed in 5.0.
- Throttling and weights per <Term id="cgroup">cgroup</Term> (`io.max`, `io.weight`, `io.latency`) live in
  the block layer. That is how container platforms limit a noisy neighbour's disk use.
- Very fast devices can be **polled** instead of raising an interrupt per request, trading CPU for latency.
  io_uring exposes this for `O_DIRECT` I/O.
:::

## What durability actually guarantees

**In short:** durability is a chain. `fsync` works only if every layer below it passes the flush along and
keeps its promise. Even then, durability means surviving power loss, not disk failure or mistakes.

### The chain

[Chapter 13](/io/file-systems) showed that `fsync` writes a file's dirty pages and metadata and waits. The
last link is the drive's own **write cache**: RAM inside the drive where writes land first. Most drives
report a write as complete as soon as it reaches that cache. If power fails, whatever is only in the cache is
lost.

So after the data is written, the kernel must make the drive commit it. There are two tools:

- **Cache flush:** a command meaning "put everything in your cache on stable media, then answer".
- **FUA** (force unit access): a flag on one write meaning "do not answer until this write is on stable
  media".

File systems use both. A journal commit, for example, flushes the entries before it and writes the commit
record with FUA. This is how `fsync` reaches all the way down.

### Drives that do not need flushing

Enterprise SSDs usually have **power-loss protection**: capacitors that hold enough energy to write the cache
to flash if power fails. Their cache is effectively safe. Such drives tell the kernel their cache is
"write through", the kernel skips flush commands, and `fsync` becomes much faster. This is the main reason
`fsync` takes tens of microseconds on a data-centre SSD but milliseconds on a laptop SSD.

```bash
cat /sys/block/nvme0n1/queue/write_cache     # "write back" = volatile cache, flushes are sent
```

### Where the chain can break

Every link must keep its promise. Known ways it breaks:

- **Drives that lie.** Some consumer drives have acknowledged flushes without finishing them. Power-cut tests
  have found such models. You cannot detect this in software.
- **<Term id="raid">RAID</Term> controllers**, cards that combine several disks into one (see below), with a
  write-back cache and no working battery or flash backup.
- **Virtual machines.** The hypervisor may cache the virtual disk's writes on the host, and some cache
  settings ignore flushes entirely for speed.
- **Disabled safety.** Mount options or settings that turn off flushes, used for benchmarks and forgotten.
- **Network storage.** A cloud disk acknowledges a write after its own replication rules are satisfied. Read
  its documentation to know what an acknowledged flush guarantees.

### Torn writes

Durability also has a **size**. A drive promises that a single sector (512 bytes or 4 KiB) is written
completely or not at all. It usually does not promise that for anything larger. A database page is often 8 or
16 KiB. If power fails during that write, the page can end up half old and half new: a **torn write**.

Databases guard against this themselves. PostgreSQL writes a full copy of each page to its log the first
time the page changes after a checkpoint (`full_page_writes`). MySQL's InnoDB writes pages to a separate
"doublewrite" area first. After a crash, they restore torn pages from the good copy. Recent Linux kernels
(from 6.11) add an interface for larger atomic writes on hardware that supports them.

### What durability does not cover

"Durable" means the data survives a crash or power loss. It does not protect against:

- **Device failure.** The drive dies, and everything on it is gone. You need copies on other devices: RAID,
  or replication to other machines.
- **Silent corruption.** A drive or cable can return wrong data without an error. Checksums catch it:
  btrfs and ZFS checksum everything; databases checksum their pages.
- **Mistakes.** A bug or a person deletes the data, and every replica deletes it too. Only backups, kept
  separately and tested by restoring them, protect against this.

## RAID basics

**In short:** RAID combines several disks into one device, for speed, for survival of a disk failure, or
both. It protects against a dead disk, not against deletion or corruption.

RAID (redundant array of independent disks) spreads data across disks in one of a few standard layouts:

<RaidDiagram />

| Level | Layout | Survives | Usable capacity | Writes |
|---|---|---|---|---|
| **RAID 0** | Stripes: chunks alternate across disks | Nothing: one failure loses everything | All disks | Fast |
| **RAID 1** | Mirror: every disk holds a full copy | All but one disk | One disk | Each write goes to every disk |
| **RAID 5** | Stripes plus one parity chunk per row | One disk | All but one disk | Small writes cost 4 I/Os |
| **RAID 6** | Stripes plus two parity chunks per row | Two disks | All but two disks | Small writes cost 6 I/Os |
| **RAID 10** | Stripes across mirrored pairs | One disk per pair | Half | Fast |

**Parity** is the XOR of the data chunks in a row. If any one chunk is lost, XOR-ing the others with the
parity rebuilds it. The cost comes on small writes. To change one chunk, RAID 5 must read the old chunk and
the old parity, then write the new chunk and the new parity: four I/Os for one write. That is why databases
with many small random writes prefer RAID 10.

### Rebuilds and the write hole

When a disk fails, the array keeps working in a **degraded** state, and a replacement disk must be
**rebuilt** by reading every other disk in full. With large hard disks, a rebuild takes many hours or days.
During that time, a second failure, or an unreadable sector on another disk, can lose data. This is why
RAID 5 with large hard disks is considered risky, and RAID 6 or RAID 10 is preferred.

The **write hole** is a crash consistency problem. A RAID 5 write updates a data chunk and its parity, on
different disks. A crash between the two leaves parity that does not match the data. Nothing notices until
a disk fails and the wrong parity rebuilds wrong data. Fixes include a battery-backed controller cache, a
write journal (Linux's software RAID offers one), or ZFS's RAID-Z, which never updates in place.

### RAID is not a backup

RAID keeps data available when a disk dies. A deleted file, a corrupted table or ransomware is copied to
every disk instantly. You still need backups.

::: details Going deeper: RAID in practice
- Linux software RAID is `md`, managed with `mdadm`. `cat /proc/mdstat` shows array state and rebuild
  progress. Hardware RAID controllers do the same in firmware.
- Hard disk data sheets quote an unrecoverable read error rate, often 1 in 10<sup>14</sup> bits for consumer
  drives, about one error per 12.5 TB read. Real drives often do better, but the figure explains why rebuilds
  of large arrays are nervous moments.
- Large distributed storage systems usually replicate data across machines, or use **erasure coding**: a
  generalisation of RAID 6 that splits data into k chunks plus m parity chunks, surviving any m losses.
:::

## Why this matters in real systems

**Cloud disks have budgets.** A network-attached cloud volume has a limit on operations per second and on
throughput, set by its size or by what you pay for. Some volumes also have burst credits that run out. When a
database suddenly slows down, check whether it hit its volume's limit before anything else. Local NVMe drives
on cloud machines are far faster but usually lose their data when the machine stops.

**Databases and fsync latency.** A database that commits one transaction per `fsync` is limited by flush
latency: perhaps a few hundred commits per second on a consumer SSD, many thousands on an enterprise SSD with
power-loss protection. Group commit and the right hardware matter more than CPU.

**SSD tail latency.** A database on a nearly full SSD under heavy writes can see read latency jump from
around 100 µs to many milliseconds during garbage collection. Keeping free space, running TRIM, and choosing
enterprise drives with more over-provisioning reduce it.

**ML training data.** Training jobs read huge datasets many times, often as many small files or random
samples. Local NVMe with enough requests in flight, or data packed into large sequential shards, keeps GPUs
busy. Many small random reads from network storage leave them idle.

**Writing checkpoints.** Saving the state of a large model means writing tens or hundreds of GB quickly.
Throughput, not latency, is the limit. Writing in large sequential chunks and in parallel across files or
devices helps.

**How to look:**

```bash
lsblk -o NAME,ROTA,SIZE,MODEL          # devices; ROTA=1 means rotating (hard disk)
iostat -x 1                             # per-device requests, sizes, latency, queue depth
cat /sys/block/<dev>/queue/scheduler    # I/O scheduler
smartctl -a /dev/<dev>                  # health and wear (nvme smart-log for NVMe)
fio --name=r --rw=randread --bs=4k --iodepth=32 --ioengine=io_uring --direct=1 --size=1G
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. Why is a random read on a hard disk so much slower than on an SSD?
A hard disk must move its arm to the right track (a few milliseconds) and wait for the platter to rotate to
the right spot (about 4 ms on average at 7,200 rpm). So a random read takes 5 to 10 ms, and the disk manages
100 to 200 per second. An SSD has no moving parts and reads flash in tens of microseconds.

**Senior add-on:** sequential reads on a hard disk avoid both delays, so the gap between sequential and
random is 100 times or more. That is why logs, LSM trees and Kafka favour sequential writes. On SSDs the gap
is much smaller but still exists, mainly because of write amplification.
:::

::: details 2. The SSD's data sheet says 1 million IOPS, but your service gets 15,000. Why?
Probably queue depth. The data sheet figure needs many requests in flight at once, often 32 to 256. A
program that reads one block at a time and waits is limited to 1 / latency: at 70 µs per read, about 15,000
per second. Throughput equals requests in flight divided by latency.

Fix it with more concurrency: more threads, asynchronous I/O such as io_uring, or larger requests.

**Senior add-on:** also check whether you measure a cloud volume with its own limits, whether the page cache
is in the way, and whether the drive is in a steady state. `iostat -x` shows the queue depth you really
achieve (`aqu-sz`).
:::

::: details 3. What is the flash translation layer, and why does an SSD need it?
Flash cannot be overwritten in place. Pages can only be written when empty, and emptying works only on
whole erase blocks of several MiB. The FTL hides this. It keeps a map from each logical block to a flash
page, writes every update to a fresh page, updates the map, and marks the old page stale.

**Senior add-on:** the FTL also does garbage collection, wear leveling and bad block management. Its map
needs about 1 GB of RAM per TB. DRAM-less drives keep only part of it, which hurts random access.
:::

::: details 4. What is write amplification, and how do you reduce it?
The SSD writes more to flash than the host asked for, because garbage collection copies still-valid pages
out of erase blocks before erasing them. The ratio of flash writes to host writes is the write amplification.

Reduce it with more free space (over-provisioning, not filling the drive), TRIM so the drive knows which
blocks are free, and large sequential writes so whole erase blocks become stale together.

**Senior add-on:** software adds its own amplification: LSM compaction, B-tree page rewrites, journaling,
torn-page protection. The factors multiply. ZNS and FDP let the host control placement to cut it further.
:::

::: details 5. Why do SSDs sometimes have terrible tail latency?
Garbage collection competes with your requests. When the drive is nearly full and under heavy writes, it
must move data and erase blocks constantly. A read can wait behind an erase, which takes milliseconds.
Consumer drives can also exhaust their fast SLC write cache and slow down sharply.

**Senior add-on:** mitigations are free space and over-provisioning, TRIM, enterprise drives designed for
consistent latency, and testing in steady state rather than on a fresh drive. At the application level,
issuing a duplicate read to a replica after a timeout (hedged requests) hides some of the tail.
:::

::: details 6. fsync returned. What had to happen in the hardware for the data to be really durable?
The file system wrote the file's data and metadata to the drive. Then the drive had to put that data on
stable media, not only in its volatile RAM cache. The kernel makes sure of that with a cache flush command or
FUA writes, and the drive must honour them.

On drives with power-loss protection, the cache is safe because capacitors can write it out on power loss,
so no flush is needed.

**Senior add-on:** the chain can break: drives that acknowledge flushes falsely, RAID controllers with an
unprotected write-back cache, hypervisor cache modes that ignore flushes, or disabled barriers. And
durability is not redundancy: a dead drive loses durable data too.
:::

::: details 7. What is a torn write, and how do databases handle it?
Drives only promise that a single sector (512 bytes or 4 KiB) is written atomically. A database page of 8 or
16 KiB may be half written if power fails in the middle, leaving a mix of old and new data.

PostgreSQL writes a full image of each page to its write-ahead log the first time it changes after a
checkpoint, and restores torn pages from there. MySQL InnoDB writes pages to a doublewrite buffer before
writing them in place.

**Senior add-on:** copy-on-write file systems like ZFS avoid torn pages because they never overwrite in place,
so some deployments turn off the database's own protection there. Newer drives and Linux 6.11+ offer larger
atomic writes.
:::

::: details 8. Which I/O scheduler would you use for an NVMe drive, and why?
Usually `none`. An NVMe drive has many hardware queues and reorders requests internally, and seek time does
not exist. A scheduler would only add CPU overhead and latency.

For a hard disk, `mq-deadline` helps: it sorts requests by position to reduce seeks, with deadlines so
none starves. `bfq` suits desktops where fairness between processes matters.

**Senior add-on:** on shared hosts, fairness is usually done with cgroup I/O controls (`io.max`,
`io.weight`, `io.latency`) instead of the scheduler.
:::

::: details 9. Compare RAID 1, 5, 6 and 10. Which would you pick for a write-heavy database?
RAID 1 mirrors: simple, survives a disk loss, half the capacity. RAID 5 stripes with one parity chunk: good
capacity, survives one disk, but every small write costs four I/Os. RAID 6 adds a second parity and
survives two disks, at six I/Os per small write. RAID 10 stripes over mirrors: fast writes, half capacity.

For a write-heavy database, RAID 10: no parity penalty, and fast rebuilds that only copy one mirror.

**Senior add-on:** mention the RAID 5 write hole and the risk of long rebuilds on large disks. And RAID is
not backup: deletes and corruption are mirrored instantly.
:::

::: details 10. Scenario: database latency rose sharply on a cloud VM, but CPU is low. How do you check storage?
1. `iostat -x 1`: look at `r_await`/`w_await` (latency), `aqu-sz` (queue depth) and request sizes.
2. Compare the operations and throughput with the volume's provisioned limits, and check burst credits.
3. Check whether the working set still fits in RAM. A drop in page cache hits turns into many more disk
   reads.
4. Look for other writers on the same volume: backups, compaction, log shipping.
5. Check `fsync` latency with `strace -T` or database metrics.

**Senior add-on:** separate the write-ahead log onto its own volume, so commit latency does not wait behind
bulk I/O. For local SSDs, check wear and fullness, which affect garbage collection.
:::

## Common misconceptions

- **"An SSD is always fast."** Only with enough requests in flight, and only while garbage collection keeps
  up. One read at a time from a nearly full, busy drive can be slow.
- **"`%util` at 100% means the disk is saturated."** On SSDs it only means at least one request was always
  in flight. The drive may handle much more.
- **"`fsync` puts data on the platter or flash."** Only if the drive honours flushes, or has power-loss
  protection. Some layers can break that promise.
- **"Deleting a file frees space on the SSD."** Only once TRIM tells the drive. Until then, it keeps copying
  the dead data.
- **"RAID is a backup."** It protects against a dead disk only. Deletes and corruption reach every copy.
- **"Durable means safe."** Durable means it survives a crash. A dead drive, silent corruption or a bad
  delete still loses it.

## Key takeaways

- The stack runs **file system → block layer → driver → drive**, and the drive is a computer with its own
  cache and firmware.
- Hard disks do about **100 to 200** random I/Os per second; SSDs do many thousands, but only with many
  requests in flight: **throughput = in flight / latency**.
- Flash cannot be overwritten, so the **FTL** remaps writes, and **garbage collection** causes write
  amplification, wear and tail latency. Free space and TRIM help.
- Durability depends on **flushes or FUA** reaching a drive that honours them, or on **power-loss
  protection**. Only single sectors are written atomically.
- **RAID** survives disk failure, not mistakes. RAID 10 suits write-heavy databases; parity RAID pays on
  small writes and on rebuilds.

## Review

<Flashcards id="storage-stack" :cards="cards" />

<MarkDone id="storage-stack" />
