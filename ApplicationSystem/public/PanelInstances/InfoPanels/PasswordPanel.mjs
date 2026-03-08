// Nodevision/public/PanelInstances/InfoPanels/PasswordPanel.mjs
// Native InfoPanel for changing the current user's password.

import { updateToolbarState } from "/panels/createToolbar.mjs";

const TEMPLATE = `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
    <div>
      <h3 style="margin:0;font-size:1.1em;">Change Password</h3>
      <p style="margin:4px 0 0;color:#666;font-size:0.9em;">Passwords are hashed before being stored.</p>
    </div>
    <span style="font-size:0.85em;color:#555;" data-username></span>
  </div>
  <form data-password-form style="display:flex;flex-direction:column;gap:12px;">
    <label style="font-weight:600;font-size:0.9em;">Current password
      <input type="password" name="currentPassword" autocomplete="current-password" required
        style="width:100%;padding:8px;border-radius:6px;border:1px solid #c4c4c4;font-size:0.95em;" />
    </label>
    <label style="font-weight:600;font-size:0.9em;">New password
      <input type="password" name="newPassword" autocomplete="new-password" required
        style="width:100%;padding:8px;border-radius:6px;border:1px solid #c4c4c4;font-size:0.95em;" />
    </label>
    <label style="font-weight:600;font-size:0.9em;">Confirm new password
      <input type="password" name="confirmPassword" autocomplete="new-password" required
        style="width:100%;padding:8px;border-radius:6px;border:1px solid #c4c4c4;font-size:0.95em;" />
    </label>
    <button type="submit"
      style="padding:10px 16px;border:none;border-radius:6px;background:#0a84ff;color:#fff;font-size:0.95em;font-weight:600;cursor:pointer;">
      Update password
    </button>
    <div data-status style="min-height:22px;font-size:0.9em;"></div>
  </form>
`;

function showStatus(statusEl, message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42241" : "#0a6f1f";
}

function setFormDisabled(form, disabled = true) {
  if (!form) return;
  form.querySelectorAll("input, button").forEach((control) => {
    control.disabled = disabled;
  });
}

export async function init(content, panelVars = {}, panelRoot = null) {
  updateToolbarState({ activePanelType: "PasswordPanel" });
  const titleEl = panelRoot?.querySelector(".panel-title");
  if (titleEl) {
    titleEl.textContent = panelVars.displayName || "Change Password";
  }

  content.innerHTML = TEMPLATE;
  const form = content.querySelector("[data-password-form]");
  const statusEl = content.querySelector("[data-status]");
  const userLabel = content.querySelector("[data-username]");
  let currentUserId = null;

  try {
    const sessionRes = await fetch("/api/session", { cache: "no-store", credentials: "include" });
    if (!sessionRes.ok) {
      throw new Error("Unable to verify session");
    }
    const sessionData = await sessionRes.json();
    if (!sessionData?.identity) {
      throw new Error("Not signed in");
    }
    currentUserId = sessionData.identity.id;
    if (userLabel) {
      userLabel.textContent = sessionData.identity.username || "";
    }
  } catch (err) {
    console.error("Password panel session check failed:", err);
    showStatus(statusEl, "Must be signed in to change password.", true);
    setFormDisabled(form, true);
    return;
  }

  if (!form) return;

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    if (!currentUserId) return;
    const currentPassword = (form.currentPassword?.value || "").trim();
    const newPassword = form.newPassword?.value || "";
    const confirmPassword = form.confirmPassword?.value || "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      showStatus(statusEl, "All fields are required.", true);
      return;
    }

    if (newPassword !== confirmPassword) {
      showStatus(statusEl, "Passwords do not match.", true);
      return;
    }

    setFormDisabled(form, true);
    showStatus(statusEl, "Updating password...");

    try {
      const res = await fetch(`/api/users/${currentUserId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to update password");
      }
      showStatus(statusEl, "Password updated successfully.");
      form.reset();
    } catch (err) {
      console.error("Password update failed:", err);
      showStatus(statusEl, err.message || "Unable to change password right now.", true);
    } finally {
      setFormDisabled(form, false);
    }
  });
}
