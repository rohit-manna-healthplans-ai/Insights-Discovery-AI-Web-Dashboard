import { http } from "../../services/http/client";

export async function loginApi({ email, password }) {
  const res = await http.post("/api/auth/login", { email, password });
  return res.data?.data;
}

export async function meApi() {
  const res = await http.get("/api/auth/me");
  return res.data?.data;
}

export async function registerApi(payload) {
  const res = await http.post("/api/auth/register", payload);
  return res.data?.data;
}

export async function forgotPasswordApi({ email, new_password }) {
  const res = await http.post("/api/auth/forgot-password", { email, new_password });
  return res.data?.data;
}
