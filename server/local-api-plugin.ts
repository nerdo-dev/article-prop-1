import type {IncomingMessage, ServerResponse} from 'node:http';
import type {Plugin} from 'vite';

import {
  fetchProposal,
  getErrorResponse,
  ProposalApiError,
  parsePublishProposalInput,
  publishProposal,
} from '../api/_lib/proposals.js';
import {renderProposalPage} from '../api/_lib/proposal-page.js';

function getRequestOrigin(request: IncomingMessage) {
  const protoHeader = request.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || 'http';
  const host = request.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new ProposalApiError(400, 'Invalid JSON body.');
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function sendHtml(response: ServerResponse, status: number, body: string) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(body);
}

function sendMarkdown(response: ServerResponse, status: number, filename: string, body: string) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  response.end(body);
}

function makeFilename(title: string) {
  return `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
}

function isPublicSlugPath(pathname: string) {
  return pathname !== '/' && !pathname.startsWith('/api/') && !pathname.includes('.');
}

export function localProposalApiPlugin(): Plugin {
  return {
    name: 'local-proposal-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url) {
          next();
          return;
        }

        const url = new URL(request.url, getRequestOrigin(request));

        try {
          if (request.method === 'POST' && url.pathname === '/api/publish') {
            const body = await readJsonBody(request);
            const input = parsePublishProposalInput(body);
            const result = await publishProposal(input, getRequestOrigin(request));
            sendJson(response, 200, result);
            return;
          }

          if (request.method === 'GET' && url.pathname === '/api/proposal') {
            const result = await fetchProposal({
              id: url.searchParams.get('id'),
              slug: url.searchParams.get('slug'),
            });
            sendJson(response, 200, result);
            return;
          }

          if (request.method === 'GET' && url.pathname === '/api/proposal-page') {
            const result = await fetchProposal({
              id: url.searchParams.get('id'),
              slug: url.searchParams.get('slug'),
            });
            sendHtml(response, 200, renderProposalPage(result, getRequestOrigin(request)));
            return;
          }

          if (request.method === 'GET' && url.pathname === '/api/proposal-md') {
            const result = await fetchProposal({
              id: url.searchParams.get('id'),
              slug: url.searchParams.get('slug'),
            });
            sendMarkdown(response, 200, makeFilename(result.title), result.markdownContent);
            return;
          }

          if (request.method === 'GET' && isPublicSlugPath(url.pathname)) {
            const result = await fetchProposal({
              slug: url.pathname.replace(/^\/+/, ''),
            });
            sendHtml(response, 200, renderProposalPage(result, getRequestOrigin(request)));
            return;
          }
        } catch (error) {
          const failure = getErrorResponse(error);
          if (url.pathname === '/api/proposal-page' || isPublicSlugPath(url.pathname)) {
            sendHtml(response, failure.status, failure.body.error);
          } else {
            response.statusCode = failure.status;
            sendJson(response, failure.status, failure.body);
          }
          return;
        }

        next();
      });
    },
  };
}
