let _apiHostname = null;
let _webHostname = null;
let _configPromise = null;

async function loadConfig() {
  if (_apiHostname && _webHostname) return;
  if (!_configPromise) {
    _configPromise = (async () => {
      const response = await fetch('/conf.yaml');
      if (!response.ok) throw new Error(`Failed to fetch conf.yaml: ${response.status}`);
      const text = await response.text();
      const apiMatch = text.match(/api_hostname:\s*["']?([^"'\n]+)["']?\s*$/m);
      const webMatch = text.match(/web_hostname:\s*["']?([^"'\n]+)["']?\s*$/m);
      if (!apiMatch) throw new Error('API hostname not found in conf.yaml');
      if (!webMatch) throw new Error('Web hostname not found in conf.yaml');
      _apiHostname = apiMatch[1].trim();
      _webHostname = webMatch[1].trim();
    })();
  }
  await _configPromise;
}

export async function getApiHostname() {
  await loadConfig();
  return _apiHostname;
}

export async function getWebHostname() {
  await loadConfig();
  return _webHostname;
}

async function apiBase() {
  const host = await getApiHostname();
  return `${host}/api/v3`;
}

export async function createRecord(url, customKeyword = '', expiresIn = '7d') {
  const base = await apiBase();
  const res = await fetch(`${base}/create_record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ url, custom_keyword: customKeyword, expires_in: expiresIn }),
    credentials: 'include',
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function searchRecord(shortKey) {
  const base = await apiBase();
  const res = await fetch(`${base}/search_record?${new URLSearchParams({ short_key: shortKey })}`, {
    method: 'GET',
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function login(username, password) {
  const base = await apiBase();
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
    credentials: 'include',
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function logout() {
  const base = await apiBase();
  const res = await fetch(`${base}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function adminCheck() {
  const base = await apiBase();
  const res = await fetch(`${base}/admin_check`, {
    method: 'GET',
    credentials: 'include',
  });
  return { ok: res.ok, status: res.status };
}

export async function changePassword(newPass) {
  const base = await apiBase();
  const res = await fetch(`${base}/change_pass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ new_pass: newPass }),
    credentials: 'include',
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function getAllRecords() {
  const base = await apiBase();
  const res = await fetch(`${base}/get_all_records`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function deleteRecord(url) {
  const base = await apiBase();
  const res = await fetch(`${base}/delete_record`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ url }),
    credentials: 'include',
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function deleteAllRecords() {
  const base = await apiBase();
  const res = await fetch(`${base}/delete_all_records`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}
