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

export function formatEmbedMasterId(rawId: string | number): string {
  const str = String(rawId).trim();
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
  let q = `?skin=${encodeURIComponent(skin)}&welcome_page=${encodeURIComponent(welcome)}&autoplay=${encodeURIComponent(autoplay)}`;
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
    getMovieUrl: (id) => `https://cinemaos.in/movie/watch/${formatEmbedMasterId(id)}`,
    getTvUrl: (id, s, e) => `https://cinemaos.in/tv/watch/${formatEmbedMasterId(id)}/${s}/${e}`,
    getAnimeUrl: (id, s, e) => `https://cinemaos.in/tv/watch/${formatEmbedMasterId(id)}/${s}/${e}`,
  },
  {
    id: 'peachify',
    name: 'Peachify.top',
    getMovieUrl: (id) => `https://peachify.top/embed/movie/${formatEmbedMasterId(id)}`,
    getTvUrl: (id, s, e) => `https://peachify.top/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
    getAnimeUrl: (id, s, e) => `https://peachify.top/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
  },
  {
    id: 'boredflix',
    name: 'BoredFlix.cc',
    getMovieUrl: (id) => `https://boredflix.cc/movie/${formatEmbedMasterId(id)}`,
    getTvUrl: (id, s, e) => `https://boredflix.cc/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
    getAnimeUrl: (id, s, e) => `https://boredflix.cc/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
  },
  {
    id: 'vidrock',
    name: 'VidRock.ru',
    getMovieUrl: (id) => `https://vidrock.ru/movie/${formatEmbedMasterId(id)}`,
    getTvUrl: (id, s, e) => `https://vidrock.ru/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
    getAnimeUrl: (id, s, e) => `https://vidrock.ru/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
  },
  {
    id: 'vidsrc',
    name: 'VidSrc.tw',
    getMovieUrl: (id) => `https://vidsrc.tw/embed/movie/${formatEmbedMasterId(id)}`,
    getTvUrl: (id, s, e) => `https://vidsrc.tw/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
    getAnimeUrl: (id, s, e) => `https://vidsrc.tw/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
  },
  {
    id: 'autoembed',
    name: 'AutoEmbed.cc',
    getMovieUrl: (id) => `https://player.autoembed.cc/embed/movie/${formatEmbedMasterId(id)}`,
    getTvUrl: (id, s, e) => `https://player.autoembed.cc/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
    getAnimeUrl: (id, s, e) => `https://player.autoembed.cc/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
  },
];
