// "A dev server in this tab": a faithful simulation of a vivari session.
// The real runtime needs cross-origin isolation headers that GitHub Pages
// cannot send, so this plays the same script (create, install, dev, edit)
// and points at vivari Studio for the real thing. Nothing here talks to a
// server; the request counter only counts what the fake preview "fetched".
import { strings, motionOn } from '../store';
import { sfx } from '../sound';

type Tpl = 'react' | 'express' | 'python';
type Step =
  | { cmd: string }
  | { out: string; dim?: boolean; ok?: boolean }
  | { install: number; online: string; offline: string }
  | { pause: number };

interface Template {
  url: string;
  file: string;
  pre: string;
  post: string;
  script: () => Step[];
  boot: number;
}

const rnd = (a: number, b: number) => Math.round(a + Math.random() * (b - a));
const clock = () => new Date().toLocaleTimeString('en-US', { hour12: false });

const TEMPLATES: Record<Tpl, Template> = {
  react: {
    url: 'localhost:5173',
    file: 'src/App.jsx',
    pre: '<h1>',
    post: '</h1>',
    boot: 6,
    script: () => [
      { cmd: 'npm create vite@latest my-app -- --template react' },
      { out: 'Scaffolding project in /home/my-app...' },
      { out: 'Done.', ok: true },
      { cmd: 'cd my-app && npm install' },
      { install: 148, online: `added 148 packages in ${(rnd(18, 26) / 10).toFixed(1)}s`, offline: 'added 148 packages from cache in 0.4s (offline)' },
      { cmd: 'npm run dev' },
      { pause: 260 },
      { out: `  VITE v7.1.4  ready in ${rnd(240, 420)} ms`, ok: true },
      { out: '  ➜  Local:   http://localhost:5173/' },
      { out: '  ➜  Network: use --host to expose', dim: true },
    ],
  },
  express: {
    url: 'localhost:3000/api',
    file: 'server.js',
    pre: 'res.json({ message: "',
    post: '" })',
    boot: 1,
    script: () => [
      { cmd: 'npm init -y' },
      { out: 'Wrote to /home/api/package.json' },
      { cmd: 'npm install express' },
      { install: 69, online: `added 69 packages in ${(rnd(10, 16) / 10).toFixed(1)}s`, offline: 'added 69 packages from cache in 0.2s (offline)' },
      { cmd: 'node --watch server.js' },
      { pause: 160 },
      { out: 'Server listening on http://localhost:3000', ok: true },
    ],
  },
  python: {
    url: 'localhost:8000',
    file: 'index.html',
    pre: '<h1>',
    post: '</h1>',
    boot: 1,
    script: () => [
      { cmd: 'python --version' },
      { out: 'Booting CPython in this tab...', dim: true },
      { pause: 420 },
      { out: 'Python 3.14.0' },
      { cmd: 'python -m http.server 8000' },
      { out: 'Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...', ok: true },
    ],
  },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function init(root: HTMLElement) {
  const S = strings.demos.vivari;
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const term = $('[data-vv-term]');
  const empty = $('[data-vv-empty]');
  const app = $('[data-vv-app]');
  const startBtn = $<HTMLButtonElement>('[data-vv-start]');
  const startLabel = startBtn.querySelector('span')!;
  const url = $('[data-vv-url]');
  const input = $<HTMLInputElement>('[data-vv-input]');
  const file = $('[data-vv-file]');
  const pre = $('[data-vv-pre]');
  const post = $('[data-vv-post]');
  const served = $('[data-vv-served]');
  const msg = $('[data-vv-msg]');
  const offBtn = $<HTMLButtonElement>('[data-vv-offline]');
  const tplBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-vv-tpl]')];
  const hello = input.value;

  let tpl: Tpl = 'react';
  let run = 0;
  let live = false;
  let offline = false;
  let requests = 0;
  let count = 0;
  let hits = 0;
  const texts: Record<Tpl, string> = { react: hello, express: hello, python: hello };

  const wait = (ms: number) => (motionOn() ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
  const line = (html: string, cls = '') => {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.innerHTML = html;
    term.appendChild(p);
    while (term.childElementCount > 80) term.firstElementChild!.remove();
    term.scrollTop = term.scrollHeight;
    return p;
  };
  const serve = (n = 1) => {
    requests += n;
    served.textContent = String(requests);
    served.parentElement!.classList.remove('is-bump');
    void served.parentElement!.offsetWidth;
    served.parentElement!.classList.add('is-bump');
  };

  /* ------------------------------------------------------------ preview */
  const render = () => {
    const text = esc(texts[tpl]);
    if (tpl === 'react') {
      app.innerHTML = `<div class="vv-r"><div class="vv-r__logos" aria-hidden="true"><i class="vv-r__vite"></i><i class="vv-r__react"><b></b></i></div><p class="vv-r__h" data-vv-h>${text}</p><button type="button" class="vv-r__btn" data-vv-count>count is ${count}</button><p class="vv-r__p">Edit <code>src/App.jsx</code> and save to test HMR</p></div>`;
    } else if (tpl === 'express') {
      app.innerHTML = `<div class="vv-x"><pre class="vv-x__json" data-vv-json></pre><button type="button" class="tbtn" data-vv-get>GET /api · ${esc(S.request)}</button></div>`;
      json();
    } else {
      app.innerHTML = `<div class="vv-p"><p class="vv-p__h" data-vv-h>${text}</p><p class="vv-p__s">Served by <code>python -m http.server</code></p><ul class="vv-p__ls"><li>index.html</li><li>main.py</li><li>requirements.txt</li></ul><button type="button" class="tbtn" data-vv-reload>↻ ${esc(S.reload)}</button></div>`;
    }
  };
  const json = () => {
    const el = app.querySelector('[data-vv-json]');
    if (!el) return;
    el.innerHTML = `{\n  <i>"message"</i>: <b>"${esc(texts.express)}"</b>,\n  <i>"servedBy"</i>: <b>"your browser tab"</b>,\n  <i>"hits"</i>: <u>${hits}</u>\n}`;
  };
  const get = () => {
    hits++;
    json();
    serve();
    line(`GET /api <span class="vv__ok">200</span> ${rnd(1, 4)}ms`, 'vv__dim');
    sfx('ping', Math.min(1, hits / 10));
  };
  const pyGet = () => {
    serve();
    line(`127.0.0.1 - - [${clock()}] "GET / HTTP/1.1" <span class="vv__ok">200</span> -`, 'vv__dim');
  };
  app.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (t.closest('[data-vv-count]')) {
      count++;
      t.closest('[data-vv-count]')!.textContent = `count is ${count}`;
      sfx('tick', Math.min(1, count / 12));
    } else if (t.closest('[data-vv-get]')) get();
    else if (t.closest('[data-vv-reload]')) { render(); pyGet(); }
  });

  /* ------------------------------------------------------------- script */
  const reset = () => {
    run++;
    live = false;
    root.closest('.demo')?.classList.remove('vv-up');
    count = 0;
    hits = 0;
    term.innerHTML = '';
    app.hidden = true;
    app.innerHTML = '';
    empty.hidden = false;
    input.disabled = true;
    startBtn.disabled = false;
    startLabel.textContent = S.start;
    const T = TEMPLATES[tpl];
    url.textContent = T.url;
    file.textContent = T.file;
    pre.textContent = T.pre;
    post.textContent = T.post;
    input.value = texts[tpl];
  };

  async function start() {
    reset();
    const id = run;
    const T = TEMPLATES[tpl];
    startBtn.disabled = true;
    const alive = () => id === run;
    for (const step of T.script()) {
      if (!alive()) return;
      if ('cmd' in step) {
        const p = line('<span class="vv__ps">~ $</span> <span data-typed></span>');
        const out = p.querySelector('[data-typed]')!;
        if (motionOn()) {
          for (const ch of step.cmd) {
            out.textContent += ch;
            sfx('key');
            await wait(16);
            if (!alive()) return;
          }
        } else out.textContent = step.cmd;
        sfx('enter');
        await wait(180);
      } else if ('out' in step) {
        line(esc(step.out), step.ok ? 'vv__ok' : step.dim ? 'vv__dim' : '');
        await wait(90);
      } else if ('pause' in step) {
        await wait(step.pause);
      } else {
        const p = line('', 'vv__bar');
        p.setAttribute('aria-hidden', 'true');
        const total = step.install;
        const frames = offline ? 6 : 26;
        for (let f = 1; f <= frames; f++) {
          const n = Math.round((total * f) / frames);
          const w = 18, fill = Math.round((w * f) / frames);
          p.textContent = `[${'#'.repeat(fill)}${'.'.repeat(w - fill)}] ${n}/${total} packages`;
          if (f % 4 === 0) sfx('tick', f / frames);
          await wait(46);
          if (!alive()) return;
        }
        p.remove();
        line(esc(offline ? step.offline : step.online), 'vv__ok');
        await wait(120);
      }
    }
    if (!alive()) return;
    live = true;
    root.closest('.demo')?.classList.add('vv-up');
    empty.hidden = true;
    app.hidden = false;
    render();
    serve(T.boot);
    if (tpl === 'python') pyGet();
    input.disabled = false;
    startBtn.disabled = false;
    startLabel.textContent = S.restart;
    sfx('success');
  }

  /* ---------------------------------------------------------- live edit */
  let logTimer = 0;
  input.addEventListener('input', () => {
    texts[tpl] = input.value;
    if (!live) return;
    if (tpl === 'react') {
      // Hot module replacement: the heading swaps in place, the counter keeps its state.
      const h = app.querySelector('[data-vv-h]');
      if (h) h.textContent = input.value;
    } else if (tpl === 'express') json();
    clearTimeout(logTimer);
    logTimer = window.setTimeout(() => {
      if (!live) return;
      if (tpl === 'react') { line(`<span class="vv__dim">${clock()}</span> <span class="vv__acc">[vite]</span> hmr update /src/App.jsx`); serve(); }
      else if (tpl === 'express') { line(`<span class="vv__acc">[node --watch]</span> restarting 'server.js'`, 'vv__dim'); line('Server listening on http://localhost:3000', 'vv__ok'); }
      else { render(); pyGet(); }
      sfx('ping', 0.3);
    }, 280);
  });

  /* ------------------------------------------------------------ controls */
  const idle = term.textContent ?? '';
  startBtn.addEventListener('click', () => { start(); });
  for (const b of tplBtns) {
    b.addEventListener('click', () => {
      tpl = b.dataset.vvTpl as Tpl;
      for (const o of tplBtns) o.setAttribute('aria-pressed', String(o === b));
      reset();
      line(esc(idle), 'vv__dim');
    });
  }
  offBtn.addEventListener('click', () => {
    offline = !offline;
    offBtn.setAttribute('aria-pressed', String(offline));
    root.classList.toggle('is-offline', offline);
    msg.textContent = (offline ? msg.dataset.off : msg.dataset.on) ?? '';
    if (live) line(offline ? '# network: offline · dev server still running' : '# network: back online', 'vv__dim');
  });

  return {};
}
