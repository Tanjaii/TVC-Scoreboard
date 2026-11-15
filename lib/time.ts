/**
 * Every match time on this site is Lagos time (WAT, UTC+1, no daylight saving), whatever the
 * viewer's device or the server's clock says. Stored values stay UTC ISO strings in the database.
 */
export const LAGOS_TZ = "Africa/Lagos";
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/**
 * A "wall clock" date is a Date whose UTC fields hold the Lagos clock reading. Read it only with
 * the getUTC* methods. This keeps the picker independent of the browser's timezone.
 */
export const toLagosWall = (iso: string): Date => new Date(Date.parse(iso) + LAGOS_OFFSET_MS);
export const lagosNowWall = (): Date => new Date(Date.now() + LAGOS_OFFSET_MS);

/** Lagos wall clock back to the UTC ISO string that gets stored. */
export const fromLagosWall = (wall: Date): string => new Date(wall.getTime() - LAGOS_OFFSET_MS).toISOString();
