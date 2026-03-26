import React from "react";
import UserDetail from "./UserDetail";

/**
 * Department members: only their own logs + screenshots (no user directory).
 */
export default function MyActivity() {
  return <UserDetail selfMode />;
}
