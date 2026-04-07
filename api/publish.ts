import {getErrorResponse, parsePublishProposalInput, publishProposal} from '../server/proposals';

function getOrigin(request: { headers?: Record<string, string | string[] | undefined> }) {
  const forwardedProto = request.headers?.['x-forwarded-proto'];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || 'https';
  const host = request.headers?.host || 'localhost:3000';
  return `${proto}://${host}`;
}

function parseBody(body: unknown) {
  if (typeof body === 'string') {
    return JSON.parse(body);
  }

  return body;
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.status(405).json({error: 'Method not allowed.'});
    return;
  }

  try {
    const input = parsePublishProposalInput(parseBody(request.body));
    const result = await publishProposal(input, getOrigin(request));
    response.status(200).json(result);
  } catch (error) {
    const failure = getErrorResponse(error);
    response.status(failure.status).json(failure.body);
  }
}
