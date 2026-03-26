import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  MenuItem,
  Typography,
  useMediaQuery,
  CircularProgress,
  IconButton,
  Tooltip,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import ViewModuleRoundedIcon from "@mui/icons-material/ViewModuleRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { useNavigate, useParams } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";

import { useUserSelection } from "../../app/providers/UserSelectionProvider";
import { useAuth } from "../../app/providers/AuthProvider";
import { getUserApi } from "../../features/users/users.api";
import { getLogs, getScreenshots, getScreenshotSasUrl } from "../../services/data.api";
import { extensionUserId } from "../../utils/userIdentity";

/**
 * UserDetail — logs + screenshots.
 * selfMode: department member viewing only their own data.
 */

function ymdLocal(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function defaultLast7() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 6);
  return { from: ymdLocal(from), to: ymdLocal(to) };
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString();
}

function normalizeListResponse(res) {
  // supports:
  // - { items, total, page, limit }
  // - { data: { items, total } }
  // - { data: itemsArray }
  // - itemsArray
  if (!res) return { items: [], total: 0 };
  if (Array.isArray(res)) return { items: res, total: res.length };
  if (Array.isArray(res.items)) return { items: res.items, total: res.total ?? res.items.length };
  if (res.data) {
    if (Array.isArray(res.data)) return { items: res.data, total: res.data.length };
    if (Array.isArray(res.data.items)) return { items: res.data.items, total: res.data.total ?? res.data.items.length };
  }
  return { items: [], total: 0 };
}

function safeText(v) {
  if (v === null || v === undefined) return "—";
  const s = String(v);
  return s.trim() ? s : "—";
}

function fmtDate(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

function fmtTime(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toISOString().slice(11, 19);
  } catch {
    return "—";
  }
}

function hhmmFromTs(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}

function dateFromTs(ts) {
  if (!ts) return "";
  try {
    return ymdLocal(new Date(ts));
  } catch {
    return "";
  }
}

function inTimeRange(hhmm, start, end) {
  if (!hhmm) return false;
  if (!start && !end) return true;
  if (start && end) return hhmm >= start && hhmm <= end;
  if (start) return hhmm >= start;
  return hhmm <= end;
}

function normalizeTime24(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let hh = Number(ampm[1]);
    const mm = Number(ampm[2]);
    const mer = ampm[3].toUpperCase();
    if (Number.isNaN(hh) || Number.isNaN(mm) || mm < 0 || mm > 59 || hh < 1 || hh > 12) return "";
    if (mer === "AM") hh = hh === 12 ? 0 : hh;
    if (mer === "PM") hh = hh === 12 ? 12 : hh + 12;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  const m24 = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (m24) return `${String(Number(m24[1])).padStart(2, "0")}:${m24[2]}`;
  return "";
}

function inDateRange(ymd, from, to) {
  if (!ymd) return false;
  if (!from && !to) return true;
  if (from && to) return ymd >= from && ymd <= to;
  if (from) return ymd >= from;
  return ymd <= to;
}

function logScreenshotId(r) {
  const v = r?.screenshot_id ?? r?.screenshotId;
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

/** screenshot document / log row — id for GET /api/screenshots/:id/sas-url */
function screenshotLookupKey(r) {
  if (!r) return null;
  const a = r.screenshot_id ?? r.screenshotId;
  if (a !== null && a !== undefined && String(a).trim() !== "") return String(a).trim();
  if (r._id !== null && r._id !== undefined && String(r._id).trim() !== "") return String(r._id).trim();
  return null;
}

async function openScreenshotSas(sid) {
  if (!sid) return;
  const data = await getScreenshotSasUrl(sid);
  const url = data?.url || data?.sas_url;
  if (url) window.open(String(url), "_blank", "noopener,noreferrer");
  else throw new Error("No URL returned from server");
}

function downloadLogsCSV(rows) {
  const header = ["Date", "Time", "application", "window_title", "category", "operation", "details", "screenshot_id"];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        fmtDate(r.ts),
        fmtTime(r.ts),
        safeText(r.application),
        safeText(r.window_title),
        safeText(r.category),
        safeText(r.operation),
        safeText(r.details || r.detail),
        safeText(logScreenshotId(r) || ""),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `logs_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const logCellWrap = {
  verticalAlign: "top",
  whiteSpace: "normal",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  py: 1.25,
  px: 1.5,
  fontSize: 13,
  color: "var(--text)",
  borderColor: "var(--border-1)",
};

function FilterPanelLayout({ items, activeKey, onSelect, title, children }) {
  return (
    <Box
      sx={{
        border: "1px solid var(--border-1)",
        borderRadius: 1.5,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "210px minmax(0, 1fr)",
        minHeight: 340,
      }}
    >
      <Box sx={{ borderRight: "1px solid var(--border-1)", background: "var(--surface-2)" }}>
        <List disablePadding sx={{ py: 0.5 }}>
          {items.map((item) => {
            const isActive = activeKey === item.key;
            return (
              <ListItemButton
                key={item.key}
                selected={isActive}
                onClick={() => onSelect(item.key)}
                sx={{
                  mx: 0.75,
                  my: 0.25,
                  borderRadius: 1,
                  border: "1px solid transparent",
                  "&.Mui-selected": {
                    borderColor: "var(--border-2)",
                    backgroundColor: "rgba(59,130,246,0.12)",
                  },
                  "&.Mui-selected:hover": {
                    backgroundColor: "rgba(59,130,246,0.16)",
                  },
                }}
              >
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 13, fontWeight: isActive ? 800 : 600, noWrap: true }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>
      <Box sx={{ p: 2, overflowY: "auto" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
          {title}
        </Typography>
        {children}
      </Box>
    </Box>
  );
}

function LogsTable({ rows = [], totalRows = 0, hasMore = false, onEnsureAllRows, ensuringAllRows = false }) {
  const theme = useTheme();
  const fullScreenFilters = useMediaQuery(theme.breakpoints.down("sm"));
  const [openingShot, setOpeningShot] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [operationFilter, setOperationFilter] = useState("all");
  const [hasScreenshot, setHasScreenshot] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [sortBy, setSortBy] = useState("ts");
  const [sortDir, setSortDir] = useState("desc");
  const [activeFilterSection, setActiveFilterSection] = useState("dateTime");

  const categoryOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const v = String(r?.category || "").trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const operationOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const v = String(r?.operation || "").trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const sid = logScreenshotId(r);
      const d = dateFromTs(r.ts);
      const t = hhmmFromTs(r.ts);
      if (categoryFilter !== "all" && safeText(r.category) !== categoryFilter) return false;
      if (operationFilter !== "all" && safeText(r.operation) !== operationFilter) return false;
      if (hasScreenshot === "yes" && !sid) return false;
      if (hasScreenshot === "no" && sid) return false;
      if (!inDateRange(d, dateFrom, dateTo)) return false;
      if (!inTimeRange(t, normalizeTime24(timeFrom), normalizeTime24(timeTo))) return false;

      if (!q) return true;
      const blob = [
        fmtDate(r.ts),
        fmtTime(r.ts),
        safeText(r.application),
        safeText(r.window_title),
        safeText(r.category),
        safeText(r.operation),
        safeText(r.details || r.detail),
        safeText(sid || ""),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search, categoryFilter, operationFilter, hasScreenshot, dateFrom, dateTo, timeFrom, timeTo]);

  const visibleRows = useMemo(() => {
    const out = [...filteredRows];
    out.sort((a, b) => {
      const sidA = logScreenshotId(a) ? 1 : 0;
      const sidB = logScreenshotId(b) ? 1 : 0;
      const map = {
        date: fmtDate(a.ts).localeCompare(fmtDate(b.ts)),
        time: fmtTime(a.ts).localeCompare(fmtTime(b.ts)),
        application: safeText(a.application).localeCompare(safeText(b.application)),
        window_title: safeText(a.window_title).localeCompare(safeText(b.window_title)),
        category: safeText(a.category).localeCompare(safeText(b.category)),
        operation: safeText(a.operation).localeCompare(safeText(b.operation)),
        details: safeText(a.details || a.detail).localeCompare(safeText(b.details || b.detail)),
        screenshot: sidA - sidB,
        ts: String(a.ts || "").localeCompare(String(b.ts || "")),
      };
      const cmp = map[sortBy] ?? map.ts;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [filteredRows, sortBy, sortDir]);

  function onSort(col) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(col);
    setSortDir(col === "ts" ? "desc" : "asc");
  }

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (categoryFilter !== "all") n += 1;
    if (operationFilter !== "all") n += 1;
    if (hasScreenshot !== "all") n += 1;
    if (dateFrom || dateTo) n += 1;
    if (timeFrom || timeTo) n += 1;
    return n;
  }, [categoryFilter, operationFilter, hasScreenshot, dateFrom, dateTo, timeFrom, timeTo]);

  const hasActiveFilter = Boolean(
    search || categoryFilter !== "all" || operationFilter !== "all" || hasScreenshot !== "all" || dateFrom || dateTo || timeFrom || timeTo
  );

  useEffect(() => {
    if (!hasActiveFilter || !hasMore || !onEnsureAllRows) return;
    onEnsureAllRows();
  }, [hasActiveFilter, hasMore, onEnsureAllRows]);

  async function openScreenshot(sid) {
    if (!sid) return;
    setOpeningShot(sid);
    try {
      await openScreenshotSas(sid);
    } catch (e) {
      window.alert(e?.response?.data?.error || e?.message || "Could not open screenshot.");
    } finally {
      setOpeningShot(null);
    }
  }

  function SortHead({ id, label, align = "left" }) {
    return (
      <TableCell align={align}>
        <TableSortLabel active={sortBy === id} direction={sortBy === id ? sortDir : "asc"} onClick={() => onSort(id)}>
          {label}
        </TableSortLabel>
      </TableCell>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadRoundedIcon />}
          onClick={() => downloadLogsCSV(visibleRows)}
          sx={{ fontWeight: 900 }}
        >
          CSV
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadRoundedIcon />}
          onClick={() => window.print()}
          sx={{ fontWeight: 900 }}
        >
          PDF
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.25 }} useFlexGap flexWrap="wrap">
        <TextField
          size="small"
          label="Search"
          placeholder="App, title, details, screenshot id..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: { xs: "100%", sm: 280 }, flex: 1 }}
        />
        <Button
          size="small"
          variant={activeFilterCount ? "contained" : "outlined"}
          startIcon={<FilterAltRoundedIcon />}
          onClick={() => setFilterOpen(true)}
          sx={{ fontWeight: 800, minWidth: { xs: "100%", sm: "auto" } }}
        >
          Filters {activeFilterCount ? `(${activeFilterCount})` : ""}
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip size="small" variant="outlined" label={`Rows: ${visibleRows.length}/${totalRows || rows.length}`} />
        {ensuringAllRows ? <Chip size="small" color="info" variant="outlined" label="Loading all rows for filters..." /> : null}
      </Stack>
      <Typography variant="caption" className="muted" sx={{ display: "block", mb: 1 }}>
        Excel-like controls: search, filters, sortable headers, CSV export of current view.
      </Typography>

      <Dialog
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        fullWidth
        maxWidth="sm"
        fullScreen={fullScreenFilters}
        scroll="paper"
        PaperProps={{
          sx: {
            maxWidth: "none",
            width: { xs: "100%", sm: "min(92vw, 680px)" },
            minHeight: { xs: "100dvh", sm: 460 },
            maxHeight: { xs: "100dvh", sm: "calc(100dvh - 64px)" },
            m: { xs: 0, sm: 2 },
            overflow: "hidden",
            borderRadius: { xs: 0, sm: 3 },
            border: "1px solid var(--border-1)",
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, borderBottom: "1px solid var(--border-1)", fontWeight: 800 }}>Filters</DialogTitle>
        <DialogContent sx={{ pt: 2, pb: 2, overflowY: "auto" }}>
          <FilterPanelLayout
            items={[
              { key: "dateTime", label: "Date & Time" },
              { key: "category", label: "Categories" },
              { key: "operation", label: "Operation" },
              { key: "screenshot", label: "Screenshot" },
            ]}
            activeKey={activeFilterSection}
            onSelect={setActiveFilterSection}
            title={
              activeFilterSection === "dateTime"
                ? "Date & Time"
                : activeFilterSection === "category"
                  ? "Categories"
                  : activeFilterSection === "operation"
                    ? "Operation"
                    : "Screenshot"
            }
          >
            <Stack spacing={1.25}>
              {activeFilterSection === "dateTime" ? (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField size="small" label="Date from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                    <TextField size="small" label="Date to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField size="small" label="Time from (24h)" placeholder="HH:mm" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} fullWidth />
                    <TextField size="small" label="Time to (24h)" placeholder="HH:mm" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} fullWidth />
                  </Stack>
                </>
              ) : null}
              {activeFilterSection === "category" ? (
                <TextField size="small" select label="Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} fullWidth>
                  <MenuItem value="all">All</MenuItem>
                  {categoryOptions.map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </TextField>
              ) : null}
              {activeFilterSection === "operation" ? (
                <TextField size="small" select label="Operation" value={operationFilter} onChange={(e) => setOperationFilter(e.target.value)} fullWidth>
                  <MenuItem value="all">All</MenuItem>
                  {operationOptions.map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </TextField>
              ) : null}
              {activeFilterSection === "screenshot" ? (
                <TextField size="small" select label="Screenshot" value={hasScreenshot} onChange={(e) => setHasScreenshot(e.target.value)} fullWidth>
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="yes">Has screenshot</MenuItem>
                  <MenuItem value="no">No screenshot</MenuItem>
                </TextField>
              ) : null}
            </Stack>
          </FilterPanelLayout>
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid var(--border-1)", px: 2, py: 1.25, background: "var(--surface-2)" }}>
          <Button onClick={() => { setCategoryFilter("all"); setOperationFilter("all"); setHasScreenshot("all"); setDateFrom(""); setDateTo(""); setTimeFrom(""); setTimeTo(""); }}>
            Clear
          </Button>
          <Button variant="contained" onClick={() => setFilterOpen(false)}>Apply</Button>
        </DialogActions>
      </Dialog>

      <Typography variant="caption" className="muted" sx={{ display: "block", mb: 1 }}>
        Scroll horizontally if needed — full text is shown (no hidden ellipsis).
      </Typography>

      <TableContainer
        component={Paper}
        className="glass"
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: "100%",
          overflowX: "auto",
          overflowY: "visible",
          border: "1px solid var(--border-1)",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <Table
          stickyHeader
          size="small"
          sx={{
            minWidth: 1320,
            tableLayout: "fixed",
            "& .MuiTableCell-root": logCellWrap,
            "& .MuiTableCell-head": {
              ...logCellWrap,
              whiteSpace: "nowrap",
              fontWeight: 800,
              backgroundColor: "var(--surface-3) !important",
              zIndex: 2,
            },
            "& .MuiTableRow-root:hover .MuiTableCell-body": {
              backgroundColor: "rgba(0,0,0,0.03)",
            },
          }}
        >
          <colgroup>
            <col style={{ width: 108 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 260 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: "auto", minWidth: 280 }} />
            <col style={{ width: 96 }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <SortHead id="date" label="Date" />
              <SortHead id="time" label="Time" />
              <SortHead id="application" label="Application" />
              <SortHead id="window_title" label="Window title" />
              <SortHead id="category" label="Category" />
              <SortHead id="operation" label="Operation" />
              <SortHead id="details" label="Details" />
              <SortHead id="screenshot" label="Screenshot" align="center" />
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography color="text.secondary">No rows match current filters.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((r, idx) => {
                const sid = logScreenshotId(r);
                return (
                  <TableRow key={`${r.ts || ""}_${idx}`} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(r.ts)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtTime(r.ts)}</TableCell>
                    <TableCell>{safeText(r.application)}</TableCell>
                    <TableCell>{safeText(r.window_title)}</TableCell>
                    <TableCell>{safeText(r.category)}</TableCell>
                    <TableCell>{safeText(r.operation)}</TableCell>
                    <TableCell>{safeText(r.details || r.detail)}</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                      {sid ? (
                        <Tooltip title="View screenshot (opens new tab)">
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              aria-label="View screenshot"
                              disabled={openingShot === sid}
                              onClick={(e) => {
                                e.stopPropagation();
                                openScreenshot(sid);
                              }}
                            >
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" className="muted">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function ScreenshotCard({ row }) {
  const sid = screenshotLookupKey(row);
  const [src, setSrc] = useState(null);
  const [loadErr, setLoadErr] = useState(false);
  const [loading, setLoading] = useState(Boolean(sid));

  useEffect(() => {
    if (!sid) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getScreenshotSasUrl(sid);
        const url = data?.url || data?.sas_url;
        if (!cancelled && url) setSrc(url);
      } catch {
        if (!cancelled) setLoadErr(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sid]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1,
        borderRadius: 2,
        border: "1px solid var(--border-1)",
        "&:hover": { background: "rgba(0,0,0,0.03)" },
      }}
    >
      <Box
        sx={{
          height: 140,
          borderRadius: 1,
          overflow: "hidden",
          background: "rgba(0,0,0,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? (
          <CircularProgress size={28} />
        ) : src ? (
          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, textAlign: "center" }}>
            {!sid ? "No screenshot id" : loadErr ? "Could not load preview (check Azure env on server)" : "No preview"}
          </Typography>
        )}
      </Box>

      <Typography sx={{ fontSize: 13, fontWeight: 700, mt: 1, wordBreak: "break-word" }} title={safeText(row.window_title)}>
        {safeText(row.window_title)}
      </Typography>
      <Typography sx={{ fontSize: 12, color: "text.secondary", wordBreak: "break-word" }} title={safeText(row.application)}>
        {safeText(row.application)}
        {row.operation ? ` • ${safeText(row.operation)}` : ""}
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center" justifyContent="flex-end">
        {sid ? (
          <Button
            size="small"
            variant="text"
            sx={{ fontWeight: 800, fontSize: 12 }}
            onClick={async () => {
              try {
                await openScreenshotSas(sid);
              } catch (e) {
                window.alert(e?.response?.data?.error || e?.message || "Could not open screenshot.");
              }
            }}
          >
            Open (new SAS)
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}

function ScreenshotGrid({ rows = [] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 2,
      }}
    >
      {rows.length === 0 ? (
        <Paper elevation={0} sx={{ p: 2 }}>
          <Typography color="text.secondary">No screenshots for this range.</Typography>
        </Paper>
      ) : (
        rows.map((r, idx) => <ScreenshotCard key={`${screenshotLookupKey(r) || r.ts || ""}_${idx}`} row={r} />)
      )}
    </Box>
  );
}

function ScreenshotList({ rows = [] }) {
  return (
    <Box sx={{ width: "100%", minWidth: 0 }}>
      <Typography variant="caption" className="muted" sx={{ display: "block", mb: 1 }}>
        Scroll horizontally if needed — full URLs and text wrap (nothing clipped with “…”).
      </Typography>
      <TableContainer
        component={Paper}
        className="glass"
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: "100%",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          border: "1px solid var(--border-1)",
        }}
      >
        <Table
          stickyHeader
          size="small"
          sx={{
            minWidth: 960,
            tableLayout: "fixed",
            "& .MuiTableCell-root": logCellWrap,
            "& .MuiTableCell-head": {
              ...logCellWrap,
              whiteSpace: "nowrap",
              fontWeight: 800,
              backgroundColor: "var(--surface-3) !important",
            },
            "& .MuiTableRow-root:hover .MuiTableCell-body": {
              backgroundColor: "rgba(0,0,0,0.03)",
            },
          }}
        >
          <colgroup>
            <col style={{ width: 168 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 240 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: "auto", minWidth: 260 }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Application</TableCell>
              <TableCell>Window</TableCell>
              <TableCell>Operation</TableCell>
              <TableCell>Blob / view</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary">No screenshots for this range.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, idx) => (
                <TableRow key={`${r.ts || ""}_${idx}`} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{safeText(r.ts)}</TableCell>
                  <TableCell>{safeText(r.application)}</TableCell>
                  <TableCell>{safeText(r.window_title)}</TableCell>
                  <TableCell>{safeText(r.operation || r.label)}</TableCell>
                  <TableCell sx={{ wordBreak: "break-all" }}>
                    <Stack spacing={0.75}>
                      <Typography variant="caption" sx={{ color: "var(--muted)", display: "block" }}>
                        {r.screenshot_url
                          ? safeText(r.screenshot_url)
                          : r.file_path
                            ? safeText(r.file_path)
                            : "—"}
                      </Typography>
                      {screenshotLookupKey(r) ? (
                        <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap" useFlexGap>
                          <Tooltip title="Open image with fresh SAS URL (~1h)">
                            <IconButton
                              size="small"
                              color="primary"
                              aria-label="View screenshot"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await openScreenshotSas(screenshotLookupKey(r));
                                } catch (err) {
                                  window.alert(err?.response?.data?.error || err?.message || "Failed");
                                }
                              }}
                            >
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Typography variant="caption" className="muted">
                            id: {screenshotLookupKey(r)}
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Add screenshot_id to enable SAS view
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function ScreenshotsSection({ rows = [], totalRows = 0, hasMore = false, onEnsureAllRows, ensuringAllRows = false }) {
  const theme = useTheme();
  const fullScreenFilters = useMediaQuery(theme.breakpoints.down("sm"));
  const [view, setView] = useState("grid");
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState("all");
  const [operationFilter, setOperationFilter] = useState("all");
  const [hasId, setHasId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [sortBy, setSortBy] = useState("ts");
  const [sortDir, setSortDir] = useState("desc");
  const [activeFilterSection, setActiveFilterSection] = useState("dateTime");

  const appOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const v = String(r?.application || "").trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const operationOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const v = String(r?.operation || r?.label || "").trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const sid = screenshotLookupKey(r);
      const d = dateFromTs(r.ts);
      const t = hhmmFromTs(r.ts);
      const app = safeText(r.application);
      const op = safeText(r.operation || r.label);
      if (appFilter !== "all" && app !== appFilter) return false;
      if (operationFilter !== "all" && op !== operationFilter) return false;
      if (hasId === "yes" && !sid) return false;
      if (hasId === "no" && sid) return false;
      if (!inDateRange(d, dateFrom, dateTo)) return false;
      if (!inTimeRange(t, normalizeTime24(timeFrom), normalizeTime24(timeTo))) return false;
      if (!q) return true;
      const blob = [safeText(r.ts), app, safeText(r.window_title), op, safeText(r.screenshot_url), safeText(r.file_path), safeText(sid || "")].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search, appFilter, operationFilter, hasId, dateFrom, dateTo, timeFrom, timeTo]);

  const visibleRows = useMemo(() => {
    const out = [...filteredRows];
    out.sort((a, b) => {
      const map = {
        ts: String(a.ts || "").localeCompare(String(b.ts || "")),
        application: safeText(a.application).localeCompare(safeText(b.application)),
        window: safeText(a.window_title).localeCompare(safeText(b.window_title)),
        operation: safeText(a.operation || a.label).localeCompare(safeText(b.operation || b.label)),
        hasId: (screenshotLookupKey(a) ? 1 : 0) - (screenshotLookupKey(b) ? 1 : 0),
      };
      const cmp = map[sortBy] ?? map.ts;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [filteredRows, sortBy, sortDir]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (appFilter !== "all") n += 1;
    if (operationFilter !== "all") n += 1;
    if (hasId !== "all") n += 1;
    if (dateFrom || dateTo) n += 1;
    if (timeFrom || timeTo) n += 1;
    return n;
  }, [appFilter, operationFilter, hasId, dateFrom, dateTo, timeFrom, timeTo]);

  const hasActiveFilter = Boolean(search || appFilter !== "all" || operationFilter !== "all" || hasId !== "all" || dateFrom || dateTo || timeFrom || timeTo);
  useEffect(() => {
    if (!hasActiveFilter || !hasMore || !onEnsureAllRows) return;
    onEnsureAllRows();
  }, [hasActiveFilter, hasMore, onEnsureAllRows]);

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.25 }} useFlexGap flexWrap="wrap">
        <TextField size="small" label="Search screenshots" placeholder="Time, app, title, path, id..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: { xs: "100%", sm: 280 }, flex: 1 }} />
        <Button size="small" variant={activeFilterCount ? "contained" : "outlined"} startIcon={<FilterAltRoundedIcon />} onClick={() => setFilterOpen(true)} sx={{ fontWeight: 800, minWidth: { xs: "100%", sm: "auto" } }}>
          Filters {activeFilterCount ? `(${activeFilterCount})` : ""}
        </Button>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip size="small" variant="outlined" label={`Rows: ${visibleRows.length}/${totalRows || rows.length}`} />
        {ensuringAllRows ? <Chip size="small" color="info" variant="outlined" label="Loading all rows for filters..." /> : null}
        <TextField size="small" select label="Sort by" value={sortBy} onChange={(e) => setSortBy(e.target.value)} sx={{ minWidth: 145 }}>
          <MenuItem value="ts">Time</MenuItem><MenuItem value="application">Application</MenuItem><MenuItem value="window">Window</MenuItem><MenuItem value="operation">Operation</MenuItem><MenuItem value="hasId">Has id</MenuItem>
        </TextField>
        <TextField size="small" select label="Direction" value={sortDir} onChange={(e) => setSortDir(e.target.value)} sx={{ minWidth: 130 }}>
          <MenuItem value="desc">Desc</MenuItem><MenuItem value="asc">Asc</MenuItem>
        </TextField>
      </Stack>

      <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} fullWidth maxWidth="sm" fullScreen={fullScreenFilters} scroll="paper">
        <DialogTitle sx={{ pb: 1, borderBottom: "1px solid var(--border-1)", fontWeight: 800 }}>Screenshot Filters</DialogTitle>
        <DialogContent sx={{ pt: 2, pb: 2, overflowY: "auto" }}>
          <FilterPanelLayout
            items={[{ key: "dateTime", label: "Date & Time" }, { key: "application", label: "Application" }, { key: "operation", label: "Operation" }, { key: "screenshot", label: "Screenshot Id" }]}
            activeKey={activeFilterSection}
            onSelect={setActiveFilterSection}
            title={activeFilterSection === "dateTime" ? "Date & Time" : activeFilterSection === "application" ? "Application" : activeFilterSection === "operation" ? "Operation" : "Screenshot Id"}
          >
            <Stack spacing={1.25}>
              {activeFilterSection === "dateTime" ? (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField size="small" label="Date from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                    <TextField size="small" label="Date to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField size="small" label="Time from (24h)" placeholder="HH:mm" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} fullWidth />
                    <TextField size="small" label="Time to (24h)" placeholder="HH:mm" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} fullWidth />
                  </Stack>
                </>
              ) : null}
              {activeFilterSection === "application" ? (
                <TextField size="small" select label="Application" value={appFilter} onChange={(e) => setAppFilter(e.target.value)} fullWidth>
                  <MenuItem value="all">All</MenuItem>{appOptions.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </TextField>
              ) : null}
              {activeFilterSection === "operation" ? (
                <TextField size="small" select label="Operation" value={operationFilter} onChange={(e) => setOperationFilter(e.target.value)} fullWidth>
                  <MenuItem value="all">All</MenuItem>{operationOptions.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </TextField>
              ) : null}
              {activeFilterSection === "screenshot" ? (
                <TextField size="small" select label="Screenshot id" value={hasId} onChange={(e) => setHasId(e.target.value)} fullWidth>
                  <MenuItem value="all">All</MenuItem><MenuItem value="yes">Has id</MenuItem><MenuItem value="no">No id</MenuItem>
                </TextField>
              ) : null}
            </Stack>
          </FilterPanelLayout>
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid var(--border-1)", px: 2, py: 1.25, background: "var(--surface-2)" }}>
          <Button onClick={() => { setAppFilter("all"); setOperationFilter("all"); setHasId("all"); setDateFrom(""); setDateTo(""); setTimeFrom(""); setTimeTo(""); }}>
            Clear
          </Button>
          <Button variant="contained" onClick={() => setFilterOpen(false)}>Apply</Button>
        </DialogActions>
      </Dialog>

      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
        <Tooltip title="Grid"><IconButton size="small" onClick={() => setView("grid")} aria-label="Grid view"><ViewModuleRoundedIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="List"><IconButton size="small" onClick={() => setView("list")} aria-label="List view"><ViewListRoundedIcon fontSize="small" /></IconButton></Tooltip>
      </Stack>

      {view === "grid" ? <ScreenshotGrid rows={visibleRows} /> : <ScreenshotList rows={visibleRows} />}
    </Box>
  );
}

const ROLE_DEPT_HEAD = "DEPARTMENT_HEAD";

export default function UserDetail({ selfMode = false }) {
  const nav = useNavigate();
  const { company_username } = useParams();
  const { me } = useAuth();
  const { setSelectedUser } = useUserSelection();

  const myRole = String(me?.role_key || me?.role || "").toUpperCase();

  const def = useMemo(() => defaultLast7(), []);
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [applied, setApplied] = useState(def);

  const [tab, setTab] = useState(0);

  const [userLoading, setUserLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [shotsLoading, setShotsLoading] = useState(false);

  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState({ items: [], total: 0 });
  const [shots, setShots] = useState({ items: [], total: 0 });

  const LOGS_PAGE_SIZE = 100;
  const SHOTS_PAGE_SIZE = 50;

  const [logsPage, setLogsPage] = useState(1);
  const [shotsPage, setShotsPage] = useState(1);
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [shotsHasMore, setShotsHasMore] = useState(false);
  const [ensuringLogsAll, setEnsuringLogsAll] = useState(false);
  const [ensuringShotsAll, setEnsuringShotsAll] = useState(false);

  const params = useMemo(() => ({ from: applied.from, to: applied.to }), [applied]);

  const lastSelectedKeyRef = useRef("");

  const routeEmailKey = useMemo(() => {
    if (selfMode) {
      return String(me?.company_username_norm || me?.company_username || me?.email || "").trim();
    }
    return decodeURIComponent(company_username || "");
  }, [selfMode, me?.company_username_norm, me?.company_username, me?.email, company_username]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setError("");
      setUserLoading(true);

      try {
        if (selfMode && !routeEmailKey) {
          throw new Error("Your account is missing a company email — cannot load activity.");
        }

        const routeKey = routeEmailKey;
        const u = await getUserApi(routeKey);
        if (!mounted) return;

        if (myRole === ROLE_DEPT_HEAD && me?.department && u?.department) {
          if (String(u.department).trim() !== String(me.department).trim()) {
            setError("You can only open users in your department.");
            setUser(null);
            setLogs({ items: [], total: 0 });
            setShots({ items: [], total: 0 });
            if (mounted) {
              setUserLoading(false);
              setLogsLoading(false);
              setShotsLoading(false);
            }
            nav("/dashboard/users", { replace: true });
            return;
          }
        }

        setUser(u);

        const userKey = u?.company_username_norm || u?.company_username || routeKey;
        const uid = extensionUserId(u);

        if (lastSelectedKeyRef.current !== userKey) {
          lastSelectedKeyRef.current = userKey;
          setSelectedUser({
            company_username_norm: u?.company_username_norm || userKey,
            company_username: u?.company_username || userKey,
            full_name: u?.full_name || "",
            department: u?.department || "",
            user_id: uid,
            tracker_user_id: u?.tracker_user_id || uid,
            user_mac_id: uid,
            role_key: u?.role_key || "",
          });
        }

        setLogsLoading(true);
        setShotsLoading(true);

        setLogsPage(1);
        setShotsPage(1);

        const userScopeParams = uid ? { user_id: uid } : { company_username: userKey };

        const [lRes, sRes] = await Promise.allSettled([
          getLogs({ ...params, ...userScopeParams, page: 1, limit: LOGS_PAGE_SIZE }),
          getScreenshots({ ...params, ...userScopeParams, page: 1, limit: SHOTS_PAGE_SIZE }),
        ]);

        if (!mounted) return;

        const logsNorm = lRes.status === "fulfilled" ? normalizeListResponse(lRes.value) : { items: [], total: 0 };
        setLogs(logsNorm);
        setLogsHasMore((logsNorm.items?.length || 0) < (logsNorm.total || 0));

        const shotsNorm = sRes.status === "fulfilled" ? normalizeListResponse(sRes.value) : { items: [], total: 0 };
        setShots(shotsNorm);
        setShotsHasMore((shotsNorm.items?.length || 0) < (shotsNorm.total || 0));

        const errs = [lRes, sRes]
          .filter((x) => x.status === "rejected")
          .map((x) => x.reason?.message || "Request failed");

        if (errs.length) setError(errs[0]);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load user detail.");
        setUser(null);
        setLogs({ items: [], total: 0 });
        setShots({ items: [], total: 0 });
      } finally {
        if (!mounted) return;
        setUserLoading(false);
        setLogsLoading(false);
        setShotsLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeEmailKey, params, selfMode, myRole, me?.department, nav]);

  const title = selfMode
    ? "My activity"
    : user?.full_name || user?.company_username_norm || user?.company_username || "User";

  const contentLoading = (tab === 0 && logsLoading) || (tab === 1 && shotsLoading);

  async function loadMoreLogs() {
    if (!user || logsLoading || ensuringLogsAll || !logsHasMore) return;
    const routeKey = routeEmailKey;
    const userKey = user?.company_username_norm || user?.company_username || routeKey;
    const uid = extensionUserId(user);
    const userScopeParams = uid ? { user_id: uid } : { company_username: userKey };
    const nextPage = logsPage + 1;

    setLogsLoading(true);
    setError("");
    try {
      const res = await getLogs({ ...params, ...userScopeParams, page: nextPage, limit: LOGS_PAGE_SIZE });
      const norm = normalizeListResponse(res);

      setLogs((prev) => {
        const merged = [...(prev.items || []), ...(norm.items || [])];
        return { items: merged, total: norm.total ?? prev.total ?? merged.length };
      });

      const currentCount = (logs.items?.length || 0) + (norm.items?.length || 0);
      const total = norm.total ?? logs.total ?? currentCount;

      setLogsPage(nextPage);
      setLogsHasMore(currentCount < total);
    } catch (e) {
      setError(e?.message || "Failed to load more logs.");
    } finally {
      setLogsLoading(false);
    }
  }

  async function loadMoreShots() {
    if (!user || shotsLoading || ensuringShotsAll || !shotsHasMore) return;
    const routeKey = routeEmailKey;
    const userKey = user?.company_username_norm || user?.company_username || routeKey;
    const uid = extensionUserId(user);
    const userScopeParams = uid ? { user_id: uid } : { company_username: userKey };
    const nextPage = shotsPage + 1;

    setShotsLoading(true);
    setError("");
    try {
      const res = await getScreenshots({
        ...params,
        ...userScopeParams,
        page: nextPage,
        limit: SHOTS_PAGE_SIZE,
      });
      const norm = normalizeListResponse(res);

      setShots((prev) => {
        const merged = [...(prev.items || []), ...(norm.items || [])];
        return { items: merged, total: norm.total ?? prev.total ?? merged.length };
      });

      const currentCount = (shots.items?.length || 0) + (norm.items?.length || 0);
      const total = norm.total ?? shots.total ?? currentCount;

      setShotsPage(nextPage);
      setShotsHasMore(currentCount < total);
    } catch (e) {
      setError(e?.message || "Failed to load more screenshots.");
    } finally {
      setShotsLoading(false);
    }
  }

  async function ensureAllLogsLoaded() {
    if (!user || logsLoading || ensuringLogsAll || !logsHasMore) return;
    const routeKey = routeEmailKey;
    const userKey = user?.company_username_norm || user?.company_username || routeKey;
    const uid = extensionUserId(user);
    const userScopeParams = uid ? { user_id: uid } : { company_username: userKey };

    setEnsuringLogsAll(true);
    setError("");
    try {
      let page = logsPage;
      let items = [...(logs.items || [])];
      let total = logs.total || items.length;
      while (items.length < total) {
        const nextPage = page + 1;
        const res = await getLogs({ ...params, ...userScopeParams, page: nextPage, limit: LOGS_PAGE_SIZE });
        const norm = normalizeListResponse(res);
        const chunk = norm.items || [];
        if (chunk.length === 0) break;
        items = [...items, ...chunk];
        total = norm.total ?? total;
        page = nextPage;
      }
      setLogs({ items, total });
      setLogsPage(page);
      setLogsHasMore(items.length < total);
    } catch (e) {
      setError(e?.message || "Failed to load all logs for filtering.");
    } finally {
      setEnsuringLogsAll(false);
    }
  }

  async function ensureAllShotsLoaded() {
    if (!user || shotsLoading || ensuringShotsAll || !shotsHasMore) return;
    const routeKey = routeEmailKey;
    const userKey = user?.company_username_norm || user?.company_username || routeKey;
    const uid = extensionUserId(user);
    const userScopeParams = uid ? { user_id: uid } : { company_username: userKey };

    setEnsuringShotsAll(true);
    setError("");
    try {
      let page = shotsPage;
      let items = [...(shots.items || [])];
      let total = shots.total || items.length;
      while (items.length < total) {
        const nextPage = page + 1;
        const res = await getScreenshots({ ...params, ...userScopeParams, page: nextPage, limit: SHOTS_PAGE_SIZE });
        const norm = normalizeListResponse(res);
        const chunk = norm.items || [];
        if (chunk.length === 0) break;
        items = [...items, ...chunk];
        total = norm.total ?? total;
        page = nextPage;
      }
      setShots({ items, total });
      setShotsPage(page);
      setShotsHasMore(items.length < total);
    } catch (e) {
      setError(e?.message || "Failed to load all screenshots for filtering.");
    } finally {
      setEnsuringShotsAll(false);
    }
  }

  return (
    <Box className="dash-page">
      <PageHeader
        title={title}
        subtitle={user?.company_username_norm || user?.company_username || routeEmailKey || "—"}
        right={
          selfMode ? null : (
            <Button
              variant="outlined"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => nav("/dashboard/users")}
              sx={{ fontWeight: 800 }}
            >
              Back to users
            </Button>
          )
        }
      />

      <Paper className="glass" elevation={0} sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", md: "center" }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {!selfMode ? (
                <>
                  <Chip size="small" variant="outlined" label={`Department: ${user?.department || "—"}`} />
                  <Chip size="small" variant="outlined" label={`Role: ${user?.role_key || "—"}`} />
                  <Chip size="small" variant="outlined" label={`User ID: ${extensionUserId(user) || "—"}`} />
                  <Chip size="small" variant="outlined" label={user?.is_active ? "Active" : "Inactive"} />
                </>
              ) : (
                <Chip size="small" variant="outlined" label={`Department: ${user?.department || me?.department || "—"}`} />
              )}
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
              <TextField
                size="small"
                label="From"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                size="small"
                label="To"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <Button
                variant="contained"
                onClick={() => setApplied({ from, to })}
                disabled={userLoading || !from || !to}
                sx={{ fontWeight: 950, borderRadius: 3 }}
              >
                Apply
              </Button>
            </Stack>
          </Stack>

          {error ? <Typography color="error">{error}</Typography> : null}
        </Stack>
      </Paper>

      <Paper className="glass" elevation={0} sx={{ p: 1 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={`Logs (${formatNumber(logs?.total || logs?.items?.length || 0)})`} />
          <Tab label={`Screenshots (${formatNumber(shots?.total || shots?.items?.length || 0)})`} />
        </Tabs>
      </Paper>

      <Divider sx={{ my: 2, borderColor: "var(--border-1)" }} />

      {userLoading ? (
        <Typography className="muted">Loading…</Typography>
      ) : contentLoading ? (
        <Box sx={{ py: 4, display: "grid", placeItems: "center" }}>
          <CircularProgress />
          <Typography className="muted" sx={{ mt: 2 }}>
            Loading…
          </Typography>
        </Box>
      ) : tab === 0 ? (
        <Paper className="glass" elevation={0} sx={{ p: 2 }}>
          <LogsTable
            rows={logs?.items || []}
            totalRows={logs?.total || logs?.items?.length || 0}
            hasMore={logsHasMore}
            onEnsureAllRows={ensureAllLogsLoaded}
            ensuringAllRows={ensuringLogsAll}
          />

          {logsHasMore ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Button variant="outlined" onClick={loadMoreLogs} disabled={logsLoading} sx={{ fontWeight: 950 }}>
                {logsLoading ? "Loading…" : "Show more (next 100)"}
              </Button>
            </Box>
          ) : null}
        </Paper>
      ) : (
        <Paper className="glass" elevation={0} sx={{ p: 2 }}>
          <ScreenshotsSection
            rows={shots?.items || []}
            totalRows={shots?.total || shots?.items?.length || 0}
            hasMore={shotsHasMore}
            onEnsureAllRows={ensureAllShotsLoaded}
            ensuringAllRows={ensuringShotsAll}
          />

          {shotsHasMore ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Button variant="outlined" onClick={loadMoreShots} disabled={shotsLoading} sx={{ fontWeight: 950 }}>
                {shotsLoading ? "Loading…" : "Show more (next 50)"}
              </Button>
            </Box>
          ) : null}
        </Paper>
      )}
    </Box>
  );
}
