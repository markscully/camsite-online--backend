import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, balance } = useAuth();

  return (
    <nav className="navbar">
      <Link href="/"><strong style={{ color: '#a78bfa', fontSize: 20 }}>Cam2Me</strong></Link>
      <div>
        {user ? (
          <>
            <Link href="/tokens">
              <span style={{ color: '#ffd54f', marginLeft: '1rem' }}>🪙 {balance}</span>
            </Link>
            <Link href="/dashboard">
              <span style={{ marginLeft: '1rem', color: '#c9c8c5' }}>{user.username}</span>
            </Link>
            <Link href="/create-stream"><button style={{ marginLeft: '1rem' }}>Vai Live</button></Link>
            <button onClick={logout} style={{ marginLeft: '0.5rem', background: 'transparent', border: '1px solid #444', color: '#888' }}>Esci</button>
          </>
        ) : (
          <>
            <Link href="/login"><button style={{ background: 'transparent', border: '1px solid #6a3de8', color: '#a78bfa' }}>Accedi</button></Link>
            <Link href="/register"><button>Registrati</button></Link>
          </>
        )}
      </div>
    </nav>
  );
}
