class GroqService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.conversationHistory = {};
    this.userScenarioState = {};
    try {
      const Groq = require('groq-sdk');
      this.groq = new Groq({ apiKey });
    } catch (err) {
      console.warn('?? Groq SDK not available, using mock responses');
      this.groq = null;
    }
  }

  initializeScenario(userId, scenarioType) {
    this.userScenarioState[userId] = {
      type: scenarioType,
      turnCount: 0,
      qualityScores: [],
      successfulTurns: 0,
      emotions: [],
      startTime: Date.now(),
      lastUserMessage: '',
      conversationTheme: null
    };
    this.conversationHistory[userId] = [];
  }

  analyzeEmotion(message) {
    const emotionMap = {
      frustrated: /frustrated|angry|upset|annoyed|fed up|terrible|awful/i,
      anxious: /nervous|worried|concerned|anxious|hesitant|unsure/i,
      confident: /confident|sure|definitely|absolutely|certain|know/i,
      apologetic: /sorry|apologize|excuse|my mistake|my bad|fault/i,
      questioning: /why|how|what|explain|can you|could you|should/i,
      dismissive: /whatever|fine|okay|i guess|sure|don't care/i,
      appreciative: /thank|appreciate|grateful|good idea|excellent|brilliant/i
    };

    for (const [emotion, regex] of Object.entries(emotionMap)) {
      if (regex.test(message)) return emotion;
    }
    return 'neutral';
  }

  analyzeMessageQuality(message) {
    let score = 5;
    if (message.length < 10) score -= 1;
    if (message.length > 50) score += 1;
    if (message.length > 150) score += 1;
    if (/!!!/.test(message)) score -= 1;
    if (/\?\?\?/.test(message)) score -= 1;
    if (/please|thank|appreciate|would|could/i.test(message)) score += 2;
    if (/^(um|uh|like|you know)/i.test(message)) score -= 1;
    if (/specific|detail|example|implement/i.test(message)) score += 2;
    return Math.max(0, Math.min(10, score));
  }

  getAdaptiveDifficulty(userId) {
    const state = this.userScenarioState[userId];
    if (!state || state.qualityScores.length === 0) return 'beginner';
    
    const avgScore = state.qualityScores.reduce((a, b) => a + b, 0) / state.qualityScores.length;
    if (avgScore >= 8) return 'expert';
    if (avgScore >= 6) return 'advanced';
    if (avgScore >= 4) return 'intermediate';
    return 'beginner';
  }

  buildContextAwareFeedback(userId, userMessage, scenarioType, difficulty) {
    const state = this.userScenarioState[userId];
    const emotion = this.analyzeEmotion(userMessage);
    const quality = this.analyzeMessageQuality(userMessage);
    
    let feedback = '';
    
    // Analyze what the user is doing
    if (/problem|issue|bug|error|crash|fail/i.test(userMessage)) {
      feedback = 'addressing a technical issue';
    } else if (/timeline|deadline|schedule|when|how long/i.test(userMessage)) {
      feedback = 'discussing timelines';
    } else if (/why|how|explain|understand/i.test(userMessage)) {
      feedback = 'seeking clarification';
    } else if (/suggest|recommend|think|should/i.test(userMessage)) {
      feedback = 'proposing a solution';
    } else if (/disagree|concern|risk|issue/i.test(userMessage)) {
      feedback = 'raising concerns';
    } else if (/agree|okay|fine|understand/i.test(userMessage)) {
      feedback = 'showing alignment';
    }
    
    return { feedback, emotion, quality };
  }

  generateContextualResponse(userId, userMessage, scenarioType, difficulty, turnCount) {
    const state = this.userScenarioState[userId];
    const { feedback, emotion, quality } = this.buildContextAwareFeedback(userId, userMessage, scenarioType, difficulty);
    
    const responses = {
      manager_review: {
        beginner: [
          (msg) => /problem|issue|struggle|difficult/.test(msg) 
            ? `I hear you. Can you give me a specific example? I want to understand what's making it difficult for you.`
            : `That's fair. How do you think you could approach this differently going forward?`,
          (msg) => /timeline|deadline|when/.test(msg)
            ? `Good question on timing. What resources would you need to meet that deadline?`
            : `I appreciate your perspective. What support do you need from me?`,
          (msg) => /sorry|apologize|mistake/.test(msg)
            ? `It's okay. What matters is how you respond now. What's your plan to fix this?`
            : `Let's focus on solutions. How would you improve in this area?`
        ],
        intermediate: [
          (msg) => /problem|issue/.test(msg)
            ? `That's insightful. Tell me how you plan to mitigate that risk going forward.`
            : `I see. How does that align with our quarterly objectives?`,
          (msg) => /timeline|deadline/.test(msg)
            ? `Understood. Do you have the bandwidth for this, or should we adjust scope?`
            : `That's good thinking. Have you considered the stakeholder impact?`,
          (msg) => /disagree|concern/.test(msg)
            ? `Your concern is valid. Let's dig deeper�what would address this risk?`
            : `I like your analytical approach. How would you measure success here?`
        ],
        advanced: [
          (msg) => /strategy|approach|vision/.test(msg)
            ? `Excellent strategic thinking. How does this align with our 2-year roadmap?`
            : `That's a mature perspective. Have you thought about scaling this approach?`,
          (msg) => /team|leadership|mentor/.test(msg)
            ? `Strong leadership instincts. How are you developing your team in this area?`
            : `I respect that. What's your long-term vision for this domain?`,
          (msg) => /efficiency|optimization|improve/.test(msg)
            ? `Great operational thinking. What would be the ROI on this optimization?`
            : `Impressive. How would you communicate this change to the broader organization?`
        ]
      },
      client_requirement: {
        beginner: [
          (msg) => /understand|clarify|explain/.test(msg)
            ? `Good question. We need the feature to handle 10,000+ concurrent users. Does that change your approach?`
            : `Right. The timeline is tight�can you deliver the MVP in 2 weeks?`,
          (msg) => /timeline|deadline|when/.test(msg)
            ? `Exactly. What's your plan to hit that deadline without sacrificing quality?`
            : `That's the challenge. How would you approach this constraint?`,
          (msg) => /resource|budget|cost/.test(msg)
            ? `Budget is limited. Can you find a cost-effective solution?`
            : `We need to stay within scope. What's your recommendation?`
        ],
        intermediate: [
          (msg) => /technical|architecture|design/.test(msg)
            ? `Good thinking on the technical side. But can your solution handle edge cases like network failures?`
            : `That sounds reasonable. Have you thought about the long-term maintenance costs?`,
          (msg) => /risk|concern|issue/.test(msg)
            ? `Valid concern. How would you mitigate that risk without delaying the launch?`
            : `Understood. What's your contingency plan if that assumption doesn't hold?`,
          (msg) => /timeline|phase|milestone/.test(msg)
            ? `Smart phasing. But our stakeholders are impatient. Can we accelerate phase 1?`
            : `That roadmap makes sense. How would you communicate delays to the stakeholders?`
        ],
        advanced: [
          (msg) => /scale|performance|optimize/.test(msg)
            ? `Impressive scalability plan. But have you modeled the infrastructure costs at 1M users?`
            : `Strategic approach. How does this position us against our competitors?`,
          (msg) => /partnership|integration|ecosystem/.test(msg)
            ? `Great ecosystem thinking. How would you handle vendor lock-in risks?`
            : `Excellent vision. What's your GTM strategy for this?`,
          (msg) => /innovation|future|evolve/.test(msg)
            ? `Forward-thinking. How would you maintain flexibility for future pivots?`
            : `Impressive foresight. How would you build this to be industry-leading?`
        ]
      },
      production_incident: {
        beginner: [
          (msg) => /diagnose|investigate|check/.test(msg)
            ? `Good instinct. The logs show a spike in database connections. What does that tell you?`
            : `Time is critical. What's your first step to stop the bleeding?`,
          (msg) => /restart|reboot|restart/.test(msg)
            ? `That might help temporarily. But we need to find the root cause. Any ideas?`
            : `What's your theory on what caused this?`,
          (msg) => /rollback|revert|previous/.test(msg)
            ? `Rollback was deployed 30 min ago. Do you think that's the cause?`
            : `We need to act fast. What's your backup plan?`
        ],
        intermediate: [
          (msg) => /database|query|slow/.test(msg)
            ? `Good hypothesis. The slow query log shows a N+1 problem. Can you fix that quickly?`
            : `Right, database is a common culprit. Have you checked the recent migrations?`,
          (msg) => /monitor|alert|metric/.test(msg)
            ? `Excellent. Our monitoring shows 95% error rate. What threshold would you have set?`
            : `Smart thinking. Our dashboards should have caught this. Why didn't they?`,
          (msg) => /deploy|release|version/.test(msg)
            ? `The deployment happened 2 hours ago. Do you want to investigate that first?`
            : `What's your protocol for production changes?`
        ],
        advanced: [
          (msg) => /architecture|load|balance/.test(msg)
            ? `Sharp analysis. Our architecture has a single point of failure here. How would you redesign it?`
            : `Systemic thinking. How would you prevent this class of incident entirely?`,
          (msg) => /cascade|ripple|dependent/.test(msg)
            ? `Exactly�cascading failures. What's your strategy for circuit breakers?`
            : `Good systems thinking. How would you build resilience?`,
          (msg) => /communicate|stakeholder|status/.test(msg)
            ? `Critical point. How would you craft this status update to keep confidence?`
            : `Leadership is asking for ETA. How would you commit to a fix time?`
        ]
      },
      difficult_colleague: {
        beginner: [
          (msg) => /understand|see|listen/.test(msg)
            ? `I appreciate that. But I've seen this pattern before and it always causes problems. What makes you think this time is different?`
            : `Maybe. But have you considered the technical debt this creates?`,
          (msg) => /try|attempt|approach/.test(msg)
            ? `I'm skeptical. What if your assumptions are wrong? Then what?`
            : `That might work, but it seems risky. Have you war-gamed failure scenarios?`,
          (msg) => /discuss|talk|feedback/.test(msg)
            ? `I'm listening. But I need to see data, not just theory.`
            : `Okay, I'm open-minded. Show me the evidence.`
        ],
        intermediate: [
          (msg) => /tradeoff|pro|con|balance/.test(msg)
            ? `Fair point. But how would you handle the operational complexity this introduces?`
            : `Interesting perspective. But what's the cost in terms of maintenance burden?`,
          (msg) => /research|evidence|data/.test(msg)
            ? `That's helpful context. But is this data from a similar scale? Our situation is different.`
            : `Okay, that's actually compelling. But how does it apply to our constraints?`,
          (msg) => /timeline|resource|priority/.test(msg)
            ? `Agreed on urgency. But rushing into this could be worse than waiting. How do you mitigate that risk?`
            : `Budget is tight. How would you get this done with less?`
        ],
        advanced: [
          (msg) => /holistic|system|ecosystem/.test(msg)
            ? `Strong systems thinking. But I'm concerned about technical debt downstream. How do you manage that?`
            : `I respect that vision. How would you gain buy-in from the other teams?`,
          (msg) => /innovation|experiment|learn/.test(msg)
            ? `I like the learning mindset. But what's the cost of failure? Can we afford it?`
            : `Fair enough. But how would you measure success to justify the experiment?`,
          (msg) => /leadership|ownership|accountability/.test(msg)
            ? `Ownership is good. But are you prepared for the consequences if this doesn't work?`
            : `I respect your conviction. Let's move forward�but let's align on success metrics first.`
        ]
      }
    };

    const scenarioResponses = responses[scenarioType] || responses.manager_review;
    const difficultyResponses = scenarioResponses[difficulty] || scenarioResponses.beginner;
    
    // Pick response based on turn count
    const responseIndex = Math.min(turnCount % difficultyResponses.length, difficultyResponses.length - 1);
    const responseTemplate = difficultyResponses[responseIndex];
    
    return responseTemplate(userMessage);
  }

  async generateResponse(userId, userMessage, scenarioType) {
    if (!this.conversationHistory[userId]) {
      this.conversationHistory[userId] = [];
    }

    this.conversationHistory[userId].push({
      role: 'user',
      content: userMessage
    });

    if (this.conversationHistory[userId].length > 10) {
      this.conversationHistory[userId].shift();
    }

    const state = this.userScenarioState[userId];
    if (state) {
      state.turnCount++;
      state.lastUserMessage = userMessage;
      const quality = this.analyzeMessageQuality(userMessage);
      state.qualityScores.push(quality);
      if (quality >= 6) state.successfulTurns++;
    }

    const difficulty = this.getAdaptiveDifficulty(userId);

    // Try Groq first
    try {
      if (this.groq) {
        const systemPrompt = `You are an AI in a professional scenario-based interview for Code Apex 3.0 Hackathon.

Scenario: ${scenarioType} (Difficulty: ${difficulty})
Your role: Simulate a realistic workplace character. Be conversational, challenging, and respond directly to what the user says.

Instructions:
- Ask follow-up questions based on their response
- Don't repeat yourself
- Challenge assumptions thoughtfully
- Be natural and conversational, not robotic
- Keep responses 2-4 sentences
- Reference what they specifically said`;

        const response = await this.groq.chat.completions.create({
          model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
          max_tokens: 200,
          messages: [
            { role: 'system', content: systemPrompt },
            ...this.conversationHistory[userId]
          ]
        });

        const aiMessage = response.choices[0].message.content;
        this.conversationHistory[userId].push({
          role: 'assistant',
          content: aiMessage
        });

        return aiMessage;
      }
    } catch (err) {
      console.warn('?? Groq API error:', err.message);
    }

    // Fallback to smart contextual responses
    const contextualResponse = this.generateContextualResponse(
      userId, 
      userMessage, 
      scenarioType, 
      difficulty,
      state?.turnCount || 0
    );

    this.conversationHistory[userId].push({
      role: 'assistant',
      content: contextualResponse
    });

    return contextualResponse;
  }

  generateFeedback(userId) {
    const state = this.userScenarioState[userId];
    if (!state) return { score: 0, rubrics: {} };

    const avgQuality = state.qualityScores.length > 0
      ? (state.qualityScores.reduce((a, b) => a + b, 0) / state.qualityScores.length) * 10
      : 0;

    const successRate = state.turnCount > 0
      ? (state.successfulTurns / state.turnCount) * 100
      : 0;

    const baseScore = (avgQuality + successRate) / 2;

    return {
      score: Math.round(baseScore),
      rubrics: {
        'Communication': Math.round((avgQuality / 10) * 25),
        'Problem Solving': Math.round((successRate / 100) * 25),
        'Professionalism': Math.round(((avgQuality + successRate) / 200) * 25),
        'Adaptability': Math.round(Math.min(25, (state.turnCount / 10) * 25))
      }
    };
  }

  parseJobDescription(jobDesc) {
    return {
      title: jobDesc.match(/Title:\s*(.+)/)?.[1] || 'Unknown',
      skills: (jobDesc.match(/Skills:\s*(.+)/)?.[1] || '').split(',').map(s => s.trim()),
      requirements: (jobDesc.match(/Requirements:\s*(.+)/)?.[1] || '').split(',').map(r => r.trim())
    };
  }

    clearScenario(userId) {
    if (this.conversationHistory[userId]) {
      delete this.conversationHistory[userId];
    }
    if (this.userScenarioState[userId]) {
      delete this.userScenarioState[userId];
    }
    if (this.usedResponses[userId]) {
      delete this.usedResponses[userId];
    }
  }

  getPerformanceStats(userId) {
    const state = this.userScenarioState[userId];
    if (!state) return null;

    return {
      totalTurns: state.turnCount,
      successfulTurns: state.successfulTurns,
      avgQuality: state.qualityScores.length > 0
        ? (state.qualityScores.reduce((a, b) => a + b, 0) / state.qualityScores.length)
        : 0,
      duration: Math.round((Date.now() - state.startTime) / 1000),
      emotions: state.emotions
    };
  }
}

module.exports = GroqService;
