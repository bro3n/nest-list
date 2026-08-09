export interface AuthUser {
  id: string;
  email: string;
}

// Auth state mirrors the server session cookie. `ready` flips to true once the
// initial /api/auth/me hydration has run (see plugins/auth.client.ts).
export const useAuth = () => {
  const user = useState<AuthUser | null>("auth:user", () => null);
  const ready = useState<boolean>("auth:ready", () => false);

  const fetchMe = async (): Promise<void> => {
    try {
      const { user: me } = await $fetch<{ user: AuthUser }>("/api/auth/me");
      user.value = me;
    } catch {
      user.value = null;
    } finally {
      ready.value = true;
    }
  };

  const requestCode = (email: string) =>
    $fetch("/api/auth/request-code", { method: "POST", body: { email } });

  const verify = async (email: string, code: string): Promise<void> => {
    const { user: me } = await $fetch<{ user: AuthUser }>("/api/auth/verify", {
      method: "POST",
      body: { email, code },
    });
    user.value = me;
  };

  const logout = async (): Promise<void> => {
    await $fetch("/api/auth/logout", { method: "POST" });
    user.value = null;
  };

  return {
    user,
    ready,
    isAuthenticated: computed(() => !!user.value),
    fetchMe,
    requestCode,
    verify,
    logout,
  };
};
