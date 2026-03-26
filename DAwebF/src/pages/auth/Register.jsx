import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  Link,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useNavigate } from "react-router-dom";

import { registerApi } from "../../features/auth/auth.api";

/**
 * Registration is ONLY for:
 *  - C_SUITE (Admin)
 *  - DEPARTMENT_HEAD (Manager)
 *
 * Department is required only for DEPARTMENT_HEAD.
 */
export default function Register() {
  const nav = useNavigate();

  const [role, setRole] = useState("DEPARTMENT_HEAD"); // default to manager
  const [fullName, setFullName] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [licenseAccepted, setLicenseAccepted] = useState(true);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showPass, setShowPass] = useState(false);

  const needsDepartment = role === "DEPARTMENT_HEAD";

  const canSubmit = useMemo(() => {
    if (!role) return false;
    if (!fullName.trim() || !contactNo.trim() || !email.trim() || !password.trim()) return false;
    if (needsDepartment && !department.trim()) return false;
    if (!licenseAccepted) return false;
    return true;
  }, [role, fullName, contactNo, department, email, password, needsDepartment, licenseAccepted]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      // NOTE:
      // - If role is C_SUITE (Admin), department is not required and will be omitted.
      // - If role is DEPARTMENT_HEAD, department is required.
      const payload = {
        email: cleanEmail,
        company_username: cleanEmail,
        password,

        role, // "C_SUITE" | "DEPARTMENT_HEAD"
        full_name: fullName.trim(),
        contact_no: contactNo.trim(),

        license_accepted: !!licenseAccepted,
        license_version: "1.3",
      };

      if (needsDepartment) payload.department = department.trim();

      const data = await registerApi(payload);
      setMsg(data?.message || "Registration submitted. Please wait for approval before login.");
      setTimeout(() => nav("/login"), 1200);
    } catch (e2) {
      setErr(e2?.response?.data?.error || "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box
      className="login-shell"
      sx={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
      }}
    >
      {/* Keep everything centered */}
      <Box sx={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
        <Paper
          className="glass login-card"
          elevation={0}
          sx={{
            position: "relative",
            p: 3,
            width: 520,
            maxWidth: "92vw",
            borderRadius: 4,
            border: "1px solid rgba(255,255,255,0.10)",
            zIndex: 1,
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
            Create account
          </Typography>

          <Typography sx={{ color: "text.secondary", mb: 2.5 }}>
            Registration is for <b>C-Suite (Admin)</b> and <b>Department Head (Manager)</b> only.
          </Typography>

          <form onSubmit={onSubmit}>
            <Stack spacing={2.2}>
              <FormControl fullWidth>
                <InputLabel id="role-label">Account Type</InputLabel>
                <Select
                  labelId="role-label"
                  label="Account Type"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <MenuItem value="C_SUITE">C-Suite (Admin)</MenuItem>
                  <MenuItem value="DEPARTMENT_HEAD">Department Head (Manager)</MenuItem>
                </Select>
              </FormControl>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <TextField
                  fullWidth
                  label="Contact No"
                  value={contactNo}
                  onChange={(e) => setContactNo(e.target.value)}
                  required
                />
              </Stack>

              {needsDepartment ? (
                <TextField
                  label="Department (string)"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="IT / HR / Sales"
                  required
                />
              ) : (
                <Box
                  sx={{
                    px: 1.5,
                    py: 1.25,
                    borderRadius: 2,
                    border: "1px dashed",
                    borderColor: "divider",
                    bgcolor: "background.paper",
                  }}
                >
                  <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
                    Department is not required for <b>C-Suite (Admin)</b> registration.
                  </Typography>
                </Box>
              )}

              <TextField
                label="Company Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <TextField
                label="Password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPass((s) => !s)} edge="end">
                        {showPass ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <FormControlLabel
                control={<Checkbox checked={licenseAccepted} onChange={(e) => setLicenseAccepted(e.target.checked)} />}
                label="I accept the license"
              />

              {err ? <Typography color="error">{err}</Typography> : null}
              {msg ? <Typography sx={{ color: "success.main" }}>{msg}</Typography> : null}

              <Button type="submit" variant="contained" size="large" disabled={busy || !canSubmit}>
                {busy ? "Creating..." : "Create account"}
              </Button>

              <Link component="button" type="button" underline="hover" onClick={() => nav("/login")} sx={{ fontSize: 14 }}>
                Already registered? Sign in
              </Link>
            </Stack>
          </form>
        </Paper>
      </Box>
    </Box>
  );
}
