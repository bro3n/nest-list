// Background poll: keep pending invitations fresh (new / accepted / declined) so
// the header badge and the invitations page update live. Only while authenticated
// and the tab is visible; also refreshes immediately when the tab regains focus.
export default defineNuxtPlugin(() => {
  const { isAuthenticated } = useAuth();
  const invitations = useInvitations();

  const tick = () => {
    if (isAuthenticated.value && !document.hidden) invitations.load(true);
  };

  setInterval(tick, 10000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tick();
  });
});
