/**
 * Vercel Serverless Function: POST /api/extract-syllabus
 *
 * Reads a photo of a syllabus page (textbook index, table of contents or a
 * coaching handout) and returns a structured chapter/subtopic list using
 * Google Gemini Flash vision. The API key stays server-side.
 *
 * Request JSON:  { "image": "<base64 or data URL>", "mimeType": "image/jpeg" }
 * Response JSON: { "topics": [{ "unit": "...", "title": "...", "minutes": 45 }] }
 *
 * Vercel → Project → Settings → Environment Variables:
 *   GEMINI_API_KEY  (required)
 *   GEMINI_MODEL    (optional, defaults to gemini-flash-lite-latest)
 */

// ~5.5 MB of base64 ≈ a 4 MB photo once decoded.
const MAX_BASE64_BYTES = 5.5 * 1024 * 1024;

const PROMPT = [
  'You are extracting a study syllabus from a photo of a textbook index, table of',
  'contents, or syllabus handout. Return every chapter and its subtopics you can read.',
  'Keep the original wording and spelling.',
  '- "unit" is the chapter or unit heading the topic belongs to.',
  '- "title" is the topic or subtopic line itself.',
  '- "minutes" is a study estimate in minutes (30, 45 or 60) based on difficulty.',
  'Preserve the order the topics appear in. Do not invent topics that are not visible.'
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          unit: { type: 'string' },
          title: { type: 'string' },
          minutes: { type: 'integer' }
        },
        required: ['unit', 'title']
      }
    }
  },
  required: ['topics']
};

module.exports.config = { api: { bodyParser: { sizeLimit: '8mb' } } };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'The server is missing GEMINI_API_KEY. Add it in Vercel → Settings → Environment Variables.'
    });
    return;
  }

  const body = req.body || {};
  const rawImage = typeof body.image === 'string' ? body.image : '';
  const mimeType = typeof body.mimeType === 'string' && body.mimeType ? body.mimeType : 'image/jpeg';
  const base64 = rawImage.includes(',') ? rawImage.slice(rawImage.indexOf(',') + 1) : rawImage;

  if (!base64) {
    res.status(400).json({ error: 'No image received.' });
    return;
  }
  if (base64.length > MAX_BASE64_BYTES) {
    res.status(413).json({ error: 'That photo is too large. Please use an image under 4 MB.' });
    return;
  }

  // The full Flash tiers get saturated and answer 503 under load while the lite
  // tiers stay responsive; the "-latest" alias also survives model retirements
  // (a pinned default silently started returning 404 once). Override with
  // GEMINI_MODEL if a different model is wanted.
  const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: base64 } }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA
        }
      })
    });

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      // 429/503 mean the model is overloaded, not that the photo is unreadable —
      // say so, because retrying the same photo is all the student needs to do.
      const busy = geminiRes.status === 429 || geminiRes.status === 503;
      res.status(502).json({
        error: busy
          ? "Google's AI model is busy right now. Please try that photo again in a moment."
          : 'The AI reader could not process that photo.',
        detail: detail.slice(0, 500)
      });
      return;
    }

    const data = await geminiRes.json();
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map(part => part.text)
      .filter(Boolean)
      .join('');
    const parsed = JSON.parse(text || '{}');
    const topics = Array.isArray(parsed.topics) ? parsed.topics : [];

    res.status(200).json({ topics });
  } catch (err) {
    res.status(500).json({
      error: 'Could not read the syllabus photo.',
      detail: String((err && err.message) || err)
    });
  }
};
