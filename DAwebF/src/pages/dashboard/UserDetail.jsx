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
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
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
import { getLogs, getScreenshots, getScreenshotSasUrl, getUserHeartbeat } from "../../services/data.api";
import { extensionUserId } from "../../utils/userIdentity";

/**
 * UserDetail — activity logs, screenshots, extension heartbeat.
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
  // - { items, total, page, limit, merged_tracker_count }
  // - { data: { items, total } }
  // - { data: itemsArray }
  // - itemsArray
  if (!res) return { items: [], total: 0 };
  if (Array.isArray(res)) return { items: res, total: res.length };
  if (Array.isArray(res.items)) {
    const out = { items: res.items, total: res.total ?? res.items.length };
    if (res.merged_tracker_count != null) out.merged_tracker_count = res.merged_tracker_count;
    return out;
  }
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

/** Value from API: `capture_screen` (snake) or `captureScreen` (camel). */
function captureScreenRaw(r) {
  const v = r?.capture_screen ?? r?.captureScreen;
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** Split pipe form into screen label + human-readable resolution (`1920 × 1080`). */
function parseCaptureScreen(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { screen: "", resolution: "" };
  const pipe = s.indexOf("|");
  if (pipe === -1) return { screen: s, resolution: "" };
  const screen = s.slice(0, pipe).trim();
  const rest = s.slice(pipe + 1).trim();
  const dim = rest.match(/^(\d+)\s*[xX×]\s*(\d+)$/);
  const resolution = dim ? `${dim[1]} × ${dim[2]}` : rest;
  return { screen, resolution };
}

function CaptureDisplay({ rowOrRaw }) {
  const raw = typeof rowOrRaw === "string" ? rowOrRaw : captureScreenRaw(rowOrRaw);
  const { screen, resolution } = parseCaptureScreen(raw);
  if (!screen && !resolution) {
    return (
      <Typography variant="caption" className="muted">
        —
      </Typography>
    );
  }
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ py: 0.25 }}>
      {screen ? (
        <Chip
          size="small"
          label={screen}
          variant="outlined"
          sx={{ fontWeight: 700, height: 22, fontSize: 11, maxWidth: "100%" }}
        />
      ) : null}
      {resolution ? (
        <Typography component="span" variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
          {resolution}
        </Typography>
      ) : null}
    </Stack>
  );
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
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "null" || lower === "undefined") return null;
  return s;
}

/** Activity log row primary id (`log_id` from extension, else Mongo `_id`). */
function logRowPrimaryId(r) {
  if (!r) return "";
  const lid = r.log_id;
  if (lid !== null && lid !== undefined && String(lid).trim() !== "") return String(lid).trim();
  if (r._id !== null && r._id !== undefined && String(r._id).trim() !== "") return String(r._id).trim();
  return "";
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
  const header = ["Date", "Time", "browser", "tab_page", "page_url", "category", "operation", "summary", "capture_screen", "log_id", "screenshot_id"];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        fmtDate(r.ts),
        fmtTime(r.ts),
        logBrowserLabel(r),
        logTabLabel(r),
        safeText(r.page_url),
        safeText(r.category),
        safeText(r.operation),
        safeText(r.details_summary || r.details || r.detail),
        captureScreenRaw(r),
        safeText(logRowPrimaryId(r) || ""),
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

/** Same work email across Chrome / Edge / Safari → backend merges tracker IDs. */
function buildTelemetryScopeParams(userKey, uid) {
  const key = String(userKey || "").trim();
  if (key.includes("@")) {
    return { company_username: key };
  }
  if (uid) return { user_id: uid };
  return { company_username: key };
}

function logBrowserLabel(r) {
  return safeText(r?.browser_name || r?.application);
}

function logTabLabel(r) {
  const t = r?.page_title || r?.window_title || r?.application_tab;
  return safeText(t);
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
        logBrowserLabel(r),
        logTabLabel(r),
        safeText(r.page_url),
        safeText(r.category),
        safeText(r.operation),
        safeText(r.details_summary || r.details || r.detail),
        captureScreenRaw(r),
        safeText(logRowPrimaryId(r)),
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
        browser: logBrowserLabel(a).localeCompare(logBrowserLabel(b)),
        tab_page: logTabLabel(a).localeCompare(logTabLabel(b)),
        application: safeText(a.application).localeCompare(safeText(b.application)),
        window_title: safeText(a.window_title).localeCompare(safeText(b.window_title)),
        category: safeText(a.category).localeCompare(safeText(b.category)),
        operation: safeText(a.operation).localeCompare(safeText(b.operation)),
        details: safeText(a.details_summary || a.details || a.detail).localeCompare(
          safeText(b.details_summary || b.details || b.detail)
        ),
        capture_screen: captureScreenRaw(a).localeCompare(captureScreenRaw(b)),
        screenshot: sidA - sidB,
        log_row_id: logRowPrimaryId(a).localeCompare(logRowPrimaryId(b)),
        log_screenshot_id: safeText(logScreenshotId(a) || "").localeCompare(safeText(logScreenshotId(b) || "")),
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
          placeholder="Browser, tab, URL, category, capture, details…"
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
        Browser and tab come from the extension. Hover Summary for full JSON details.
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
            minWidth: 1580,
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
            <col style={{ width: 100 }} />
            <col style={{ width: 82 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 220 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: "auto", minWidth: 200 }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 88 }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <SortHead id="date" label="Date" />
              <SortHead id="time" label="Time" />
              <SortHead id="browser" label="Browser" />
              <SortHead id="tab_page" label="Tab / page" />
              <SortHead id="category" label="Category" />
              <SortHead id="operation" label="Operation" />
              <SortHead id="capture_screen" label="Capture" />
              <SortHead id="details" label="Summary" />
              <SortHead id="log_row_id" label="log_id" />
              <SortHead id="log_screenshot_id" label="screenshot_id" />
              <SortHead id="screenshot" label="Shot" align="center" />
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11}>
                  <Typography color="text.secondary">No rows match current filters.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((r, idx) => {
                const sid = logScreenshotId(r);
                const lid = logRowPrimaryId(r);
                const sum = String(r.details_summary || r.details || r.detail || "").trim();
                const sumShort = sum.length > 180 ? `${sum.slice(0, 177)}…` : sum;
                return (
                  <TableRow key={`${r.ts || ""}_${idx}`} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(r.ts)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtTime(r.ts)}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{logBrowserLabel(r)}</TableCell>
                    <TableCell>
                      <Tooltip title={safeText(r.page_url || r.application_tab || "")}>
                        <span>{logTabLabel(r)}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{safeText(r.category)}</TableCell>
                    <TableCell>{safeText(r.operation)}</TableCell>
                    <TableCell>
                      <CaptureDisplay rowOrRaw={r} />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={safeText(r.details || r.detail)}>
                        <span>{sumShort || "—"}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 12,
                        maxWidth: 200,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <Tooltip title={lid || "—"}>
                        <span>{lid || "—"}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 12,
                        maxWidth: 200,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <Tooltip title={sid || "—"}>
                        <span>{sid || "—"}</span>
                      </Tooltip>
                    </TableCell>
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
        {row.browser_name ? `${safeText(row.browser_name)} · ` : ""}
        {safeText(row.application)}
        {row.operation ? ` • ${safeText(row.operation)}` : ""}
      </Typography>

      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.35, fontWeight: 800, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" }}>
          Capture
        </Typography>
        <CaptureDisplay rowOrRaw={row} />
      </Box>

      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.35, fontWeight: 800, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" }}>
          screenshot_id
        </Typography>
        <Tooltip title={sid ? safeText(sid) : ""}>
          <Typography
            variant="caption"
            sx={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11,
              display: "block",
              wordBreak: "break-all",
            }}
          >
            {sid ? safeText(sid) : "—"}
          </Typography>
        </Tooltip>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center" justifyContent="flex-end" flexWrap="wrap" useFlexGap>
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
        rows.map((r, idx) => (
          <ScreenshotCard key={`${screenshotLookupKey(r) || r.ts || ""}_${idx}`} row={r} />
        ))
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
            minWidth: 1320,
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
            <col style={{ width: 120 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 220 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 168 }} />
            <col style={{ width: 200 }} />
            <col style={{ width: "auto", minWidth: 220 }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Browser</TableCell>
              <TableCell>Site (host)</TableCell>
              <TableCell>Tab / page</TableCell>
              <TableCell>Operation</TableCell>
              <TableCell>Capture</TableCell>
              <TableCell>screenshot_id</TableCell>
              <TableCell>Blob / view</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography color="text.secondary">No screenshots for this range.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, idx) => {
                const sid = screenshotLookupKey(r);
                return (
                <TableRow key={`${r.ts || ""}_${idx}`} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{safeText(r.ts)}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{safeText(r.browser_name || "—")}</TableCell>
                  <TableCell>{safeText(r.application)}</TableCell>
                  <TableCell>{safeText(r.window_title || r.application_tab)}</TableCell>
                  <TableCell>{safeText(r.operation || r.label)}</TableCell>
                  <TableCell>
                    <CaptureDisplay rowOrRaw={r} />
                  </TableCell>
                  <TableCell
                    sx={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 12,
                      maxWidth: 200,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <Tooltip title={sid || "—"}>
                      <span>{sid || "—"}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ wordBreak: "break-all" }}>
                    <Stack spacing={0.75}>
                      <Typography variant="caption" sx={{ color: "var(--muted)", display: "block" }}>
                        {r.screenshot_url
                          ? safeText(r.screenshot_url)
                          : r.file_path
                            ? safeText(r.file_path)
                            : "—"}
                      </Typography>
                      {sid ? (
                        <Tooltip title="Open image with fresh SAS URL (~1h)">
                          <IconButton
                            size="small"
                            color="primary"
                            aria-label="View screenshot"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await openScreenshotSas(sid);
                              } catch (err) {
                                window.alert(err?.response?.data?.error || err?.message || "Failed");
                              }
                            }}
                          >
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Add screenshot_id to enable SAS view
                        </Typography>
                      )}
                    </Stack>
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
      const blob = [safeText(r.ts), app, safeText(r.window_title), op, captureScreenRaw(r), safeText(r.screenshot_url), safeText(r.file_path), safeText(sid || "")]
        .join(" ")
        .toLowerCase();
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
        capture_screen: captureScreenRaw(a).localeCompare(captureScreenRaw(b)),
        hasId: (screenshotLookupKey(a) ? 1 : 0) - (screenshotLookupKey(b) ? 1 : 0),
        screenshot_id: safeText(screenshotLookupKey(a) || "").localeCompare(safeText(screenshotLookupKey(b) || "")),
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
        <TextField size="small" label="Search screenshots" placeholder="Time, app, title, capture, path, id…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: { xs: "100%", sm: 280 }, flex: 1 }} />
        <Button size="small" variant={activeFilterCount ? "contained" : "outlined"} startIcon={<FilterAltRoundedIcon />} onClick={() => setFilterOpen(true)} sx={{ fontWeight: 800, minWidth: { xs: "100%", sm: "auto" } }}>
          Filters {activeFilterCount ? `(${activeFilterCount})` : ""}
        </Button>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip size="small" variant="outlined" label={`Rows: ${visibleRows.length}/${totalRows || rows.length}`} />
        {ensuringAllRows ? <Chip size="small" color="info" variant="outlined" label="Loading all rows for filters..." /> : null}
        <TextField size="small" select label="Sort by" value={sortBy} onChange={(e) => setSortBy(e.target.value)} sx={{ minWidth: 145 }}>
          <MenuItem value="ts">Time</MenuItem>
          <MenuItem value="application">Application</MenuItem>
          <MenuItem value="window">Window</MenuItem>
          <MenuItem value="operation">Operation</MenuItem>
          <MenuItem value="capture_screen">Capture</MenuItem>
          <MenuItem value="hasId">Has id</MenuItem>
          <MenuItem value="screenshot_id">screenshot_id</MenuItem>
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
  const [mergedTrackerCount, setMergedTrackerCount] = useState(null);

  const LOGS_PAGE_SIZE = 100;
  const SHOTS_PAGE_SIZE = 50;

  const [logsPage, setLogsPage] = useState(1);
  const [shotsPage, setShotsPage] = useState(1);
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [shotsHasMore, setShotsHasMore] = useState(false);
  const [ensuringLogsAll, setEnsuringLogsAll] = useState(false);
  const [ensuringShotsAll, setEnsuringShotsAll] = useState(false);

  const [heartbeat, setHeartbeat] = useState(null);

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
      setHeartbeat(null);

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
            setHeartbeat(null);
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

        const userScopeParams = buildTelemetryScopeParams(userKey, uid);

        const [lRes, sRes, hbRes] = await Promise.allSettled([
          getLogs({ ...params, ...userScopeParams, page: 1, limit: LOGS_PAGE_SIZE }),
          getScreenshots({ ...params, ...userScopeParams, page: 1, limit: SHOTS_PAGE_SIZE }),
          getUserHeartbeat({ ...userScopeParams, threshold_minutes: 10 }),
        ]);

        if (!mounted) return;

        const logsNorm = lRes.status === "fulfilled" ? normalizeListResponse(lRes.value) : { items: [], total: 0 };
        setLogs(logsNorm);
        const shotsNorm = sRes.status === "fulfilled" ? normalizeListResponse(sRes.value) : { items: [], total: 0 };
        setShots(shotsNorm);
        if (hbRes.status === "fulfilled" && hbRes.value) {
          setHeartbeat(hbRes.value);
        } else {
          setHeartbeat(null);
        }
        const merged =
          logsNorm.merged_tracker_count != null
            ? logsNorm.merged_tracker_count
            : shotsNorm.merged_tracker_count != null
              ? shotsNorm.merged_tracker_count
              : null;
        setMergedTrackerCount(merged);
        setLogsHasMore((logsNorm.items?.length || 0) < (logsNorm.total || 0));
        setShotsHasMore((shotsNorm.items?.length || 0) < (shotsNorm.total || 0));

        const errs = [lRes, sRes]
          .filter((x) => x.status === "rejected")
          .map((x) => x.reason?.message || "Request failed");

        if (errs.length) setError(errs[0]);
      } catch (e) {
        if (!mounted) return;
        setMergedTrackerCount(null);
        setError(e?.message || "Failed to load user detail.");
        setUser(null);
        setLogs({ items: [], total: 0 });
        setShots({ items: [], total: 0 });
        setHeartbeat(null);
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
    const userScopeParams = buildTelemetryScopeParams(userKey, uid);
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

      if (norm.merged_tracker_count != null) setMergedTrackerCount(norm.merged_tracker_count);

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
    const userScopeParams = buildTelemetryScopeParams(userKey, uid);
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

      if (norm.merged_tracker_count != null) setMergedTrackerCount(norm.merged_tracker_count);

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
    const userScopeParams = buildTelemetryScopeParams(userKey, uid);

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
    const userScopeParams = buildTelemetryScopeParams(userKey, uid);

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
                  <Chip size="small" variant="outlined" label={user?.is_active ? "Account: active" : "Account: inactive"} />
                  <Tooltip
                    title={
                      heartbeat?.last_heartbeat_at
                        ? `Last heartbeat (UTC): ${heartbeat.last_heartbeat_at}`
                        : "No extension heartbeat recorded yet for this user id."
                    }
                  >
                    <Chip
                      size="small"
                      color={heartbeat?.online ? "success" : "default"}
                      variant={heartbeat?.online ? "filled" : "outlined"}
                      label={
                        heartbeat?.last_heartbeat_at
                          ? heartbeat?.online
                            ? "Extension online"
                            : "Extension offline"
                          : "Extension: no heartbeat"
                      }
                    />
                  </Tooltip>
                </>
              ) : (
                <>
                  <Chip size="small" variant="outlined" label={`Department: ${user?.department || me?.department || "—"}`} />
                  <Tooltip
                    title={
                      heartbeat?.last_heartbeat_at
                        ? `Last heartbeat (UTC): ${heartbeat.last_heartbeat_at}`
                        : "No extension heartbeat recorded yet."
                    }
                  >
                    <Chip
                      size="small"
                      color={heartbeat?.online ? "success" : "default"}
                      variant={heartbeat?.online ? "filled" : "outlined"}
                      label={
                        heartbeat?.last_heartbeat_at
                          ? heartbeat?.online
                            ? "Extension online"
                            : "Extension offline"
                          : "Extension: no heartbeat"
                      }
                    />
                  </Tooltip>
                </>
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
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} sx={{ px: 0.5 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ flex: 1, minWidth: 0 }}>
            <Tab label={`Activity logs (${formatNumber(logs?.total || logs?.items?.length || 0)})`} />
            <Tab label={`Screenshots (${formatNumber(shots?.total || shots?.items?.length || 0)})`} />
          </Tabs>
          {mergedTrackerCount != null && mergedTrackerCount > 1 ? (
            <Chip size="small" color="info" variant="outlined" label={`${mergedTrackerCount} browsers · merged by email`} />
          ) : null}
        </Stack>
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
      ) : tab === 1 ? (
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
      ) : null}
    </Box>
  );
}
