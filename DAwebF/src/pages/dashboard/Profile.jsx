import React from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import FingerprintRoundedIcon from "@mui/icons-material/FingerprintRounded";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import UpdateRoundedIcon from "@mui/icons-material/UpdateRounded";

import PageHeader from "../../components/ui/PageHeader";
import { extensionUserId } from "../../utils/userIdentity";
import { useAuth } from "../../app/providers/AuthProvider";
import { useUserSelection } from "../../app/providers/UserSelectionProvider";

function initials(nameOrEmail) {
  const s = String(nameOrEmail || "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).slice(0, 2);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "U";
  return `${parts[0][0] || "U"}${parts[1][0] || ""}`.toUpperCase();
}

function roleLabel(role) {
  const r = String(role || "").toUpperCase();
  if (r === "C_SUITE") return "C-Suite";
  if (r === "DEPARTMENT_HEAD") return "Department Head";
  if (r === "DEPARTMENT_MEMBER") return "Department Member";
  return r || "—";
}

function fmtIso(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

function InfoBlock({ icon, label, value, mono }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 1.25 }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          bgcolor: "var(--primary-soft)",
          color: "var(--primary)",
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" className="muted" sx={{ fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", fontSize: 10 }}>
          {label}
        </Typography>
        <Typography
          sx={{
            fontWeight: 750,
            fontSize: 15,
            mt: 0.25,
            wordBreak: mono ? "break-all" : "normal",
            fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit",
          }}
        >
          {value === null || value === undefined || value === "" ? "—" : String(value)}
        </Typography>
      </Box>
    </Stack>
  );
}

function SectionCard({ title, children }) {
  return (
    <Paper
      className="glass"
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        border: "1px solid var(--border-1)",
        borderRadius: 3,
        height: "100%",
      }}
    >
      <Typography sx={{ fontWeight: 950, fontSize: 16, mb: 1.5, letterSpacing: 0.2 }}>
        {title}
      </Typography>
      <Divider sx={{ mb: 0.5, borderColor: "var(--border-1)" }} />
      {children}
    </Paper>
  );
}

export default function Profile() {
  const { me } = useAuth();
  const { clearSelectedUser } = useUserSelection();

  const name = me?.full_name || me?.company_username_norm || me?.company_username || "Your profile";
  const emailDisplay = me?.company_username || me?.company_username_norm || "—";
  const emailNorm = me?.company_username_norm || "—";
  const contact = me?.contact_no || me?.phone || me?.mobile;
  const pcUser = me?.pc_username;
  const dept = me?.department;
  const role = String(me?.role_key || me?.role || "").toUpperCase();
  const deviceUserId = extensionUserId(me) || me?._id;
  const licenseOk = me?.license_accepted;
  const licenseVer = me?.license_version;
  const licenseAt = me?.license_accepted_at;
  const lastSeen = me?.last_seen_at;
  const created = me?.created_at;
  const active = me?.is_active !== false;

  return (
    <Box className="dash-page">
      <PageHeader
        title="Profile"
        subtitle="Your account, contact details, and device information in one place."
        right={
          <Button variant="outlined" size="small" onClick={clearSelectedUser} sx={{ fontWeight: 750 }}>
            Clear selected user
          </Button>
        }
      />

      {/* Hero */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: 3,
          border: "1px solid var(--border-1)",
          boxShadow: "var(--shadow)",
          bgcolor: "var(--surface-1)",
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} alignItems={{ xs: "center", sm: "center" }}>
          <Avatar
            sx={{
              width: 88,
              height: 88,
              borderRadius: 3,
              fontSize: 32,
              fontWeight: 950,
              bgcolor: "var(--primary-soft)",
              color: "var(--primary)",
              border: "2px solid var(--primary)",
            }}
          >
            {initials(name)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0, textAlign: { xs: "center", sm: "left" } }}>
            <Typography sx={{ fontWeight: 950, fontSize: { xs: 22, sm: 26 }, lineHeight: 1.2 }}>
              {name}
            </Typography>
            <Typography className="muted" sx={{ mt: 0.5, fontSize: 15 }}>
              {emailDisplay}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              justifyContent={{ xs: "center", sm: "flex-start" }}
              sx={{ mt: 1.5 }}
            >
              <Chip
                size="small"
                icon={<BadgeRoundedIcon sx={{ fontSize: "18px !important" }} />}
                label={roleLabel(role)}
                sx={{ fontWeight: 800, borderColor: "var(--border-2)" }}
                variant="outlined"
              />
              {dept ? (
                <Chip
                  size="small"
                  icon={<BusinessRoundedIcon sx={{ fontSize: "18px !important" }} />}
                  label={dept}
                  sx={{ fontWeight: 700 }}
                  variant="outlined"
                />
              ) : (
                <Chip size="small" label="No department" variant="outlined" sx={{ fontWeight: 600 }} />
              )}
              <Chip
                size="small"
                label={active ? "Active" : "Inactive"}
                color={active ? "success" : "default"}
                variant="outlined"
                sx={{ fontWeight: 700 }}
              />
            </Stack>
          </Box>
        </Stack>
      </Paper>

      <Grid container spacing={2.5} sx={{ mt: 0 }}>
        <Grid item xs={12} md={6}>
          <SectionCard title="Contact & identity">
            <InfoBlock icon={<PersonRoundedIcon fontSize="small" />} label="Full name" value={me?.full_name} />
            <InfoBlock icon={<EmailRoundedIcon fontSize="small" />} label="Company email" value={emailDisplay} />
            <InfoBlock icon={<EmailRoundedIcon fontSize="small" />} label="Email (normalized)" value={emailNorm} mono />
            <InfoBlock icon={<PhoneRoundedIcon fontSize="small" />} label="Contact number" value={contact} />
            <InfoBlock icon={<ComputerRoundedIcon fontSize="small" />} label="PC username" value={pcUser} />
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionCard title="Account & device">
            <InfoBlock icon={<BadgeRoundedIcon fontSize="small" />} label="Role" value={roleLabel(role)} />
            <InfoBlock icon={<BusinessRoundedIcon fontSize="small" />} label="Department" value={dept} />
            <InfoBlock icon={<FingerprintRoundedIcon fontSize="small" />} label="User ID (extension)" value={deviceUserId} mono />
            <InfoBlock icon={<CalendarTodayRoundedIcon fontSize="small" />} label="Account created" value={fmtIso(created)} />
            <InfoBlock icon={<UpdateRoundedIcon fontSize="small" />} label="Last seen" value={fmtIso(lastSeen)} />
          </SectionCard>
        </Grid>

        <Grid item xs={12}>
          <SectionCard title="License">
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} sx={{ py: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <VerifiedUserRoundedIcon sx={{ color: licenseOk ? "success.main" : "text.secondary" }} />
                <Typography sx={{ fontWeight: 800 }}>
                  {licenseOk ? "License accepted" : "License not recorded"}
                </Typography>
              </Stack>
              {licenseVer ? (
                <Chip size="small" label={`Version: ${licenseVer}`} variant="outlined" />
              ) : null}
            </Stack>
            <InfoBlock
              icon={<CalendarTodayRoundedIcon fontSize="small" />}
              label="License accepted at"
              value={fmtIso(licenseAt)}
            />
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
