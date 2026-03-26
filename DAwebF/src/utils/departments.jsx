/** Normalize /api/departments response (strings or DADB department docs). */
export function normalizeDepartmentList(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((d) => {
      if (typeof d === "string") return { id: d, label: d };
      const id = d.department_code || d._id || d.department_name;
      if (!id) return null;
      return { id: String(id), label: d.department_name ? String(d.department_name) : String(id) };
    })
    .filter(Boolean);
}
