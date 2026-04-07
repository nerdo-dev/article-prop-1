import { put, list } from '@vercel/blob';

export interface PublishProposalInput {
  title: string;
  markdownContent: string;
  coverImage: string | null;
}

export interface ProposalSnapshot extends PublishProposalInput {
  id: string;
  createdAt: string;
}

const MAX_TITLE_LENGTH = 200;
const MAX_MARKDOWN_LENGTH = 500_000;
const MAX_COVER_IMAGE_LENGTH = 2_000_000;
const PROPOSAL_ID_PATTERN = /^[a-f0-9-]{36}$/i;

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

  if (!token) {
    throw new ProposalApiError(
      500,
      'BLOB_READ_WRITE_TOKEN is not configured. Add it in Vercel and in your local .env.local.'
    );
  }
}

function proposalPath(id: string) {
  return `proposals/${id}.json`;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parsePublishProposalInput(body: unknown): PublishProposalInput {
  if (!isRecord(body)) {
    throw new ProposalApiError(400, 'Invalid publish payload.');
  }

  const rawTitle = body.title;
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
    markdownContent,
    coverImage,
  };
}

function parseStoredSnapshot(data: unknown): ProposalSnapshot {
  if (!isRecord(data)) {
    throw new ProposalApiError(500, 'Stored proposal payload is invalid.');
  }

  const id = data.id;
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

  const normalizedCoverImage: string | null =
    coverImage === null ? null : (coverImage as string);

  return {
    id,
    title,
    markdownContent,
    coverImage: normalizedCoverImage,
    createdAt,
  };
}

export async function publishProposal(input: PublishProposalInput, origin: string) {
  requireBlobToken();

  const id = crypto.randomUUID();
  const snapshot: ProposalSnapshot = {
    id,
    title: input.title,
    markdownContent: input.markdownContent,
    coverImage: input.coverImage,
    createdAt: new Date().toISOString(),
  };

  await put(proposalPath(id), JSON.stringify(snapshot), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json; charset=utf-8',
  });

  const shareUrl = new URL('/', origin);
  shareUrl.searchParams.set('id', id);

  return {
    id,
    shareUrl: shareUrl.toString(),
  };
}

export async function fetchProposal(id: string | null | undefined) {
  requireBlobToken();

  const validId = assertValidProposalId(id);
  const path = proposalPath(validId);
  
  try {
    // Use list to find the blob by prefix, then fetch it
    const { blobs } = await list({ prefix: path });
    
    if (blobs.length === 0) {
      throw new ProposalApiError(404, 'Proposal not found.');
    }
    
    const blob = blobs[0];
    const response = await fetch(blob.url);

    if (!response.ok) {
      throw new ProposalApiError(500, 'Failed to fetch proposal content.');
    }

    const payload = await response.json();
    return parseStoredSnapshot(payload);
  } catch (error) {
    if (error instanceof ProposalApiError) {
      throw error;
    }
    
    // Handle fetch errors (network issues, etc.)
    console.error('Fetch error:', error);
    throw new ProposalApiError(500, 'Failed to fetch proposal.');
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
