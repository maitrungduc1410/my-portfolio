import type { Locale } from '../i18n';

/**
 * The hero headline, one value per locale. This is the only place it lives:
 * the <h1>, the page title, the OG card and the terminal's `whoami` read it.
 * A trailing "\n" hint is not needed; the hero balances the line itself.
 */
export const HEADLINE: Record<Locale, string> = {
  en: 'I work one layer below.',
  vi: 'Tôi làm việc ở tầng bên dưới.',
};

/** Candidates under consideration. Not rendered anywhere. */
export const HEADLINE_ALTERNATIVES: Record<Locale, string>[] = [
  { en: 'Below the UI is where I live.', vi: 'Tôi sống ở phía dưới lớp UI.' },
  { en: 'I go where the frame gets made.', vi: 'Tôi đi tới nơi từng khung hình được tạo ra.' },
  { en: 'Magic is just a layer you haven’t opened yet.', vi: 'Phép màu chỉ là một tầng bạn chưa mở ra.' },
  { en: 'One layer deeper, until it’s not magic.', vi: 'Đào sâu thêm một tầng, tới khi hết còn là phép màu.' },
  { en: 'From pixels down to syscalls.', vi: 'Từ pixel xuống tới syscall.' },
];
