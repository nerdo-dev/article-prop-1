import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  MessageCircle, Repeat2, Heart, BarChart2, Bookmark, BadgeCheck, Upload, Loader2, Check,
  Link as LinkIcon, ImagePlus, X, Download
} from 'lucide-react';
import { MDXEditor, headingsPlugin, listsPlugin, quotePlugin, thematicBreakPlugin, markdownShortcutPlugin, toolbarPlugin, UndoRedo, BoldItalicUnderlineToggles, BlockTypeSelect, CreateLink, linkPlugin, linkDialogPlugin, MDXEditorMethods } from '@mdxeditor/editor';
import { NerdConfLogo } from './components/NerdConfLogo';

type ProposalResponse = {
  title: string;
  markdownContent: string;
  coverImage: string | null;
  createdAt: string;
};

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}

export default function App() {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<MDXEditorMethods>(null);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Extract slug from URL path (e.g., /master-log) or query param (e.g., ?slug=master-log)
  const urlParams = new URLSearchParams(window.location.search);
  const pathSlug = window.location.pathname.slice(1); // Remove leading "/"
  const proposalSlug = urlParams.get('slug') || (pathSlug && pathSlug !== '' ? pathSlug : null);
  const isPublicView = !!proposalSlug;

  useEffect(() => {
    if (!isPublicView) {
      setIsEditing(true);
      if (!markdownContent) {
        setMarkdownContent('# Proposal Title\n\nStart writing your proposal here...');
      }
    }
  }, [isPublicView]);

  useEffect(() => {
    let isCancelled = false;

    const loadProposal = async () => {
      if (!proposalSlug) {
        setIsLoading(false);
        return;
      }

      if (proposalSlug) {
        try {
          const response = await fetch(`/api/proposal?slug=${encodeURIComponent(proposalSlug)}`);
          const payload = await readJsonResponse(response);

          if (!response.ok) {
            throw new Error(payload?.error || 'Failed to load proposal.');
          }

          const data = payload as ProposalResponse;

          if (!isCancelled) {
            setMarkdownContent(data.markdownContent);
            setCoverImage(data.coverImage || null);
          }
        } catch (err) {
          console.error(err);
          if (!isCancelled) {
            setError(err instanceof Error ? err.message : 'Failed to load proposal.');
          }
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
  }, [proposalSlug]);

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

  const handleShare = async () => {
    if (!markdownContent) return;
    
    try {
      setIsSharing(true);

      let compressedImage = coverImage;
      if (coverImage && coverImage.length > 800000) {
        compressedImage = await compressImage(coverImage);
      }

      const titleMatch = markdownContent.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : 'Proposal Draft';

      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          markdownContent,
          coverImage: compressedImage ?? null,
        }),
      });

      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to share proposal.');
      }

      const link = payload?.shareUrl;
      console.log('[v0] Publish response:', payload);
      console.log('[v0] Share URL type:', typeof link, 'value:', link);
      if (typeof link !== 'string') {
        throw new Error('Publish API returned an invalid share URL.');
      }
      
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
      const reader = new FileReader();
      reader.onload = (e) => {
        const newContent = e.target?.result as string;
        setMarkdownContent(newContent);
        editorRef.current?.setMarkdown(newContent);
      };
      reader.readAsText(file);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownloadMd = () => {
    if (!markdownContent) return;
    const titleMatch = markdownContent.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : 'Proposal';
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

  // Extract title from markdown (first # heading) or use default
  const titleMatch = markdownContent.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : 'Proposal Draft';
  
  // Remove the title from the content so it doesn't duplicate in reader view
  const contentWithoutTitle = markdownContent.replace(/^#\s+(.+)$/m, '').trim();

  return (
    <div className="min-h-screen bg-black text-[#e7e9ea] font-sans selection:bg-[#1d9bf0] selection:text-white pb-20">
      
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
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="text-[#1d9bf0] font-bold hover:underline text-sm"
              >
                {isEditing ? 'Preview' : 'Edit'}
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
            <MDXEditor
              ref={editorRef}
              markdown={markdownContent}
              onChange={setMarkdownContent}
              className="mdxeditor-dark dark-theme dark-editor"
              plugins={[
                headingsPlugin(),
                listsPlugin(),
                quotePlugin(),
                thematicBreakPlugin(),
                markdownShortcutPlugin(),
                linkPlugin(),
                linkDialogPlugin(),
                toolbarPlugin({
                  toolbarContents: () => (
                    <>
                      <UndoRedo />
                      <BoldItalicUnderlineToggles />
                      <BlockTypeSelect />
                      <CreateLink />
                    </>
                  )
                })
              ]}
            />
          </div>
        </main>
      ) : (
        <main className="max-w-[600px] mx-auto w-full border-x border-gray-800 min-h-screen">
          
          {/* Cover Image */}
          {coverImage ? (
            <div className="w-full aspect-[21/9] bg-gray-900 overflow-hidden">
              <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full aspect-[21/9] bg-gradient-to-br from-gray-900 to-black border-b border-gray-800 flex items-center justify-center">
              <span className="text-gray-600 font-mono text-sm">No cover image uploaded</span>
            </div>
          )}

          <div className="px-4 pt-4 pb-6">
            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-bold text-[#e7e9ea] mb-4 leading-tight tracking-tight">
              {title}
            </h1>

            {/* Author Block */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#060d1a] flex items-center justify-center overflow-hidden border border-gray-800">
                  <NerdConfLogo />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center space-x-1">
                    <span className="font-bold text-[#e7e9ea] hover:underline cursor-pointer">NERDCONF</span>
                    <BadgeCheck className="w-4 h-4 text-[#1d9bf0]" fill="currentColor" />
                    <span className="text-xs border border-gray-600 text-gray-400 rounded px-1 ml-1 hidden sm:inline-block">PRO</span>
                  </div>
                  <div className="text-[#71767b] text-sm">
                    @nerdconf_ar · {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Bar */}
            <div className="flex items-center justify-between py-3 border-y border-gray-800 mb-6 text-[#71767b]">
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
                <span className="text-sm">v1.0</span>
              </div>
              <div className="flex items-center space-x-2 hover:text-[#f91880] cursor-pointer transition-colors group">
                <div className="p-2 rounded-full group-hover:bg-[#f91880]/10 transition-colors">
                  <Heart className="w-5 h-5" />
                </div>
                <span className="text-sm">Approve</span>
              </div>
              <div className="flex items-center space-x-2 hover:text-[#1d9bf0] cursor-pointer transition-colors group">
                <div className="p-2 rounded-full group-hover:bg-[#1d9bf0]/10 transition-colors">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <span className="text-sm">Confidential</span>
              </div>
              <div className="flex items-center space-x-1">
                <div 
                  onClick={handleDownloadMd}
                  className="p-2 rounded-full hover:bg-[#1d9bf0]/10 hover:text-[#1d9bf0] cursor-pointer transition-colors"
                  title="Download .md"
                >
                  <Download className="w-5 h-5" />
                </div>
                <div className="p-2 rounded-full hover:bg-[#1d9bf0]/10 hover:text-[#1d9bf0] cursor-pointer transition-colors">
                  <Bookmark className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Markdown Content */}
            <div className="prose prose-invert prose-lg max-w-none 
              prose-p:text-[#e7e9ea] prose-p:leading-relaxed prose-p:mb-6
              prose-headings:text-[#e7e9ea] prose-headings:font-bold prose-headings:tracking-tight
              prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
              prose-a:text-[#1d9bf0] prose-a:no-underline hover:prose-a:underline
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
                <div className="flex items-center space-x-2 hover:text-[#f91880] cursor-pointer transition-colors group">
                  <div className="p-2 rounded-full group-hover:bg-[#f91880]/10 transition-colors">
                    <Heart className="w-5 h-5" />
                  </div>
                  <span className="text-sm">Approve</span>
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
                    <div className="flex items-center space-x-2 hover:text-[#f91880] cursor-pointer group"><Heart className="w-4 h-4" /></div>
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
                    <div className="flex items-center space-x-2 hover:text-[#f91880] cursor-pointer group"><Heart className="w-4 h-4" /><span className="text-xs">30.2K</span></div>
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
