const assert = require('node:assert/strict');
const test = require('node:test');
const GroqService = require('../services/groqService');

function makeService(userProfiles) {
  const service = new GroqService(null);
  service.userProfiles = userProfiles;
  let saveCount = 0;
  service.saveProfiles = () => {
    saveCount += 1;
  };
  return {
    service,
    getSaveCount: () => saveCount
  };
}

test('verified matching email preserves legacy stats under the Clerk user ID', () => {
  const legacyProfile = {
    userId: 'user123',
    name: 'Demo User',
    email: 'demo@codeapex.com',
    completedScenarios: 12,
    totalAttempts: 34,
    totalScore: 984,
    scenarioProgress: { manager_review: { attempts: 8, bestScore: 85 } }
  };
  const { service, getSaveCount } = makeService({ user123: legacyProfile });

  const profile = service.getOrCreateClerkProfile('clerk_user_1', {
    email: 'DEMO@CODEAPEX.COM',
    emailVerified: true,
    name: 'Clerk User'
  });

  assert.equal(profile.userId, 'clerk_user_1');
  assert.equal(profile.name, 'Clerk User');
  assert.equal(profile.completedScenarios, 12);
  assert.deepEqual(profile.scenarioProgress, legacyProfile.scenarioProgress);
  assert.equal(profile.legacyDemo, true);
  assert.equal(legacyProfile.migratedTo, 'clerk_user_1');
  assert.equal(service.getUserStats('clerk_user_1').hardScenariosUnlocked, true);
  assert.equal(service.userProfiles.user123, legacyProfile);
  assert.equal(getSaveCount(), 1);
});

test('unverified email does not link a legacy profile', () => {
  const legacyProfile = {
    userId: 'legacy_user',
    name: 'Legacy User',
    email: 'person@example.com',
    completedScenarios: 4,
    totalAttempts: 4,
    totalScore: 300,
    scenarioProgress: {}
  };
  const { service } = makeService({ legacy_user: legacyProfile });

  const profile = service.getOrCreateClerkProfile('clerk_user_2', {
    email: 'person@example.com',
    emailVerified: false,
    name: 'New User'
  });

  assert.equal(profile.userId, 'clerk_user_2');
  assert.equal(profile.completedScenarios, 0);
  assert.equal(service.userProfiles.legacy_user, legacyProfile);
});

test('ambiguous verified email matches do not merge legacy profiles', () => {
  const profile = () => ({
    email: 'duplicate@example.com',
    completedScenarios: 3,
    totalAttempts: 3,
    totalScore: 200,
    scenarioProgress: {}
  });
  const { service } = makeService({
    legacy_one: { ...profile(), userId: 'legacy_one' },
    legacy_two: { ...profile(), userId: 'legacy_two' }
  });

  const result = service.getOrCreateClerkProfile('clerk_user_3', {
    email: 'duplicate@example.com',
    emailVerified: true,
    name: 'New User'
  });

  assert.equal(result.userId, 'clerk_user_3');
  assert.equal(result.completedScenarios, 0);
});

test('profile for an existing Clerk ID is reused on subsequent sign-ins', () => {
  const { service, getSaveCount } = makeService({});
  const firstProfile = service.getOrCreateClerkProfile('clerk_user_4', {
    email: 'user@example.com',
    emailVerified: true,
    name: 'User Name'
  });
  const secondProfile = service.getOrCreateClerkProfile('clerk_user_4', {
    email: 'user@example.com',
    emailVerified: true,
    name: 'Changed Name'
  });

  assert.equal(secondProfile, firstProfile);
  assert.equal(secondProfile.name, 'User Name');
  assert.equal(getSaveCount(), 1);
});
