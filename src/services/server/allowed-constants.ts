// Allowed values for /api/instructions security - strict allowlist enforcement
// Only explicitly approved operations are permitted. New operations require security review.
export const ALLOWED_OPERATIONS = [
  'search',
  'context',
  'summarize',
  'import',
  'export'
] as const;

export const ALLOWED_TOPICS = [
  'workflow',
  'search_params',
  'examples',
  'all'
];
