# OS Primer

A VitePress site: an in-depth operating systems primer for senior engineering interviews. Deployed to
GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

- **Before writing or editing any chapter, read `STYLE.md` and follow it.**
- Table of contents: `docs/.vitepress/chapters.ts`. Set `ready: true` when a chapter is complete.
- Glossary: `docs/.vitepress/glossary.ts`. Use `<Term id="...">` for the first use of a term in a chapter.
- Flashcards for a chapter live next to it (e.g. `docs/memory/vm-review.ts`).
- The reference chapter for tone and structure is `docs/memory/virtual-memory.md`.
- Check with `npm run build` before pushing; it fails on dead links.

## Writing a chapter

1. Read `STYLE.md`, then `docs/memory/virtual-memory.md` and `docs/memory/vm-review.ts` as the reference
   for tone, depth and structure. Read the chapter's entry in `docs/.vitepress/chapters.ts` for its scope,
   and `docs/.vitepress/glossary.ts` for existing terms.
2. Write the chapter at the path given by its `link` in `chapters.ts` (e.g. `docs/foundations/what-is-an-os.md`),
   and its flashcards in `<same folder>/<slug>-review.ts`, exporting `cards`.
3. Audience: an experienced engineer, rusty on OS concepts, preparing for senior interviews at big tech and
   AI labs. Depth matters: cover what a senior interviewer might probe, and how it shows up in production.
4. Accuracy comes first. When a fact varies by CPU, kernel version or distro, say so. Give orders of
   magnitude, not false precision. Do not invent benchmark numbers, quotes or citations.
5. Diagrams: add Vue SVG components in `docs/.vitepress/theme/components/diagrams/`. Copy the conventions
   from the existing ones: `viewBox` 640 wide, the shared classes in `custom.css` (`box`, `box-a`…`box-d`,
   `t`, `tb`, `h`, `m`, `ln`, …), plain-language labels, a `<figcaption>`. Keep text inside the viewBox.
   Use 1–3 diagrams where they help understanding; do not add diagrams for decoration.
6. Widgets are optional. Only add one if interacting with it teaches something the text cannot.
7. Links to chapters that are not written yet are fine; `chapters.ts` has all paths.
8. Length follows scope. There is no word target: a small topic can be much shorter than a big one. Do
   not pad a small topic or cut a big one. Do not repeat what another chapter explains in full; recap it in a sentence and link.

### When several chapters are written in parallel

- Only create or edit your own chapter's files and any new diagram/widget components.
- Do **not** edit shared files: `chapters.ts`, `glossary.ts`, `theme/index.ts`, `custom.css`, `config.mts`.
  Instead, list in your report: new glossary entries (as TypeScript to paste into `glossary.ts`), and new
  components to register.
- Do not commit or push. Do not run `npm run build` (parallel builds collide); the integrator builds.
