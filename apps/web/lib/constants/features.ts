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
  voiceInput: isEnabled(process.env.NEXT_PUBLIC_FEATURE_VOICE_INPUT, false),
  unifiedChat: isEnabled(process.env.NEXT_PUBLIC_FEATURE_UNIFIED_CHAT, true),
  customShortcuts: isEnabled(
    process.env.NEXT_PUBLIC_FEATURE_CUSTOM_SHORTCUTS,
    true,
  ),
  cloudAiGateway: isEnabled(
    process.env.NEXT_PUBLIC_FEATURE_CLOUD_AI_GATEWAY,
    true,
  ),
  windowControlsOverlay: isEnabled(
    process.env.NEXT_PUBLIC_FEATURE_WINDOW_CONTROLS_OVERLAY,
    false,
  ),
  kioskPresets: isEnabled(process.env.NEXT_PUBLIC_FEATURE_KIOSK_PRESETS, true),
  offlineQueue: isEnabled(process.env.NEXT_PUBLIC_FEATURE_OFFLINE_QUEUE, true),
  fleetQcStep: isEnabled(process.env.NEXT_PUBLIC_FEATURE_FLEET_QC_STEP, true),
  fleetSlaAlerts: isEnabled(process.env.NEXT_PUBLIC_FEATURE_FLEET_SLA_ALERTS, true),
  shiftPublishLock: isEnabled(process.env.NEXT_PUBLIC_FEATURE_SHIFT_PUBLISH_LOCK, true),
  chatEntityThreads: isEnabled(process.env.NEXT_PUBLIC_FEATURE_CHAT_ENTITY_THREADS, true),
  coordinatorDashboard: isEnabled(process.env.NEXT_PUBLIC_FEATURE_COORDINATOR_DASHBOARD, true),
  chatFirstUi: isEnabled(process.env.NEXT_PUBLIC_FEATURE_CHAT_FIRST_UI, true),
  multiModelRouter: isEnabled(process.env.NEXT_PUBLIC_FEATURE_MULTI_MODEL_ROUTER, true),
  settingsEverywhere: isEnabled(process.env.NEXT_PUBLIC_FEATURE_SETTINGS_EVERYWHERE, true),
  workforceOps: isEnabled(process.env.NEXT_PUBLIC_FEATURE_WORKFORCE_OPS, false),
  inventory: isEnabled(process.env.NEXT_PUBLIC_FEATURE_INVENTORY, false),
  incidents: isEnabled(process.env.NEXT_PUBLIC_FEATURE_INCIDENTS, false),
  automations2: isEnabled(process.env.NEXT_PUBLIC_FEATURE_AUTOMATIONS_2, false),
  realtimeBoards: isEnabled(process.env.NEXT_PUBLIC_FEATURE_REALTIME_BOARDS, false),
  advancedSearch: isEnabled(process.env.NEXT_PUBLIC_FEATURE_ADVANCED_SEARCH, false),
  compliance: isEnabled(process.env.NEXT_PUBLIC_FEATURE_COMPLIANCE, false),
  multiStation: isEnabled(process.env.NEXT_PUBLIC_FEATURE_MULTI_STATION, false),
  viberChat: isEnabled(process.env.NEXT_PUBLIC_FEATURE_VIBER_CHAT, true),
  fileImports: isEnabled(process.env.NEXT_PUBLIC_FEATURE_FILE_IMPORTS, true),
  viberBridge: isEnabled(process.env.NEXT_PUBLIC_FEATURE_VIBER_BRIDGE, false),
  aiSetupWizard: isEnabled(process.env.NEXT_PUBLIC_FEATURE_AI_SETUP_WIZARD, true),
};
