import type { VercelRequest, VercelResponse } from '@vercel/node';
import {getErrorResponse, parsePublishProposalInput, publishProposal} from '../server/proposals';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const input = parsePublishProposalInput(body);
    
    // Construct origin from request headers
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const origin = `${protocol}://${host}`;
    
    const result = await publishProposal(input, origin);
    return res.status(200).json(result);
  } catch (error) {
    const failure = getErrorResponse(error);
    return res.status(failure.status).json(failure.body);
  }
}
