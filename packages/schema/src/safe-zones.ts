// Platform-UI safe zones as versioned config, not constants — TikTok/Reels/
// Shorts shifted these three times in the last 12 months. Units are px on the
// reference 1080×1920 canvas; scale proportionally for other resolutions.
export const SAFE_ZONES = {
  version: 1,
  aspect: "9:16",
  reference: { width: 1080, height: 1920 },
  // Top slot starts below the platform status/search band.
  topBandPx: 130,
  // Bottom captions must end at least this far above the frame bottom
  // (clear of like/share rail + caption/CTA area).
  bottomReservePx: 420,
  sideMarginPx: 64,
} as const;
export type SafeZones = typeof SAFE_ZONES;
