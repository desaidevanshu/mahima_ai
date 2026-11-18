const DEFAULT_API_BASE = import.meta.env.PROD
  ? 'https://mahima-ai.vercel.app'
  : 'http://localhost:8000'
const API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, '')

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `API request failed (${response.status})`)
  }
  return response.status === 204 ? null : response.json()
}

export const api = {
  submitEnquiry: payload => request('/api/public/enquiries', { method: 'POST', body: JSON.stringify(payload) }),
  submitVoiceEnquiry: payload => request('/api/public/voice-enquiries', { method: 'POST', body: JSON.stringify(payload) }),
  getTeamMe: token => request('/api/team/me', { token }),
  registerSales: token => request('/api/team/register-sales', { token, method: 'POST' }),
  getLeads: token => request('/api/leads', { token }),
  createLead: (token, payload) => request('/api/leads', { token, method: 'POST', body: JSON.stringify(payload) }),
  getCalls: token => request('/api/calls', { token }),
}
