import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function Dashboard() {
  const { user, loading, balance } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;

    async function loadStats() {
      try {
        const [streams, transactions] = await Promise.all([
          api.getStreams(`q=`),
          api.getTransactions()
        ]);

        const myStreams = streams.filter(s => s.broadcaster === user.username);
        const tipsReceived = transactions.filter(t => t.type === 'tip_received');
        const totalTips = tipsReceived.reduce((sum, t) => sum + t.amount, 0);
        const tips30 = tipsReceived
          .filter(t => new Date(t.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
          .reduce((sum, t) => sum + t.amount, 0);

        setStats({ myStreams, totalTips, tips30, tipCount: tipsReceived.length });
      } catch (err) {
        setError(err.message);
      }
    }

    loadStats();
  }, [user]);

  if (loading) return null;

  if (!user) {
    return (
      <div><Navbar />
        <div className="container"><p>Accedi per vedere la tua dashboard.</p></div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="container">
        <h1>Ciao, @{user.username}!</h1>

        {error && <p className="error-text">{error}</p>}

        <div className="grid" style={{ marginBottom: '2rem' }}>
          {[
            { label: 'Saldo token', value: `🪙 ${balance}` },
            { label: 'Token ricevuti (totale)', value: stats?.totalTips || 0 },
            { label: 'Token ultimi 30gg', value: stats?.tips30 || 0 },
            { label: 'Tip ricevuti', value: stats?.tipCount || 0 }
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 26, fontWeight: 600, color: '#a78bfa', margin: '0 0 4px' }}>{s.value}</p>
              <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <Link href="/create-stream"><button>🎥 Vai Live</button></Link>
          <Link href="/tokens"><button style={{ background: '#1a1a1f', border: '1px solid #2a2a2f' }}>🪙 Gestisci token</button></Link>
        </div>

        <h2>I tuoi stream recenti</h2>
        {stats?.myStreams.length === 0 && (
          <p style={{ color: '#666' }}>Non hai ancora fatto stream. <Link href="/create-stream" style={{ color: '#a78bfa' }}>Vai live ora!</Link></p>
        )}
        <div className="grid">
          {stats?.myStreams.map(s => (
            <Link key={s.id} href={`/stream/${s.id}`}>
              <div className="card">
                {s.is_live && <span className="live-badge">LIVE</span>}
                <p style={{ fontWeight: 500, margin: '4px 0' }}>{s.title}</p>
                {s.category && <p style={{ fontSize: 12, color: '#6a3de8', margin: 0 }}>{s.category}</p>}
                {s.is_live && <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>👁 {s.viewers} spettatori</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
