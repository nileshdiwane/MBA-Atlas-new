# MBA Atlas

A database-backed, full-stack MBA learning simulation built from public evidence about top global MBA programmes. It combines a rigorous common core, case preparation, Socratic discussion, study groups, applied assignments, examinations, summer practice, electives, a capstone and a live graduation audit.

> **Independent educational simulation.** MBA Atlas is not affiliated with, endorsed by, or accredited by Harvard University, Stanford University, the University of Pennsylvania, INSEAD, MIT, the University of Chicago, Columbia University or any other school. It does not award a degree or university credit.

## Run it

Requirements: Node.js 22.5+ (Node 24 is recommended because the application uses the built-in SQLite module).

```bash
npm start
# open http://127.0.0.1:4173
```

No package installation is required. The application uses only Node's standard library. On first run it creates and seeds `data/mba-atlas.db`.

### Optional AI provider

The seven professors work immediately through the local Socratic evaluation engine. To enable an external model while retaining the local fallback:

```bash
OPENAI_API_KEY=your_key OPENAI_MODEL=gpt-4.1-mini npm start
```

Licensed external case text is blocked from professor conversations. Only original embedded simulations may be passed as case context.

## What is functional

- Persistent SQLite learner, enrolment, progress, submission, grade and transcript records
- Pre-MBA foundation, two-year common core, internship, electives and capstone structure
- Dashboard, classrooms, catalogue, case library, research library, assessments and calendar
- Original case-preparation workflow: decision, analysis, exhibits, alternative, risks and confidence
- Seven specialized professors with persisted history, formative scoring, feedback, knowledge gaps and follow-up challenges
- Assignment submission and resubmission
- Elective planning
- Internship plans and weekly evidence logs
- Weighted academic record and live graduation audit
- Source registry that separates official school evidence, open supplementary resources and original content

## Test

```bash
npm test
```

The test suite uses a temporary SQLite database and covers database creation, academic audit, professor evaluation and core API routes.

## Reset demo data

```bash
npm run reset
```

This removes the local database. The next start recreates the fictional learner and seed programme.

## Research and legal boundary

See [RESEARCH.md](RESEARCH.md) for the official sources and the precise design inferences. See [ARCHITECTURE.md](ARCHITECTURE.md) for the data model and API.

Harvard Business Publishing materials are not embedded. The product links to the official catalogue and permission policy. Embedded cases, prompts, rubrics and professor personas are original MBA Atlas content.