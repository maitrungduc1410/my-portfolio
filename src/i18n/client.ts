import type { Dict } from './en';
import { LOCALES, LOCALE_META, type Locale } from './index';

/** The subset of strings the browser needs, serialised into the page as JSON.
 *  Template functions are flattened to strings with a `{x}` placeholder. */
export function clientStrings(t: Dict, locale: Locale, stats: { line: string[] }) {
  const term = t.palette.term;
  return {
    locale,
    nav: {
      theme: t.nav.theme,
      sound: t.nav.sound,
      motion: t.nav.motion,
      hud: t.nav.hud,
      sections: {
        now: t.nav.now,
        native: t.nav.native,
        runtime: t.nav.runtime,
        lab: t.nav.lab,
        writing: t.nav.writing,
        career: t.nav.career,
        contact: t.nav.contact,
      },
    },
    layers: t.layers.map((l) => ({ code: l.code, name: l.name, section: l.section })),
    langs: LOCALES.filter((l) => l !== locale).map((l) => ({
      code: l,
      label: LOCALE_META[l].label,
      path: LOCALE_META[l].path,
      cmd: t.palette.lang(LOCALE_META[l].label),
    })),
    palette: {
      empty: t.palette.empty,
      groups: t.palette.groups,
      theme: t.palette.theme,
      sound: t.palette.sound,
      motion: t.palette.motion,
      hud: t.palette.hud,
      github: t.palette.github,
      email: t.palette.email,
      vivari: t.palette.vivari,
      term: {
        banner: term.banner,
        help: term.help,
        helpList: term.helpList,
        whoami: term.whoami,
        notFound: term.notFound('{x}'),
        hire: term.hire,
        rm: term.rm,
        coffee: term.coffee,
        exit: term.exit,
        cdUnknown: term.cdUnknown('{x}'),
        diving: term.diving('{x}'),
        catVivari: term.catVivari,
        toggled: term.toggled('{x}'),
        stats: stats.line,
      },
    },
    hud: t.hud,
    demos: {
      wave: { play: t.demos.wave.play, pause: t.demos.wave.pause },
      vivari: { start: t.demos.vivari.start, restart: t.demos.vivari.restart, request: t.demos.vivari.request, reload: t.demos.vivari.reload },
      loaders: { hint: t.demos.loaders.hint },
    },
    copied: t.contact.copied,
  };
}

export type ClientStrings = ReturnType<typeof clientStrings>;
