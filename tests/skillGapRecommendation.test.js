const assert = require('node:assert/strict');
const test = require('node:test');
const GroqService = require('../services/groqService');

const scenarioTypes = [
  'product_tradeoff',
  'daily_standup',
  'manager_review',
  'system_design',
  'privacy_decision',
  'ethical_dilemma'
];

function makeService() {
  const service = new GroqService(null);
  service.userProfiles = {};
  service.accounts = {};
  service.saveProfiles = () => {};
  const requests = [];
  service.groq = {
    chat: {
      completions: {
        create: async ({ messages }) => {
          requests.push(messages);
          const systemPrompt = messages[0].content;
          const content = systemPrompt.includes('evidence-based workplace skills assessor')
            ? JSON.stringify({
              rubrics: {
                Communication: 18,
                'Problem Solving': 9,
                Professionalism: 20,
                Adaptability: 17
              },
              summary: 'The response showed ownership but did not compare options with evidence.'
            })
            : JSON.stringify({
              skill: 'Evidence-based decision making',
              evidence: 'You described the decision but did not cite supporting evidence.',
              nextStep: 'Practice comparing two options using impact and an explicit success measure.'
            });
          return { choices: [{ message: { content } }] };
        }
      }
    }
  };
  return { service, requests };
}

test('recommendations receive scenario-specific context for the dashboard scenarios', async () => {
  const { service, requests } = makeService();
  const userId = 'scenario-recommendation-test';

  for (const type of scenarioTypes) {
    const scenario = service.scenarioCatalog[type];
    assert.ok(scenario, `Expected scenario catalog entry for ${type}`);
    service.initializeScenario(userId, type);
    service.conversationHistory[userId].push({
      role: 'user',
      content: `I would address ${scenario.goal} by gathering evidence and agreeing on a measurable next step.`
    });
    service.userScenarioState[userId].turnCount = 1;

    const recommendation = await service.generateSkillGapRecommendation(userId);
    const [systemMessage, userMessage] = requests.at(-1);
    const requestData = JSON.parse(userMessage.content);

    assert.equal(recommendation.skill, 'Evidence-based decision making');
    assert.ok(systemMessage.content.includes(scenario.name));
    assert.ok(systemMessage.content.includes(scenario.goal));
    assert.ok(systemMessage.content.includes(scenario.focus));
    assert.ok(systemMessage.content.includes(scenario.assessment));
    assert.equal(requestData.scenario, scenario.name);
    assert.equal(requestData.answers.length, 1);
  }
});

test('AI recommendations are compacted to short display-ready fields', async () => {
  const { service } = makeService();
  const userId = 'compact-recommendation-test';
  service.initializeScenario(userId, 'daily_standup');
  service.conversationHistory[userId].push({ role: 'user', content: 'I will share the specific result today.' });
  service.userScenarioState[userId].turnCount = 1;
  service.groq.chat.completions.create = async () => ({
    choices: [{
      message: {
        content: JSON.stringify({
          skill: 'Clear concise stakeholder communication and expectation setting',
          evidence: 'You mentioned that you would share an update, but did not specify what outcome the team should expect or when.',
          nextStep: 'In your next update, state the concrete result, identify any blocker, and give a clear time for your next progress update.'
        })
      }
    }]
  });

  const recommendation = await service.generateSkillGapRecommendation(userId);

  assert.ok(recommendation.skill.length <= 48);
  assert.ok(recommendation.skill.split(/\s+/).length <= 5);
  assert.ok(recommendation.evidence.length <= 120);
  assert.ok(recommendation.evidence.split(/\s+/).length <= 14);
  assert.ok(recommendation.nextStep.length <= 130);
  assert.ok(recommendation.nextStep.split(/\s+/).length <= 16);
});

test('every catalog scenario receives grounded fallback guidance when all AI providers are unavailable', async () => {
  const { service } = makeService();
  service.groq = null;
  service.fallbackProviders = [];
  const scenarioTypes = Object.keys(service.scenarioCatalog);

  for (const type of scenarioTypes) {
    const userId = `fallback-${type}`;
    const scenario = service.scenarioCatalog[type];
    const answer = `For ${scenario.goal}, I would confirm the evidence, communicate the decision, and measure the result.`;
    service.initializeScenario(userId, type);
    service.conversationHistory[userId].push({ role: 'user', content: answer });
    service.userScenarioState[userId].turnCount = 1;

    const recommendation = await service.generateSkillGapRecommendation(userId);

    assert.equal(recommendation.source, 'scenario_fallback', type);
    assert.ok(recommendation.skill.length > 0, type);
    assert.ok(recommendation.evidence.includes('measure the result'), type);
    const focusOpening = scenario.focus.split(',')[0].slice(0, 25).toLowerCase();
    assert.ok(recommendation.nextStep.toLowerCase().includes(focusOpening), type);
  }
});

test('scenario-grounded guidance is returned when configured AI providers fail', async () => {
  const { service } = makeService();
  const userId = 'provider-failure-fallback';
  const scenario = service.scenarioCatalog.daily_standup;
  service.groq = null;
  service.fallbackProviders = [{ name: 'Unavailable provider' }];
  service.callFallbackProvider = async () => {
    throw new Error('Provider request failed');
  };
  service.initializeScenario(userId, 'daily_standup');
  service.conversationHistory[userId].push({
    role: 'user',
    content: 'I completed the report and will share the status update by noon.'
  });
  service.userScenarioState[userId].turnCount = 1;

  const recommendation = await service.generateSkillGapRecommendation(userId);

  assert.equal(recommendation.source, 'scenario_fallback');
  assert.equal(recommendation.skill, 'Concise Communication');
  assert.ok(recommendation.nextStep.toLowerCase().includes(scenario.focus.slice(0, 25).toLowerCase()));
});

test('post-assessment recommendations use the latest rubric instead of the cached pre-assessment result', async () => {
  const { service, requests } = makeService();
  const userId = 'assessment-recommendation-test';
  const scenario = service.scenarioCatalog.system_design;
  service.userProfiles[userId] = {
    userId,
    name: 'Test User',
    email: '',
    completedScenarios: 0,
    totalAttempts: 0,
    totalScore: 0,
    scenarioProgress: {}
  };
  service.initializeScenario(userId, 'system_design');
  service.conversationHistory[userId].push({
    role: 'user',
    content: 'I would start by checking the workload and defining reliability targets.'
  });
  service.userScenarioState[userId].turnCount = 1;

  await service.generateSkillGapRecommendation(userId);
  assert.equal(requests.length, 1);

  await service.generateFeedback(userId);
  assert.equal(service.userScenarioState[userId].latestSkillGapRecommendation, null);

  service.groq = null;
  service.fallbackProviders = [];
  await service.generateSkillGapRecommendation(userId);
  assert.equal(requests.length, 2);
  assert.equal(service.userScenarioState[userId].latestSkillGapRecommendation.recommendation.source, 'scenario_fallback');
  assert.match(service.userScenarioState[userId].latestSkillGapRecommendation.recommendation.evidence, /Problem Solving \(9\/25\)/);
});
