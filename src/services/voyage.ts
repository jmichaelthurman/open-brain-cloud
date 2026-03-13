const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const EXPECTED_DIM = 512;

export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error('VOYAGE_API_KEY is required');

  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'voyage-3-lite', input: [text] }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { data: { embedding: number[] }[] };
  const embedding = data.data[0]?.embedding;

  if (!embedding) throw new Error('Voyage API returned no embedding');
  if (embedding.length !== EXPECTED_DIM) {
    throw new Error(`Expected ${EXPECTED_DIM}-dim embedding, got ${embedding.length}`);
  }

  return embedding;
}
