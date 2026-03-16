import { describe, expect, it } from "vitest";

import { mapTmdbMovie } from "~/server/tmdb";

describe("mapTmdbMovie", () => {
  it("maps TMDB payloads into the local shape with a single director", () => {
    expect(
      mapTmdbMovie({
        id: 42,
        title: "Alien",
        overview: "Xenomorph problems.",
        poster_path: "/alien.jpg",
        backdrop_path: "/alien-backdrop.jpg",
        release_date: "1979-05-25",
        credits: {
          crew: [
            {
              job: "Director",
              name: "Ridley Scott",
            },
          ],
        },
      }),
    ).toEqual({
      tmdbId: 42,
      title: "Alien",
      director: "Ridley Scott",
      overview: "Xenomorph problems.",
      posterPath: "/alien.jpg",
      backdropPath: "/alien-backdrop.jpg",
      releaseYear: 1979,
    });
  });

  it("joins multiple directors in credit order without duplicates", () => {
    expect(
      mapTmdbMovie({
        id: 8,
        title: "Collaborative Feature",
        overview: "Two directors, one movie.",
        poster_path: null,
        backdrop_path: null,
        release_date: "2024-10-11",
        credits: {
          crew: [
            {
              job: "Writer",
              name: "Writer Name",
            },
            {
              job: "Director",
              name: "Director One",
            },
            {
              job: "Director",
              name: "Director Two",
            },
            {
              job: "Director",
              name: "Director One",
            },
          ],
        },
      }),
    ).toMatchObject({
      director: "Director One, Director Two",
    });
  });

  it("falls back to a null director when no director credit exists", () => {
    expect(
      mapTmdbMovie({
        id: 7,
        title: "Unknown Release",
        overview: "",
        poster_path: null,
        backdrop_path: null,
        release_date: null,
        credits: {
          crew: [
            {
              job: "Writer",
              name: "Writer Name",
            },
          ],
        },
      }),
    ).toEqual({
      tmdbId: 7,
      title: "Unknown Release",
      director: null,
      overview: "",
      posterPath: null,
      backdropPath: null,
      releaseYear: null,
    });
  });
});
