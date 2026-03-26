import React from "react";
import { Box, Typography } from "@mui/material";

export default function Footer() {
  return (
    <Box
      sx={{
        px: { xs: 2, md: 3 },
        py: 2,
        borderTop: "1px solid rgba(255,255,255,0.08)",
        opacity: 0.85,
      }}
    >
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        © {new Date().getFullYear()} Innerwall • Dashboard
      </Typography>
    </Box>
  );
}
