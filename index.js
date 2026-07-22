import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import { api } from '../lib/api';

const CATEGORIES = ['Tutti', 'Musica', 'Gaming', 'Arte', 'Cucina', 'Sport', 'Tecnologia', 'Chiacchiere'];

export default function Home() {
  const [streams, setStreams] = useState([]);
  const [category, setCategory] = useState('Tutti');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== 'Tutti') params.set('category', category);
    if (search) params.set('q', search);
    api.getStreams(params.toString()).then(setStreams).catch(err => setError(err.message));
  }, [category, search]);

  return (
    <div>
      <Navbar />
      <div className="container">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1.5rem 0 1rem' }}>
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{
                background: category === c ? '#6a3de8' : '#1a1a1f',
                border: '1px solid #2a2a2f',
                padding: '6px 14px',
                fontSize: 13
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <input
          placeholder="Cerca stream..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 320, marginBottom: '1rem' }}
        />

        {error && <p className="error-text">{error}</p>}
        {streams.length === 0 && !error && (
          <p style={{ color: '#666' }}>Nessuno stream disponibile. Sii il primo a <Link href="/create-stream" style={{ color: '#a78bfa' }}>andare live</Link>!</p>
        )}

        <div className="grid">
          {streams.map(s => (
            <Link key={s.id} href={`/stream/${s.id}`}>
              <div className="card">
                <div className="card-thumb">
                  {s.avatar_url
                    ? <img src={s.avatar_url} alt={s.broadcaster} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                    : <span style={{ fontSize: 36 }}>🎥</span>
                  }
                  {s.is_live && <span className="live-badge" style={{ position: 'absolute', top: 8, left: 8 }}>LIVE</span>}
                  {s.is_live && (
                    <span style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.7)', fontSize: 12, padding: '2px 8px', borderRadius: 4 }}>
                      👁 {s.viewers}
                    </span>
                  )}
                </div>
                {s.is_live && <span className="live-badge">LIVE</span>}
                <h3 style={{ margin: '4px 0', fontSize: 14 }}>{s.title}</h3>
                <p style={{ margin: 0, fontSize: 12, color: '#888' }}>@{s.broadcaster}</p>
                {s.category && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6a3de8' }}>{s.category}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
