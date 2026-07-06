import { test, expect, type Page } from "@playwright/test";

/**
 * Smoke coverage of the client-only core loop: home → spin/place through a
 * full 8-pick draft → season sim reveals a final record — plus the budget
 * mode entry. Selectors lean on accessible names (en locale is the default).
 */

/** Reels take ~4s to settle before the candidate pool appears. */
const REEL_SETTLE_MS = 20_000;

/** One draft round: spin the reels, take the first draftable candidate,
 *  drop them into the first eligible roster slot. */
async function draftOnePick(page: Page) {
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  // Pool rows are the only list items on the board; non-draftable players
  // render disabled.
  const poolRow = page.locator("li > button:enabled").first();
  await expect(poolRow).toBeVisible({ timeout: REEL_SETTLE_MS });
  await poolRow.click();
  // While a candidate is selected, exactly the eligible slots are enabled.
  await page
    .locator('button[aria-label^="Place player at"]:enabled')
    .first()
    .click();
}

test("home offers the draft CTA and routes to the board", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start Draft" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(
    page.getByRole("button", { name: "Spin", exact: true })
  ).toBeVisible();
});

test("a full 8-pick draft simulates the season", async ({ page }) => {
  await page.goto("/play");
  for (let pick = 1; pick <= 8; pick++) {
    await draftOnePick(page);
    if (pick < 8) {
      // The header pick counter confirms the placement registered.
      await expect(page.getByText(`${pick + 1} of 8`)).toBeVisible();
    }
  }
  // The 8th placement flips the phase; the guard routes to the sim, which
  // auto-plays the season reveal up to the final record.
  await expect(page).toHaveURL(/\/sim$/, { timeout: 15_000 });
  await expect(page.getByLabel(/^Final record/)).toBeVisible({
    timeout: 60_000,
  });
});

test("budget mode: difficulty select opens a capped draft", async ({ page }) => {
  await page.goto("/budget");
  await page.getByRole("link", { name: /Normal/ }).click();
  await expect(page).toHaveURL(/\/budget\/play/);
  await expect(
    page.getByRole("button", { name: "Spin", exact: true })
  ).toBeVisible();
  // The budget meter is the mode's defining chrome.
  await expect(page.getByText("Budget", { exact: true })).toBeVisible();
});
