// ⌘K: a command palette that doubles as a tiny terminal. Known commands are
// listed and filterable; anything else typed is run as a terminal command.
import { fill, strings, toast } from './store';
import { sfx } from './sound';

const dlg = document.getElementById('palette') as HTMLDialogElement;
const input = document.getElementById('pal-input') as HTMLInputElement;
const out = document.getElementById('pal-out')!;
const list = document.getElementById('pal-list')!;
const P = strings.palette;
const T = P.term;
const EMAIL = 'maitrungduc1410@gmail.com';
const toggle = (k: 'theme' | 'sound' | 'motion' | 'hud') =>
  (window as unknown as { __dmToggle: (k: string) => string }).__dmToggle(k);

interface Cmd { id: string; label: string; hint?: string; group: keyof typeof P.groups; run: () => void; keep?: boolean }

const PROMPT = '<svg class="ico ico--prompt" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3 10.5 8l-5 5" /></svg>';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
let lastPrompt: HTMLElement | null = null;
let revealRaf = 0;
function print(html: string) {
  out.insertAdjacentHTML('beforeend', html + '\n');
  reveal();
}

// Wait a frame: the list below re-renders after a command and changes how much
// height the output gets. Show the newest command from its prompt line, or the
// bottom if the whole block fits.
function reveal() {
  cancelAnimationFrame(revealRaf);
  revealRaf = requestAnimationFrame(() => {
    const bottom = out.scrollHeight - out.clientHeight;
    const pad = parseFloat(getComputedStyle(out).paddingTop) || 0;
    const promptTop = lastPrompt?.isConnected
      ? lastPrompt.getBoundingClientRect().top - out.getBoundingClientRect().top + out.scrollTop - pad
      : bottom;
    out.scrollTo({ top: Math.max(0, Math.min(bottom, promptTop)), behavior: document.documentElement.dataset.motion === 'on' ? 'smooth' : 'auto' });
  });
}

function go(id: string) {
  dlg.close();
  const el = document.getElementById(id);
  if (!el) { location.href = `${location.pathname.replace(/[^/]*$/, '')}#${id}`; return; }
  el.scrollIntoView({ behavior: document.documentElement.dataset.motion === 'on' ? 'smooth' : 'auto' });
  history.replaceState(null, '', `#${id}`);
}

const SECTION_IDS = ['now', 'native', 'runtime', 'lab', 'writing', 'career', 'contact'] as const;
const commands: Cmd[] = [
  ...SECTION_IDS.map((id) => ({
    id: `go-${id}`,
    label: strings.nav.sections[id],
    hint: `cd ${id}`,
    group: 'go' as const,
    run: () => go(id),
  })),
  { id: 'theme', label: P.theme, hint: 'theme', group: 'settings', run: () => toggle('theme'), keep: true },
  { id: 'motion', label: P.motion, hint: 'motion', group: 'settings', run: () => toggle('motion'), keep: true },
  { id: 'sound', label: P.sound, hint: 'sound', group: 'settings', run: () => toggle('sound'), keep: true },
  { id: 'hud', label: P.hud, hint: 'hud', group: 'settings', run: () => toggle('hud'), keep: true },
  ...strings.langs.map((l) => ({ id: `lang-${l.code}`, label: l.cmd, hint: l.code, group: 'settings' as const, run: () => { location.href = l.path + location.hash; } })),
  { id: 'github', label: P.github, hint: 'open github', group: 'links', run: () => window.open('https://github.com/maitrungduc1410', '_blank', 'noopener') },
  { id: 'vivari', label: P.vivari, hint: 'open vivari', group: 'links', run: () => window.open('https://vivari.run', '_blank', 'noopener') },
  { id: 'email', label: P.email, hint: 'copy email', group: 'links', run: () => { navigator.clipboard?.writeText(EMAIL).then(() => toast(strings.copied)); } },
  { id: 'hire', label: 'sudo hire me', hint: '⏎', group: 'fun', run: () => runTerm('sudo hire me'), keep: true },
  { id: 'help', label: 'help', hint: '⏎', group: 'fun', run: () => runTerm('help'), keep: true },
];

/* --------------------------------------------------------------- terminal */
const LAYER_IDS: Record<string, string> = { surface: 'top', top: 'top', now: 'now', native: 'native', runtime: 'runtime', lab: 'lab', frames: 'lab', writing: 'writing', career: 'career', contact: 'contact', '..': 'top', '~': 'top', '/': 'top' };

function runTerm(raw: string) {
  const cmd = raw.trim();
  if (!cmd) return;
  print(`<span class="c-g">${PROMPT}</span> ${esc(cmd)}`);
  lastPrompt = out.lastElementChild as HTMLElement;
  const lc = cmd.toLowerCase().replace(/\s+/g, ' ');
  const [head, ...rest] = lc.split(' ');
  const arg = rest.join(' ');
  sfx('enter');

  if (lc === 'help') {
    print(`<span class="c-a">${esc(T.help)}</span>`);
    const w = Math.max(...T.helpList.map(([c]) => c.length)) + 2;
    T.helpList.forEach(([c, d]) => print(`  <span class="c-c">${esc(c.padEnd(w))}</span><span class="c-d">${esc(d)}</span>`));
  } else if (lc === 'whoami') {
    print(esc(T.whoami));
  } else if (lc === 'ls' || lc === 'ls -la' || lc === 'ls projects') {
    print(['vivari/', 'react-native-video-trim/', 'react-native-shared-hero/', 'react-native-loader-kit/', 'node-scp-async/', 'konva-inspector/', 'socket.io-mesh-adapter/', 'lab/', 'writing/'].map((x) => `<span class="c-c">${x}</span>`).join('  '));
  } else if (lc === 'layers' || lc === 'stack') {
    const cls = ['c-a', 'c-c', 'c-v', 'c-g', 'c-r'];
    strings.layers.forEach((l, i) => print(`${l.code} <span class="${cls[i]}">${esc(l.name)}</span>`));
  } else if (head === 'cd') {
    const id = LAYER_IDS[arg || '~'];
    if (!id) { print(`<span class="c-r">${esc(fill(T.cdUnknown, arg))}</span>`); sfx('error'); return; }
    print(`<span class="c-d">${esc(fill(T.diving, arg || '~'))}</span>`);
    setTimeout(() => go(id), 280);
  } else if (lc === 'cat vivari' || lc === 'cat vivari/readme.md') {
    T.catVivari.forEach((l, i) => print(i === 0 ? `<span class="c-a">${esc(l)}</span>` : esc(l)));
  } else if (lc === 'stats' || lc === 'neofetch') {
    T.stats.forEach((l) => print(`<span class="c-c">${esc(l.slice(0, 9))}</span>${esc(l.slice(9))}`));
  } else if (['theme', 'sound', 'motion', 'hud'].includes(lc)) {
    const v = toggle(lc as 'theme');
    print(`<span class="c-d">${esc(fill(T.toggled, `${lc} → ${v}`))}</span>`);
  } else if (lc === 'sudo hire me' || lc === 'hire me') {
    print(`<span class="c-a">${esc(T.hire[0])}</span>`);
    setTimeout(() => { print(`<span class="c-g">${esc(T.hire[1])}</span>`); sfx('success'); }, 450);
    setTimeout(() => { print(esc(T.hire[2])); location.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Hello from ducmai.me')}`; }, 1100);
  } else if (lc.startsWith('sudo rm') || lc.startsWith('rm -rf')) {
    print(`<span class="c-r">${esc(T.rm)}</span>`);
    sfx('error');
  } else if (lc === 'coffee' || lc === 'make coffee' || lc === 'brew coffee') {
    print(esc(T.coffee));
  } else if (lc === 'exit' || lc === 'quit' || lc === ':q' || lc === ':wq') {
    print(`<span class="c-d">${esc(T.exit)}</span>`);
  } else if (lc === 'clear' || lc === 'cls') {
    out.textContent = '';
  } else if (lc === 'open github') {
    window.open('https://github.com/maitrungduc1410', '_blank', 'noopener');
  } else if (lc === 'open vivari') {
    window.open('https://vivari.run', '_blank', 'noopener');
  } else if (lc === 'date') {
    print(new Date().toString());
  } else if (lc === 'echo' || head === 'echo') {
    print(esc(cmd.slice(5)));
  } else {
    print(`<span class="c-r">${esc(fill(T.notFound, cmd))}</span>`);
    sfx('error');
  }
}

/* -------------------------------------------------------------------- UI */
let shown: Cmd[] = [];
let sel = 0;

function render() {
  const q = input.value.trim().toLowerCase();
  shown = commands.filter((c) => !q || c.label.toLowerCase().includes(q) || (c.hint ?? '').toLowerCase().includes(q) || c.id.includes(q));
  sel = Math.min(sel, Math.max(0, shown.length - 1));
  list.textContent = '';
  if (!shown.length) {
    const li = document.createElement('li');
    li.className = 'pal__grp';
    li.style.textTransform = 'none';
    li.textContent = P.empty;
    list.append(li);
    input.removeAttribute('aria-activedescendant');
    return;
  }
  let group = '';
  shown.forEach((c, i) => {
    if (c.group !== group) {
      group = c.group;
      const h = document.createElement('li');
      h.className = 'pal__grp';
      h.setAttribute('role', 'presentation');
      h.textContent = P.groups[c.group];
      list.append(h);
    }
    const li = document.createElement('li');
    li.className = 'pal__opt';
    li.id = `pal-${c.id}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(i === sel));
    li.innerHTML = `<span>${esc(c.label)}</span><small>${esc(c.hint ?? '')}</small>`;
    li.addEventListener('click', () => exec(c));
    li.addEventListener('pointermove', () => { if (sel !== i) { sel = i; mark(); } });
    list.append(li);
  });
  mark();
}

function mark() {
  [...list.querySelectorAll('.pal__opt')].forEach((el, i) => el.setAttribute('aria-selected', String(i === sel)));
  const cur = shown[sel];
  if (cur) {
    input.setAttribute('aria-activedescendant', `pal-${cur.id}`);
    document.getElementById(`pal-${cur.id}`)?.scrollIntoView({ block: 'nearest' });
  }
}

function exec(c: Cmd) {
  c.run();
  if (c.keep) { input.value = ''; render(); input.focus(); }
  else if (dlg.open && !c.id.startsWith('go-')) dlg.close();
}

input.addEventListener('input', () => { sel = 0; render(); });
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, shown.length); mark(); sfx('tick', 0.4); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(1, shown.length); mark(); sfx('tick', 0.3); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    const q = input.value.trim();
    // Anything that is not a palette entry runs in the terminal, so `whoami`,
    // `sudo rm -rf /` and friends work as typed.
    if (shown[sel]) exec(shown[sel]);
    else if (q) { runTerm(q); input.value = ''; render(); }
  } else if (e.key.length === 1 || e.key === 'Backspace') {
    sfx('key');
  }
});
dlg.addEventListener('close', () => sfx('close'));
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

let greeted = false;
export function open(initial = '') {
  if (!dlg.open) {
    dlg.showModal();
    sfx('open');
  }
  if (!greeted) { print(`<span class="c-d">${esc(T.banner)}</span>`); greeted = true; }
  input.value = initial;
  sel = 0;
  render();
  input.focus();
}
