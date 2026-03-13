export interface Thought {
  id: string;
  content: string;
  people: string[];
  topics: string[];
  action_items: string[];
  source: string | null;
  created_at: string;
}

export interface ThoughtLink {
  id: string;
  from_id: string;
  to_id: string;
  relation: LinkRelation;
  note: string | null;
  is_manual: boolean;
  created_at: string;
}

export type LinkRelation =
  | 'related'
  | 'supports'
  | 'contradicts'
  | 'follows_from'
  | 'part_of'
  | 'example_of'
  | 'references';

export interface SearchResult extends Thought {
  similarity: number;
}

export interface SuggestedLink {
  thought_id: string;
  content: string;
  similarity: number;
}

export interface CaptureResult {
  id: string;
  suggested_links: SuggestedLink[];
}

export interface ExtractedMetadata {
  people: string[];
  topics: string[];
  action_items: string[];
}
