import "server-only";

import { TRPCError } from "@trpc/server";

import { env } from "~/env";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

type TmdbMovieResult = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  credits?: {
    crew: Array<{
      job: string;
      name: string;
    }>;
  };
};

export type MovieSearchResult = {
  tmdbId: number;
  title: string;
  director: string | null;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseYear: number | null;
};

function getDirector(crew: TmdbMovieResult["credits"] = { crew: [] }) {
  const directors = crew.crew
    .filter((member) => member.job === "Director")
    .map((member) => member.name.trim())
    .filter((name) => name.length > 0);

  const uniqueDirectors = [...new Set(directors)];
  return uniqueDirectors.length > 0 ? uniqueDirectors.join(", ") : null;
}

export function mapTmdbMovie(movie: TmdbMovieResult): MovieSearchResult {
  const year = movie.release_date?.slice(0, 4);

  return {
    tmdbId: movie.id,
    title: movie.title,
    director: getDirector(movie.credits),
    overview: movie.overview,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    releaseYear: year ? Number(year) : null,
  };
}

function getTmdbApiKey() {
  const apiKey = env.TMDB_API_KEY;
  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "TMDB_API_KEY is not configured.",
    });
  }

  return apiKey;
}

async function tmdbFetch<T>(path: string, searchParams?: URLSearchParams) {
  const apiKey = getTmdbApiKey();
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set("api_key", apiKey);

  for (const [key, value] of searchParams ?? []) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    next: { revalidate: 60 * 60 * 6 },
  });

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "TMDB request failed.",
    });
  }

  return (await response.json()) as T;
}

export async function searchMovies(query: string) {
  const payload = await tmdbFetch<{ results: TmdbMovieResult[] }>(
    "/search/movie",
    new URLSearchParams({
      include_adult: "false",
      query,
    }),
  );

  const topResults = payload.results.slice(0, 10).map(mapTmdbMovie);
  const detailResults = await Promise.allSettled(
    topResults.map((movie) => getMovieDetails(movie.tmdbId)),
  );

  return topResults.map((movie, index) => {
    const detailResult = detailResults[index];

    if (detailResult?.status !== "fulfilled") {
      return movie;
    }

    return {
      ...movie,
      director: detailResult.value.director,
    };
  });
}

export async function getMovieDetails(tmdbId: number) {
  const payload = await tmdbFetch<TmdbMovieResult>(
    `/movie/${tmdbId}`,
    new URLSearchParams({
      append_to_response: "credits",
    }),
  );

  return mapTmdbMovie(payload);
}
