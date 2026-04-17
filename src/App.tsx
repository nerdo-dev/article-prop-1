import React, { Suspense, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  MessageCircle, Repeat2, Heart, BarChart2, Bookmark, BadgeCheck, Upload, Loader2, Check,
  Link as LinkIcon, ImagePlus, X, Download
} from 'lucide-react';
import { NerdConfLogo } from './components/NerdConfLogo';
import type { ProposalEditorHandle } from './components/ProposalEditor';

const ProposalEditor = React.lazy(() => import('./components/ProposalEditor'));

type ProposalResponse = {
  id?: string;
  slug?: string | null;
  title: string;
  markdownContent: string;
  coverImage: string | null;
  createdAt: string;
};

const DEFAULT_PROPOSAL_TITLE = 'Proposal Draft';
const DEFAULT_PROPOSAL_SLUG = 'proposal-draft';
const NERDCONF_PROFILE_URL = 'https://x.com/nerdconf_ar';
const NERDCONF_PROFILE_IMAGE =
  'https://pbs.twimg.com/profile_images/1969167638963142656/LavpBww0_400x400.jpg';

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function getRouteSlug(pathname: string) {
  const normalizedPath = pathname.replace(/^\/+|\/+$/g, '');

  if (!normalizedPath) {
    return null;
  }

  if (normalizedPath.includes('/')) {
    return null;
  }

  return decodeURIComponent(normalizedPath);
}

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}

function LikeButton({
  liked,
  burstVisible,
  onClick,
  label,
  size = 'sm',
}: {
  liked: boolean;
  burstVisible: boolean;
  onClick: () => void;
  label?: string;
  size?: 'sm' | 'xs';
}) {
  const iconSizeClass = size === 'xs' ? 'w-4 h-4' : 'w-5 h-5';
  const textSizeClass = size === 'xs' ? 'text-xs' : 'text-sm';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center space-x-1.5 transition-colors ${
        liked ? 'text-[#f91880]' : 'text-[#71767b] hover:text-[#f91880]'
      }`}
      aria-pressed={liked}
      title={liked ? 'Unlike' : 'Like'}
    >
      {burstVisible && (
        <span className="absolute left-0 top-1/2 h-8 w-8 -translate-x-1/4 -translate-y-1/2 rounded-full bg-[#f91880]/20 animate-ping pointer-events-none" />
      )}
      <Heart
        className={`${iconSizeClass} transition-all duration-200 ${liked ? 'fill-current scale-110' : ''}`}
      />
      {label ? <span className={textSizeClass}>{label}</span> : null}
    </button>
  );
}

export default function App() {
  const [proposalTitle, setProposalTitle] = useState(DEFAULT_PROPOSAL_TITLE);
  const [proposalSlug, setProposalSlug] = useState(DEFAULT_PROPOSAL_SLUG);
  const [hasCustomSlug, setHasCustomSlug] = useState(false);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<ProposalEditorHandle | null>(null);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showLikeBurst, setShowLikeBurst] = useState(false);
  const likeBurstTimeoutRef = useRef<number | null>(null);
  const dragDepthRef = useRef(0);

  const urlParams = new URLSearchParams(window.location.search);
  const blobUrl = urlParams.get('blob');
  const proposalId = urlParams.get('id');
  const routeSlug = getRouteSlug(window.location.pathname);
  const isPublicView = !!(blobUrl || proposalId || routeSlug);

  const loadBlobProposal = async (blobUrlParam: string) => {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(blobUrlParam);
    } catch {
      throw new Error('Invalid proposal link.');
    }

    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Invalid proposal link.');
    }

    const response = await fetch(parsedUrl.toString());
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error('Failed to load proposal.');
    }

    return payload as ProposalResponse;
  };

  const loadLegacyProposal = async (proposalIdParam: string) => {
    const response = await fetch(`/api/proposal?id=${encodeURIComponent(proposalIdParam)}`);
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to load proposal.');
    }

    return payload as ProposalResponse;
  };

  const loadSlugProposal = async (proposalSlugParam: string) => {
    const response = await fetch(`/api/proposal?slug=${encodeURIComponent(proposalSlugParam)}`);
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to load proposal.');
    }

    return payload as ProposalResponse;
  };

  useEffect(() => {
    if (!isPublicView) {
      setIsEditing(true);
      if (!markdownContent) {
        setMarkdownContent('Start writing your proposal here...');
      }
    }
  }, [isPublicView]);

  useEffect(() => {
    if (!isPublicView && !hasCustomSlug) {
      setProposalSlug(slugify(proposalTitle) || DEFAULT_PROPOSAL_SLUG);
    }
  }, [hasCustomSlug, isPublicView, proposalTitle]);

  useEffect(() => {
    document.title = proposalTitle.trim() || DEFAULT_PROPOSAL_TITLE;
  }, [proposalTitle]);

  useEffect(() => {
    return () => {
      if (likeBurstTimeoutRef.current !== null) {
        window.clearTimeout(likeBurstTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadProposal = async () => {
      if (!blobUrl && !proposalId && !routeSlug) {
        setIsLoading(false);
        return;
      }

      try {
        const data = blobUrl
          ? await loadBlobProposal(blobUrl)
          : proposalId
            ? await loadLegacyProposal(proposalId)
            : await loadSlugProposal(routeSlug as string);

        if (!isCancelled) {
          setProposalTitle(data.title || DEFAULT_PROPOSAL_TITLE);
          setProposalSlug(data.slug || routeSlug || DEFAULT_PROPOSAL_SLUG);
          setHasCustomSlug(true);
          setMarkdownContent(data.markdownContent);
          setCoverImage(data.coverImage || null);
        }
      } catch (err) {
        console.error(err);
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load proposal.');
        }
      }

      if (!isCancelled) {
        setIsLoading(false);
      }
    };

    loadProposal();

    return () => {
      isCancelled = true;
    };
  }, [blobUrl, proposalId, routeSlug]);

  const compressImage = (dataUrl: string, maxWidth = 1200): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = dataUrl;
    });
  };

  const isMarkdownFile = (file: File) =>
    file.type === 'text/markdown' ||
    file.type === 'text/x-markdown' ||
    /\.(md|markdown)$/i.test(file.name);

  const isImageFile = (file: File) => file.type.startsWith('image/');

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve((event.target?.result as string) || '');
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
      reader.readAsText(file);
    });

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve((event.target?.result as string) || '');
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
      reader.readAsDataURL(file);
    });

  const applyMarkdownFile = async (file: File) => {
    const newContent = await readFileAsText(file);
    setMarkdownContent(newContent);
    editorRef.current?.setMarkdown(newContent);
    setIsEditing(true);
  };

  const applyImageFile = async (file: File) => {
    const imageDataUrl = await readFileAsDataUrl(file);
    setCoverImage(imageDataUrl);
  };

  const handleIncomingFiles = async (files: File[]) => {
    if (!files.length) return;

    const markdownFile = files.find(isMarkdownFile);
    const imageFile = files.find(isImageFile);

    if (!markdownFile && !imageFile) {
      return;
    }

    try {
      if (markdownFile) {
        await applyMarkdownFile(markdownFile);
      }

      if (imageFile) {
        await applyImageFile(imageFile);
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to load dropped file.');
    }
  };

  const handleShare = async () => {
    if (!markdownContent) return;
    
    try {
      setIsSharing(true);

      let compressedImage = coverImage;
      if (coverImage && coverImage.length > 800000) {
        compressedImage = await compressImage(coverImage);
      }

      const title = proposalTitle.trim() || DEFAULT_PROPOSAL_TITLE;
      const slug = slugify(proposalSlug) || slugify(title) || DEFAULT_PROPOSAL_SLUG;

      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          slug,
          markdownContent,
          coverImage: compressedImage ?? null,
        }),
      });

      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to share proposal.');
      }

      const link = payload?.shareUrl;
      if (typeof link !== 'string') {
        throw new Error('Publish API returned an invalid share URL.');
      }
      
      setProposalSlug(payload?.slug || slug);
      setShareLink(link);
      await navigator.clipboard.writeText(link);
      setShowPublishModal(true);
      
    } catch (err) {
      console.error("Error sharing:", err);
      alert(err instanceof Error ? err.message : 'Failed to share proposal. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleIncomingFiles([file]);
    }
    event.target.value = '';
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleIncomingFiles([file]);
    }
    event.target.value = '';
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (isPublicView || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (isPublicView || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (isPublicView || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (isPublicView) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    void handleIncomingFiles(Array.from(event.dataTransfer.files));
  };

  const handleDownloadMd = () => {
    if (!markdownContent) return;
    const title = proposalTitle.trim() || 'Proposal';
    const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLikeToggle = () => {
    const nextLikedState = !isLiked;
    setIsLiked(nextLikedState);

    if (!nextLikedState) {
      setShowLikeBurst(false);
      if (likeBurstTimeoutRef.current !== null) {
        window.clearTimeout(likeBurstTimeoutRef.current);
        likeBurstTimeoutRef.current = null;
      }
      return;
    }

    setShowLikeBurst(true);

    if (likeBurstTimeoutRef.current !== null) {
      window.clearTimeout(likeBurstTimeoutRef.current);
    }

    likeBurstTimeoutRef.current = window.setTimeout(() => {
      setShowLikeBurst(false);
      likeBurstTimeoutRef.current = null;
    }, 600);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-2 text-red-500">Error</h1>
          <p className="text-gray-400">{error}</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="mt-6 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold py-2 px-6 rounded-full transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const markdownHeadingMatch = markdownContent.match(/^#\s+(.+)$/m);
  const articleTitle = markdownHeadingMatch?.[1].trim() || proposalTitle.trim() || DEFAULT_PROPOSAL_TITLE;
  const contentWithoutTitle = markdownHeadingMatch
    ? markdownContent.replace(/^#\s+(.+)$/m, '').trim()
    : markdownContent.trim();

  return (
    <div
      className="relative min-h-screen bg-black text-[#e7e9ea] font-sans selection:bg-[#1d9bf0] selection:text-white pb-20"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {!isPublicView && isDragActive ? (
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-6">
          <div className="rounded-2xl border border-[#1d9bf0] bg-[#0b0f14] px-6 py-5 text-center shadow-[0_0_0_1px_rgba(29,155,240,0.15)]">
            <div className="text-lg font-bold text-[#e7e9ea]">Drop your files</div>
            <div className="mt-1 text-sm text-[#8b98a5]">.md updates the article. Image updates the cover.</div>
          </div>
        </div>
      ) : null}
      
          {/* Editor Top Bar (Only for Creator) */}
      {!isPublicView && (
        <div className="sticky top-0 z-50 bg-black/90 backdrop-blur border-b border-gray-800">
          <div className="max-w-[1000px] mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="bg-[#1d9bf0]/20 text-[#1d9bf0] text-xs font-bold px-2 py-1 rounded">Draft</span>
              <span className="text-gray-500 text-sm hidden sm:inline-block">Saved just now</span>
            </div>
            <div className="flex items-center space-x-4">
              <label className="text-[#1d9bf0] font-bold hover:underline text-sm cursor-pointer flex items-center space-x-1">
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline-block">Upload .md</span>
                <input type="file" accept=".md" className="hidden" onChange={handleFileUpload} />
              </label>
              <input
                type="text"
                value={proposalTitle}
                onChange={(event) => setProposalTitle(event.target.value)}
                placeholder="Proposal title"
                className="w-44 sm:w-56 bg-[#16181c] border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-[#e7e9ea] outline-none focus:border-[#1d9bf0]"
              />
              <div className="flex items-center w-40 sm:w-48 bg-[#16181c] border border-gray-800 rounded-lg px-3 py-1.5 text-sm focus-within:border-[#1d9bf0]">
                <span className="text-gray-500 mr-1">/</span>
                <input
                  type="text"
                  value={proposalSlug}
                  onChange={(event) => {
                    setHasCustomSlug(true);
                    setProposalSlug(slugify(event.target.value));
                  }}
                  placeholder="public-url"
                  className="w-full bg-transparent text-[#e7e9ea] outline-none"
                />
              </div>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="text-[#1d9bf0] font-bold hover:underline text-sm"
              >
                {isEditing ? 'Preview' : 'Edit'}
              </button>
              <button
                onClick={handleDownloadMd}
                disabled={!markdownContent.trim()}
                className="text-[#1d9bf0] font-bold hover:underline text-sm disabled:opacity-50 disabled:no-underline flex items-center space-x-1"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline-block">.md</span>
              </button>
              <button 
                onClick={handleShare}
                disabled={isSharing || !markdownContent.trim()}
                className="bg-[#1d9bf0] hover:bg-[#1a8cd8] disabled:opacity-50 text-white font-bold py-1.5 px-4 rounded-full transition-colors flex items-center space-x-2 text-sm"
              >
                {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Publish</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditing ? (
        <main className="max-w-[600px] mx-auto w-full border-x border-gray-800 min-h-screen flex flex-col pb-20">
          {/* Cover Image Editor */}
          <div className="relative w-full aspect-[21/9] bg-gray-900 group">
            {coverImage ? (
              <>
                <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
                  <label className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 cursor-pointer text-white" title="Change Image">
                    <ImagePlus className="w-5 h-5" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                  <button onClick={() => setCoverImage(null)} className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 text-white" title="Remove Image">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors text-gray-500">
                <ImagePlus className="w-8 h-8 mb-2" />
                <span>Add cover image</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            )}
          </div>
          
          {/* MDXEditor */}
          <div className="flex-1 w-full bg-black">
            <Suspense
              fallback={
                <div className="flex min-h-[500px] items-center justify-center border-t border-gray-800">
                  <Loader2 className="h-7 w-7 animate-spin text-[#1d9bf0]" />
                </div>
              }
            >
              <ProposalEditor
                editorRef={editorRef}
                markdown={markdownContent}
                onChange={setMarkdownContent}
              />
            </Suspense>
          </div>
        </main>
      ) : (
        <main className="max-w-[600px] mx-auto w-full border-x border-gray-800 min-h-screen">
          <div className="px-4 pt-4">
            <a
              href={NERDCONF_PROFILE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-3 group"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-800 bg-[#060d1a] flex-shrink-0">
                <img
                  src={NERDCONF_PROFILE_IMAGE}
                  alt="@NERDCONF profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1">
                  <span className="font-bold text-[#e7e9ea] group-hover:underline text-lg">NERDCONF</span>
                  <BadgeCheck className="w-5 h-5 text-[#1d9bf0]" fill="currentColor" />
                </div>
                <div className="text-[#71767b] text-sm">@nerdconf_ar</div>
              </div>
            </a>
          </div>

          {coverImage ? (
            <div className="mt-4 w-full aspect-[21/9] bg-gray-900 overflow-hidden">
              <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="mt-4 w-full aspect-[21/9] bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
              <span className="text-gray-600 font-mono text-sm">No cover image uploaded</span>
            </div>
          )}

          <div className="px-4 pt-5 pb-6">
            <h1 className="text-[2.45rem] sm:text-[3.15rem] font-bold text-[#e7e9ea] mb-4 leading-[0.98] tracking-tight">
              {articleTitle}
            </h1>

            <div className="flex items-center justify-between pb-4 text-[#71767b]">
              <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                <div className="flex items-center space-x-1.5">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm">Discuss</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Repeat2 className="w-5 h-5" />
                  <span className="text-sm">v1.0</span>
                </div>
                <LikeButton
                  liked={isLiked}
                  burstVisible={showLikeBurst}
                  onClick={handleLikeToggle}
                  label="Approve"
                />
                <div className="hidden sm:flex items-center space-x-1.5">
                  <BarChart2 className="w-5 h-5" />
                  <span className="text-sm">Confidential</span>
                </div>
              </div>
              <div className="flex items-center space-x-3 ml-4">
                <div className="text-[#1d9bf0]">
                  <Bookmark className="w-5 h-5" fill="currentColor" />
                </div>
                <button
                  onClick={handleDownloadMd}
                  className="flex items-center space-x-1.5 text-[#1d9bf0] hover:text-[#63b3ff] transition-colors"
                  title=".md"
                >
                  <Download className="w-5 h-5" />
                  <span className="text-sm font-medium">.md</span>
                </button>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-6">

            {/* Markdown Content */}
            <div className="prose prose-invert prose-lg max-w-none 
              prose-p:text-[#e7e9ea] prose-p:leading-relaxed prose-p:mb-6
              prose-headings:text-[#e7e9ea] prose-headings:font-bold prose-headings:tracking-tight
              prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
              prose-a:text-[#8ecdfc] prose-a:underline prose-a:decoration-[#1d9bf0]/55 prose-a:underline-offset-[0.18em] prose-a:bg-[#1d9bf0]/12 prose-a:px-1 prose-a:py-0.5 prose-a:rounded-md hover:prose-a:bg-[#1d9bf0]/20 hover:prose-a:text-[#c7e8ff] hover:prose-a:decoration-[#63b3ff]/85
              prose-strong:text-[#e7e9ea]
              prose-ul:text-[#e7e9ea] prose-ol:text-[#e7e9ea]
              prose-li:marker:text-gray-500
              prose-blockquote:border-l-4 prose-blockquote:border-gray-700 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-400
              prose-code:text-[#e7e9ea] prose-code:bg-gray-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800
              prose-img:rounded-2xl prose-img:border prose-img:border-gray-800">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {contentWithoutTitle}
              </ReactMarkdown>
            </div>
            </div>

            {/* --- BOTTOM ENGAGEMENT SECTION --- */}
            <div className="mt-12 pt-4">
              {/* Timestamp & Views */}
              <div className="text-[#71767b] text-sm mb-4 flex items-center space-x-1">
                <span>{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                <span>·</span>
                <span>{new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span>·</span>
                <span className="text-white font-bold ml-1">1</span>
                <span>Exclusive View</span>
              </div>

              {/* Bottom Metrics Bar */}
              <div className="flex items-center justify-between py-3 border-y border-gray-800 mb-4 text-[#71767b]">
                <div className="flex items-center space-x-2 hover:text-[#1d9bf0] cursor-pointer transition-colors group">
                  <div className="p-2 rounded-full group-hover:bg-[#1d9bf0]/10 transition-colors">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <span className="text-sm">Discuss</span>
                </div>
                <div className="flex items-center space-x-2 hover:text-[#00ba7c] cursor-pointer transition-colors group">
                  <div className="p-2 rounded-full group-hover:bg-[#00ba7c]/10 transition-colors">
                    <Repeat2 className="w-5 h-5" />
                  </div>
                  <span className="text-sm">Revise</span>
                </div>
                <div className="p-2 rounded-full hover:bg-[#f91880]/10 transition-colors">
                  <LikeButton
                    liked={isLiked}
                    burstVisible={showLikeBurst}
                    onClick={handleLikeToggle}
                    label="Approve"
                  />
                </div>
                <div className="flex items-center space-x-1">
                  <div className="p-2 rounded-full hover:bg-[#1d9bf0]/10 hover:text-[#1d9bf0] cursor-pointer transition-colors">
                    <Bookmark className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Threaded Reply 1: Next Steps */}
              <div className="flex items-start space-x-3 pt-4 pb-4 border-b border-gray-800">
                <div className="w-10 h-10 rounded-full bg-[#060d1a] flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-800">
                  <NerdConfLogo />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-1">
                    <span className="font-bold text-[#e7e9ea] hover:underline cursor-pointer">NERDCONF</span>
                    <BadgeCheck className="w-4 h-4 text-[#1d9bf0]" fill="currentColor" />
                    <span className="text-[#71767b] text-sm">@nerdconf_ar · 1m</span>
                  </div>
                  <p className="text-[#e7e9ea] mt-1">
                    Next steps: If you're happy with this proposal, just reply to the email with your thoughts. We'll then prepare the MSA and SOW to get started. Excited to partner with you! 🚀
                  </p>
                  <div className="flex items-center space-x-6 mt-3 text-[#71767b]">
                    <div className="flex items-center space-x-2 hover:text-[#1d9bf0] cursor-pointer group"><MessageCircle className="w-4 h-4" /></div>
                    <div className="flex items-center space-x-2 hover:text-[#00ba7c] cursor-pointer group"><Repeat2 className="w-4 h-4" /></div>
                    <LikeButton
                      liked={isLiked}
                      burstVisible={showLikeBurst}
                      onClick={handleLikeToggle}
                      size="xs"
                    />
                  </div>
                </div>
              </div>

              {/* Threaded Reply 2: Testimonial */}
              <div className="flex items-start space-x-3 pt-4 pb-4">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img src="https://pbs.twimg.com/profile_images/1780044485541699584/p78MCn3B_400x400.jpg" alt="Elon Musk" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-1">
                    <span className="font-bold text-[#e7e9ea] hover:underline cursor-pointer">Elon Musk</span>
                    <BadgeCheck className="w-4 h-4 text-[#ffd700]" fill="currentColor" />
                    <span className="text-[#71767b] text-sm">@elonmusk · Apr 1</span>
                  </div>
                  <p className="text-[#e7e9ea] mt-1">
                    Working with <span className="text-[#1d9bf0]">@nerdconf_ar</span> was the best decision we made this year. They completely transformed our architecture and delivered 10x ROI. Highly recommend! 🔥
                  </p>
                  <div className="flex items-center space-x-6 mt-3 text-[#71767b]">
                    <div className="flex items-center space-x-2 hover:text-[#1d9bf0] cursor-pointer group"><MessageCircle className="w-4 h-4" /><span className="text-xs">1.2K</span></div>
                    <div className="flex items-center space-x-2 hover:text-[#00ba7c] cursor-pointer group"><Repeat2 className="w-4 h-4" /><span className="text-xs">4.5K</span></div>
                    <div className="flex items-center space-x-2">
                      <LikeButton
                        liked={isLiked}
                        burstVisible={showLikeBurst}
                        onClick={handleLikeToggle}
                        size="xs"
                      />
                      <span className="text-xs">30.2K</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </main>
      )}

      {/* Publish Modal */}
      {showPublishModal && shareLink && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#000000] border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-[#e7e9ea]">Published!</h3>
              <button onClick={() => setShowPublishModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#71767b] text-sm mb-6">
              Your proposal is now live. Anyone with the link can view it.
            </p>
            <div className="flex items-center space-x-2 mb-6">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="flex-1 bg-[#16181c] border border-gray-800 rounded-lg px-3 py-2 text-[#e7e9ea] text-sm outline-none focus:border-[#1d9bf0]"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="bg-[#e7e9ea] hover:bg-white text-black font-bold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2 text-sm"
              >
                {isCopied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <button
              onClick={() => setShowPublishModal(false)}
              className="w-full bg-transparent border border-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-full transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
