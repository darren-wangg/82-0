/**
 * Single import point for the simulation engine. UI and API routes must use
 * getEngine() rather than importing an implementation directly.
 *
 * Wave 2 integration: replace the mock with `import { engine } from "@/engine"`.
 */

import { Engine } from "./contracts";
import { mockEngine } from "./engine-mock";

export function getEngine(): Engine {
  return mockEngine;
}
