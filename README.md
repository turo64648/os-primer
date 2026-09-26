# OS Primer

An in-depth operating systems primer for senior engineering interviews, built with
[VitePress](https://vitepress.dev).

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in docs/.vitepress/dist
npm run preview   # serve the built site
```

## Layout

- `docs/.vitepress/chapters.ts`: the table of contents. Sidebar, home page and stub pages all read it.
  Set `ready: true` when a chapter is written.
- `docs/.vitepress/theme/components/`: widgets (flashcards, quiz, address translator) and SVG diagrams.
- `docs/<part>/<chapter>.md`: chapter content. Review data (flashcards, quiz) lives next to each chapter.

## Deploy to GitHub Pages

`.github/workflows/deploy.yml` builds and deploys the site. It takes effect once this folder is the root of
its own repository:

1. Move this folder into a new repository (e.g. `os-primer`) and push it to `main`.
2. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. The workflow sets the base path to `/<repo-name>/` automatically. For a `<user>.github.io` repository,
   change `VITEPRESS_BASE` in the workflow to `/`.
