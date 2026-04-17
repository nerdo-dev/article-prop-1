import type {ProposalSnapshot} from './proposals.js';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatCreatedAt(createdAt: string) {
  try {
    const date = new Date(createdAt);
    return {
      time: date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
      date: date.toLocaleDateString('en-US', {day: 'numeric', month: 'short', year: 'numeric'}),
    };
  } catch {
    return {
      time: '',
      date: '',
    };
  }
}

function buildPageDescription(proposal: ProposalSnapshot) {
  const plainText = stripHtml(proposal.htmlContent);
  return plainText.slice(0, 180) || proposal.articleTitle;
}

export function renderProposalPage(proposal: ProposalSnapshot, origin: string) {
  const canonicalUrl = `${origin.replace(/\/+$/g, '')}/${proposal.slug ?? proposal.id}`;
  const description = buildPageDescription(proposal);
  const escapedTitle = escapeHtml(proposal.articleTitle);
  const escapedDescription = escapeHtml(description);
  const escapedCanonicalUrl = escapeHtml(canonicalUrl);
  const {time, date} = formatCreatedAt(proposal.createdAt);
  const markdownDownloadUrl = `/api/proposal-md?slug=${encodeURIComponent(proposal.slug ?? '')}`;
  const coverSection = proposal.coverImage
    ? `<div class="cover"><img src="${proposal.coverImage}" alt="${escapedTitle}" /></div>`
    : '<div class="cover cover--empty"><span>No cover image uploaded</span></div>';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(proposal.title)}</title>
    <meta name="description" content="${escapedDescription}" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapedCanonicalUrl}" />
    ${proposal.coverImage ? `<meta property="og:image" content="${proposal.coverImage}" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />
    ${proposal.coverImage ? `<meta name="twitter:image" content="${proposal.coverImage}" />` : ''}
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #000;
        --text: #e7e9ea;
        --muted: #71767b;
        --border: #2f3336;
        --blue: #1d9bf0;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: "TwitterChirp", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      a { color: inherit; }
      .page {
        max-width: 600px;
        min-height: 100vh;
        margin: 0 auto;
        border-left: 1px solid var(--border);
        border-right: 1px solid var(--border);
      }
      .header {
        padding: 16px 16px 0;
      }
      .identity {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
      }
      .identity:hover .name { text-decoration: underline; }
      .avatar {
        width: 48px;
        height: 48px;
        border-radius: 999px;
        overflow: hidden;
        border: 1px solid var(--border);
        background: #060d1a;
      }
      .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .identity-meta { min-width: 0; }
      .name-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 20px;
        font-weight: 700;
      }
      .handle { color: var(--muted); font-size: 14px; }
      .verified {
        width: 20px;
        height: 20px;
        color: var(--blue);
        flex: 0 0 auto;
      }
      .cover {
        margin-top: 16px;
        width: 100%;
        aspect-ratio: 21 / 9;
        background: #111827;
        overflow: hidden;
      }
      .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .cover--empty {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6b7280;
        background: linear-gradient(135deg, #111827, #000);
      }
      .body { padding: 20px 16px 24px; }
      h1 {
        margin: 0 0 16px;
        font-size: clamp(2.45rem, 7vw, 3.15rem);
        line-height: 0.98;
        letter-spacing: -0.03em;
      }
      .metrics {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding-bottom: 16px;
        color: var(--muted);
      }
      .metrics-left, .metrics-right {
        display: flex;
        align-items: center;
        gap: 18px;
        flex-wrap: wrap;
      }
      .metric, .download-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        text-decoration: none;
      }
      .download-link { color: var(--blue); font-weight: 600; }
      .divider {
        border-top: 1px solid var(--border);
        padding-top: 24px;
      }
      .content {
        font-size: 19px;
        line-height: 1.75;
      }
      .content p { margin: 0 0 24px; }
      .content h2, .content h3 { line-height: 1.1; margin: 32px 0 16px; }
      .content ul, .content ol { padding-left: 24px; margin: 0 0 24px; }
      .content li { margin: 8px 0; }
      .content a {
        color: #8ecdfc;
        text-decoration: underline;
        text-decoration-color: rgba(29,155,240,0.55);
        text-underline-offset: 0.18em;
        background: rgba(29,155,240,0.12);
        padding: 2px 4px;
        border-radius: 6px;
      }
      .content blockquote {
        margin: 0 0 24px;
        padding-left: 16px;
        border-left: 4px solid #374151;
        color: #9ca3af;
        font-style: italic;
      }
      .content code {
        background: #111827;
        padding: 2px 6px;
        border-radius: 6px;
        font-size: 0.9em;
      }
      .content pre {
        background: #111827;
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
        overflow: auto;
      }
      .content pre code {
        background: none;
        padding: 0;
      }
      .timestamp {
        display: flex;
        gap: 6px;
        margin-top: 48px;
        color: var(--muted);
        font-size: 14px;
        flex-wrap: wrap;
      }
      .timestamp strong { color: var(--text); }
      .reply-band {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 0;
        border-top: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
        margin: 16px 0;
        color: var(--muted);
        font-size: 14px;
      }
      .thread {
        padding-top: 16px;
      }
      .thread-item {
        display: flex;
        gap: 12px;
        padding: 16px 0;
      }
      .thread-item + .thread-item { border-top: 1px solid var(--border); }
      .thread-avatar {
        width: 40px;
        height: 40px;
        border-radius: 999px;
        overflow: hidden;
        flex: 0 0 auto;
        border: 1px solid var(--border);
      }
      .thread-avatar img, .thread-avatar svg {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
      }
      .thread-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
      }
      .thread-name { font-weight: 700; }
      .thread-handle { color: var(--muted); }
      .thread-copy { margin-top: 4px; color: var(--text); line-height: 1.6; }
      .icon {
        width: 18px;
        height: 18px;
        display: inline-block;
        vertical-align: middle;
      }
      @media (max-width: 640px) {
        .metrics { flex-direction: column; align-items: flex-start; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <a class="identity" href="https://x.com/nerdconf_ar" target="_blank" rel="noreferrer">
          <div class="avatar">
            <img src="https://pbs.twimg.com/profile_images/1969167638963142656/LavpBww0_400x400.jpg" alt="@NERDCONF profile" />
          </div>
          <div class="identity-meta">
            <div class="name-row">
              <span class="name">NERDCONF</span>
              <svg class="verified" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22.25 12c0-.81-.67-1.47-1.49-1.47h-.63a1.49 1.49 0 0 1-1.41-.98l-.23-.62a1.48 1.48 0 0 1 .3-1.53l.45-.45c.58-.58.58-1.52 0-2.08l-1.7-1.7a1.47 1.47 0 0 0-2.09 0l-.44.44a1.5 1.5 0 0 1-1.54.3l-.62-.22a1.5 1.5 0 0 1-.97-1.42v-.63A1.49 1.49 0 0 0 10.4.25H7.98A1.48 1.48 0 0 0 6.5 1.72v.63c0 .63-.4 1.2-.98 1.42l-.62.22a1.5 1.5 0 0 1-1.54-.3l-.44-.44a1.47 1.47 0 0 0-2.09 0l-1.7 1.7a1.47 1.47 0 0 0 0 2.08l.45.45c.43.43.55 1.07.3 1.53l-.23.62a1.49 1.49 0 0 1-1.41.98h-.63A1.49 1.49 0 0 0 .25 12.0v2.42c0 .81.67 1.47 1.49 1.47h.63c.63 0 1.2.4 1.41.98l.23.62c.2.52.08 1.1-.3 1.53l-.45.45a1.47 1.47 0 0 0 0 2.08l1.7 1.7c.58.58 1.52.58 2.09 0l.44-.44a1.5 1.5 0 0 1 1.54-.3l.62.22c.58.21.98.78.98 1.42v.63c0 .81.66 1.47 1.48 1.47h2.42c.82 0 1.49-.66 1.49-1.47v-.63c0-.64.39-1.21.97-1.42l.62-.22c.52-.2 1.1-.08 1.54.3l.44.44c.57.58 1.51.58 2.09 0l1.7-1.7c.58-.58.58-1.52 0-2.08l-.45-.45a1.48 1.48 0 0 1-.3-1.53l.23-.62a1.49 1.49 0 0 1 1.41-.98h.63c.82 0 1.49-.66 1.49-1.47V12Z"/><path fill="#fff" d="m10.76 16.24-3.3-3.3 1.06-1.06 2.24 2.24 4.72-4.72 1.06 1.06-5.78 5.78Z"/></svg>
            </div>
            <div class="handle">@nerdconf_ar</div>
          </div>
        </a>
      </div>
      ${coverSection}
      <div class="body">
        <h1>${escapedTitle}</h1>
        <div class="metrics">
          <div class="metrics-left">
            <span class="metric">Discuss</span>
            <span class="metric">v1.0</span>
            <span class="metric">Approve</span>
            <span class="metric">Confidential</span>
          </div>
          <div class="metrics-right">
            <span class="metric">Saved</span>
            <a class="download-link" href="${markdownDownloadUrl}">.md</a>
          </div>
        </div>
        <div class="divider">
          <div class="content">${proposal.htmlContent}</div>
        </div>
        <div class="timestamp">
          ${time ? `<span>${escapeHtml(time)}</span><span>·</span>` : ''}
          ${date ? `<span>${escapeHtml(date)}</span><span>·</span>` : ''}
          <strong>1</strong>
          <span>Exclusive View</span>
        </div>
        <div class="reply-band">
          <span>Discuss</span>
          <span>Revise</span>
          <span>Approve</span>
          <span>Saved</span>
        </div>
        <div class="thread">
          <div class="thread-item">
            <div class="thread-avatar">
              <img src="https://pbs.twimg.com/profile_images/1969167638963142656/LavpBww0_400x400.jpg" alt="NERDCONF" />
            </div>
            <div>
              <div class="thread-meta">
                <span class="thread-name">NERDCONF</span>
                <span class="thread-handle">@nerdconf_ar · 1m</span>
              </div>
              <div class="thread-copy">Next steps: If you're happy with this proposal, just reply to the email with your thoughts. We'll then prepare the MSA and SOW to get started.</div>
            </div>
          </div>
          <div class="thread-item">
            <div class="thread-avatar">
              <img src="https://pbs.twimg.com/profile_images/1780044485541699584/p78MCn3B_400x400.jpg" alt="Elon Musk" />
            </div>
            <div>
              <div class="thread-meta">
                <span class="thread-name">Elon Musk</span>
                <span class="thread-handle">@elonmusk · Apr 1</span>
              </div>
              <div class="thread-copy">Working with <span style="color: var(--blue)">@nerdconf_ar</span> was the best decision we made this year. They completely transformed our architecture and delivered 10x ROI.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}
