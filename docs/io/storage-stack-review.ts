// Flashcards for the Storage Stack chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'What layers does a disk read pass through below the file system?',
    a: 'The block layer (merge, queue, maybe reorder), the device driver (device command format), and the drive’s own controller and firmware, before reaching the media.',
  },
  {
    q: 'Why does a hard disk manage only 100–200 random reads per second?',
    a: 'Each random read needs a seek (a few ms) and on average half a rotation (about 4 ms at 7,200 rpm). Sequential reads avoid both.',
  },
  {
    q: 'What does NVMe change compared with SATA?',
    a: 'It connects the SSD directly to PCIe with many deep queues (one per CPU core in Linux) instead of one queue of 32, so many cores can keep many requests in flight.',
  },
  {
    q: 'Why does a program reading one block at a time not get the SSD’s rated IOPS?',
    a: 'Throughput = requests in flight / latency. At queue depth 1 and 70 µs per read, that is about 15,000 reads per second. The rated figure needs dozens of requests in flight.',
  },
  {
    q: 'What are the rules of flash that make an FTL necessary?',
    a: 'Pages can be written only when empty, and emptying works only on whole erase blocks of several MiB. Cells also wear out with each erase.',
  },
  {
    q: 'What does the FTL do on a write?',
    a: 'Writes the data to an empty page elsewhere, updates its map from logical block to flash page, and marks the old page stale.',
  },
  {
    q: 'What is write amplification, and what causes it?',
    a: 'Flash writes divided by host writes. Garbage collection copies still-valid pages out of an erase block before erasing it, and those copies are extra writes.',
  },
  {
    q: 'How do free space and TRIM help an SSD?',
    a: 'With more free and known-dead pages, garbage collection finds erase blocks that are mostly stale and copies less. TRIM tells the drive which blocks deleted files no longer use.',
  },
  {
    q: 'Why can SSD read latency spike under heavy writes?',
    a: 'Garbage collection competes with reads, and a read can wait behind an erase that takes milliseconds. It is worst when the drive is nearly full.',
  },
  {
    q: 'Why does a consumer SSD’s write speed collapse during long writes?',
    a: 'It first writes into a fast one-bit-per-cell “SLC cache”. When that fills, it must write directly to slower multi-bit flash.',
  },
  {
    q: 'Why is “none” the usual I/O scheduler for NVMe?',
    a: 'There are no seeks to avoid, and the drive reorders internally with many queues. A scheduler would only add CPU overhead and latency.',
  },
  {
    q: 'Why is %util misleading for SSDs?',
    a: 'It measures the time with at least one request in flight. An SSD serves many requests in parallel, so it can show 100% with capacity to spare.',
  },
  {
    q: 'How does fsync get data past the drive’s own cache?',
    a: 'The kernel sends a cache flush command or marks writes FUA (force unit access), so the drive answers only once data is on stable media.',
  },
  {
    q: 'Why is fsync much faster on enterprise SSDs?',
    a: 'Power-loss protection capacitors make their cache safe, so the kernel does not need to send flushes and the drive can acknowledge from RAM.',
  },
  {
    q: 'Name three ways the durability chain can break.',
    a: 'A drive that acknowledges flushes falsely, a RAID controller with an unprotected write-back cache, and a hypervisor cache mode that ignores flushes. Disabled barriers are a fourth.',
  },
  {
    q: 'What is a torn write, and how does PostgreSQL protect against it?',
    a: 'Only a single sector is written atomically, so an 8 KiB page can be half written at power loss. PostgreSQL logs a full page image after each checkpoint and restores from it.',
  },
  {
    q: 'What does durability not protect against?',
    a: 'Device failure (needs redundancy), silent corruption (needs checksums) and mistakes or bugs that delete data (need backups).',
  },
  {
    q: 'Why is RAID 5 bad for small random writes?',
    a: 'Each small write must read the old data and old parity, then write the new data and new parity: four I/Os for one write.',
  },
  {
    q: 'What is the RAID 5 write hole?',
    a: 'A crash between writing data and writing its parity leaves them inconsistent. Nothing notices until a rebuild uses the wrong parity and produces wrong data.',
  },
  {
    q: 'Why is a RAID rebuild a risky time?',
    a: 'The array has no redundancy left, and the rebuild reads every other disk fully for hours or days. A second failure or unreadable sector can lose data.',
  },
]
