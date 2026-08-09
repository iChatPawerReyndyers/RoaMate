/**
 * ACT-03: Barometric Relative Pressure Mode for cave depth tracking.
 *
 * DISABLED. This feature has no working implementation right now - it
 * depends entirely on barometer access, and the only sensor library this
 * project had (first react-native-sensors, then expo-sensors) has been
 * removed for the reasons documented in PedometerService.ts. Unlike
 * PedometerService and ElevationTracker, there's no GPS fallback here:
 * altitude is unreliable/unavailable underground, which is exactly why
 * this mode existed in the first place.
 *
 * `start()` throws rather than silently doing nothing, so any screen that
 * calls this fails loudly and visibly instead of showing a cave session
 * that quietly never batches or uploads any depth data. Hide the
 * "Start Cave Tracking" UI entry point until this is restored.
 *
 * To restore: either resolve the expo-sensors native build issues, add a
 * different maintained barometer library, or write a small native module
 * against CMAltimeter (iOS) / Sensor.TYPE_PRESSURE (Android) directly.
 */
export class CaveBarometerTracker {
  constructor(private tripId: string, private userId: string, private destinationId?: string) {}

  start(): void {
    throw new Error(
      'Cave depth tracking is currently disabled - no barometer sensor library is wired up. ' +
      'See CaveBarometerTracker.ts for restoration options.',
    );
  }

  stop(): void {
    // no-op: start() always throws, so there is never an active session to stop
  }
}
