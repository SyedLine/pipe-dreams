#!/usr/bin/env node
// GitHub Pages serves /pipe-dreams/<tab> from <tab>.html, so give every tab its own
// copy of the app shell (clean URLs with a real 200), plus 404.html as a fallback.
import { copyFileSync } from 'node:fs'
const TABS = ['map', 'netbacks', 'rankings', 'markets', 'egress', 'outlook', 'method']
for (const f of [...TABS.map((t) => `${t}.html`), '404.html']) copyFileSync('dist/index.html', `dist/${f}`)
console.log(`spa-pages: wrote ${TABS.length} tab pages + 404.html`)
