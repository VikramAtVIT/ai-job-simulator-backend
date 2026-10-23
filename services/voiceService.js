// ============ VOICE SERVICE ============
// Handles audio processing, transcription, and voice feedback

class VoiceService {
  constructor() {
    this.audioChunks = new Map();
    this.recordings = new Map();
  }

  // ============ AUDIO PROCESSING ============

  /**
   * Process incoming audio data
   * @param {string} userId - User ID
   * @param {string} base64Audio - Base64 encoded audio
   * @param {number} duration - Duration in milliseconds
   * @returns {object} Processing result
   */
  async processAudio(userId, base64Audio, duration) {
    try {
      // Store recording metadata
      const recordingId = `rec-${userId}-${Date.now()}`;
      
      this.recordings.set(recordingId, {
        userId: userId,
        timestamp: new Date(),
        duration: duration,
        size: base64Audio.length,
        status: 'processed'
      });

      // Log for debugging
      console.log(`🎤 Audio processed:`);
      console.log(`   Duration: ${(duration / 1000).toFixed(1)}s`);
      console.log(`   Size: ${Math.round(base64Audio.length / 1024)}KB`);
      console.log(`   Recording ID: ${recordingId}`);

      return {
        success: true,
        recordingId: recordingId,
        duration: duration,
        processedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error processing audio:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ============ VOICE TRANSCRIPTION (Placeholder for Future) ============

  /**
   * Transcribe audio to text (future implementation with speech-to-text)
   * @param {string} base64Audio - Base64 encoded audio
   * @returns {string} Transcribed text
   */
  async transcribeAudio(base64Audio) {
    try {
      // Future: Integrate with Google Cloud Speech-to-Text or Azure Speech Services
      // For now, return placeholder
      
      console.log('📝 Transcription would happen here (future feature)');
      
      return {
        success: true,
        text: '[Voice transcription not yet implemented]',
        confidence: 0
      };
    } catch (error) {
      console.error('Transcription error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ============ VOICE ANALYSIS ============

  /**
   * Analyze voice characteristics (tone, pace, confidence)
   * @param {number} duration - Audio duration in ms
   * @returns {object} Analysis results
   */
  analyzeVoice(duration) {
    try {
      // Simple heuristics based on recording duration and patterns
      
      const durationSeconds = duration / 1000;
      
      // Determine pace (words per minute estimate)
      // Average speaking pace is 120-150 WPM
      const estimatedWords = (durationSeconds / 60) * 135;
      const pace = estimatedWords < 100 ? 'slow' : estimatedWords > 180 ? 'fast' : 'normal';
      
      // Confidence based on smooth recording (no long pauses)
      const pauseIndicator = durationSeconds > 30 ? 'confident' : 'hesitant';
      
      return {
        duration: durationSeconds,
        estimatedWords: Math.round(estimatedWords),
        pace: pace,
        confidence: pauseIndicator,
        clarity: 'clear' // Would need audio analysis for real clarity assessment
      };
    } catch (error) {
      console.error('Voice analysis error:', error);
      return {
        error: error.message
      };
    }
  }

  // ============ VOICE FEEDBACK GENERATION ============

  /**
   * Generate feedback based on voice recording
   * @param {number} duration - Duration in ms
   * @param {string} scenarioType - Type of scenario
   * @returns {object} Voice feedback
   */
  generateVoiceFeedback(duration, scenarioType) {
    try {
      const analysis = this.analyzeVoice(duration);
      
      const feedbackByScenario = {
        manager_review: {
          slow: "Your pace was thoughtful and measured. Great for conveying confidence during discussions.",
          normal: "Your speaking pace was natural and professional. Well balanced.",
          fast: "You spoke quickly - consider slowing down to emphasize key points."
        },
        client_requirement: {
          slow: "Your deliberate pace shows confidence and clarity. Clients appreciate this.",
          normal: "Good pace for explaining requirements. Professional tone.",
          fast: "Consider pacing yourself. Clients may need time to process complex requirements."
        },
        production_incident: {
          slow: "Clear and measured. Good for critical situations requiring precision.",
          normal: "Appropriate pace for technical discussion. Professional.",
          fast: "Adrenaline showing! Good energy, but ensure clarity in technical communication."
        },
        difficult_colleague: {
          slow: "Measured tone suggests calmness. Good for conflict resolution.",
          normal: "Balanced and professional tone.",
          fast: "Energy is high. Remember to breathe and give the other person space to respond."
        }
      };

      const paceCategory = analysis.pace;
      const scenario = feedbackByScenario[scenarioType] || feedbackByScenario.manager_review;
      const feedback = scenario[paceCategory];

      return {
        success: true,
        voiceAnalysis: analysis,
        feedback: feedback,
        suggestions: this.generateSuggestions(analysis, scenarioType)
      };
    } catch (error) {
      console.error('Feedback generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate suggestions for improvement
   * @param {object} analysis - Voice analysis
   * @param {string} scenarioType - Scenario type
   * @returns {array} Improvement suggestions
   */
  generateSuggestions(analysis, scenarioType) {
    const suggestions = [];

    // Pace suggestions
    if (analysis.pace === 'fast') {
      suggestions.push({
        icon: '🐢',
        title: 'Slow Your Pace',
        tip: 'Try speaking 10-15% slower. Pause after important points to let them sink in.'
      });
    } else if (analysis.pace === 'slow') {
      suggestions.push({
        icon: '🚀',
        title: 'Add Energy',
        tip: 'Slightly increase your pace to maintain engagement and show confidence.'
      });
    }

    // Confidence suggestions
    if (analysis.confidence === 'hesitant') {
      suggestions.push({
        icon: '💪',
        title: 'Build Confidence',
        tip: 'Practice your responses beforehand. Confident tone comes with preparation.'
      });
    }

    // Scenario-specific suggestions
    if (scenarioType === 'difficult_colleague') {
      suggestions.push({
        icon: '👂',
        title: 'Active Listening',
        tip: 'Leave space for the other person to respond. Avoid talking continuously.'
      });
    } else if (scenarioType === 'production_incident') {
      suggestions.push({
        icon: '🎯',
        title: 'Stay Focused',
        tip: 'Keep technical explanations clear and concise. Avoid rambling.'
      });
    }

    return suggestions;
  }

  // ============ RECORDING MANAGEMENT ============

  /**
   * Get recording statistics
   * @param {string} userId - User ID
   * @returns {object} Recording stats
   */
  getRecordingStats(userId) {
    try {
      const userRecordings = Array.from(this.recordings.values()).filter(
        rec => rec.userId === userId
      );

      if (userRecordings.length === 0) {
        return {
          totalRecordings: 0,
          totalDuration: 0,
          averageDuration: 0,
          recordings: []
        };
      }

      const totalDuration = userRecordings.reduce((sum, rec) => sum + rec.duration, 0);
      const averageDuration = totalDuration / userRecordings.length;

      return {
        totalRecordings: userRecordings.length,
        totalDuration: Math.round(totalDuration / 1000), // in seconds
        averageDuration: Math.round(averageDuration / 1000), // in seconds
        recordings: userRecordings.map(rec => ({
          recordingId: rec.recordingId,
          timestamp: rec.timestamp,
          duration: Math.round(rec.duration / 1000),
          size: Math.round(rec.size / 1024) // in KB
        }))
      };
    } catch (error) {
      console.error('Stats error:', error);
      return { error: error.message };
    }
  }

  /**
   * Clear recordings for a user
   * @param {string} userId - User ID
   */
  clearUserRecordings(userId) {
    try {
      const keysToDelete = [];
      for (const [key, value] of this.recordings) {
        if (value.userId === userId) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.recordings.delete(key));
      
      console.log(`✅ Cleared ${keysToDelete.length} recordings for user ${userId}`);
      return { success: true, cleared: keysToDelete.length };
    } catch (error) {
      console.error('Clear error:', error);
      return { success: false, error: error.message };
    }
  }

  // ============ AUDIO VALIDATION ============

  /**
   * Validate audio data
   * @param {string} base64Audio - Base64 audio data
   * @param {number} duration - Duration in ms
   * @returns {object} Validation result
   */
  validateAudio(base64Audio, duration) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check if audio exists
    if (!base64Audio || base64Audio.length === 0) {
      validation.isValid = false;
      validation.errors.push('No audio data provided');
    }

    // Check minimum duration (at least 1 second)
    if (duration < 1000) {
      validation.isValid = false;
      validation.errors.push('Recording too short (minimum 1 second)');
    }

    // Check maximum duration (maximum 5 minutes)
    if (duration > 300000) {
      validation.isValid = false;
      validation.errors.push('Recording too long (maximum 5 minutes)');
    }

    // Check size (maximum 5MB)
    const sizeMB = base64Audio.length / (1024 * 1024);
    if (sizeMB > 5) {
      validation.isValid = false;
      validation.errors.push('File too large (maximum 5MB)');
    }

    // Warnings for suboptimal recordings
    if (duration < 5000) {
      validation.warnings.push('Recording is quite short - provide more detail for better feedback');
    }

    if (duration > 120000) {
      validation.warnings.push('Recording is long - consider being more concise');
    }

    return validation;
  }

  // ============ MOCK TRANSCRIPTION (Future Implementation) ============

  /**
   * Generate mock transcription for demo purposes
   * @param {number} duration - Recording duration
   * @returns {string} Mock transcribed text
   */
  getMockTranscription(duration) {
    const durationSeconds = duration / 1000;
    
    const mockResponses = {
      manager_review: [
        "I believe the project went very well. The team collaborated effectively and we met all our milestones on time.",
        "I'm proud of what we accomplished. We faced some challenges with resource allocation, but we worked through them.",
        "This quarter showed significant growth. I'd like to continue building on this momentum and take on more responsibilities."
      ],
      client_requirement: [
        "We can definitely implement those features. Here's my approach: first we'll analyze the requirements, then create a detailed specification.",
        "The timeline looks feasible. We'll need approximately 4 weeks for development, 1 week for testing, and 2 weeks for refinement.",
        "I understand your concerns. Let me propose an alternative solution that addresses your budget constraints while meeting your needs."
      ],
      production_incident: [
        "I'm checking the error logs now. It looks like the database connection is timing out. Let me investigate the connection pool settings.",
        "I've identified the issue. There's a memory leak in the service. I'm implementing a fix and will deploy it within the hour.",
        "The rollback is complete. We're now running the previous stable version. Let me schedule a post-mortem to prevent this in the future."
      ],
      difficult_colleague: [
        "I appreciate you bringing this up. I didn't realize my actions affected you that way. Let's talk about how we can work better together.",
        "You're right, I should have communicated better. Going forward, I'll make sure to loop you in on decisions that impact your work.",
        "I understand your frustration. Let's focus on solutions. What can I do differently to support the team better?"
      ]
    };

    return mockResponses;
  }
}

module.exports = VoiceService;