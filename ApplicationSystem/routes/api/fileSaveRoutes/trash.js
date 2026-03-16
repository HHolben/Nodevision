// Nodevision/ApplicationSystem/routes/api/fileSaveRoutes/trash.js
// This file implements trash and delete behavior so that file save routes can move notebook and settings paths into a user trash directory before permanent removal.

import path from "node:path";
import fs from "node:fs/promises";

import { isWithin, resolveNotebookPath, resolveUserSettingsPath } from "./paths.js";

async function ensureTrashDirectory({ notebookRoot, userSettingsRoot }) {
  const legacyTrashDir = resolveNotebookPath({ notebookRoot, relativePath: "Trash" });
  const trashDir = resolveUserSettingsPath({ userSettingsRoot, relativePath: "Trash" });

  try {
    await fs.access(legacyTrashDir);
    await fs.access(trashDir);
  } catch {
    try {
      await fs.rename(legacyTrashDir, trashDir);
    } catch {
      // Best effort.
    }
  }

  await fs.mkdir(trashDir, { recursive: true });
  return trashDir;
}

export async function deleteOrTrashPath({
  notebookRoot,
  userSettingsRoot,
  userTrashRoot,
  relativePath,
  targetPath,
  deletingFromUserSettings,
}) {
  if (isWithin(userTrashRoot, targetPath)) {
    if (path.resolve(targetPath) === path.resolve(userTrashRoot)) {
      const err = new Error("Refusing to delete Trash root directory.");
      err.code = "TRASH_ROOT";
      throw err;
    }
    await fs.rm(targetPath, { recursive: true, force: true });
    return { permanentlyDeleted: true };
  }

  const trashDir = await ensureTrashDirectory({ notebookRoot, userSettingsRoot });

  const safeRelativePath = deletingFromUserSettings
    ? `UserSettings/${path.relative(userSettingsRoot, targetPath).split(path.sep).join("/")}`
    : path.relative(notebookRoot, targetPath).split(path.sep).join("/");
  const stamped = `${Date.now()}_${safeRelativePath}`;
  const trashPath = path.join(trashDir, stamped);

  await fs.mkdir(path.dirname(trashPath), { recursive: true });
  await fs.rename(targetPath, trashPath);
  return { trashedPath: trashPath };
}

