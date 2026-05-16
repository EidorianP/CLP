import React, { useState, useEffect } from 'react';

export default function GameRoom({ socket, gameState }) {
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(15);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const song = gameState.currentSong;
  const isHost = gameState.host === socket.id;

  // Timer logic
  useEffect(() => {
    if (!song) return;

    // Reset state for new round
    setAnswer('');
    setHasAnswered(false);
    setShowResult(false);
    setTimeLeft(15);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowResult(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [song]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!answer.trim() || hasAnswered) return;
    setHasAnswered(true);
    socket.emit('submitAnswer', { roomId: gameState.roomId, answer });
  };

  const handleNextRound = () => {
    socket.emit('nextRound', gameState.roomId);
  };

  if (!song) return <div className="glass-panel">Chargement...</div>;

  const lyricsLines = song.lyrics.split('\n');

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%', alignItems: 'stretch' }}>

      {/* Zone Principale du Jeu */}
      <div className="glass-panel animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3>Manche en cours</h3>
          <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{timeLeft}s</span>
        </div>

        <div className="timer-bar">
          <div className="timer-fill" style={{ width: `${(timeLeft / 15) * 100}%` }}></div>
        </div>

        <YoutubePlayer
          videoId={song.ytVideoId}
          startTime={song.ytStartTime}
          stopAtSecondsLeft={3}
          timeLeft={timeLeft}
        />

        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>{song.title}</h2>
          <h4 style={{ color: 'var(--text-secondary)' }}>{song.artist}</h4>
        </div>

        {/* Paroles — affichage immédiat, sans défilement */}
        <div className="lyrics-container">
          {lyricsLines.map((line, index) => {
            const isLastLine = index === lyricsLines.length - 1;
            return (
              <div key={index} style={{ padding: '0.25rem 0' }}>
                {line}
                {isLastLine && (
                  <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                    {showResult ? song.missingWord.toUpperCase() : '...'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 'auto' }}>
          {showResult ? (
            <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
              <h3 style={{ color: 'var(--accent-color)', marginBottom: '1rem' }}>Fin du temps !</h3>
              {gameState.lastCorrectPlayer && (
                <p style={{ color: '#4ade80', marginBottom: '1rem', fontWeight: 'bold' }}>
                  🎉 {gameState.lastCorrectPlayer} a trouvé la bonne réponse !
                </p>
              )}
              {isHost && (
                <button className="btn-primary" onClick={handleNextRound}>
                  Manche Suivante
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem' }}>
              <input
                type="text"
                placeholder="Quel est le mot manquant ?"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={hasAnswered}
                autoFocus
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="btn-primary"
                style={{ width: 'auto' }}
                disabled={hasAnswered || !answer.trim()}
              >
                Envoyer
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Panneau Latéral (Leaderboard) */}
      {gameState.players.length > 1 && (
        <div className="glass-panel animate-fade-in" style={{ width: '300px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.8rem', textAlign: 'center' }}>
            Classement En Direct
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {gameState.players.slice().sort((a, b) => b.score - a.score).map((p, index) => (
              <div key={p.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.8rem',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px',
                border: p.id === socket.id ? '1px solid var(--accent-color)' : '1px solid transparent',
                transition: 'all 0.3s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>
                    {index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤'}
                  </span>
                  <span style={{ fontWeight: p.id === socket.id ? 'bold' : 'normal' }}>
                    {p.name} {p.id === socket.id && '(Vous)'}
                  </span>
                </div>
                <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>
                  {p.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Composant lecteur YouTube avec contrôle programmatique ---
function YoutubePlayer({ videoId, startTime, stopAtSecondsLeft, timeLeft }) {
  const playerRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const [isMuted, setIsMuted] = React.useState(false);

  // Charger le script de l'API YouTube IFrame une seule fois
  React.useEffect(() => {
    if (!window.YT && !document.getElementById('yt-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'yt-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }, []);

  // Créer/recréer le lecteur à chaque nouvelle chanson
  React.useEffect(() => {
    if (!videoId) return;
    setIsMuted(false);

    const createPlayer = () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (_) {}
        playerRef.current = null;
      }
      if (!containerRef.current) return;

      const div = document.createElement('div');
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(div);

      playerRef.current = new window.YT.Player(div, {
        height: '270',
        width: '100%',
        videoId: videoId,
        playerVars: {
          start: startTime,
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
        },
        events: {
          onError: (e) => console.warn('YT Player Error:', e.data),
        },
      });
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      // S'abonner au callback global
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        createPlayer();
      };
    }

    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (_) {}
        playerRef.current = null;
      }
    };
  }, [videoId, startTime]);

  // Couper le son N secondes avant la fin du chrono
  React.useEffect(() => {
    if (timeLeft === stopAtSecondsLeft && playerRef.current && !isMuted) {
      try {
        playerRef.current.mute();
        setIsMuted(true);
      } catch (_) {}
    }
  }, [timeLeft, stopAtSecondsLeft, isMuted]);

  return (
    <div style={{
      position: 'relative',
      height: '150px',
      overflow: 'hidden',
      borderRadius: '12px',
      background: '#000',
      marginBottom: '1rem',
    }}>
      {/* Conteneur de la vidéo YouTube */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute', top: '-60px', left: 0,
          width: '100%', height: '270px',
          pointerEvents: 'none',
        }}
      />

      {/* Overlay affiché quand la musique est coupée */}
      {isMuted && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.65)',
          color: 'var(--accent-color)',
          fontWeight: 'bold',
          fontSize: '1rem',
          borderRadius: '12px',
          gap: '0.5rem',
        }}>
          🔇 Musique coupée — Répondez !
        </div>
      )}
    </div>
  );
}
