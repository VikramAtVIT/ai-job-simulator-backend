const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class GroqService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.conversationHistory = {};
    this.userScenarioState = {};
    this.userProfiles = this.loadProfiles();
    this.accounts = this.loadAccounts();
    try {
      const Groq = require('groq-sdk');
      this.groq = apiKey ? new Groq({ apiKey }) : null;
      if (this.groq) console.log('? Groq initialized');
    } catch (err) {
      this.groq = null;
    }
  }

  loadProfiles() {
    const profilesPath = path.join(__dirname, '..', 'data', 'users.json');
    try {
      const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
      return profiles;
    } catch (error) {
      return {
        user123: {
          userId: 'user123',
          name: 'Demo User',
          email: 'demo@codeapex.com',
          completedScenarios: 12,
          totalAttempts: 34,
          totalScore: 984,
          scenarioProgress: {
            manager_review: { attempts: 8, bestScore: 85 },
            client_requirement: { attempts: 5, bestScore: 78 },
            production_incident: { attempts: 3, bestScore: 72 },
            difficult_colleague: { attempts: 2, bestScore: 68 }
          }
        }
      };
    }
  }

  saveProfiles() {
    const profilesPath = path.join(__dirname, '..', 'data', 'users.json');
    fs.mkdirSync(path.dirname(profilesPath), { recursive: true });
    fs.writeFileSync(profilesPath, JSON.stringify(this.userProfiles, null, 2));
  }

  loadAccounts() {
    const accountsPath = path.join(__dirname, '..', 'data', 'accounts.json');
    try {
      return JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    } catch (error) {
      return {};
    }
  }

  saveAccounts() {
    const accountsPath = path.join(__dirname, '..', 'data', 'accounts.json');
    fs.mkdirSync(path.dirname(accountsPath), { recursive: true });
    fs.writeFileSync(accountsPath, JSON.stringify(this.accounts, null, 2));
  }

  hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password, storedHash) {
    const [salt, expectedHash] = storedHash.split(':');
    const actualHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'));
  }

  createAccount(name, email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    if (this.accounts[normalizedEmail]) return null;
    const userId = `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.accounts[normalizedEmail] = {
      userId,
      email: normalizedEmail,
      passwordHash: this.hashPassword(password)
    };
    this.createUserProfile(userId, name, normalizedEmail);
    this.saveAccounts();
    return { userId, email: normalizedEmail };
  }

  authenticate(email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === 'demo@codeapex.com' && password === 'demo123') {
      return { userId: 'user123', email: normalizedEmail, name: 'Demo User' };
    }

    const account = this.accounts[normalizedEmail];
    if (!account || !this.verifyPassword(password, account.passwordHash)) return null;
    return {
      userId: account.userId,
      email: account.email,
      name: this.getUserProfile(account.userId).name
    };
  }

  findOrCreateGoogleAccount(name, email) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = this.accounts[normalizedEmail];
    if (existing) {
      return {
        userId: existing.userId,
        email: existing.email,
        name: this.getUserProfile(existing.userId).name
      };
    }

    const account = this.createAccount(
      name || normalizedEmail.split('@')[0],
      normalizedEmail,
      crypto.randomBytes(32).toString('hex')
    );
    if (!account) return null;
    return {
      userId: account.userId,
      email: account.email,
      name: name || normalizedEmail.split('@')[0]
    };
  }

  createUserProfile(userId, name, email) {
    if (this.userProfiles[userId]) return this.userProfiles[userId];
    this.userProfiles[userId] = {
        userId,
        name,
        email,
        completedScenarios: 0,
        totalAttempts: 0,
        totalScore: 0,
        scenarioProgress: {}
    };
    this.saveProfiles();
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
    const scenarioProgress = profile.scenarioProgress || {};
    const masteredSkills = Object.values(scenarioProgress).filter(progress =>
      progress.attempts >= 2 && progress.bestScore >= 75
    ).length;
    const levels = [
      { name: 'Starter', comment: 'Start strong', threshold: 0 },
      { name: 'Explorer', comment: 'Build momentum', threshold: 1 },
      { name: 'Builder', comment: 'Sharpen skills', threshold: 2 },
      { name: 'Specialist', comment: 'Own craft', threshold: 3 },
      { name: 'Advanced', comment: 'Ready now', threshold: 4 },
      { name: 'Pro', comment: 'Lead confidently', threshold: 5 }
    ];
    const level = levels[Math.min(masteredSkills, levels.length - 1)];
    const legacyDemo = userId === 'user123';
    const currentLevel = legacyDemo ? 'Pro' : level.name;
    const levelComment = legacyDemo ? 'Lead confidently' : level.comment;
    const levelIndex = levels.findIndex(item => item.name === currentLevel);

    return {
      completedScenarios: profile.completedScenarios,
      averageScore,
      totalAttempts: profile.totalAttempts,
      currentLevel,
      levelComment,
      masteredSkills: legacyDemo ? Math.max(masteredSkills, 5) : masteredSkills,
      levelProgress: {
        masteredSkills: legacyDemo ? Math.max(masteredSkills, 5) : masteredSkills,
        nextLevel: levels[Math.min(levelIndex + 1, levels.length - 1)].name,
        skillsNeeded: Math.max(0, levels[Math.min(levelIndex + 1, levels.length - 1)].threshold - masteredSkills)
      },
      hardScenariosUnlocked: legacyDemo || levelIndex >= 4,
      scenarioProgress
    };
  }

  getSkillRecommendation(scenarioType, message) {
    const normalizedMessage = message.toLowerCase();
    const recommendations = {
      manager_review: normalizedMessage.match(/\b(result|impact|metric|outcome|number|percentage)\b/)
        ? 'Good evidence. Strengthen it further by connecting the result to a business or team outcome.'
        : 'Skill gap: use a specific result with measurable impact, then explain what you learned.',
      client_requirement: normalizedMessage.match(/\b(user|customer|acceptance|scope|constraint|priority|requirement)\b/)
        ? 'Good discovery focus. Add a measurable acceptance criterion and confirm what is out of scope.'
        : 'Skill gap: ask about the user problem, success measure, constraints, and must-have scope before solutioning.',
      production_incident: normalizedMessage.match(/\b(impact|rollback|logs|metric|monitor|mitigat|communicat|customer)\b/)
        ? 'Good incident thinking. Make the next action time-bound and assign clear communication ownership.'
        : 'Skill gap: start with customer impact, evidence, containment, and an explicit communication owner.',
      difficult_colleague: normalizedMessage.match(/\b(evidence|trade-off|tradeoff|listen|agree|test|experiment|impact)\b/)
        ? 'Good collaborative framing. State the shared decision criterion before defending your preferred option.'
        : 'Skill gap: acknowledge the concern, use evidence, and propose a small test against a shared goal.',
      daily_standup: normalizedMessage.match(/\b(done|completed|today|next|block|help|yesterday)\b/)
        ? 'Good standup structure. Keep the update concise and name the owner or next action for each blocker.'
        : 'Skill gap: structure the update as done, next, and blockers that need team help.',
      priority_conflict: normalizedMessage.match(/\b(impact|urgent|depend|customer|cost|delay|communicat|priorit)\b/)
        ? 'Good prioritization logic. Make the trade-off explicit and communicate the revised expectation to the waiting stakeholder.'
        : 'Skill gap: compare impact, urgency, dependencies, and cost of delay before communicating the decision.'
    };
    return recommendations[scenarioType] || recommendations.manager_review;
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
Evaluate the user's latest response against this scenario only. Refer to specific details they said, challenge one weak assumption when useful, and move the simulation forward with a realistic stakeholder reaction. Do not give generic interview advice, switch topics, or mention that you are an AI. Respond in 2-4 natural sentences and ask exactly one focused follow-up question that tests the scenario skill. End with a separate line in this exact format: COACHING_NOTE: [one concise recommendation for the user's biggest skill gap].`
            },
            ...this.conversationHistory[userId]
          ]
        });
        const rawMessage = response.choices[0].message.content;
        const recommendationMatch = rawMessage.match(/COACHING_NOTE:\s*(.+)$/im);
        const aiMessage = rawMessage.replace(/\s*COACHING_NOTE:\s*.+$/im, '').trim();
        const recommendation = recommendationMatch
          ? recommendationMatch[1].trim()
          : this.getSkillRecommendation(activeScenario, message);
        this.conversationHistory[userId].push({ role: 'assistant', content: aiMessage });
        return { message: aiMessage, recommendation };
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
    return {
      message: responses[((state?.turnCount || 1) - 1) % responses.length],
      recommendation: this.getSkillRecommendation(activeScenario, message)
    };
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
        bestScore: Math.max(profile.scenarioProgress[state.type]?.bestScore || 0, score),
        mastery: Math.min(100, Math.max(
          profile.scenarioProgress[state.type]?.mastery || 0,
          score >= 75 ? ((profile.scenarioProgress[state.type]?.attempts || 0) + 1) * 50 : score
        ))
      };
      this.saveProfiles();
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
