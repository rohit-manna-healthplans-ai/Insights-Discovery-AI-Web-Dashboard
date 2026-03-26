import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";

import App from "./App.jsx";
import ThemeProvider from "./app/providers/ThemeProvider.jsx";
import AuthProvider from "./app/providers/AuthProvider.jsx";
import UserSelectionProvider from "./app/providers/UserSelectionProvider.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <UserSelectionProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </UserSelectionProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
