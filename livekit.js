const { AccessToken } = require('livekit-server-sdk');

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

// Genera un token LiveKit per un utente che entra in una stanza.
// roomName: identificativo della stanza (es. "stream_12")
// participantName: username dell'utente
// canPublish: true = broadcaster (può trasmettere), false = viewer (solo guarda)
async function createLiveKitToken({ roomName, participantName, canPublish }) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantName,
    ttl: '2h' // token valido 2 ore
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,       // solo il broadcaster può pubblicare video/audio
    canSubscribe: true // tutti possono vedere/ascoltare
  });

  return await at.toJwt();
}

module.exports = { createLiveKitToken };
