const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();
if (!process.env.CLERK_PUBLISHABLE_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  process.env.CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}
const { clerkClient, clerkMiddleware, getAuth } = require('@clerk/express');
const { verifyToken } = require('@clerk/backend');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  || process.env.CLERK_PUBLISHABLE_KEY;
const clerkJwtKey = process.env.CLERK_JWT_KEY
  ? process.env.CLERK_JWT_KEY.replace(/\\n/g, '\n')
  : undefined;
const clerkConfigured = Boolean(
  clerkPublishableKey && process.env.CLERK_SECRET_KEY
);
const clerkAuthorizedParties = process.env.CLERK_AUTHORIZED_PARTIES
  ? process.env.CLERK_AUTHORIZED_PARTIES.split(',').map(party => party.trim()).filter(Boolean)
  : [
    'https://ai-job-simulator-frontend.vercel.app',
    `http://localhost:${process.env.PORT || 3000}`,
    `http://127.0.0.1:${process.env.PORT || 3000}`
  ];

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
const scenarioCatalog = require('./services/scenarioCatalog');

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
if (clerkConfigured) {
  app.use(clerkMiddleware({ authorizedParties: clerkAuthorizedParties }));
}
app.use('/pages', express.static(path.join(__dirname, 'pages')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

function requireClerkAuth(req, res, next) {
  if (!clerkConfigured) {
    res.status(503).json({ error: 'Clerk authentication is not configured on this server.' });
    return;
  }

  const auth = getAuth(req);
  if (!auth.isAuthenticated || !auth.userId) {
    res.status(401).json({ error: 'Sign in with Clerk to continue.' });
    return;
  }

  req.clerkUserId = auth.userId;
  next();
}

async function loadClerkProfile(userId) {
  const user = await clerkClient.users.getUser(userId);
  const primaryEmail = user.emailAddresses.find(
    emailAddress => emailAddress.id === user.primaryEmailAddressId
  );
  const email = primaryEmail ? primaryEmail.emailAddress : '';
  const name = user.fullName
    || [user.firstName, user.lastName].filter(Boolean).join(' ')
    || email
    || 'User';
  return groqService.getOrCreateClerkProfile(userId, {
    email,
    emailVerified: Boolean(primaryEmail && primaryEmail.verification?.status === 'verified'),
    name
  });
}

app.get('/api/auth/config', (req, res) => {
  res.json({
    configured: clerkConfigured,
    publishableKey: clerkConfigured ? clerkPublishableKey : null
  });
});

app.get('/api/auth/session', requireClerkAuth, async (req, res) => {
  try {
    const profile = await loadClerkProfile(req.clerkUserId);
    res.json({
      user: { id: req.clerkUserId, email: profile.email, name: profile.name },
      stats: groqService.getUserStats(req.clerkUserId)
    });
  } catch (error) {
    console.error('Clerk profile lookup failed:', error.message);
    res.status(502).json({ error: 'Unable to load your Clerk profile. Please try again.' });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    groqConfigured: Boolean(groqService && groqService.groq),
    clerkConfigured
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
  if (!clerkConfigured) {
    next(new Error('Clerk authentication is not configured on this server.'));
    return;
  }

  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (typeof token !== 'string' || !token) {
    next(new Error('Sign in with Clerk to connect.'));
    return;
  }

  try {
    const claims = await verifyToken(token, {
      ...(clerkJwtKey ? { jwtKey: clerkJwtKey } : { secretKey: process.env.CLERK_SECRET_KEY }),
      authorizedParties: clerkAuthorizedParties
    });
    if (typeof claims.sub !== 'string' || !claims.sub) {
      throw new Error('Clerk session token has no user ID.');
    }

    await loadClerkProfile(claims.sub);
    socket.data.clerkUserId = claims.sub;
    next();
  } catch (error) {
    console.warn(`Socket.IO Clerk authentication failed: ${error.message}`);
    next(new Error('Clerk authentication failed. Please sign in again.'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.userId = socket.data.clerkUserId;
  socket.emit('userStats', groqService.getUserStats(socket.userId));

  socket.on('selectScenario', (data) => {
    const scenarioType = data && data.scenarioType;
    const scenario = typeof scenarioType === 'string'
      && Object.prototype.hasOwnProperty.call(scenarioCatalog, scenarioType)
      ? scenarioCatalog[scenarioType]
      : null;
    if (!scenario) {
      socket.emit('error', 'Please select a valid scenario');
      return;
    }
    if (scenario.difficulty === 'hard' && !groqService.getUserStats(socket.userId).hardScenariosUnlocked) {
      socket.emit('error', 'Master eight scenario types to unlock hard scenarios at Advanced level.');
      return;
    }

    groqService.initializeScenario(socket.userId, scenarioType);

    socket.emit('scenarioStarted', {
      type: scenarioType,
      intro: scenario.intro
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
    let feedback;
    try {
      feedback = await groqService.generateFeedback(socket.userId);
    } catch (error) {
      console.warn(`Scenario feedback failed for user ${socket.userId}: ${error.message}`);
      socket.emit('feedbackError', error.message);
      return;
    }

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
