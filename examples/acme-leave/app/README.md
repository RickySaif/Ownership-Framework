# Acme Leave (demo app)

A tiny, **fictional** leave-request app that the Ownership Framework example tests. It has no dependencies:
Node 22.13 or later runs it with the built-in `node:sqlite`.

```sh
node server.mjs --reset        # http://localhost:4310, fresh database
```

Demo users (all fictional, password `acme-demo`):

| E-mail | Role |
|---|---|
| ana@acme.example | manager |
| ben@acme.example | employee |
| cleo@acme.example | employee |

The requirements are in [docs/prd.md](docs/prd.md).

<details>
<summary>Spoiler: the seeded bugs</summary>

The app ships with three bugs on purpose, so the example hub has something to find:

- **AL-1** an employee can approve their own request (`src/leave.mjs`, `approveRequest`), against R4.
- **AL-2** weekends are counted as leave days (`src/leave.mjs`, `countDays`), against R2.
- **AL-3** an end date before the start date is accepted and gives a negative day count (`src/leave.mjs`,
  `createRequest`), against R3.

</details>
