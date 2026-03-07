import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './password.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ACCOUNTS_DIR = path.join(ROOT_DIR, 'Accounts');
const DATA_DIR = path.join(ACCOUNTS_DIR, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.csv');
const HEADER = 'id,username,password_hash,role,created';

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function ensureUsersFile() {
  await ensureDataDir();
  try {
    await fs.access(USERS_FILE);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(USERS_FILE, `${HEADER}\n`, 'utf8');
    } else {
      throw err;
    }
  }
}

function normalizeHashFromFields(fields) {
  if (fields.length < 5) return null;
  const hashParts = fields.slice(2, fields.length - 2);
  if (!hashParts.length) return null;
  return hashParts.join(',');
}

async function loadUsers() {
  try {
    const content = await fs.readFile(USERS_FILE, 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) {
      return [];
    }

    return lines.slice(1).reduce((users, line) => {
      const fields = line.split(',');
      const password_hash = normalizeHashFromFields(fields);
      if (password_hash === null) {
        return users;
      }

      const id = Number(fields[0]);
      const username = fields[1];
      const role = fields[fields.length - 2];
      const created = fields[fields.length - 1];
      users.push({
        id,
        username,
        password_hash,
        role,
        created,
      });
      return users;
    }, []);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export async function getUserByUsername(username) {
  if (!username) return null;
  const users = await loadUsers();
  return users.find((user) => user.username === username) ?? null;
}

export async function getUserById(id) {
  if (typeof id !== 'number') return null;
  const users = await loadUsers();
  return users.find((user) => user.id === id) ?? null;
}

export async function createUser(username, passwordHash, role = 'user') {
  if (!username || !passwordHash) {
    throw new Error('username and passwordHash are required to create a user');
  }

  await ensureUsersFile();
  const users = await loadUsers();
  const exists = users.some((user) => user.username === username);
  if (exists) {
    throw new Error('username already exists');
  }

  const nextId = users.reduce((current, user) => Math.max(current, user.id), 0) + 1;
  const created = new Date().toISOString().split('T')[0];
  const line = `${nextId},${username},${passwordHash},${role},${created}\n`;
  await fs.appendFile(USERS_FILE, line, 'utf8');

  return {
    id: nextId,
    username,
    password_hash: passwordHash,
    role,
    created,
  };
}

export async function ensureDefaultAdminAccount() {
  await ensureUsersFile();
  const users = await loadUsers();
  const hasAdmin = users.some((user) => user.username === 'admin');
  if (hasAdmin) {
    return null;
  }

  const passwordHash = await hashPassword('admin');
  const adminUser = await createUser('admin', passwordHash, 'admin');
  console.warn('Default admin account created. Change password immediately.');
  return adminUser;
}
