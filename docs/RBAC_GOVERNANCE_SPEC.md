# RBAC Matrix & Coordinator / God Mode — Προδιαγραφή Governance

**Έκδοση:** 1.0  
**Ημερομηνία:** 21 Φεβρουαρίου 2026  
**Κατάσταση:** Draft — Εγκεκριμένο για υλοποίηση  
**Πλατφόρμα:** InternalToolKit (Kinsen — Europcar + Goldcar Station Operations)  
**Τύπος εγγράφου:** Policy Contract / Governance Specification  

---

## Πίνακας Περιεχομένων

1. [Εκτελεστική Σύνοψη](#1-εκτελεστική-σύνοψη)
2. [Υφιστάμενη Κατάσταση (Current State Mapping)](#2-υφιστάμενη-κατάσταση)
3. [Αρχές Ασφάλειας & Governance](#3-αρχές-ασφάλειας--governance)
4. [Μοντέλο Ρόλων (Role Model)](#4-μοντέλο-ρόλων)
5. [Ταξονομία Δικαιωμάτων (Domains / Actions / Scope)](#5-ταξονομία-δικαιωμάτων)
6. [Πλήρες RBAC Matrix](#6-πλήρες-rbac-matrix)
7. [Προδιαγραφή Coordinator Governance Dashboard](#7-προδιαγραφή-coordinator-governance-dashboard)
8. [Προδιαγραφή God Mode (ManosPs)](#8-προδιαγραφή-god-mode)
9. [Delegation / Temporary Rights / Context Rules](#9-delegation--temporary-rights--context-rules)
10. [Audit / Step-up / Confirmations Policy](#10-audit--step-up--confirmations-policy)
11. [Feature Access & Rollout Policy](#11-feature-access--rollout-policy)
12. [Acceptance Criteria για Υλοποίηση](#12-acceptance-criteria)
13. [Test Contract](#13-test-contract)
14. [Ανοιχτά Σημεία / Assumptions / Προτεινόμενες Αποφάσεις](#14-ανοιχτά-σημεία)

---

## 1. Εκτελεστική Σύνοψη

Η παρούσα προδιαγραφή αποτελεί το **single source of truth** για το μοντέλο ρόλων, δικαιωμάτων, governance και ασφάλειας της πλατφόρμας InternalToolKit. Ορίζει:

- **10 ρόλους** (συμπεριλαμβανομένου God Mode Coordinator και Custom Role Template).
- **20 domains** με αναλυτικές ενέργειες και qualifiers ανά scope.
- **Πλήρες RBAC matrix** (Role × Domain × Action × Scope × Conditions).
- **Coordinator Governance Dashboard** — λειτουργική προδιαγραφή για διαχείριση χρηστών, ρόλων, δικαιωμάτων και πολιτικών.
- **God Mode policy** για τον Platform Owner (ManosPs) με safeguards, step-up authentication, audit logging και break-glass procedures.
- **Delegation model** με time-bound temporary rights, expiration, conflict resolution.
- **Audit & security policy layer** με severity levels, retention, privacy boundaries.
- **Feature access model** με per-role, per-user, per-station toggles.
- **Acceptance criteria** και **test contract** για μελλοντική υλοποίηση.

**Bootstrap Principals:**

| # | Ταυτότητα | Username | Ρόλος | Σημειώσεις |
|---|-----------|----------|-------|------------|
| 1 | Μανώλης Ψυστάκης (Psistakis Manolis) | ManosPs | God Mode Coordinator (Platform Owner) | Αρχικός PIN bootstrap — δεν αποθηκεύεται ή εμφανίζεται σε plaintext σε logs/UI |
| 2 | Κωνσταντίνα Τζανιδάκη (Konstantina Tzanidaki) | KonnaTz | Coordinator | Αρχικός PIN bootstrap — ίδια πολιτική |

---

## 2. Υφιστάμενη Κατάσταση

### 2.1 Τρέχον Μοντέλο Ρόλων

Η πλατφόρμα χρησιμοποιεί σήμερα δύο enums στο Prisma schema:

**GlobalRole (system-wide):**
- `USER` (default)
- `ADMIN`

**WorkspaceRole (per-workspace membership):**
- `ADMIN`
- `EDITOR`
- `EMPLOYEE`
- `WASHER`
- `VIEWER`

Δεν υπάρχει ξεχωριστό `Permission` model στη βάση δεδομένων. Τα δικαιώματα υπολογίζονται in-code μέσω ενός static matrix στο `lib/rbac.ts`.

### 2.2 Τρέχοντα Resources στο Permission Matrix

Καλύπτονται **8 resources** στο matrix:

| Resource | Actions |
|----------|---------|
| admin | manage_members, read_audit |
| chat | read, write |
| data | read, write |
| shifts | read, write, approve_requests |
| fleet | read, write |
| washers | read, write |
| calendar | read, write |
| notifications | read |

### 2.3 Auth System Summary

- Custom session-based auth (HMAC-signed cookies, bcrypt passwords/PINs).
- Δύο login modes: email+password, loginName+PIN.
- 3-dimensional auth throttling (IP/Account/Device) στη βάση δεδομένων.
- Admin step-up via PIN re-entry (10-minute elevated session).
- Δύο audit trails: `AuditLog` (business, workspace-scoped) και `SecurityEvent` (security, cross-workspace).

### 2.4 Εντοπισμένα Κενά & Ασυνέπειες

| # | Κενό | Σοβαρότητα | Σημειώσεις |
|---|------|------------|------------|
| G-01 | Δεν υπάρχει `middleware.ts` — auth/RBAC γίνεται μόνο σε layout/action level | Μέτρια | Δεν υπάρχει early rejection στο edge |
| G-02 | Dual auth check pattern στο admin page — η page δεν κάνει throw/redirect, εμφανίζει fallback UI | Μέτρια | Non-admins βλέπουν scaffold UI |
| G-03 | Inconsistent guard pattern — μερικά modules χρησιμοποιούν `requireWorkspaceRole` με inline arrays, άλλα `requireWorkspacePermission` | Υψηλή | Δύο παράλληλα RBAC patterns |
| G-04 | Modules χωρίς κάλυψη στο matrix: automations, assistant, analytics, reports, activity, dashboard, overview, controls, components, settings | Υψηλή | RBAC ad-hoc ή absent |
| G-05 | VIEWER paradox στο chat/assistant — server actions επιτρέπουν write σε VIEWER, παρακάμπτοντας το matrix | Υψηλή | Matrix λέει deny, code λέει allow |
| G-06 | EMPLOYEE/WASHER αποκλείονται από chat/assistant actions μέσω inline role arrays, παρότι το matrix τους δίνει πρόσβαση | Υψηλή | Αντίφαση matrix vs implementation |
| G-07 | Δεν υπάρχει read-level RBAC — τα pages φορτώνουν data με `getAppContext()` χωρίς role check | Υψηλή | Όλοι βλέπουν τα πάντα |
| G-08 | Feature flags είναι global env vars, χωρίς per-role/per-workspace control | Μέτρια | Δεν υποστηρίζει granular rollout |
| G-09 | Δεν υπάρχει μοντέλο COORDINATOR ή GOD_MODE στα enums | Κρίσιμη | Απαιτείται νέος ρόλος |
| G-10 | Δεν υπάρχει delegation/temporary rights system | Υψηλή | Καμία time-bound ανάθεση |
| G-11 | Δεν υπάρχει permission simulator | Μέτρια | Χρήσιμο για governance UI |
| G-12 | In-memory rate limiter αναποτελεσματικός σε multi-instance (Vercel serverless) | Μέτρια | Μόνο DB throttle αξιόπιστο |
| G-13 | `app/api/auth/[...nextauth]/` φάκελος κενός — dead code | Χαμηλή | Cleanup |

### 2.5 Drift Assessment

Η σημερινή υλοποίηση αποτελεί solid βάση με σωστό auth foundation, αλλά υπάρχει σημαντική απόκλιση μεταξύ **intended** και **implemented** RBAC:

- Ο permission matrix καλύπτει μόνο 8 από ~18 modules.
- Δεν υπάρχει concept Coordinator/God Mode.
- Δεν υπάρχει governance dashboard.
- Δεν υπάρχει delegation model.
- Feature flags δεν ελέγχονται per-role.

Η παρούσα προδιαγραφή ορίζει το **target state** που θα κλείσει αυτά τα κενά.

---

## 3. Αρχές Ασφάλειας & Governance

### 3.1 Θεμελιώδεις Αρχές

| # | Αρχή | Περιγραφή |
|---|------|-----------|
| P-01 | **Default Deny** | Κάθε ενέργεια απαγορεύεται εκτός αν ρητά επιτρέπεται από το RBAC matrix. Αν λείπουν role/permission data, η πρόσβαση απορρίπτεται. |
| P-02 | **Least Privilege** | Κάθε ρόλος λαμβάνει μόνο τα δικαιώματα που χρειάζεται για τις αρμοδιότητές του. Εξαίρεση: God Mode (υπό safeguards). |
| P-03 | **Separation of Duties** | Κρίσιμες ενέργειες (π.χ. role change + approval) δεν εκτελούνται από τον ίδιο actor χωρίς audit trail. |
| P-04 | **Auditability** | Κάθε high-risk action καταγράφεται σε immutable audit log με actor, target, timestamp, IP, device. |
| P-05 | **Idempotent Role Assignment** | Η ανάθεση ρόλου που ήδη υπάρχει δεν δημιουργεί side effects — η λειτουργία είναι idempotent. |
| P-06 | **Explicit Scope** | Κάθε δικαίωμα ορίζει ρητά scope: `global`, `station`, `workspace`, `own`. |
| P-07 | **Time-bound Delegation** | Temporary rights έχουν υποχρεωτικό expiration. Μετά τη λήξη, δικαιώματα ανακαλούνται αυτόματα. |
| P-08 | **Safe Fallback** | Αν role/permission data λείπει ή είναι corrupted, το σύστημα εφαρμόζει default deny και εμφανίζει actionable error message. |
| P-09 | **Consistent Naming** | Roles, domains, actions ακολουθούν ενιαία snake_case convention (π.χ. `shifts.approve_requests`). |
| P-10 | **Immutable Audit Trail** | Τα audit logs δεν μπορούν να τροποποιηθούν ή να διαγραφούν — ούτε από God Mode. |

### 3.2 Ιεραρχία Εφαρμογής

```
P-10 (Immutable Audit) ← Ανώτατη αρχή — δεν παρακάμπτεται ποτέ
P-01 (Default Deny)    ← Εφαρμόζεται πάντα πρώτη
P-02 (Least Privilege) ← Ορίζει baseline για κάθε ρόλο
P-04 (Auditability)    ← Κάθε high-risk action
P-03 (Separation)      ← Όπου ορίζεται στο matrix
P-06 (Explicit Scope)  ← Κάθε permission entry
P-07 (Time-bound)      ← Κάθε delegation
P-08 (Safe Fallback)   ← Error handling default
P-05, P-09             ← Implementation constraints
```

---

## 4. Μοντέλο Ρόλων

### 4.1 Ορισμός Ρόλων

#### R-01: GOD_MODE_COORDINATOR (Platform Owner)

| Πεδίο | Τιμή |
|-------|------|
| **Σκοπός** | Πλήρης έλεγχος πλατφόρμας. Τελευταία γραμμή άμυνας για emergency recovery, system configuration, user lockout resolution. |
| **Default Scope** | Global (cross-workspace, cross-station) |
| **Κύριες Αρμοδιότητες** | Διαχείριση όλων των χρηστών/ρόλων/permissions. System policy configuration. Feature flag management. Emergency access. Audit review. Break-glass operations. |
| **High-risk Actions** | Αλλαγή God Mode credentials. Revocation όλων των sessions. System policy override. Feature flag global disable. Emergency access activation. |
| **Περιορισμοί** | Δεν μπορεί να διαγράψει ή τροποποιήσει immutable audit logs. Δεν μπορεί να απενεργοποιήσει security logging χωρίς trace. Κρίσιμες ενέργειες απαιτούν step-up auth. |
| **Dependencies** | Κανένα — ανεξάρτητος από station/workspace assignment. |
| **Bootstrap Identity** | ManosPs (Μανώλης Ψυστάκης) |
| **Μέγιστος Αριθμός** | 1 (singleton — μόνο ένας God Mode Coordinator ανά εγκατάσταση) |

#### R-02: COORDINATOR

| Πεδίο | Τιμή |
|-------|------|
| **Σκοπός** | Λειτουργικός συντονισμός σταθμού/workspace. Διαχείριση χρηστών, ρόλων, βαρδιών, εγκρίσεων. Governance dashboard operator. |
| **Default Scope** | Station / Workspace (μπορεί να διαχειριστεί πολλαπλά workspaces αν ανατεθούν) |
| **Κύριες Αρμοδιότητες** | User management (invite, role assign, suspend, reinstate). Shift approval/publish. Request review. Access configuration per module. Delegation of temporary rights. Audit log review (workspace-scoped). Feature flag configuration (workspace-scoped). |
| **High-risk Actions** | Role escalation (ανάθεση COORDINATOR σε άλλο χρήστη). Mass shift publish. User suspension. Permission override. |
| **Περιορισμοί** | Δεν μπορεί να αναθέσει GOD_MODE_COORDINATOR. Δεν μπορεί να αλλάξει system-wide policies χωρίς God Mode approval. Δεν μπορεί να δει audit logs άλλων workspaces. Δεν μπορεί να disable security features. |
| **Dependencies** | Πρέπει να είναι member του workspace που διαχειρίζεται. |
| **Bootstrap Identity** | KonnaTz (Κωνσταντίνα Τζανιδάκη) |

#### R-03: SUPERVISOR

| Πεδίο | Τιμή |
|-------|------|
| **Σκοπός** | Επιτήρηση ομάδας/βάρδιας. Ενδιάμεσος ρόλος μεταξύ Coordinator και Employee. |
| **Default Scope** | Station / Team (εντός assigned workspace) |
| **Κύριες Αρμοδιότητες** | Shift management (create, edit, assign — not publish). Team member oversight. Request pre-approval/recommendation. Report generation. Activity monitoring. |
| **High-risk Actions** | Κανένα — δεν εκτελεί destructive ή escalation actions. |
| **Περιορισμοί** | Δεν μπορεί να αλλάξει ρόλους χρηστών. Δεν μπορεί να publish shifts (μόνο draft). Δεν μπορεί να κάνει approve requests τελικά (μόνο recommendation). Δεν μπορεί να αλλάξει permissions. |
| **Dependencies** | Πρέπει να είναι member + assigned ως Supervisor στο workspace. |

#### R-04: EMPLOYEE

| Πεδίο | Τιμή |
|-------|------|
| **Σκοπός** | Γενικός υπάλληλος σταθμού. Εκτέλεση καθημερινών εργασιών, βάρδιες, fleet operations. |
| **Default Scope** | Station (εντός assigned workspace) |
| **Κύριες Αρμοδιότητες** | View schedules. Submit shift requests. Record fleet events. Use chat. View notifications. Basic data entry. |
| **High-risk Actions** | Κανένα. |
| **Περιορισμοί** | Δεν μπορεί να εγκρίνει requests. Δεν μπορεί να publish/approve shifts. Δεν μπορεί να δει admin UI. Δεν μπορεί να manage users ή roles. Δεν μπορεί να δει analytics/reports (εκτός own data). |
| **Dependencies** | Πρέπει να είναι member του workspace. |

#### R-05: WASHER

| Πεδίο | Τιμή |
|-------|------|
| **Σκοπός** | Ειδικευμένος ρόλος για washer workflow. Καταγραφή πλυσιμάτων/εργασιών μέσω typing ή voice. |
| **Default Scope** | Station (εντός assigned workspace) |
| **Κύριες Αρμοδιότητες** | Create/update washer tasks. Record wash completions. View assigned fleet vehicles. Use chat for coordination. View own schedule. |
| **High-risk Actions** | Κανένα. |
| **Περιορισμοί** | Δεν μπορεί να δει ή τροποποιήσει fleet financial data. Δεν μπορεί να manage schedules (μόνο view own). Δεν μπορεί να access admin, analytics, reports. Δεν μπορεί να approve anything. |
| **Dependencies** | Πρέπει να είναι member του workspace. |

#### R-06: FLEET_AGENT

| Πεδίο | Τιμή |
|-------|------|
| **Σκοπός** | Ειδικευμένος ρόλος για fleet management. Καταγραφή κίνησης οχημάτων, events, κατάσταση στόλου. |
| **Default Scope** | Station (εντός assigned workspace) |
| **Κύριες Αρμοδιότητες** | Full fleet CRUD (vehicles, events, status updates). View schedules. Fleet reporting. Vehicle state overrides (με audit). |
| **High-risk Actions** | Vehicle state override (π.χ. αλλαγή κατάστασης οχήματος εκτός κανονικής ροής). |
| **Περιορισμοί** | Δεν μπορεί να manage users/roles. Δεν μπορεί να approve shifts/requests. Limited access σε washers workflow (read-only). Δεν μπορεί να αλλάξει permissions ή policies. |
| **Dependencies** | Πρέπει να είναι member του workspace. |

#### R-07: OPS_AGENT

| Πεδίο | Τιμή |
|-------|------|
| **Σκοπός** | Operations agent — cross-functional support. Data entry, calendar management, operational coordination. |
| **Default Scope** | Station (εντός assigned workspace) |
| **Κύριες Αρμοδιότητες** | Data management (tables, records). Calendar management. Shift creation (not publish). Automation management. Request submission. |
| **High-risk Actions** | Bulk data import/export. |
| **Περιορισμοί** | Δεν μπορεί να manage users/roles/permissions. Δεν μπορεί να approve high-level requests. Δεν μπορεί να access admin panel. Limited analytics access. |
| **Dependencies** | Πρέπει να είναι member του workspace. |

#### R-08: AUDITOR (Read-only)

| Πεδίο | Τιμή |
|-------|------|
| **Σκοπός** | Παρακολούθηση και εποπτεία. Read-only πρόσβαση σε audit logs, analytics, reports, activity. |
| **Default Scope** | Global ή Station (ανάλογα με assignment) |
| **Κύριες Αρμοδιότητες** | View audit logs. View analytics/reports. View activity feeds. Export reports (read-only). |
| **High-risk Actions** | Κανένα (pure read-only). |
| **Περιορισμοί** | Δεν μπορεί να τροποποιήσει τίποτα. Δεν μπορεί να δει sensitive security events (μόνο business audit). Δεν μπορεί να access admin functions. |
| **Dependencies** | Πρέπει να έχει explicit assignment σε workspace(s). |

#### R-09: CUSTOM_ROLE (Template)

| Πεδίο | Τιμή |
|-------|------|
| **Σκοπός** | Policy-level concept για μελλοντικές ανάγκες. Επιτρέπει τη δημιουργία custom roles με cherry-picked permissions. |
| **Default Scope** | Workspace (ο Coordinator ορίζει τα δικαιώματα) |
| **Κύριες Αρμοδιότητες** | Ομάδα permissions ορισμένη ad-hoc από Coordinator ή God Mode. |
| **High-risk Actions** | Εξαρτάται από τα permissions που ανατίθενται. |
| **Περιορισμοί** | Δεν μπορεί να ξεπεράσει τα δικαιώματα COORDINATOR. Δεν μπορεί να περιλαμβάνει God Mode ενέργειες. Πρέπει να βασίζεται στο ταξονομικό σύστημα domains/actions. |
| **Dependencies** | Δημιουργείται μόνο από COORDINATOR ή GOD_MODE_COORDINATOR. |

### 4.2 Ιεραρχία Ρόλων

```
GOD_MODE_COORDINATOR
  └── COORDINATOR
        ├── SUPERVISOR
        │     ├── EMPLOYEE
        │     ├── WASHER
        │     ├── FLEET_AGENT
        │     └── OPS_AGENT
        └── AUDITOR
              └── (read-only subset)
```

**Σημείωση:** Η ιεραρχία δεν σημαίνει κληρονομικότητα permissions. Κάθε ρόλος έχει ρητά ορισμένα permissions στο RBAC matrix. Η ιεραρχία αφορά **ποιος μπορεί να αναθέσει ποιον** (delegation chain).

### 4.3 Role Assignment Rules

| Κανόνας | Περιγραφή |
|---------|-----------|
| RA-01 | Ένας χρήστης έχει **ακριβώς έναν WorkspaceRole** ανά workspace. |
| RA-02 | Ένας χρήστης μπορεί να έχει **διαφορετικό ρόλο** σε διαφορετικά workspaces. |
| RA-03 | Ο GlobalRole `GOD_MODE` υπερισχύει κάθε WorkspaceRole — εφαρμόζεται cross-workspace. |
| RA-04 | Ο GlobalRole `COORDINATOR_GLOBAL` επιτρέπει Coordinator access σε πολλαπλά workspaces. |
| RA-05 | Αλλαγή ρόλου κατά τη διάρκεια ενεργής session ενημερώνει τα permissions **αμέσως** στο επόμενο request (no cache stale). |
| RA-06 | Η ανάθεση ρόλου είναι **idempotent** — re-assignment του ίδιου ρόλου δεν δημιουργεί side effects, αλλά καταγράφεται στο audit log. |

### 4.4 Αντιστοίχιση Νέων σε Υπάρχοντες Ρόλους

| Νέος Ρόλος | Αντιστοίχιση με υπάρχοντα | Σημειώσεις |
|------------|---------------------------|------------|
| GOD_MODE_COORDINATOR | GlobalRole.ADMIN (extended) | Νέο GlobalRole enum value |
| COORDINATOR | Νέο — δεν υπάρχει σήμερα | Νέο WorkspaceRole enum value |
| SUPERVISOR | Νέο — δεν υπάρχει σήμερα | Νέο WorkspaceRole enum value |
| EMPLOYEE | WorkspaceRole.EMPLOYEE | Υπάρχει ήδη |
| WASHER | WorkspaceRole.WASHER | Υπάρχει ήδη |
| FLEET_AGENT | Νέο — δεν υπάρχει σήμερα | Νέο WorkspaceRole enum value |
| OPS_AGENT | WorkspaceRole.EDITOR (refined) | Αντικαθιστά/εξειδικεύει EDITOR |
| AUDITOR | WorkspaceRole.VIEWER (refined) | Αντικαθιστά/εξειδικεύει VIEWER |
| CUSTOM_ROLE | Νέο — policy concept | Απαιτεί Permission model στη βάση |

**Αποφάσεις μετάβασης:**
- Υπάρχοντες `ADMIN` workspace members → μεταπίπτουν σε `COORDINATOR`.
- Υπάρχοντες `EDITOR` workspace members → μεταπίπτουν σε `OPS_AGENT`.
- Υπάρχοντες `VIEWER` workspace members → μεταπίπτουν σε `AUDITOR`.
- Υπάρχοντες `EMPLOYEE` → παραμένουν `EMPLOYEE`.
- Υπάρχοντες `WASHER` → παραμένουν `WASHER`.
- Υπάρχοντες `GlobalRole.ADMIN` → ελέγχονται χειροκίνητα, ο ManosPs γίνεται `GOD_MODE`.

---

## 5. Ταξονομία Δικαιωμάτων

### 5.1 Domains

| Domain ID | Ελληνική Περιγραφή | Σημειώσεις |
|-----------|--------------------|------------|
| `users` | Διαχείριση χρηστών | Profiles, credentials, status |
| `governance` | Governance Dashboard | Coordinator dashboard operations |
| `auth` | Authentication & Sessions | Login, sessions, password reset |
| `roles` | Διαχείριση ρόλων | Role assignment, role templates |
| `permissions` | Διαχείριση δικαιωμάτων | Permission matrix configuration |
| `shifts` | Βάρδιες / Πρόγραμμα | Shift scheduling, requests, approvals |
| `fleet` | Στόλος οχημάτων | Vehicles, events, status |
| `washers` | Workflow πλυντηρίων | Washer tasks, completions |
| `requests` | Αιτήματα | Leave requests, shift change requests |
| `calendar` | Ημερολόγιο | Calendar events, scheduling |
| `chat` | Συνομιλίες | Threads, messages, moderation |
| `notifications` | Ειδοποιήσεις | Push, in-app notifications |
| `data` | Δεδομένα / Πίνακες | Tables, records, fields |
| `reports` | Αναφορές | Report generation, export |
| `analytics` | Αναλυτικά | Dashboards, metrics |
| `ai_assist` | AI Βοηθός | AI suggestions, thread management |
| `settings` | Ρυθμίσεις | User/workspace settings |
| `feature_flags` | Feature Flags | Feature toggles, rollout |
| `audit_logs` | Audit Logs | Audit trail access |
| `system` | Σύστημα | System config, integrations, maintenance |
| `automations` | Αυτοματισμοί | Workflow automations |
| `files` | Αρχεία | File upload, management |

### 5.2 Actions

| Action ID | Περιγραφή | Κατηγορία |
|-----------|-----------|-----------|
| `view` | Προβολή / ανάγνωση | Read |
| `create` | Δημιουργία | Write |
| `edit` | Επεξεργασία | Write |
| `delete` | Διαγραφή | Write (destructive) |
| `approve` | Έγκριση | Workflow |
| `reject` | Απόρριψη | Workflow |
| `publish` | Δημοσίευση | Workflow |
| `assign` | Ανάθεση | Assignment |
| `manage_roles` | Διαχείριση ρόλων | Governance |
| `manage_permissions` | Διαχείριση δικαιωμάτων | Governance |
| `export` | Εξαγωγή δεδομένων | Data |
| `import` | Εισαγωγή δεδομένων | Data |
| `moderate` | Moderation (chat, content) | Governance |
| `configure` | Διαμόρφωση ρυθμίσεων | Configuration |
| `run` | Εκτέλεση (automation, report) | Execution |
| `override` | Παράκαμψη κανόνα | High-risk |
| `restore` | Επαναφορά | Recovery |
| `emergency_access` | Πρόσβαση έκτακτης ανάγκης | Emergency |
| `suspend` | Αναστολή (user, feature) | Governance |
| `reinstate` | Επαναφορά (user, feature) | Governance |
| `delegate` | Ανάθεση δικαιώματος σε τρίτο | Delegation |
| `revoke` | Ανάκληση δικαιώματος/session | Governance |
| `simulate` | Προσομοίωση (permission check) | Governance |

### 5.3 Scope Qualifiers

| Qualifier | Περιγραφή |
|-----------|-----------|
| `own` | Μόνο δικά του δεδομένα/ενέργειες |
| `team` | Δεδομένα της ομάδας/βάρδιας |
| `station` | Εντός του σταθμού/workspace |
| `all` | Όλα τα workspaces/stations (global) |

### 5.4 State Qualifiers

| Qualifier | Περιγραφή |
|-----------|-----------|
| `draft` | Πρόχειρα / μη δημοσιευμένα |
| `published` | Δημοσιευμένα / ενεργά |
| `archived` | Αρχειοθετημένα |
| `supervised_only` | Μόνο εποπτευόμενα |
| `assigned_only` | Μόνο ανατεθειμένα |

### 5.5 Field-level Restrictions

| Σενάριο | Περιγραφή |
|---------|-----------|
| FL-01 | EMPLOYEE μπορεί να δει profile αλλά δεν μπορεί να τροποποιήσει role field |
| FL-02 | SUPERVISOR μπορεί να edit shift αλλά δεν μπορεί να publish schedule |
| FL-03 | WASHER μπορεί να δει fleet vehicle info αλλά δεν μπορεί να delete incident records |
| FL-04 | OPS_AGENT μπορεί να edit data records αλλά δεν μπορεί να delete tables |
| FL-05 | AUDITOR μπορεί να δει audit logs αλλά δεν μπορεί να export σε bulk χωρίς Coordinator approval |
| FL-06 | FLEET_AGENT μπορεί να override vehicle status αλλά δεν μπορεί να delete vehicles |
| FL-07 | COORDINATOR μπορεί να manage roles αλλά δεν μπορεί να assign GOD_MODE |

---

## 6. Πλήρες RBAC Matrix

### 6.1 Συντομογραφίες

| Συντ. | Ρόλος |
|-------|-------|
| **GM** | GOD_MODE_COORDINATOR |
| **CO** | COORDINATOR |
| **SU** | SUPERVISOR |
| **EM** | EMPLOYEE |
| **WA** | WASHER |
| **FA** | FLEET_AGENT |
| **OA** | OPS_AGENT |
| **AU** | AUDITOR |

| Σύμβολο | Νόημα |
|---------|-------|
| ✅ | Επιτρέπεται |
| ❌ | Απαγορεύεται |
| 🔒 | Απαιτεί step-up auth |
| ⚠️ | Απαιτεί confirmation dialog |
| 📝 | Υψηλό audit logging |
| 🔔 | Generates alert/notification |
| `(own)` | Μόνο δικά του |
| `(team)` | Μόνο ομάδας |
| `(ws)` | Workspace-scoped |
| `(all)` | Global |

### 6.2 Domain: users

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅ | ✅(team) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ✅(ws) | Per scope | — | info | ❌ | SU βλέπει team members |
| create | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | — | high 📝 | 🔒 | Μόνο GM/CO δημιουργούν users |
| edit | ✅ | ✅(ws) | ❌ | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ❌ | Per scope | own: μόνο profile fields, όχι role | high 📝 | 🔒(CO) | CO edit = step-up required |
| delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | all | — | critical 📝🔔 | 🔒⚠️ | Μόνο GM, με confirmation + step-up |
| suspend | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | — | critical 📝🔔 | 🔒⚠️ | Suspension = αποκλεισμός login |
| reinstate | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | — | high 📝 | 🔒 | — |
| manage_roles | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | CO δεν αναθέτει GM | critical 📝🔔 | 🔒⚠️ | Βλ. Role Assignment Rules |
| revoke | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | CO: μόνο workspace members | critical 📝🔔 | 🔒⚠️ | Revoke = αφαίρεση από workspace |

### 6.3 Domain: governance

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ws/all | AU: read-only | info | ❌ | Dashboard access |
| configure | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | — | high 📝 | 🔒 | Policy configuration |
| manage_permissions | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | CO: εντός workspace | critical 📝🔔 | 🔒⚠️ | Αλλαγή permission matrix |
| delegate | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | Time-bound mandatory | high 📝 | 🔒 | Temporary rights delegation |
| simulate | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ws/all | Read-only operation | info | ❌ | Permission simulator |

### 6.4 Domain: auth

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ❌ | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ❌ | Per scope | own: δικές sessions | info | ❌ | View active sessions |
| revoke | ✅ | ✅(ws) | ❌ | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ❌ | Per scope | own: μόνο δικές sessions. CO: workspace members. | high 📝 | 🔒 | Session revocation |
| configure | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | all | — | critical 📝🔔 | 🔒⚠️ | Auth policy (throttle, session TTL) |
| emergency_access | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | all | Break-glass only | critical 📝🔔 | 🔒⚠️ | Lockout recovery |

### 6.5 Domain: roles

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ws/all | — | info | ❌ | Βλέπουν role definitions |
| create | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | Custom role templates | high 📝 | 🔒 | Custom role creation |
| edit | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | — | high 📝 | 🔒 | Template modify |
| delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | all | — | critical 📝🔔 | 🔒⚠️ | Μόνο GM |
| assign | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | CO δεν αναθέτει GM/CO_GLOBAL | critical 📝🔔 | 🔒⚠️ | Βλ. §4.3 RA rules |

### 6.6 Domain: permissions

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ws/all | — | info | ❌ | View permission matrix |
| manage_permissions | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | CO: εντός workspace limits | critical 📝🔔 | 🔒⚠️ | Αλλαγή permissions |
| override | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | all | — | critical 📝🔔 | 🔒⚠️ | Μόνο GM override |

### 6.7 Domain: shifts

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ✅(team) | ✅(own) | ✅(own) | ✅(own) | ✅(ws) | ✅(ws) | Per scope | — | info | ❌ | — |
| create | ✅ | ✅(ws) | ✅(team) | ❌ | ❌ | ❌ | ✅(ws) | ❌ | ws | — | info | ❌ | SU: draft μόνο για team |
| edit | ✅ | ✅(ws) | ✅(team,draft) | ❌ | ❌ | ❌ | ✅(ws,draft) | ❌ | ws | SU/OA: μόνο draft shifts | info | ❌ | — |
| delete | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ⚠️ | CO+ μόνο |
| approve | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ❌ | Shift request approval |
| reject | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ❌ | Shift request rejection |
| publish | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ⚠️ | Mass publish = confirmation |
| import | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ❌ | ws | — | high 📝 | ⚠️ | CSV import |
| export | ✅ | ✅(ws) | ✅(team) | ✅(own) | ❌ | ❌ | ✅(ws) | ✅(ws) | Per scope | — | info | ❌ | — |
| override | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | critical 📝🔔 | 🔒⚠️ | Schedule override |
| assign | ✅ | ✅(ws) | ✅(team) | ❌ | ❌ | ❌ | ❌ | ❌ | ws | SU: μόνο team members | high 📝 | ❌ | — |

### 6.8 Domain: fleet

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ✅(ws) | ✅(ws) | ✅(assigned) | ✅(ws) | ✅(ws) | ✅(ws) | Per scope | WA: μόνο assigned vehicles | info | ❌ | — |
| create | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ✅(ws) | ✅(ws) | ❌ | ws | — | high 📝 | ❌ | Vehicle registration |
| edit | ✅ | ✅(ws) | ❌ | ✅(ws,events) | ❌ | ✅(ws) | ✅(ws) | ❌ | ws | EM: μόνο event creation | info | ❌ | — |
| delete | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | critical 📝🔔 | 🔒⚠️ | Vehicle removal (rare) |
| override | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ✅(ws) | ❌ | ❌ | ws | — | critical 📝🔔 | 🔒⚠️ | Vehicle state override |
| export | ✅ | ✅(ws) | ✅(ws) | ❌ | ❌ | ✅(ws) | ✅(ws) | ✅(ws) | ws | — | info | ❌ | — |
| import | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ✅(ws) | ❌ | ❌ | ws | — | high 📝 | ⚠️ | Bulk import |

### 6.9 Domain: washers

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ✅(team) | ❌ | ✅(own) | ❌ | ✅(ws) | ✅(ws) | Per scope | — | info | ❌ | — |
| create | ✅ | ✅(ws) | ✅(team) | ❌ | ✅(own) | ❌ | ❌ | ❌ | ws | WA: μόνο δικά tasks | info | ❌ | — |
| edit | ✅ | ✅(ws) | ✅(team) | ❌ | ✅(own) | ❌ | ❌ | ❌ | ws | WA: μόνο δικά tasks | info | ❌ | — |
| delete | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ⚠️ | — |
| approve | ✅ | ✅(ws) | ✅(team) | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ❌ | Task completion approval |
| export | ✅ | ✅(ws) | ✅(team) | ❌ | ❌ | ❌ | ✅(ws) | ✅(ws) | Per scope | — | info | ❌ | — |

### 6.10 Domain: requests

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ✅(team) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ✅(ws) | Per scope | — | info | ❌ | — |
| create | ✅ | ✅(ws) | ✅(ws) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ❌ | ws | Κάθε user υποβάλλει δικά του | info | ❌ | Leave/shift change requests |
| edit | ✅ | ✅(ws) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ❌ | own | Μόνο pending requests | info | ❌ | Πριν γίνει review |
| delete | ✅ | ✅(ws) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ❌ | own | Μόνο pending requests | info | ❌ | Cancel own request |
| approve | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ❌ | Final approval |
| reject | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ❌ | Final rejection |

**Σημείωση:** Ο SUPERVISOR μπορεί να κάνει **recommendation** (pre-approve/flag), αλλά η τελική approval/rejection γίνεται μόνο από CO/GM. Αυτό υλοποιείται ως ξεχωριστό action `recommend` (βλ. §5.2) στο implementation, αλλά στο policy level θεωρείται μέρος του workflow, όχι ξεχωριστό permission.

### 6.11 Domain: calendar

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ✅(team) | ✅(own) | ✅(own) | ✅(own) | ✅(ws) | ✅(ws) | Per scope | — | info | ❌ | — |
| create | ✅ | ✅(ws) | ✅(team) | ❌ | ❌ | ❌ | ✅(ws) | ❌ | ws | — | info | ❌ | — |
| edit | ✅ | ✅(ws) | ✅(team) | ❌ | ❌ | ❌ | ✅(ws) | ❌ | ws | — | info | ❌ | — |
| delete | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ⚠️ | — |

### 6.12 Domain: chat

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ✅(ws) | ✅(ws) | ✅(ws) | ✅(ws) | ✅(ws) | ✅(ws) | ws | — | info | ❌ | Όλοι βλέπουν workspace chat |
| create | ✅ | ✅(ws) | ✅(ws) | ✅(ws) | ✅(ws) | ✅(ws) | ✅(ws) | ❌ | ws | AU: read-only | info | ❌ | Create thread/message |
| edit | ✅ | ✅(ws) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ❌ | own | Μόνο own messages | info | ❌ | — |
| delete | ✅ | ✅(ws) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ❌ | own/ws | CO: μπορεί να delete οποιοδήποτε | high 📝 | ❌ | — |
| moderate | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ❌ | Pin, archive, mute user in chat |
| export | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ❌ | Chat export for compliance |

### 6.13 Domain: notifications

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | own | — | — | ❌ | Κάθε user δικές ειδοποιήσεις |
| configure | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/own | CO: workspace notification rules | info | ❌ | — |

### 6.14 Domain: data

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ✅(ws) | ✅(ws) | ❌ | ✅(ws) | ✅(ws) | ✅(ws) | ws | WA: no data access | info | ❌ | — |
| create | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ❌ | ws | — | info | ❌ | Records, tables |
| edit | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ❌ | ws | — | info | ❌ | — |
| delete | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ⚠️ | Table/record deletion |
| import | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ❌ | ws | — | high 📝 | ⚠️ | CSV import |
| export | ✅ | ✅(ws) | ✅(ws) | ❌ | ❌ | ❌ | ✅(ws) | ✅(ws) | ws | — | info | ❌ | — |

### 6.15 Domain: reports

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ✅(team) | ❌ | ❌ | ✅(ws,fleet) | ✅(ws) | ✅(ws) | Per scope | FA: μόνο fleet reports | info | ❌ | — |
| create | ✅ | ✅(ws) | ✅(team) | ❌ | ❌ | ✅(ws,fleet) | ✅(ws) | ❌ | Per scope | — | info | ❌ | Report generation |
| export | ✅ | ✅(ws) | ✅(team) | ❌ | ❌ | ✅(ws,fleet) | ✅(ws) | ✅(ws) | Per scope | — | high 📝 | ❌ | PDF/CSV export |
| run | ✅ | ✅(ws) | ✅(team) | ❌ | ❌ | ✅(ws,fleet) | ✅(ws) | ❌ | Per scope | — | info | ❌ | Execute report query |

### 6.16 Domain: analytics

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ✅(team) | ❌ | ❌ | ✅(ws,fleet) | ✅(ws) | ✅(ws) | Per scope | — | info | ❌ | Dashboard metrics |
| export | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ws | — | high 📝 | ❌ | Analytics data export |
| configure | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | info | ❌ | Dashboard customization |

### 6.17 Domain: ai_assist

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ✅(ws) | ✅(ws) | ✅(ws) | ✅(ws) | ✅(ws) | ✅(ws) | ws | Feature flag `cloudAiGateway` must be enabled | info | ❌ | View AI threads |
| create | ✅ | ✅(ws) | ✅(ws) | ✅(ws) | ✅(ws) | ✅(ws) | ✅(ws) | ❌ | ws | — | info | ❌ | Create AI thread/prompt |
| approve | ✅ | ✅(ws) | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ws | AI suggestions are **approval-gated** | high 📝 | ❌ | Apply AI suggestion to production data |
| reject | ✅ | ✅(ws) | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ❌ | Reject AI suggestion |
| configure | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ❌ | AI model/policy settings |

### 6.18 Domain: settings

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | own/ws | Own settings always visible | info | ❌ | — |
| edit | ✅ | ✅(ws) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | own/ws | CO: workspace settings. Others: own. | info | ❌ | — |
| configure | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | Workspace-level settings | high 📝 | ❌ | — |

### 6.19 Domain: feature_flags

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ws/all | — | info | ❌ | View flag status |
| configure | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | CO: workspace flags only. GM: global. | high 📝 | 🔒 | Toggle features |
| override | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | all | — | critical 📝🔔 | 🔒⚠️ | Global flag override |

### 6.20 Domain: audit_logs

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ws/all | GM: all. CO/AU: workspace business audit only. | info | ❌ | — |
| export | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | — | high 📝 | 🔒 | Compliance export |
| delete | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | — | **Blocked for all roles including GM** | — | — | P-10: Immutable audit trail |

### 6.21 Domain: system

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws/all | System health, config | info | ❌ | — |
| configure | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | all | — | critical 📝🔔 | 🔒⚠️ | System-wide settings |
| emergency_access | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | all | Break-glass | critical 📝🔔 | 🔒⚠️ | Emergency maintenance |
| override | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | all | — | critical 📝🔔 | 🔒⚠️ | System override |
| restore | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | all | — | critical 📝🔔 | 🔒⚠️ | System restore |

### 6.22 Domain: automations

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ✅(ws) | ws | — | info | ❌ | — |
| create | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ❌ | ws | — | high 📝 | ❌ | — |
| edit | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ❌ | ws | — | high 📝 | ❌ | — |
| delete | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ws | — | high 📝 | ⚠️ | — |
| run | ✅ | ✅(ws) | ❌ | ❌ | ❌ | ❌ | ✅(ws) | ❌ | ws | — | info | ❌ | Execute automation |

### 6.23 Domain: files

| Action | GM | CO | SU | EM | WA | FA | OA | AU | Scope | Conditions | Audit | Step-up | Notes |
|--------|----|----|----|----|----|----|----|----|-------|------------|-------|---------|-------|
| view | ✅ | ✅(ws) | ✅(ws) | ✅(ws) | ✅(own) | ✅(ws) | ✅(ws) | ✅(ws) | Per scope | — | info | ❌ | — |
| create | ✅ | ✅(ws) | ✅(ws) | ✅(ws) | ✅(own) | ✅(ws) | ✅(ws) | ❌ | Per scope | — | info | ❌ | Upload |
| delete | ✅ | ✅(ws) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ✅(own) | ❌ | own/ws | CO: any in workspace | high 📝 | ❌ | — |

---

## 7. Προδιαγραφή Coordinator Governance Dashboard

### 7.1 Αρμοδιότητες Coordinator

Ο Coordinator (CO) είναι ο κύριος λειτουργικός διαχειριστής του σταθμού/workspace. Μέσω του Governance Dashboard, ο CO:

1. **Διαχειρίζεται χρήστες:** Invite, create, suspend, reinstate, remove.
2. **Αναθέτει/αφαιρεί ρόλους:** Assign/change/revoke WorkspaceRole εντός workspace.
3. **Ρυθμίζει πρόσβαση:** Enable/disable module access ανά ρόλο ή ανά χρήστη.
4. **Διαμορφώνει permissions:** Configure permission overrides εντός workspace.
5. **Αναθέτει temporary rights:** Delegate time-bound additional permissions.
6. **Ελέγχει audit:** Review workspace-scoped audit logs.
7. **Διαχειρίζεται policies:** Session policy, feature flags (ws-scoped), retention defaults.
8. **Ενεργοποιεί/απενεργοποιεί capabilities:** Per role/user feature toggles.

### 7.2 Τι δεν μπορεί να κάνει ο Coordinator (εκτός God Mode ή explicit grant)

| Ενέργεια | Λόγος Αποκλεισμού |
|----------|-------------------|
| Ανάθεση GOD_MODE_COORDINATOR role | Μοναδικός ρόλος — μόνο ο ίδιος ο GM μπορεί (κληρονομικά blocked) |
| Αλλαγή system-wide policies | Scope: global — υπερβαίνει workspace authority |
| Πρόσβαση σε audit logs άλλων workspaces | Scope restriction |
| Απενεργοποίηση security logging | P-10 immutable audit |
| Deletion user account (permanent) | Μόνο GM — separation of duties |
| Override global feature flags | Μόνο GM |
| System configuration (auth throttle, session TTL) | Μόνο GM |
| View security events (cross-workspace) | Security separation |

### 7.3 Role Assignment Lifecycle

#### 7.3.1 Create User

| Βήμα | Περιγραφή | Actor | Conditions |
|------|-----------|-------|------------|
| 1 | CO επιλέγει "Invite Member" στο Governance Dashboard | CO | Πρέπει να έχει active step-up session |
| 2 | Εισάγει email, επιλέγει WorkspaceRole | CO | Role ≠ GOD_MODE_COORDINATOR |
| 3 | Σύστημα δημιουργεί InviteToken (72h TTL) | System | Token hashed, one-time use |
| 4 | Invited user accepts, creates credentials | Invited User | PIN + password setup |
| 5 | Σύστημα δημιουργεί User + WorkspaceMember | System | Role = invited role |
| 6 | Audit log entry: `user.create`, `roles.assign` | System | severity: high |

#### 7.3.2 Assign / Change Role

| Βήμα | Περιγραφή | Actor | Conditions |
|------|-----------|-------|------------|
| 1 | CO ανοίγει member profile στο Dashboard | CO | Member πρέπει να ανήκει στο workspace |
| 2 | Επιλέγει νέο role | CO | Target role ≠ GM. Target role ≤ CO hierarchy. |
| 3 | Step-up authentication (PIN re-entry) | CO | Mandatory |
| 4 | Confirmation dialog: "Αλλαγή ρόλου {user} από {old} σε {new};" | CO | Explicit confirmation |
| 5 | Σύστημα ενημερώνει WorkspaceMember.role | System | Idempotent — αν ίδιος ρόλος, no-op |
| 6 | Νέα permissions εφαρμόζονται αμέσως | System | Στο επόμενο request του affected user |
| 7 | Audit log entry: `roles.assign` | System | severity: critical |
| 8 | Notification στον affected user | System | In-app + email (αν configured) |

#### 7.3.3 Revoke Access (Remove from Workspace)

| Βήμα | Περιγραφή | Actor | Conditions |
|------|-----------|-------|------------|
| 1 | CO επιλέγει "Remove Member" | CO | Step-up required |
| 2 | Confirmation dialog: "Αφαίρεση {user} από {workspace};" | CO | Destructive action warning |
| 3 | Σύστημα διαγράφει WorkspaceMember | System | Soft delete recommended |
| 4 | Σύστημα revokes active sessions του user για αυτό το workspace | System | Immediate effect |
| 5 | Audit log entry: `users.revoke` | System | severity: critical |

#### 7.3.4 Suspend User

| Βήμα | Περιγραφή | Actor | Conditions |
|------|-----------|-------|------------|
| 1 | CO επιλέγει "Suspend" στο member profile | CO | Step-up + confirmation required |
| 2 | Σύστημα θέτει user status = SUSPENDED | System | Flag σε WorkspaceMember ή User |
| 3 | User δεν μπορεί να κάνει login ή να access workspace | System | Immediate enforcement |
| 4 | Active sessions του user revoked | System | — |
| 5 | Audit log entry: `users.suspend` | System | severity: critical |

#### 7.3.5 Reinstate User

| Βήμα | Περιγραφή | Actor | Conditions |
|------|-----------|-------|------------|
| 1 | CO επιλέγει "Reinstate" στο suspended member | CO | Step-up required |
| 2 | Σύστημα θέτει user status = ACTIVE | System | — |
| 3 | User μπορεί να κάνει login ξανά | System | Νέο session πρέπει να δημιουργηθεί |
| 4 | Audit log entry: `users.reinstate` | System | severity: high |

### 7.4 Delegation Model

| Πεδίο | Προδιαγραφή |
|-------|-------------|
| **Ποιος αναθέτει** | GM (global) ή CO (workspace-scoped) |
| **Σε ποιον** | Οποιονδήποτε member ≤ delegator's role στην ιεραρχία |
| **Τι αναθέτει** | Specific domain+action permissions (cherry-picked, not full role) |
| **Μέγιστη διάρκεια** | 72 ώρες (configurable by GM, max 168 ώρες / 7 ημέρες) |
| **Default διάρκεια** | 24 ώρες |
| **Expiration handling** | Αυτόματη ανάκληση μετά τη λήξη. Background job ελέγχει κάθε 5 λεπτά. |
| **Early revocation** | CO ή GM μπορούν να ανακαλέσουν ανά πάσα στιγμή |
| **Max active delegations** | 10 ανά workspace (configurable) |
| **Audit** | Κάθε delegation: create, extend, revoke, expire — logged |
| **Restrictions** | Delegated rights δεν μπορούν να υπερβούν τα δικαιώματα του delegator. Δεν μπορεί delegation σε GM actions. |

### 7.5 Permission Simulator

| Πεδίο | Προδιαγραφή |
|-------|-------------|
| **Inputs** | Target user (ή role), domain, action, workspace, [optional: additional context] |
| **Outputs** | Allowed/Denied, reason(s), matching rule(s), active delegations, effective scope |
| **Who can use** | GM, CO, AUDITOR (all read-only operation) |
| **Required behavior** | Pure function — no side effects. Δεν τροποποιεί permissions. Αποτέλεσμα consistent με actual enforcement. |
| **Simulation modes** | (a) "What can user X do?" — list all allowed actions. (b) "Can user X do Y?" — specific check. (c) "What if user X had role Z?" — hypothetical. |

### 7.6 Access Review Process

| Πεδίο | Προδιαγραφή |
|-------|-------------|
| **Cadence** | Κάθε 30 ημέρες (configurable: 14–90 ημέρες) |
| **Who reviews** | CO reviews workspace members. GM reviews coordinators. |
| **What is reviewed** | Active users, role assignments, active delegations, feature flag overrides. |
| **Required outcome** | Κάθε user: Confirm ή Revoke/Modify. |
| **Overdue behavior** | Αν access review δεν ολοκληρωθεί εντός 7 ημερών μετά τη deadline, warning notification στον CO. Αν 14 ημέρες: alert στον GM. |
| **Audit** | Review completion logged. Non-completion logged ως `governance.review_overdue`. |

### 7.7 Policy Center Scope

| Πολιτική | CO | GM | Σημειώσεις |
|----------|----|----|------------|
| Session idle timeout (ws) | ✅ configure | ✅ override | Default: 30 min. Range: 5–120 min. |
| Session max TTL (ws) | ❌ | ✅ configure | Default: 14 days. |
| Auth throttle limits | ❌ | ✅ configure | Global policy |
| Password complexity rules | ❌ | ✅ configure | Global policy |
| PIN requirements | ❌ | ✅ configure | Global policy |
| Retention defaults (ws) | ✅ configure | ✅ override | Audit log retention period |
| Feature flags (ws) | ✅ configure | ✅ override/global | CO: workspace toggles only |
| Invite expiration (ws) | ✅ configure | ✅ override | Default: 72h. Range: 24h–168h. |
| Delegation max duration | ❌ | ✅ configure | Default: 72h. Max: 168h. |
| Access review cadence | ❌ | ✅ configure | Default: 30 days |

### 7.8 Safety Confirmations

Κάθε destructive ή high-risk action στο Governance Dashboard απαιτεί:

| Action Category | Step-up Auth | Confirmation Dialog | Undo Window | Notification |
|-----------------|-------------|---------------------|-------------|--------------|
| Role change | ✅ PIN | ✅ explicit confirm | 5 min soft-undo (recommended) | ✅ affected user + audit |
| User suspension | ✅ PIN | ✅ explicit confirm + reason | ❌ (reinstate available) | ✅ affected user + audit |
| User removal | ✅ PIN | ✅ explicit confirm | 24h soft-delete recovery (recommended) | ✅ affected user + audit |
| Permission change | ✅ PIN | ✅ explicit confirm | 5 min soft-undo (recommended) | ✅ audit |
| Delegation create | ✅ PIN | ✅ duration confirm | ❌ (revocation available) | ✅ delegatee + audit |
| Feature flag toggle | ✅ PIN | ✅ impact preview | ❌ (re-toggle available) | ✅ audit |
| Mass shift publish | ❌ | ✅ explicit confirm | ❌ (rollback available) | ✅ affected users |
| Bulk data delete | ✅ PIN | ✅ count confirm | ❌ | ✅ audit |

### 7.9 Audit Requirements for Governance Actions

Κάθε ενέργεια στο Governance Dashboard καταγράφεται στο AuditLog με:

| Πεδίο | Υποχρεωτικό |
|-------|-------------|
| `actorUserId` | ✅ |
| `action` | ✅ (π.χ. `governance.role_change`) |
| `entityType` | ✅ (π.χ. `WorkspaceMember`) |
| `entityId` | ✅ |
| `metaJson` | ✅ (πρέπει να περιέχει: old value, new value, reason αν applicable) |
| `workspaceId` | ✅ |
| `timestamp` | ✅ (server-generated, UTC) |

Επιπλέον, **security-level actions** (role change, suspension, permission modify) καταγράφονται **και** στο SecurityEvent model.

---

## 8. Προδιαγραφή God Mode (ManosPs)

### 8.1 Ταυτότητα

| Πεδίο | Τιμή |
|-------|------|
| Full Name (EN) | Psistakis Manolis |
| Full Name (GR) | Μανώλης Ψυστάκης |
| Username | ManosPs |
| GlobalRole | GOD_MODE |
| Scope | Global (cross-workspace, cross-station) |
| Bootstrap Credential | PIN (bootstrap μόνο — αποθήκευση: bcrypt hash, cost ≥ 12. Δεν εμφανίζεται σε logs ή UI.) |

### 8.2 Πλήρης Λίστα Δυνατοτήτων God Mode

| # | Δυνατότητα | Scope | Conditions |
|---|-----------|-------|------------|
| GM-01 | Πλήρης CRUD σε όλα τα user accounts | Global | — |
| GM-02 | Ανάθεση/αφαίρεση ΟΠΟΙΟΥΔΗΠΟΤΕ ρόλου (συμπ. COORDINATOR) | Global | Step-up required |
| GM-03 | Δημιουργία/τροποποίηση/διαγραφή workspaces | Global | Step-up + confirmation |
| GM-04 | Override ΟΠΟΙΟΥΔΗΠΟΤΕ permission entry | Global | Step-up + confirmation + audit critical |
| GM-05 | Global feature flag management | Global | Step-up |
| GM-06 | System policy configuration (auth, session, throttle) | Global | Step-up + confirmation |
| GM-07 | Emergency session revocation (all users, all workspaces) | Global | Break-glass — step-up + confirmation |
| GM-08 | View ALL audit logs (business + security, cross-workspace) | Global | — |
| GM-09 | Export audit logs | Global | Step-up |
| GM-10 | User lockout recovery (reset password, unlock account) | Global | Step-up |
| GM-11 | Permission corruption recovery (reset to defaults) | Global | Step-up + confirmation |
| GM-12 | Incident response mode activation | Global | Step-up + confirmation + dual confirmation recommended |
| GM-13 | Delegation of COORDINATOR role | Global | Step-up + confirmation |
| GM-14 | Custom role template management (global) | Global | Step-up |
| GM-15 | AI assist policy configuration | Global | Step-up |
| GM-16 | System maintenance actions (down for maintenance, etc.) | Global | Step-up + confirmation |
| GM-17 | Bootstrap user seeding (initial setup) | Global | One-time setup |
| GM-18 | Access review override (mark as reviewed on behalf) | Global | Step-up + audit critical |
| GM-19 | Force-logout specific user | Global | Step-up |
| GM-20 | View and configure integrations | Global | Step-up |

### 8.3 Actions Requiring Step-up Authentication

Κάθε God Mode action (εκτός GM-08: view audit logs, και simple view operations) απαιτεί **step-up authentication**:

- **Μηχανισμός:** Re-entry 4-digit PIN εντός 10-minute elevated session window.
- **Elevated session:** `AuthSession.elevatedUntil` timestamp σε DB.
- **Expiration:** 10 λεπτά μετά το τελευταίο successful step-up.
- **Re-auth:** Αν elevated session expired, απαιτείται νέο PIN entry.

### 8.4 Actions Requiring Dual Confirmation (RECOMMENDED)

Τα ακόλουθα actions συνιστάται να απαιτούν **dual confirmation** (σε μελλοντική φάση — δεν είναι mandatory για MVP):

| Action | Dual Confirmation Method |
|--------|--------------------------|
| GM-07: Emergency mass session revocation | Step-up + type "CONFIRM EMERGENCY" |
| GM-11: Permission corruption recovery | Step-up + type workspace name |
| GM-12: Incident response mode | Step-up + explicit reason text |
| GM-16: System maintenance mode | Step-up + expected duration input |

### 8.5 Actions Blocked Even for God Mode

| # | Action | Λόγος |
|---|--------|-------|
| BLOCKED-01 | Deletion ή τροποποίηση immutable audit log entries | P-10: Immutable Audit Trail. Η βάση δεδομένων δεν πρέπει να παρέχει DELETE/UPDATE στον AuditLog table μέσω application layer. |
| BLOCKED-02 | Σιωπηλή απενεργοποίηση security logging | Κάθε αλλαγή σε logging configuration καταγράφεται πριν εφαρμοστεί (log-before-disable pattern). |
| BLOCKED-03 | Self-deletion (GM deletes own account) | Αποτρέπει accidental lockout. Η μεταφορά God Mode σε άλλο user πρέπει να γίνει πρώτα. |
| BLOCKED-04 | Δημιουργία δεύτερου GOD_MODE_COORDINATOR | Singleton constraint. Μόνο ένας GM ανά πάσα στιγμή. Transfer process required. |
| BLOCKED-05 | Bypass step-up auth για critical actions | Ακόμα κι αν η session είναι elevated, τα critical actions απαιτούν fresh step-up. |

### 8.6 Emergency Recovery Use-Cases

#### 8.6.1 Lockout Recovery

| Σενάριο | Ενέργεια GM | Conditions |
|---------|-------------|------------|
| User locked out (throttle) | GM εκτελεί `auth.emergency_access`: reset throttle counters | Step-up. Audit: critical. |
| User forgot password | GM εκτελεί `users.edit`: trigger password reset email | Step-up. Audit: high. |
| User forgot PIN | GM εκτελεί `users.edit`: generate one-time PIN reset token | Step-up. Audit: high. |
| All sessions revoked accidentally | GM εκτελεί `auth.restore`: re-enable login για affected users | Step-up + confirmation. Audit: critical. |

#### 8.6.2 Permission Corruption Recovery

| Σενάριο | Ενέργεια GM | Conditions |
|---------|-------------|------------|
| Role assignment data corrupted | GM εκτελεί `system.restore`: reset workspace members to default roles | Step-up + confirmation + type workspace name. Audit: critical. |
| Custom role template invalid | GM εκτελεί `roles.delete` + `roles.create`: recreate template | Step-up. Audit: high. |
| Permission matrix inconsistency | GM εκτελεί `permissions.override`: reset to baseline matrix | Step-up + confirmation. Audit: critical. |

#### 8.6.3 Session Revocation (Incident Response)

| Σενάριο | Ενέργεια GM | Conditions |
|---------|-------------|------------|
| Suspected compromise of specific user | GM εκτελεί `auth.revoke`: revoke ALL sessions of target user + suspend | Step-up. Audit: critical. Alert: yes. |
| Suspected platform-wide breach | GM εκτελεί `system.emergency_access`: revoke ALL sessions except GM + activate incident mode | Step-up + dual confirmation. Audit: critical. Alert: yes. |
| Need to force-update all passwords | GM εκτελεί `auth.configure`: set `forcePasswordReset` flag globally | Step-up + confirmation. Audit: critical. |

#### 8.6.4 Incident Response Mode

Όταν ενεργοποιηθεί:
- Όλες οι non-GM sessions terminating εντός 5 λεπτών.
- Login disabled για non-GM users.
- Audit logging escalated σε maximum verbosity.
- Notification broadcast σε όλους τους COORDINATOR.
- GM μπορεί να εξετάσει, clean up, και re-enable access σταδιακά.

### 8.7 Monitoring & Audit Severity Requirements

| God Mode Action Category | Audit Severity | Alert | Real-time Log |
|--------------------------|---------------|-------|---------------|
| View operations | info | ❌ | ❌ |
| Configuration changes | high | ❌ | ✅ |
| User/role management | critical | ✅ | ✅ |
| Emergency actions | critical | ✅ (immediate) | ✅ |
| Permission overrides | critical | ✅ | ✅ |
| System policy changes | critical | ✅ | ✅ |
| Session revocations | critical | ✅ | ✅ |
| Incident response mode | critical | ✅ (broadcast) | ✅ |

### 8.8 Alerting Recommendations

| Trigger | Alert Type | Recipients |
|---------|-----------|------------|
| GM step-up authentication | In-app log entry | GM (self-review) |
| GM role assignment change | Email + in-app | Affected user + all COORDINATORs |
| GM emergency action | Email + in-app + SMS (recommended) | All COORDINATORs |
| GM session revocation (other user) | Email + in-app | Affected user |
| GM incident response mode | Broadcast notification | All users |
| 3+ failed GM step-up attempts | Alert + temporary lockout | GM (logged) |
| GM login from new device/IP | Email notification | GM |

### 8.9 Session Handling Policy for God Mode

| Policy | Τιμή | Σημειώσεις |
|--------|------|------------|
| Session max TTL | 8 ώρες (vs 14 ημέρες κανονικό) | Shorter session for security |
| Session idle timeout | 15 λεπτά (vs 30 λεπτά κανονικό) | Shorter idle for security |
| Step-up elevated window | 10 λεπτά | Same as current |
| Step-up re-auth for critical | **Always fresh** (δεν χρησιμοποιεί existing elevation) | Extra protection |
| Concurrent sessions | Maximum 2 | Limit exposure |
| New device/IP login | Requires additional verification (email OTP recommended) | Recommended enhancement |
| Session on page close | Remains active until idle timeout | Standard behavior |
| Force logout on password change | Yes — all sessions revoked immediately | Security requirement |

### 8.10 Compromise Response Procedure (GM Account)

Αν υποπτευόμαστε ότι ο GM account (ManosPs) είναι compromised:

| Βήμα | Ενέργεια | Actor | Priority |
|------|----------|-------|----------|
| 1 | Immediate: Revoke ALL GM sessions μέσω direct DB operation (by infrastructure admin) | Infra Admin | P0 |
| 2 | Disable GM login (set `suspendedAt` timestamp on User record via DB) | Infra Admin | P0 |
| 3 | Review SecurityEvent log: identify all GM actions in last 24–72h | Infra Admin | P0 |
| 4 | Assess scope of compromise: data accessed, permissions changed, users affected | Infra Admin + CO | P0 |
| 5 | Roll back any unauthorized permission/role changes identified in step 4 | Infra Admin | P1 |
| 6 | Generate new credentials for GM (new password + PIN via secure channel) | Infra Admin | P1 |
| 7 | Re-enable GM account with new credentials | Infra Admin | P1 |
| 8 | GM performs full access review of all workspaces | GM (ManosPs) | P1 |
| 9 | Post-incident report documenting timeline, impact, remediation | GM + CO | P2 |

**Σημαντικό:** Η διαδικασία recovery για compromised GM account απαιτεί **infrastructure-level access** (direct DB), δεδομένου ότι ο GM είναι ο μοναδικός application-level superuser. Αυτό είναι by design — δεν υπάρχει application-level "super-God Mode".

---

## 9. Delegation / Temporary Rights / Context Rules

### 9.1 Station/Workspace-Scoped Permissions

| Κανόνας | Περιγραφή |
|---------|-----------|
| CTX-01 | Κάθε permission εκτελείται εντός ενός workspace context. Εξαίρεση: GM (global). |
| CTX-02 | Ένας user μπορεί να είναι member σε πολλαπλά workspaces με διαφορετικούς ρόλους. |
| CTX-03 | Ο active workspace καθορίζεται από: (a) URL parameter, (b) session default, (c) fallback στο πρώτο workspace by creation date. |
| CTX-04 | Cross-workspace operations δεν επιτρέπονται εκτός αν ο ρόλος έχει scope `all` (GM, COORDINATOR_GLOBAL). |
| CTX-05 | Αν ένας user αφαιρεθεί από workspace, χάνει αμέσως πρόσβαση — ακόμα κι αν έχει active session. |

### 9.2 Temporary Grants (Delegation Records)

Κάθε delegation record περιλαμβάνει:

| Πεδίο | Τύπος | Υποχρεωτικό | Περιγραφή |
|-------|-------|-------------|-----------|
| `id` | UUID | ✅ | Unique identifier |
| `workspaceId` | UUID | ✅ | Target workspace |
| `grantedByUserId` | UUID | ✅ | Delegator (CO ή GM) |
| `grantedToUserId` | UUID | ✅ | Delegatee |
| `domain` | string | ✅ | Target domain |
| `action` | string | ✅ | Target action |
| `scope` | string | ✅ | Effective scope (own/team/station/all) |
| `expiresAt` | timestamp | ✅ | Expiration (mandatory, max as per policy) |
| `revokedAt` | timestamp | ❌ | Early revocation timestamp |
| `revokedByUserId` | UUID | ❌ | Who revoked |
| `reason` | string | ❌ | Delegation reason (recommended) |
| `createdAt` | timestamp | ✅ | Creation timestamp |

### 9.3 Delegated Approvals

| Κανόνας | Περιγραφή |
|---------|-----------|
| DA-01 | Approval delegation: CO μπορεί να αναθέσει `shifts.approve` ή `requests.approve` σε SUPERVISOR temporarily. |
| DA-02 | Ο delegatee εκτελεί approvals **ως εαυτός** (δεν impersonates τον delegator). |
| DA-03 | Audit log entries δείχνουν τον delegatee ως actor + reference στο delegation record. |
| DA-04 | Ο delegator μπορεί ανά πάσα στιγμή να ανακαλέσει τη delegation. |

### 9.4 Expiration Handling

| Event | Συμπεριφορά |
|-------|-------------|
| Delegation expires | Permissions ανακαλούνται αυτόματα. Background job ελέγχει κάθε 5 min. |
| User has active operation when delegation expires | Operation-in-progress ολοκληρώνεται. Νέες operations denied. |
| Delegation expires during active session | Permissions refresh στο επόμενο request. Δεν απαιτείται re-login. |
| System downtime during expiration | Κατά την επαναφορά, σύστημα εφαρμόζει pending expirations. |

### 9.5 Conflict Resolution Rules

| Κανόνας | Περιγραφή |
|---------|-----------|
| CR-01 | **Deny overrides allow:** Αν υπάρχει explicit deny rule, υπερισχύει κάθε allow (ακόμα και delegation). |
| CR-02 | **Most restrictive wins:** Αν πολλαπλοί ρόλοι (future: custom roles + delegations), εφαρμόζεται η πιο περιοριστική ερμηνεία. |
| CR-03 | **Explicit over default:** User-level override υπερισχύει role-level default. |
| CR-04 | **Delegation is additive:** Delegation προσθέτει permissions, δεν αφαιρεί. |
| CR-05 | **Scope narrowing, not widening:** Delegation δεν μπορεί να δώσει ευρύτερο scope από τον delegator. |
| CR-06 | **Latest assignment wins for role changes:** Αν role αλλάξει, νέος role εφαρμόζεται αμέσως, αντικαθιστώντας τον παλιό. Delegations παραμένουν active μέχρι expiration (εκτός αν ανακληθούν). |

### 9.6 Deny-Override vs Allow-Override Policy

Η πλατφόρμα ακολουθεί **deny-override** μοντέλο:

```
Evaluation Order:
1. Check BLOCKED rules (absolute deny — even GM)
2. Check explicit deny rules (per-user or per-role)
3. Check delegation grants (additive allows)
4. Check role-based permissions (RBAC matrix)
5. Default: DENY (P-01)
```

### 9.7 Inheritance Rules

| Κανόνας | Περιγραφή |
|---------|-----------|
| INH-01 | Roles δεν κληρονομούν permissions μεταξύ τους. Κάθε role ορίζεται ανεξάρτητα στο matrix. |
| INH-02 | Custom role templates μπορούν να βασιστούν σε υπάρχον role ως starting point, αλλά modifications δεν propagate πίσω. |
| INH-03 | Workspace-level policy overrides δεν κληρονομούνται σε sub-workspaces (αν υπάρξουν). |
| INH-04 | Global feature flags κληρονομούνται σε workspaces εκτός αν υπάρχει workspace-level override. |

### 9.8 Fallback Behavior When Context Missing

| Σενάριο | Fallback |
|---------|----------|
| User role not found in DB | Deny all access. Show error: "Ο ρόλος σας δεν βρέθηκε. Επικοινωνήστε με τον Coordinator." |
| Workspace not found | Deny access. Redirect to workspace selector. |
| Permission matrix entry missing for domain+action | Default deny. Log warning. |
| Delegation record corrupted | Ignore delegation. Apply base role permissions only. Log error. |
| Feature flag value missing | Apply default value (as defined in feature flag definition). |
| Multiple workspaces, none selected | Redirect to workspace selector. Do not auto-select. |

### 9.9 User Transfer Between Stations/Workspaces

| Βήμα | Περιγραφή | Actor |
|------|-----------|-------|
| 1 | CO (source workspace) initiates transfer request | CO (source) |
| 2 | CO (target workspace) accepts transfer | CO (target) |
| 3 | User added to target workspace with specified role | System |
| 4 | User optionally removed from source workspace (ή dual membership) | CO (source) |
| 5 | Delegations from source workspace εκπνέουν (δεν μεταφέρονται) | System |
| 6 | Audit log entries σε BOTH workspaces | System |

---

## 10. Audit / Step-up / Confirmations Policy

### 10.1 Audit Severity Levels

| Level | Περιγραφή | Retention | Access |
|-------|-----------|-----------|--------|
| `info` | Routine operations (view, navigate, read) | 30 ημέρες (configurable) | CO, AU, GM |
| `warning` | Notable operations (failed attempts, denied access) | 90 ημέρες | CO, AU, GM |
| `high` | Significant changes (create, edit, role assign) | 365 ημέρες | CO, AU, GM |
| `critical` | High-risk changes (permission override, user deletion, emergency) | Indefinite (immutable) | GM, AU (ws-scoped) |

### 10.2 Complete Action Audit Matrix

#### Auth Events

| Event | Severity | Log To | Step-up Required | Confirmation Required | Alert |
|-------|----------|--------|------------------|-----------------------|-------|
| Login success | info | SecurityEvent | ❌ | ❌ | ❌ |
| Login failure | warning | SecurityEvent | ❌ | ❌ | After 3 consecutive |
| Login lockout (throttle) | high | SecurityEvent | ❌ | ❌ | ✅ to CO |
| Logout | info | SecurityEvent | ❌ | ❌ | ❌ |
| Password reset request | info | SecurityEvent | ❌ | ❌ | ❌ |
| Password reset success | high | SecurityEvent | ❌ | ❌ | ✅ to user |
| Session created | info | SecurityEvent | ❌ | ❌ | ❌ |
| Session revoked | high | SecurityEvent | ❌ | ❌ | ❌ |
| Step-up auth success | info | SecurityEvent | N/A | ❌ | ❌ |
| Step-up auth failure | warning | SecurityEvent | N/A | ❌ | After 3 consecutive |
| Signup | high | SecurityEvent + AuditLog | ❌ | ❌ | ✅ to admin/CO |
| Invite created | high | SecurityEvent + AuditLog | ✅ | ❌ | ❌ |
| Invite accepted | high | SecurityEvent + AuditLog | ❌ | ❌ | ✅ to CO |

#### Permission & Role Changes

| Event | Severity | Log To | Step-up Required | Confirmation Required | Alert |
|-------|----------|--------|------------------|-----------------------|-------|
| Role assigned | critical | SecurityEvent + AuditLog | ✅ | ✅ | ✅ to affected user |
| Role changed | critical | SecurityEvent + AuditLog | ✅ | ✅ | ✅ to affected user |
| Role revoked | critical | SecurityEvent + AuditLog | ✅ | ✅ | ✅ to affected user |
| Permission override created | critical | SecurityEvent + AuditLog | ✅ | ✅ | ✅ to CO/GM |
| Permission override deleted | critical | SecurityEvent + AuditLog | ✅ | ✅ | ✅ to CO/GM |
| Delegation created | high | AuditLog | ✅ | ✅ (duration confirm) | ✅ to delegatee |
| Delegation revoked | high | AuditLog | ❌ | ❌ | ✅ to delegatee |
| Delegation expired | info | AuditLog | ❌ | ❌ | ✅ to delegatee |

#### God Mode Actions

| Event | Severity | Log To | Step-up Required | Confirmation Required | Alert |
|-------|----------|--------|------------------|-----------------------|-------|
| GM view audit logs | info | SecurityEvent | ❌ | ❌ | ❌ |
| GM configuration change | critical | SecurityEvent + AuditLog | ✅ | ✅ | ✅ to all COs |
| GM emergency session revocation | critical | SecurityEvent + AuditLog | ✅ | ✅ (dual) | ✅ broadcast |
| GM user management action | critical | SecurityEvent + AuditLog | ✅ | ✅ | ✅ to affected + COs |
| GM incident response mode | critical | SecurityEvent + AuditLog | ✅ | ✅ (dual) | ✅ broadcast |
| GM permission corruption recovery | critical | SecurityEvent + AuditLog | ✅ | ✅ (dual) | ✅ broadcast |
| GM feature flag global override | critical | SecurityEvent + AuditLog | ✅ | ✅ | ✅ to all COs |

#### AI Suggestions

| Event | Severity | Log To | Step-up Required | Confirmation Required | Alert |
|-------|----------|--------|------------------|-----------------------|-------|
| AI suggestion generated | info | AuditLog | ❌ | ❌ | ❌ |
| AI suggestion approved (applied) | high | AuditLog | ❌ | ✅ | ❌ |
| AI suggestion rejected | info | AuditLog | ❌ | ❌ | ❌ |

#### Destructive Data Actions

| Event | Severity | Log To | Step-up Required | Confirmation Required | Alert |
|-------|----------|--------|------------------|-----------------------|-------|
| Table deleted | high | AuditLog | ❌ | ✅ | ❌ |
| Bulk records deleted | high | AuditLog | ❌ | ✅ (count confirm) | ❌ |
| Vehicle deleted | critical | AuditLog | ✅ | ✅ | ❌ |
| Workspace deleted | critical | SecurityEvent + AuditLog | ✅ | ✅ (dual) | ✅ broadcast |
| Automation deleted | high | AuditLog | ❌ | ✅ | ❌ |

#### System & Policy Changes

| Event | Severity | Log To | Step-up Required | Confirmation Required | Alert |
|-------|----------|--------|------------------|-----------------------|-------|
| System policy change | critical | SecurityEvent + AuditLog | ✅ | ✅ | ✅ to all COs |
| Feature flag change (workspace) | high | AuditLog | ✅ | ✅ | ❌ |
| Feature flag change (global) | critical | SecurityEvent + AuditLog | ✅ | ✅ | ✅ to all COs |
| Session policy change | critical | SecurityEvent + AuditLog | ✅ | ✅ | ✅ to all COs |
| Retention policy change | critical | SecurityEvent + AuditLog | ✅ | ✅ | ✅ to all COs |

### 10.3 Step-up Authentication Policy

| Πεδίο | Τιμή |
|-------|------|
| Μηχανισμός | 4-digit PIN re-entry |
| Elevated session duration | 10 λεπτά |
| Storage | `AuthSession.elevatedUntil` (timestamp in DB) |
| Max attempts before lockout | 3 consecutive failures → 5-minute cooldown |
| Applies to | Κάθε action marked 🔒 στο RBAC matrix |
| GM override | Τα critical GM actions απαιτούν **fresh** step-up (δεν χρησιμοποιούν existing elevated window) |
| Audit | Κάθε step-up attempt (success/failure) logged στο SecurityEvent |

### 10.4 Confirmation Policy

| Confirm Type | Μηχανισμός | Χρήση |
|-------------|-----------|-------|
| Standard confirmation | Modal dialog με "Confirm" / "Cancel" | Destructive actions, publishes |
| Explicit confirmation | Modal dialog + τίτλο ενέργειας displayed, πρέπει να πατηθεί "Confirm {action}" | Role changes, suspensions |
| Dual confirmation | Modal + type specific text (π.χ. workspace name ή "CONFIRM EMERGENCY") | Emergency actions, system-wide |
| Count confirmation | Modal + εμφάνιση number of affected items | Bulk operations |

### 10.5 Retention Policy Recommendations

| Τύπος Log | Default Retention | Configurable Range | Notes |
|-----------|-------------------|--------------------|----|
| AuditLog (info) | 30 ημέρες | 7–90 ημέρες | Routine operations |
| AuditLog (warning) | 90 ημέρες | 30–365 ημέρες | Anomalies |
| AuditLog (high) | 365 ημέρες | 180–730 ημέρες | Significant changes |
| AuditLog (critical) | Indefinite | Not configurable | Immutable |
| SecurityEvent (all) | 365 ημέρες | 90–indefinite | Security trail |
| SecurityEvent (critical) | Indefinite | Not configurable | Immutable |

### 10.6 Privacy Boundaries

| Actor | AuditLog Access | SecurityEvent Access |
|-------|----------------|---------------------|
| GM | All workspaces, all severities, full detail | All events, full detail |
| CO | Own workspace(s), all severities, full detail | Own workspace members only, limited detail (no IP/device for non-own events) |
| AU | Own workspace(s), business only (no security events), full detail (except PII redaction for non-own) | ❌ No access |
| SU | ❌ No access | ❌ No access |
| EM, WA, FA, OA | ❌ No access | Own security events only (own login history) |

---

## 11. Feature Access & Rollout Policy

### 11.1 Feature Access Model

| Layer | Mechanism | Priority (highest → lowest) |
|-------|-----------|----------------------------|
| 1. Environment flag | Env var (NEXT_PUBLIC_FEATURE_*) | Highest — αν disabled, feature hidden globally |
| 2. Global admin override | GM toggle in system settings | Overrides per-workspace |
| 3. Per-workspace toggle | CO toggle in workspace settings | Overrides per-role |
| 4. Per-role default | RBAC matrix domain access | Default applies |
| 5. Per-user override | GM/CO toggle on specific user | Most specific |

**Resolution logic:**

```
if env_flag disabled → HIDDEN (no UI, no API)
if global_override exists → apply (enabled/disabled)
if workspace_toggle exists → apply
if user_override exists → apply
else → apply role default from RBAC matrix
```

### 11.2 Feature States

| State | UI Behavior | API Behavior | Description |
|-------|------------|-------------|-------------|
| `hidden` | Δεν εμφανίζεται στο navigation ή UI | 404 response | Feature δεν υπάρχει για τον user |
| `disabled` | Visible στο navigation αλλά greyed out, tooltip explains | 403 response | Feature υπάρχει αλλά δεν είναι accessible |
| `read_only` | Visible, data shown, mutation controls disabled | GET allowed, POST/PUT/DELETE → 403 | Feature σε preview mode |
| `enabled` | Πλήρως functional | Full access | Normal operation |

### 11.3 Per-Role Module Access Defaults

| Module | GM | CO | SU | EM | WA | FA | OA | AU |
|--------|----|----|----|----|----|----|----|----|
| Home/Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Governance Dashboard | ✅ | ✅ | hidden | hidden | hidden | hidden | hidden | read_only |
| Chat | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | read_only |
| Shifts | ✅ | ✅ | ✅ | read_only | read_only(own) | read_only(own) | ✅ | read_only |
| Fleet | ✅ | ✅ | ✅ | ✅ | read_only(assigned) | ✅ | ✅ | read_only |
| Washers | ✅ | ✅ | ✅ | hidden | ✅ | hidden | read_only | read_only |
| Calendar | ✅ | ✅ | ✅ | read_only | read_only | read_only | ✅ | read_only |
| Data | ✅ | ✅ | read_only | read_only | hidden | read_only | ✅ | read_only |
| Analytics | ✅ | ✅ | ✅(team) | hidden | hidden | ✅(fleet) | ✅ | ✅ |
| Reports | ✅ | ✅ | ✅(team) | hidden | hidden | ✅(fleet) | ✅ | ✅ |
| AI Assistant | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | read_only |
| Automations | ✅ | ✅ | hidden | hidden | hidden | hidden | ✅ | read_only |
| Notifications | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Settings (own) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin Panel | ✅ | ✅ | hidden | hidden | hidden | hidden | hidden | hidden |
| Activity Feed | ✅ | ✅ | ✅ | ✅(own) | ✅(own) | ✅(own) | ✅ | ✅ |
| Controls Playground | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | hidden |

### 11.4 Feature Rollout Strategy

| Phase | Scope | Approach |
|-------|-------|----------|
| Phase 1 (Dev) | Development environment | All features enabled, env flags |
| Phase 2 (Preview) | Preview/staging + selected workspaces | Per-workspace toggles for beta features |
| Phase 3 (Staged) | Production, role-by-role | Enable per-role, monitor, expand |
| Phase 4 (GA) | Production, all | Feature flag removed, becomes permanent |

### 11.5 Behavior on Access Revocation During Active Use

| Σενάριο | Συμπεριφορά |
|---------|-------------|
| Feature disabled while user is viewing it | Στο επόμενο navigation/request: page shows "disabled" state. No data loss. |
| Feature disabled while user has unsaved form data | Client-side: save draft locally (if possible). Show: "Αυτή η λειτουργία δεν είναι πλέον διαθέσιμη." |
| Role changed while user is mid-operation | Current request completes. Next request uses new permissions. |
| Feature flag toggled globally | Takes effect immediately for new requests. Active websocket/SSE connections: push notification to reload. |

---

## 12. Acceptance Criteria για Υλοποίηση

### 12.1 Functional Acceptance Criteria

#### Coordinator Dashboard Governance Actions

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-F01 | CO μπορεί να δει λίστα workspace members με role, status, last active | UI shows complete member list |
| AC-F02 | CO μπορεί να invite νέο member με συγκεκριμένο role | Invite token created, email sent, role correct upon acceptance |
| AC-F03 | CO μπορεί να αλλάξει workspace role ενός member (εκτός GM assignment) | Role updated, permissions take effect immediately |
| AC-F04 | CO μπορεί να suspend member | Member cannot login, sessions revoked |
| AC-F05 | CO μπορεί να reinstate suspended member | Member can login again |
| AC-F06 | CO μπορεί να remove member από workspace | Member loses workspace access |
| AC-F07 | CO μπορεί να delegate temporary permissions | Delegation record created with expiration. Delegatee gains permissions. |
| AC-F08 | CO μπορεί να revoke active delegation | Delegatee loses delegated permissions immediately |
| AC-F09 | CO μπορεί να review workspace audit logs | Logs displayed with actor, action, target, timestamp |
| AC-F10 | CO μπορεί να configure workspace feature flags | Feature states change per workspace |
| AC-F11 | CO μπορεί να simulate permissions for any user in workspace | Simulator returns accurate allow/deny results |
| AC-F12 | CO μπορεί να initiate access review | Review process tracked, overdue alerts generated |

#### Role/Permission Assignment

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-F13 | Re-assigning same role to user is idempotent (no error, audit log still recorded) | No side effects; audit entry created |
| AC-F14 | CO cannot assign GOD_MODE_COORDINATOR role | UI hides option; API returns 403 |
| AC-F15 | Role change takes effect on next request (no stale cache) | Immediate enforcement verified |
| AC-F16 | All role changes require step-up auth | Step-up PIN prompt appears |

#### Feature Restrictions

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-F17 | Features disabled at env level are completely hidden (no UI, API returns 404) | Route and navigation hidden |
| AC-F18 | Features disabled per-workspace show "disabled" state with tooltip | UI greyed out, tooltip displayed |
| AC-F19 | Features in read_only mode show data but disable mutations | GET works, POST/PUT/DELETE return 403 |
| AC-F20 | Per-user feature overrides are respected over role defaults | Override takes precedence |

#### Delegation

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-F21 | Delegated permissions expire automatically after specified duration | Background job removes expired delegations |
| AC-F22 | Delegation cannot grant wider scope than delegator has | API rejects scope-widening delegation |
| AC-F23 | Delegation cannot include God Mode actions | API rejects GM action delegation |
| AC-F24 | Maximum active delegations enforced per workspace | 11th delegation rejected with error |

#### God Mode Actions and Safeguards

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-F25 | GM can access and manage all workspaces | Cross-workspace navigation and actions work |
| AC-F26 | GM cannot delete immutable audit logs | DELETE operation on audit_logs returns 403/405 |
| AC-F27 | GM cannot create second GOD_MODE_COORDINATOR | API rejects with singleton constraint error |
| AC-F28 | GM emergency session revocation works for all users | All non-GM sessions terminated |
| AC-F29 | GM incident response mode disables non-GM login temporarily | Login attempts return appropriate error |
| AC-F30 | All GM actions logged at critical severity | SecurityEvent records created for every GM mutation |

### 12.2 Security Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-S01 | Default deny: unauthenticated requests to (app) routes redirect to login | HTTP 302 to /login |
| AC-S02 | Default deny: unauthorized API requests return 403 (not 404 for auth failures) | 403 response with actionable error |
| AC-S03 | All high-risk actions produce audit log entries with actor, target, timestamp, IP | AuditLog and/or SecurityEvent records verified |
| AC-S04 | Step-up authentication enforced for all 🔒-marked actions | PIN prompt required; action blocked without valid step-up |
| AC-S05 | PIN stored as bcrypt hash (cost ≥ 12), never in plaintext | DB inspection confirms hash format |
| AC-S06 | Failed step-up attempts logged and rate-limited (3 failures → 5-min cooldown) | SecurityEvent + lockout behavior verified |
| AC-S07 | GM session TTL is 8 hours (not 14 days) | Session expires after 8 hours |
| AC-S08 | GM idle timeout is 15 minutes | Session becomes inactive after 15 min |
| AC-S09 | GM max concurrent sessions is 2 | 3rd session rejected or oldest revoked |
| AC-S10 | Audit log DELETE/UPDATE operations blocked at application layer | No API endpoint allows audit mutation |

### 12.3 UX Behavior Acceptance Criteria (Non-Visual)

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-U01 | Permission denied shows actionable message: "Δεν έχετε πρόσβαση σε {action}. Επικοινωνήστε με τον Coordinator." | Error message rendered in UI |
| AC-U02 | No silent failures — every denied action produces visible feedback | No 403 responses without UI notification |
| AC-U03 | Step-up auth prompt provides clear instructions | PIN dialog with "Εισάγετε PIN για επιβεβαίωση" |
| AC-U04 | Consistent denial behavior across all modules (same error format, same UX pattern) | Cross-module verification |
| AC-U05 | Features hidden from navigation do not show empty pages if URL accessed directly | 404 page for hidden features |
| AC-U06 | Disabled features show clear explanation why unavailable | Tooltip or inline message |
| AC-U07 | Confirmation dialogs clearly state what will happen and cannot be accidentally triggered | Dialog text matches action, requires explicit click |

### 12.4 Migration/Rollout Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-M01 | Bootstrap users (ManosPs, KonnaTz) seeded idempotently — re-running seed does not duplicate or error | Seed script runs multiple times without side effects |
| AC-M02 | ManosPs seeded with GlobalRole.GOD_MODE | DB record verified |
| AC-M03 | KonnaTz seeded with appropriate COORDINATOR role | DB record verified |
| AC-M04 | Legacy users with GlobalRole.ADMIN mapped to appropriate new role | Migration script handles existing users |
| AC-M05 | Legacy WorkspaceRole.ADMIN users mapped to COORDINATOR | Migration verified |
| AC-M06 | Legacy WorkspaceRole.EDITOR users mapped to OPS_AGENT | Migration verified |
| AC-M07 | Legacy WorkspaceRole.VIEWER users mapped to AUDITOR | Migration verified |
| AC-M08 | EMPLOYEE and WASHER roles remain unchanged | No migration impact |
| AC-M09 | Missing role/permission data triggers safe fallback (deny all + error message) | Tested with corrupted/missing data |
| AC-M10 | Permission matrix versioning: matrix version stored in system settings | Version queryable via API |

---

## 13. Test Contract

### 13.1 Unit Tests

| Test ID | Κατηγορία | Περιγραφή | Priority |
|---------|-----------|-----------|----------|
| T-U01 | RBAC | `hasPermission(role, domain, action)` returns correct boolean for every cell in RBAC matrix | P0 |
| T-U02 | RBAC | `hasPermission` returns `false` for unknown domain/action | P0 |
| T-U03 | RBAC | `hasPermission` returns `false` for null/undefined role | P0 |
| T-U04 | RBAC | Scope qualifier correctly applied (own vs team vs station vs all) | P0 |
| T-U05 | Delegation | Active delegation grants additional permission | P0 |
| T-U06 | Delegation | Expired delegation does not grant permission | P0 |
| T-U07 | Delegation | Delegation cannot exceed delegator's scope | P0 |
| T-U08 | Delegation | Delegation cannot include BLOCKED actions | P0 |
| T-U09 | Roles | Role assignment is idempotent (re-assign same role = no error) | P1 |
| T-U10 | Roles | Cannot assign GOD_MODE to non-bootstrap user via application logic | P0 |
| T-U11 | Conflict | Deny override wins over allow in permission evaluation | P0 |
| T-U12 | Conflict | Per-user override takes precedence over role default | P1 |
| T-U13 | Feature | Feature flag evaluation follows priority chain (env → global → ws → role → user) | P0 |
| T-U14 | Feature | Disabled feature returns correct state (hidden/disabled/read_only) | P1 |
| T-U15 | Fallback | Missing permission data returns deny | P0 |

### 13.2 Integration Tests

| Test ID | Κατηγορία | Περιγραφή | Priority |
|---------|-----------|-----------|----------|
| T-I01 | Auth+RBAC | Login as EMPLOYEE → try admin action → 403 | P0 |
| T-I02 | Auth+RBAC | Login as CO → assign role to member → member permissions update | P0 |
| T-I03 | Auth+RBAC | Login as CO → attempt GOD_MODE assignment → 403 | P0 |
| T-I04 | Auth+RBAC | Login as GM → override permission → override active | P0 |
| T-I05 | Step-up | Action requiring step-up → no elevated session → step-up prompt | P0 |
| T-I06 | Step-up | Step-up PIN correct → elevated session created → action succeeds | P0 |
| T-I07 | Step-up | Step-up PIN wrong 3 times → cooldown enforced | P0 |
| T-I08 | Delegation | CO creates delegation → delegatee can perform action → delegation expires → delegatee cannot | P0 |
| T-I09 | Delegation | CO revokes delegation → delegatee immediately loses permission | P1 |
| T-I10 | Audit | Role change → AuditLog + SecurityEvent entries created with correct fields | P0 |
| T-I11 | Audit | GM action → SecurityEvent with severity=critical created | P0 |
| T-I12 | Audit | Attempt to DELETE audit log → 403/405 | P0 |
| T-I13 | Session | Role changed → next request uses new permissions (no stale cache) | P0 |
| T-I14 | Feature | Feature flag disabled → page returns hidden state | P0 |
| T-I15 | Feature | Per-workspace toggle overrides global default | P1 |
| T-I16 | User mgmt | CO suspends user → user sessions revoked → user cannot login | P0 |
| T-I17 | User mgmt | CO reinstates user → user can login again | P1 |
| T-I18 | Multi-ws | User with different roles in 2 workspaces → correct permissions per workspace | P1 |
| T-I19 | GM session | GM session expires after 8 hours (not 14 days) | P1 |
| T-I20 | GM session | GM max 2 concurrent sessions enforced | P1 |

### 13.3 End-to-End (E2E) Tests

| Test ID | Κατηγορία | Περιγραφή | Priority |
|---------|-----------|-----------|----------|
| T-E01 | Governance | CO logs in → opens Governance Dashboard → sees member list | P0 |
| T-E02 | Governance | CO invites member → member accepts → member visible in dashboard | P0 |
| T-E03 | Governance | CO changes member role → member sees updated permissions | P0 |
| T-E04 | Governance | CO suspends member → member's next action is denied | P0 |
| T-E05 | Governance | CO delegates approval right → delegatee approves → delegation expires → delegatee denied | P0 |
| T-E06 | RBAC | EMPLOYEE navigates to admin URL → sees 404 or access denied | P0 |
| T-E07 | RBAC | WASHER creates wash task → sees own tasks → cannot create shift | P0 |
| T-E08 | RBAC | FLEET_AGENT manages vehicles → cannot access admin | P1 |
| T-E09 | GM | GM logs in → performs emergency session revocation → all other users logged out | P0 |
| T-E10 | GM | GM enables incident response mode → non-GM users cannot login | P1 |
| T-E11 | AI | User creates AI suggestion → CO approves → suggestion applied to data | P1 |
| T-E12 | AI | EMPLOYEE tries to approve AI suggestion → denied | P1 |
| T-E13 | Feature | CO disables feature for workspace → users see disabled state | P1 |
| T-E14 | Responsive | CO performs governance action on mobile (bottom nav) → action succeeds | P2 |
| T-E15 | Audit | After role change, audit log entry visible in Governance Dashboard | P0 |

### 13.4 Security-Specific Tests

| Test ID | Κατηγορία | Περιγραφή | Priority |
|---------|-----------|-----------|----------|
| T-S01 | Auth | Cross-origin POST to mutation endpoint → rejected | P0 |
| T-S02 | Auth | Expired session cookie → redirect to login | P0 |
| T-S03 | Auth | Tampered session cookie → rejected | P0 |
| T-S04 | RBAC | Direct API call with valid session but insufficient role → 403 | P0 |
| T-S05 | RBAC | Privilege escalation attempt (user modifies own role via API) → 403 | P0 |
| T-S06 | GM | Non-GM user attempts emergency access action → 403 | P0 |
| T-S07 | Audit | No code path allows audit log deletion at application layer | P0 |
| T-S08 | Delegation | Delegation request for domain not in delegator's scope → rejected | P0 |

---

## 14. Ανοιχτά Σημεία / Assumptions / Προτεινόμενες Αποφάσεις

### 14.1 Assumptions (Παραδοχές)

| # | Assumption | Impact αν λάθος |
|---|-----------|-----------------|
| A-01 | Η πλατφόρμα λειτουργεί ως single-tenant per deployment (ένα org, πολλαπλά workspaces/stations) | Αν multi-tenant, χρειάζεται org-level isolation |
| A-02 | Ο ManosPs είναι ο μοναδικός GOD_MODE_COORDINATOR (singleton) | Αν απαιτηθεί δεύτερος, πρέπει να αλλάξει ο singleton constraint |
| A-03 | Η KonnaTz θα λειτουργεί ως COORDINATOR σε ένα ή λίγα workspaces (όχι global CO) | Αν απαιτείται global, χρειάζεται COORDINATOR_GLOBAL distinction |
| A-04 | Δεν υπάρχει ανάγκη για team-based ομαδοποίηση πέραν του workspace | Αν χρειαστοί, team model πρέπει να σχεδιαστεί |
| A-05 | Ο αριθμός χρηστών ανά workspace είναι μικρός (< 100) | Αν μεγαλύτερος, pagination + performance optimization χρειάζεται |
| A-06 | Feature flags δεν χρειάζονται percentage-based rollout (A/B testing) | Αν χρειαστεί, external feature flag service recommended |
| A-07 | Ο SUPERVISOR ρόλος θα χρησιμοποιηθεί (δεν είναι dormant) | Αν dormant, μπορεί να αφαιρεθεί |
| A-08 | Voice input (washer workflow) δεν απαιτεί ξεχωριστό permission πέραν του `washers.create/edit` | Αν χρειαστεί, voice-specific permission |

### 14.2 Ανοιχτά Σημεία προς Απόφαση

| # | Θέμα | Εναλλακτικές | Πρόταση | Σημειώσεις |
|---|------|-------------|---------|------------|
| O-01 | Πρέπει ο COORDINATOR_GLOBAL να είναι ξεχωριστό GlobalRole ή να ορίζεται ως multi-workspace membership; | (a) Νέο GlobalRole. (b) Πολλαπλά workspace memberships ως COORDINATOR. | Option (b) — πιο ευέλικτο, λιγότερα DB changes | Εξαρτάται από ops model |
| O-02 | Πρέπει ο OPS_AGENT να αντικαταστήσει τελείως τον EDITOR ή να συνυπάρξουν; | (a) Replace. (b) Coexist. | Option (a) — clean migration, no confusion | Αν υπάρχουν users που χρειάζονται EDITOR semantics ≠ OPS_AGENT |
| O-03 | Custom Role Templates: MVP ή phase 2; | (a) Include in v1. (b) Phase 2 with interim manual permissions. | Option (b) — complexity risk if rushed | Templates χρειάζονται Permission model στη βάση |
| O-04 | Permission Simulator: built-in ή developer-only tool; | (a) Built into Governance Dashboard. (b) CLI/API-only tool. | Option (a) — essential for CO self-service | Worth the investment for governance UX |
| O-05 | Dual confirmation for GM: mandatory ή recommended; | (a) Mandatory. (b) Recommended, optional per deployment. | Option (b) for MVP, (a) long-term | Dual confirmation adds UX friction |
| O-06 | Soft-delete vs hard-delete for user removal; | (a) Soft delete (30-day recovery). (b) Hard delete. | Option (a) — safer, compliance-friendly | Retention policy must be defined |
| O-07 | Email OTP for GM new-device login: mandatory ή recommended; | (a) Mandatory. (b) Recommended enhancement. | Option (b) for MVP, (a) post-MVP | Requires email infrastructure |
| O-08 | Access review automation: auto-block overdue reviews ή alert-only; | (a) Auto-block after X days. (b) Alert-only. | Option (b) — less disruptive | Risk: reviews never completed |
| O-09 | Migration strategy: big-bang role rename ή gradual with feature flag; | (a) Big-bang migration. (b) Gradual with backward compat. | Option (b) — safer rollout | Requires dual-role support temporarily |
| O-10 | Νέα DB models (DelegationRecord, FeatureFlagOverride, etc.): ξεχωριστό migration ή bundled; | (a) Separate migrations per model. (b) Single migration. | Option (a) — easier rollback | Standard practice |

### 14.3 Προτεινόμενη Σειρά Υλοποίησης

| Phase | Scope | Estimated Effort |
|-------|-------|-----------------|
| Phase 1 | GlobalRole enum expansion (GOD_MODE). Prisma schema. Bootstrap seed. | 2–3 days |
| Phase 2 | WorkspaceRole enum expansion (COORDINATOR, SUPERVISOR, FLEET_AGENT, OPS_AGENT, AUDITOR migration from EDITOR/VIEWER). Permission matrix rewrite in rbac.ts. | 3–5 days |
| Phase 3 | Centralized middleware.ts enforcement. Remove dual auth patterns. | 2–3 days |
| Phase 4 | Governance Dashboard (CO): user list, invite, role change, suspend/reinstate, audit view. | 5–8 days |
| Phase 5 | Step-up auth improvements. Confirmation dialogs. Audit log expansion (severity levels). | 3–4 days |
| Phase 6 | God Mode safeguards (session policy, singleton, blocked actions, emergency procedures). | 3–4 days |
| Phase 7 | Delegation model (DB model, CRUD, background expiration job). | 3–5 days |
| Phase 8 | Feature flag expansion (DB model, per-workspace/per-user toggles, UI). | 3–4 days |
| Phase 9 | Permission simulator. Access review process. | 3–4 days |
| Phase 10 | Full test suite (unit + integration + E2E tests per test contract). | 5–8 days |

**Συνολικός εκτιμώμενος χρόνος:** 32–48 εργάσιμες ημέρες (ένας senior developer, full-time).

---

*Τέλος εγγράφου. Αυτή η προδιαγραφή αποτελεί policy contract και πρέπει να εγκριθεί πριν ξεκινήσει η υλοποίηση. Κάθε αλλαγή στο document πρέπει να γίνεται με version control και review.*
