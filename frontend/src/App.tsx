import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { 
  Activity, 
  AlertTriangle, 
  Zap,
  Loader2,
  BarChart3,
  ShieldCheck,
  Eye,
  HeartHandshake,
  Link as LinkIcon,
  Info,
  MousePointerClick,
  FileText,
  ZoomIn,
  ZoomOut,
  Download,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Types ---
type FlowCategory = 'Friction' | 'Legitimacy' | 'Offer Clarity' | 'Willingness';

interface Annotation {
  exact_quote: string;
  category: FlowCategory;
  issue_description: string;
  actionable_improvement: string;
  boxIndex?: number;
}

interface PageSection {
  section_name: string;
  content: string;
}

interface AuditResult {
  page_sections: PageSection[];
  annotations: Annotation[];
}

interface BoundingBox {
  type: 'text' | 'button' | 'image' | 'input' | 'background-image' | 'container';
  tagName: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: string;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  backgroundImage?: string;
  src?: string;
}

interface ScrapeResult {
  screenshotUrl: string;
  boxes: BoundingBox[];
  pageHeight: number;
  pageWidth: number;
}

// --- Helpers ---
const getCategoryColor = (category: FlowCategory) => {
  switch (category) {
    case 'Friction': return 'bg-[#c98383] text-[#083a4f]';
    case 'Legitimacy': return 'bg-[#7a94b8] text-[#083a4f]';
    case 'Offer Clarity': return 'bg-[#c8a870] text-[#083a4f]';
    case 'Willingness': return 'bg-[#7fafa5] text-[#083a4f]';
    default: return 'bg-amber-200 text-[#083a4f]';
  }
};

const getCategoryIcon = (category: FlowCategory) => {
  switch (category) {
    case 'Friction': return <BarChart3 className="w-4 h-4" />;
    case 'Legitimacy': return <ShieldCheck className="w-4 h-4" />;
    case 'Offer Clarity': return <Eye className="w-4 h-4" />;
    case 'Willingness': return <HeartHandshake className="w-4 h-4" />;
    default: return <AlertTriangle className="w-4 h-4" />;
  }
};

export default function App() {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBoxIndex, setActiveBoxIndex] = useState<number | null>(null);

  // Zoom & Pan State
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'mark') return;
    setIsPanning(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !containerRef.current) return;
    e.preventDefault();
    containerRef.current.scrollLeft -= e.movementX;
    containerRef.current.scrollTop -= e.movementY;
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleAudit = async () => {
    if (!url.trim()) {
      setError("Please provide a landing page URL to analyze.");
      return;
    }

    try {
      new URL(url);
    } catch (e) {
      setError("Please enter a valid URL (e.g., https://example.com).");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setScrapeResult(null);
    setActiveBoxIndex(null);

    try {
      // 1. Scrape the page
      const scrapeRes = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const scrapeData = await scrapeRes.json();
      if (!scrapeRes.ok) {
        throw new Error(scrapeData.error || "Failed to scrape page");
      }
      
      const scraped = scrapeData.data as ScrapeResult;
      setScrapeResult(scraped);

      // 2. Analyze with Gemini
      const boxesText = scraped.boxes.map((b, i) => {
        let details = `[Box ${i}] (${b.type} - <${b.tagName}>): `;
        if (b.text) details += `Text: "${b.text.substring(0, 100)}${b.text.length > 100 ? '...' : ''}" `;
        if (b.src) details += `Src: "${b.src}" `;
        if (b.backgroundImage) details += `BgImage: "${b.backgroundImage}" `;
        return details.trim();
      }).join('\n');
      
      const prompt = `
You are the "FunnelVision Architect," a specialized AI agent designed for high-conversion sales funnel auditing. You use the proprietary FLOW Framework (Friction, Legitimacy, Offer Clarity, Willingness) to diagnose why online businesses are failing to convert visitors into customers.

Context:
I have scraped the landing page URL: ${url}
Here are the extracted elements (text, buttons, images, inputs, backgrounds) with their assigned Box IDs:
${boxesText}

Your task is to analyze these elements and annotate specific boxes that need improvement based on the FLOW framework. You can annotate ANY type of element (e.g., a confusing background image, a missing trust badge image, a poorly worded text block, a friction-heavy form input, or a weak CTA button).

The FLOW Heuristics:
1. Friction (F): Check CTA visibility, number of steps, confusing navigation, poor form fields, distracting background images.
2. Legitimacy (L): Look for authority markers, testimonials, founder credentials, specific claims without proof, missing trust badges.
3. Offer Clarity (O): Check for a clear transformation. Is it jargon-heavy? Is the Ideal Customer Avatar (ICA) obvious? Do the images support the offer?
4. Willingness (W): Scan for risk reversal—guarantees, FAQs, refund policies, next-step transparency.

Output Requirements:
1. \`annotations\`: Identify specific problematic boxes. 
   - \`boxIndex\` MUST be the integer ID of the box you are annotating.
   - Assign one of the four FLOW categories.
   - Provide a brutal \`issue_description\`.
   - Provide an \`actionable_improvement\` (e.g., a rewritten headline, a suggested image change, or a form field removal).
   - \`exact_quote\`: If it's text, quote the text. If it's an image/background/form, describe the element (e.g., "Hero Background Image" or "Email Input Field").
   - Provide a maximum of 8-12 highly impactful annotations.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              annotations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    boxIndex: { type: Type.INTEGER },
                    exact_quote: { type: Type.STRING },
                    category: { 
                      type: Type.STRING, 
                      description: "Must be one of: Friction, Legitimacy, Offer Clarity, Willingness"
                    },
                    issue_description: { type: Type.STRING },
                    actionable_improvement: { type: Type.STRING }
                  },
                  required: ["boxIndex", "exact_quote", "category", "issue_description", "actionable_improvement"]
                }
              }
            },
            required: ["annotations"]
          }
        }
      });

      const text = response.text;
      if (text) {
        try {
          const parsed = JSON.parse(text);
          setResult({ page_sections: [], annotations: parsed.annotations });
        } catch (parseError: any) {
          console.error("Failed to parse JSON:", text);
          throw new Error("AI returned invalid JSON format.");
        }
      } else {
        const finishReason = response.candidates?.[0]?.finishReason;
        console.error("AI Response:", JSON.stringify(response, null, 2));
        throw new Error(`No response from AI. Finish reason: ${finishReason || 'Unknown'}`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during the audit.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#e5e1dd] text-[#083a4f] font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-[#e5e1dd] border-b border-slate-200 shrink-0 h-16 flex items-center justify-between px-6 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-[#083a4f] p-2 rounded-lg shadow-inner">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#083a4f]">FunnelVision</h1>
        </div>
        <div className="flex items-center gap-4 w-full max-w-xl ml-8">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LinkIcon className="h-4 w-4 text-[#083a4f]/50" />
            </div>
            <input
              type="url"
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-[#083a4f] focus:border-[#083a4f] sm:text-sm bg-white text-[#083a4f] placeholder-[#083a4f]/40"
              placeholder="Enter landing page URL to audit..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAudit()}
            />
          </div>
          <button
            onClick={handleAudit}
            disabled={isAnalyzing}
            className="flex justify-center items-center gap-2 py-2 px-6 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#a58d66] hover:bg-[#a58d66]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#a58d66] disabled:opacity-70 disabled:cursor-not-allowed transition-all shrink-0"
          >
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {isAnalyzing ? 'Scanning...' : 'Audit Page'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* Left Sidebar: FLOW Legend & Summary */}
        <aside className="w-72 bg-[#e5e1dd] border-r border-slate-200 flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#083a4f]/60 mb-4">The FLOW Framework</h2>
            <div className="space-y-3">
              {[
                { cat: 'Friction', icon: BarChart3, desc: 'Hidden CTAs, too many steps' },
                { cat: 'Legitimacy', icon: ShieldCheck, desc: 'Missing proof, weak authority' },
                { cat: 'Offer Clarity', icon: Eye, desc: 'Jargon, unclear transformation' },
                { cat: 'Willingness', icon: HeartHandshake, desc: 'No risk reversal, missing FAQs' }
              ].map((item) => (
                <div key={item.cat} className="flex items-start gap-3 bg-[#c0d5d6] p-3 rounded-xl border border-[#c0d5d6]/50">
                  <div className={`mt-0.5 p-1.5 rounded-md ${getCategoryColor(item.cat as FlowCategory)}`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#083a4f]">{item.cat}</h3>
                    <p className="text-xs text-[#083a4f]/60 leading-tight mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {result && (
            <div className="p-6 flex-1 overflow-y-auto">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#083a4f]/60 mb-4">Audit Summary</h2>
              <div className="space-y-4">
                <div className="bg-[#c0d5d6] p-4 rounded-xl border border-[#c0d5d6]/50">
                  <div className="text-3xl font-bold text-[#083a4f] mb-1">{result.annotations.length}</div>
                  <div className="text-xs font-medium text-[#083a4f]/60 uppercase tracking-wider">Total Leaks Found</div>
                </div>
                
                <div className="space-y-2">
                  {['Friction', 'Legitimacy', 'Offer Clarity', 'Willingness'].map(cat => {
                    const count = result.annotations.filter(a => a.category === cat).length;
                    if (count === 0) return null;
                    return (
                      <div key={cat} className="flex items-center justify-between text-sm bg-[#c0d5d6] p-2 rounded-lg border border-[#c0d5d6]/50">
                        <span className="text-[#083a4f]/80">{cat}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getCategoryColor(cat as FlowCategory)}`}>
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Center Panel: PDF Viewer */}
        <section 
          className="flex-1 flex flex-col bg-[#e5e1dd] overflow-hidden relative z-0"
          onClick={() => setActiveBoxIndex(null)}
        >
          {/* PDF Toolbar */}
          <div 
            className="h-12 bg-[#e5e1dd] flex items-center justify-between px-4 shadow-sm z-10 shrink-0 border-b border-slate-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 text-[#083a4f]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#083a4f]/60" />
                <span className="text-sm font-medium truncate max-w-[200px]" title={url}>
                  {url ? `${url.replace(/^https?:\/\//, '').split('/')[0]}_audit.pdf` : 'sales_page_audit.pdf'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[#083a4f]/70">
              <span className="text-xs font-medium bg-[#c0d5d6] px-2 py-1 rounded border border-slate-200">1 / {result ? '1' : '0'}</span>
              <div className="w-px h-4 bg-slate-300 mx-1"></div>
              <button onClick={handleZoomOut} disabled={zoom <= 0.25} className="p-1.5 rounded bg-white border border-slate-200 shadow-sm disabled:opacity-50 hover:text-[#083a4f] hover:bg-slate-50 transition-colors flex items-center justify-center">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={handleZoomIn} disabled={zoom >= 3} className="p-1.5 rounded bg-white border border-slate-200 shadow-sm disabled:opacity-50 hover:text-[#083a4f] hover:bg-slate-50 transition-colors flex items-center justify-center">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-4 text-[#083a4f]/70">
              <Download className="w-4 h-4 cursor-pointer hover:text-[#083a4f] transition-colors" />
              <Printer className="w-4 h-4 cursor-pointer hover:text-[#083a4f] transition-colors" />
            </div>
          </div>

          <div 
            ref={containerRef}
            className="flex-1 overflow-auto p-8"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: isPanning ? 'grabbing' : result ? 'grab' : 'default' }}
          >
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center h-full text-[#083a4f]/60 space-y-4 mx-auto">
                <Loader2 className="w-12 h-12 animate-spin text-[#083a4f]" />
                <p className="text-lg font-medium animate-pulse">Scraping & Analyzing Page...</p>
              </div>
            ) : result && scrapeResult ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ 
                  width: `${scrapeResult.pageWidth * zoom}px`
                }}
                className="relative mx-auto bg-white shadow-xl mb-8"
                onClick={(e) => e.stopPropagation()}
              >
                <img 
                  src={scrapeResult.screenshotUrl} 
                  alt="Page Screenshot" 
                  className="w-full h-auto block select-none"
                  draggable={false}
                />
                  
                  {/* Render ALL Bounding Boxes */}
                  {scrapeResult.boxes.map((box, idx) => {
                    const ann = result.annotations.find(a => a.boxIndex === idx);
                    const isActive = activeBoxIndex === idx;
                    
                    let hexColor = '#94a3b8'; // default slate-400 for unannotated
                    let baseColorClass = 'bg-slate-400 text-white';
                    
                    if (ann) {
                      baseColorClass = getCategoryColor(ann.category);
                      const hexColorMatch = baseColorClass.match(/bg-\[([^\]]+)\]/);
                      hexColor = hexColorMatch ? hexColorMatch[1] : '#fbbf24';
                    }
                    
                    // If not annotated and not active, hide border unless hovered
                    const visibilityClass = isActive 
                      ? 'z-30 opacity-100 shadow-2xl' 
                      : ann 
                        ? 'z-20 opacity-80 hover:opacity-100' 
                        : 'z-10 opacity-0 hover:opacity-100';

                    return (
                      <div
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveBoxIndex(idx);
                        }}
                        onMouseEnter={() => setActiveBoxIndex(idx)}
                        className={`absolute cursor-pointer transition-all duration-200 border-2 ${visibilityClass}`}
                        style={{
                          left: `${box.x * zoom}px`,
                          top: `${box.y * zoom}px`,
                          width: `${box.width * zoom}px`,
                          height: `${box.height * zoom}px`,
                          borderColor: hexColor,
                          backgroundColor: isActive ? `${hexColor}40` : `${hexColor}20`,
                          boxShadow: isActive ? `0 0 0 2px white, 0 0 15px ${hexColor}` : 'none'
                        }}
                      >
                        {/* Tooltip on hover (only for annotated or active) */}
                        {(ann || isActive) && (
                          <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-3 bg-white text-[#083a4f] text-sm rounded-lg shadow-xl border border-slate-200 transition-all z-50 pointer-events-none flex flex-col gap-1.5 font-sans leading-snug text-left font-normal ${isActive ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                            {ann ? (
                              <>
                                <span className="font-bold text-[10px] uppercase tracking-wider text-[#083a4f]/60 border-b border-slate-100 pb-1 mb-0.5 block">
                                  {ann.category} Issue
                                </span>
                                <span><span className="text-rose-500 font-semibold">Issue:</span> {ann.issue_description}</span>
                                <span><span className="text-emerald-600 font-semibold">Fix:</span> {ann.actionable_improvement}</span>
                              </>
                            ) : (
                              <>
                                <span className="font-bold text-[10px] uppercase tracking-wider text-[#083a4f]/60 border-b border-slate-100 pb-1 mb-0.5 block">
                                  Element Inspected
                                </span>
                                <span className="font-mono text-xs">&lt;{box.tagName}&gt;</span>
                              </>
                            )}
                            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white"></span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[#083a4f]/50 space-y-4 max-w-md text-center mx-auto">
                <div className="w-20 h-20 bg-[#e5e1dd] rounded-full flex items-center justify-center shadow-sm mb-4 border border-slate-200">
                  <FileText className="w-10 h-10 text-[#083a4f]/40" />
                </div>
                <h2 className="text-xl font-bold text-[#083a4f]">No Audit Generated</h2>
                <p className="text-[#083a4f]/60">Enter a URL above to scrape the page and visualize conversion leaks directly on the screenshot.</p>
              </div>
            )}
          </div>
        </section>

        {/* Right Sidebar: Inspector Panel */}
        <aside className="w-96 bg-[#e5e1dd] border-l border-slate-200 flex flex-col z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
          <div className="p-6 border-b border-slate-200 bg-[#e5e1dd]">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#083a4f] flex items-center gap-2">
              <Info className="w-4 h-4 text-[#083a4f]" />
              Inspector
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              {activeBoxIndex !== null && scrapeResult?.boxes[activeBoxIndex] ? (
                <motion.div
                  key={activeBoxIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 pb-8"
                >
                  {(() => {
                    const box = scrapeResult.boxes[activeBoxIndex];
                    const ann = result?.annotations.find(a => a.boxIndex === activeBoxIndex);
                    
                    return (
                      <>
                        {/* Element Data Section */}
                        <div className="space-y-3">
                          <h3 className="text-sm font-bold text-[#083a4f]/50 uppercase tracking-wider flex items-center gap-2">
                            <MousePointerClick className="w-4 h-4" /> Element Data
                          </h3>
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs font-mono text-[#083a4f]/80 space-y-2 break-all">
                            <div className="flex gap-2"><span className="font-bold text-[#083a4f] w-16 shrink-0">Tag:</span> &lt;{box.tagName}&gt;</div>
                            <div className="flex gap-2"><span className="font-bold text-[#083a4f] w-16 shrink-0">Type:</span> {box.type}</div>
                            <div className="flex gap-2"><span className="font-bold text-[#083a4f] w-16 shrink-0">Size:</span> {Math.round(box.width)}x{Math.round(box.height)}</div>
                            {box.src && <div className="flex gap-2"><span className="font-bold text-[#083a4f] w-16 shrink-0">Src:</span> <span className="line-clamp-3">{box.src}</span></div>}
                            {box.backgroundImage && <div className="flex gap-2"><span className="font-bold text-[#083a4f] w-16 shrink-0">BgImage:</span> <span className="line-clamp-3">{box.backgroundImage}</span></div>}
                            {box.text && <div className="flex gap-2"><span className="font-bold text-[#083a4f] w-16 shrink-0">Content:</span> <span className="line-clamp-4">{box.text}</span></div>}
                          </div>
                        </div>
    
                        {ann ? (
                          <>
                            {/* Category Badge */}
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${getCategoryColor(ann.category)}`}>
                              {getCategoryIcon(ann.category)}
                              {ann.category} Issue
                            </div>
    
                            {/* The Problem */}
                            <div className="space-y-3">
                              <h3 className="text-sm font-bold text-[#083a4f]/50 uppercase tracking-wider">The Leak</h3>
                              <div className="bg-[#e5e1dd] p-4 rounded-xl border border-rose-200 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                                <p className="text-sm text-[#083a4f]/70 italic mb-3">"{ann.exact_quote}"</p>
                                <p className="text-sm font-medium text-[#083a4f]">{ann.issue_description}</p>
                              </div>
                            </div>
    
                            {/* The Fix */}
                            <div className="space-y-3">
                              <h3 className="text-sm font-bold text-[#083a4f]/50 uppercase tracking-wider">The Fix</h3>
                              <div className="bg-[#e5e1dd] p-4 rounded-xl border border-emerald-200 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                                <div className="flex items-start gap-3">
                                  <Zap className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                  <p className="text-sm font-medium text-[#083a4f]">{ann.actionable_improvement}</p>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-emerald-800 font-medium">No conversion leaks detected by AI for this specific element.</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60"
                >
                  <MousePointerClick className="w-12 h-12 text-[#083a4f]/40" />
                  <p className="text-sm font-medium text-[#083a4f]/60 max-w-[200px]">
                    {result ? "Hover or click any element on the document to inspect its properties and AI analysis." : "Run an audit to see inspector details."}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>

      </main>
    </div>
  );
}
