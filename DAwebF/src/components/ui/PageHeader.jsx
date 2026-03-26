import React from "react";
import { Box, Typography } from "@mui/material";

/**
 * Clean, consistent header for every dashboard tab.
 * - title + subtitle on left
 * - right-side actions/filters slot
 */
export default function PageHeader({ title, subtitle, right }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 950, fontSize: 22, lineHeight: 1.15 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" className="muted" sx={{ display: "block", mt: 0.6 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>

      {right ? <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>{right}</Box> : null}
    </Box>
  );
}
