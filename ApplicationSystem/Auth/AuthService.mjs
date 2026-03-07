import {
  createSession,
  deleteSession,
  validateSession,
} from './sessionManager.mjs';
import { getUserByUsername } from './userStore.mjs';
import { verifyPassword } from './password.mjs';
import { logEvent } from './authLogger.mjs';

const INVALID_CREDS_ERROR = new Error('Invalid credentials');

/**
 * Attempt to log in with a username and password.
 */
export async function login({ username, password, ip }) {
  try {
    if (!username || !password) {
      await logEvent('LOGIN_FAIL', { username, ip });
      throw INVALID_CREDS_ERROR;
    }

    const user = await getUserByUsername(username);
    if (!user) {
      await logEvent('LOGIN_FAIL', { username, ip });
      throw INVALID_CREDS_ERROR;
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      await logEvent('LOGIN_FAIL', { username, ip });
      throw INVALID_CREDS_ERROR;
    }

    const identity = {
      id: user.id,
      type: 'user',
      username: user.username,
      role: user.role,
    };

    const session = await createSession(identity);
    await logEvent('LOGIN_SUCCESS', {
      username: identity.username,
      role: identity.role,
      ip,
    });

    return {
      identity,
      token: session.token,
      expires: session.expires,
    };
  } catch (err) {
    if (err === INVALID_CREDS_ERROR) {
      throw err;
    }

    await logEvent('AUTH_FAIL', {
      username,
      error: err?.message ?? 'unknown',
    });
    throw err;
  }
}

export async function logout(token) {
  await deleteSession(token);
}

export async function authenticateRequest(req) {
  const token =
    req.cookies?.nodevision_session ||
    parseCookieHeader(req.headers?.cookie)?.nodevision_session;

  if (!token) {
    return null;
  }

  const session = await validateSession(token);
  if (!session) {
    return null;
  }

  return {
    id: session.identityId,
    type: session.type,
    username: session.username ?? 'unknown',
    role: session.role,
  };
}

function parseCookieHeader(header = '') {
  return header.split(';').reduce((acc, segment) => {
    const [key, value] = segment.trim().split('=');
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export function requireRole(role) {
  return async (req, res, next) => {
    try {
      const identity = req.identity ?? (await authenticateRequest(req));
      req.identity = identity;

      if (!identity || identity.role !== role) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
