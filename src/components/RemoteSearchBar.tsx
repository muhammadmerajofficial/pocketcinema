import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Mic, 
  MicOff, 
  X, 
  Volume2, 
  SlidersHorizontal, 
  RotateCcw, 
  Film, 
  Globe, 
  Calendar, 
  Layers, 
  Languages,
  Check
} from 'lucide-react';
import { soundFx } from '../utils/sound';
import { AdvancedSearchFilters, CategoryType } from '../types';

interface RemoteSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch?: () => void;
  activeCategory: string;
  disabled?: boolean;
  filters: AdvancedSearchFilters;
  onFiltersChange: (filters: AdvancedSearchFilters) => void;
}

// Support browser SpeechRecognition types
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

// Filter Options Definitions
const CATEGORY_OPTIONS: { label: string; value: 'all' | CategoryType }[] = [
  { label: 'All Categories', value: 'all' },
  { label: 'Movies', value: 'movies' },
  { label: 'TV Shows', value: 'tv' },
  { label: 'Anime', value: 'anime' },
];

const COUNTRY_OPTIONS = [
  { label: 'All Countries', value: '' },
  { label: 'United States', value: 'US' },
  { label: 'United Kingdom', value: 'GB' },
  { label: 'India', value: 'IN' },
  { label: 'Japan', value: 'JP' },
  { label: 'South Korea', value: 'KR' },
  { label: 'Bangladesh', value: 'BD' },
  { label: 'France', value: 'FR' },
  { label: 'Canada', value: 'CA' },
  { label: 'Germany', value: 'DE' },
  { label: 'Spain', value: 'ES' },
  { label: 'China', value: 'CN' },
  { label: 'Australia', value: 'AU' },
  { label: 'Italy', value: 'IT' },
];

const GENRE_OPTIONS = [
  { label: 'All Genres', value: '' },
  { label: 'Action', value: 'Action' },
  { label: 'Adventure', value: 'Adventure' },
  { label: 'Animation', value: 'Animation' },
  { label: 'Comedy', value: 'Comedy' },
  { label: 'Crime', value: 'Crime' },
  { label: 'Documentary', value: 'Documentary' },
  { label: 'Drama', value: 'Drama' },
  { label: 'Family', value: 'Family' },
  { label: 'Fantasy', value: 'Fantasy' },
  { label: 'History', value: 'History' },
  { label: 'Horror', value: 'Horror' },
  { label: 'Music', value: 'Music' },
  { label: 'Mystery', value: 'Mystery' },
  { label: 'Romance', value: 'Romance' },
  { label: 'Sci-Fi', value: 'Sci-Fi' },
  { label: 'Thriller', value: 'Thriller' },
  { label: 'War', value: 'War' },
  { label: 'Western', value: 'Western' },
];

const LANGUAGE_OPTIONS = [
  { label: 'All Languages', value: '' },
  { label: 'English (EN)', value: 'en' },
  { label: 'Bengali / বাংলা (BN)', value: 'bn' },
  { label: 'Hindi / हिन्दी (HI)', value: 'hi' },
  { label: 'Japanese / 日本語 (JA)', value: 'ja' },
  { label: 'Korean / 한국어 (KO)', value: 'ko' },
  { label: 'Spanish / Español (ES)', value: 'es' },
  { label: 'French / Français (FR)', value: 'fr' },
  { label: 'German / Deutsch (DE)', value: 'de' },
  { label: 'Chinese / 中文 (ZH)', value: 'zh' },
  { label: 'Italian / Italiano (IT)', value: 'it' },
];

export const RemoteSearchBar: React.FC<RemoteSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  onClearSearch,
  activeCategory,
  disabled = false,
  filters,
  onFiltersChange,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Count how many advanced filters are active (Country, Year, Genre, Language)
  const activeFilterCount = [
    Boolean(filters.country),
    Boolean(filters.year),
    Boolean(filters.genre),
    Boolean(filters.language),
  ].filter(Boolean).length;

  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechClass) {
      const recognition = new SpeechClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        onSearchChange(transcript);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechError('Mic permission required for voice search');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Voice error: ${event.error}`);
        }
        setTimeout(() => setSpeechError(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup abort
        }
      }
    };
  }, [onSearchChange]);

  const toggleVoiceSearch = () => {
    soundFx.playClick('voice');
    const win = window as unknown as IWindow;
    const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechClass) {
      setSpeechError('Speech recognition is not supported in this browser.');
      setTimeout(() => setSpeechError(null), 3500);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setSpeechError(null);
      try {
        recognitionRef.current?.start();
      } catch (e: any) {
        recognitionRef.current?.stop();
        setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch {
            setSpeechError('Could not start microphone');
          }
        }, 100);
      }
    }
  };

  const clearSearch = () => {
    soundFx.playClick('nav');
    if (onClearSearch) {
      onClearSearch();
    } else {
      onSearchChange('');
    }
  };

  const handleFilterToggle = () => {
    soundFx.playClick('switch');
    setIsFiltersOpen((prev) => !prev);
  };

  const updateFilter = <K extends keyof AdvancedSearchFilters>(key: K, value: AdvancedSearchFilters[K]) => {
    soundFx.playClick('switch');
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const resetAllFilters = () => {
    soundFx.playClick('switch');
    onFiltersChange({
      category: 'all',
      country: '',
      year: '',
      genre: '',
      language: '',
    });
  };

  const getPlaceholderText = () => {
    if (activeCategory === 'movies') {
      return 'Search movies, actors, actresses, directors, producers...';
    }
    if (activeCategory === 'tv') {
      return 'Search TV shows, actors, creators, producers, directors...';
    }
    if (activeCategory === 'anime') {
      return 'Search anime, voice actors, creators, directors, studios...';
    }
    return 'Search movies, TV shows, anime, actors, directors...';
  };

  // Helper for human-readable labels
  const getCountryLabel = (code: string) => {
    const found = COUNTRY_OPTIONS.find((c) => c.value === code);
    return found ? found.label : code;
  };

  const getLanguageLabel = (code: string) => {
    const found = LANGUAGE_OPTIONS.find((l) => l.value === code);
    return found ? found.label.split(' ')[0] : code;
  };

  return (
    <div id="remote-search-section" className="w-full flex flex-col gap-2">
      {/* Search Bar Main Row */}
      <div
        className={`relative flex items-center w-full rounded-2xl bg-[#101118]/95 border transition-all duration-300 ${
          isListening
            ? 'border-red-500/80 shadow-[0_0_25px_rgba(239,68,68,0.35)] ring-2 ring-red-500/20'
            : isFiltersOpen
            ? 'border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20'
            : 'border-zinc-800/90 focus-within:border-amber-500/60 focus-within:shadow-[0_0_20px_rgba(245,158,11,0.2)] focus-within:ring-2 focus-within:ring-amber-500/20'
        }`}
      >
        {/* Left Search Icon */}
        <div className="pl-3.5 pr-1.5 flex items-center justify-center text-zinc-400">
          <Search className="w-5 h-5 transition-colors" />
        </div>

        {/* Input Field */}
        <input
          id="remote-main-search-input"
          type="text"
          disabled={disabled}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={disabled ? 'Playback in progress • Controls active' : getPlaceholderText()}
          className="flex-1 py-3 px-2 bg-transparent text-zinc-100 text-sm sm:text-base placeholder:text-zinc-500 focus:outline-none tracking-wide disabled:cursor-not-allowed"
        />

        {/* Clear query button */}
        {searchQuery && (
          <button
            id="clear-search-btn"
            type="button"
            disabled={disabled}
            onClick={clearSearch}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors mr-1 cursor-pointer disabled:pointer-events-none"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Voice control button */}
        <button
          id="remote-voice-control-btn"
          type="button"
          disabled={disabled}
          onClick={toggleVoiceSearch}
          aria-label={isListening ? 'Stop listening' : 'Start voice search'}
          className={`relative mr-1.5 flex items-center justify-center p-2 sm:p-2.5 rounded-xl transition-all duration-300 select-none ${
            disabled ? 'opacity-40 pointer-events-none cursor-not-allowed' : 'cursor-pointer'
          } ${
            isListening
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/50 scale-105 animate-pulse'
              : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/80 border border-zinc-700/50'
          }`}
          title={isListening ? 'Listening... click to stop' : 'Voice search (Click to speak)'}
        >
          {isListening ? (
            <>
              <span className="absolute -inset-1 rounded-xl bg-red-500/30 animate-ping" />
              <Mic className="w-4 h-4 relative z-10" />
            </>
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>

        {/* Advanced Search Toggle Button */}
        <button
          id="advanced-search-toggle-btn"
          type="button"
          disabled={disabled}
          onClick={handleFilterToggle}
          className={`relative mr-2 flex items-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
            disabled ? 'opacity-40 pointer-events-none cursor-not-allowed' : ''
          } ${
            isFiltersOpen || activeFilterCount > 0
              ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/30'
              : 'bg-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-700/80 border border-zinc-700/50'
          }`}
          title="Toggle Advanced Search (Category, Country, Year, Genre, Language)"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span
              id="active-filters-count-badge"
              className={`flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black ${
                isFiltersOpen || activeFilterCount > 0
                  ? 'bg-black text-amber-400'
                  : 'bg-amber-500 text-black'
              }`}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Voice feedback states */}
      {isListening && (
        <div id="voice-active-indicator" className="flex items-center gap-2 px-3 py-1.5 bg-red-950/40 border border-red-800/40 rounded-xl text-xs text-red-300 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
          <Volume2 className="w-3.5 h-3.5 text-red-400 animate-bounce" />
          <span>Listening... Speak movie, TV show, anime name, or year clearly</span>
        </div>
      )}

      {speechError && (
        <div id="voice-error-indicator" className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/40 border border-amber-800/40 rounded-xl text-xs text-amber-300 animate-fadeIn">
          <MicOff className="w-3.5 h-3.5 text-amber-400" />
          <span>{speechError}</span>
        </div>
      )}

      {/* Active Filter Pills Bar (Shown whenever any filter is active) */}
      {activeFilterCount > 0 && (
        <div id="active-filters-pill-bar" className="flex flex-wrap items-center gap-1.5 px-1 py-1 text-xs">
          <span className="text-zinc-500 text-[11px] font-medium mr-1">Active filters:</span>

          {/* Country Pill */}
          {filters.country && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-medium">
              <Globe className="w-3 h-3 text-cyan-400" />
              <span>{getCountryLabel(filters.country)}</span>
              <button
                type="button"
                onClick={() => updateFilter('country', '')}
                className="hover:text-white p-0.5 ml-0.5 cursor-pointer"
                title="Remove country filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* Year Pill */}
          {filters.year && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium">
              <Calendar className="w-3 h-3 text-emerald-400" />
              <span>Year: {filters.year}</span>
              <button
                type="button"
                onClick={() => updateFilter('year', '')}
                className="hover:text-white p-0.5 ml-0.5 cursor-pointer"
                title="Remove year filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* Genre Pill */}
          {filters.genre && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-medium">
              <Layers className="w-3 h-3 text-purple-400" />
              <span>{filters.genre}</span>
              <button
                type="button"
                onClick={() => updateFilter('genre', '')}
                className="hover:text-white p-0.5 ml-0.5 cursor-pointer"
                title="Remove genre filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* Language Pill */}
          {filters.language && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-medium">
              <Languages className="w-3 h-3 text-rose-400" />
              <span>{getLanguageLabel(filters.language)}</span>
              <button
                type="button"
                onClick={() => updateFilter('language', '')}
                className="hover:text-white p-0.5 ml-0.5 cursor-pointer"
                title="Remove language filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* Clear All Filters Button */}
          <button
            id="reset-all-filters-btn"
            type="button"
            onClick={resetAllFilters}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] text-zinc-400 hover:text-amber-400 hover:bg-zinc-800/80 transition-colors ml-auto cursor-pointer"
            title="Clear all active filters"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All</span>
          </button>
        </div>
      )}

      {/* Expandable Advanced Search Panel (Category, Country, Year, Genre, Language) */}
      {isFiltersOpen && (
        <div
          id="advanced-search-panel"
          className="w-full bg-[#12131c]/95 border border-zinc-800/90 rounded-2xl p-3 sm:p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3.5 animate-fadeIn"
        >
          {/* Header with Title & Reset Button */}
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800/70">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-sm text-zinc-100 tracking-wide">Advanced Search System</span>
              <span className="text-[11px] text-zinc-400 hidden sm:inline">• Filter by Country, Year, Genre & Language</span>
            </div>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset All</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsFiltersOpen(false)}
                className="text-zinc-500 hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Close filters"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 4 Filter Selectors Grid (Country, Year, Genre, Language) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* 1. Country Filter */}
            <div id="filter-group-country" className="flex flex-col gap-1.5">
              <label htmlFor="filter-select-country" className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>Country</span>
              </label>
              <div className="relative">
                <select
                  id="filter-select-country"
                  value={filters.country}
                  onChange={(e) => updateFilter('country', e.target.value)}
                  className={`w-full py-2 px-2.5 bg-zinc-900/90 border rounded-xl text-xs font-medium focus:outline-none transition-all cursor-pointer ${
                    filters.country
                      ? 'border-cyan-500/70 text-cyan-300 ring-1 ring-cyan-500/20'
                      : 'border-zinc-800 text-zinc-200 focus:border-zinc-600'
                  }`}
                >
                  {COUNTRY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-100">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Year Filter (Custom Numeric Input - No Predefined List) */}
            <div id="filter-group-year" className="flex flex-col gap-1.5">
              <label htmlFor="filter-input-year" className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Release Year</span>
                </span>
                {filters.year && (
                  <button
                    type="button"
                    onClick={() => updateFilter('year', '')}
                    className="text-[10px] text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </label>
              <div className="relative flex items-center">
                <input
                  id="filter-input-year"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={filters.year}
                  onChange={(e) => {
                    // Only accept numbers up to 4 digits (e.g. 1999)
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 4);
                    updateFilter('year', cleaned);
                  }}
                  placeholder="e.g. 1999"
                  className={`w-full py-2 pl-3 pr-7 bg-zinc-900/90 border rounded-xl text-xs font-medium placeholder:text-zinc-500 focus:outline-none transition-all ${
                    filters.year
                      ? 'border-emerald-500/70 text-emerald-300 ring-1 ring-emerald-500/20'
                      : 'border-zinc-800 text-zinc-200 focus:border-zinc-600'
                  }`}
                />
                {filters.year && (
                  <button
                    type="button"
                    onClick={() => updateFilter('year', '')}
                    className="absolute right-2 p-0.5 text-zinc-400 hover:text-white rounded-md cursor-pointer"
                    title="Clear year"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 4. Genre Filter */}
            <div id="filter-group-genre" className="flex flex-col gap-1.5">
              <label htmlFor="filter-select-genre" className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>Genre</span>
              </label>
              <div className="relative">
                <select
                  id="filter-select-genre"
                  value={filters.genre}
                  onChange={(e) => updateFilter('genre', e.target.value)}
                  className={`w-full py-2 px-2.5 bg-zinc-900/90 border rounded-xl text-xs font-medium focus:outline-none transition-all cursor-pointer ${
                    filters.genre
                      ? 'border-purple-500/70 text-purple-300 ring-1 ring-purple-500/20'
                      : 'border-zinc-800 text-zinc-200 focus:border-zinc-600'
                  }`}
                >
                  {GENRE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-100">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 5. Language Filter */}
            <div id="filter-group-language" className="flex flex-col gap-1.5">
              <label htmlFor="filter-select-language" className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                <Languages className="w-3.5 h-3.5 text-rose-400" />
                <span>Language</span>
              </label>
              <div className="relative">
                <select
                  id="filter-select-language"
                  value={filters.language}
                  onChange={(e) => updateFilter('language', e.target.value)}
                  className={`w-full py-2 px-2.5 bg-zinc-900/90 border rounded-xl text-xs font-medium focus:outline-none transition-all cursor-pointer ${
                    filters.language
                      ? 'border-rose-500/70 text-rose-300 ring-1 ring-rose-500/20'
                      : 'border-zinc-800 text-zinc-200 focus:border-zinc-600'
                  }`}
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-100">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Preset Badges */}
          <div className="pt-2 border-t border-zinc-800/60 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mr-1">
              Popular Quick Presets:
            </span>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick('switch');
                onFiltersChange({
                  category: 'movies',
                  country: 'US',
                  year: '2024',
                  genre: 'Action',
                  language: 'en',
                });
              }}
              className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 hover:text-amber-300 transition-colors cursor-pointer"
            >
              2024 Hollywood Action
            </button>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick('switch');
                onFiltersChange({
                  category: 'anime',
                  country: 'JP',
                  year: '2024',
                  genre: 'Animation',
                  language: 'ja',
                });
              }}
              className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 hover:text-amber-300 transition-colors cursor-pointer"
            >
              Japanese Anime Hits
            </button>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick('switch');
                onFiltersChange({
                  category: 'tv',
                  country: 'KR',
                  year: '',
                  genre: 'Drama',
                  language: 'ko',
                });
              }}
              className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 hover:text-amber-300 transition-colors cursor-pointer"
            >
              K-Drama Series
            </button>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick('switch');
                onFiltersChange({
                  category: 'movies',
                  country: 'IN',
                  year: '',
                  genre: 'Action',
                  language: 'hi',
                });
              }}
              className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 hover:text-amber-300 transition-colors cursor-pointer"
            >
              Bollywood Cinema
            </button>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick('switch');
                onFiltersChange({
                  category: 'movies',
                  country: '',
                  year: '1999',
                  genre: 'Drama',
                  language: '',
                });
              }}
              className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 hover:text-amber-300 transition-colors cursor-pointer"
            >
              1999 Blockbuster Era
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
