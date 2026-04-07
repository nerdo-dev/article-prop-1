import type {IncomingMessage, ServerResponse} from 'node:http';
import type {Plugin} from 'vite';

import {
  fetchProposal,
  getErrorResponse,
  ProposalApiError,
  parsePublishProposalInput,
  publishProposal,
} from '../api/_lib/proposals.js';

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
        } catch (error) {
          const failure = getErrorResponse(error);
          sendJson(response, failure.status, failure.body);
          return;
        }

        next();
      });
    },
  };
}
