const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.env.PORT || 3000;
const SESSION_COOKIE = 'session_id';
const SESSION_TTL_MS = 1000 * 60 * 60 * 4;
const sessions = new Map();

const demoUser = {
  id: 'usr_001',
  name: 'Jordan Lee',
  email: 'jordan@example.com',
  password: 'secret123'
};

const publicDir = path.join(__dirname, 'public');

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie || '')
      .split(';')
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
      })
  );
}

function createSession(userId) {
  const id = crypto.randomBytes(32).toString('hex');
  sessions.set(id, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return id;
}

function getCurrentUser(request) {
  const sessionId = parseCookies(request)[SESSION_COOKIE];
  const session = sessionId && sessions.get(sessionId);

  if (!session || session.expiresAt < Date.now()) {
    if (sessionId) sessions.delete(sessionId);
    return null;
  }

  return session.userId === demoUser.id ? demoUser : null;
}

function cookieHeader(name, value, options = {}) {
  const attributes = [`${name}=${encodeURIComponent(value)}`, 'Path=/'];
  if (options.maxAge !== undefined) attributes.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly !== false) attributes.push('HttpOnly');
  attributes.push('SameSite=Lax');
  if (process.env.NODE_ENV === 'production') attributes.push('Secure');
  return attributes.join('; ');
}

function sendJson(response, statusCode, body, headers = {}) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  response.end(payload);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) request.destroy();
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    request.on('error', reject);
  });
}

function serveStatic(request, response) {
  const requestedPath = new URL(request.url, `http://${request.headers.host}`).pathname;
  const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.slice(1);
  const filePath = path.resolve(publicDir, relativePath);

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const extension = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8'
    };
    response.writeHead(200, { 'Content-Type': contentTypes[extension] || 'application/octet-stream' });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'POST' && url.pathname === '/api/login') {
    try {
      const { email, password } = await readJson(request);
      if (email !== demoUser.email || password !== demoUser.password) {
        sendJson(response, 401, { error: 'That email and password do not match.' });
        return;
      }

      const sessionId = createSession(demoUser.id);
      sendJson(response, 200, { user: { name: demoUser.name, email: demoUser.email } }, {
        'Set-Cookie': cookieHeader(SESSION_COOKIE, sessionId, { maxAge: SESSION_TTL_MS / 1000 })
      });
    } catch {
      sendJson(response, 400, { error: 'Please send valid login details.' });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/logout') {
    const sessionId = parseCookies(request)[SESSION_COOKIE];
    if (sessionId) sessions.delete(sessionId);
    sendJson(response, 200, { message: 'You have been signed out.' }, {
      'Set-Cookie': cookieHeader(SESSION_COOKIE, '', { maxAge: 0 })
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/session') {
    const user = getCurrentUser(request);
    if (!user) {
      sendJson(response, 401, { authenticated: false });
      return;
    }
    sendJson(response, 200, {
      authenticated: true,
      user: { name: user.name, email: user.email }
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/private/overview') {
    const user = getCurrentUser(request);
    if (!user) {
      sendJson(response, 401, { error: 'Authentication required.' });
      return;
    }
    sendJson(response, 200, {
      greeting: `Good morning, ${user.name.split(' ')[0]}.`,
      metrics: [
        { label: 'Active projects', value: '08', change: '+2 this week' },
        { label: 'Focus hours', value: '24.5', change: '+18% from last week' },
        { label: 'Tasks shipped', value: '42', change: 'Across 4 teams' }
      ]
    });
    return;
  }

  serveStatic(request, response);
});

server.listen(PORT, () => {
  console.log(`Session workspace running at http://localhost:${PORT}`);
});
