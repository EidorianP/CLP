import React from 'react';

export default function Lobby({ socket, gameState }) {
  const isHost = gameState.host === socket.id;

  const handleStart = () => {
    socket.emit('startGame', gameState.roomId);
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ textAlign: 'center' }}>
      <h2>Code du Salon</h2>
      <div style={{ 
        background: 'rgba(0,0,0,0.3)', 
        padding: '1rem', 
        borderRadius: '12px', 
        fontSize: '2.5rem', 
        fontWeight: '800', 
        letterSpacing: '5px',
        marginBottom: '2rem',
        color: 'var(--accent-color)'
      }}>
        {gameState.roomId}
      </div>

      <h3 style={{ textAlign: 'left', marginBottom: '1rem' }}>Joueurs Connectés ({gameState.players.length})</h3>
      <ul className="player-list" style={{ marginBottom: '2rem' }}>
        {gameState.players.map(p => (
          <li key={p.id} className="player-item">
            <span>{p.id === gameState.host ? '👑 ' : ''}{p.name}</span>
            {p.id === socket.id && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>(Vous)</span>}
          </li>
        ))}
      </ul>

      {isHost ? (
        <button 
          className="btn-primary" 
          onClick={handleStart}
          disabled={gameState.players.length < 1}
        >
          Lancer la Partie
        </button>
      ) : (
        <div style={{ color: 'var(--text-secondary)', padding: '1rem', fontStyle: 'italic' }}>
          En attente de l'hôte pour lancer la partie...
        </div>
      )}
    </div>
  );
}
