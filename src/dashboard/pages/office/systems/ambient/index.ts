/**
 * systems/ambient/index.ts
 * Public barrel for the ambient systems module.
 *
 * Lane 2 (OfficeStage.tsx) should import from here:
 *   import { initAmbientState, tickAmbientState } from '../systems/ambient';
 */

export type { AudioController } from "./audio";
export { initAudio } from "./audio";
export type { LightingState, PeriodName } from "./dayNightCycle";
export { getCurrentLighting, getLightingForHour } from "./dayNightCycle";
export type { AmbientState } from "./state";
export { initAmbientState, tickAmbientState } from "./state";

export { drawWallClock } from "./wallClock";
export type { WeatherMode, WeatherParticle, WeatherState } from "./weather";
export { drawWeather, initWeather, tickWeather } from "./weather";
