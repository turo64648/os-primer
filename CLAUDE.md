# OS Primer

A VitePress site: an in-depth operating systems primer for senior engineering interviews. Deployed to
GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

- **Before writing or editing any chapter, read `STYLE.md` and follow it.**
- Table of contents: `docs/.vitepress/chapters.ts`. Set `ready: true` when a chapter is complete.
- Glossary: `docs/.vitepress/glossary.ts`. Use `<Term id="...">` for the first use of a term in a chapter.
- Flashcards for a chapter live next to it (e.g. `docs/memory/vm-review.ts`).
- The reference chapter for tone and structure is `docs/memory/virtual-memory.md`.
- Check with `npm run build` before pushing; it fails on dead links.
