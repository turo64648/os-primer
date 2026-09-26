// Flashcards for the File Systems chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'What does the VFS layer do?',
    a: 'It gives programs one set of calls (open, read, write, rename) for every file system, local or not. Each file system implements those calls its own way.',
  },
  {
    q: 'What is in an inode, and what is not?',
    a: 'Type, owner, permissions, size, timestamps, link count and where the data is. Not the name: names live in directories.',
  },
  {
    q: 'Why can a disk with free space fail with “No space left on device”?',
    a: 'It can run out of inodes. ext4 creates a fixed number when the file system is made, so millions of tiny files can use them all up. <code>df -i</code> shows it.',
  },
  {
    q: 'What is a hard link, and why can’t it cross file systems?',
    a: 'A second directory entry pointing to the same inode. Inode numbers only mean something inside one file system, so the entry cannot point into another.',
  },
  {
    q: 'How is a symbolic link different from a hard link?',
    a: 'A symlink is a separate small file holding a path, followed at open time. It can cross file systems and point to directories, and it dangles if the target goes away.',
  },
  {
    q: 'When does the kernel actually free a deleted file’s space?',
    a: 'When its link count is zero and no process still has it open. That is why deleting an open log file does not free space until the writer closes it.',
  },
  {
    q: 'Why does renaming a huge file within one disk take no time?',
    a: 'rename only edits directory entries. The inode and data stay where they are. Moving to another file system means copying the data.',
  },
  {
    q: 'What are the three layers behind a file descriptor?',
    a: 'The per-process descriptor table, the kernel’s open file description (offset and mode), and the inode (the file itself).',
  },
  {
    q: 'Why do parent and child share a file offset after fork?',
    a: 'fork copies the descriptor table, but both copies point to the same open file description, which holds the offset. A separate open() would get its own offset.',
  },
  {
    q: 'What does O_APPEND guarantee?',
    a: 'Each write moves to the end of the file and writes in one step, so several appenders never overwrite each other’s data.',
  },
  {
    q: 'What does a successful write() tell you about durability?',
    a: 'Nothing. The data is in the page cache, and a power failure before write-back loses it.',
  },
  {
    q: 'What does fsync guarantee when it returns 0?',
    a: 'All of that file’s dirty data and metadata are on stable storage, including past the drive’s volatile cache. It does not cover the file’s directory entry.',
  },
  {
    q: 'How is fdatasync cheaper than fsync?',
    a: 'It skips metadata not needed to read the data back, such as timestamps. If the size does not change, it avoids a metadata write entirely.',
  },
  {
    q: 'Why is O_DIRECT not a durability guarantee?',
    a: 'It only skips the page cache. Data can still sit in the drive’s cache, and size or allocation changes are still only in RAM. You still need fsync or O_DSYNC.',
  },
  {
    q: 'Why must you fsync the directory after creating or renaming a file?',
    a: 'The name is an entry in the directory, which is a separate file. fsync on the file makes its data durable, not the directory entry.',
  },
  {
    q: 'What are the four steps of the atomic replace pattern?',
    a: 'Write a temporary file in the same directory, fsync it, rename it over the target, fsync the directory.',
  },
  {
    q: 'What goes wrong if you rename without fsyncing the temporary file first?',
    a: 'The rename can reach disk before the data, so after a crash the name points to an empty or partial file.',
  },
  {
    q: 'Why is retrying a failed fsync dangerous on Linux (fsyncgate)?',
    a: 'The error is reported once, and the failed pages may be marked clean. The retry succeeds with nothing to write, while the data never reached disk.',
  },
  {
    q: 'What does a journal protect, and what does it not?',
    a: 'It keeps the file system’s metadata consistent after a crash by replaying committed updates. It does not make your file’s contents consistent or durable.',
  },
  {
    q: 'How do copy-on-write file systems stay consistent without a journal?',
    a: 'They never overwrite in place. They write new copies of changed blocks up the tree, then switch the root pointer in one write.',
  },
]
