/**
 * Framer Motion feature bundle, loaded lazily by <AppMotion>'s LazyMotion.
 * domMax (not domAnimation) because the team-size switch uses a layoutId
 * shared-layout transition, which needs the projection code.
 */

import { domMax } from "framer-motion";

export default domMax;
