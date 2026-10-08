// Remove only this application's profile and dated completion keys.
export function clearSession(): void {
  for (const key of Object.keys(localStorage)) {
    if (['token', 'fullName', 'email', 'picture', 'timeZone'].includes(key) || /^completedHabits_\d{4}-\d{2}-\d{2}$/.test(key)) {
      localStorage.removeItem(key);
    }
  }
}
