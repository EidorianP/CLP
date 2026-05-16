import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';


// Connect to backend server
const socket = io('http://localhost:3001');

function AppContent() {
  const [gameState, setGameState] = useState({
    roomId: null,
    players: [],
    state: 'home', // home, lobby, playing, results
    host: null,
    currentSong: null,
    lastCorrectPlayer: null
  });

  const navigate = useNavigate();

  useEffect(() => {
    socket.on('roomUpdate', (room) => {
      setGameState(prev => ({
        ...prev,
        roomId: room.id,
        players: room.players,
        state: room.state,
        host: room.host
      }));

      if (room.state === 'lobby') navigate('/lobby');
      if (room.state === 'playing') navigate('/game');
      if (room.state === 'results') navigate('/results');
    });

    socket.on('gameStarted', ({ song }) => {
      setGameState(prev => ({ ...prev, currentSong: song, lastCorrectPlayer: null }));
    });

    socket.on('playerAnswered', ({ playerId, correct, name }) => {
      if (correct) {
        setGameState(prev => ({ ...prev, lastCorrectPlayer: name }));
      }
    });

    return () => {
      socket.off('roomUpdate');
      socket.off('gameStarted');
      socket.off('playerAnswered');
    };
  }, [navigate]);

  return (
    <div className="app-container">
      <Routes>
        <Route path="/" element={<Home socket={socket} />} />
        <Route path="/lobby" element={<Lobby socket={socket} gameState={gameState} />} />
        <Route path="/game" element={<GameRoom socket={socket} gameState={gameState} />} />
        <Route path="/results" element={
          <div className="glass-panel animate-fade-in">
            <h1>Résultats Finaux 🎉</h1>
            <ul className="player-list">
              {gameState.players.sort((a,b) => b.score - a.score).map((p, index) => (
                <li key={p.id} className="player-item">
                  <span>{index === 0 ? '🏆' : ''} {p.name}</span>
                  <span className="player-score">{p.score} pts</span>
                </li>
              ))}
            </ul>
            {socket.id === gameState.host && (
              <button 
                className="btn-primary" 
                style={{marginTop: '2rem'}}
                onClick={() => socket.emit('createRoom', { playerName: gameState.players.find(p => p.id === socket.id)?.name || 'Hôte' }, () => {})}
              >
                Rejouer
              </button>
            )}
          </div>
        } />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
