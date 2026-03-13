import type { ExtractedMetadata } from '../types.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const EMPTY: ExtractedMetadata = { people: [], topics: [], action_items: [] };

const SYSTEM_PROMPT =
  'Extract structured metadata from the following thought or note. ' +
  'Return ONLY valid JSON with exactly these keys: ' +
  'people (array of person names mentioned), ' +
  'topics (array of topic tags in snake_case), ' +
  'action_items (array of action item strings). ' +
  'If none found, return empty arrays. No markdown, no explanation.';

export async function extractMetadata(content: string): Promise<ExtractedMetadata> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY not set — skipping metadata extraction');
    return EMPTY;
  }

  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/jmichaelthurman/open-brain-cloud',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
      }),
    });

    if (!res.ok) {
      console.error(`OpenRouter API error ${res.status}: ${await res.text()}`);
      return EMPTY;
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const raw = data.choices[0]?.message?.content ?? '';

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(cleaned) as Partial<ExtractedMetadata>;

    return {
      people: Array.isArray(parsed.people) ? parsed.people : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
    };
  } catch (err) {
    console.error('Failed to extract metadata:', err);
    return EMPTY;
  }
}
