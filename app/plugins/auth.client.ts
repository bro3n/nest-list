// Boots the session and the user's data:
// 1. hydrate auth from the cookie before the first route middleware runs;
// 2. block on the initial lists/colors load so the editor finds its list on a
//    hard refresh;
// 3. reload on later logins and clear everything on logout.
export default defineNuxtPlugin(async () => {
  const { fetchMe, isAuthenticated } = useAuth();
  const lists = useLists();
  const colors = useTagColors();
  const trash = useDeletedItems();
  const invitations = useInvitations();

  // One-time cleanup of the previous localStorage persistence (now in D1).
  if (import.meta.client) {
    localStorage.removeItem("nest-list:lists");
    localStorage.removeItem("nest-list:deleted");
    localStorage.removeItem("nest-list:tag-colors");
  }

  await fetchMe();
  if (isAuthenticated.value) await Promise.all([lists.load(), colors.load(), invitations.load()]);

  watch(isAuthenticated, async (authed) => {
    if (authed) {
      await Promise.all([lists.load(), colors.load(), invitations.load()]);
    } else {
      lists.reset();
      colors.reset();
      trash.reset();
      invitations.reset();
    }
  });
});
