// Nodevision/ApplicationSystem/routes/api/userRoutes.js
// This file defines the user Routes API route handler for the Nodevision server. It validates requests and sends responses for user Routes operations.
// routes/api/userRoutes.js
// User management API for notebook accounts.

import express from 'express';
import { hashPassword, verifyPassword } from '../../Auth/password.mjs';
import {
  createUser,
  deleteUserById,
  getUserById,
  listUsers,
  updateUserPasswordById,
  updateUserRoleById,
} from '../../Auth/userStore.mjs';

const router = express.Router();

function requireIdentity(req, res, next) {
  if (req.identity) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

function requireAdmin(req, res, next) {
  if (req.identity?.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin role required' });
}

function sanitizeUser(user) {
  if (!user) return null;
  const { id, username, role, created } = user;
  return { id, username, role, created };
}

function parseUserIdParam(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid user id' });
    return null;
  }
  return id;
}

router.use(requireIdentity);

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await listUsers();
    res.json({ users: users.map(sanitizeUser) });
  } catch (err) {
    console.error('Failed to list users:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/users', requireAdmin, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const roleInput = String(req.body.role || 'user').toLowerCase();
    const role = roleInput === 'admin' ? 'admin' : 'user';

    if (!username) {
      return res.status(400).json({ error: 'username is required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'password is required' });
    }

    const hashed = await hashPassword(password);
    const user = await createUser(username, hashed, role);
    res.status(201).json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('Failed to create user:', err);
    if (err.message?.includes('username already exists')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.patch('/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const userId = parseUserIdParam(req, res);
    if (userId === null) return;

    const roleInput = String(req.body.role || '').toLowerCase();
    if (!roleInput) {
      return res.status(400).json({ error: 'role is required' });
    }

    const normalizedRole = roleInput === 'admin' ? 'admin' : 'user';

    const users = await listUsers();
    const target = users.find((user) => user.id === userId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    const adminCount = users.filter((user) => user.role === 'admin').length;
    if (target.role === 'admin' && normalizedRole !== 'admin' && adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last admin' });
    }

    const updated = await updateUserRoleById(userId, normalizedRole);
    res.json({ user: sanitizeUser(updated) });
  } catch (err) {
    console.error('Failed to update user role:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = parseUserIdParam(req, res);
    if (userId === null) return;

    const users = await listUsers();
    const target = users.find((user) => user.id === userId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (target.id === req.identity.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const adminCount = users.filter((user) => user.role === 'admin').length;
    if (target.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last admin' });
    }

    await deleteUserById(userId);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.post('/users/:id/password', async (req, res) => {
  try {
    const userId = parseUserIdParam(req, res);
    if (userId === null) return;

    const target = await getUserById(userId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    const identity = req.identity;
    const newPassword = String(req.body.newPassword || '');
    if (!newPassword) {
      return res.status(400).json({ error: 'newPassword is required' });
    }

    if (identity.role === 'admin' && identity.id !== userId) {
      const hashed = await hashPassword(newPassword);
      await updateUserPasswordById(userId, hashed);
      return res.json({ success: true });
    }

    if (identity.id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const currentPassword = String(req.body.currentPassword || '');
    if (!currentPassword) {
      return res.status(400).json({ error: 'currentPassword is required' });
    }

    const matches = await verifyPassword(currentPassword, target.password_hash);
    if (!matches) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashed = await hashPassword(newPassword);
    await updateUserPasswordById(userId, hashed);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to change password:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
