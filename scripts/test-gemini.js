// scripts/test-gemini.js
// Day 1 Step 4: Verify Gemini multimodal call with structured JSON schema
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenAI, Type } = require('@google/genai');

// Centralized areas and checklists configuration
// Adding "kitchen" later only requires adding one object here!
const AREAS = [
  {
    id: 'toilet',
    name: 'Toilet',
    checklist: [
      'Bowl, sink and floor visibly clean',
      'No stains, hair or rubbish',
      'Mirror free of marks',
    ],
  },
  {
    id: 'room',
    name: 'Room',
    checklist: [
      'Floor swept and mopped',
      'No rubbish or dust on surfaces',
      'Bed or furniture tidy',
      'No visible stains',
    ],
  },
];

async function main() {
  // Allow passing custom photo and area from CLI, or default to toilet-clean.jpg
  const targetAreaId = process.argv[3] || 'toilet';
  const targetArea = AREAS.find((a) => a.id === targetAreaId) || AREAS[0];

  const defaultPhoto = path.join(__dirname, '..', 'test-photos', 'toilet-clean.jpg');
  const photoPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPhoto;

  if (!fs.existsSync(photoPath)) {
    console.error(`Photo not found at: ${photoPath}`);
    process.exit(1);
  }

  console.log(`Checking Area: "${targetArea.name}" (${targetArea.id})`);
  console.log(`Reading test photo: ${photoPath}...`);
  const imageBuffer = fs.readFileSync(photoPath);
  const base64Image = imageBuffer.toString('base64');

  // Initialize Vertex AI client using ADC
  const ai = new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || 'global',
  });

  // Schema matching docs/DATA_MODEL.md (dynamically derived from AREAS)
  const photoCheckSchema = {
    type: Type.OBJECT,
    properties: {
      area: {
        type: Type.STRING,
        enum: AREAS.map((a) => a.id),
        description: 'The area being inspected',
      },
      verdict: {
        type: Type.STRING,
        enum: ['pass', 'flag'],
        description: 'pass if clean and meets checklist; flag if visible issue, dirty, blurry, too dark, or wrong area',
      },
      reason: {
        type: Type.STRING,
        description: 'One short specific sentence explaining the verdict that a cleaner can act on',
      },
    },
    required: ['area', 'verdict', 'reason'],
  };

  const checklistLines = targetArea.checklist.map((item) => `- ${item}`).join('\n');

  const promptText = `
You are an expert cleaning inspector for M Clean.
Area being checked: ${targetArea.id}.

Standard checklist for "${targetArea.name}":
${checklistLines}

Rules:
1. Judge only what is clearly visible in the photo.
2. Return "flag" if the photo is blurry, too dark, or shows a different room/area.
3. Return "flag" if any part of the checklist is not met.
4. Give a short, concise reason (one sentence) that a cleaner can act on.
5. The AI never "certifies" a room is clean. State what the visible photo evidence shows.
`.trim();

  console.log(`Calling Gemini (${process.env.GEMINI_MODEL})...`);

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL,
      contents: [
        promptText,
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: photoCheckSchema,
        temperature: 0.2,
      },
    });

    console.log('\n--- Gemini Photo Check Result ---');
    console.log(response.text);

    // Validate parsed JSON
    const parsed = JSON.parse(response.text);
    if (parsed.area && parsed.verdict && parsed.reason) {
      console.log('\nResult is valid against schema! ✅');
    } else {
      console.error('\nResult missing required fields ❌');
    }
  } catch (err) {
    console.error('Gemini API call failed:', err.message);
    process.exit(1);
  }
}

main();
