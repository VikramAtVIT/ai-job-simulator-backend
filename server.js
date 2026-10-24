const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

let groqService = null;

try {
  const GroqService = require('./services/groqService');
  groqService = new GroqService(process.env.GROQ_API_KEY || null);
} catch (err) {
  console.error('Failed to load GroqService');
  process.exit(1);
}

const VoiceService = require('./services/voiceService');
const voiceService = new VoiceService();

app.use(express.json());
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});
app.use('/pages', express.static(path.join(__dirname, 'pages')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.post(['/api/login', '/api/auth/login'], (req, res) => {
  const { email, password } = req.body;
  if (email === 'demo@codeapex.com' && password === 'demo123') {
    if (!groqService.userProfiles.user123) {
      groqService.createUserProfile('user123', 'Demo User', email);
    }
    res.json({
      success: true,
      userId: 'user123',
      email,
      user: { id: 'user123', email, name: 'Demo User' },
      token: 'demo-token'
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials. Try: demo@codeapex.com / demo123',
      message: 'Invalid credentials. Try: demo@codeapex.com / demo123'
    });
  }
});

app.post(['/api/signup', '/api/auth/signup'], (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      error: 'Name, email, and password are required',
      message: 'Name, email, and password are required'
    });
  }

  const userId = 'user_' + Date.now();
  groqService.createUserProfile(userId, name, email);
  res.json({
    success: true,
    userId,
    email,
    user: { id: userId, email, name },
    token: 'token_' + Date.now()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', groqConfigured: Boolean(groqService && groqService.groq) });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  const requestedUserId = socket.handshake.auth && socket.handshake.auth.userId;
  socket.userId = typeof requestedUserId === 'string' && requestedUserId
    ? requestedUserId
    : socket.id;
  socket.emit('userStats', groqService.getUserStats(socket.userId));

  socket.on('selectScenario', (data) => {
    const scenarioType = data && data.scenarioType;
    const validScenarioTypes = [
      'manager_review',
      'client_requirement',
      'production_incident',
      'difficult_colleague',
      'daily_standup',
      'priority_conflict'
    ];

    if (!validScenarioTypes.includes(scenarioType)) {
      socket.emit('error', 'Please select a valid scenario');
      return;
    }

    groqService.initializeScenario(socket.userId, scenarioType);
    const scenarioIntros = {
      manager_review: 'Your manager asks how your quarter has gone and what support would help you grow.',
      client_requirement: 'A client presents a new feature request and wants a realistic delivery plan.',
      production_incident: 'An important service is failing in production and the team needs your first response.',
      difficult_colleague: 'A teammate challenges your approach and asks you to defend your technical decision.',
      daily_standup: 'Your team is starting its daily standup. Share your progress, today\'s goal, and any blocker.',
      priority_conflict: 'Two stakeholders need urgent work at the same time. Explain how you would prioritize and align them.'
    };

    socket.emit('scenarioStarted', {
      type: scenarioType,
      intro: scenarioIntros[scenarioType]
    });
  });

  socket.on('message', async (data) => {
    const message = data && typeof data.message === 'string' ? data.message.trim() : '';
    if (!message) {
      socket.emit('error', 'Message cannot be empty');
      return;
    }

    if (!groqService.userScenarioState[socket.userId]) {
      socket.emit('error', 'Select a scenario before sending a message');
      return;
    }

    try {
      const response = await groqService.generateResponse(
        socket.userId,
        message,
        groqService.userScenarioState[socket.userId].type
      );
      socket.emit('aiResponse', { message: response });
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  socket.on('voiceMessage', async (data) => {
    const transcript = data && typeof data.transcript === 'string' ? data.transcript.trim() : '';
    if (!transcript) {
      socket.emit('error', 'Voice transcript cannot be empty');
      return;
    }

    const scenarioState = groqService.userScenarioState[socket.userId];
    if (!scenarioState) {
      socket.emit('error', 'Select a scenario before sending a voice message');
      return;
    }

    try {
      const analysis = voiceService.analyzeVoice({
        userId: socket.userId,
        transcript,
        duration: data.duration,
        confidence: data.confidence
      });
      socket.emit('voiceAnalysis', analysis);

      const response = await groqService.generateResponse(
        socket.userId,
        transcript,
        scenarioState.type
      );
      socket.emit('aiResponse', { message: response });
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  socket.on('generateFeedback', (data) => {
    if (!groqService) return;
    const feedback = groqService.generateFeedback(socket.userId);
    socket.emit('feedbackGenerated', { feedback });
    socket.emit('userStats', groqService.getUserStats(socket.userId));
    groqService.clearScenario(socket.userId);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. The server may already be running at http://localhost:${PORT}.`);
    process.exit(1);
  }

  console.error('Server failed to start:', error.message);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
