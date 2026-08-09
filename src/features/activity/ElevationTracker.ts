import Geolocation from '@react-native-community/geolocation';
import { apiClient } from '@/services/api/client';

/**
 * ACT-02: GPS-based elevation gain tracking for mountain/hike activities.
 *
 * Barometer cross-validation TEMPORARILY REMOVED along with expo-sensors
 * (see PedometerService.ts for why). GPS altitude alone is noisier than
 * GPS+barometer fusion but still functional - this tracks max/min absolute
 * altitude and duration from GPS fixes only.
 */
export class ElevationTracker {
  private startAltitude: number | null = null;
  private maxAltitude = -Infinity;
  private minAltitude = Infinity;
  private startedAt = Date.now();
  private watchId: number | null = null;

  constructor(private tripId: string, private userId: string, private destinationId?: string) {}

  start(): void {
    this.startedAt = Date.now();

    this.watchId = Geolocation.watchPosition(
      pos => {
        const altitude = pos.coords.altitude ?? 0;
        if (this.startAltitude === null) this.startAltitude = altitude;
        if (altitude > this.maxAltitude) this.maxAltitude = altitude;
        if (altitude < this.minAltitude) this.minAltitude = altitude;
      },
      undefined,
      { enableHighAccuracy: true, distanceFilter: 5 },
    );
  }

  stop(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  async stopAndUpload(): Promise<void> {
    this.stop();

    const gain = this.startAltitude !== null && this.maxAltitude !== -Infinity
      ? this.maxAltitude - this.startAltitude
      : 0;
    const durationSeconds = Math.round((Date.now() - this.startedAt) / 1000);

    await apiClient.post('/api/v1/activity/sessions', {
      tripId: this.tripId,
      userId: this.userId,
      type: 'MOUNTAIN_ELEVATION',
      elevationGainMeters: gain,
      maxAltitudeMeters: this.maxAltitude === -Infinity ? null : this.maxAltitude,
      minAltitudeMeters: this.minAltitude === Infinity ? null : this.minAltitude,
      durationSeconds,
      destinationId: this.destinationId,
      startedAt: new Date(this.startedAt).toISOString(),
      lastBatchAt: new Date().toISOString(),
    });
  }
}
