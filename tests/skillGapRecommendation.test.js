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

  await service.generateSkillGapRecommendation(userId);
  assert.equal(requests.length, 3);
  assert.match(requests[2][0].content, /lowest relevant rubric/);
  assert.equal(JSON.parse(requests[2][1].content).assessment.rubrics['Problem Solving'], 9);
  assert.equal(JSON.parse(requests[2][1].content).scenario, scenario.name);
});
