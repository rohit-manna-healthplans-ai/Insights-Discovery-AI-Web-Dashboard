import React, { useMemo } from "react";
import { Box, Paper, Typography, Stack, Chip, Divider, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import { useAuth } from "../../app/providers/AuthProvider";

const ROLE_C_SUITE = "C_SUITE";
const ROLE_DEPT_HEAD = "DEPARTMENT_HEAD";

function roleLabel(role) {
  const r = String(role || "").toUpperCase();
  if (r === ROLE_C_SUITE) return "C-Suite (Admin)";
  if (r === ROLE_DEPT_HEAD) return "Department Head (Manager)";
  if (r === "DEPARTMENT_MEMBER") return "Department Member";
  return r || "—";
}

export default function Settings() {
  const nav = useNavigate();
  const { me } = useAuth();

  const role = String(me?.role_key || me?.role || "").toUpperCase();
  const isAdmin = role === ROLE_C_SUITE;
  const isManager = role === ROLE_DEPT_HEAD;

  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000", []);

  return (
    <Box className="dash-page">
      <PageHeader title="Settings" subtitle="RBAC + system information" />

      <Paper className="glass" elevation={0} sx={{ p: 2 }}>
        <Typography sx={{ fontWeight: 950, fontSize: 16 }}>Your Access</Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
          <Chip size="small" variant="outlined" label={`Role: ${roleLabel(role)}`} />
          <Chip size="small" variant="outlined" label={`Department: ${me?.department || "—"}`} />
          <Chip size="small" variant="outlined" label={`Email: ${me?.company_username_norm || me?.company_username || "—"}`} />
        </Stack>

        <Divider sx={{ my: 2, borderColor: "var(--border-1)" }} />

        {isAdmin ? (
          <>
            <Typography sx={{ fontWeight: 950, fontSize: 16 }}>Admin</Typography>
            <Typography className="muted" sx={{ mt: 0.5 }}>
              Full access to all users, logs, and screenshots. User management from the Users page.
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
              <Button variant="contained" onClick={() => nav("/dashboard/users")} sx={{ fontWeight: 950 }}>
                Open Users
              </Button>
            </Stack>
          </>
        ) : isManager ? (
          <>
            <Typography sx={{ fontWeight: 950, fontSize: 16 }}>Department manager</Typography>
            <Typography className="muted" sx={{ mt: 0.5 }}>
              You can open only users in your department and view their logs and screenshots.
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
              <Button variant="contained" onClick={() => nav("/dashboard/users")} sx={{ fontWeight: 950 }}>
                Open department users
              </Button>
            </Stack>
          </>
        ) : (
          <>
            <Typography sx={{ fontWeight: 950, fontSize: 16 }}>Your workspace</Typography>
            <Typography className="muted" sx={{ mt: 0.5 }}>
              You can view only your own logs and screenshots from the sidebar (My logs & screenshots).
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
              <Button variant="contained" onClick={() => nav("/dashboard/my-activity")} sx={{ fontWeight: 950 }}>
                Open my logs & screenshots
              </Button>
            </Stack>
          </>
        )}

        <Divider sx={{ my: 2, borderColor: "var(--border-1)" }} />

        <Typography sx={{ fontWeight: 950, fontSize: 16 }}>System</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
          <Chip size="small" variant="outlined" label={`API Base URL: ${apiBase}`} />
          <Chip size="small" variant="outlined" label="RBAC: Enabled" />
        </Stack>
      </Paper>
    </Box>
  );
}
