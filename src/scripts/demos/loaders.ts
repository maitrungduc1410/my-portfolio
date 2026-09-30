import { sfx } from '../sound';

export function init(root: HTMLElement) {
  const grid = root.querySelector<HTMLElement>('.loaders')!;
  const name = root.querySelector<HTMLElement>('[data-loader-name]')!;
  const speed = root.querySelector<HTMLInputElement>('[data-k="speed"]')!;
  const items = [...grid.querySelectorAll<HTMLButtonElement>('.ld')];
  items.forEach((b, i) => b.addEventListener('click', () => {
    items.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    name.textContent = b.dataset.name ?? '';
    sfx('ping', i);
  }));
  speed.addEventListener('input', () => {
    grid.style.setProperty('--spd', speed.value);
    sfx('tick', +speed.value / 2.5);
  });
}
