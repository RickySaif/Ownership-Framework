# Session notes: request dates (run 20261025-0006-nightly)

Expected values worked out by hand first (calendar for March/April 2030):

| Range | Working days (hand) | App said | |
|---|---|---|---|
| Fri 8 → Mon 11 Mar | 2 | 4 | **AL-2** |
| Mon 1 → Fri 5 Apr | 5 | 5 | ✓ |
| Fri 15 → Wed 13 Mar (reversed) | refuse (R3) | saved, -1 days | **AL-3** |
| 3 Jun → 26 Jul (54 calendar days) | refuse, over balance (R7) | 400 ✓ | |
| 30 Dec 2030 → 2 Jan 2031 | refuse (R9) | 400 ✓ | |

AL-2 and AL-3 confirmed two ways (response body + stored `days` column).

**Not reached:** a request of only Saturday + Sunday (0 working days, R3 says refuse). Depends on the AL-2 fix.
