/**
 * Single import point for the simulation engine. UI and API routes must use
 * getEngine() rather than importing an implementation directly.
 */

import { Engine } from "./contracts";
import { engine } from "@/engine";

export function getEngine(): Engine {
  return engine;
}
