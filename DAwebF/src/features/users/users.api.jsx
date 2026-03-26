import { http } from "../../services/http/client";

function unwrap(res) {
  if (!res?.data) return null;
  if (res.data.ok === false) throw new Error(res.data.error || "Request failed");
  return res.data.data;
}

export async function listUsersApi(params = {}) {
  const res = await http.get("/api/users", { params });
  return unwrap(res) || [];
}

export async function getUserApi(companyUsername) {
  const res = await http.get(`/api/users/${encodeURIComponent(companyUsername)}`);
  return unwrap(res);
}

export async function createUserApi(payload) {
  const res = await http.post("/api/users", payload);
  return unwrap(res);
}

export async function updateUserApi(company_username, payload) {
  const res = await http.patch(`/api/users/${encodeURIComponent(company_username)}`, payload);
  return unwrap(res);
}
