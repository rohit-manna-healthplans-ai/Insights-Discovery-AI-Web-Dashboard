import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginApi, meApi } from "../../features/auth/auth.api";

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("token") || "";
    } catch {
      return "";
    }
  });

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  async function login(email, password) {
    const data = await loginApi({ email, password });
    const t = data?.token || data?.access_token;
    if (!t) throw new Error("Token missing from login response");

    localStorage.setItem("token", t);
    setToken(t);

    if (data?.profile) setMe(data.profile);
    return t;
  }

  function logout() {
    try {
      localStorage.removeItem("token");
    } catch (_) {}
    setToken("");
    setMe(null);
  }

  useEffect(() => {
    let alive = true;

    async function loadMe() {
      setLoading(true);
      try {
        if (!token) {
          if (alive) setMe(null);
          return;
        }
        const profile = await meApi();
        if (alive) setMe(profile || null);
      } catch (_) {
        try {
          localStorage.removeItem("token");
        } catch (_) {}
        if (alive) {
          setToken("");
          setMe(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadMe();
    return () => { alive = false; };
  }, [token]);

  const value = useMemo(() => ({ token, me, loading, login, logout }), [token, me, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
