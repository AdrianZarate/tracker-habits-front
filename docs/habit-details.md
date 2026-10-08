# Habit detail

Direct links and reloads fetch `GET /habits/:habitId` via `getHabitById`.
The owner-scoped `{ habitId, title, slug, active }` reply is authoritative;
navigation state is ignored. Missing and non-owned habits show the same 404 view.
Only after ownership succeeds does `getHabitLogs` fetch history with no date
parameters: the API defaults to the current account-local calendar month.

History uses immutable calendar labels and UTC-safe display helpers. Only the
account's current day is editable; inactive habits retain history and status but
have no completion, undo or deactivation controls. Successful deactivation still
returns to the dashboard. Failed mutations retain the view and allow another try.
Detail/history failures show a generic retry action; pending or failed history
never exposes old logs or enables completion based on unknown history.

Route, session identity/token, zone and day changes reset the view before paint.
Unmount/retry cancels reads; late read and mutation replies cannot update a new
view or refill completion cache. Account midnight refreshes default-month history.
Ordinary renders do not refetch. Existing Axios 401 session cleanup is unchanged.
`getHabitLogs(id, params?, signal?)` preserves existing caller signatures.

## Verification limits

Browser regressions use fixed clocks, a western device/account zone and synthetic
API fulfillment, including every write; unexpected external requests are blocked.
No real Google, Mongo or API integration is claimed. History is only the current
month, with no rolling window, filters or new historical editing features.
