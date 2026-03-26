/**
 * Matches discovery-ai-backend-main: plugin_users.trackerUserId and logs/screenshots.user_id.
 */
export function extensionUserId(u) {
  if (!u) return "";
  return String(u.user_id || u.tracker_user_id || u.user_mac_id || u._id || "").trim();
}
