// src/gemini.js
// Gemini multimodal integration for area labeling and before-vs-after comparison.

const { GoogleGenAI } = require('@google/genai');
const { getAreaLabelPrompt, getComparisonPrompt } = require('./prompts');
const {
  areaLabelSchema,
  compareCheckSchema,
  validateAreaLabel,
  validateCompareCheck,
} = require('./schemas');

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION || 'global',
});

/**
 * Labels an area from its before photo.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<string>} e.g. "Toilet", "Bedroom"
 */
async function labelArea(buffer, mimeType) {
  const model = process.env.GEMINI_MODEL;
  const prompt = getAreaLabelPrompt();
  const base64Data = buffer.toString('base64');

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        prompt,
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: base64Data,
          },
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: areaLabelSchema,
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text);
    const valid = validateAreaLabel(parsed);
    if (valid.valid && parsed.areaLabel) {
      return parsed.areaLabel.trim();
    }
    return 'Area';
  } catch (err) {
    console.error('[Gemini] labelArea error:', err.message);
    return 'Area';
  }
}

/**
 * Compares before and after photos of an area.
 * @param {Buffer} beforeBuffer
 * @param {string} beforeMime
 * @param {Buffer} afterBuffer
 * @param {string} afterMime
 * @returns {Promise<{same_location: boolean, result: 'cleaned'|'issue_remaining'|'unclear', reason: string}>}
 */
async function comparePhotos(beforeBuffer, beforeMime, afterBuffer, afterMime) {
  const model = process.env.GEMINI_MODEL;
  const prompt = getComparisonPrompt();
  const base64Before = beforeBuffer.toString('base64');
  const base64After = afterBuffer.toString('base64');

  const requestPayload = {
    model,
    contents: [
      prompt,
      {
        inlineData: {
          mimeType: beforeMime || 'image/jpeg',
          data: base64Before,
        },
      },
      {
        inlineData: {
          mimeType: afterMime || 'image/jpeg',
          data: base64After,
        },
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: compareCheckSchema,
      temperature: 0.2,
    },
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent(requestPayload);
      const text = response.text;
      const parsed = JSON.parse(text);

      const validation = validateCompareCheck(parsed);
      if (validation.valid) {
        return parsed;
      }

      console.warn(`[Gemini] comparePhotos attempt ${attempt} validation failed: ${validation.error}`);
      if (attempt === 2) {
        throw new Error(`Comparison validation failed: ${validation.error}`);
      }
    } catch (err) {
      console.error(`[Gemini] comparePhotos attempt ${attempt} failed:`, err.message);
      if (attempt === 2) {
        throw new Error(`AI comparison check failed: ${err.message}`);
      }
    }
  }
}

/**
 * Evaluates a client complaint against all before/after photo pairs of a job.
 * @param {string} complaintText
 * @param {Array<{ areaLabel: string, beforeBuffer: Buffer, afterBuffer: Buffer, checkResult: object }>} pairsWithBuffers
 * @returns {Promise<{ finding: 'supported'|'not_supported'|'unclear', areaLabel: string, explanation: string, suggested_action: string }>}
 */
async function evaluateComplaint(complaintText, pairsWithBuffers) {
  const model = process.env.GEMINI_MODEL;
  const { getComplaintPrompt } = require('./prompts');
  const { complaintCheckSchema, validateComplaintCheck } = require('./schemas');

  const areaSummaries = pairsWithBuffers
    .map((p, i) => {
      const chk = p.checkResult
        ? `[AI Check: ${p.checkResult.result} - "${p.checkResult.reason}"]`
        : '[No AI Check]';
      return `- Area ${i + 1} (${p.areaLabel}): ${chk}`;
    })
    .join('\n');

  const prompt = getComplaintPrompt(complaintText, areaSummaries);

  const contents = [prompt];

  // Attach all photos (Before then After for each area)
  pairsWithBuffers.forEach((p, i) => {
    contents.push(`\n--- Area ${i + 1}: ${p.areaLabel} BEFORE cleaning ---`);
    if (p.beforeBuffer) {
      contents.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: p.beforeBuffer.toString('base64'),
        },
      });
    }
    contents.push(`\n--- Area ${i + 1}: ${p.areaLabel} AFTER cleaning ---`);
    if (p.afterBuffer) {
      contents.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: p.afterBuffer.toString('base64'),
        },
      });
    }
  });

  const requestPayload = {
    model,
    contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema: complaintCheckSchema,
      temperature: 0.2,
    },
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent(requestPayload);
      const text = response.text;
      const parsed = JSON.parse(text);

      const validation = validateComplaintCheck(parsed);
      if (validation.valid) {
        return parsed;
      }

      console.warn(`[Gemini] evaluateComplaint attempt ${attempt} validation failed: ${validation.error}`);
      if (attempt === 2) {
        return {
          finding: 'unclear',
          areaLabel: 'General',
          explanation: 'Unable to conclusively verify complaint against photo evidence.',
          suggested_action: 'Supervisor to follow up directly with the client.',
        };
      }
    } catch (err) {
      console.error(`[Gemini] evaluateComplaint attempt ${attempt} failed:`, err.message);
      if (attempt === 2) {
        return {
          finding: 'unclear',
          areaLabel: 'General',
          explanation: 'Photo verification service was unable to evaluate this item.',
          suggested_action: 'Contact client to discuss feedback.',
        };
      }
    }
  }
}

module.exports = {
  labelArea,
  comparePhotos,
  evaluateComplaint,
};
