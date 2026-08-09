// Hydrate the auth state from the session cookie once, before the first route
// middleware runs, so the guard sees an accurate authenticated state.
export default defineNuxtPlugin(async () => {
  const { fetchMe, ready } = useAuth();
  if (!ready.value) await fetchMe();
});
