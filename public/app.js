const app = document.querySelector('#app');

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function renderLogin(error = '') {
  app.innerHTML = `
    <div class="auth-view">
      <p class="kicker">Welcome back</p>
      <h2>Sign in to your workspace.</h2>
      <p class="subtle">Your projects are waiting where you left them.</p>
      <form id="login-form">
        <label class="form-field">Email<input name="email" type="email" value="jordan@example.com" autocomplete="email" required /></label>
        <label class="form-field">Password<input name="password" type="password" value="secret123" autocomplete="current-password" required /></label>
        ${error ? `<p class="error" role="alert">${error}</p>` : ''}
        <button class="primary-button" type="submit">Enter workspace <span aria-hidden="true">-&gt;</span></button>
      </form>
      <div class="demo-hint">Demo access: <strong>jordan@example.com</strong> / <strong>secret123</strong></div>
    </div>`;
  document.querySelector('#login-form').addEventListener('submit', handleLogin);
}

async function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  button.textContent = 'Opening workspace...';
  try {
    await request('/api/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) });
    await renderDashboard();
  } catch (error) {
    renderLogin(error.message);
  }
}

async function renderDashboard() {
  try {
    const session = await request('/api/session');
    const overview = await request('/api/private/overview');
    app.innerHTML = `
      <div class="dashboard">
        <header class="dashboard-header">
          <div><p class="kicker">Private / Overview</p><h2>${overview.greeting}</h2><p class="subtle">Here is the shape of your week so far.</p></div>
          <button class="logout-button" id="logout-button" type="button">Log out</button>
        </header>
        <p class="section-label">Your signals</p>
        <section class="metric-grid" aria-label="Workspace metrics">
          ${overview.metrics.map((metric) => `<article class="metric"><span class="metric-label">${metric.label}</span><strong class="metric-value">${metric.value}</strong><span class="metric-change">${metric.change}</span></article>`).join('')}
        </section>
        <p class="section-label">Next on the horizon</p>
        <section class="activity"><p>“The best time to begin was yesterday. The next best time is now.”</p><span>Focus note / 01</span></section>
      </div>`;
    document.querySelector('#logout-button').addEventListener('click', handleLogout);
    return session;
  } catch {
    renderLogin();
  }
}

async function handleLogout() {
  await request('/api/logout', { method: 'POST' });
  renderLogin();
}

renderDashboard();
