function isEnabled(value: string | undefined, fallback: boolean) {
  if (typeof value !== "string") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const features = {
  commandPalette: isEnabled(process.env.NEXT_PUBLIC_FEATURE_COMMAND_PALETTE, true),
  componentsShowroom: isEnabled(
    process.env.NEXT_PUBLIC_FEATURE_COMPONENTS_SHOWROOM,
    true,
  ),
  reportsPdf: isEnabled(process.env.NEXT_PUBLIC_FEATURE_REPORTS_PDF, true),
  windowControlsOverlay: isEnabled(
    process.env.NEXT_PUBLIC_FEATURE_WINDOW_CONTROLS_OVERLAY,
    false,
  ),
};
