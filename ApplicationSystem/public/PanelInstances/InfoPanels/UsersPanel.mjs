// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/UsersPanel.mjs
// This file defines browser-side Users Panel logic for the Nodevision UI. It renders interface components and handles user interactions.

import { updateToolbarState } from "/panels/createToolbar.mjs";

const TEMPLATE = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <div>
      <h3 style="margin:0;font-size:1.1em;">Registered Users</h3>
      <p style="margin:4px 0 0;color:#666;font-size:0.9em;">Add, revoke, and update roles for Notebook users.</p>
    </div>
    <button type="button" data-refresh
      style="border:1px solid #ccc;border-radius:4px;background:#fff;padding:6px 12px;font-size:0.85em;cursor:pointer;">
      Refresh
    </button>
  </div>
  <div data-status style="min-height:22px;margin-bottom:8px;font-size:0.9em;"></div>
  <div data-users-list style="display:flex;flex-direction:column;gap:12px;max-height:300px;overflow:auto;padding-right:4px;"></div>
  <form data-add-user-form
    style="margin-top:14px;border-top:1px solid #e0e0e0;padding-top:14px;display:flex;flex-wrap:wrap;gap:14px;">
    <fieldset style="border:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;flex:1 1 210px;min-width:180px;">
      <label style="font-weight:600;font-size:0.9em;">Username
        <input name="username" required placeholder="new user" autocomplete="username"
          style="width:100%;padding:8px;border-radius:4px;border:1px solid #c4c4c4;font-size:0.95em;" />
      </label>
      <label style="font-weight:600;font-size:0.9em;">Password
        <input name="password" type="password" required autocomplete="new-password"
          style="width:100%;padding:8px;border-radius:4px;border:1px solid #c4c4c4;font-size:0.95em;" />
      </label>
    </fieldset>
    <fieldset style="border:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;flex:1 1 170px;min-width:170px;">
      <label style="font-weight:600;font-size:0.9em;">Role
        <select name="role" style="width:100%;padding:8px;border-radius:4px;border:1px solid #c4c4c4;font-size:0.95em;">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <button type="submit"
        style="padding:9px 14px;border:none;border-radius:4px;background:#0a84ff;color:#fff;font-weight:600;font-size:0.95em;cursor:pointer;">
        Add user
      </button>
    </fieldset>
  </form>
`;

function escapeHtml(value = "") {
  return `${value}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showStatus(statusEl, message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#c12d2d" : "#0a8c34";
}

function buildUserCard(user) {
  const created = user.created || "unknown";
  const roleOptions = ["user", "admin"]
    .map((role) => {
      const selected = role === user.role ? "selected" : "";
      return `<option value="${role}" ${selected}>${role}</option>`;
    })
    .join("");
  return `
    <div class="user-row" data-user-id="${user.id}"
      style="border:1px solid #e1e1e1;border-radius:6px;padding:12px;background:#fff;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <div>
          <div style="font-weight:600;font-size:1em;">${escapeHtml(user.username)}</div>
          <div style="color:#646464;font-size:0.85em;">ID ${user.id} · ${escapeHtml(user.role)} · created ${escapeHtml(created)}</div>
        </div>
        <span style="font-size:0.8em;color:#444;">${escapeHtml(user.role)}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;">
        <label style="display:flex;flex-direction:column;font-size:0.85em;">
          Role
          <select data-role-select style="margin-top:4px;padding:6px 10px;border-radius:4px;border:1px solid #bbb;">
            ${roleOptions}
          </select>
        </label>
        <label style="display:flex;flex-direction:column;font-size:0.85em;">
          Reset password
          <div style="display:flex;gap:6px;margin-top:4px;">
            <input data-reset-password type="password" placeholder="new password"
              style="flex:1;padding:6px;border-radius:4px;border:1px solid #bbb;" />
            <button type="button" data-action="reset-password"
              style="padding:6px 12px;border:none;border-radius:4px;background:#f5a623;color:#fff;cursor:pointer;">
              Apply
            </button>
          </div>
        </label>
        <button type="button" data-action="delete"
          style="padding:6px 12px;border:none;border-radius:4px;background:#b03030;color:#fff;cursor:pointer;">
          Remove
        </button>
      </div>
    </div>
  `;
}

export async function init(content, panelVars = {}, panelRoot = null) {
  updateToolbarState({ activePanelType: "UsersPanel" });
  const titleEl = panelRoot?.querySelector(".panel-title");
  if (titleEl) {
    titleEl.textContent = panelVars.displayName || "Users";
  }

  content.innerHTML = TEMPLATE;
  const statusEl = content.querySelector("[data-status]");
  const listEl = content.querySelector("[data-users-list]");
  const refreshBtn = content.querySelector("[data-refresh]");
  const addForm = content.querySelector("[data-add-user-form]");
  let users = [];

  const renderUsers = () => {
    if (!listEl) return;
    if (!users.length) {
      listEl.innerHTML = `<div style="color:#777;">No registered users found.</div>`;
      return;
    }
    listEl.innerHTML = users.map(buildUserCard).join("");
  };

  const postAction = async (url, options = {}) => {
    const init = {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      ...options,
    };
    const res = await fetch(url, init);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload.error || "Request failed");
    }
    return payload;
  };

  const loadUsers = async () => {
    if (!listEl) return;
    showStatus(statusEl, "Loading users...");
    try {
      const res = await fetch("/api/users", { cache: "no-store", credentials: "include" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Unable to load users");
      }
      const payload = await res.json();
      users = Array.isArray(payload.users) ? payload.users : [];
      renderUsers();
      showStatus(statusEl, `Loaded ${users.length} user(s).`);
    } catch (err) {
      console.error("Users list failed:", err);
      listEl.innerHTML = `<div style="color:#b42;">${escapeHtml(err.message || "Access denied")}</div>`;
      showStatus(statusEl, err.message || "Failed to load users", true);
    }
  };

  listEl?.addEventListener("change", async (evt) => {
    const select = evt.target.closest("[data-role-select]");
    if (!select) return;
    const row = select.closest("[data-user-id]");
    const userId = Number(row?.dataset.userId);
    if (!userId) return;
    const role = select.value;
    showStatus(statusEl, `Updating role for ${userId}...`);
    try {
      await postAction(`/api/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      showStatus(statusEl, "Role updated.");
      await loadUsers();
    } catch (err) {
      console.error("Role update failed:", err);
      showStatus(statusEl, err.message || "Update failed", true);
    }
  });

  listEl?.addEventListener("click", async (evt) => {
    const button = evt.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const row = button.closest("[data-user-id]");
    const userId = Number(row?.dataset.userId);
    if (!userId) return;

    if (action === "delete") {
      const confirmed = window.confirm("Remove this user? This action cannot be undone.");
      if (!confirmed) return;
      showStatus(statusEl, `Removing user ${userId}...`);
      try {
        await postAction(`/api/users/${userId}`, {
          method: "DELETE",
          body: "{}",
        });
        showStatus(statusEl, "User removed.");
        await loadUsers();
      } catch (err) {
        console.error("Delete user failed:", err);
        showStatus(statusEl, err.message || "Delete failed", true);
      }
      return;
    }

    if (action === "reset-password") {
      const input = row.querySelector("input[data-reset-password]");
      const newPassword = input?.value || "";
      if (!newPassword) {
        showStatus(statusEl, "Enter a new password before applying.", true);
        return;
      }
      showStatus(statusEl, `Resetting password for ${userId}...`);
      button.disabled = true;
      try {
        await postAction(`/api/users/${userId}/password`, {
          method: "POST",
          body: JSON.stringify({ newPassword }),
        });
        showStatus(statusEl, "Password reset.");
        input.value = "";
      } catch (err) {
        console.error("Password reset failed:", err);
        showStatus(statusEl, err.message || "Reset failed", true);
      } finally {
        button.disabled = false;
      }
    }
  });

  refreshBtn?.addEventListener("click", () => loadUsers());

  addForm?.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    const formData = new FormData(addForm);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    const role = String(formData.get("role") || "user");

    if (!username || !password) {
      showStatus(statusEl, "Username and password are required.", true);
      return;
    }

    showStatus(statusEl, "Creating user...");
    try {
      await postAction("/api/users", {
        method: "POST",
        body: JSON.stringify({ username, password, role }),
      });
      showStatus(statusEl, "User created.");
      addForm.reset();
      await loadUsers();
    } catch (err) {
      console.error("Add user failed:", err);
      showStatus(statusEl, err.message || "Failed to add user", true);
    }
  });

  await loadUsers();
}
