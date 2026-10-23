const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

// Initialize Groq Service
let GroqService;
let groqService = null;

try {
  GroqService = require('./services/groqService');
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    console.warn('?? GROQ_API_KEY not found in .env file. Using mock responses only.');
    groqService = new GroqService(null);
  } else {
    groqService = new GroqService(apiKey);
    console.log('? Groq Service initialized with API key');
  }
} catch (err) {
  console.error('? Failed to load GroqService:', err.message);
  process.exit(1);
}

const VoiceService = require('./services/voiceService');
const voiceService = new VoiceService();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));

// Store active sessions
const activeSessions = {};

// Routes
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email === 'demo@codeapex.com' && password === 'demo123') {
    res.json({
      success: true,
      userId: 'user123',
      email: email,
      token: 'demo-token-12345'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials. Try: demo@codeapex.com / demo123'
    });
  }
});

app.post('/api/signup', (req, res) => {
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      message: 'All fields required'
    });
  }
  
  res.json({
    success: true,
    userId: 'user_' + Date.now(),
    email: email,
    token: 'token_' + Date.now()
  });
});

app.get('/api/page/:name', (req, res) => {
  const pageName = req.params.name;
  const filePath = path.join(__dirname, 'pages', `${pageName}.html`);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Page not found' });
    }
  });
});

// Test Groq connection
app.get('/api/test-groq', async (req, res) => {
  if (!groqService || !groqService.groq) {
    return res.json({
      status: 'mock',
      message: 'Groq SDK not available. Using mock responses.',
      usingMock: true
    });
  }

  try {
    const response = await groqService.groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Say "Groq is working!"' }]
    });

    res.json({
      status: 'success',
      message: response.choices[0].message.content,
      usingMock: false
    });
  } catch (err) {
    res.json({
      status: 'error',
      message: err.message,
      usingMock: true
    });
  }
});

// Socket.io Events
io.on('connection', (socket) => {
  console.log(`? User connected: ${socket.id}`);
  activeSessions[socket.id] = { userId: socket.id, connected: true };

  socket.on('selectScenario', (data) => {
    const { scenarioType } = data || {};
    const userId = socket.id;
    const validScenarioTypes = [
      'manager_review',
      'client_requirement',
      'production_incident',
      'difficult_colleague'
    ];

    console.log(`?? Scenario selected: ${scenarioType} by ${userId}`);

    if (!validScenarioTypes.includes(scenarioType)) {
      socket.emit('error', 'Invalid scenario type');
      return;
    }

    if (!groqService) {
      socket.emit('error', 'Groq Service not initialized');
      return;
    }

    groqService.initializeScenario(userId, scenarioType);
    
    const scenarioIntros = {
      manager_review: "Your manager wants to discuss your Q4 performance. They start: \"Thanks for meeting with me. I wanted to discuss your performance this quarter. How do you feel things are going?\"",
      client_requirement: "A client just contacted you with new requirements. They say: \"We need to add real-time collaboration features to the app. Our users are asking for it constantly. Can you make this happen?\"",
      production_incident: "Your colleague pings you urgently: \"We have a production issue! The API response time spiked to 5 seconds and error rates are at 15%. Users are experiencing timeouts. We need to act NOW.\"",
      difficult_colleague: "Your colleague challenges your approach: \"I don't think your solution will work at scale. Have you even considered the performance implications of what you're proposing?\""
    };

    socket.emit('scenarioStarted', {
      type: scenarioType,
      intro: scenarioIntros[scenarioType] || scenarioIntros.manager_review
    });
  });

  socket.on('message', async (data) => {
    const { userId, scenarioType, message } = data || {};
    const socketUserId = socket.id;
    const activeScenario = scenarioType || groqService?.userScenarioState?.[socketUserId]?.type;

    console.log(`?? Message from ${socketUserId}: "${message}"`);

    if (!message || message.trim() === '') {
      socket.emit('error', 'Message cannot be empty');
      return;
    }

    if (!activeScenario) {
      socket.emit('error', 'Select a scenario before sending a message');
      return;
    }

    if (!groqService) {
      socket.emit('error', 'Groq Service not available');
      return;
    }

    try {
      const response = await groqService.generateResponse(socketUserId, message, activeScenario);
      
      if (!response) {
        socket.emit('error', 'Failed to generate response');
        return;
      }

      console.log(`? AI Response: "${response.substring(0, 60)}..."`);

      socket.emit('aiResponse', {
        message: response,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error(`? Message handler error: ${err.message}`);
      socket.emit('error', `Error: ${err.message}`);
    }
  });

  socket.on('voice', (data) => {
    const { userId, audioData } = data;
    console.log(`?? Voice data received from ${socket.id}`);

    try {
      const analysis = voiceService.analyzeVoice(audioData);
      socket.emit('voiceAnalysis', analysis);
    } catch (err) {
      console.error(`? Voice handler error: ${err.message}`);
      socket.emit('error', `Voice error: ${err.message}`);
    }
  });

  socket.on('generateFeedback', (data) => {
    const { userId, scenarioType } = data;
    const socketUserId = socket.id;

    console.log(`?? Feedback requested for ${socketUserId}`);

    if (!groqService) {
      socket.emit('error', 'Groq Service not available');
      return;
    }

    try {
      const feedback = groqService.generateFeedback(socketUserId);
      const stats = groqService.getPerformanceStats(socketUserId);

      socket.emit('feedbackGenerated', {
        feedback: feedback,
        stats: stats,
        timestamp: new Date().toISOString()
      });

      // Clear the scenario after feedback
      groqService.clearScenario(socketUserId);
    } catch (err) {
      console.error(`? Feedback handler error: ${err.message}`);
      socket.emit('error', `Feedback error: ${err.message}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`?? User disconnected: ${socket.id}`);
    delete activeSessions[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
+--------------------------------------------+
�   ?? AI Job Simulator Server Running       �
�   ?? http://localhost:${PORT}               �
�   ?? Login: demo@codeapex.com / demo123   �
+--------------------------------------------+
  `);
});
