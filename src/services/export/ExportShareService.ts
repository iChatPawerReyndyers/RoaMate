import RNFS from 'react-native-fs';
import Share from 'react-native-share';

export type ExportFormat = 'csv' | 'pdf';

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv',
  pdf: 'application/pdf',
};

/**
 * FIN-09: "Generate and share comprehensive end-of-trip settlement
 * summaries." apiClient.download() already fetches the correct bytes from
 * /api/v1/finance/trips/{id}/export/{format} - that part worked. What was
 * missing is what a person actually expects "export" to do on a phone:
 * previously the bytes just sat in JS memory and the screen showed a
 * byte-count message telling the person to go find some other file writer
 * themselves. This writes the bytes to a real file in the app's cache dir,
 * then hands that file to the OS share sheet so they can save it to
 * Files/Drive, AirDrop it, email it, etc. - one tap, like any other app.
 *
 * Cache dir (not Documents) is deliberate: this is a disposable, regenerable
 * export, not user data worth persisting indefinitely - see clearCachedExports.
 */
export async function shareExport(tripName: string, format: ExportFormat, bytes: ArrayBuffer): Promise<void> {
  const fileName = `${sanitizeFileName(tripName)}-settlement.${format}`;
  const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

  await RNFS.writeFile(filePath, arrayBufferToBase64(bytes), 'base64');

  try {
    await Share.open({
      url: `file://${filePath}`,
      type: MIME_TYPES[format],
      filename: fileName,
      failOnCancel: false,
    });
  } catch (err) {
    // react-native-share rejects with { message: 'User did not share' } when
    // the person just closes the sheet without picking anything - that's a
    // normal outcome, not a failure the caller should surface as an error.
    if (isUserDismissal(err)) return;
    throw err;
  }
}

/** Clears previously written export files from the cache dir. Safe to call on app start or trip switch - cache dirs are OS-purgeable anyway, this just keeps stale settlement files from lingering visibly. */
export async function clearCachedExports(): Promise<void> {
  const entries = await RNFS.readDir(RNFS.CachesDirectoryPath);
  await Promise.all(
    entries
      .filter(entry => entry.isFile() && (entry.name.endsWith('-settlement.csv') || entry.name.endsWith('-settlement.pdf')))
      .map(entry => RNFS.unlink(entry.path).catch(() => undefined)),
  );
}

function sanitizeFileName(tripName: string): string {
  const cleaned = tripName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'trip';
}

function isUserDismissal(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
  return /did not share|user cancelled|user did not share/i.test(message);
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Hand-rolled rather than btoa()/Buffer: Hermes doesn't ship btoa, and this
 * project has no @types/node, so the ambient Buffer type isn't available
 * even though RN happens to polyfill the runtime global (ts(2304): Cannot
 * find name 'Buffer'). This needs no ambient types and no polyfill either
 * way, so it works identically on Hermes and JSC.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = '';
  let i = 0;

  for (; i + 2 < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1]!;
    const b2 = bytes[i + 2]!;
    result += BASE64_CHARS.charAt(b0 >> 2);
    result += BASE64_CHARS.charAt(((b0 & 0x3) << 4) | (b1 >> 4));
    result += BASE64_CHARS.charAt(((b1 & 0xf) << 2) | (b2 >> 6));
    result += BASE64_CHARS.charAt(b2 & 0x3f);
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    const b0 = bytes[i]!;
    result += BASE64_CHARS.charAt(b0 >> 2);
    result += BASE64_CHARS.charAt((b0 & 0x3) << 4);
    result += '==';
  } else if (remaining === 2) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1]!;
    result += BASE64_CHARS.charAt(b0 >> 2);
    result += BASE64_CHARS.charAt(((b0 & 0x3) << 4) | (b1 >> 4));
    result += BASE64_CHARS.charAt((b1 & 0xf) << 2);
    result += '=';
  }

  return result;
}