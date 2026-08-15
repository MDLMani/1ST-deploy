# TVK Full Flow & Page Charts

Generated from USER / ADMIN `go_router` and TVKSSBE `/api/v1`.

## System overview

```mermaid
flowchart LR
  USER["USER App\nrole: user"]
  API["TVKSSBE\n/api/v1"]
  ADMIN["ADMIN App\nadmin | supportAgent"]
  DB[(MongoDB)]
  USER -->|JWT| API
  ADMIN -->|JWT| API
  API --> DB
```

| Journey | USER | Backend | ADMIN |
|---------|------|---------|-------|
| Auth | Login / Register / Forgot | JWT + reset OTP | Staff login / register |
| Raise complaint | Submit wizard → My complaints | POST /tickets → OPEN | Tickets board |
| Track & update | Live updates + detail | Comments / status / SLA | Assign, status, merge |
| Assistant | FAB chat → draft ticket | POST /assistant/chat | FAB staff assistant |
| Ops config | — | Departments, SLA, rules | Operations hub + drawer |

---

## USER page flow

```mermaid
flowchart TB
  splash["Splash /"]
  login["Login /login"]
  register["Register /register"]
  forgot["Forgot /forgot-password"]
  home["Home tab0"]
  submit["Raise /submit-ticket"]
  live["Complaints /live-updates"]
  account["Account /account"]
  assistant["Assistant push"]
  notif["Notifications push"]
  detail["Ticket detail /tickets/:id"]

  splash -->|guest| login
  splash -->|user| home
  login --> register
  login --> forgot
  login --> home
  register --> home
  forgot --> login
  home --> submit
  home --> live
  home --> assistant
  home --> notif
  home --> account
  submit -->|raised| live
  live --> detail
  live --> submit
  assistant -->|fromChat| submit
  assistant --> detail
  account --> live
  account --> notif
  account -->|logout| login
```

### Raise complaint wizard

```mermaid
flowchart LR
  gate["Entry gate\nnew / draft"] --> cat[Category]
  cat --> desc[Describe]
  desc --> det[Details]
  det --> rev[Review]
  rev --> done["Live updates\n?raised=1"]
```

`fromChat=1` skips the entry gate and opens at Describe (`step=1`).

### USER routes

| Path | Page | Auth |
|------|------|------|
| `/` | Splash | hydrate |
| `/login` | Login | guest |
| `/register` | Register | guest |
| `/forgot-password` | Forgot | guest |
| `/home` | Home | user |
| `/submit-ticket` | Raise | user |
| `/live-updates` | Complaints | user |
| `/tickets/:id` | Detail | user |
| `/account` | Account | user |
| `/assistant` | Assistant | user |
| `/notifications` | Notifications | user |

**Shell tabs:** Home · Raise · Complaints · Account

---

## ADMIN page flow

```mermaid
flowchart TB
  splash["Splash /"]
  login["Login /login"]
  register["Register /register"]
  forgot["Forgot /forgot-password"]
  dash["Dashboard tab0"]
  tickets["Tickets /tickets"]
  mgmt["Operations /management"]
  more["More /more"]
  detail["Ticket detail no shell"]
  users["Users /users"]
  settings["Settings /settings"]
  notif["Notifications"]
  assistant["Assistant FAB"]
  depts["Departments"]
  sla["SLA / rules"]

  splash -->|guest| login
  splash -->|staff| dash
  login --> register
  login --> forgot
  login --> dash
  register --> dash
  forgot --> login
  dash --> tickets
  dash --> mgmt
  dash --> more
  dash --> assistant
  dash --> notif
  tickets --> detail
  mgmt --> depts
  mgmt --> sla
  more --> users
  more --> settings
  more --> notif
  notif --> detail
  settings -->|logout| login
```

### Operations children

Departments · Tags · Knowledge base · Escalation · SLA · Auto-assignment · CSAT

### ADMIN routes (selected)

| Path | Notes |
|------|-------|
| `/dashboard` | Stats / charts hub |
| `/tickets` | List + filters |
| `/tickets?overdue=1` | Overdue filter |
| `/overdue` | Redirect → overdue query |
| `/management/*` | Ops CRUD screens |
| `/tickets/:id` | Standalone detail |
| `/users` | Invite + status analysis |

**Shell tabs:** Dashboard · Tickets · Operations · More  
**RBAC:** Router = staff only; Assign UI = admin only

---

## Ticket lifecycle

```mermaid
flowchart TB
  create[Create citizen] --> open[OPEN]
  open -->|assign| progress[IN_PROGRESS]
  open --> pending[PENDING]
  progress --> pending
  pending -->|resume| progress
  progress --> resolved[RESOLVED]
  pending --> resolved
  resolved --> closed[CLOSED]
  open --> merged[MERGED]
  progress --> merged
```

### Citizen path
1. Raise wizard or Assistant handoff  
2. `POST /tickets` → OPEN (+ auto-assign try)  
3. Track on `/live-updates` + detail comments  
4. Optional CSAT after resolution  

### Staff path
1. Board / dashboard → ticket detail  
2. Assign (admin) forces IN_PROGRESS  
3. Status, notes, merge, SLA / escalation  
4. Resolve / close; citizen sees update  

### API domains

| Domain | Mount | Consumers |
|--------|-------|-----------|
| Auth | `/auth` | USER + ADMIN |
| Tickets | `/tickets` | USER + ADMIN |
| Assistant | `/assistant` | USER + ADMIN |
| Departments | `/departments` | USER read · ADMIN CRUD |
| User management | `/user-management` | ADMIN |
| Locations / SLA / rules | ops mounts | ADMIN |
| Notifications / push | `/notifications` · `/push` | both |
