import React, { useState } from "react";
import { Box, Drawer } from "@mui/material";
import { useLocation } from "react-router-dom";

import Sidebar, { SidebarContent } from "./Sidebar";
import Topbar from "./Topbar";
import Footer from "./Footer";

export default function DashboardLayout({ children }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ position: "relative", minHeight: "100vh", width: "100%" }}>
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          minHeight: "100vh",
          width: "100%",
          alignItems: "stretch",
        }}
      >
        <Sidebar />

        <Drawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{ display: { xs: "block", md: "none" } }}
          PaperProps={{
            sx: {
              width: 300,
              background: "transparent",
              boxShadow: "none",
              p: 2,
            },
          }}
        >
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </Drawer>

        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Topbar onOpenSidebar={() => setMobileOpen(true)} />

          <Box sx={{ px: { xs: 2, md: 3 }, py: 2, flex: 1, minWidth: 0 }} key={location.pathname}>
            <div className="dash-page">{children}</div>
          </Box>

          <Footer />
        </Box>
      </Box>
    </Box>
  );
}
