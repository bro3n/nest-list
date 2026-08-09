export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated } = useAuth();
  const isAuthPage = to.path === "/auth";

  if (!isAuthenticated.value && !isAuthPage) {
    return navigateTo({ path: "/auth", query: { redirect: to.fullPath } });
  }
  if (isAuthenticated.value && isAuthPage) {
    return navigateTo("/");
  }
});
