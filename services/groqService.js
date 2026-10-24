class GroqService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.conversationHistory = {};
    this.userScenarioState = {};
    this.userProfiles = {};
    try {
      const Groq = require('groq-sdk');
      this.groq = apiKey ? new Groq({ apiKey }) : null;
      if (this.groq) console.log('? Groq initialized');
    } catch (err) {
      this.groq = null;
    }
  }

  createUserProfile(userId, name, email) {
      this.userProfiles[userId] = {
        userId,
        name,
        email,
        completedScenarios: 0,
        totalAttempts: 0,
        totalScore: 0,
        scenarioProgress: {}
      };
      return this.userProfiles[userId];
  }

  getUserProfile(userId) {
    return this.userProfiles[userId] || this.createUserProfile(userId, 'User', '');
  }

  getUserStats(userId) {
    const profile = this.getUserProfile(userId);
    const averageScore = profile.completedScenarios
      ? Math.round(profile.totalScore / profile.completedScenarios)
      : 0;

    return {
      completedScenarios: profile.completedScenarios,
      averageScore,
      totalAttempts: profile.totalAttempts,
      currentLevel: profile.completedScenarios >= 10 ? 'Pro' : profile.completedScenarios >= 5 ? 'Advanced' : 'Starter',
      scenarioProgress: profile.scenarioProgress
    };
  }

  initializeScenario(userId, scenarioType) {
    this.userScenarioState[userId] = {
      type: scenarioType,
      turnCount: 0,
      qualityScores: [],
      startTime: Date.now()
    };
    this.conversationHistory[userId] = [];
  }

  async generateResponse(userId, message, scenarioType) {
    if (!this.conversationHistory[userId]) {
      this.conversationHistory[userId] = [];
    }

    const state = this.userScenarioState[userId];
    const activeScenario = state ? state.type : scenarioType;
    const scenarioProfiles = {
      manager_review: {
        role: 'a supportive but honest manager conducting a quarterly performance review',
        goal: 'explore achievements, challenges, feedback, and a concrete growth plan',
        style: 'Ask about evidence, impact, ownership, and what support the employee needs.'
      },
      client_requirement: {
        role: 'a client explaining a business requirement to a technical professional',
        goal: 'clarify needs, constraints, priorities, scope, and delivery expectations',
        style: 'Challenge vague assumptions and ask for measurable acceptance criteria.'
      },
      production_incident: {
        role: 'an incident commander coordinating a live production outage',
        goal: 'restore service safely while communicating status, impact, mitigation, and follow-up actions',
        style: 'Prioritize customer impact, observability, rollback or mitigation, and calm communication.'
      },
      difficult_colleague: {
        role: 'a skeptical colleague who disagrees with the user’s technical approach',
        goal: 'reach a constructive decision using evidence, empathy, trade-offs, and shared goals',
        style: 'Push back respectfully and test the user’s assumptions without becoming hostile.'
      },
      daily_standup: {
        role: 'a team lead facilitating a daily standup',
        goal: 'get a concise update, identify blockers, and establish a specific next step',
        style: 'Coach the user to be brief, concrete, and action-oriented.'
      },
      priority_conflict: {
        role: 'a stakeholder managing two competing urgent requests',
        goal: 'compare impact, urgency, dependencies, and capacity to agree on priorities',
        style: 'Ask the user to explain trade-offs and communicate a clear decision to both stakeholders.'
      }
    };
    const profile = scenarioProfiles[activeScenario] || scenarioProfiles.manager_review;

    this.conversationHistory[userId].push({ role: 'user', content: message });
    if (state) state.turnCount += 1;

    if (this.groq) {
      try {
        const response = await this.groq.chat.completions.create({
          model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
          max_tokens: 150,
          messages: [
            {
              role: 'system',
              content: `You are ${profile.role} in a live workplace simulation.
Scenario goal: ${profile.goal}
Scenario coaching focus: ${profile.style}
Evaluate the user's latest response against this scenario only. Refer to specific details they said, challenge one weak assumption when useful, and move the simulation forward with a realistic stakeholder reaction. Do not give generic interview advice, switch topics, or mention that you are an AI. Respond in 2-4 natural sentences and ask exactly one focused follow-up question that tests the scenario skill.`
            },
            ...this.conversationHistory[userId]
          ]
        });
        const aiMessage = response.choices[0].message.content;
        this.conversationHistory[userId].push({ role: 'assistant', content: aiMessage });
        return aiMessage;
      } catch (err) {
        console.warn('Groq error, using mock response:', err.message);
      }
    }

    const mockResponses = {
      manager_review: [
        "That is a useful starting point. What measurable impact did your work have, and what would you do differently next quarter?",
        "I appreciate the reflection. Which skill would you most like to develop, and what support would help you build it?"
      ],
      client_requirement: [
        "Before we discuss implementation, what user problem should this feature solve and how will we measure success?",
        "That approach could work. Which requirement is essential for the first release, and what can we safely defer?"
      ],
      production_incident: [
        "First, confirm the customer impact and current error rate. What evidence would you check before choosing a mitigation?",
        "Good response. Who will communicate the incident status, and what is your safest rollback or containment option?"
      ],
      difficult_colleague: [
        "I hear your concern. Which performance assumption do you think is most risky, and what evidence would help us test it?",
        "That is a reasonable trade-off. How could we compare both approaches with a small experiment instead of debating in the abstract?"
      ],
      daily_standup: [
        "Keep the update concise: what did you finish, what will you do next, and is anything blocking you?",
        "Thanks. What specific outcome will you deliver by the end of today, and who needs to know about your blocker?"
      ],
      priority_conflict: [
        "Start by comparing customer impact, urgency, and dependencies. Which request has the greater cost of delay?",
        "That trade-off is clear. How will you communicate the decision and revised expectation to the stakeholder who must wait?"
      ]
    };
    const responses = mockResponses[activeScenario] || mockResponses.manager_review;
    return responses[((state?.turnCount || 1) - 1) % responses.length];
  }

  generateFeedback(userId) {
    const state = this.userScenarioState[userId];
    const profile = this.getUserProfile(userId);
    const turnCount = state?.turnCount || 0;
    const score = Math.min(100, Math.max(0, turnCount ? 55 + Math.min(turnCount * 5, 35) : 0));
    if (state) {
      profile.completedScenarios += 1;
      profile.totalAttempts += 1;
      profile.totalScore += score;
      profile.scenarioProgress[state.type] = {
        attempts: (profile.scenarioProgress[state.type]?.attempts || 0) + 1,
        bestScore: Math.max(profile.scenarioProgress[state.type]?.bestScore || 0, score)
      };
    }

    return {
      score,
      rubrics: {
        'Communication': Math.round(score * 0.25),
        'Problem Solving': Math.round(score * 0.23),
        'Professionalism': Math.round(score * 0.27),
        'Adaptability': Math.round(score * 0.25)
      }
    };
  }

  getPerformanceStats(userId) {
    return { totalTurns: 5, duration: 300 };
  }

  clearScenario(userId) {
    delete this.conversationHistory[userId];
    delete this.userScenarioState[userId];
  }
}

module.exports = GroqService;
