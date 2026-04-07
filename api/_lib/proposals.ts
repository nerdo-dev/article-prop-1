import { BlobNotFoundError, head, put } from '@vercel/blob';

export interface PublishProposalInput {
  title: string;
  slug: string;
  markdownContent: string;
  coverImage: string | null;
}

export interface ProposalSnapshot {
  id: string;
  slug: string | null;
  title: string;
  markdownContent: string;
  coverImage: string | null;
  createdAt: string;
}

const MAX_TITLE_LENGTH = 200;
const MAX_SLUG_LENGTH = 80;
const MAX_MARKDOWN_LENGTH = 500_000;
const MAX_COVER_IMAGE_LENGTH = 2_000_000;
const PROPOSAL_ID_PATTERN = /^[a-f0-9-]{36}$/i;
const PROPOSAL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class ProposalApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ProposalApiError';
    this.status = status;
  }
}

function requireBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token || token.startsWith('REPLACE_WITH_')) {
    throw new ProposalApiError(
      500,
      'BLOB_READ_WRITE_TOKEN is not configured. Add it in Vercel and in your local .env.local.'
    );
  }
}

function proposalPath(id: string) {
  return `proposals/${id}.json`;
}

function proposalSlugPath(slug: string) {
  return `proposals/slugs/${slug}.json`;
}

function assertValidProposalId(id: string | null | undefined) {
  if (!id) {
    throw new ProposalApiError(400, 'Missing proposal id.');
  }

  if (!PROPOSAL_ID_PATTERN.test(id)) {
    throw new ProposalApiError(400, 'Invalid proposal id.');
  }

  return id;
}

function normalizeProposalSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function assertValidProposalSlug(slug: string | null | undefined) {
  if (!slug) {
    throw new ProposalApiError(400, 'Missing proposal slug.');
  }

  const normalizedSlug = normalizeProposalSlug(slug);

  if (!normalizedSlug) {
    throw new ProposalApiError(400, 'Proposal slug is required.');
  }

  if (normalizedSlug.length > MAX_SLUG_LENGTH || !PROPOSAL_SLUG_PATTERN.test(normalizedSlug)) {
    throw new ProposalApiError(
      400,
      'Proposal slug must use lowercase letters, numbers, and hyphens only.'
    );
  }

  return normalizedSlug;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parsePublishProposalInput(body: unknown): PublishProposalInput {
  if (!isRecord(body)) {
    throw new ProposalApiError(400, 'Invalid publish payload.');
  }

  const rawTitle = body.title;
  const rawSlug = body.slug;
  const rawMarkdown = body.markdownContent;
  const rawCoverImage = body.coverImage;

  if (typeof rawTitle !== 'string') {
    throw new ProposalApiError(400, 'Title must be a string.');
  }

  if (typeof rawMarkdown !== 'string') {
    throw new ProposalApiError(400, 'Markdown content must be a string.');
  }

  if (rawCoverImage !== null && typeof rawCoverImage !== 'string') {
    throw new ProposalApiError(400, 'Cover image must be a string or null.');
  }

  const title = rawTitle.trim();
  const slugSource = typeof rawSlug === 'string' ? rawSlug : title;
  const slug = assertValidProposalSlug(slugSource);
  const markdownContent = rawMarkdown.trim();
  const coverImage = typeof rawCoverImage === 'string' ? rawCoverImage : null;

  if (!title || title.length > MAX_TITLE_LENGTH) {
    throw new ProposalApiError(400, 'Title is required and must be under 200 characters.');
  }

  if (!markdownContent || markdownContent.length > MAX_MARKDOWN_LENGTH) {
    throw new ProposalApiError(400, 'Markdown content is required and is too large.');
  }

  if (coverImage && coverImage.length > MAX_COVER_IMAGE_LENGTH) {
    throw new ProposalApiError(400, 'Cover image is too large.');
  }

  return {
    title,
    slug,
    markdownContent,
    coverImage,
  };
}

function parseStoredSnapshot(data: unknown): ProposalSnapshot {
  if (!isRecord(data)) {
    throw new ProposalApiError(500, 'Stored proposal payload is invalid.');
  }

  const id = data.id;
  const rawSlug = data.slug;
  const title = data.title;
  const markdownContent = data.markdownContent;
  const coverImage = data.coverImage;
  const createdAt = data.createdAt;

  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof markdownContent !== 'string' ||
    (coverImage !== null && typeof coverImage !== 'string') ||
    typeof createdAt !== 'string'
  ) {
    throw new ProposalApiError(500, 'Stored proposal payload is malformed.');
  }

  const slug = typeof rawSlug === 'string' ? assertValidProposalSlug(rawSlug) : null;

  return {
    id,
    slug,
    title,
    markdownContent,
    coverImage: coverImage === null ? null : (coverImage as string),
    createdAt,
  };
}

export async function publishProposal(input: PublishProposalInput, origin: string) {
  requireBlobToken();

  const id = crypto.randomUUID();
  const slug = assertValidProposalSlug(input.slug);
  const snapshot: ProposalSnapshot = {
    id,
    slug,
    title: input.title,
    markdownContent: input.markdownContent,
    coverImage: input.coverImage,
    createdAt: new Date().toISOString(),
  };

  const blob = await put(proposalSlugPath(slug), JSON.stringify(snapshot), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json; charset=utf-8',
  });

  const shareUrl = new URL(`/${slug}`, origin);

  return {
    id,
    slug,
    blobUrl: blob.url,
    shareUrl: shareUrl.toString(),
  };
}

async function fetchProposalByBlobPath(path: string) {
  const blob = await head(path);
  const response = await fetch(blob.url);

  if (!response.ok) {
    throw new ProposalApiError(404, 'Proposal not found.');
  }

  const payload = await response.json();
  return parseStoredSnapshot(payload);
}

async function fetchProposalById(id: string | null | undefined) {
  const validId = assertValidProposalId(id);
  return fetchProposalByBlobPath(proposalPath(validId));
}

async function fetchProposalBySlug(slug: string | null | undefined) {
  const validSlug = assertValidProposalSlug(slug);
  return fetchProposalByBlobPath(proposalSlugPath(validSlug));
}

export async function fetchProposal(input: {
  id?: string | null | undefined;
  slug?: string | null | undefined;
}) {
  requireBlobToken();

  try {
    if (input.slug) {
      return await fetchProposalBySlug(input.slug);
    }

    return await fetchProposalById(input.id);
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      throw new ProposalApiError(404, 'Proposal not found.');
    }

    throw error;
  }
}

export function getErrorResponse(error: unknown) {
  if (error instanceof ProposalApiError) {
    return {
      status: error.status,
      body: {error: error.message},
    };
  }

  console.error(error);
  return {
    status: 500,
    body: {error: 'Unexpected server error.'},
  };
}
