import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function Tokens() {
  const { user, loading, balance, refreshBalance } = useAuth();
  const [packages, setPackages] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [payoutInfo, setPayoutInfo] = useState(null);
  const [payoutForm, setPayoutForm] = useState({ tokens: '', method: '', details: '' });
  const [message, setMessage] = useState('');
  const [payoutMsg, setPayoutMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getTokenPackages().then(setPackages).catch(() => {});
    if (user) {
      api.getTransactions().then(setTransactions).catch(() => {});
      api.getPayoutInfo().then(setPayoutInfo).catch(() => {});
    }
  }, [user]);

  if (loading) return null;

  if (!user) {
    return (
      <div><Navbar />
        <div className="container"><p>Accedi per gestire i tuoi token.</p></div>
      </div>
    );
  }

  async function handlePurchase(pkg) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.purchaseMock(pkg.id);
      refreshBalance();
      setMessage(`+${res.added} token aggiunti al tuo saldo! (simulato)`);
      const tx = await api.getTransactions();
      setTransactions(tx);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePayout(e) {
    e.preventDefault();
    setBusy(true);
    setPayoutMsg('');
    try {
      const res = await api.requestPayout({
        tokens: Number(payoutForm.tokens),
        payoutMethod: payoutForm.method,
        payoutDetails: payoutForm.details
      });
      setPayoutMsg(`Richiesta inviata! Riceverai €${res.amount_eur}. Saldo rimanente: ${res.newBalance} token.`);
      setPayoutForm({ tokens: '', method: '', details: '' });
      refreshBalance();
      const tx = await api.getTransactions();
      setTransactions(tx);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div className="container">
        <h1>I tuoi token</h1>
        <p style={{ fontSize: 18, margin: '0 0 1.5rem' }}>
          Saldo: <strong style={{ color: '#ffd54f' }}>🪙 {balance} token</strong>
        </p>

        {error && <p className="error-text">{error}</p>}
        {message && <p style={{ color: '#4caf50' }}>{message}</p>}

        <h2>Acquista token</h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: '1rem' }}>
          ⚠️ Acquisto simulato — nessun pagamento reale. Integra Stripe per i pagamenti reali.
        </p>
        <div className="grid">
          {packages.map(pkg => (
            <div key={pkg.id} className="card" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 28, fontWeight: 600, color: '#ffd54f', margin: '0 0 4px' }}>🪙 {pkg.tokens}</p>
              <p style={{ color: '#888', margin: '0 0 12px' }}>€{pkg.price_eur.toFixed(2)}</p>
              <button disabled={busy} onClick={() => handlePurchase(pkg)}>
                {busy ? '...' : 'Acquista'}
              </button>
            </div>
          ))}
        </div>

        {payoutInfo && (
          <>
            <h2 style={{ marginTop: '2rem' }}>Richiedi payout</h2>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <p style={{ color: '#4caf50', fontSize: 13 }}>✅ {payoutInfo.note}</p>
              <p style={{ fontSize: 13, color: '#888' }}>
                Tasso: 1 token = €{payoutInfo.rate} — Minimo: {payoutInfo.minTokens} token (€{payoutInfo.minEur})
              </p>
            </div>
            <form onSubmit={handlePayout} style={{ maxWidth: 400 }}>
              <input
                type="number"
                placeholder={`Token da convertire (min ${payoutInfo.minTokens})`}
                value={payoutForm.tokens}
                onChange={e => setPayoutForm(p => ({ ...p, tokens: e.target.value }))}
                required
              />
              {payoutForm.tokens && (
                <p style={{ fontSize: 13, color: '#ffd54f', margin: '2px 0 8px' }}>
                  = €{(Number(payoutForm.tokens) * payoutInfo.rate).toFixed(2)}
                </p>
              )}
              <select
                value={payoutForm.method}
                onChange={e => setPayoutForm(p => ({ ...p, method: e.target.value }))}
                required
                style={{ width: '100%', padding: '0.6rem', background: '#0f0f12', border: '1px solid #333', borderRadius: 4, color: '#fff', margin: '4px 0' }}
              >
                <option value="">Metodo di pagamento...</option>
                <option value="bank_transfer">Bonifico bancario</option>
                <option value="paypal">PayPal</option>
                <option value="crypto">Criptovaluta</option>
              </select>
              <input
                placeholder="Dettagli (IBAN, email PayPal, wallet...)"
                value={payoutForm.details}
                onChange={e => setPayoutForm(p => ({ ...p, details: e.target.value }))}
                required
              />
              {payoutMsg && <p style={{ color: '#4caf50', fontSize: 13 }}>{payoutMsg}</p>}
              <button type="submit" disabled={busy}>Richiedi payout</button>
            </form>
          </>
        )}

        <h2 style={{ marginTop: '2rem' }}>Storico transazioni</h2>
        {transactions.length === 0 && <p style={{ color: '#666' }}>Nessuna transazione ancora.</p>}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                  <td style={{ padding: '8px', color: '#666' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '8px' }}>{t.description}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: t.amount >= 0 ? '#4caf50' : '#ff6b6b', fontWeight: 500 }}>
                    {t.amount >= 0 ? '+' : ''}{t.amount} 🪙
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
