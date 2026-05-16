require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const ytSearch = require('yt-search');

const app = express();
app.use(cors());
app.use(express.json()); // Indispensable pour traiter les requêtes POST JSON

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Autorise tout pour le développement
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

// Fonction pour extraire l'ID numérique d'une URL Deezer
function extractPlaylistId(input) {
  if (!input) return '908622995'; // Playlist par défaut (Années 60)
  const match = input.match(/playlist\/(\d+)/);
  if (match) return match[1];
  const digits = input.replace(/\D/g, '');
  return digits.length > 0 ? digits : '908622995';
}

// Fonction pour récupérer les pistes, mélanger, et chercher les paroles
async function generateGameSongs(playlistInput) {
  const playlistId = extractPlaylistId(playlistInput);
  try {
    // 1. Récupérer la playlist sur Deezer
    const deezerUrl = `https://api.deezer.com/playlist/${playlistId}`;
    // Node.js >= 18 intègre la fonction fetch nativement
    const res = await fetch(deezerUrl);
    const data = await res.json();
    if (!data.tracks || !data.tracks.data) return [];
    
    let tracks = data.tracks.data;
    // Mélanger aléatoirement les pistes
    tracks = tracks.sort(() => 0.5 - Math.random());
    
    const validSongs = [];
    
    // 2. Chercher 5 musiques avec des paroles valides
    for (const track of tracks) {
      if (validSongs.length >= 5) break;
      
      const artist = track.artist.name;
      const title = track.title;
      
      // Appel API publique LRCLIB
      const lrclibUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
      try {
        const lrcRes = await fetch(lrclibUrl);
        if (!lrcRes.ok) continue;
        
        const lrcData = await lrcRes.json();
        if (!lrcData.syncedLyrics) continue; // On a absolument besoin des paroles synchronisées
        
        // Découpage des paroles synchronisées
        const syncedLines = lrcData.syncedLyrics.split('\n').filter(l => l.trim().length > 0);
        const parsedLyrics = [];
        
        for (let line of syncedLines) {
           // Regex pour extraire [mm:ss.xx] texte
           const match = line.match(/^\[(\d{2}):(\d{2}\.\d{2})\]\s*(.+)$/);
           if (match) {
              const minutes = parseInt(match[1]);
              const seconds = parseFloat(match[2]);
              parsedLyrics.push({ time: minutes * 60 + seconds, text: match[3].trim() });
           }
        }
        if (parsedLyrics.length < 4) continue;
        
        // On choisit 4 lignes un peu après le début (pour éviter les longues intros instrumentales)
        const startIndex = Math.min(4, Math.max(0, parsedLyrics.length - 4));
        const selectedParsed = parsedLyrics.slice(startIndex, startIndex + 4);
        
        const startTime = Math.floor(selectedParsed[0].time); // Le temps de départ en secondes
        const lines = selectedParsed.map(p => p.text);
        const lastLine = lines[3];
        
        // Découpage en mots pour la 4ème ligne
        const words = lastLine.split(' ');
        if (words.length < 2) continue; // On veut au moins 2 mots
        
        // Le dernier mot à cacher
        let lastWord = words.pop();
        // Nettoyer la ponctuation du mot à deviner
        const cleanWord = lastWord.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '');
        if (cleanWord.length === 0) continue;
        
        // On recrée la ligne sans le dernier mot
        lines[3] = words.join(' ') + ' '; // L'espace avant les ...
        
        // On cherche l'audio sur YouTube
        const ytRes = await ytSearch(`${artist} ${title} audio`);
        if (!ytRes || !ytRes.videos || ytRes.videos.length === 0) continue;
        const ytVideoId = ytRes.videos[0].videoId;

        validSongs.push({
          id: track.id,
          ytVideoId: ytVideoId,
          ytStartTime: startTime,
          title: track.title,
          artist: track.artist.name,
          lyrics: lines.join('\n'), // Les 4 lignes sélectionnées
          missingWord: cleanWord
        });
      } catch (err) {
        // Ignorer l'erreur pour cette chanson et passer à la suivante
        console.error(err);
        continue;
      }
    }
    return validSongs;
  } catch (err) {
    console.error("Erreur générale :", err);
    return [];
  }
}

io.on('connection', (socket) => {
  console.log('Un utilisateur connecté:', socket.id);

  // Créer un salon avec chargement dynamique de la playlist
  socket.on('createRoom', async ({ playerName, playlistUrl }, callback) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // On répond immédiatement pour que l'interface affiche "Chargement..."
    if (callback) callback({ roomId, status: 'loading' });

    // Génération des musiques
    const songs = await generateGameSongs(playlistUrl);
    
    if (songs.length === 0) {
       io.to(socket.id).emit('roomError', { message: 'Impossible de trouver des musiques avec paroles dans cette playlist.' });
       return;
    }

    rooms.set(roomId, {
      id: roomId,
      host: socket.id,
      players: [{ id: socket.id, name: playerName, score: 0 }],
      state: 'lobby',
      currentSongIndex: 0,
      songs: songs // Les musiques générées dynamiquement
    });
    
    socket.join(roomId);
    io.to(roomId).emit('roomUpdate', rooms.get(roomId));
  });

  // Rejoindre un salon
  socket.on('joinRoom', ({ roomId, playerName }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      if (callback) callback({ error: 'Salon introuvable' });
      return;
    }
    if (room.state !== 'lobby') {
      if (callback) callback({ error: 'La partie a déjà commencé' });
      return;
    }
    room.players.push({ id: socket.id, name: playerName, score: 0 });
    socket.join(roomId);
    if (callback) callback({ success: true });
    io.to(roomId).emit('roomUpdate', room);
  });

  // Lancer la partie
  socket.on('startGame', (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.host === socket.id) {
      room.state = 'playing';
      room.currentSongIndex = 0;
      io.to(roomId).emit('gameStarted', { song: room.songs[room.currentSongIndex] });
      io.to(roomId).emit('roomUpdate', room);
    }
  });

  // Soumettre une réponse
  socket.on('submitAnswer', ({ roomId, answer }) => {
    const room = rooms.get(roomId);
    if (room && room.state === 'playing') {
      const currentSong = room.songs[room.currentSongIndex];
      const player = room.players.find(p => p.id === socket.id);
      
      if (player && currentSong && answer.toLowerCase().trim() === currentSong.missingWord.toLowerCase()) {
        player.score += 10;
        io.to(roomId).emit('playerAnswered', { playerId: socket.id, correct: true, name: player.name });
      } else {
        io.to(roomId).emit('playerAnswered', { playerId: socket.id, correct: false, name: player.name });
      }
      io.to(roomId).emit('roomUpdate', room);
    }
  });

  // Manche suivante
  socket.on('nextRound', (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.host === socket.id) {
      room.currentSongIndex++;
      if (room.currentSongIndex >= room.songs.length) {
        room.state = 'results';
        io.to(roomId).emit('gameOver', room.players);
      } else {
        io.to(roomId).emit('gameStarted', { song: room.songs[room.currentSongIndex] });
      }
      io.to(roomId).emit('roomUpdate', room);
    }
  });

  // Rejouer depuis l'écran de résultats
  socket.on('replayGame', async (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.host === socket.id) {
        room.state = 'lobby';
        room.currentSongIndex = 0;
        // On garde les mêmes joueurs, on remet les scores à 0
        room.players.forEach(p => p.score = 0);
        io.to(roomId).emit('roomUpdate', room);
    }
  });

  // Déconnexion
  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          if (room.host === socket.id) {
            room.host = room.players[0].id; // Le joueur suivant devient l'hôte
          }
          io.to(roomId).emit('roomUpdate', room);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
