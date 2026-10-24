class VoiceService {
  constructor() {
    this.recordings = [];
  }

  analyzeVoice(data) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('Voice data is required');
    }

    const transcript = typeof data.transcript === 'string' ? data.transcript.trim() : '';
    if (!transcript) {
      throw new Error('Voice transcript cannot be empty');
    }

    const duration = Number.isFinite(data.duration) && data.duration >= 0
      ? Math.round(data.duration * 10) / 10
      : 0;
    const confidence = Number.isFinite(data.confidence)
      ? Math.max(0, Math.min(100, Math.round(data.confidence)))
      : 0;
    const recording = {
      userId: data.userId || null,
      transcript,
      duration,
      confidence,
      createdAt: new Date().toISOString()
    };

    this.recordings.push(recording);
    if (this.recordings.length > 100) this.recordings.shift();

    return {
      duration,
      confidence,
      feedback: confidence >= 80
        ? 'Clear delivery.'
        : confidence >= 50
          ? 'Your response was understood. Try speaking a little more clearly.'
          : 'Try speaking closer to the microphone and at a steady pace.'
    };
  }
}

module.exports = VoiceService;
