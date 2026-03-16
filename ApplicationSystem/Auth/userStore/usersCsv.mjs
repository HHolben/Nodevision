// Nodevision/ApplicationSystem/Auth/userStore/usersCsv.mjs
// This file reads and writes the users CSV store so that authentication modules can persist user accounts in a simple filesystem-backed format.

import fs from "node:fs/promises";
import path from "node:path";
import { createServerContext } from "../../shared/serverContext.mjs";

const ctx = createServerContext();
const DATA_DIR = ctx.accountsDataDir;
const USERS_FILE = path.join(DATA_DIR, "users.csv");
const HEADER = "id,username,password_hash,role,created";

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function ensureUsersFile() {
  await ensureDataDir();
  try {
    await fs.access(USERS_FILE);
  } catch (err) {
    if (err.code === "ENOENT") {
      await fs.writeFile(USERS_FILE, `${HEADER}\n`, "utf8");
    } else {
      throw err;
    }
  }
}

function normalizeHashFromFields(fields) {
  if (fields.length < 5) return null;
  const hashParts = fields.slice(2, fields.length - 2);
  if (!hashParts.length) return null;
  return hashParts.join(",");
}

export async function loadUsers() {
  try {
    const content = await fs.readFile(USERS_FILE, "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) return [];

    return lines.slice(1).reduce((users, line) => {
      const fields = line.split(",");
      const password_hash = normalizeHashFromFields(fields);
      if (password_hash === null) return users;

      const id = Number(fields[0]);
      const username = fields[1];
      const role = fields[fields.length - 2];
      const created = fields[fields.length - 1];
      users.push({ id, username, password_hash, role, created });
      return users;
    }, []);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

function serializeUserLine(user) {
  const { id, username, password_hash, role, created } = user;
  if (!Number.isInteger(id)) throw new Error("User record missing numeric id");
  if (!username || !password_hash || !role || !created) {
    throw new Error("Incomplete user record cannot be serialized");
  }
  return `${id},${username},${password_hash},${role},${created}`;
}

export async function persistUsers(users) {
  await ensureUsersFile();
  const lines = users.map(serializeUserLine);
  const content = lines.length ? `${HEADER}\n${lines.join("\n")}\n` : `${HEADER}\n`;
  await fs.writeFile(USERS_FILE, content, "utf8");
}

export async function appendUserLine(line) {
  await ensureUsersFile();
  await fs.appendFile(USERS_FILE, line, "utf8");
}

