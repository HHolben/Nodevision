// Nodevision/ApplicationSystem/Auth/userStore.mjs
// This file implements user account CRUD helpers and default admin bootstrapping so that Nodevision authentication can manage local users consistently.

import { hashPassword } from './password.mjs';
import { appendUserLine, ensureUsersFile, loadUsers, persistUsers } from "./userStore/usersCsv.mjs";

const VALID_ROLES = new Set(['admin', 'user']);

function ensureValidRole(role) {
  if (!role || typeof role !== 'string') return 'user';
  return VALID_ROLES.has(role) ? role : 'user';
}

function findUserIndex(users, id) {
  return users.findIndex((user) => user.id === id);
}

function cloneUsers(users) {
  return users.map((user) => ({ ...user }));
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
  await appendUserLine(line);

  return {
    id: nextId,
    username,
    password_hash: passwordHash,
    role,
    created,
  };
}

export async function listUsers() {
  return await loadUsers();
}

async function updateUserField(id, updater) {
  if (!Number.isInteger(id)) {
    throw new Error('User id must be a number');
  }
  const users = cloneUsers(await loadUsers());
  const idx = findUserIndex(users, id);
  if (idx === -1) {
    throw new Error('User not found');
  }
  const updated = updater(users[idx]);
  users[idx] = { ...users[idx], ...updated };
  await persistUsers(users);
  return users[idx];
}

export async function updateUserPasswordById(id, passwordHash) {
  if (!passwordHash) {
    throw new Error('Password hash is required');
  }
  return await updateUserField(id, (user) => ({ password_hash: passwordHash }));
}

export async function updateUserRoleById(id, role) {
  const normalizedRole = ensureValidRole(role);
  return await updateUserField(id, (user) => ({ role: normalizedRole }));
}

export async function deleteUserById(id) {
  if (!Number.isInteger(id)) {
    throw new Error('User id must be a number');
  }
  const users = cloneUsers(await loadUsers());
  const idx = findUserIndex(users, id);
  if (idx === -1) {
    throw new Error('User not found');
  }
  const [removed] = users.splice(idx, 1);
  await persistUsers(users);
  return removed;
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
