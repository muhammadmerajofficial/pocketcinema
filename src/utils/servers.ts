export interface PlayerOptions {
  skin?: 'onyx' | 'aurora';
  welcomePage?: 'on' | 'off';
  autoplay?: 'on' | 'off';
  subUrl?: string;
  subLabel?: string;
}

export interface PlayerServer {
  id: string;
  name: string;
  getMovieUrl: (id: string, options?: PlayerOptions) => string;
  getTvUrl: (id: string, s: number, e: number, options?: PlayerOptions) => string;
  getAnimeUrl: (id: string, s: number, e: number, options?: PlayerOptions) => string;
}

const STATIC_ID_MAP: Record<string, string> = {
  'm-dune2': '693134',
  'm-oppenheimer': '872585',
  'm-spider-verse': '569094',
  'm-batman': '414906',
  'm-topgun': '361743',
  'm-parasite': '496243',
  'm-interstellar': '157336',
  'm-dark-knight': '155',
  'm-inception': '27205',
  'm-pulp-fiction': '680',
  'tv-fallout': '106379',
  'tv-last-of-us': '100088',
  'tv-house-dragon': '94997',
  'tv-succession': '76331',
  'tv-stranger-things': '66732',
  'tv-chernobyl': '87108',
  'tv-game-of-thrones': '1399',
  'tv-breaking-bad': '1396',
  'tv-sopranos': '1398',
  'a-frieren': '209867',
  'a-solo-leveling': '210879',
  'a-demon-slayer': '85937',
  'a-jujutsu-kaisen': '95479',
  'a-attack-on-titan': '1429',
  'a-chainsaw-man': '114410',
  'a-steins-gate': '42502',
  'a-hunter-hunter': '46298',
  'a-fullmetal': '31911',
  'a-death-note': '13916',
};

export function formatEmbedMasterId(rawId: string | number): string {
  const str = String(rawId).trim();
  if (STATIC_ID_MAP[str]) {
    return STATIC_ID_MAP[str];
  }
  if (str.startsWith('tt')) {
    return str;
  }
  const match = str.match(/tt\d+/);
  if (match) return match[0];
  const numMatch = str.match(/\d+/);
  return numMatch ? numMatch[0] : str;
}

export function buildEmbedMasterQuery(opts?: PlayerOptions): string {
  const skin = opts?.skin || 'onyx';
  const welcome = opts?.welcomePage || 'off';
  const autoplay = opts?.autoplay || 'on';
  let q = `?skin=${encodeURIComponent(skin)}&welcome_page=${encodeURIComponent(welcome)}&autoplay=${encodeURIComponent(autoplay)}&auto_play=1&volume=100`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    q += `&referrer=${encodeURIComponent(window.location.origin)}`;
  }
  if (opts?.subUrl && opts?.subUrl.trim()) {
    q += `&sub_url[]=${encodeURIComponent(opts.subUrl.trim())}`;
    if (opts?.subLabel && opts?.subLabel.trim()) {
      q += `&sub_label[]=${encodeURIComponent(opts.subLabel.trim())}`;
    }
  }
  return q;
}

// Player servers with EmbedMaster as #1 (Primary & Default)
export const ALL_PLAYER_SERVERS: PlayerServer[] = [
  {
    id: 'embedmaster',
    name: 'EmbedMaster.link (Official)',
    getMovieUrl: (id, opts) => `https://embedmaster.link/movie/${formatEmbedMasterId(id)}${buildEmbedMasterQuery(opts)}`,
    getTvUrl: (id, s, e, opts) => `https://embedmaster.link/tv/${formatEmbedMasterId(id)}/${s}/${e}${buildEmbedMasterQuery(opts)}`,
    getAnimeUrl: (id, s, e, opts) => `https://embedmaster.link/tv/${formatEmbedMasterId(id)}/${s}/${e}${buildEmbedMasterQuery(opts)}`,
  },
  {
    id: 'cinemaos-in',
    name: 'CinemaOS.in',
    getMovieUrl: (id) => `https://cinemaos.in/movie/watch/${formatEmbedMasterId(id)}?autoplay=1&auto_play=1&volume=100`,
    getTvUrl: (id, s, e) => `https://cinemaos.in/tv/watch/${formatEmbedMasterId(id)}/${s}/${e}?autoplay=1&auto_play=1&volume=100`,
    getAnimeUrl: (id, s, e) => `https://cinemaos.in/tv/watch/${formatEmbedMasterId(id)}/${s}/${e}?autoplay=1&auto_play=1&volume=100`,
  },
  {
    id: 'peachify',
    name: 'Peachify.top',
    getMovieUrl: (id) => `https://peachify.top/embed/movie/${formatEmbedMasterId(id)}?autoplay=1`,
    getTvUrl: (id, s, e) => `https://peachify.top/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}?autoplay=1`,
    getAnimeUrl: (id, s, e) => `https://peachify.top/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}?autoplay=1`,
  },
  {
    id: 'boredflix',
    name: 'BoredFlix.cc',
    getMovieUrl: (id) => `https://boredflix.cc/movie/${formatEmbedMasterId(id)}?autoplay=1`,
    getTvUrl: (id, s, e) => `https://boredflix.cc/tv/${formatEmbedMasterId(id)}/${s}/${e}?autoplay=1`,
    getAnimeUrl: (id, s, e) => `https://boredflix.cc/tv/${formatEmbedMasterId(id)}/${s}/${e}?autoplay=1`,
  },
  {
    id: 'vidrock',
    name: 'VidRock.ru',
    getMovieUrl: (id) => `https://vidrock.ru/movie/${formatEmbedMasterId(id)}?autoplay=1`,
    getTvUrl: (id, s, e) => `https://vidrock.ru/tv/${formatEmbedMasterId(id)}/${s}/${e}?autoplay=1`,
    getAnimeUrl: (id, s, e) => `https://vidrock.ru/tv/${formatEmbedMasterId(id)}/${s}/${e}?autoplay=1`,
  },
  {
    id: 'vidsrc',
    name: 'VidSrc.tw',
    getMovieUrl: (id) => `https://vidsrc.tw/embed/movie/${formatEmbedMasterId(id)}?autoplay=1`,
    getTvUrl: (id, s, e) => `https://vidsrc.tw/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}?autoplay=1`,
    getAnimeUrl: (id, s, e) => `https://vidsrc.tw/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}?autoplay=1`,
  },
  {
    id: 'autoembed',
    name: 'AutoEmbed.cc',
    getMovieUrl: (id) => `https://player.autoembed.cc/embed/movie/${formatEmbedMasterId(id)}?autoplay=1`,
    getTvUrl: (id, s, e) => `https://player.autoembed.cc/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}?autoplay=1`,
    getAnimeUrl: (id, s, e) => `https://player.autoembed.cc/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}?autoplay=1`,
  },
];
