import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await api.login(form);
      login(data.token, data.user);
      router.push('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <Navbar />
      <div className="form-box">
        <h2>Accedi a Cam2Me</h2>
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" required onChange={e => setForm({ ...form, email: e.target.value })} />
          <input type="password" placeholder="Password" required onChange={e => setForm({ ...form, password: e.target.value })} />
          {error && <p className="error-text">{error}</p>}
          <button type="submit" style={{ width: '100%', marginTop: '0.5rem' }}>Accedi</button>
        </form>
        <p style={{ marginTop: '1rem', fontSize: 13, color: '#888' }}>
          Non hai un account? <Link href="/register" style={{ color: '#a78bfa' }}>Registrati gratis</Link>
        </p>
      </div>
    </div>
  );
}
