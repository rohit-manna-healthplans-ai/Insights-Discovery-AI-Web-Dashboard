import React, { createContext, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "da_selected_user_v1";

export const UserSelectionContext = createContext(null);

export function useUserSelection() {
  return useContext(UserSelectionContext);
}

function safeParse(jsonStr) {
  try {
    return JSON.parse(jsonStr);
  } catch (_) {
    return null;
  }
}

export default function UserSelectionProvider({ children }) {
  const [selectedUser, setSelectedUserState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? safeParse(raw) : null;
    } catch (_) {
      return null;
    }
  });

  function setSelectedUser(user) {
    setSelectedUserState(user || null);
    try {
      if (!user) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch (_) {}
  }

  function clearSelectedUser() {
    setSelectedUser(null);
  }

  const value = useMemo(
    () => ({ selectedUser, setSelectedUser, clearSelectedUser }),
    [selectedUser]
  );

  return (
    <UserSelectionContext.Provider value={value}>
      {children}
    </UserSelectionContext.Provider>
  );
}
