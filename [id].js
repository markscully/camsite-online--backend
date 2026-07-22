import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { io } from 'socket.io-client';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { api, API_URL } from '../../lib/api';

const TIP_PRESETS = [10, 25, 50, 100];

// Componente broadcaster LiveKit (caricato dinamicamente per evitare SSR)
function BroadcasterView({ streamId, onEnd }) {
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('connecting');
  const videoRef = useRef(null);

  useEffect(() => {
    let lkRoom;

    async function start() {
      try {
        const { Room, createLocalTracks } = await import('livekit-client');
        const { token, livekitUrl } = await api.getBroadcasterToken(streamId);

        lkRoom = new Room();
        setRoom(lkRoom);

        lkRoom.on('connected', () => setStatus('live'));
        lkRoom.on('disconnected', () => setStatus('ended'));

        await lkRoom.connect(livekitUrl, token);

        const tracks = await createLocalTracks({ audio: true, video: true });
        for (const track of tracks) {
          await lkRoom.localParticipant.publishTrack(track);
          if (track.kind === 'video' && videoRef.current) {
            track.attach(videoRef.current);
          }
        }
        setStatus('live');
      } catch (err) {
        console.error('[LiveKit broadcaster]', err);
        setStatus('error');
      }
    }

    start();

    return () => {
      if (lkRoom) lkRoom.disconnect();
    };
  }, [streamId]);

  async function handleEnd() {
    if (room) room.disconnect();
    await api.endStream(streamId);
    onEnd();
  }

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', borderRadius: 8, background: '#000', aspectRatio: '16/9' }}
      />
      <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {status === 'live' && <span style={{ color: '#4caf50' }}>● LIVE</span>}
        {status === 'connecting' && <span style={{ color: '#ffb74d' }}>Connessione...</span>}
        {status === 'error' && <span className="error-text">Errore connessione LiveKit</span>}
        {status === 'live' && (
          <button onClick={handleEnd} style={{ background: '#c62828' }}>Termina stream</button>
        )}
      </div>
    </div>
  );
}

// Componente viewer LiveKit
function ViewerPlayer({ streamId }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    let lkRoom;

    async function start() {
      try {
        const { Room } = await import('livekit-client');
        const { token, livekitUrl } = await api.getViewerToken(streamId);

        lkRoom = new Room();

        lkRoom.on('trackSubscribed', (track, pub, participant) => {
          if (track.kind === 'video' && videoRef.current) {
            track.attach(videoRef.current);
            setStatus('playing');
          }
        });

        lkRoom.on('disconnected', () => setStatus('offline'));
        lkRoom.on('connected', () => setStatus('waiting'));

        await lkRoom.connect(livekitUrl, token);
      } catch (err) {
        console.error('[LiveKit viewer]', err);
        setStatus('error');
      }
    }

    start();
    return () => { if (lkRoom) lkRoom.disconnect(); };
  }, [streamId]);

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls
        style={{ width: '100%', borderRadius: 8, background: '#000', aspectRatio: '16/9' }}
      />
      {status === 'connecting' && <p style={{ color: '#ffb74d', fontSize: 13 }}>Connessione allo stream...</p>}
      {status === 'waiting' && <p style={{ color: '#888', fontSize: 13 }}>In attesa del broadcaster...</p>}
      {status === 'offline' && <p style={{ color: '#888', fontSize: 13 }}>Lo stream è terminato.</p>}
      {status === 'error' && <p className="error-text" style={{ fontSize: 13 }}>Errore connessione.</p>}
    </div>
  );
}

export default function StreamPage() {
  const router = useRouter();
  const { id, broadcaster: isBroadcasterParam } = router.query;
  const { user, balance, setBalanceDirect } = useAuth();

  const [stream, setStream] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [viewers, setViewers] = useState(0);
  const [error, setError] = useState('');
  const [tipError, setTipError] = useState('');
  const [tipSending, setTipSending] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const isBroadcaster = isBroadcasterParam === '1' || (user && stream && stream.broadcaster === user.username);

  useEffect(() => {
    if (!id) return;
    api.getStream(id).then(s => { setStream(s); setViewers(s.viewers); }).catch(err => setError(err.message));
    api.getMessages(id).then(setMessages).catch(() => {});

    const interval = setInterval(() => {
      api.getStream(id).then(s => setStream(prev => prev ? { ...prev, is_live: s.is_live } : s)).catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    const token = localStorage.getItem('token');
    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('join_stream', id));
    socket.on('chat_message', msg => setMessages(prev => [...prev, msg]));
    socket.on('viewer_count', count => setViewers(count));
    socket.on('balance_update', ({ balance }) => setBalanceDirect(balance));
    socket.on('tip_error', ({ error }) => { setTipError(error); setTipSending(false); });
    socket.on('stream_offline', () => setStream(prev => prev ? { ...prev, is_live: false } : prev));

    return () => socket.disconnect();
  }, [id, user, setBalanceDirect]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.emit('chat_message', { streamId: id, message: input });
    setInput('');
  }

  function sendTip(amount) {
    if (!socketRef.current) return;
    setTipError('');
    setTipSending(true);
    socketRef.current.emit('send_tip', { streamId: id, amount });
    setTimeout(() => setTipSending(false), 600);
  }

  if (!stream) return <div><Navbar /><div className="container"><p>Caricamento...</p></div></div>;

  return (
    <div>
      <Navbar />
      <div className="container">
        {error && <p className="error-text">{error}</p>}

        <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>{stream.title}</h1>
        <p style={{ color: '#888', fontSize: 13, margin: '0 0 12px' }}>
          @{stream.broadcaster}
          {stream.category && <span style={{ color: '#6a3de8', marginLeft: 8 }}>{stream.category}</span>}
          {' '}&mdash; {viewers} spettatori
          {stream.is_live && <span style={{ color: '#e53935', marginLeft: 8 }}>● LIVE</span>}
        </p>

        {isBroadcaster ? (
          <BroadcasterView streamId={id} onEnd={() => router.push('/')} />
        ) : (
          <ViewerPlayer streamId={id} />
        )}

        {user && !isBroadcaster && (
          <div className="card" style={{ margin: '1rem 0' }}>
            <strong>Supporta il creator 🪙</strong>
            <p style={{ fontSize: 12, color: '#888', margin: '4px 0 8px' }}>Saldo: {balance} token</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {TIP_PRESETS.map(amount => (
                <button key={amount} disabled={tipSending || balance < amount} onClick={() => sendTip(amount)}
                  style={{ fontSize: 13 }}>
                  🪙 {amount}
                </button>
              ))}
            </div>
            {tipError && <p className="error-text" style={{ fontSize: 12, margin: '4px 0 0' }}>{tipError}</p>}
            {balance < 10 && (
              <p style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                <a href="/tokens" style={{ color: '#a78bfa' }}>Acquista token →</a>
              </p>
            )}
          </div>
        )}

        <div className="chat-box">
          <div className="chat-messages">
            {messages.map(m => (
              <div key={m.id} className={`msg${m.is_tip ? ' tip' : ''}`}>
                {m.is_tip
                  ? <span>🪙 <span className="username">{m.username}</span> {m.message}</span>
                  : <><span className="username">{m.username}: </span><span>{m.message}</span></>
                }
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          {user ? (
            <form className="chat-input" onSubmit={sendMessage}>
              <input value={input} onChange={e => setInput(e.target.value)} placeholder="Scrivi un messaggio..." />
              <button type="submit">Invia</button>
            </form>
          ) : (
            <p style={{ padding: '0.5rem', fontSize: 13, color: '#666' }}>
              <a href="/login" style={{ color: '#a78bfa' }}>Accedi</a> per partecipare alla chat.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
