// src/utils/dateRange.js

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function formatYMDLocal(d) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

export function defaultRangeLast7Days() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 6);
  return {
    from: formatYMDLocal(from),
    to: formatYMDLocal(to),
  };
}

export function withDefaultRange(params = {}) {
  const p = { ...params };
  if (!p.from || !p.to) {
    const r = defaultRangeLast7Days();
    p.from = p.from || r.from;
    p.to = p.to || r.to;
  }
  return p;
}
