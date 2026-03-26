/** Default landing path inside /dashboard for each role */
export function defaultDashboardPathForRole(roleKey) {
  const r = String(roleKey || "").toUpperCase();
  if (r === "DEPARTMENT_MEMBER") return "/dashboard/my-activity";
  return "/dashboard/users";
}
