import { MediaItem } from '../types';
import { TMDB_API_KEY } from './api';

export interface SeasonInfo {
  seasonNumber: number;
  name: string;
  episodeCount: number;
}

export interface TvShowMetadata {
  id: string;
  totalSeasons: number;
  seasons: SeasonInfo[];
}

const seasonsCache = new Map<string, TvShowMetadata>();

/**
 * Fetch detailed TV Show seasons and episode counts from TMDB API,
 * with intelligent fallback for Anime or offline/cached media.
 */
export async function fetchTvShowMetadata(item: MediaItem): Promise<TvShowMetadata> {
  if (item.category === 'movies') {
    return {
      id: item.id,
      totalSeasons: 1,
      seasons: [{ seasonNumber: 1, name: 'Movie', episodeCount: 1 }],
    };
  }

  // Check cache
  const cached = seasonsCache.get(item.id);
  if (cached) {
    return cached;
  }

  // Extract numeric ID from item.id (e.g., 'tmdb-1399' -> '1399', '1399' -> '1399')
  const numericMatch = item.id.match(/\d+/);
  const numericId = numericMatch ? numericMatch[0] : null;

  const key = (typeof window !== 'undefined' && window.CINEMATIC_CONFIG?.TMDB_API_KEY) || TMDB_API_KEY;
  const baseUrl = (typeof window !== 'undefined' && window.CINEMATIC_CONFIG?.TMDB_BASE_URL) || 'https://api.themoviedb.org/3';

  // 1. Try TMDB /tv/{numericId} endpoint
  if (numericId && (item.category === 'tv' || item.category === 'anime')) {
    try {
      const res = await fetch(`${baseUrl}/tv/${numericId}?api_key=${key}`);
      if (res.ok) {
        const data = await res.json();
        const rawSeasons: any[] = Array.isArray(data.seasons) ? data.seasons : [];
        
        // Filter out Specials (season_number === 0) if regular seasons exist
        const regularSeasons = rawSeasons.filter((s) => s && s.season_number > 0);
        const targetSeasons = regularSeasons.length > 0 ? regularSeasons : rawSeasons;

        const mapped: SeasonInfo[] = targetSeasons.map((s, idx) => {
          const sNum = typeof s.season_number === 'number' && s.season_number > 0 ? s.season_number : idx + 1;
          const count = typeof s.episode_count === 'number' && s.episode_count > 0 ? s.episode_count : 12;
          return {
            seasonNumber: sNum,
            name: s.name || `Season ${sNum}`,
            episodeCount: count,
          };
        });

        if (mapped.length > 0) {
          mapped.sort((a, b) => a.seasonNumber - b.seasonNumber);
          const result: TvShowMetadata = {
            id: item.id,
            totalSeasons: mapped.length,
            seasons: mapped,
          };
          seasonsCache.set(item.id, result);
          return result;
        }
      }
    } catch (err) {
      console.warn('[TvShowData] TMDB seasons fetch error:', err);
    }
  }

  // 2. Fallback heuristic from item.durationOrEpisodes (e.g. "4 Seasons (37 Eps)" or "2 Seasons")
  let fallbackSeasonsCount = 1;
  let fallbackEpisodesPerSeason = 12;

  const seasonsMatch = item.durationOrEpisodes?.match(/(\d+)\s*Season/i);
  if (seasonsMatch) {
    fallbackSeasonsCount = Math.max(1, parseInt(seasonsMatch[1], 10));
  }

  const episodesMatch = item.durationOrEpisodes?.match(/(\d+)\s*Ep/i);
  if (episodesMatch) {
    const totalEps = parseInt(episodesMatch[1], 10);
    fallbackEpisodesPerSeason = Math.max(1, Math.round(totalEps / fallbackSeasonsCount) || 12);
  }

  const generatedSeasons: SeasonInfo[] = [];
  for (let s = 1; s <= fallbackSeasonsCount; s++) {
    generatedSeasons.push({
      seasonNumber: s,
      name: `Season ${s}`,
      episodeCount: fallbackEpisodesPerSeason,
    });
  }

  const fallbackMeta: TvShowMetadata = {
    id: item.id,
    totalSeasons: fallbackSeasonsCount,
    seasons: generatedSeasons,
  };

  seasonsCache.set(item.id, fallbackMeta);
  return fallbackMeta;
}

/**
 * Returns the exact episode count for a specific season.
 * Defaults to 12 if metadata is not loaded or season is not found.
 */
export function getSeasonEpisodeCount(metadata: TvShowMetadata | null, seasonNumber: number): number {
  if (!metadata || !metadata.seasons || metadata.seasons.length === 0) {
    return 12;
  }
  const seasonInfo = metadata.seasons.find((s) => s.seasonNumber === seasonNumber);
  return seasonInfo ? seasonInfo.episodeCount : 12;
}
