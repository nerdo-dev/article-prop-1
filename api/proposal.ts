import {fetchProposal, getErrorResponse} from './_lib/proposals.js';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.status(405).json({error: 'Method not allowed.'});
    return;
  }

  try {
    const proposal = await fetchProposal({
      id: request.query?.id,
      slug: request.query?.slug,
    });
    response.status(200).json(proposal);
  } catch (error) {
    const failure = getErrorResponse(error);
    response.status(failure.status).json(failure.body);
  }
}
