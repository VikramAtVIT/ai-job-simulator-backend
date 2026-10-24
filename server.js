const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { verifyToken } = require('@clerk/backend');
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
const frontendUrl = (process.env.FRONTEND_PUBLIC_URL || 'http://localhost:5500').replace(/\/$/, '');
app.get(['/', '/login.html', '/signup.html', '/index.html'], (req, res) => {
  const page = req.path === '/index.html'
    ? 'index.html'
    : req.path === '/signup.html'
      ? 'signup.html'
      : 'login.html';
  res.redirect(`${frontendUrl}/${page}`);
});

app.use(['/api/login', '/api/auth/login', '/api/signup', '/api/auth/signup', '/api/auth/google'], (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Authentication is managed by Clerk. Use the application sign-in or sign-up page.'
  });
});

app.get('/api/config', (req, res) => {
  const clerkEnabled = Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
  res.json({
    clerkEnabled,
    clerkPublishableKey: clerkEnabled ? process.env.CLERK_PUBLISHABLE_KEY : null
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    groqConfigured: Boolean(groqService && groqService.groq),
    clerkConfigured: Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY)
  });
});

async function emitSkillGapRecommendation(socket) {
  const scenarioState = groqService.userScenarioState[socket.userId];
  const turnCount = scenarioState && scenarioState.turnCount;
  try {
    const recommendation = await groqService.generateSkillGapRecommendation(socket.userId);
    if (recommendation) socket.emit('skillGapRecommendation', recommendation);
  } catch (error) {
    console.warn(`Skill-gap recommendation failed for user ${socket.userId}: ${error.message}`);
    if (groqService.userScenarioState[socket.userId] === scenarioState
      && scenarioState?.turnCount === turnCount) {
      socket.emit('skillGapRecommendationError', {
        message: 'AI skill-gap analysis is unavailable. Please try again later.'
      });
    }
  }
}

io.use(async (socket, next) => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!secretKey || typeof token !== 'string' || !token) {
    next(new Error('A valid Clerk session is required.'));
    return;
  }

  const configuredParties = (process.env.CLERK_AUTHORIZED_PARTIES || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  const authorizedParties = Array.from(new Set([
    ...configuredParties,
    process.env.FRONTEND_PUBLIC_URL,
    'http://localhost:5500'
  ].filter(Boolean)));

  try {
    const payload = await verifyToken(token, { secretKey, authorizedParties });
    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new Error('Clerk session token did not include a user ID.');
    }
    socket.userId = payload.sub;
    next();
  } catch (error) {
    console.warn(`Clerk socket authentication failed: ${error.message}`);
    next(new Error('Your session could not be verified. Please sign in again.'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
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
      await emitSkillGapRecommendation(socket);
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
      await emitSkillGapRecommendation(socket);
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  socket.on('generateFeedback', async () => {
    if (!groqService) return;
    const feedback = groqService.generateFeedback(socket.userId);
    try {
      const recommendation = await groqService.generateSkillGapRecommendation(socket.userId);
      if (recommendation) socket.emit('feedbackGenerated', { feedback, recommendation });
      else socket.emit('feedbackGenerated', { feedback });
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
