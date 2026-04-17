import {fetchProposal, getErrorResponse} from './_lib/proposals.js';

function makeFilename(title: string) {
  return `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.status(405).send('Method not allowed.');
    return;
  }

  try {
    const proposal = await fetchProposal({
      id: request.query?.id,
      slug: request.query?.slug,
    });

    response.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${makeFilename(proposal.title)}"`);
    response.status(200).send(proposal.markdownContent);
  } catch (error) {
    const failure = getErrorResponse(error);
    response.status(failure.status).send(failure.body.error);
  }
}
