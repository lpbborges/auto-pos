# Auto POS

A mobile-first Point of Sale system built with SvelteKit, Tailwind CSS, and TypeScript.

## Features

- **Inventory Management**: Add, edit, and delete products with stock tracking
- **Sales Processing**: Quick product selection and cart management
- **Dark/Light Theme**: Toggle between themes with mode-watcher
- **Mobile-First Design**: Touch-friendly interface with bottom navigation
- **Local Storage**: Data persists in browser localStorage

## Tech Stack

- **Framework**: [SvelteKit](https://kit.svelte.dev/) with Svelte 5
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide Svelte](https://lucide.dev/)
- **Theme**: [mode-watcher](https://github.com/svecosystem/mode-watcher)
- **Notifications**: [svelte-sonner](https://github.com/wobsoriano/svelte-sonner)

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── app.css          # Global styles and CSS variables
├── app.html         # HTML template
├── lib/
│   ├── components/  # Svelte components
│   │   ├── ui/      # Reusable UI primitives
│   │   └── *.svelte # Application components
│   ├── stores/      # Svelte stores for state management
│   ├── types.ts     # TypeScript interfaces
│   └── utils.ts     # Utility functions
└── routes/          # SvelteKit routes
    ├── +layout.svelte
    ├── +page.svelte
    └── +error.svelte
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run check` | Type check with svelte-check |
| `npm run lint` | Lint with ESLint |
