import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";

import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { useUserSelection } from "../../app/providers/UserSelectionProvider";
import PageHeader from "../../components/ui/PageHeader";

import { listUsersApi, createUserApi, updateUserApi } from "../../features/users/users.api";
import { listDepartmentsApi, createDepartmentApi } from "../../features/departments/departments.api";
import { normalizeDepartmentList } from "../../utils/departments.jsx";
import { extensionUserId } from "../../utils/userIdentity";

const ROLE_C_SUITE = "C_SUITE";
const ROLE_DEPT_HEAD = "DEPARTMENT_HEAD";
const ROLE_DEPT_MEMBER = "DEPARTMENT_MEMBER";

/** Strong contrast for avatars + chips on light glass cards */
const avatarSx = {
  bgcolor: "var(--primary-soft)",
  color: "var(--text)",
  fontWeight: 700,
  fontSize: "0.95rem",
  border: "1px solid var(--border-2)",
};
const chipSx = {
  color: "var(--text)",
  borderColor: "var(--border-2)",
  "& .MuiChip-label": { fontWeight: 600 },
};

function roleLabel(role) {
  const r = String(role || "").toUpperCase();
  if (r === ROLE_C_SUITE) return "C-Suite";
  if (r === ROLE_DEPT_HEAD) return "Department Head";
  if (r === ROLE_DEPT_MEMBER) return "Department Member";
  return r || "(unknown)";
}

/** Card/list chip from `/api/users` enrichment (`user_heartbeats`, default 10 min threshold). */
function extensionStatusPresentation(u) {
  const last = u?.extension_last_heartbeat_at;
  const online = u?.extension_online;
  const thr = u?.extension_heartbeat_threshold_minutes ?? 10;
  if (last == null || last === "") {
    return {
      label: "Extension: no heartbeat",
      color: "default",
      title: `No row in user_heartbeats yet, or extension has not checked in. When it does, online = last ping within ${thr} min.`,
    };
  }
  if (online === true) {
    return {
      label: "Extension online",
      color: "success",
      title: `Last heartbeat: ${last} (within ${thr} min)`,
    };
  }
  return {
    label: "Extension offline",
    color: "warning",
    title: `Last heartbeat: ${last} (older than ${thr} min)`,
  };
}

function initials(nameOrEmail) {
  const s = String(nameOrEmail || "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).slice(0, 2);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "U";
  return `${parts[0][0] || "U"}${parts[1][0] || ""}`.toUpperCase();
}

function UserCard({ u, onOpen }) {
  const title = u.full_name || u.company_username_norm || u.company_username || "User";
  const sub = u.company_username_norm || u.company_username || "—";
  const ext = extensionStatusPresentation(u);

  return (
    <Paper
      className="glass glass-hover"
      elevation={0}
      onClick={onOpen}
      sx={{
        p: 2,
        cursor: "pointer",
        borderRadius: 3,
        border: "1px solid var(--border-1)",
        transition: "transform .12s ease",
        "&:hover": { transform: "translateY(-2px)" },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar sx={{ width: 44, height: 44, borderRadius: 3, ...avatarSx }}>
          {initials(title)}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 950 }} noWrap>
            {title}
          </Typography>
          <Typography variant="caption" sx={{ color: "var(--muted)" }} noWrap>
            {sub}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
            <Chip size="small" variant="outlined" label={u.department || "No department"} sx={chipSx} />
            <Chip
              size="small"
              variant={String(u.role_key).toUpperCase() === ROLE_C_SUITE ? "filled" : "outlined"}
              label={roleLabel(u.role_key)}
              sx={String(u.role_key).toUpperCase() === ROLE_C_SUITE ? undefined : chipSx}
            />
            <Tooltip title={ext.title}>
              <Chip
                size="small"
                color={ext.color}
                variant="outlined"
                label={ext.label}
                sx={{ "& .MuiChip-label": { fontWeight: 700, fontSize: 11 } }}
              />
            </Tooltip>
          </Stack>
        </Box>

        <Tooltip title="Open user">
          <IconButton size="small">
            <PersonRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}

function UserRow({ u, onOpen }) {
  const ext = extensionStatusPresentation(u);
  return (
    <Paper
      className="glass glass-hover"
      elevation={0}
      onClick={onOpen}
      sx={{
        p: 1.4,
        cursor: "pointer",
        borderRadius: 3,
        border: "1px solid var(--border-1)",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Avatar sx={{ width: 36, height: 36, borderRadius: 3, fontSize: "0.85rem", ...avatarSx }}>
          {initials(u.full_name || u.company_username_norm)}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 950 }} noWrap>
            {u.full_name || "—"}
          </Typography>
          <Typography variant="caption" sx={{ color: "var(--muted)" }} noWrap>
            {u.company_username_norm || u.company_username || "—"}
          </Typography>
        </Box>

        <Chip size="small" variant="outlined" label={u.department || "—"} sx={chipSx} />
        <Chip
          size="small"
          variant={String(u.role_key).toUpperCase() === ROLE_C_SUITE ? "filled" : "outlined"}
          label={roleLabel(u.role_key)}
          sx={String(u.role_key).toUpperCase() === ROLE_C_SUITE ? undefined : chipSx}
        />
        <Tooltip title={ext.title}>
          <Chip size="small" color={ext.color} variant="outlined" label={ext.label} sx={{ "& .MuiChip-label": { fontWeight: 700, fontSize: 11 } }} />
        </Tooltip>
      </Stack>
    </Paper>
  );
}

export default function Users() {
  const nav = useNavigate();
  const { me } = useAuth();
  const { setSelectedUser } = useUserSelection();

  const role = String(me?.role_key || me?.role || "").toUpperCase();
  const canAccess = role === ROLE_C_SUITE || role === ROLE_DEPT_HEAD;
  const canWrite = role === ROLE_C_SUITE;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [view, setView] = useState("grid"); // grid | list
  const [filterOpen, setFilterOpen] = useState(false);
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("name"); // name | created

  // Admin dialogs (kept)
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deptOpen, setDeptOpen] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [deptBusy, setDeptBusy] = useState(false);
  const [deptErr, setDeptErr] = useState("");

  const [form, setForm] = useState({
    user_mac_id: "",
    company_username: "",
    password: "",
    full_name: "",
    contact_no: "",
    pc_username: "",
    department: "",
    role_key: ROLE_DEPT_MEMBER,
  });

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [deps, us] = await Promise.all([listDepartmentsApi(), listUsersApi()]);
      setDepartments(normalizeDepartmentList(deps));
      setUsers(Array.isArray(us) ? us : []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canAccess) return;
    loadAll();
  }, [canAccess]);

  const filtered = useMemo(() => {
    let rows = Array.isArray(users) ? [...users] : [];

    // Logged-in user (dashboard admin) apni row list me na dikhe — sirf plugin / baaki users dikhen.
    const meEmail = String(me?.company_username_norm || me?.company_username || me?.email || "").trim().toLowerCase();
    const meId = String(extensionUserId(me) || me?._id || "").trim();
    if (meEmail || meId) {
      rows = rows.filter((u) => {
        const uEmail = String(u?.company_username_norm || u?.company_username || u?.email || "").trim().toLowerCase();
        const uId = String(extensionUserId(u) || u?._id || "").trim();
        if (meEmail && uEmail && uEmail === meEmail) return false;
        if (meId && uId && uId === meId) return false;
        return true;
      });
    }

    // Department managers: only users in their department (C-Suite sees all)
    if (role === ROLE_DEPT_HEAD && me?.department) {
      const d = String(me.department).trim().toLowerCase();
      rows = rows.filter((u) => String(u.department || "").trim().toLowerCase() === d);
    }

    // dept filter
    if (deptFilter) {
      rows = rows.filter((u) => String(u.department || "").toLowerCase() === String(deptFilter).toLowerCase());
    }
    if (roleFilter !== "all") {
      rows = rows.filter((u) => String(u.role_key || "").toUpperCase() === roleFilter);
    }
    if (statusFilter === "ext_online") {
      rows = rows.filter((u) => u.extension_online === true);
    } else if (statusFilter === "ext_offline") {
      rows = rows.filter((u) => u.extension_online === false && u.extension_last_heartbeat_at);
    } else if (statusFilter === "ext_none") {
      rows = rows.filter((u) => !u.extension_last_heartbeat_at);
    }

    // search
    const s = String(q || "").trim().toLowerCase();
    if (s) {
      rows = rows.filter((u) => {
        const a = `${u.full_name || ""} ${u.company_username_norm || u.company_username || ""} ${u.department || ""} ${extensionUserId(u)}`.toLowerCase();
        return a.includes(s);
      });
    }

    // sort
    if (sort === "created") {
      rows.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    } else {
      rows.sort((a, b) => String(a.full_name || a.company_username_norm || "").localeCompare(String(b.full_name || b.company_username_norm || "")));
    }

    return rows;
  }, [users, deptFilter, roleFilter, statusFilter, q, sort, me, role]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (deptFilter) n += 1;
    if (roleFilter !== "all") n += 1;
    if (statusFilter !== "all") n += 1;
    return n;
  }, [deptFilter, roleFilter, statusFilter]);

  function openUser(u) {
  const email = u.company_username_norm || u.company_username;
  if (!email) return;

  const uid = extensionUserId(u);
  if (!uid) return;

  setSelectedUser({
    _id: uid,
    user_id: uid,
    tracker_user_id: u.tracker_user_id || uid,
    user_mac_id: uid,
    company_username_norm: u.company_username_norm || email,
    company_username: u.company_username || email,
    full_name: u.full_name || "",
    department: u.department || "",
    role_key: u.role_key || "",
  });

  nav(`/dashboard/users/${encodeURIComponent(email)}`);
}


  function resetForm() {
    setForm({
      user_mac_id: "",
      company_username: "",
      password: "",
      full_name: "",
      contact_no: "",
      pc_username: "",
      department: "",
      role_key: ROLE_DEPT_MEMBER,
    });
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
  }

  function openEdit(u) {
    setEditing(u);
    setForm({
      user_mac_id: extensionUserId(u) || "",
      company_username: u?.company_username_norm || u?.company_username || "",
      password: "",
      full_name: u?.full_name || "",
      contact_no: u?.contact_no || "",
      pc_username: u?.pc_username || "",
      department: u?.department || "",
      role_key: String(u?.role_key || ROLE_DEPT_MEMBER).toUpperCase(),
    });
    setEditOpen(true);
  }

  async function handleCreate() {
    setError("");
    if (!form.user_mac_id || !form.company_username || !form.password) {
      setError("Extension user ID, company email, and password are required.");
      return;
    }
    try {
      setLoading(true);
      await createUserApi({
        user_id: form.user_mac_id,
        company_username: form.company_username,
        password: form.password,
        full_name: form.full_name,
        contact_no: form.contact_no,
        pc_username: form.pc_username,
        department: form.department,
        role_key: form.role_key,
      });
      setCreateOpen(false);
      await loadAll();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Failed to create user.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate() {
    setError("");
    if (!editing) return;
    try {
      setLoading(true);
      const payload = {
        full_name: form.full_name,
        contact_no: form.contact_no,
        pc_username: form.pc_username,
        department: form.department,
        role_key: form.role_key,
      };
      if (form.password) payload.password = form.password;

      await updateUserApi(editing.company_username_norm || editing.company_username, payload);
      setEditOpen(false);
      setEditing(null);
      await loadAll();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Failed to update user.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateDepartment() {
    setDeptErr("");
    const name = (deptName || "").trim();
    if (!name) {
      setDeptErr("Department name is required.");
      return;
    }
    try {
      setDeptBusy(true);
      await createDepartmentApi(name);
      setDeptName("");
      setDeptOpen(false);
      await loadAll();
    } catch (e) {
      setDeptErr(e?.response?.data?.error || e?.message || "Failed to create department.");
    } finally {
      setDeptBusy(false);
    }
  }

  if (!canAccess) {
    return (
      <Box className="dash-page">
        <PageHeader title="Users" subtitle="Users management is restricted by RBAC." />
        <Paper className="glass" elevation={0} sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 950, fontSize: 18 }}>Access denied</Typography>
          <Typography className="muted" sx={{ mt: 0.5 }}>
            This section is only available for Department Heads and C-Suite.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box className="dash-page">
      <PageHeader
        title="Users"
        subtitle={canWrite ? "Create and manage users (Drive-style workspace)." : "Monitor your department users (read-only)."}
        right={
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Grid view">
              <IconButton onClick={() => setView("grid")} className="glass-hover" size="small">
                <GridViewRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="List view">
              <IconButton onClick={() => setView("list")} className="glass-hover" size="small">
                <ViewListRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      <Paper className="glass" elevation={0} sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between">
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }} sx={{ width: "100%" }}>
              <TextField
                size="small"
                placeholder="Search users…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                sx={{ minWidth: { xs: "100%", md: 340 }, flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                size="small"
                variant={activeFilterCount ? "contained" : "outlined"}
                startIcon={<FilterAltRoundedIcon />}
                onClick={() => setFilterOpen(true)}
                sx={{ fontWeight: 800, minWidth: { xs: "100%", md: "auto" } }}
              >
                Filters {activeFilterCount ? `(${activeFilterCount})` : ""}
              </Button>

              <Chip size="small" variant="outlined" label={`Total: ${filtered.length}`} />
            </Stack>

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="outlined" onClick={loadAll} disabled={loading}>Refresh</Button>
              {canWrite ? (
                <>
                  <Button variant="outlined" onClick={() => setDeptOpen(true)}>Add department</Button>
                  <Button variant="contained" onClick={openCreate}>Add user</Button>
                </>
              ) : null}
            </Stack>
          </Stack>

          {error ? <Typography color="error">{error}</Typography> : null}

          <Dialog
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            fullWidth
            maxWidth="sm"
            scroll="paper"
            PaperProps={{
              sx: {
                maxWidth: "none",
                width: { xs: "calc(100vw - 12px)", sm: "min(96vw, 760px)" },
                maxHeight: "calc(100dvh - 32px)",
                m: { xs: 1, sm: 2 },
                overflow: "hidden",
                borderRadius: 3,
                border: "1px solid var(--border-1)",
              },
            }}
          >
            <DialogTitle sx={{ pb: 1, borderBottom: "1px solid var(--border-1)", fontWeight: 800 }}>User Filters</DialogTitle>
            <DialogContent
              sx={{
                display: "grid",
                gap: 1.5,
                pt: 2.5,
                pb: 2,
                overflowY: "auto",
                "& .MuiTextField-root, & .MuiFormControl-root": { minWidth: 0 },
                "& .MuiInputBase-root": { minHeight: 42 },
                "& .MuiInputLabel-root": { fontSize: 13 },
                "& .MuiSelect-select": { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
              }}
            >
              {role === ROLE_C_SUITE ? (
                <FormControl size="small" fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select value={deptFilter} label="Department" onChange={(e) => setDeptFilter(e.target.value)}>
                    <MenuItem value="">All departments</MenuItem>
                    {departments.map((d) => (
                      <MenuItem key={d.id} value={d.id}>
                        {d.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <Chip size="small" variant="outlined" label={`Department: ${me?.department || "(not set)"}`} />
              )}

              <FormControl size="small" fullWidth>
                <InputLabel>Role</InputLabel>
                <Select value={roleFilter} label="Role" onChange={(e) => setRoleFilter(e.target.value)}>
                  <MenuItem value="all">All roles</MenuItem>
                  <MenuItem value={ROLE_C_SUITE}>C-Suite</MenuItem>
                  <MenuItem value={ROLE_DEPT_HEAD}>Department Head</MenuItem>
                  <MenuItem value={ROLE_DEPT_MEMBER}>Department Member</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Extension</InputLabel>
                <Select value={statusFilter} label="Extension" onChange={(e) => setStatusFilter(e.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="ext_online">Extension online</MenuItem>
                  <MenuItem value="ext_offline">Extension offline (seen before)</MenuItem>
                  <MenuItem value="ext_none">No heartbeat yet</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Sort</InputLabel>
                <Select value={sort} label="Sort" onChange={(e) => setSort(e.target.value)}>
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="created">Recently created</MenuItem>
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions sx={{ borderTop: "1px solid var(--border-1)", px: 2, py: 1.25, background: "var(--surface-2)" }}>
              <Button
                onClick={() => {
                  setDeptFilter("");
                  setRoleFilter("all");
                  setStatusFilter("all");
                  setSort("name");
                }}
              >
                Clear
              </Button>
              <Button variant="contained" onClick={() => setFilterOpen(false)}>
                Apply
              </Button>
            </DialogActions>
          </Dialog>

          <Divider sx={{ borderColor: "var(--border-1)" }} />

          {/* Content */}
          {loading ? (
            <Typography className="muted" sx={{ py: 2 }}>Loading…</Typography>
          ) : filtered.length === 0 ? (
            <Typography className="muted" sx={{ py: 2 }}>No users found.</Typography>
          ) : view === "grid" ? (
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              {filtered.map((u) => (
                <Box key={u._id || u.company_username_norm}>
                  <UserCard u={u} onOpen={() => openUser(u)} />
                  {canWrite ? (
                    <Box sx={{ mt: 1, display: "flex", justifyContent: "flex-end" }}>
                      <Button size="small" variant="outlined" onClick={() => openEdit(u)}>
                        Edit
                      </Button>
                    </Box>
                  ) : null}
                </Box>
              ))}
            </Box>
          ) : (
            <Stack spacing={1}>
              {filtered.map((u) => (
                <Box key={u._id || u.company_username_norm}>
                  <UserRow u={u} onOpen={() => openUser(u)} />
                  {canWrite ? (
                    <Box sx={{ mt: 1, display: "flex", justifyContent: "flex-end" }}>
                      <Button size="small" variant="outlined" onClick={() => openEdit(u)}>
                        Edit
                      </Button>
                    </Box>
                  ) : null}
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      {/* Create user */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create user (Admin only)</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Extension user ID" value={form.user_mac_id} onChange={(e) => setForm((s) => ({ ...s, user_mac_id: e.target.value }))} required helperText="Same as logs/screenshots user_id (device UUID)" />
            <TextField label="Company Email" value={form.company_username} onChange={(e) => setForm((s) => ({ ...s, company_username: e.target.value }))} required />
            <TextField label="Password" type="password" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} required />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField fullWidth label="Full name" value={form.full_name} onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))} />
              <TextField fullWidth label="Contact no" value={form.contact_no} onChange={(e) => setForm((s) => ({ ...s, contact_no: e.target.value }))} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField fullWidth label="PC Username" value={form.pc_username} onChange={(e) => setForm((s) => ({ ...s, pc_username: e.target.value }))} />
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select value={form.department} label="Department" onChange={(e) => setForm((s) => ({ ...s, department: e.target.value }))}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  {departments.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <FormControl>
              <InputLabel>Role</InputLabel>
              <Select value={form.role_key} label="Role" onChange={(e) => setForm((s) => ({ ...s, role_key: e.target.value }))}>
                <MenuItem value={ROLE_DEPT_MEMBER}>Department Member</MenuItem>
                <MenuItem value={ROLE_DEPT_HEAD}>Department Head</MenuItem>
                <MenuItem value={ROLE_C_SUITE}>C-Suite</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={loading}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={loading}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Edit user */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit user (Admin only)</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Company Email" value={form.company_username} disabled />
            <TextField label="New Password (optional)" type="password" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField fullWidth label="Full name" value={form.full_name} onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))} />
              <TextField fullWidth label="Contact no" value={form.contact_no} onChange={(e) => setForm((s) => ({ ...s, contact_no: e.target.value }))} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField fullWidth label="PC Username" value={form.pc_username} onChange={(e) => setForm((s) => ({ ...s, pc_username: e.target.value }))} />
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select value={form.department} label="Department" onChange={(e) => setForm((s) => ({ ...s, department: e.target.value }))}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  {departments.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <FormControl>
              <InputLabel>Role</InputLabel>
              <Select value={form.role_key} label="Role" onChange={(e) => setForm((s) => ({ ...s, role_key: e.target.value }))}>
                <MenuItem value={ROLE_DEPT_MEMBER}>Department Member</MenuItem>
                <MenuItem value={ROLE_DEPT_HEAD}>Department Head</MenuItem>
                <MenuItem value={ROLE_C_SUITE}>C-Suite</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={loading}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdate} disabled={loading}>Update</Button>
        </DialogActions>
      </Dialog>

      {/* Create department */}
      <Dialog open={deptOpen} onClose={() => !deptBusy && setDeptOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add department (Admin only)</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Department name" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
            {deptErr ? <Typography color="error">{deptErr}</Typography> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeptOpen(false)} disabled={deptBusy}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateDepartment} disabled={deptBusy}>
            {deptBusy ? "Adding…" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
