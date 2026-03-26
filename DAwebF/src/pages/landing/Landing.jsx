import React, { useEffect } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";

export default function Landing() {
  const navigate = useNavigate();
  const { token } = useAuth();

  useEffect(() => {
    if (token) navigate("/dashboard", { replace: true });
  }, [token, navigate]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
      <Stack spacing={3} alignItems="center">
        <Box component="img" src="/logo.png" alt="Logo" sx={{ height: 64, mb: 1 }} />
        <Typography sx={{ color: "text.secondary", fontSize: 14, maxWidth: 420, textAlign: "center" }}>
          View users, logs, and screenshots — with role-based access for your organization.
        </Typography>
        <Button
          variant="contained"
          size="large"
          sx={{ mt: 2, px: 6, py: 1.4, fontWeight: 700, borderRadius: 3 }}
          onClick={() => navigate("/login")}
        >
          Begin
        </Button>
      </Stack>
    </Box>
  );
}
