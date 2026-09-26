---
title: 3. Linking, Loading & Program Startup
---

<script setup>
import { cards } from './linking-and-loading-review'
</script>

# 3. Linking, Loading & Program Startup

Between running the compiler and reaching `main`, a program is linked, loaded and connected to its
libraries. Interviewers ask about these steps because they explain real failures: "undefined reference",
"GLIBC_2.34 not found", or a missing `.so` in a container.

::: info Before you start
- A <Term id="process">process</Term> is a running program. It gets its own private view of memory, its
  <Term id="address-space">address space</Term>, split into fixed-size blocks called pages.
- A new program starts when a process calls <Term id="exec">`exec`</Term>, which replaces the program
  running in that process ([Chapter 2](/foundations/processes-and-threads)).
- <Term id="mmap">`mmap`</Term> maps a file into memory, so the file's bytes appear at some addresses and are
  read from disk on first use ([Chapter 4](/memory/virtual-memory)).

You can follow this chapter without those links. Everything else is explained here.
:::

## From source code to a running program

**In short:** the compiler turns each source file into an object file, and the linker joins them into an
executable. At run time, the kernel and a loader place it in memory and connect it to its libraries.

Take a program made of two files, `main.c` and `util.c`. `main.c` calls `add()`, which lives in `util.c`. It
also calls `printf`, which lives in the C library. Four tools handle it, one after another:

1. **The compiler** turns each `.c` file into an **object file** (`.o`). It works on one file at a time. When
   `main.c` calls `add()`, the compiler does not know where `add` will end up. It leaves a note: "put the
   address of `add` here".
2. **The <Term id="linker">linker</Term>** (`ld`) combines the object files into one **executable**. It
   decides where everything goes and fills in the notes it can.
3. **The kernel**, during `exec`, reads the executable and maps it into a fresh address space.
4. **The <Term id="dynamic-loader">dynamic loader</Term>** (`ld.so`) runs next, still before `main`. It
   finds the shared libraries the program needs, such as the C library, maps them, and fills in the
   remaining notes.

Steps 1 and 2 happen once, at build time. Steps 3 and 4 happen every time the program starts.

## Symbols and relocations: what the linker does

**In short:** each object file lists the names it defines and the names it needs. The linker matches them up
and patches every place that uses an address.

A named function or global variable is a <Term id="symbol">symbol</Term>. Each object file carries a
**symbol table**: which symbols it defines, and which it uses but expects someone else to define. The `nm`
tool prints it:

```c
// main.c
#include <stdio.h>

int counter = 5;                 // defined here, initialised: goes in .data
static int hidden;               // local to this file: goes in .bss
int add(int a, int b);           // declared here, defined in util.c

int main(void) {
    printf("%d\n", add(counter, 2));
    return hidden;
}
```

```c
// util.c
int add(int a, int b) { return a + b; }
```

```text
$ gcc -c main.c util.c      # compile only: produces main.o and util.o
$ nm main.o
                 U add
0000000000000000 D counter
0000000000000000 b hidden
0000000000000000 T main
                 U printf
$ nm util.o
0000000000000000 T add
```

`U` means undefined: used here, defined elsewhere. `T` is code ("text"), `D` is initialised data, `b` is
zero-initialised data. Lowercase means local to the file, like `static` variables. The addresses are all 0
because nothing has been placed yet.

Each place in the code that needs a symbol's final address gets a **relocation**: a note that says "patch
these bytes with the address of `add`". The linker's job has three parts:

1. **Resolve symbols.** Match every `U` with exactly one definition.
2. **Lay out memory.** Put all code together, all data together, and give every symbol an address.
3. **Apply relocations.** Patch each noted place with the address it now knows.

The two classic linker errors come from step 1:

```text
$ gcc main.o -o prog              # forgot util.o
/usr/bin/ld: main.o: in function `main':
main.c:(.text+0x16): undefined reference to `add'
collect2: error: ld returned 1 exit status
```

The other is "multiple definition of `x`": two object files define the same global symbol, often because a
variable was defined in a header included by several files. The fix is to declare it `extern` in the header
and define it in one `.c` file.

`printf` was also undefined, but there was no error about it. `gcc` links the C library automatically, and
the linker found `printf` there.

::: details Going deeper: static libraries, link order and C++ names
- A **static library** (`libfoo.a`) is an archive of object files. The linker copies in only the members that
  define symbols it still needs.
- GNU `ld` reads its inputs left to right and pulls from an archive only symbols that are undefined **at that
  point**. So `gcc -lfoo main.o` can fail where `gcc main.o -lfoo` works. Libraries that need each other may
  need to be listed twice, or wrapped in `--start-group … --end-group`. The newer linkers `lld` and `mold`
  are more forgiving.
- C++ encodes argument types into symbol names, so overloads get different names: `add(int, int)` becomes
  `_Z3addii`. This is **name mangling**. `extern "C"` turns it off, which is how C and C++ code call each
  other. `c++filt` or `nm -C` decodes the names.
- A **weak** symbol can be overridden by a normal (strong) definition without a "multiple definition" error.
  Libraries use weak symbols for optional hooks.
:::

## ELF: sections and segments

**In short:** Linux executables, object files and shared libraries use one format, ELF. It describes the same
bytes in two ways: sections for the linker, segments for the loader.

On Linux, object files, executables, shared libraries and core dumps all use the
<Term id="elf">Executable and Linkable Format (ELF)</Term>. An ELF file starts with a small header that says
what kind of file it is, which CPU it is for, and where execution starts (the **entry point**).

After that, the file has two tables, because two different tools read it:

- **Sections** are for the linker and debuggers. There are many small ones, each holding one kind of thing.
  `.text` holds code, `.rodata` constants and string literals, and `.data` globals with an initial value.
  `.bss` stands for globals that start at zero, `.symtab` holds symbols, and `.debug_*` debug information.
- **Segments** are for the loader. A segment is a range of the file to map into memory with one set of
  permissions. Several sections with the same permissions share one segment. The table of segments is the
  **program headers**.

<ElfViewsDiagram />

Why two views? The linker needs fine detail: which bytes are code, which are symbols, which need patching.
The loader only asks "which ranges go where, with which permissions?". Mapping a few large segments is
faster than handling dozens of sections. The full symbol table and debug information are not needed to run the
program, so they are not in any loaded segment.

`.bss` is a small trick. Globals that start at zero need no bytes in the file. The segment's size in memory
is larger than its size in the file, and the loader fills the difference with zeros. A 100 MB zeroed array
adds nothing to the file size.

Here are the program headers of a small program, trimmed. `readelf -l` shows them:

```text
$ readelf -lW prog
Elf file type is DYN (Position-Independent Executable file)
Entry point 0x1060
Program Headers:
  Type     Offset   VirtAddr           FileSiz  MemSiz   Flg Align
  INTERP   0x000318 0x0000000000000318 0x00001c 0x00001c R   0x1
      [Requesting program interpreter: /lib64/ld-linux-x86-64.so.2]
  LOAD     0x000000 0x0000000000000000 0x000628 0x000628 R   0x1000
  LOAD     0x001000 0x0000000000001000 0x0001a9 0x0001a9 R E 0x1000
  LOAD     0x002000 0x0000000000002000 0x000114 0x000114 R   0x1000
  LOAD     0x002db8 0x0000000000003db8 0x00025c 0x000268 RW  0x1000
  DYNAMIC  0x002dc8 0x0000000000003dc8 0x0001f0 0x0001f0 RW  0x8
  GNU_STACK 0x000000 0x0000000000000000 0x000000 0x000000 RW  0x10
  GNU_RELRO 0x002db8 0x0000000000003db8 0x000248 0x000248 R   0x1
```

Things to notice:

- Four `LOAD` segments: read-only headers, code (`R E`, read and execute), read-only data, and read-write data.
- In the last `LOAD`, `MemSiz` is larger than `FileSiz`. The difference is `.bss`.
- `INTERP` names the dynamic loader this program needs.
- `GNU_STACK` has no `E` flag, so the stack is not executable. This is a security feature
  ([Chapter 17](/systems/security)).
- The addresses start near 0. This program is position-independent: the kernel picks its real base address
  at load time (explained below).

::: details Going deeper: more ELF details and tools
- `readelf -h` prints the ELF header, `readelf -S` the sections, `readelf -d` the dynamic section (needed
  libraries, flags), `objdump -d` disassembles code, `file` gives a one-line summary.
- ELF types: `REL` (object file), `EXEC` (executable at a fixed address), `DYN` (shared library, and also
  position-independent executables), `CORE` (core dump).
- `strip` removes `.symtab` and debug sections. The program still runs, but crash backtraces lose function
  names. Many distributions ship debug info separately, found by a build ID stored in the file.
- Segments are page-aligned (`Align 0x1000`, 4 KiB), because permissions are set per page.
- macOS uses a different format (Mach-O) and Windows uses PE/COFF. The ideas are the same.
:::

## Static and dynamic linking

**In short:** static linking copies library code into the executable. Dynamic linking leaves it in shared
library files, which are loaded at start-up and shared between processes.

The C library's `printf` has to get into your program somehow. There are two ways:

- **Static linking.** The linker copies the library code your program uses into the executable. The result
  depends on nothing else at run time.
- **Dynamic linking.** The executable only records "I need `libc.so.6`". At start-up, the dynamic loader
  finds that file and maps it in. A library used this way is a
  <Term id="shared-library">shared library</Term>: `.so` ("shared object") on Linux, `.dll` on Windows,
  `.dylib` on macOS.

```text
$ gcc -O2 hello.c -o hello_dyn
$ gcc -O2 -static hello.c -o hello_static
$ ls -l hello_dyn hello_static
15960 hello_dyn
785360 hello_static
$ ldd hello_dyn
    linux-vdso.so.1 (0x00007fb827735000)
    libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007fb827400000)
    /lib64/ld-linux-x86-64.so.2 (0x00007fb827737000)
$ ldd hello_static
    not a dynamic executable
```

`ldd` lists the shared libraries a program needs. `linux-vdso.so.1` is the small library the kernel itself
puts in every process ([Chapter 1](/foundations/what-is-an-os)). The static "hello world" is about 50 times
bigger, because it carries its own copy of parts of the C library.

| | Static linking | Dynamic linking |
|---|---|---|
| Executable size | Larger: includes library code | Small |
| Runs on another machine | Yes, needs only a compatible kernel | Only if the right library versions are installed |
| Memory with many processes | Each program has its own copy of library code | One copy of each library's code in RAM, shared |
| Security fix in a library | Rebuild and redeploy every program | Update the library once, restart programs |
| Start-up | Faster: no libraries to find or link | Slower: loader work before `main` |
| Swap a function at load time | No | Yes, with `LD_PRELOAD` |

How is library code shared? The loader maps the `.so` file with `mmap`. Every process that maps the same file
gets the same pages from the kernel's file cache, so the read-only code sits in RAM once. Each process gets
its own private copy of the library's writable data.

### Where each approach shows up

- **Go** builds static binaries by default when it does not use C code (`CGO_ENABLED=0`). That is why a Go
  service can run in an empty `scratch` container image.
- **Alpine Linux** uses musl, a small C library that is friendly to static linking.
- **glibc**, the usual Linux C library, discourages fully static linking. Some of its features, such as
  looking up host names and users, load shared libraries at run time anyway.
- **Most distributions** link almost everything dynamically, so one security update to a library fixes every
  program.

### Library versions

Shared libraries change over time, and a program built against one version must keep working. Two
mechanisms handle this:

- **The soname.** A library's file name carries its major version: `libssl.so.3`. A new major version means
  an incompatible change, gets a new name, and can be installed next to the old one.
- **Symbol versions.** glibc goes further and tags each function with the version that introduced it. A
  program records the newest version it needs. `objdump -T` shows them:

```text
$ objdump -T hello_dyn | grep GLIBC
0000000000000000      DF *UND*  0000000000000000 (GLIBC_2.34) __libc_start_main
0000000000000000      DF *UND*  0000000000000000 (GLIBC_2.2.5) puts
```

Even this tiny program needs glibc 2.34 or newer, because the start-up function changed in that version. Build
it on a new distribution, copy it to an older one, and it fails:

```text
./hello_dyn: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.34' not found (required by ./hello_dyn)
```

glibc is backwards compatible: programs built against an **old** glibc run on newer ones. So portable
binaries are built on the **oldest** system you support. Python's `manylinux` wheels work this way.

::: details Going deeper: the dynamic section and version files
- `readelf -d prog` shows the dynamic section: `NEEDED` entries (libraries to load), `SONAME` (in a library),
  `RUNPATH` (extra search directories) and flags such as `BIND_NOW`.
- A library's file is usually `libfoo.so.1.2.3`. A symbolic link `libfoo.so.1` (the soname) points to it
  and is what programs record. A link `libfoo.so` (no version) is used only at build time by `-lfoo`, and
  is often in a separate `-dev` package.
- `ldconfig` rebuilds `/etc/ld.so.cache`, the index the loader searches, and creates the soname links.
- Static PIE (`-static-pie`) combines static linking with a randomised load address.
:::

## Position-independent code

**In short:** shared libraries are loaded at a different address in each process and on each run, so their
code must work at any address. It reaches data and other functions through relative addresses and tables.

A shared library cannot know where it will be loaded. Two libraries might both want the same spot. The
kernel also picks random addresses on purpose, to make attacks harder. This is
<Term id="aslr">address space layout randomisation (ASLR)</Term>, covered in
[Chapter 17](/systems/security).

So library code must not contain fixed addresses. Code built this way is
<Term id="pic">position-independent code (PIC)</Term>. It uses two ideas:

- **Relative addressing.** To reach its own data, code says "the variable 8,000 bytes after this
  instruction" instead of "the variable at address X". The distance stays the same wherever the library
  lands. x86-64 and ARM64 support this directly.
- **A table of addresses.** For things in **other** files, such as `printf` in libc, the distance is not
  known in advance. The code reads the address from a table, which the loader fills in at start-up. This
  table is the <Term id="got">global offset table (GOT)</Term>.

Why a table, and not patch the code directly? Code pages are shared between all processes using the library,
and are read-only. Patching them would give each process a private copy of the code, and would need writable
code, which is a security risk. The GOT is data, so each process gets its own small copy.

Executables can be position-independent too. A <Term id="pie">position-independent executable (PIE)</Term>
is loaded at a random address like a library. Most distributions build PIE by default. That is why the
program headers above start near address 0.

::: details Going deeper: flags and costs
- Compile libraries with `-fPIC`. Executables get `-fPIE -pie`, usually the default today.
- On 32-bit x86, PIC used up one of only 8 general registers and cost a few percent of speed. On x86-64 the
  cost is small, thanks to instructions that address relative to the current instruction.
- Linking non-PIC code into a shared library fails with an error that mentions a relocation such as
  `R_X86_64_32` and "recompile with -fPIC".
:::

## PLT and GOT: calling a library function

**In short:** a call to a library function goes to a small stub (the PLT entry), which jumps to an address
stored in the GOT. With lazy binding, the loader fills that address on the first call.

Your code calls `puts`. The compiler does not know where `puts` will be. So the code calls a small stub in
your own program, `puts@plt`. The stub reads the real address from the `puts` slot of the GOT and jumps
there. The stubs together form the <Term id="plt">procedure linkage table (PLT)</Term>.

<PltGotDiagram />

Here is what it looks like in machine code, from `objdump -d`:

```text
0000000000001030 <puts@plt>:
    1030:  jmp    *0x2fca(%rip)        # 4000 <puts@GLIBC_2.2.5>   ← jump to address in GOT slot
    1036:  push   $0x0                                               ← first-call path
    103b:  jmp    1020 <_init+0x20>                                  ← to the resolver
...
    105b:  call   1030 <puts@plt>                                    ← main calls the stub
```

### Lazy binding and "bind now"

A large program may import thousands of library functions and call only a few of them in a given run.
Looking up every one at start-up would waste time. So the traditional design is **lazy binding**:

1. At start-up, each GOT slot points back into its own PLT stub, at the "first-call path".
2. On the first call to `puts`, that path jumps to a resolver in the dynamic loader. The resolver looks up
   `puts` in the loaded libraries and writes its address into the GOT slot.
3. Every later call jumps straight through the slot to `puts`.

The alternative is **bind now**: the loader fills every slot at start-up. Start-up is slower, but there are no
surprises later. The GOT can then be made read-only after start-up, a protection called **full RELRO**
("relocation read-only"). An attacker who can overwrite memory can no longer redirect `puts` by changing its
GOT slot. Because of this, many distributions now build their packages with bind now, and Ubuntu's compiler
uses it by default. The example above was built with `-Wl,-z,lazy` to show the lazy path.

::: details Going deeper: variations
- `LD_BIND_NOW=1` forces bind now for one run. It is a quick way to find a missing symbol at start-up instead
  of in the middle of the night.
- `-fno-plt` makes the compiler call through the GOT directly, skipping the stub. It needs bind now.
- With Intel CET enabled (`-fcf-protection`, default on Ubuntu), the stubs start with `endbr64` and live in a
  section called `.plt.sec`.
- Partial RELRO makes only some tables read-only. `checksec` or `readelf -d` (look for `BIND_NOW`) and
  `readelf -l` (look for `GNU_RELRO`) show what a binary uses.
- Calls **inside** a shared library to its own exported functions also go through the PLT by default, so
  that they can be overridden (see "symbol interposition" below). `-fvisibility=hidden` or
  `-fno-semantic-interposition` removes that cost for internal calls.
:::

## The dynamic loader

**In short:** `ld.so` runs before your program. It finds each needed library by searching a fixed list of
places, maps it, links it, and runs its initialisers.

The executable names its loader in the `INTERP` segment, usually `/lib64/ld-linux-x86-64.so.2`. The kernel
maps the loader along with the program and starts the loader first. The loader then:

1. **Reads the program's list of needed libraries** (the `NEEDED` entries).
2. **Finds each one**, maps it with `mmap`, and repeats for the libraries those libraries need.
3. **Applies relocations**, filling GOT slots and other addresses.
4. **Runs each library's initialisers**, then jumps to the program's entry point.

### Where the loader looks

The loader searches for a library in this order:

1. Directories stored in the program itself with `-rpath` (as `RPATH`, in older builds).
2. Directories in the `LD_LIBRARY_PATH` environment variable.
3. Directories stored in the program as `RUNPATH` (the modern form of `-rpath`).
4. The cache in `/etc/ld.so.cache`, built by `ldconfig` from `/etc/ld.so.conf`.
5. The default directories, such as `/lib` and `/usr/lib`.

If nothing matches, the program does not start at all:

```text
$ ./useanswer
./useanswer: error while loading shared libraries: libanswer.so: cannot open shared object file: No such file or directory
$ LD_LIBRARY_PATH=. ./useanswer
42
```

A stored path can use `$ORIGIN`, which means "the directory this program is in". Build with
`-Wl,-rpath,'$ORIGIN/../lib'` and the program finds its bundled libraries wherever it is installed. Many
Python wheels with native code ship their libraries this way.

::: tip Seeing the loader work
`LD_DEBUG=libs ./prog` prints every search and every library found. `LD_DEBUG=bindings` prints each symbol as
it is resolved. `LD_DEBUG=help` lists the options.
:::

::: warning Do not run ldd on untrusted programs
`ldd` works by asking the dynamic loader to do its work, and with some programs that can end up running the
program's own code. For a file you do not trust, use `readelf -d` or `objdump -p`, which only read it.
:::

::: details Going deeper: RPATH vs RUNPATH, and dlopen
- `RPATH` is searched **before** `LD_LIBRARY_PATH` and also applies to the libraries' own dependencies.
  `RUNPATH` is searched **after** it and applies only to the program's direct dependencies. Modern linkers
  write `RUNPATH` by default.
- `dlopen("libplugin.so", RTLD_NOW)` loads a library while the program runs, and `dlsym` finds a function in
  it by name. Plugins, Python extension modules and GPU libraries are loaded this way.
- By default (`RTLD_LOCAL`), a `dlopen`ed library's symbols are not used to resolve other libraries'
  symbols. `RTLD_GLOBAL` makes them visible to everything loaded afterwards.
- The loader is itself a shared library that runs before it is linked. It relocates itself first, with care.
  You can even run it directly: `/lib64/ld-linux-x86-64.so.2 ./prog`.
:::

## LD_PRELOAD and symbol interposition

**In short:** when several loaded files define the same symbol, the first one in the search order wins.
`LD_PRELOAD` puts your library first, so its functions replace the program's library calls without
recompiling.

When `puts` is resolved, the loader searches the loaded files in order: the program, then its libraries in
the order they were loaded. The first definition found wins. This is called <Term id="interposition">symbol
interposition</Term>.

<Term id="ld-preload">`LD_PRELOAD`</Term> is an environment variable listing libraries to load **before**
all others, right after the program. So a function defined in a preloaded library takes the place of the
same function in libc. The replacement can still call the original: `dlsym(RTLD_NEXT, "fopen")` finds the
**next** definition in the search order.

### Try it: logging every fopen

```c
// logopen.c: gcc -shared -fPIC logopen.c -o logopen.so -ldl
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>

FILE *fopen(const char *path, const char *mode) {
    static FILE *(*real_fopen)(const char *, const char *);
    if (!real_fopen)                          // find the next fopen: libc's
        real_fopen = dlsym(RTLD_NEXT, "fopen");
    fprintf(stderr, "[preload] fopen(\"%s\", \"%s\")\n", path, mode);
    return real_fopen(path, mode);
}
```

```c
// reader.c: gcc reader.c -o reader && ./reader
#include <stdio.h>

int main(void) {
    FILE *f = fopen("/etc/hostname", "r");
    char line[256];
    if (f && fgets(line, sizeof line, f))
        printf("hostname: %s", line);
    return 0;
}
```

```text
$ ./reader
hostname: vm
$ LD_PRELOAD=./logopen.so ./reader
[preload] fopen("/etc/hostname", "r")
hostname: vm
```

`reader` was not rebuilt or changed. The loader bound its call to `fopen` to the preloaded version.

### What people use it for

- **Swapping the memory allocator:** `LD_PRELOAD=libjemalloc.so` replaces `malloc` and `free` in an existing
  program ([Chapter 6](/memory/allocators)).
- **Testing and debugging:** `libfaketime` fakes the clock, and memory leak finders wrap `malloc`.
- **Compatibility shims:** fixing a closed-source program's behaviour without its source.
- **Attacks:** malware writes a library into `/etc/ld.so.preload`, which applies to every program, to hide
  files or steal passwords.

### Where it does not work

- **Setuid programs**, which run with more privilege than the user who starts them. The loader ignores
  `LD_PRELOAD` for them (with narrow exceptions), or any user could run code as root.
- **Statically linked programs.** There is no loader and no symbol lookup at run time.
- **Calls that do not go through the symbol.** A Go program that makes system calls directly, or a library
  that calls its own internal function, is not affected. To watch actual system calls, use `strace` or eBPF.

## How exec builds the address space

**In short:** `exec` throws away the old memory, maps the program's segments and its loader, and builds a
stack holding the arguments and environment. Then the loader, libc start-up code and constructors all run
before `main`.

Here is everything that happens between `execve("./prog", …)` and your `main`.

<ProgramStartupDiagram />

**In the kernel:**

1. It opens the file and reads the first bytes. If they start with `#!`, the file is a script: the kernel
   runs the named interpreter instead, such as `/usr/bin/python3`, with the script's path as an argument. If
   they are the ELF magic bytes, it continues.
2. It checks the header, replaces the old address space with an empty one, and maps each `LOAD` segment with
   its permissions. Nothing is read from disk yet: pages load on first use through page faults
   ([Chapter 4](/memory/virtual-memory)). It also sets up an empty heap and a stack, at randomised
   addresses.
3. If there is an `INTERP` segment, it maps the loader as well.
4. It builds the new stack: the argument count, the arguments (`argv`), the environment variables, and the
   **auxiliary vector**, a list of facts for the loader. These include where the program headers are, the
   program's entry point, the page size, where the vDSO is, and 16 random bytes.
5. It returns to user mode at the loader's entry point, or at the program's if there is no loader.

**In user mode:**

1. **`ld.so`** loads and links the libraries as described above, then jumps to the program's entry point.
2. **`_start`**, a few instructions from the C library's start-up files, passes the stack to
   `__libc_start_main`.
3. **libc sets itself up:** thread-local storage, `stdio`, security checks. Then it runs every
   **constructor**: functions marked to run before `main`. In C++, these build global objects.
4. **`main(argc, argv, envp)`** runs.
5. When `main` returns, libc calls `exit`. It runs `atexit` handlers and destructors, flushes `stdio`
   buffers, and calls the `_exit` system call.

### Try it: code before and after main

```c
// startup.c: gcc startup.c -o startup && ./startup
#include <stdio.h>
#include <stdlib.h>

__attribute__((constructor)) static void before(void) { printf("1. constructor, before main\n"); }
__attribute__((destructor))  static void after(void)  { printf("5. destructor, after exit\n"); }
static void on_exit_handler(void) { printf("4. atexit handler\n"); }

int main(int argc, char **argv) {
    printf("2. main, argc=%d, argv[0]=%s\n", argc, argv[0]);
    atexit(on_exit_handler);
    printf("3. main returns\n");
    return 0;
}
```

Expected output:

```text
1. constructor, before main
2. main, argc=1, argv[0]=./startup
3. main returns
4. atexit handler
5. destructor, after exit
```

Every shared library can have constructors too, and they all run before `main`. This is the "static
initialisation order" problem in C++: a global object in one file must not depend on a global object in
another file, because their order is not defined.

### Watching start-up with strace

Most of what `strace` shows before a program's own work is the loader:

```text
$ strace ./hello_dyn
execve("./hello_dyn", ["./hello_dyn"], 0x7ffc01a57b38 /* 147 vars */) = 0
brk(NULL)                               = 0x5584a0c73000
access("/etc/ld.so.preload", R_OK)      = -1 ENOENT (No such file or directory)
openat(AT_FDCWD, "/etc/ld.so.cache", O_RDONLY|O_CLOEXEC) = 3
openat(AT_FDCWD, "/lib/x86_64-linux-gnu/libc.so.6", O_RDONLY|O_CLOEXEC) = 3
read(3, "\177ELF\2\1\1\3\0\0\0\0\0\0\0\0\3\0>\0\1\0\0\0\220\243\2\0\0\0\0\0"..., 832) = 832
mmap(NULL, 2170256, PROT_READ, MAP_PRIVATE|MAP_DENYWRITE, 3, 0) = 0x7fefb9400000
mmap(0x7fefb9428000, 1605632, PROT_READ|PROT_EXEC, MAP_PRIVATE|MAP_FIXED|MAP_DENYWRITE, 3, 0x28000) = 0x7fefb9428000
mmap(0x7fefb95ff000, 24576, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_FIXED|MAP_DENYWRITE, 3, 0x1fe000) = 0x7fefb95ff000
close(3)                                = 0
arch_prctl(ARCH_SET_FS, 0x7fefb9628740) = 0
mprotect(0x7fefb95ff000, 16384, PROT_READ) = 0
...
write(1, "hello\n", 6)                  = 6
exit_group(0)                           = ?
```

(Trimmed.) You can read the loader's steps. It checks `/etc/ld.so.preload`, opens the cache, opens libc and
reads its header. It maps libc's segments one by one with their permissions: read-only, code, data. It sets
up thread-local storage (`arch_prctl`), then makes the relocated data read-only (`mprotect`: this is RELRO).
Only the `write` near the end is the program's own work.

::: details Going deeper: the auxiliary vector and binfmt
- `LD_SHOW_AUXV=1 ./prog` prints the auxiliary vector. Useful entries: `AT_PHDR`, `AT_ENTRY`, `AT_BASE` (where
  the loader is), `AT_RANDOM` (seeds stack canaries), `AT_SYSINFO_EHDR` (the vDSO), `AT_HWCAP` (CPU
  features), `AT_SECURE` (set for setuid programs).
- The kernel supports several formats through **binfmt** handlers: ELF, `#!` scripts, and `binfmt_misc`,
  which can hand any file type to a chosen interpreter. Docker uses `binfmt_misc` with QEMU to run ARM images
  on x86 machines.
- `/proc/<pid>/maps` shows the result: the program, `[heap]`, each library's segments, `[vdso]` and
  `[stack]`.
- Start-up time grows with the number of libraries and relocations. Big C++ programs with hundreds of shared
  libraries can spend a noticeable fraction of a second in the loader before `main`.
:::

## Why this matters in real systems

**"GLIBC_2.xx not found" in production.** A service is built on a developer's new laptop or a recent CI image,
then deployed to an older base image. It fails at start with a missing glibc version. The fix is to build on
the oldest target, build inside the same base image you deploy, or link statically with musl.

**Alpine and Python wheels.** Most prebuilt Python packages with native code are `manylinux` wheels, built
against an old glibc. Alpine uses musl instead, so `pip` may fall back to compiling from source, which is slow
or fails. Teams that switch a Python image to Alpine to save space often switch back.

**CUDA library mismatches.** PyTorch and other ML frameworks load CUDA libraries such as `libcudart`,
`libcublas` and `libcudnn` as shared libraries. An `LD_LIBRARY_PATH` that points at a different CUDA install
can make the loader pick the wrong version. The result is a start-up error, or a crash deep inside a GPU
call. `LD_DEBUG=libs` and `/proc/<pid>/maps` show which files were actually loaded.

**Two versions of one library in one process.** A Python process imports two extension modules, each built
with its own copy of a library such as protobuf or OpenSSL. If both copies export the same symbol names,
interposition can bind one module's calls to the other's copy. That leads to strange crashes. Hiding symbols
(`-fvisibility=hidden`) and linking dependencies statically inside each module avoid it.

**Swapping allocators without a rebuild.** A service's memory keeps growing because of fragmentation. Before
changing code, teams try `LD_PRELOAD=libjemalloc.so` or `libtcmalloc.so` to see if another allocator helps.

**Static Go binaries and DNS.** A Go binary built with `CGO_ENABLED=0` runs in an empty container. It uses Go's
own DNS resolver instead of glibc's. That resolver does not support everything glibc's does, such as name-lookup
plugins for LDAP or local network discovery, which occasionally surprises people.

**How to look:**

```bash
file ./prog                  # static or dynamic, PIE or not, which CPU
ldd ./prog                   # needed libraries and where they resolve (trusted files only)
readelf -d ./prog            # NEEDED, RUNPATH, BIND_NOW
objdump -T ./prog | grep GLIBC_   # which glibc versions it needs
LD_DEBUG=libs ./prog         # the loader's search, step by step
grep '\.so' /proc/<pid>/maps # which libraries a running process really loaded
```

## Interview questions

Answer each question out loud before you open the model answer.

::: details 1. What happens between running gcc and your main() starting?
Build time: the compiler turns each `.c` file into an object file, leaving relocations for addresses it does
not know. The linker matches undefined symbols with definitions, lays out code and data, applies
relocations, and writes an ELF executable. For shared libraries, it records their names.

Run time: `execve` makes the kernel map the executable's segments and the dynamic loader, and build the stack
with arguments, environment and the auxiliary vector. The loader maps shared libraries, applies relocations
and runs their initialisers. Then `_start` calls `__libc_start_main`, which sets up libc, runs constructors,
and calls `main`.

**Senior add-on:** segments are mapped, not read; pages come in through page faults. With PIE and ASLR,
everything lands at random addresses. With lazy binding, functions are resolved on first call; with bind now
and full RELRO, all at start-up, and the GOT is then made read-only.
:::

::: details 2. What is the difference between static and dynamic linking?
Static linking copies the needed library code into the executable. The program is self-contained and starts
fast, but it is bigger, and fixing a library bug means rebuilding it.

Dynamic linking records which shared libraries are needed, and the loader maps them at start-up. Library code
is shared in RAM between processes, and one library update fixes all programs. But the right versions must
be present on the target machine, and start-up does more work.

**Senior add-on:** glibc versions its symbols, so binaries built on new systems fail on old ones ("GLIBC_2.34
not found"); build on the oldest target. Go and musl make static binaries easy. glibc's name lookup loads
libraries even in static programs. Only dynamic linking allows `LD_PRELOAD`.
:::

::: details 3. What are the PLT and the GOT, and why do they exist?
Shared libraries load at unknown, random addresses, and their code pages are shared and read-only. So code
cannot contain the addresses of functions in other libraries.

Instead, the GOT is a table of addresses in each process's writable data, filled in by the loader. A call to
a library function goes to a small stub in the PLT, which jumps to the address in the function's GOT slot.
With lazy binding, the slot first points to the loader's resolver, which finds the function on the first
call and writes its address into the slot.

**Senior add-on:** lazy binding speeds start-up but leaves the GOT writable, a classic attack target. Bind now
plus full RELRO fills everything at start-up and makes the GOT read-only. Many distributions default to it.
`-fno-plt` skips the stub.
:::

::: details 4. How does LD_PRELOAD work, and when does it not work?
The dynamic loader resolves each symbol by searching loaded files in order and taking the first definition.
`LD_PRELOAD` loads the given libraries right after the program and before its other libraries. So a function
defined there, like `malloc` or `fopen`, takes the place of libc's. The replacement can call the original
with `dlsym(RTLD_NEXT, name)`.

It does not work for statically linked programs, which have no loader, or for setuid programs, where the
loader ignores it for security. It also misses calls that do not go through the dynamic symbol, such as
direct system calls or a library's internal calls.

**Senior add-on:** uses include swapping allocators, `libfaketime`, and leak checkers. `/etc/ld.so.preload`
applies it to every program, which rootkits abuse. Libraries built with `-fvisibility=hidden` keep internal
calls from being interposed.
:::

::: details 5. What are sections and segments in ELF? Why both?
Sections are the linker's view: many named pieces such as `.text`, `.data`, `.bss`, `.symtab`, each holding
one kind of content. Segments are the loader's view: a few ranges of the file to map into memory, each with
one set of permissions. The program headers list the segments; the section headers list the sections.

Both exist because the two tools need different detail. The loader maps a few large segments quickly and
ignores symbols and debug info.

**Senior add-on:** `.bss` takes no file space: the data segment's memory size is bigger than its file size,
and the loader fills the difference with zeros. `PT_INTERP` names the loader, `PT_GNU_STACK` controls
whether the stack is executable, and `PT_GNU_RELRO` marks what becomes read-only after relocation.
:::

::: details 6. A binary fails with "error while loading shared libraries: libfoo.so.1: cannot open shared object file". How do you debug it?
The dynamic loader could not find `libfoo.so.1` in any place it searches. Check:

1. `ldd ./prog` (on a trusted file) or `readelf -d ./prog` to see what it needs and its `RUNPATH`.
2. Whether the library is installed at all, and its exact name. The soname must match: `libfoo.so.2` does
   not satisfy `libfoo.so.1`.
3. The search path: `LD_LIBRARY_PATH`, `RUNPATH`, `/etc/ld.so.conf`, and whether `ldconfig` was run after
   installing.
4. `LD_DEBUG=libs ./prog` shows every directory tried.

Fixes: install the right package, run `ldconfig`, or build with `-Wl,-rpath,'$ORIGIN/../lib'` and ship the
library alongside.

**Senior add-on:** also check the CPU architecture (`file`), because a 32-bit or ARM library is skipped
silently. In containers, a multi-stage build may have left the library out of the final image.
:::

::: details 7. What does exec do to the process's memory?
It discards the entire old address space. It maps the new program's `LOAD` segments with their permissions,
and the dynamic loader if the program needs one. It creates a new stack and an empty heap, and places the
arguments, environment and auxiliary vector on the stack. The PID and open file descriptors (those
without close-on-exec) stay the same.

**Senior add-on:** nothing is read eagerly; pages are loaded by page faults, and code pages come from the
shared page cache. Addresses are randomised. `#!` scripts are handled by the kernel, which runs the
interpreter instead.
:::

::: details 8. Why must shared libraries be position-independent?
The same library is loaded at different addresses in different processes, and at random addresses because
of ASLR. If its code held fixed addresses, the loader would have to patch the code in every process. Then the
code pages could not be shared, and they would have to be writable.

Position-independent code uses addresses relative to the current instruction for its own data. For other
libraries' symbols it reads addresses from the GOT, which is per-process data.

**Senior add-on:** executables are now usually PIE too, so ASLR also moves the main program. On x86-64, the
cost of PIC is small. On 32-bit x86 it cost a register and a few percent of speed.
:::

## Common misconceptions

- **"The kernel loads shared libraries."** The kernel maps the program and the dynamic loader. The loader, in
  user mode, finds and maps the libraries.
- **"Loading reads the whole program into memory."** It maps the file. Pages load when first used.
- **"Every process has its own copy of libc in RAM."** Code pages are shared through the page cache. Only
  written data pages are private.
- **"`main` is the first code that runs."** The loader, `_start`, libc set-up and constructors all run
  first.
- **"A static binary runs anywhere."** It still needs the same CPU architecture and a kernel that supports
  the system calls it uses.
- **"`ldd` only reads the file."** It can run code from the program. Use `readelf -d` on untrusted files.

## Key takeaways

- The **linker** resolves symbols and applies relocations at build time. The **dynamic loader** (`ld.so`)
  does the same for shared libraries at every start-up.
- **ELF** has sections (for the linker) and segments (for the loader). `exec` maps the segments; pages load on
  demand.
- **Dynamic linking** shares library code and eases updates, but needs the right versions at run time. glibc
  symbol versions mean you should build on the oldest target.
- Library calls go through the **PLT** and **GOT**. Lazy binding fills slots on first call; bind now plus
  full RELRO fills them at start-up and makes the GOT read-only.
- **`LD_PRELOAD`** replaces library functions through symbol interposition. It does not affect static or
  setuid programs, or direct system calls.

## Review

<Flashcards id="linking-and-loading" :cards="cards" />

<MarkDone id="linking-and-loading" />
