const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

async function request(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem('fixit_token');
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text || 'Request failed' }; }
  if (!response.ok) throw new Error(data?.message || 'Request failed');
  return data;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body: any, extraHeaders?: HeadersInit) => request(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body), headers: extraHeaders }),
  put: (path: string, body: any) => request(path, { method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body) }),
};

export function fileUrl(path: string) {
  return `${API}${path}`;
}
