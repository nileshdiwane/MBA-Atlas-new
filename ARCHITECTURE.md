# MBA Atlas architecture

## Product model

A single-user demonstration LMS with a real SQLite database, REST-style JSON API and responsive browser client. The seeded learner is intentionally fictional. Every state-changing flow writes to `data/mba-atlas.db`.

## Academic progression

1. Foundation: diagnostics, accounting primer, statistics, spreadsheet modelling and case-method orientation.
2. Year 1 / Core A: accounting, finance, leadership, marketing, operations and strategy.
3. Year 1 / Core B: economics, data and AI, entrepreneurship, finance II, ethics and the purpose of the firm.
4. Summer practice: internship goals, weekly logs, manager feedback and a final impact memo.
5. Year 2 / Electives: a selected pathway plus free electives.
6. Integrative capstone: board-level recommendation, model, oral defence and final reflection.
7. Graduation audit: credits, core completion, elective depth, internship, capstone, academic standing and integrity attestation.

## Data model

- `students`, `terms`, `courses`, `enrollments`, `modules`
- `assignments`, `submissions`, `grade_items`
- `cases`, `case_preparations`, `readings`
- `calendar_events`, `study_groups`, `study_group_members`
- `professor_messages`, `competency_evidence`
- `internships`, `internship_logs`
- `requirements`, `source_registry`

## Learning engine

Seven domain professors share a Socratic interaction contract but use different concepts and rubrics. Each response is evaluated for:

- decision clarity;
- evidence and quantitative support;
- explicit assumptions;
- alternatives and trade-offs;
- implementation and risk;
- stakeholder and ethical implications.

The built-in engine works offline, persists the dialogue, assigns a formative score and selects a follow-up question. If `OPENAI_API_KEY` is present, the server may call an external model through a bounded prompt that excludes licensed case text. The local engine remains the fallback.

## API surface

- Read: `/api/bootstrap`, `/api/dashboard`, `/api/courses`, `/api/courses/:id`, `/api/cases`, `/api/readings`, `/api/calendar`, `/api/transcript`, `/api/requirements`, `/api/professors`, `/api/professor/history`
- Write: `/api/enroll`, `/api/submissions`, `/api/case-prep`, `/api/participation`, `/api/professor/chat`, `/api/internship`, `/api/internship/log`, `/api/profile`

## Security and deployment notes

This is a local reference implementation, not a production identity platform. Before public deployment, add SSO, authorization, CSRF protection, rate limiting, encrypted secrets, database migrations, backups, accessibility testing, audit logs and institution-specific privacy controls.