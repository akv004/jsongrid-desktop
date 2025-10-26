# React + TypeScript + Vite



Push local to remote

```bash
  pnpm dev
  pnpm dev
  pwd
  pnpm add @monaco-editor/react@4.6.0\npnpm add -D @types/react@18 @types/react-dom@18
  git init
  git add .
  git commit -m "feat: Electron + Vite + React starter with Monaco editor"
  gh repo create jsongrid-desktop --public --source=. --remote=origin --push
  git remote add origin https://github.com/akv004/jsongrid-desktop.git
  git branch -M main
  git push -u origin main
  git tag -a v0.1.0 -m "baseline: editor working"
  git push origin v0.1.0

```

git tag -a v0.1.1 -m "baseline: grid working"
git push origin v0.1.1