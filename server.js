const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });
const googleAuthStates = new Map();

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
  const account = groqService.authenticate(email || '', password || '');
  if (account) {
    res.json({
      success: true,
      userId: account.userId,
      email: account.email,
      user: { id: account.userId, email: account.email, name: account.name },
      token: `token_${account.userId}`
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

  const account = groqService.createAccount(name, email, password);
  if (!account) {
    return res.status(409).json({
      success: false,
      error: 'An account with this email already exists',
      message: 'An account with this email already exists'
    });
  }
  res.json({
    success: true,
    userId: account.userId,
    email: account.email,
    user: { id: account.userId, email: account.email, name },
    token: `token_${account.userId}`
  });
});

  app.get('/api/auth/google/url', (req, res) => {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        res.status(503).json({ success: false, message: 'Google sign-in is not configured on this server yet.' });
        return;
      }

      const state = require('crypto').randomBytes(24).toString('hex');
      googleAuthStates.set(state, Date.now());
      const callbackUrl = `${process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`}/api/auth/google/callback`;
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        state
      });
      res.json({ success: true, url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    });

  app.get('/api/auth/google/callback', async (req, res) => {
      const { code, state } = req.query;
      const stateCreatedAt = googleAuthStates.get(state);
      googleAuthStates.delete(state);
      if (!code || !stateCreatedAt || Date.now() - stateCreatedAt > 10 * 60 * 1000) {
        res.status(400).send('Google sign-in could not be verified. Please try again.');
        return;
      }

      try {
        const callbackUrl = `${process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`}/api/auth/google/callback`;
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: callbackUrl,
            grant_type: 'authorization_code'
          })
        });
        const tokens = await tokenResponse.json();
        if (!tokenResponse.ok || !tokens.access_token) throw new Error('Google token exchange failed');

        const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        const profile = await profileResponse.json();
        if (!profileResponse.ok || !profile.email) throw new Error('Google profile lookup failed');

        const account = groqService.findOrCreateGoogleAccount(profile.name, profile.email);
        if (!account) throw new Error('Unable to create Google account');
        const frontendUrl = process.env.FRONTEND_PUBLIC_URL || 'http://localhost:5500';
        const redirectParams = new URLSearchParams({
          authToken: `token_${account.userId}`,
          userId: account.userId,
          user: JSON.stringify({ id: account.userId, email: account.email, name: account.name })
        });
        res.redirect(`${frontendUrl}/index.html?${redirectParams}`);
      } catch (error) {
        console.error('Google authentication failed:', error.message);
        res.status(502).send('Google sign-in failed. Please try again.');
      }
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
    const hardScenarios = ['production_incident', 'difficult_colleague', 'priority_conflict'];
    if (hardScenarios.includes(scenarioType) && !groqService.getUserStats(socket.userId).hardScenariosUnlocked) {
      socket.emit('error', 'Complete more mastered skills to unlock hard scenarios');
      return;
    }

    groqService.initializeScenario(socket.userId, scenarioType);
    const scenarioIntros = {
      manager_review: 'Welcome to your performance review. I am your manager, and we will discuss your recent achievements, challenges, and growth goals. Start by summarizing one result you are proud of and the impact it had.',
      client_requirement: 'Welcome to the client requirements discussion. I am the client, and I need your help shaping a feature with a tight deadline. Start by asking the most important question you need answered before proposing a solution.',
      production_incident: 'You are now leading a live production incident. Customer requests are failing and the team is waiting for your direction. Start by explaining how you would assess impact and stabilize the service safely.',
      difficult_colleague: 'Welcome to a challenging technical discussion. I am a teammate who disagrees with your approach and wants evidence before moving forward. Explain your position, then show how you would keep the conversation constructive.',
      daily_standup: 'Welcome to today\'s standup. Give a concise update covering what you completed, what you will do next, and any blocker that needs the team\'s help.',
      priority_conflict: 'You are handling two urgent stakeholder requests with limited capacity. Start by explaining how you would compare impact, urgency, and dependencies before choosing what comes first.'
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
      socket.emit('aiResponse', response);
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
      socket.emit('aiResponse', response);
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  socket.on('generateFeedback', async () => {
    if (!groqService) return;
    const feedback = groqService.generateFeedback(socket.userId);
    try {
      const recommendation = await groqService.generateSkillGapRecommendation(socket.userId);
      socket.emit('feedbackGenerated', { feedback, recommendation });
    } catch (error) {
      console.warn(`Skill-gap recommendation failed for user ${socket.userId}: ${error.message}`);
      socket.emit('feedbackGenerated', {
        feedback,
        recommendationError: error.message
      });
    }
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
