import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ─── Enums as string literals (validated in mutations) ──────────────────────

export default defineSchema({
  // ─── Users & Auth ─────────────────────────────────────────────────────────
  users: defineTable({
    email: v.string(),
    loginName: v.optional(v.string()),
    name: v.string(),
    passwordHash: v.string(),
    pinHash: v.optional(v.string()),
    roleGlobal: v.string(), // "USER" | "ADMIN"
    themePreference: v.string(), // "DARK" | "LIGHT"
    localePreference: v.string(), // "EN" | "EL"
    quantumTheme: v.string(), // "VIOLET" | "CYAN" | "SUNSET"
    notificationsEnabled: v.boolean(),
  })
    .index("by_email", ["email"])
    .index("by_loginName", ["loginName"]),

  authSessions: defineTable({
    userId: v.string(),
    tokenHash: v.string(),
    userAgent: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    lastSeenAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    revokedReason: v.optional(v.string()),
    elevatedUntil: v.optional(v.number()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId", ["userId"]),

  inviteTokens: defineTable({
    workspaceId: v.string(),
    email: v.string(),
    role: v.string(),
    tokenHash: v.string(),
    invitedByUserId: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    usedByUserId: v.optional(v.string()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_workspace_email", ["workspaceId", "email"]),

  passwordResetTokens: defineTable({
    userId: v.string(),
    tokenHash: v.string(),
    requestedIp: v.optional(v.string()),
    requestedDeviceId: v.optional(v.string()),
    requestedAgent: v.optional(v.string()),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId", ["userId"]),

  authThrottles: defineTable({
    dimension: v.string(), // "IP" | "ACCOUNT" | "DEVICE"
    identifier: v.string(),
    windowStartedAt: v.number(),
    attemptCount: v.number(),
    lastAttemptAt: v.number(),
    lockoutUntil: v.optional(v.number()),
  }).index("by_dimension_identifier", ["dimension", "identifier"]),

  securityEvents: defineTable({
    event: v.string(),
    severity: v.string(),
    requestId: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
    targetUserId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    route: v.optional(v.string()),
    detailsJson: v.any(),
  })
    .index("by_event", ["event"])
    .index("by_actor", ["actorUserId"]),

  // ─── Workspaces & RBAC ────────────────────────────────────────────────────
  workspaces: defineTable({
    name: v.string(),
    ownerId: v.string(),
  }).index("by_owner", ["ownerId"]),

  workspaceMembers: defineTable({
    workspaceId: v.string(),
    userId: v.string(),
    role: v.string(), // "ADMIN" | "EDITOR" | "EMPLOYEE" | "WASHER" | "VIEWER"
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_user", ["workspaceId", "userId"]),

  // ─── Data Platform ────────────────────────────────────────────────────────
  tables: defineTable({
    workspaceId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_name", ["workspaceId", "name"]),

  fields: defineTable({
    tableId: v.string(),
    name: v.string(),
    type: v.string(), // FieldType enum
    optionsJson: v.optional(v.any()),
    position: v.number(),
  })
    .index("by_table", ["tableId"])
    .index("by_table_name", ["tableId", "name"]),

  records: defineTable({
    tableId: v.string(),
    dataJson: v.any(),
    searchText: v.string(),
    openIndicator: v.boolean(),
  })
    .index("by_table", ["tableId"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["tableId"] }),

  views: defineTable({
    tableId: v.string(),
    name: v.string(),
    type: v.string(), // ViewType enum
    configJson: v.any(),
    isDefault: v.boolean(),
  }).index("by_table", ["tableId"]),

  // ─── Automations ──────────────────────────────────────────────────────────
  automations: defineTable({
    workspaceId: v.string(),
    name: v.string(),
    enabled: v.boolean(),
    triggerJson: v.any(),
    actionsJson: v.any(),
  }).index("by_workspace", ["workspaceId"]),

  automationRuns: defineTable({
    automationId: v.string(),
    status: v.string(), // AutomationRunStatus
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    logsJson: v.any(),
  }).index("by_automation", ["automationId"]),

  automationRules: defineTable({
    workspaceId: v.string(),
    createdBy: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    triggerJson: v.any(),
    conditionJson: v.optional(v.any()),
    actionJson: v.any(),
    schedule: v.optional(v.string()),
    status: v.string(), // "ACTIVE" | "PAUSED" | "ARCHIVED"
    retryMax: v.number(),
  }).index("by_workspace_status", ["workspaceId", "status"]),

  automationExecutions: defineTable({
    ruleId: v.string(),
    status: v.string(), // AutomationExecStatus
    attempt: v.number(),
    inputJson: v.optional(v.any()),
    outputJson: v.optional(v.any()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  }).index("by_rule_status", ["ruleId", "status"]),

  // ─── Notifications & Audit ────────────────────────────────────────────────
  notifications: defineTable({
    userId: v.string(),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    readAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  auditLogs: defineTable({
    workspaceId: v.string(),
    actorUserId: v.optional(v.string()),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    metaJson: v.any(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_actor", ["actorUserId"]),

  // ─── Chat ─────────────────────────────────────────────────────────────────
  chatChannels: defineTable({
    workspaceId: v.string(),
    type: v.string(), // "PUBLIC" | "PRIVATE" | "DM" | "GROUP"
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    isPinned: v.boolean(),
    isArchived: v.boolean(),
    isReadOnly: v.boolean(),
    createdBy: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_slug", ["workspaceId", "slug"]),

  chatChannelMembers: defineTable({
    channelId: v.string(),
    userId: v.string(),
    role: v.string(),
    joinedAt: v.number(),
    mutedAt: v.optional(v.number()),
  })
    .index("by_channel", ["channelId"])
    .index("by_user", ["userId"]),

  chatThreads: defineTable({
    workspaceId: v.string(),
    channelId: v.optional(v.string()),
    title: v.string(),
    createdBy: v.string(),
    isPinned: v.boolean(),
    isArchived: v.boolean(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_channel", ["channelId"]),

  chatMessages: defineTable({
    threadId: v.string(),
    authorUserId: v.optional(v.string()),
    replyToId: v.optional(v.string()),
    role: v.string(), // ChatRole
    content: v.string(),
    modelId: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    tokenUsage: v.optional(v.number()),
    status: v.string(), // ChatMessageStatus
    commandName: v.optional(v.string()),
    isPinned: v.boolean(),
    isEdited: v.boolean(),
    isDeleted: v.boolean(),
    attachmentUrl: v.optional(v.string()),
    attachmentMime: v.optional(v.string()),
    mentionsJson: v.optional(v.any()),
    editedAt: v.optional(v.number()),
  })
    .index("by_thread", ["threadId"])
    .searchIndex("search_content", { searchField: "content", filterFields: ["threadId"] }),

  chatArtifacts: defineTable({
    workspaceId: v.string(),
    messageId: v.optional(v.string()),
    createdById: v.optional(v.string()),
    type: v.string(), // ChatArtifactType
    title: v.string(),
    content: v.string(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_message", ["messageId"]),

  chatReadReceipts: defineTable({
    messageId: v.string(),
    userId: v.string(),
    readAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_user", ["userId"]),

  chatReactions: defineTable({
    messageId: v.string(),
    userId: v.string(),
    emoji: v.string(),
  }).index("by_message", ["messageId"]),

  // ─── Shifts ───────────────────────────────────────────────────────────────
  shifts: defineTable({
    workspaceId: v.string(),
    assignedUserId: v.optional(v.string()),
    createdBy: v.string(),
    title: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    status: v.string(), // ShiftStatus
    version: v.number(),
    publishedAt: v.optional(v.number()),
    lockedAt: v.optional(v.number()),
    lockedBy: v.optional(v.string()),
    notes: v.optional(v.string()),
    snapshotJson: v.optional(v.string()),
  })
    .index("by_workspace_dates", ["workspaceId", "startsAt", "endsAt"])
    .index("by_assignee", ["assignedUserId", "startsAt"]),

  shiftRequests: defineTable({
    workspaceId: v.string(),
    requesterId: v.string(),
    shiftId: v.optional(v.string()),
    type: v.string(), // ShiftRequestType
    status: v.string(), // ShiftRequestStatus
    startsAt: v.number(),
    endsAt: v.number(),
    reason: v.string(),
    reviewedBy: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    reviewNote: v.optional(v.string()),
  })
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_requester", ["requesterId"]),

  // ─── Fleet ────────────────────────────────────────────────────────────────
  vehicles: defineTable({
    workspaceId: v.string(),
    plateNumber: v.string(),
    model: v.string(),
    status: v.string(), // VehicleStatus
    pipelineState: v.string(), // FleetPipelineState
    mileageKm: v.number(),
    fuelPercent: v.number(),
    lastServiceAt: v.optional(v.number()),
    photoDataUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    slaDeadlineAt: v.optional(v.number()),
    slaBreachedAt: v.optional(v.number()),
    qcSignoffBy: v.optional(v.string()),
    qcResult: v.optional(v.string()),
    qcFailReason: v.optional(v.string()),
    needByAt: v.optional(v.number()),
    keyLocation: v.optional(v.string()),
  })
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_pipeline", ["workspaceId", "pipelineState"])
    .index("by_workspace_plate", ["workspaceId", "plateNumber"])
    .searchIndex("search_plate", { searchField: "plateNumber", filterFields: ["workspaceId"] }),

  vehicleEvents: defineTable({
    workspaceId: v.string(),
    vehicleId: v.string(),
    actorUserId: v.optional(v.string()),
    type: v.string(), // VehicleEventType
    valueText: v.optional(v.string()),
    valueNumber: v.optional(v.number()),
    photoDataUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_vehicle", ["vehicleId"])
    .index("by_workspace", ["workspaceId"]),

  vehicleQcLogs: defineTable({
    workspaceId: v.string(),
    vehicleId: v.string(),
    inspectorId: v.optional(v.string()),
    status: v.string(), // QcStatus
    checklistJson: v.optional(v.any()),
    failReason: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_vehicle", ["vehicleId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  vehicleBlockers: defineTable({
    workspaceId: v.string(),
    vehicleId: v.string(),
    type: v.string(),
    description: v.optional(v.string()),
    reportedBy: v.optional(v.string()),
    resolvedBy: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_vehicle", ["vehicleId"])
    .index("by_workspace", ["workspaceId"]),

  keyHandoverLogs: defineTable({
    workspaceId: v.string(),
    vehicleId: v.string(),
    fromUserId: v.optional(v.string()),
    toUserId: v.optional(v.string()),
    keyLocation: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index("by_vehicle", ["vehicleId"]),

  // ─── Washers ──────────────────────────────────────────────────────────────
  washerTasks: defineTable({
    workspaceId: v.string(),
    vehicleId: v.string(),
    washerUserId: v.optional(v.string()),
    status: v.string(), // WasherTaskStatus
    exteriorDone: v.boolean(),
    interiorDone: v.boolean(),
    vacuumDone: v.boolean(),
    notes: v.optional(v.string()),
    voiceTranscript: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    stationId: v.optional(v.string()),
  })
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_vehicle", ["vehicleId"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  // ─── Incidents ────────────────────────────────────────────────────────────
  incidents: defineTable({
    workspaceId: v.string(),
    vehicleId: v.optional(v.string()),
    reportedBy: v.string(),
    severity: v.string(), // IncidentSeverity
    status: v.string(), // IncidentStatus
    title: v.string(),
    description: v.optional(v.string()),
    photosJson: v.optional(v.any()),
    repairEta: v.optional(v.number()),
    repairCost: v.optional(v.number()),
    claimRef: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_vehicle", ["vehicleId"]),

  // ─── Imports ──────────────────────────────────────────────────────────────
  importBatches: defineTable({
    workspaceId: v.string(),
    createdBy: v.string(),
    status: v.string(), // ImportBatchStatus
    importType: v.string(),
    fileName: v.string(),
    fileHash: v.string(),
    fileSizeBytes: v.optional(v.number()),
    fileUrl: v.optional(v.string()),
    mappingJson: v.optional(v.any()),
    previewJson: v.optional(v.any()),
    diffSummary: v.optional(v.any()),
    errorLog: v.optional(v.string()),
    appliedAt: v.optional(v.number()),
    rolledBackAt: v.optional(v.number()),
  })
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_hash", ["workspaceId", "fileHash"]),

  importChangeSets: defineTable({
    batchId: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(), // "create" | "update" | "archive"
    beforeJson: v.optional(v.any()),
    afterJson: v.any(),
  })
    .index("by_batch", ["batchId"])
    .index("by_entity", ["entityType", "entityId"]),

  // ─── Feeds ────────────────────────────────────────────────────────────────
  feedSources: defineTable({
    workspaceId: v.string(),
    name: v.string(),
    url: v.string(),
    type: v.string(), // "rss" | "html" | "api"
    isActive: v.boolean(),
    scanIntervalMin: v.number(),
    keywordsJson: v.optional(v.any()),
    lastScannedAt: v.optional(v.number()),
    lastEtag: v.optional(v.string()),
  }).index("by_workspace", ["workspaceId"]),

  feedItems: defineTable({
    workspaceId: v.string(),
    sourceId: v.string(),
    title: v.string(),
    summary: v.optional(v.string()),
    url: v.string(),
    urlHash: v.string(),
    category: v.string(), // FeedCategory
    relevanceScore: v.number(),
    keywords: v.optional(v.string()),
    isPinned: v.boolean(),
    pinnedBy: v.optional(v.string()),
    sharedToChannelId: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    fetchedAt: v.number(),
  })
    .index("by_workspace_category", ["workspaceId", "category"])
    .index("by_workspace_hash", ["workspaceId", "urlHash"])
    .searchIndex("search_title", { searchField: "title", filterFields: ["workspaceId"] }),

  // ─── Cron & Dead-letter ───────────────────────────────────────────────────
  cronRuns: defineTable({
    workspaceId: v.optional(v.string()),
    job: v.string(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    status: v.string(),
    itemsProcessed: v.number(),
    errorSummary: v.optional(v.string()),
  }).index("by_job", ["job"]),

  deadLetterEntries: defineTable({
    workspaceId: v.optional(v.string()),
    type: v.string(),
    payload: v.string(),
    error: v.string(),
    attempts: v.number(),
    lastAttempt: v.number(),
    resolvedAt: v.optional(v.number()),
  }).index("by_type", ["type"]),

  // ─── Weather ──────────────────────────────────────────────────────────────
  weatherCache: defineTable({
    workspaceId: v.optional(v.string()),
    lat: v.number(),
    lon: v.number(),
    dataJson: v.any(),
    fetchedAt: v.number(),
    expiresAt: v.number(),
  }).index("by_coords", ["lat", "lon"]),

  // ─── Workforce ────────────────────────────────────────────────────────────
  attendances: defineTable({
    workspaceId: v.string(),
    userId: v.string(),
    type: v.string(), // AttendanceType
    recordedAt: v.number(),
    notes: v.optional(v.string()),
    deviceId: v.optional(v.string()),
  }).index("by_workspace_user", ["workspaceId", "userId"]),

  skills: defineTable({
    workspaceId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  }).index("by_workspace", ["workspaceId"]),

  userSkills: defineTable({
    userId: v.string(),
    skillId: v.string(),
    level: v.string(), // SkillLevel
    certifiedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  trainings: defineTable({
    workspaceId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    durationMin: v.optional(v.number()),
  }).index("by_workspace", ["workspaceId"]),

  trainingRecords: defineTable({
    trainingId: v.string(),
    userId: v.string(),
    status: v.string(), // TrainingStatus
    completedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  }).index("by_training", ["trainingId"]),

  // ─── Assets / Inventory ───────────────────────────────────────────────────
  assets: defineTable({
    workspaceId: v.string(),
    type: v.string(), // AssetType
    name: v.string(),
    serialNumber: v.optional(v.string()),
    status: v.string(), // AssetStatus
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    reorderLevel: v.optional(v.number()),
    quantity: v.number(),
  }).index("by_workspace_type", ["workspaceId", "type"]),

  assetHandovers: defineTable({
    assetId: v.string(),
    fromUserId: v.optional(v.string()),
    toUserId: v.optional(v.string()),
    action: v.string(),
    notes: v.optional(v.string()),
  }).index("by_asset", ["assetId"]),

  // ─── User Experience ──────────────────────────────────────────────────────
  userShortcuts: defineTable({
    workspaceId: v.string(),
    userId: v.string(),
    label: v.string(),
    command: v.string(),
    keybinding: v.optional(v.string()),
    position: v.number(),
  }).index("by_workspace_user", ["workspaceId", "userId"]),

  userActionButtons: defineTable({
    workspaceId: v.string(),
    userId: v.string(),
    label: v.string(),
    action: v.string(),
    position: v.number(),
  }).index("by_workspace_user", ["workspaceId", "userId"]),

  promptTemplates: defineTable({
    workspaceId: v.string(),
    userId: v.string(),
    title: v.string(),
    prompt: v.string(),
  }).index("by_workspace_user", ["workspaceId", "userId"]),

  aiUsageMeters: defineTable({
    workspaceId: v.string(),
    userId: v.optional(v.string()),
    windowDate: v.number(),
    requestsUsed: v.number(),
    tokensUsed: v.number(),
    provider: v.string(),
  }).index("by_workspace_window", ["workspaceId", "windowDate"]),

  savedViews: defineTable({
    workspaceId: v.string(),
    userId: v.string(),
    name: v.string(),
    module: v.string(),
    filtersJson: v.any(),
    columnsJson: v.optional(v.any()),
    sortJson: v.optional(v.any()),
    isDefault: v.boolean(),
  }).index("by_workspace_user_module", ["workspaceId", "userId", "module"]),

  runbooks: defineTable({
    workspaceId: v.string(),
    createdBy: v.string(),
    title: v.string(),
    content: v.string(),
    tags: v.optional(v.string()),
    pinned: v.boolean(),
  }).index("by_workspace", ["workspaceId"]),

  // ─── Compliance ───────────────────────────────────────────────────────────
  retentionPolicies: defineTable({
    workspaceId: v.string(),
    module: v.string(),
    retainDays: v.number(),
    createdBy: v.string(),
  }).index("by_workspace_module", ["workspaceId", "module"]),

  accessReviews: defineTable({
    workspaceId: v.string(),
    reviewerId: v.string(),
    targetUserId: v.string(),
    status: v.string(), // "PENDING" | "APPROVED" | "REVOKED"
    decision: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
  }).index("by_workspace_status", ["workspaceId", "status"]),

  // ─── Stations ─────────────────────────────────────────────────────────────
  stations: defineTable({
    workspaceId: v.string(),
    name: v.string(),
    code: v.string(),
    address: v.optional(v.string()),
    isActive: v.boolean(),
    configJson: v.optional(v.any()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_code", ["workspaceId", "code"]),
});
