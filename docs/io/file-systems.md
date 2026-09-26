---
title: 13. File Systems
---

<script setup>
import { cards } from './file-systems-review'
</script>

# 13. File Systems

A file system turns a disk, which only stores numbered blocks, into named files and folders that survive a
reboot. Interviewers use it to test two things: whether you know what a file really is (inodes, links,
descriptors), and whether you know when written data is actually safe.

::: info Before you start
- A <Term id="file-descriptor">file descriptor</Term> is a small number a process uses to refer to an open
  file. A <Term id="syscall">system call</Term> is how a program asks the <Term id="kernel">kernel</Term> to
  do something, such as `open` or `write`.
- The kernel keeps recently used file data in RAM, in the <Term id="page-cache">page cache</Term>.
  [Chapter 5](/memory/kernel-memory) explains it; this chapter recaps what you need.
- A disk or SSD stores data in fixed-size **blocks**, usually 4 KiB, numbered from zero.
  [Chapter 14](/io/storage-stack) covers the devices themselves.
:::

## What a file system does

**In short:** a file system maps names to bytes, stored in numbered blocks on a device. The kernel puts one
common interface in front of many different file systems.

A drive knows nothing about files. It offers a long row of numbered blocks: "read block 1,000,000" or "write
these 4 KiB to block 42". Everything else is the file system's work:

- **Naming:** turning `/home/ana/notes.txt` into "the data in blocks 5,120 to 5,135".
- **Space management:** tracking which blocks are free, and choosing where new data goes.
- **Metadata:** owner, permissions, size, timestamps.
- **Crash safety:** making sure a power cut in the middle of an update does not corrupt the whole structure.

Linux supports dozens of file systems. The common local ones are **ext4** (the default on many
distributions), **XFS** (common on servers, the default on Red Hat) and **btrfs** (with snapshots and
checksums). Programs do not need to know which one they are using. The kernel's
<Term id="vfs">virtual file system (VFS)</Term> layer gives them all the same calls: `open`, `read`,
`write`, `rename`. Each file system fills in how those calls work.

The VFS also covers things that are not on any disk. `/proc` and `/sys` show kernel information as files.
`tmpfs` keeps files in RAM. Network file systems such as NFS send each call to another machine. Container
images use **overlayfs**, which stacks several directories into one view.

## Inodes: what a file really is

**In short:** a file is an inode: a small record holding everything about the file except its name. Names
live in directories.

Every file has one <Term id="inode">inode</Term> (index node). It is a small fixed-size record, usually a few
hundred bytes, that holds:

- the file's **type** (regular file, directory, symbolic link, device…),
- its **owner**, **group** and **permissions**,
- its **size** and **timestamps** (last modified, last accessed, last changed),
- its **link count**: how many names point to it,
- **where its data is**: a list of block ranges on the device.

Inodes are numbered. `ls -i` shows the number, and `stat` shows everything in the inode:

```text
$ stat notes.txt
  File: notes.txt
  Size: 5120        Blocks: 16         IO Block: 4096   regular file
Device: 259,2       Inode: 812         Links: 1
Access: (0644/-rw-r--r--)  Uid: ( 1000/     ana)   Gid: ( 1000/     ana)
Modify: 2026-03-02 10:14:07.123456789 +0000
```

Notice what is missing: the name. A file does not know what it is called. That design choice explains hard
links, why renaming is cheap, and why deleting a file does not always free its space.

::: details Going deeper: extents and inode limits
- Modern file systems record data locations as **extents**: "4,096 blocks starting at block 1,000,000".
  One extent describes a large continuous file cheaply. Older ext2/ext3 used lists of individual block
  numbers.
- ext4 creates a fixed number of inodes when the file system is made (by default one per 16 KiB of space). A
  disk full of tiny files can run out of inodes while it still has free space. `df -i` shows inode use. XFS
  and btrfs create inodes as needed.
- Very small files and short symbolic links can be stored inside the inode itself, with no data block.
:::

## Directories and links

**In short:** a directory is a list of names and inode numbers. A hard link is a second name for the same
inode. A symbolic link is a small file that holds a path.

A directory is a special file whose contents are a table: "`notes.txt` is inode 812, `photos` is inode
3,301". An entry in that table is a **directory entry**. To open `/home/ana/notes.txt`, the kernel starts at
the root directory, finds `home` in it, opens that directory, finds `ana`, and so on. Each step is one
lookup. The kernel caches recent lookups in RAM, so repeated opens of the same path are fast.

<FileLinksDiagram />

### Hard links

Since names live in directories, nothing stops two entries from pointing to the same inode. `ln notes.txt
backup.txt` creates a second name for inode 812. The two names are equal: neither is the "original". A
change through one name is visible through the other, because there is only one file. This is a
<Term id="hard-link">hard link</Term>.

The inode's link count tracks how many names point to it. Hard links have two limits. They cannot cross file
systems, because inode numbers only mean something inside one file system. And you cannot hard-link a
directory, because that could create loops in the tree.

### Symbolic links

`ln -s notes.txt short` creates a <Term id="symbolic-link">symbolic link</Term> (symlink): a new, separate
inode whose contents are the text `notes.txt`. When a program opens `short`, the kernel reads that text and
looks it up as a path. A symlink can point anywhere, including another file system or a directory. It can
also point to nothing: if `notes.txt` is deleted, the symlink "dangles" and opening it fails.

| | Hard link | Symbolic link |
|---|---|---|
| **What it is** | Another name for the same inode | A separate inode holding a path |
| **Across file systems** | No | Yes |
| **To a directory** | No | Yes |
| **If the target is deleted** | Still works: the file lives on | Dangles |

### Deleting is unlinking

There is no "delete file" system call. There is `unlink`, which removes one **name** and lowers the link
count. The kernel frees the inode and its data only when **both** are true:

- the link count is zero (no names left), and
- no process still has the file open.

This leads to a classic production puzzle. A log file grows to 50 GB, and someone deletes it with `rm`. The
disk stays full, because the program writing the log still has it open. `du` cannot find the space, since no
name points to it any more. `df` still counts it. The space comes back only when that program closes the file
or exits.

```bash
lsof +L1          # open files with no names left: the missing space
```

::: details Going deeper: the caches and rename
- The name-lookup cache is the **dentry cache**. It also remembers names that do **not** exist, so repeated
  failed lookups (common when searching `PATH` or include directories) stay fast. The **inode cache** keeps
  recently used inodes in RAM.
- Opening a path needs execute ("search") permission on every directory along the way, and read permission
  on the file itself.
- `rename` within one file system changes only directory entries, never the data. That is why moving a 10 GB
  file within a disk is instant, while moving it to another disk is a full copy. If the target name exists,
  `rename` replaces it **atomically**: other processes see either the old file or the new one, never neither.
- A program can create a file with no name at all using `O_TMPFILE`, then give it a name later with
  `linkat`.
:::

## File descriptors and the open file table

**In short:** a file descriptor points to an "open file" in the kernel, which holds the current offset. Two
descriptors can share one open file, and then they share the offset.

When a process calls `open`, the kernel creates three layers of state:

1. **The descriptor table**, one per process. The descriptor, such as 3, is an index into this table.
2. **An open file**, in the kernel. It holds the current **offset** (where the next `read` or `write` goes),
   the mode (read, write, append) and a pointer to the inode. The kernel's term is an
   <Term id="open-file-description">open file description</Term>.
3. **The inode**: the file itself.

<FdTableDiagram />

Why three layers? Because different operations share different things:

- **`fork`** copies the descriptor table, but both copies point to the **same** open files. Parent and child
  share one offset. If both write to an inherited log file, their writes land one after another instead of
  overwriting each other.
- **`dup`** (and shell redirection like `2>&1`) makes a second descriptor for the same open file, again with
  a shared offset.
- **A second `open`** of the same path creates a new open file with its own offset. Two independent readers
  do not disturb each other.

`O_APPEND` mode moves the offset to the end of the file as part of each write, in one step. Several processes
appending to one log file therefore do not overwrite each other's lines. Without it, two processes can both
read the same "end" position and write over each other.

::: details Going deeper: offsets, limits and leaks
- `pread` and `pwrite` take an explicit offset and do not use or change the shared one. Multi-threaded
  programs that share a descriptor, such as databases, use them.
- Each process has a limit on open descriptors (`ulimit -n`, often 1,024 by default). Hitting it gives
  `EMFILE`, "Too many open files". A busy server with many sockets needs a higher limit. A limit that is
  reached anyway usually means descriptors are leaking.
- Descriptors survive `exec` unless marked close-on-exec. A child program can then inherit sockets or files it
  should not have. Open with `O_CLOEXEC` to prevent this.
- `/proc/<pid>/fd` lists a process's descriptors, and `/proc/<pid>/fdinfo/<fd>` shows each one's offset and
  flags.
:::

## The page cache and write-back

**In short:** reads and writes go through the page cache in RAM. `write` returns once the data is in RAM, and
the kernel writes it to disk later.

A short recap of [Chapter 5](/memory/kernel-memory). When a program reads a file, the kernel reads the
blocks into the page cache and copies from there. The next read of the same data, by any process, comes from
RAM. The kernel also reads ahead: if a program reads a file in order, it fetches the next blocks before they
are asked for.

Writes also stop in the cache. `write` copies the data into the page cache, marks those pages as
<Term id="dirty-page">dirty</Term> (changed but not yet on disk) and returns. Kernel threads write dirty
pages to disk later, typically within about 30 seconds. This is <Term id="write-back">write-back</Term>. It
makes writes fast, and lets the kernel merge many small writes into a few large ones.

It also means `write` returning says **nothing** about durability. If the machine loses power, dirty pages
are gone. The rest of this chapter is about closing that gap.

::: details Going deeper: delayed allocation
ext4, XFS and btrfs do not even choose disk blocks for new data at `write` time. They wait until write-back,
when they know how much data there is and can place it in one continuous run. This is called **delayed
allocation**. It improves layout, but it widens the window in which new data exists only in RAM. It caused a
famous problem, described in the section on renaming.
:::

## Making data durable: fsync and friends

**In short:** `fsync` forces a file's dirty data and metadata to stable storage and waits. It is the only
standard way to know data will survive a power cut.

A database tells a client "your payment is committed". It had better be true even if the power fails one
millisecond later. On its way to the disk, written data passes through several layers. Each layer is fast,
and each one is lost in some kind of failure:

<DurabilityLayersDiagram />

The drive's cache is easy to forget. Most SSDs and hard disks have their own RAM cache, and they report a
write as done once it reaches that cache. Without a power-loss capacitor, that cache is lost in a power cut.
[Chapter 14](/io/storage-stack) covers drive caches.

### The calls

| Call | What it guarantees when it returns |
|---|---|
| `write` | The data is in the page cache. Nothing about the disk. |
| <Term id="fsync">`fsync(fd)`</Term> | All dirty data **and** metadata (size, timestamps, block locations) of this file are on stable storage. |
| `fdatasync(fd)` | The data, plus only the metadata needed to read it back, such as the size. Skips timestamps. |
| `O_SYNC` / `O_DSYNC` | Each `write` behaves as if followed by `fsync` / `fdatasync`. |
| `sync` / `syncfs` | Flush everything, on all file systems or one. |

A few details that interviewers like to probe:

- **`fsync` works on the file, not on your writes.** It flushes every dirty page of that file, including
  pages other processes wrote.
- **`fsync` includes the drive's cache.** On Linux, it asks the drive to put the data on stable media before
  returning. The drive does this either with a **cache flush** command or by marking writes **FUA** (force
  unit access): "do not acknowledge until this is on stable media".
- **Check the return value.** `fsync` is where write errors are reported. A program that ignores its result
  has no idea whether the data is safe. The fsyncgate section below shows what goes wrong.
- **`fdatasync` is cheaper** when the file size does not change, because it can skip the metadata write.
  That is why databases pre-allocate their log files and then overwrite them.

### What does fsync cost?

`fsync` waits for the device. On an enterprise NVMe SSD with power-loss protection, it can take tens of
microseconds, because the drive can safely acknowledge from its protected cache. On a consumer SSD it often
takes around a millisecond or more, and on a hard disk several milliseconds. Your numbers will vary a lot by
device and file system.

Databases therefore use **group commit**. They collect the commits of many clients, write them to their log
together, and make one `fsync` for all of them. Each client waits a little longer, but the database can
commit thousands of transactions per `fsync`.

### O_DIRECT is not a durability flag

<Term id="o-direct">`O_DIRECT`</Term> makes reads and writes skip the page cache. The data moves straight between your buffer and the
device. Databases with their own cache use it, so they do not keep every page twice in RAM and so the kernel
cannot evict their data behind their back.

But `O_DIRECT` is about **caching**, not **durability**. A direct write can still sit in the drive's volatile
cache. If the write extended the file or filled a hole, the metadata change is still only in RAM. To be
durable you still need `fsync`, `fdatasync`, or `O_DSYNC` together with `O_DIRECT`.

::: details Going deeper: O_DIRECT's rules and traps
- The buffer address, the file offset and the length must usually be multiples of the device's block size
  (512 bytes or 4 KiB). Otherwise the call fails with `EINVAL`. Since Linux 6.1, `statx` can report the
  required alignment.
- Some file systems quietly fall back to buffered I/O for some direct writes. Mixing direct and buffered I/O
  on the same file is slow and hard to reason about.
- `sync_file_range` starts write-back of a byte range, but it neither writes metadata nor flushes the drive
  cache. It is useful to smooth out write-back, but it does not make data durable.
- On macOS, `fsync` does **not** flush the drive's cache. You need `fcntl(fd, F_FULLFSYNC)`. Many portable
  programs got this wrong for years.
- For memory-mapped files, `msync(MS_SYNC)` plays the role of `fsync`.
:::

## Creating and replacing files safely

**In short:** a new file's name lives in its directory, so you must `fsync` the directory too. To replace a
file atomically: write a temporary file, `fsync` it, `rename` it over the old one, then `fsync` the
directory.

### The directory is data too

A program creates `order-1234.json`, writes it, and calls `fsync` on it. After a crash, the file may still be
missing. The `fsync` made the file's inode and data durable. But the **name** is an entry in the directory,
and the directory is a separate file with its own dirty data.

The Linux `fsync` manual page says this directly: `fsync` on a file does not necessarily make its directory
entry durable. For that, open the directory and `fsync` it too. Some file systems happen to persist the entry
anyway, as a side effect of their journal. Portable, correct code does not rely on that.

The same applies to `rename` and `unlink`. They change directories, so they are durable only after an
`fsync` of the directory (both directories, if the file moved between them).

### The atomic replace pattern

How do you update a config file, a checkpoint or a small database file so that a crash leaves either the old
version or the new one, never a half-written mix? You cannot overwrite in place: a crash in the middle leaves
a partial file. The standard answer has four steps:

1. **Write the new contents to a temporary file** in the same directory, such as `settings.txt.tmp`.
2. **`fsync` the temporary file.** Now its data is durable.
3. **`rename` it over the real name.** `rename` replaces the name atomically.
4. **`fsync` the directory.** Now the new name is durable.

The temporary file must be on the same file system, because `rename` cannot cross file systems. That is why
it goes in the same directory, not in `/tmp`.

What goes wrong if you skip step 2? The rename can reach the disk before the data does. After a crash, the
name points to the new inode, but its data was never written: you get an **empty file**. This happened widely
in 2009. ext4's delayed allocation left many users with empty config files after crashes, because desktop
programs renamed without `fsync`. ext4 added a workaround (the `auto_da_alloc` mount option, on by default)
that flushes data when a file is renamed over an existing one. Correct programs do not rely on it.

### Try it: a crash-safe save

This program replaces a file using the four steps, and times each one:

```c
// save.c: gcc -O2 -Wall save.c -o save && ./save settings.txt "volume=11"
// Replaces a file in the current directory so that, after a crash, it holds
// either the old contents or the new ones: never a mix, never empty.
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define CHECK(x) do { if ((x) < 0) { perror(#x); exit(1); } } while (0)

static double t0;
static double now_us(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1e6 + ts.tv_nsec / 1e3;
}
static void step(const char *what) {
    double t = now_us();
    printf("%-28s %9.1f us\n", what, t - t0);
    t0 = t;
}

int main(int argc, char **argv) {
    if (argc != 3) { fprintf(stderr, "usage: %s FILE TEXT\n", argv[0]); return 1; }
    char tmp[4096];
    snprintf(tmp, sizeof tmp, "%s.tmp", argv[1]);   // same directory, same file system

    t0 = now_us();
    int fd = open(tmp, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    CHECK(fd);
    CHECK(write(fd, argv[2], strlen(argv[2])));
    step("1. write temp file");        // data is only in the page cache
    CHECK(fsync(fd));                  // data + inode to stable storage
    step("2. fsync temp file");
    CHECK(close(fd));
    CHECK(rename(tmp, argv[1]));       // atomically swap the name
    step("3. rename over old file");
    int dir = open(".", O_RDONLY | O_DIRECTORY);
    CHECK(dir);
    CHECK(fsync(dir));                 // make the new directory entry durable
    CHECK(close(dir));
    step("4. fsync directory");
    return 0;
}
```

Output from one run on ext4, on a cloud virtual machine's disk:

```text
1. write temp file                   41.8 us
2. fsync temp file                  603.3 us
3. rename over old file              43.2 us
4. fsync directory                  239.6 us
```

Your numbers will differ a lot by device. The pattern is the lesson: `write` and `rename` only touch RAM and
take microseconds. The two `fsync` calls wait for the device and cost 10 to 100 times more. On `tmpfs`,
`fsync` does nothing, so all four steps are fast.

::: tip Real systems use this everywhere
Editors saving files, package managers, Kubernetes updating mounted config maps (which swaps a symlink with
`rename`), and ML training jobs writing checkpoints all rely on "write a temporary, then rename". Object
stores such as S3 are not file systems and have no `rename`. There, the equivalent is to upload the object
under its final name, since a single upload is all-or-nothing.
:::

## When fsync fails: the fsyncgate lesson

**In short:** on Linux, a failed write-back is reported once, and the failed pages may be marked clean. A
retried `fsync` can succeed while the data is lost. The only safe reaction is to treat the failure as fatal
and recover from your own log.

In 2018, PostgreSQL developers found a data-loss bug that came from a wrong assumption about `fsync`. The
discussion became known as **fsyncgate**. PostgreSQL's logic was reasonable-looking: if `fsync` fails, log
the error and try again at the next checkpoint. Surely the kernel still holds the dirty data and will retry
the write?

It does not. On Linux, when background write-back of a page fails, for example because of a disk error:

1. The kernel records the error on the file.
2. On most file systems it marks the page **clean**, or drops it. It does not keep retrying.
3. The next `fsync` on the file reports the error (`EIO`) once.
4. A second `fsync` returns **success**: there are no dirty pages left to write.

So the retry "worked", and the data was gone. Worse, the page cache could still hold the new data, so reads
returned data that was not on disk. In older kernels the error could even be lost entirely: another process's
`fsync` could consume it, or a file opened after the failure might never see it.

The lessons, which apply to any system that stores data:

- **An `fsync` failure is not retryable.** You cannot know which writes were lost.
- **Treat it as a crash.** PostgreSQL's fix (released in early 2019) makes the server stop with a PANIC on
  an `fsync` failure, then recover by replaying its write-ahead log from the last good checkpoint.
- **Keep your own log.** Only data you can re-create from a durable log is safe after an I/O error.

::: details Going deeper: what changed in the kernel
- Linux 4.13 introduced a new way of tracking write-back errors (`errseq_t`). Every open file description
  that existed when the error happened sees it once, on its next `fsync`. Linux 4.16 extended it, so a file
  opened after the error still sees it if nobody has reported it yet.
- What happens to the failed pages still depends on the file system. XFS shuts the whole file system down on
  some metadata errors. On network file systems, write errors can also appear at `close`.
- Research on this topic includes *"All File Systems Are Not Created Equal"* (Pillai et al., OSDI 2014),
  which found crash-consistency bugs in many widely used applications, and *"Can Applications Recover from
  fsync Failures?"* (Rebello et al., USENIX ATC 2020).
:::

## Journaling and crash consistency

**In short:** one file operation changes several blocks. A journal records the whole change first, so after
a crash the file system can finish it or discard it, instead of scanning the entire disk.

### The problem

Appending 4 KiB to a file touches at least three separate places on disk:

- the **free-space map**, to mark a new block as used,
- the **inode**, to record the new block and the new size,
- the **data block** itself.

The disk writes these one at a time. If the power fails between them, the file system is inconsistent. The
inode might point to a block the free-space map still calls free, so another file could later be given the
same block. Or the size might say 4 KiB more while the block holds old data from a deleted file.

Old file systems fixed this at boot with a tool called **fsck**, which scanned the whole disk for such
mismatches. On a large disk, that took hours.

### The fix: write the plan first

A <Term id="journaling">journaling</Term> file system keeps a small area on disk called the **journal**. For
each update:

1. **Write the changes to the journal**: "I am about to change these blocks to these values".
2. **Write a commit record** once all of them are in the journal. This single small write is the moment the
   update "happens".
3. **Apply the changes** to their real locations, in the background.
4. **Free the journal space** once they are applied.

After a crash, the file system reads the journal. Updates with a commit record are replayed. Updates without
one are thrown away, as if they never started. Recovery takes seconds, because only the journal is read. This
is the same **write-ahead logging** idea databases use.

### What the journal protects, and what it does not

Journaling keeps the **file system's own structures** consistent: inodes, directories, free-space maps. By
default it does not make **your file's contents** consistent. If your program overwrites the middle of a
file and crashes, the file can contain half old and half new data. The file system is fine; your data is not.
That is your program's job, using the patterns above.

ext4 offers three modes, set when mounting:

| Mode | What goes in the journal | After a crash |
|---|---|---|
| `data=ordered` (default) | Metadata only. Data blocks are written **before** the metadata that points to them commits. | New data may be missing, but files never show garbage from other files. |
| `data=writeback` | Metadata only, no ordering. | Recently written files may contain old data from deleted files. |
| `data=journal` | Metadata and data. | Strongest, but all data is written twice. |

XFS journals only metadata, and avoids exposing old data by updating a file's size only after its data is
written.

### Copy-on-write file systems

**btrfs** and **ZFS** take another approach. They never overwrite a block in place. A change writes new
copies of the changed blocks, then new copies of the blocks that point to them, up to the root. The last
step switches the root pointer, in one write. Before that write, the old version is intact; after it, the new
one is.

This gives cheap **snapshots**, since an old root still describes the old version. Both also keep
**checksums** of all data, so they detect silent corruption from the device. The costs are fragmentation for
files that are overwritten in place a lot, such as databases and VM images, and more complex performance.

::: details Going deeper: journal details
- ext4's journal layer is called JBD2. By default ext4 commits the journal every 5 seconds (`commit=5`), so
  metadata changes without `fsync` can be lost for up to about that long, plus data write-back delays.
- The commit record must reach stable media only after the journal entries before it. File systems enforce
  this ordering with cache flushes and FUA writes. Mounting with barriers disabled removed that safety; XFS
  removed the option in Linux 4.19.
- An `fsync` on ext4 or XFS usually forces a journal commit. That commit can include other files' metadata,
  so one program's `fsync` can be slowed by another's activity on the same file system.
- **F2FS**, used on many phones, is a log-structured file system designed for flash storage.
:::

## Why this matters in real systems

**Databases.** A database's durability story is: append the change to a write-ahead log, `fdatasync` the log
(with group commit), then reply to the client. Data files are updated later, and a checkpoint records how
much of the log is no longer needed. Many databases open data files with `O_DIRECT` and manage their own
cache. SQLite, PostgreSQL, MySQL and RocksDB each have documented settings that trade durability for speed by
skipping or delaying `fsync`.

**Disk full, but nothing is using it.** `df` says 100%, `du` finds a fraction of that. Almost always, a
deleted file is still held open, often a rotated log. `lsof +L1` finds it. Restarting or signalling the
process frees the space. Log rotation tools either rename the file and ask the program to reopen its log,
or copy it and truncate the original (`copytruncate`), which can lose lines written in between.

**Running out of inodes.** A service that writes millions of tiny files, such as a cache or a mail spool, can
fill an ext4 file system's inodes while gigabytes remain free. Writes fail with "No space left on device". `df
-i` shows it.

**ML checkpoints.** A training job that writes its checkpoint in place and crashes mid-write loses both the
old checkpoint and the new one. Writing to a temporary name and renaming avoids this. On a shared network
file system, check its consistency rules: some only guarantee other clients see the data after `close`.

**Containers.** A container's root file system is usually overlayfs: read-only image layers with a writable
layer on top. The first write to a large file from the image copies the whole file into the writable layer.
Databases in containers therefore keep their data on a separate volume.

**How to look:**

```bash
stat file; ls -li                 # inode number, link count, size, blocks
df -h; df -i                      # space and inodes
lsof +L1                          # deleted files still open
ls -l /proc/<pid>/fd              # a process's descriptors
strace -e trace=fsync,fdatasync,rename,openat -f <cmd>   # durability calls
grep -E 'Dirty|Writeback' /proc/meminfo                  # data waiting for write-back
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. What is an inode? Where is the file name stored?
An inode is the record for one file: type, owner, permissions, size, timestamps, link count, and where the
data is on disk. It does not contain the name. Names are stored in directories, which map names to inode
numbers.

**Senior add-on:** because names are separate, several names can share an inode (hard links), a rename within
one file system only edits directory entries, and a file's space is freed only when it has no names and no
open descriptors. ext4 creates a fixed number of inodes, so you can run out of them with free space left.
:::

::: details 2. What is the difference between a hard link and a symbolic link?
A hard link is another directory entry pointing to the same inode. All names are equal, and the file lives
until the last name is removed and nobody has it open. It cannot cross file systems or point to a directory.

A symbolic link is a separate small file containing a path. The kernel follows the path at open time. It can
point anywhere, including other file systems and directories, and it breaks if the target is removed.

**Senior add-on:** symlinks are used for atomic switches of whole directories: create a new symlink, then
`rename` it over the old one. Kubernetes config maps and many deployment tools work this way.
:::

::: details 3. You deleted a 50 GB log file, but disk usage did not go down. Why?
`rm` removes a name. The kernel frees the inode and its data only when no names remain **and** no process has
the file open. The program writing the log still has it open, so the space stays used. `du` cannot see it,
because it walks names; `df` counts it.

Find it with `lsof +L1`. Restart the program or signal it to reopen its log.

**Senior add-on:** as an emergency fix, you can truncate the file through `/proc/<pid>/fd/<n>` without
restarting the process. The long-term fix is log rotation that makes the program reopen its log file.
:::

::: details 4. After fork, parent and child write to the same inherited file descriptor. What happens?
They share one open file description, and so one offset. Each write moves the shared offset, so their writes
come one after another instead of overwriting each other. They may still interleave in any order.

If instead each process had called `open` itself, each would have its own offset. They would overwrite each
other's data, unless the file was opened with `O_APPEND`.

**Senior add-on:** name the three layers: per-process descriptor table, kernel-wide open file descriptions
(offset, mode), and inodes. `dup` shares like `fork`; a new `open` does not. `pread` and `pwrite` avoid the
shared offset entirely.
:::

::: details 5. write() returned success. Is the data on disk? How do you make sure?
No. `write` copied the data into the page cache. The kernel writes it to disk later, usually within about 30
seconds. A power failure before then loses it.

Call `fsync` (or `fdatasync`) and check its return value. When it returns 0, the file's data and metadata are
on stable storage, including past the drive's volatile cache.

**Senior add-on:** for a new or renamed file, also `fsync` the directory. `O_DIRECT` does not replace
`fsync`. On macOS, `fsync` does not flush the drive cache; use `F_FULLFSYNC`.
:::

::: details 6. How do you atomically replace a file so a crash never leaves it half-written?
Write the new contents to a temporary file in the same directory. `fsync` it. `rename` it over the target.
Then `fsync` the directory.

`rename` swaps the name atomically, so after a crash the name points to either the complete old file or the
complete new one. The first `fsync` makes sure the new data is on disk before the name can point to it. The
last `fsync` makes the rename itself durable.

**Senior add-on:** skipping the first `fsync` can leave an empty file after a crash, because the rename can
reach disk before the data. This hit many ext4 users in 2009. The temporary must be on the same file system,
since `rename` cannot cross file systems.
:::

::: details 7. fsync returned an error. What should a database do?
Treat it as fatal for the data, not as something to retry. On Linux, a failed write-back is reported once,
and the failed pages may be marked clean. A second `fsync` can return success even though the data never
reached disk.

The safe reaction is to crash, then recover by replaying the write-ahead log from the last checkpoint that is
known to be good.

**Senior add-on:** this is the 2018 PostgreSQL "fsyncgate" issue. PostgreSQL now panics on `fsync` failure.
In kernels before 4.13 and 4.16, a process could miss the error completely.
:::

::: details 8. What is the difference between fsync, fdatasync, O_SYNC, O_DSYNC and O_DIRECT?
`fsync` flushes a file's data and all its metadata. `fdatasync` flushes data and only the metadata needed to
read it back, such as the size, so it skips a write when only timestamps changed. `O_SYNC` and `O_DSYNC`
make every `write` behave as if followed by `fsync` or `fdatasync`.

`O_DIRECT` is different: it skips the page cache. It says nothing about durability. Data can still be in the
drive's cache, and metadata can still be only in RAM.

**Senior add-on:** databases pre-allocate and zero their log files, so later writes do not change the size and
`fdatasync` has no metadata to write. For `O_DIRECT`, buffers, offsets and lengths must be aligned to the
block size.
:::

::: details 9. What does a journaling file system guarantee after a crash, and what does it not?
It guarantees that the file system's structures are consistent: every update to metadata is either fully
applied or not at all. It replays committed updates from the journal and discards incomplete ones, so no
full-disk check is needed.

It does not guarantee that your file contents are consistent or recent. Writes not yet `fsync`'d may be lost,
and an in-place overwrite interrupted by a crash can leave a mix of old and new data.

**Senior add-on:** in ext4's default `data=ordered` mode, data blocks are written before the metadata that
points to them. So files may lose recent data but never show another file's old contents. Copy-on-write file
systems (btrfs, ZFS) get atomicity by never overwriting in place and switching a root pointer.
:::

::: details 10. Why might a database use O_DIRECT instead of the page cache?
It already keeps its own cache, tuned to its access patterns. Using the page cache as well would store every
page twice, and the kernel's eviction choices would compete with the database's. `O_DIRECT` also gives it
control over when I/O happens, and predictable latency.

**Senior add-on:** the costs are strict alignment rules, no read-ahead or write-back merging from the kernel,
and still needing `fsync` or `O_DSYNC` for durability. PostgreSQL, by contrast, has long relied on the page
cache; its direct I/O support is still experimental.
:::

::: details 11. Scenario: writes on a service are usually fast but sometimes stall for seconds. What could the file system be doing?
Check these, roughly in this order:

1. **Dirty-page throttling.** When too much data is dirty, the kernel makes writers wait for write-back.
   Watch `Dirty` and `Writeback` in `/proc/meminfo`.
2. **`fsync` storms.** One large `fsync`, or a journal commit forced by another process, can wait for a lot
   of data. `strace -T` shows slow calls.
3. **The device.** Look at `iostat -x` for queue depth and latency. An SSD doing internal garbage collection
   can stall writes ([Chapter 14](/io/storage-stack)).
4. **A full or fragmented file system**, which makes block allocation slow.

**Senior add-on:** lowering the dirty limits (`vm.dirty_background_bytes`, `vm.dirty_bytes`) smooths out
write-back. Separating a write-ahead log onto its own device keeps log `fsync` calls from waiting behind bulk
data.
:::

## Common misconceptions

- **"A file's name is part of the file."** Names are directory entries. The file is the inode, which may have
  many names or none.
- **"`rm` frees the space."** It removes a name. Space is freed when no names and no open descriptors remain.
- **"`write` saves data to disk."** It saves data to the page cache. Only `fsync` (or a sync flag) makes it
  durable.
- **"`O_DIRECT` means the data is safe on disk."** It skips the page cache, not the drive's cache or the
  metadata. You still need `fsync`.
- **"If `fsync` fails, retry it."** On Linux the error is reported once, and a retry can succeed with data
  lost.
- **"A journaling file system protects my file's contents."** It protects the file system's structure. Your
  data's consistency is your program's job.

## Key takeaways

- A file is an **inode**. Names are **directory entries**. Hard links are extra names; symlinks are small
  files holding a path. Space is freed when no names **and** no open descriptors remain.
- Descriptors point to **open files**, which hold the offset. `fork` and `dup` share them; a new `open` does
  not.
- `write` only reaches the **page cache**. **`fsync`** (and `fdatasync`) make data durable, including past the
  drive's cache. New names need an **`fsync` of the directory**.
- To replace a file safely: **write a temporary file, `fsync`, `rename`, `fsync` the directory**. Treat an
  `fsync` failure as fatal.
- **Journaling** keeps the file system consistent after a crash, not your data. Copy-on-write file systems
  get the same result by never overwriting in place.

## Review

<Flashcards id="file-systems" :cards="cards" />

<MarkDone id="file-systems" />
