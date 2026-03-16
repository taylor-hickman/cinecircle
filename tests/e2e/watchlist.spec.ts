import { test } from "@playwright/test";

test.describe("watchlist flow", () => {
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL,
    "Set PLAYWRIGHT_BASE_URL plus auth/TMDB env vars to run end-to-end flows.",
  );

  test("landing, auth entry, and invite entry routes respond", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("heading", {
        name: "Build a shared movie or TV circle, invite people, and decide what to watch next.",
      })
      .waitFor();

    await page.goto("/api/auth/signin?callbackUrl=%2Flists");
    await page.goto("/invite/example-token");
  });
});
