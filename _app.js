import { AuthProvider } from '../context/AuthContext';
import '../styles/globals.css';
import '@livekit/components-styles';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
