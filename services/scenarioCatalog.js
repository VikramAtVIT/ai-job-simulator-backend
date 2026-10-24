const scenarios = {
  manager_review: {
    name: 'Manager performance review',
    difficulty: 'easy',
    category: 'Career growth',
    role: 'a supportive but honest manager conducting a quarterly performance review',
    goal: 'explore achievements, challenges, feedback, and a concrete growth plan',
    focus: 'Ask about evidence, impact, ownership, and what support the employee needs.',
    intro: 'Welcome to your performance review. I am your manager, and we will discuss your recent achievements, challenges, and growth goals. Start by summarizing one result you are proud of and the impact it had.',
    assessment: 'Assess ownership, evidence of impact, reflection, and ability to set a measurable growth goal.',
    followups: ['What evidence would show that this made a meaningful difference to the team?', 'What would you change if you had to handle the same challenge next quarter?', 'Which part did you personally own, and where would support have helped?', 'How will you turn that learning into one measurable goal for next month?']
  },
  client_requirement: {
    name: 'Client requirement discussion',
    difficulty: 'medium',
    category: 'Product & clients',
    role: 'a client explaining a business requirement to a technical professional',
    goal: 'clarify needs, constraints, priorities, scope, and delivery expectations',
    focus: 'Challenge vague assumptions and ask for measurable acceptance criteria.',
    intro: 'Welcome to the client requirements discussion. I am the client, and I need your help shaping a feature with a tight deadline. Start by asking the most important question you need answered before proposing a solution.',
    assessment: 'Assess requirement discovery, technical trade-offs, scope management, and clear acceptance criteria.',
    followups: ['Which user need should we prioritize first, and how would we know it is solved?', 'What is the smallest useful first release, and what can safely wait?', 'Which constraint could change your proposal most: budget, timeline, or user impact?', 'What acceptance test would let us agree that this requirement is complete?']
  },
  production_incident: {
    name: 'Production incident response',
    difficulty: 'hard',
    category: 'Reliability & operations',
    role: 'an incident commander coordinating a live production outage',
    goal: 'restore service safely while communicating status, impact, mitigation, and follow-up actions',
    focus: 'Prioritize customer impact, observability, rollback or mitigation, and calm communication.',
    intro: 'You are now leading a live production incident. Customer requests are failing and the team is waiting for your direction. Start by explaining how you would assess impact and stabilize the service safely.',
    assessment: 'Assess incident triage, evidence-led diagnosis, safe mitigation, customer impact, and communication cadence.',
    followups: ['What signal would confirm whether the impact is growing or contained?', 'Which mitigation is safest to try first, and what would make you roll it back?', 'Who needs the next status update, and what can you confidently tell them now?', 'After recovery, what evidence would help identify the underlying cause?']
  },
  difficult_colleague: {
    name: 'Difficult colleague conversation',
    difficulty: 'hard',
    category: 'Communication & collaboration',
    role: 'a skeptical colleague who disagrees with the user’s technical approach',
    goal: 'reach a constructive decision using evidence, empathy, trade-offs, and shared goals',
    focus: 'Push back respectfully and test the user’s assumptions without becoming hostile.',
    intro: 'Welcome to a challenging technical discussion. I am a teammate who disagrees with your approach and wants evidence before moving forward. Explain your position, then show how you would keep the conversation constructive.',
    assessment: 'Assess active listening, empathy, evidence-based disagreement, and collaborative resolution.',
    followups: ['What shared success measure could we use to compare our approaches fairly?', 'Which assumption should we test first with a small, low-risk experiment?', 'What concern do you think I have not addressed yet?', 'How could we combine the strongest parts of both proposals?']
  },
  daily_standup: {
    name: 'Daily standup update',
    difficulty: 'easy',
    category: 'Communication & collaboration',
    role: 'a team lead facilitating a daily standup',
    goal: 'get a concise update, identify blockers, and establish a specific next step',
    focus: 'Coach the user to be brief, concrete, and action-oriented.',
    intro: 'Welcome to today’s standup. Give a concise update covering what you completed, what you will do next, and any blocker that needs the team’s help.',
    assessment: 'Assess concise communication, concrete outcomes, blocker identification, and ownership of next steps.',
    followups: ['What specific outcome should the team expect from you by the end of today?', 'Is anything blocking that next step, and who can help remove the blocker?', 'Who depends on this work, and when should they expect an update?', 'What is the most important progress the team should know about first?']
  },
  priority_conflict: {
    name: 'Priority conflict resolution',
    difficulty: 'hard',
    category: 'Leadership & planning',
    role: 'a stakeholder managing two competing urgent requests',
    goal: 'compare impact, urgency, dependencies, and capacity to agree on priorities',
    focus: 'Ask the user to explain trade-offs and communicate a clear decision to both stakeholders.',
    intro: 'You are handling two urgent stakeholder requests with limited capacity. Start by explaining how you would compare impact, urgency, and dependencies before choosing what comes first.',
    assessment: 'Assess prioritization logic, impact analysis, transparent trade-offs, and expectation setting.',
    followups: ['Which request has the greater customer impact if it waits another day?', 'What dependency or deadline would change your ordering of these requests?', 'How will you reset expectations with the stakeholder whose request comes second?', 'What evidence would make you revisit this priority decision?']
  },
  code_review: {
    name: 'Code review & maintainability',
    difficulty: 'medium',
    category: 'Software engineering',
    role: 'a senior engineer reviewing a proposed change with the user',
    goal: 'improve correctness, readability, test coverage, and maintainability without blocking delivery',
    focus: 'Ask for edge cases, test strategy, clear review comments, and proportionate changes.',
    intro: 'You are reviewing a pull request that changes a shared API used by several teams. The happy path works, but there are no tests for invalid input or backward compatibility. Explain what you would review first and how you would give actionable feedback.',
    assessment: 'Assess correctness, edge-case reasoning, test design, maintainability, and constructive review communication.',
    followups: ['Which boundary case could break existing callers, and how would you test it?', 'What test would give the strongest confidence without over-testing implementation details?', 'How would you separate a release-blocking defect from a useful follow-up improvement?', 'What would make this change easy for another engineer to maintain six months from now?']
  },
  system_design: {
    name: 'Scalable system design',
    difficulty: 'hard',
    category: 'Software engineering',
    role: 'a staff engineer discussing an architecture proposal',
    goal: 'design a reliable system by clarifying requirements and evaluating scale, consistency, and failure modes',
    focus: 'Ask about workload, bottlenecks, trade-offs, observability, and graceful degradation.',
    intro: 'We need to design a service that accepts a large spike in job applications and keeps status updates reliable. Start by clarifying the most important requirements before proposing components.',
    assessment: 'Assess requirements discovery, architecture choices, scalability, reliability, and explicit trade-off analysis.',
    followups: ['Which workload assumption most affects your design, and how would you validate it?', 'Where is the likely bottleneck during a traffic spike, and how would you protect that component?', 'What consistency guarantees does the user actually need for status updates?', 'How should the service behave if a downstream dependency becomes unavailable?']
  },
  security_review: {
    name: 'Security review & threat modeling',
    difficulty: 'hard',
    category: 'Security & privacy',
    role: 'a security engineer assessing a feature before release',
    goal: 'identify trust boundaries, sensitive data, abuse cases, and practical mitigations',
    focus: 'Probe authentication, authorization, validation, secrets, logging, and defense in depth.',
    intro: 'A new feature lets users upload documents and share them with teammates. We want to release quickly. Walk me through the most important security risks and how you would prioritize mitigations.',
    assessment: 'Assess threat identification, authorization boundaries, data minimization, mitigation quality, and security trade-offs.',
    followups: ['How would you prevent one user from accessing another user’s uploaded document?', 'What sensitive data should never appear in application logs?', 'Which abuse case would you test before enabling this for everyone?', 'How could we reduce the risk while still allowing a safe, limited launch?']
  },
  data_analysis: {
    name: 'Data analysis & experiment design',
    difficulty: 'medium',
    category: 'Data & decision-making',
    role: 'a product analyst reviewing an experiment proposal',
    goal: 'turn an ambiguous question into a measurable analysis with sound comparisons and caveats',
    focus: 'Ask about metrics, baselines, segments, bias, uncertainty, and decision criteria.',
    intro: 'A team says a new onboarding flow “feels better” and wants to roll it out. Explain what data you would collect and how you would decide whether it actually improved the experience.',
    assessment: 'Assess metric selection, experiment design, bias awareness, interpretation, and evidence-based decisions.',
    followups: ['Which primary metric best represents user success, and what guardrail metric would you pair with it?', 'How would you account for differences between the users who see each experience?', 'What result would be too uncertain to justify a full rollout?', 'How might an average result hide a poor outcome for one user group?']
  },
  debugging: {
    name: 'Debugging & root-cause analysis',
    difficulty: 'medium',
    category: 'Software engineering',
    role: 'an engineering partner investigating an intermittent defect',
    goal: 'form testable hypotheses and use evidence to isolate the cause without risky changes',
    focus: 'Ask for reproduction steps, logs, recent changes, minimal experiments, and verification.',
    intro: 'Users report that a page occasionally shows stale data, but the issue cannot be reproduced on demand. Describe how you would investigate it before changing code.',
    assessment: 'Assess hypothesis quality, diagnostic sequencing, evidence gathering, safe experiments, and verification.',
    followups: ['What is the smallest observation that would distinguish a cache issue from a race condition?', 'Which recent change or dependency would you inspect first, and why?', 'What instrumentation would help if the issue happens only in production?', 'How would you prove the fix addresses the cause and not just the symptom?']
  },
  product_tradeoff: {
    name: 'Product discovery & trade-offs',
    difficulty: 'medium',
    category: 'Product & clients',
    role: 'a product manager balancing user value and delivery constraints',
    goal: 'identify user needs and choose a measurable, appropriately scoped solution',
    focus: 'Challenge feature assumptions and ask about outcomes, alternatives, and success measures.',
    intro: 'A stakeholder requests a long list of dashboard features, but the team can deliver only one improvement this month. Explain how you would uncover the underlying need and choose what to build.',
    assessment: 'Assess user empathy, problem framing, prioritization, validation, and outcome measurement.',
    followups: ['Which user behavior suggests the underlying problem is happening today?', 'What low-cost test could validate the need before building the full feature?', 'Which request has the clearest link to a measurable user outcome?', 'What would you deliberately leave out of the first release?']
  },
  privacy_decision: {
    name: 'Privacy & data handling',
    difficulty: 'hard',
    category: 'Security & privacy',
    role: 'a privacy lead reviewing a request for user data',
    goal: 'balance product needs with consent, minimization, retention, and user trust',
    focus: 'Ask what data is necessary, who can access it, how long it is retained, and how users are informed.',
    intro: 'A team wants to collect detailed usage events “just in case” to improve recommendations later. Explain what questions you would ask before approving the collection.',
    assessment: 'Assess data minimization, consent, access controls, retention, transparency, and privacy-aware alternatives.',
    followups: ['What is the minimum data needed to answer the stated product question?', 'How should a user understand and control this collection?', 'When should the data expire, and who is allowed to access it?', 'Could aggregated or on-device data meet the need with less privacy risk?']
  },
  salary_negotiation: {
    name: 'Salary negotiation',
    difficulty: 'medium',
    category: 'Career growth',
    role: 'a hiring manager discussing compensation with a candidate',
    goal: 'reach a respectful, evidence-based agreement on compensation and total rewards',
    focus: 'Ask the user to state value, research, priorities, and a clear, collaborative request.',
    intro: 'I’m pleased with your interview and would like to discuss the offer. The base salary is lower than you expected. Tell me how you would respond and what information would help you decide.',
    assessment: 'Assess preparation, evidence-based advocacy, professional tone, flexibility, and decision clarity.',
    followups: ['What evidence of your impact supports the range you are requesting?', 'If base pay is fixed, which other part of the total package matters most to you?', 'What information would you need before accepting or declining?', 'How would you keep the discussion collaborative while clearly stating your minimum?']
  },
  customer_escalation: {
    name: 'Customer escalation',
    difficulty: 'hard',
    category: 'Product & clients',
    role: 'an upset customer whose business is disrupted by a service issue',
    goal: 'acknowledge impact, establish facts, explain next steps, and rebuild trust',
    focus: 'Encourage empathy, accountability, clear timelines, and no unsupported promises.',
    intro: 'A customer is upset because an outage disrupted their team’s work, and they have not received a clear update. Respond to them and explain what you will do next.',
    assessment: 'Assess empathy, accountability, clarity under pressure, expectation setting, and follow-through.',
    followups: ['What can you acknowledge about their impact without making assumptions?', 'What specific update can you promise, and when will you provide it?', 'How would you explain uncertainty without sounding evasive?', 'What follow-up would demonstrate that you took ownership after service returns?']
  },
  delegation: {
    name: 'Delegation & team leadership',
    difficulty: 'medium',
    category: 'Leadership & planning',
    role: 'a team lead assigning work on a time-sensitive project',
    goal: 'delegate based on outcomes, capacity, context, autonomy, and support',
    focus: 'Ask for clear ownership, decision boundaries, check-ins, and equitable workload.',
    intro: 'A deadline is approaching and several tasks need owners. One teammate is already overloaded while another is ready to grow. Explain how you would assign the work and support the team.',
    assessment: 'Assess workload awareness, clear delegation, autonomy, coaching, and risk management.',
    followups: ['What outcome and decision authority would you give the new task owner?', 'How will you check progress without taking away their ownership?', 'What work can be deprioritized to keep the workload sustainable?', 'How would you make sure the teammate has context and a safe way to ask for help?']
  },
  ethical_dilemma: {
    name: 'Ethical decision-making',
    difficulty: 'hard',
    category: 'Ethics & judgment',
    role: 'a trusted peer discussing a consequential workplace decision',
    goal: 'identify affected parties, principles, risks, and responsible escalation options',
    focus: 'Probe evidence, conflicts of interest, harm, transparency, and appropriate escalation.',
    intro: 'You discover that a metric in a launch report is presented in a way that could mislead customers, though the team may not have intended harm. Explain how you would respond.',
    assessment: 'Assess integrity, stakeholder impact, evidence gathering, proportional action, and responsible escalation.',
    followups: ['Who could be harmed if the report stays as it is?', 'What facts would you verify before raising the concern?', 'How would you address this directly while preserving a clear record?', 'If the issue is dismissed, what responsible escalation path would you use?']
  },
  time_management: {
    name: 'Time management & delivery planning',
    difficulty: 'easy',
    category: 'Leadership & planning',
    role: 'a project lead helping the user plan a crowded work week',
    goal: 'make a realistic plan based on outcomes, dependencies, focus time, and capacity',
    focus: 'Ask the user to clarify priorities, break work down, surface risk, and communicate trade-offs.',
    intro: 'You have three deliverables due this week, two meetings that may create follow-up work, and one unexpected support request. Explain how you would make a realistic plan.',
    assessment: 'Assess prioritization, capacity awareness, sequencing, risk communication, and adaptability.',
    followups: ['Which deliverable has the highest impact if it slips, and why?', 'What dependency or unknown could change your plan?', 'How would you protect focused time while handling urgent requests?', 'What expectation would you reset with your manager or stakeholders today?']
  },
  feedback_conversation: {
    name: 'Giving constructive feedback',
    difficulty: 'medium',
    category: 'Communication & collaboration',
    role: 'a colleague receiving feedback about a missed handoff',
    goal: 'communicate specific observations, impact, curiosity, and a practical agreement',
    focus: 'Promote behavior-focused language, listening, psychological safety, and clear follow-through.',
    intro: 'A teammate has missed two handoffs, which delayed dependent work. You need to discuss it without damaging the relationship. How would you start the conversation?',
    assessment: 'Assess specificity, empathy, non-judgmental language, listening, and actionable agreements.',
    followups: ['What observable example would you use instead of making a judgment about intent?', 'How would you invite their perspective before proposing a solution?', 'What agreement would prevent the same handoff gap next time?', 'How will you check whether the change is working without micromanaging?']
  },
  inclusive_meeting: {
    name: 'Inclusive meeting facilitation',
    difficulty: 'easy',
    category: 'Communication & collaboration',
    role: 'a facilitator guiding a meeting where participation is uneven',
    goal: 'create space for diverse input and guide the group toward clear decisions',
    focus: 'Ask about accessible participation, balanced airtime, summaries, and explicit decision ownership.',
    intro: 'In a planning meeting, two people dominate the discussion while remote teammates and quieter colleagues have not spoken. Explain how you would facilitate the conversation.',
    assessment: 'Assess inclusive facilitation, active listening, balanced participation, accessibility, and decision clarity.',
    followups: ['How could you invite input without putting one person unexpectedly on the spot?', 'What option would help people contribute asynchronously or in writing?', 'How will you summarize the ideas so the group can compare them fairly?', 'How will you record the decision, owner, and follow-up?']
  },
  change_management: {
    name: 'Change management & stakeholder alignment',
    difficulty: 'hard',
    category: 'Leadership & planning',
    role: 'a department leader communicating a disruptive process change',
    goal: 'explain the reason for change, surface concerns, sequence adoption, and measure outcomes',
    focus: 'Probe stakeholder impact, feedback loops, support needs, risks, and transparent communication.',
    intro: 'A new workflow will change how three teams hand off work. The change is necessary, but people worry it will add overhead. Explain how you would introduce it and get the teams aligned.',
    assessment: 'Assess change rationale, stakeholder empathy, rollout planning, feedback mechanisms, and outcome measures.',
    followups: ['Who is most affected by this change and what concern should be heard first?', 'What small pilot could reveal friction before a wider rollout?', 'How will people get support while learning the new workflow?', 'What evidence would tell us to adapt or pause the rollout?']
  }
};

module.exports = scenarios;
