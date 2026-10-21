# Operations

## Backups

| What | How | When |
| --- | --- | --- |
| Database (point in time) | Neon history (Phase 07) | continuous |
| Database (independent copy) | `DATABASE_URL=… scripts/backup.sh backups/` → `.dump` + `.sha256` | daily (scheduled in Phase 07), and before every migration |
| Images | R2 bucket with versioning (Phase 07) | continuous |

## Restore drill (do it every 3 months)

```bash
SOURCE_URL=postgres://…/acronos SCRATCH_URL=postgres://…/acronos_restore_check \
  scripts/restore-check.sh backups/acronos-YYYYMMDDTHHMMSSZ.dump
```

The script:

1. Verifies the checksum.
2. Restores into the scratch database.
3. Compares the row count of every table with the source.

It refuses any target whose name does not contain `restore`, `scratch` or `test`.

| Date | Result |
| --- | --- |
| 2026-10-21 | OK: row counts match (local development database) |

## Routine checks

- **Admin → Orders → Needs attention:** payments that arrived late or with a different amount.
- **Admin → Privacy requests:** answer within 15 days.
- **Admin → Inventory → Low stock.**
- **CI and Dependabot:** review dependency updates weekly.
