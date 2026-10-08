# Account days and session boundaries

The dashboard follows the persisted account `timeZone`, not the current device.
Google login alone sends browser detection (UTC on detection failure). Auth replies
are authoritative; missing legacy reply zones use UTC. Check-status never detects
or assigns a browser zone. See the [API contract](../../api/docs/calendar-contract.md).

## Helpers for T4

- `calendarDay(instant, timeZone)` uses Intl Gregorian/Latin parts, matching API labels.
- `calendarLabel(value)` accepts exact valid `YYYY-MM-DD` (0001–9999) or its
  `T00:00:00.000Z` anchor; malformed/impossible dates and non-midnight instants throw.
- `formatCalendarLabel(value, locale?, options?)` always renders in UTC, even if
  options contain another zone. Historical labels must never shift to account/device time.
- `getCompletedToday(zone?)`, `markCompleted(id, zone?)`, `markIncomplete(id, zone?)`
  use account-day cache keys. Omitted zones use stored `timeZone`, then UTC, preserving
  existing detail callers until T4. Invalid cache JSON returns an empty set.

## Refresh and cleanup

`useCalendarDay(zone)` updates asynchronously at the next actual label boundary,
with at most a minute between checks; focus/visible events immediately recheck.
Boundary search handles 23/25-hour DST days without assuming a 24-hour duration.
Only changed day/zone/token primitives refetch dashboard data, not ordinary renders.
Late data/mutation replies cannot repopulate cache after logout or a day change.

`clearSession()` removes token, fullName, email, picture, timeZone and dated
`completedHabits_YYYY-MM-DD` keys only. Logout, failed status validation, successful
new login and non-auth Axios 401 use it. Data 403 and Google endpoint errors do not
trigger interceptor logout. Non-auth 401 retains the existing hard `/login` redirect.

## Verification and limits

`tests/calendar-session.spec.cjs` uses synthetic Google callbacks and fulfilled API
responses; all other external traffic is blocked. It covers stable zone persistence,
UTC fallback, east/west labels, strict display, DST delays, midnight/focus refresh,
cache compatibility/corruption, cleanup, 403 preservation and auth-401 exemption.
Existing seven browser regressions remain unchanged. Detail self-loading/calendar
rendering is deliberately deferred to T4; no real Google/API integration was exercised.
