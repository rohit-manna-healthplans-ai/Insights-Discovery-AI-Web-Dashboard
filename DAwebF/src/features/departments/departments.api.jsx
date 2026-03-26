import { http } from "../../services/http/client";

function unwrap(res) {
  if (!res?.data) return null;
  if (res.data.ok === false) throw new Error(res.data.error || "Request failed");
  return res.data.data;
}

/** Returns raw department rows (see normalizeDepartmentList). */
export async function listDepartmentsApi() {
  const res = await http.get("/api/departments");
  return unwrap(res) || [];
}

export async function createDepartmentApi(name) {
  const res = await http.post("/api/departments", { name });
  return unwrap(res);
}
