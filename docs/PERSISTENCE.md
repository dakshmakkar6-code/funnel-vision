# FunnelVision – Persistence Strategy

This document outlines a minimal persistence layer for storing funnel audits, steps, elements, and annotations. It is **not implemented** in the current codebase; it is a design for future use.

## Goals

- Store funnel audits so users can revisit them without re-scraping.
- Support multi-step funnels and per-step screenshots/elements.
- Keep annotations (FLOW issues and fixes) tied to specific elements and steps.

## Schema (relational)

### `funnels`

| Column     | Type      | Notes                    |
|------------|-----------|--------------------------|
| id         | PK        | UUID or auto-increment   |
| name       | string    | User-defined or derived  |
| createdAt  | timestamp |                          |
| userId     | FK?       | Optional for multi-tenant |

### `funnel_steps`

| Column        | Type   | Notes                          |
|---------------|--------|--------------------------------|
| id            | PK     |                                |
| funnelId      | FK     | → funnels.id                   |
| url           | string | Page URL                       |
| order         | int    | 0-based step index             |
| screenshotPath| string | Relative path to screenshot    |
| meta          | JSON?  | pageWidth, pageHeight, etc.    |

### `elements`

| Column     | Type   | Notes                          |
|------------|--------|--------------------------------|
| id         | PK     |                                |
| stepId     | FK     | → funnel_steps.id              |
| boxIndex   | int    | Index within step’s elements   |
| type       | string | text, button, image, input, …   |
| text       | string?| Truncated content              |
| styleSummary| JSON? | fontSize, fontWeight, etc.     |
| layout     | JSON?  | x, y, width, height, foldZone   |

### `annotations`

| Column           | Type   | Notes                          |
|------------------|--------|--------------------------------|
| id               | PK     |                                |
| elementId        | FK     | → elements.id (or stepId + boxIndex) |
| stepIndex        | int    | Redundant but useful for queries |
| category         | string | Friction, Legitimacy, Offer Clarity, Willingness |
| issueDescription | text   |                                |
| improvement      | text   | Actionable fix                 |
| exactQuote       | string?|                                |
| createdAt        | timestamp |                              |

## Implementation options

- **SQLite**: Single file, no server; good for desktop or single-user.
- **Postgres**: For multi-user or hosted deployment.
- **ORM**: e.g. Drizzle, Prisma (Node), or SQLAlchemy (Python) to keep schema in code.

## Integration points

- After a successful `/api/audit` + `/api/analyze` run, persist:
  - One row in `funnels`, N rows in `funnel_steps`, M rows in `elements`, and K rows in `annotations`.
- New API routes (e.g. `GET /api/audits`, `GET /api/audits/:id`) can serve saved audits to the frontend.
- Frontend can add an “Audit history” or “Saved funnels” view that loads by `funnelId`.
