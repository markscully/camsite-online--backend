import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await api.register(form);
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
        <h2>Crea il tuo account</h2>
        <form onSubmit={handleSubmit}>
          <input placeholder="Username" required onChange={e => setForm({ ...form, username: e.target.value })} />
          <input type="email" placeholder="Email" required onChange={e => setForm({ ...form, email: e.target.value })} />
          <input type="password" placeholder="Password (min 8 caratteri)" required onChange={e => setForm({ ...form, password: e.target.value })} />
          {error && <p className="error-text">{error}</p>}
          <button type="submit" style={{ width: '100%', marginTop: '0.5rem' }}>Registrati gratis</button>
        </form>
        <p style={{ marginTop: '1rem', fontSize: 13, color: '#888' }}>
          Hai già un account? <Link href="/login" style={{ color: '#a78bfa' }}>Accedi</Link>
        </p>
      </div>
    </div>
  );
}
