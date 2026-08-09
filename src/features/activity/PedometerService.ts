import { apiClient } from '@/services/api/client';

const BATCH_INTERVAL_MS = 12000; // 10-15s batching window (ACT-01)

/**
 * ACT-01: step-counting pipeline.
 *
 * SENSOR ACCESS TEMPORARILY REMOVED. This previously used
 * react-native-sensors (abandoned - breaks the Android build on current
 * Gradle) and then expo-sensors (pulled in the `expo` package, which
 * caused a cascade of native build issues in a bare RN CLI project:
 * missing expo-module-gradle-plugin registration, then a further
 * "NitroModules" CocoaPods error via react-native-mmkv's Nitro dependency).
 *
 * The batching/upload architecture below is unchanged and still correct -
 * call `recordSteps(n)` from wherever a step count becomes available.
 * To restore live sensor readings, either:
 *   1. Properly complete the expo-sensors setup (`npx install-expo-modules`,
 *      resolve the Nitro pod dependency), or
 *   2. Write a small native module directly against CMPedometer (iOS) /
 *      Step Counter Sensor (Android) without the Expo layer, or
 *   3. Use a different maintained pedometer-specific library instead of a
 *      general sensors package.
 */
export class PedometerService {
  private stepCount = 0;
  private lastFlush = Date.now();
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor(private tripId: string, private userId: string) {}

  start(): void {
    this.lastFlush = Date.now();
    this.flushTimer = setInterval(() => this.flush(), BATCH_INTERVAL_MS);
  }

  /** Call this from wherever step data becomes available (manual entry, a future sensor integration, etc). */
  recordSteps(count: number): void {
    this.stepCount += count;
  }

  stop(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flush();
  }

  private async flush(): Promise<void> {
    if (this.stepCount === 0) return;
    const steps = this.stepCount;
    this.stepCount = 0;
    const now = new Date();

    await apiClient.post('/api/v1/activity/sessions', {
      tripId: this.tripId,
      userId: this.userId,
      type: 'WALKING',
      stepCount: steps,
      distanceMeters: steps * 0.762, // avg stride length approximation
      startedAt: new Date(this.lastFlush).toISOString(),
      lastBatchAt: now.toISOString(),
    });

    this.lastFlush = now.getTime();
  }
}
