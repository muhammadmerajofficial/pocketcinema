export type CategoryType = 'movies' | 'tv' | 'anime';

export interface MediaItem {
  id: string;
  title: string;
  category: CategoryType;
  year: number;
  releaseDate: string;
  poster: string;
  backdrop: string;
  rating: number; // e.g., 8.9
  genres: string[];
  durationOrEpisodes: string; // e.g. "2h 49m" or "4 Seasons (37 Eps)"
  directorOrStudio: string;
  synopsis: string;
  tagline?: string;
  ageRating: string; // "PG-13", "TV-MA", "16+"
  cast?: string[];
  timelineEra: string; // e.g., "2024 - 2025 (Latest Releases)", "2020 - 2023 (Modern Era)", "2010 - 2019 (Golden Blockbusters)", "Classic Masterpieces"
}

export type RemoteButtonType = 'up' | 'down' | 'prev' | 'next' | 'ok';

export interface RemoteFeedback {
  action: string;
  timestamp: number;
}
