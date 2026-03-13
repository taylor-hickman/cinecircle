import { describe, expect, it } from "vitest";

import { mapTmdbMovie } from "~/server/tmdb";

describe("mapTmdbMovie", () => {
  it("maps TMDB payloads into the local shape", () => {
    expect(
      mapTmdbMovie({
        id: 42,
        title: "Alien",
        overview: "Xenomorph problems.",
        poster_path: "/alien.jpg",
        release_date: "1979-05-25",
      }),
    ).toEqual({
      tmdbId: 42,
      title: "Alien",
      overview: "Xenomorph problems.",
      posterPath: "/alien.jpg",
      releaseYear: 1979,
    });
  });

  it("handles missing release dates", () => {
    expect(
      mapTmdbMovie({
        id: 7,
        title: "Unknown Release",
        overview: "",
        poster_path: null,
        release_date: null,
      }),
    ).toEqual({
      tmdbId: 7,
      title: "Unknown Release",
      overview: "",
      posterPath: null,
      releaseYear: null,
    });
  });
});
