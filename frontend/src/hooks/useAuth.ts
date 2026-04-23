import { useState, useEffect } from "react";
import { authApi } from "../api";

export function useAuth() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const t = res.data.access_token;
    localStorage.setItem("token", t);
    setToken(t);
    return t;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  return { token, isAuthenticated: !!token, login, logout };
}
