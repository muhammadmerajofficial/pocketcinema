import { CategoryType, MediaItem } from '../types';
import { MEDIA_COLLECTION } from '../data/mediaData';

// Get API config from index.html window.CINEMATIC_CONFIG with direct fallbacks
const getWindowConfig = () => {
  if (typeof window !== 'undefined' && window.CINEMATIC_CONFIG) {
    return window.CINEMATIC_CONFIG;
  }
  return {
    TMDB_API_KEY: '57581da0c5497802a581bd56b93d7b0b',
    ANILIST_CLIENT_ID: '42013',
    TMDB_BASE_URL: 'https://api.themoviedb.org/3',
    TMDB_IMAGE_BASE: 'https://image.tmdb.org/t/p',
    ANILIST_GRAPHQL_URL: 'https://graphql.anilist.co',
  };
};

const config = getWindowConfig();
export const TMDB_API_KEY = config.TMDB_API_KEY;
export const ANILIST_CLIENT_ID = config.ANILIST_CLIENT_ID;
const TMDB_BASE_URL = config.TMDB_BASE_URL;
const TMDB_IMAGE_BASE = config.TMDB_IMAGE_BASE;
const ANILIST_GRAPHQL_URL = config.ANILIST_GRAPHQL_URL;

// TMDB Genre Maps
const MOVIE_GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

const TV_GENRES: Record<number, string> = {
  10759: 'Action & Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  10762: 'Kids',
  9648: 'Mystery',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
  37: 'Western',
};

// Clean HTML tags from AniList descriptions
function cleanHtml(html?: string | null): string {
  if (!html) return 'No synopsis available.';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?i>/gi, '')
    .replace(/<\/?b>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function getTimelineEra(year: number): string {
  if (year >= 2024) return '2024 - 2025 (Latest Releases)';
  if (year >= 2020) return '2020 - 2023 (Modern Masterpieces)';
  if (year >= 2010) return '2010 - 2019 (Golden Decade)';
  return 'Classic Cinema Milestone';
}

interface TmdbMovieResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average: number;
  genre_ids?: number[];
  adult?: boolean;
}

interface TmdbTvResult {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average: number;
  genre_ids?: number[];
  original_language?: string;
  origin_country?: string[];
}

interface AniListMedia {
  id: number;
  title: {
    english?: string | null;
    romaji?: string | null;
    native?: string | null;
  };
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
  };
  bannerImage?: string | null;
  genres?: string[];
  averageScore?: number | null;
  seasonYear?: number | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  };
  episodes?: number | null;
  description?: string | null;
  studios?: {
    nodes?: { name: string }[];
  };
  isAdult?: boolean;
  format?: string;
  status?: string;
}

export interface FetchResult {
  items: MediaItem[];
  hasMore: boolean;
  totalPages?: number;
}

// Convert TMDB Movie to MediaItem
function transformTmdbMovie(m: TmdbMovieResult): MediaItem {
  const year = m.release_date ? parseInt(m.release_date.slice(0, 4), 10) || 2024 : 2024;
  const genres = (m.genre_ids || [])
    .map((gid) => MOVIE_GENRES[gid])
    .filter(Boolean);

  const poster = m.poster_path
    ? `${TMDB_IMAGE_BASE}/w500${m.poster_path}`
    : 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop';

  const backdrop = m.backdrop_path
    ? `${TMDB_IMAGE_BASE}/w1280${m.backdrop_path}`
    : poster;

  return {
    id: `tmdb-m-${m.id}`,
    title: m.title || m.original_title || 'Untitled Movie',
    category: 'movies',
    year,
    releaseDate: m.release_date || `${year}`,
    poster,
    backdrop,
    rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : 7.5,
    genres: genres.length > 0 ? genres.slice(0, 3) : ['Cinema', 'Feature'],
    durationOrEpisodes: 'Feature Film',
    directorOrStudio: 'TMDB Cinema',
    synopsis: m.overview || 'No synopsis provided.',
    ageRating: m.adult ? 'R' : 'PG-13',
    timelineEra: getTimelineEra(year),
  };
}

// Convert TMDB TV Show to MediaItem
function transformTmdbTv(tv: TmdbTvResult): MediaItem {
  const year = tv.first_air_date ? parseInt(tv.first_air_date.slice(0, 4), 10) || 2024 : 2024;
  const genres = (tv.genre_ids || [])
    .map((gid) => TV_GENRES[gid])
    .filter(Boolean);

  const poster = tv.poster_path
    ? `${TMDB_IMAGE_BASE}/w500${tv.poster_path}`
    : 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop';

  const backdrop = tv.backdrop_path
    ? `${TMDB_IMAGE_BASE}/w1280${tv.backdrop_path}`
    : poster;

  return {
    id: `tmdb-tv-${tv.id}`,
    title: tv.name || tv.original_name || 'Untitled Series',
    category: 'tv',
    year,
    releaseDate: tv.first_air_date || `${year}`,
    poster,
    backdrop,
    rating: tv.vote_average ? Math.round(tv.vote_average * 10) / 10 : 8.0,
    genres: genres.length > 0 ? genres.slice(0, 3) : ['Drama', 'Television'],
    durationOrEpisodes: 'Television Series',
    directorOrStudio: 'TMDB TV Network',
    synopsis: tv.overview || 'No synopsis provided.',
    ageRating: 'TV-14',
    timelineEra: getTimelineEra(year),
  };
}

// Convert AniList Anime to MediaItem (Legacy fallback)
function transformAniListAnime(a: AniListMedia): MediaItem {
  const year = a.seasonYear || a.startDate?.year || 2024;
  const title = a.title.english || a.title.romaji || a.title.native || 'Untitled Anime';
  const poster = a.coverImage?.extraLarge || a.coverImage?.large || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop';
  const backdrop = a.bannerImage || poster;
  const studio = a.studios?.nodes?.[0]?.name || 'Animation Studio';
  const rating = a.averageScore ? Math.round((a.averageScore / 10) * 10) / 10 : 8.4;

  return {
    id: `anilist-${a.id}`,
    title,
    category: 'anime',
    year,
    releaseDate: a.startDate?.year ? `${a.startDate.year}` : `${year}`,
    poster,
    backdrop,
    rating,
    genres: a.genres && a.genres.length > 0 ? a.genres.slice(0, 3) : ['Anime', 'Action'],
    durationOrEpisodes: a.episodes ? `${a.episodes} Episodes` : (a.format || 'Anime Series'),
    directorOrStudio: studio,
    synopsis: cleanHtml(a.description),
    ageRating: a.isAdult ? '18+' : '14+',
    timelineEra: getTimelineEra(year),
  };
}

// Convert TMDB Anime to MediaItem
function transformTmdbAnime(tv: TmdbTvResult): MediaItem {
  const year = tv.first_air_date ? parseInt(tv.first_air_date.slice(0, 4), 10) || 2024 : 2024;
  const genres = (tv.genre_ids || [])
    .map((gid) => TV_GENRES[gid])
    .filter(Boolean);

  const poster = tv.poster_path
    ? `${TMDB_IMAGE_BASE}/w500${tv.poster_path}`
    : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop';

  const backdrop = tv.backdrop_path
    ? `${TMDB_IMAGE_BASE}/w1280${tv.backdrop_path}`
    : poster;

  const animeGenres = genres.length > 0
    ? (genres.includes('Animation') ? ['Anime', ...genres.filter((g) => g !== 'Animation').slice(0, 2)] : ['Anime', ...genres.slice(0, 2)])
    : ['Anime', 'Animation', 'Action'];

  return {
    id: `tmdb-anime-${tv.id}`,
    title: tv.name || tv.original_name || 'Untitled Anime',
    category: 'anime',
    year,
    releaseDate: tv.first_air_date || `${year}`,
    poster,
    backdrop,
    rating: tv.vote_average ? Math.round(tv.vote_average * 10) / 10 : 8.4,
    genres: animeGenres,
    durationOrEpisodes: 'Anime Series',
    directorOrStudio: tv.original_name ? `${tv.original_name}` : 'Anime Production',
    synopsis: tv.overview || 'No synopsis provided.',
    ageRating: 'TV-14',
    timelineEra: getTimelineEra(year),
  };
}

// --- Fetch TMDB Movies with Unlimited Pagination (Trending or Discover for 500+ pages) ---
export async function fetchMovies(searchQuery = '', page = 1): Promise<FetchResult> {
  try {
    const key = (typeof window !== 'undefined' && window.CINEMATIC_CONFIG?.TMDB_API_KEY) || TMDB_API_KEY;
    const baseUrl = (typeof window !== 'undefined' && window.CINEMATIC_CONFIG?.TMDB_BASE_URL) || TMDB_BASE_URL;

    // Use search endpoint when query is present; otherwise use discover/movie for virtually infinite pages
    const url = searchQuery.trim()
      ? `${baseUrl}/search/movie?api_key=${key}&query=${encodeURIComponent(searchQuery)}&include_adult=false&page=${page}`
      : `${baseUrl}/discover/movie?api_key=${key}&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB Movie HTTP error: ${res.status}`);
    const data = await res.json();

    if (Array.isArray(data.results)) {
      const items = data.results.map(transformTmdbMovie);
      const totalPages = data.total_pages || 500;
      return {
        items,
        hasMore: page < Math.min(totalPages, 500),
        totalPages,
      };
    }
  } catch (err) {
    console.warn('[TMDB] Movie fetch fallback applied:', err);
  }

  // Fallback to static data on page 1 only
  const fallback = MEDIA_COLLECTION.filter((i) => i.category === 'movies');
  const filtered = !searchQuery.trim()
    ? fallback
    : fallback.filter((i) => i.title.toLowerCase().includes(searchQuery.toLowerCase()) || i.genres.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase())));

  return {
    items: page === 1 ? filtered : [],
    hasMore: false,
  };
}

// --- Fetch TMDB TV Shows with Unlimited Pagination (Trending or Discover for 500+ pages) ---
export async function fetchTvShows(searchQuery = '', page = 1): Promise<FetchResult> {
  try {
    const key = (typeof window !== 'undefined' && window.CINEMATIC_CONFIG?.TMDB_API_KEY) || TMDB_API_KEY;
    const baseUrl = (typeof window !== 'undefined' && window.CINEMATIC_CONFIG?.TMDB_BASE_URL) || TMDB_BASE_URL;

    // Use search endpoint when query is present; otherwise use discover/tv for virtually infinite pages
    const url = searchQuery.trim()
      ? `${baseUrl}/search/tv?api_key=${key}&query=${encodeURIComponent(searchQuery)}&include_adult=false&page=${page}`
      : `${baseUrl}/discover/tv?api_key=${key}&sort_by=popularity.desc&include_adult=false&page=${page}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB TV HTTP error: ${res.status}`);
    const data = await res.json();

    if (Array.isArray(data.results)) {
      const items = data.results.map(transformTmdbTv);
      const totalPages = data.total_pages || 500;
      return {
        items,
        hasMore: page < Math.min(totalPages, 500),
        totalPages,
      };
    }
  } catch (err) {
    console.warn('[TMDB] TV fetch fallback applied:', err);
  }

  // Fallback to static data on page 1 only
  const fallback = MEDIA_COLLECTION.filter((i) => i.category === 'tv');
  const filtered = !searchQuery.trim()
    ? fallback
    : fallback.filter((i) => i.title.toLowerCase().includes(searchQuery.toLowerCase()) || i.genres.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase())));

  return {
    items: page === 1 ? filtered : [],
    hasMore: false,
  };
}

// --- Fetch Anime from TMDB with Unlimited Pagination (with_genres=16 & with_original_language=ja) ---
export async function fetchAnime(searchQuery = '', page = 1): Promise<FetchResult> {
  try {
    const key = (typeof window !== 'undefined' && window.CINEMATIC_CONFIG?.TMDB_API_KEY) || TMDB_API_KEY;
    const baseUrl = (typeof window !== 'undefined' && window.CINEMATIC_CONFIG?.TMDB_BASE_URL) || TMDB_BASE_URL;

    // Use search endpoint when query is present; otherwise discover anime (Animation genre 16 + Japanese original language ja)
    const url = searchQuery.trim()
      ? `${baseUrl}/search/tv?api_key=${key}&query=${encodeURIComponent(searchQuery)}&include_adult=false&page=${page}`
      : `${baseUrl}/discover/tv?api_key=${key}&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=${page}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB Anime HTTP error: ${res.status}`);
    const data = await res.json();

    if (Array.isArray(data.results)) {
      let results: TmdbTvResult[] = data.results;

      // When searching, prioritize anime/animation or Japanese origin if matched
      if (searchQuery.trim()) {
        const animeFiltered = results.filter((tv) => 
          tv.genre_ids?.includes(16) || 
          tv.original_language === 'ja' || 
          tv.origin_country?.includes('JP')
        );
        if (animeFiltered.length > 0) {
          results = animeFiltered;
        }
      }

      const items = results.map(transformTmdbAnime);
      const totalPages = data.total_pages || 500;
      return {
        items,
        hasMore: page < Math.min(totalPages, 500),
        totalPages,
      };
    }
  } catch (err) {
    console.warn('[TMDB] Anime fetch fallback applied:', err);
  }

  // Fallback to static data on page 1 only
  const fallback = MEDIA_COLLECTION.filter((i) => i.category === 'anime');
  const filtered = !searchQuery.trim()
    ? fallback
    : fallback.filter((i) => i.title.toLowerCase().includes(searchQuery.toLowerCase()) || i.genres.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase())));

  return {
    items: page === 1 ? filtered : [],
    hasMore: false,
  };
}

// Master dispatcher based on active category & page
export async function loadCategoryMedia(
  category: CategoryType, 
  searchQuery = '', 
  page = 1
): Promise<FetchResult> {
  if (category === 'movies') {
    return fetchMovies(searchQuery, page);
  } else if (category === 'tv') {
    return fetchTvShows(searchQuery, page);
  } else {
    return fetchAnime(searchQuery, page);
  }
}
