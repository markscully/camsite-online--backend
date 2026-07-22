import { useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const CATEGORIES = ['Musica', 'Gaming', 'Arte', 'Cucina', 'Sport', 'Tecnologia', 'Chiacchiere'];

export default function CreateStream() {
  const [form, setForm] = useState({ title: '', category: '' });
  const [error, setError] = useState('');
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) return null;

  if (!user) {
    return (
      <div><Navbar />
        <div className="container"><p>Devi accedere per andare live.</p></div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const stream = await api.createStream(form);
      router.push(`/stream/${stream.id}?broadcaster=1`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <Navbar />
      <div className="form-box">
        <h2>Vai Live su Cam2Me</h2>
        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 13, color: '#aaa' }}>Titolo dello stream</label>
          <input
            placeholder="Es. Gaming con gli iscritti!"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            required
          />
          <label style={{ fontSize: 13, color: '#aaa', marginTop: 8, display: 'block' }}>Categoria</label>
          <select
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            style={{ width: '100%', padding: '0.6rem', background: '#0f0f12', border: '1px solid #333', borderRadius: 4, color: '#fff', marginTop: 4 }}
          >
            <option value="">Seleziona categoria...</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" style={{ width: '100%', marginTop: '1rem' }}>Crea stream e vai live</button>
        </form>
        <p style={{ fontSize: 12, color: '#666', marginTop: '1rem' }}>
          La tua webcam verrà attivata direttamente nel browser tramite LiveKit — nessun software aggiuntivo necessario.
        </p>
      </div>
    </div>
  );
}
