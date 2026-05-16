import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home({ socket }) {
  const [name, setName] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    socket.on('roomError', (res) => {
      setError(res.message);
      setIsLoading(false);
    });

    return () => {
      socket.off('roomError');
    }
  }, [socket]);

  const handleCreate = () => {
    if (!name.trim()) {
      setError('Veuillez entrer un pseudo');
      return;
    }
    setError('');
    setIsLoading(true);
    socket.emit('createRoom', { playerName: name, playlistUrl: playlistUrl.trim() }, (res) => {
      if (res.status === 'loading') {
        // Le serveur est en train de chercher les musiques, on attend 'roomUpdate'
        setIsLoading(true);
      }
    });
  };

  const handleJoin = () => {
    if (!name.trim() || !joinCode.trim()) {
      setError('Veuillez entrer un pseudo et un code de salon');
      return;
    }
    setError('');
    socket.emit('joinRoom', { roomId: joinCode.toUpperCase(), playerName: name }, (res) => {
      if (res && res.error) {
        setError(res.error);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--accent-color)' }}>Chargement du Salon...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Nous parcourons la playlist Deezer et récupérons les paroles.
          <br/>Cela peut prendre quelques secondes ⏳
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel animate-fade-in" style={{ textAlign: 'center' }}>
      <h1>Complète les Paroles 🎤</h1>
      <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        Testez vos connaissances musicales avec vos amis !
      </p>

      {error && (
        <div style={{ color: '#ef4444', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      <div className="input-group">
        <label>Votre Pseudo</label>
        <input 
          type="text" 
          placeholder="Ex: MozzarellaNinja" 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          maxLength={15}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Créer une partie</h3>
          
          <div className="input-group" style={{ marginBottom: '1rem' }}>
            <label>Lien ou ID Playlist Deezer (Optionnel)</label>
            <input 
              type="text" 
              placeholder="Ex: 908622995 ou lien Deezer" 
              value={playlistUrl} 
              onChange={(e) => setPlaylistUrl(e.target.value)}
              style={{ fontSize: '0.9rem', padding: '0.8rem' }}
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', textAlign: 'left' }}>
              Laissez vide pour utiliser notre playlist par défaut (Hits).
            </p>
          </div>

          <button className="btn-primary" onClick={handleCreate}>
            Créer un Salon Privé
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
          <span style={{ padding: '0 1rem', color: 'var(--text-secondary)' }}>OU</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Rejoindre des amis</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              placeholder="Code (ex: X7A9B)" 
              value={joinCode} 
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              style={{ flex: 1 }}
            />
            <button className="btn-secondary" onClick={handleJoin} style={{ width: 'auto' }}>
              Rejoindre
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
