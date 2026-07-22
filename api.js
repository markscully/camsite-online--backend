const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || 'Errore di rete');
    error.code = data.code;
    throw error;
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  getStreams: (params) => request(`/streams${params ? `?${params}` : ''}`),
  getStream: (id) => request(`/streams/${id}`),
  createStream: (payload) => request('/streams', { method: 'POST', body: JSON.stringify(payload) }),
  endStream: (id) => request(`/streams/${id}/end`, { method: 'POST' }),
  getMessages: (id) => request(`/streams/${id}/messages`),
  getBroadcasterToken: (id) => request(`/streams/${id}/broadcaster-token`, { method: 'POST' }),
  getViewerToken: (id) => request(`/streams/${id}/viewer-token`, { method: 'POST' }),
  getTokenPackages: () => request('/tokens/packages'),
  getBalance: () => request('/tokens/balance'),
  getTransactions: () => request('/tokens/transactions'),
  purchaseMock: (packageId) => request('/tokens/purchase-mock', { method: 'POST', body: JSON.stringify({ packageId }) }),
  getPayoutInfo: () => request('/tokens/payout-info'),
  requestPayout: (payload) => request('/tokens/payout', { method: 'POST', body: JSON.stringify(payload) })
};

export { API_URL };
