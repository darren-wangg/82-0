import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke suite for the core game loop, which is fully client-side — no
 * database needed (db.ts falls back to a placeholder connection string, and
 * the specs stop before any save/social step). Runs against a production
 * build for realism; locally an already-running server is reused.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    // The app honors prefers-reduced-motion (MotionConfig reducedMotion=
    // "user" in app-motion.tsx). Emulating it stops the infinite pulse
    // animations that otherwise keep buttons "unstable" forever under
    // Playwright's actionability checks.
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    // Mobile-first app; WebKit + iPhone viewport matches the primary test
    // device class. (Real-device quirks — e.g. Chrome/iOS viewport units —
    // still need a physical phone; see AGENTS.md.)
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
