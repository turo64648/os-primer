// Flashcards for the Linking, Loading & Program Startup chapter. Strings may contain inline HTML.

export const cards = [
  {
    q: 'Why does the compiler leave relocations in an object file?',
    a: 'It compiles one file at a time, so it does not know where other files\' functions and globals will end up. A relocation is a note saying "patch these bytes with the address of this symbol", which the linker or loader fills in later.',
  },
  {
    q: 'What are the three jobs of the linker?',
    a: 'Resolve symbols (match every use with exactly one definition), lay out code and data and give each symbol an address, and apply relocations with those addresses.',
  },
  {
    q: 'Why can <code>gcc -lfoo main.o</code> fail when <code>gcc main.o -lfoo</code> works?',
    a: 'GNU ld reads inputs left to right and pulls from a static library only the symbols that are undefined at that point. When it reads libfoo first, nothing is undefined yet, so nothing is taken.',
  },
  {
    q: 'Why does ELF have both sections and segments?',
    a: 'Sections are the linker\'s detailed view: code, constants, data, symbols, debug info. Segments are the loader\'s view: a few ranges to map with one set of permissions each. The loader does not need the detail.',
  },
  {
    q: 'Why does a large zero-initialised global array not make the executable bigger?',
    a: 'It lives in <code>.bss</code>, which has no bytes in the file. The data segment\'s size in memory is larger than its size in the file, and the loader fills the difference with zero pages.',
  },
  {
    q: 'What are the main trade-offs between static and dynamic linking?',
    a: 'Static: self-contained and quick to start, but bigger, and every library fix needs a rebuild. Dynamic: library code is shared in RAM and updated in one place, but the right versions must exist at run time.',
  },
  {
    q: 'Why does a binary built on a new distribution fail with "GLIBC_2.34 not found" on an older one?',
    a: 'glibc tags symbols with the version that introduced them, and the binary records the newest ones it used. An older glibc lacks them. glibc is backwards compatible, so build on the oldest system you target.',
  },
  {
    q: 'How can many processes share one copy of a library\'s code in RAM?',
    a: 'The loader maps the .so file with mmap. All processes get the same page-cache pages for its read-only code. Writable data pages are private, copied on write.',
  },
  {
    q: 'Why must shared library code be position-independent?',
    a: 'It loads at different, random addresses in each process. Patching fixed addresses into the code would make code pages private and writable. Instead it uses relative addressing and reads other symbols\' addresses from the GOT.',
  },
  {
    q: 'How does a call to <code>puts</code> reach libc through the PLT and GOT?',
    a: 'The code calls a stub, <code>puts@plt</code>, which jumps to the address stored in the <code>puts</code> slot of the GOT. The loader fills that slot with the real address of <code>puts</code>.',
  },
  {
    q: 'What is lazy binding, and why do many systems now use bind now instead?',
    a: 'Lazy binding resolves each function on its first call, which speeds start-up. Bind now resolves everything at start-up, so the GOT can be made read-only (full RELRO), which blocks attacks that overwrite GOT slots.',
  },
  {
    q: 'In what order does the dynamic loader search for a library?',
    a: 'RPATH stored in the program (old style), then LD_LIBRARY_PATH, then RUNPATH, then the cache in /etc/ld.so.cache, then default directories like /lib and /usr/lib.',
  },
  {
    q: 'How does <code>LD_PRELOAD</code> replace a function such as <code>malloc</code>?',
    a: 'The loader binds each symbol to the first definition in its search order. Preloaded libraries come right after the program, before libc, so their definition wins. The replacement can call the original with <code>dlsym(RTLD_NEXT, ...)</code>.',
  },
  {
    q: 'When does <code>LD_PRELOAD</code> have no effect?',
    a: 'For statically linked programs (no loader), setuid programs (ignored for security), and calls that bypass the dynamic symbol, such as direct system calls or a library\'s internal calls.',
  },
  {
    q: 'What does the kernel put on a new program\'s stack during exec?',
    a: 'The argument count, the arguments, the environment variables, and the auxiliary vector: facts for the loader such as the entry point, where the program headers and vDSO are, the page size and random bytes.',
  },
  {
    q: 'What runs before <code>main</code> in a dynamically linked C program?',
    a: 'The kernel\'s exec work, then ld.so loading and linking libraries and running their initialisers, then <code>_start</code> and <code>__libc_start_main</code>, which set up libc and run constructors.',
  },
  {
    q: 'Why should you not run <code>ldd</code> on an untrusted binary?',
    a: 'ldd works by invoking the dynamic loader on the program, and in some cases that can run code from the program. <code>readelf -d</code> or <code>objdump -p</code> only read the file.',
  },
]
