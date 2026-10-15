// src/schemas.js
// Gemini structured output response schemas and validation logic.

const { Type } = require('@google/genai');

const areaLabelSchema = {
  type: Type.OBJECT,
  properties: {
    areaLabel: {
      type: Type.STRING,
      description: 'Concise title of the area (e.g. Toilet, Bedroom, Living Room, Kitchen)',
    },
  },
  required: ['areaLabel'],
};

const compareCheckSchema = {
  type: Type.OBJECT,
  properties: {
    same_location: {
      type: Type.BOOLEAN,
      description: 'true if photo 1 and photo 2 are the exact same area/spot; false if different rooms or angles',
    },
    result: {
      type: Type.STRING,
      enum: ['cleaned', 'issue_remaining', 'unclear'],
      description: 'cleaned if checklist met, issue_remaining if dirty or tools left behind, unclear if location mismatch or blurry',
    },
    reason: {
      type: Type.STRING,
      description: 'One short, specific sentence explaining the result that a cleaner can act on',
    },
  },
  required: ['same_location', 'result', 'reason'],
};

const complaintCheckSchema = {
  type: Type.OBJECT,
  properties: {
    finding: {
      type: Type.STRING,
      enum: ['supported', 'not_supported', 'unclear'],
      description: 'supported if photos prove issue, not_supported if photos disprove issue, unclear if smell or unphotographed area',
    },
    areaLabel: {
      type: Type.STRING,
      description: 'The area name involved, or General/Unknown',
    },
    explanation: {
      type: Type.STRING,
      description: '1-2 short factual sentences citing photo evidence without accusing anyone',
    },
    suggested_action: {
      type: Type.STRING,
      description: 'Practical, concise next step for management/technician',
    },
  },
  required: ['finding', 'areaLabel', 'explanation', 'suggested_action'],
};

function validateAreaLabel(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Response must be an object' };
  }
  if (typeof data.areaLabel !== 'string' || !data.areaLabel.trim()) {
    return { valid: false, error: 'areaLabel must be a non-empty string' };
  }
  return { valid: true };
}

function validateCompareCheck(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Response must be an object' };
  }
  if (typeof data.same_location !== 'boolean') {
    return { valid: false, error: 'same_location must be a boolean' };
  }
  const allowedResults = ['cleaned', 'issue_remaining', 'unclear'];
  if (!allowedResults.includes(data.result)) {
    return { valid: false, error: `result must be one of: ${allowedResults.join(', ')}` };
  }
  if (typeof data.reason !== 'string' || !data.reason.trim()) {
    return { valid: false, error: 'reason must be a non-empty string' };
  }

  // Enforce rule: if not same location, result must be unclear
  if (!data.same_location && data.result !== 'unclear') {
    data.result = 'unclear';
  }

  return { valid: true };
}

function validateComplaintCheck(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Response must be an object' };
  }
  const allowedFindings = ['supported', 'not_supported', 'unclear'];
  if (!allowedFindings.includes(data.finding)) {
    return { valid: false, error: `finding must be one of: ${allowedFindings.join(', ')}` };
  }
  if (typeof data.areaLabel !== 'string' || !data.areaLabel.trim()) {
    data.areaLabel = 'General';
  }
  if (typeof data.explanation !== 'string' || !data.explanation.trim()) {
    return { valid: false, error: 'explanation must be a non-empty string' };
  }
  if (typeof data.suggested_action !== 'string' || !data.suggested_action.trim()) {
    return { valid: false, error: 'suggested_action must be a non-empty string' };
  }
  return { valid: true };
}

module.exports = {
  areaLabelSchema,
  compareCheckSchema,
  complaintCheckSchema,
  validateAreaLabel,
  validateCompareCheck,
  validateComplaintCheck,
};
