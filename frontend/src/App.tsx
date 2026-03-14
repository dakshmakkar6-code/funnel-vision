import React, { useState } from 'react';
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
import type {
  Annotation,
  FlowCategory,
  AuditResult,
  FunnelScrapeResult,
} from './types';
import { safeParseJson } from './safeJson';

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
  const [analysisPhase, setAnalysisPhase] = useState<'scrape' | 'analyze' | null>(null);
  const [scrapeResult, setScrapeResult] = useState<FunnelScrapeResult | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBoxIndex, setActiveBoxIndex] = useState<number | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

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
    setAnalysisPhase('scrape');
    setError(null);
    setResult(null);
    setScrapeResult(null);
    setActiveBoxIndex(null);
    setCurrentStepIndex(0);

    try {
      // 1. Scrape the page
      const scrapeRes = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const scrapeText = await scrapeRes.text();
      let scrapeData: { data?: FunnelScrapeResult | { boxes?: unknown[]; screenshotUrl?: string; pageHeight?: number; pageWidth?: number }; error?: string; details?: string };
      try {
        scrapeData = safeParseJson(scrapeText);
      } catch {
        if (!scrapeRes.ok) {
          throw new Error("Failed to scrape page (server error)");
        }
        throw new Error("Invalid response from server");
      }
      if (!scrapeRes.ok) {
        throw new Error(scrapeData.details || scrapeData.error || "Failed to scrape page");
      }
      
      const rawScraped = scrapeData.data as FunnelScrapeResult | { boxes?: unknown[]; screenshotUrl?: string; pageHeight?: number; pageWidth?: number } | undefined;
      if (!rawScraped) {
        throw new Error("No scrape data received");
      }

      // Backwards-compat: map old single-page shape into FunnelScrapeResult
      type LegacyScrape = { boxes?: unknown[]; screenshotUrl?: string; pageHeight?: number; pageWidth?: number };
      let normalizedScrape: FunnelScrapeResult;
      if ("steps" in rawScraped && rawScraped.steps) {
        normalizedScrape = rawScraped as FunnelScrapeResult;
      } else {
        const leg = rawScraped as LegacyScrape;
        normalizedScrape = {
          steps: [
            {
              stepIndex: 0,
              url,
              label: 'Landing',
              screenshotUrl: leg.screenshotUrl ?? '',
              pageHeight: leg.pageHeight ?? 0,
              pageWidth: leg.pageWidth ?? 1440,
              elements: (leg.boxes || []).map((box: any, idx: number) => ({
                id: String(idx),
                type: box.type,
                tagName: box.tagName,
                role: box.role ?? null,
                ariaLabel: box.ariaLabel ?? null,
                href: box.href ?? null,
                name: box.name ?? null,
                placeholder: box.placeholder ?? null,
                inputType: box.inputType ?? null,
                textContentFull: box.text,
                textContentPreview: box.text,
                isAboveTheFold: box.y < 800,
                sectionId: null,
                sectionHeading: null,
                styles: {
                  fontFamily: box.fontFamily,
                  fontSize: box.fontSize,
                  fontWeight: box.fontWeight,
                  color: box.color,
                  backgroundColor: box.backgroundColor,
                  border: box.border,
                  borderRadius: box.borderRadius,
                  boxShadow: box.boxShadow,
                  lineHeight: box.lineHeight,
                  letterSpacing: box.letterSpacing,
                  textAlign: box.textAlign,
                  zIndex: box.zIndex,
                },
                layout: {
                  x: box.x,
                  y: box.y,
                  width: box.width,
                  height: box.height,
                  pageHeight: leg.pageHeight ?? 0,
                  pageWidth: leg.pageWidth ?? 1440,
                  foldZone:
                    box.y < 600
                      ? 'above-fold'
                      : box.y < 1400
                      ? 'upper-mid'
                      : box.y < 2800
                      ? 'mid'
                      : 'lower',
                },
                images: {
                  src: box.src,
                  alt: box.alt ?? null,
                  objectFit: box.objectFit,
                  backgroundImageUrl: box.backgroundImage,
                  hasBackgroundImage: Boolean(box.backgroundImage),
                  aspectRatio:
                    box.width && box.height ? box.width / Math.max(1, box.height) : undefined,
                },
              })),
            },
          ],
        };
      }

      setScrapeResult(normalizedScrape);
      setAnalysisPhase('analyze');

      // LLM analysis: Groq first, then OpenAI fallback (server-side)
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), scrapeResult: normalizedScrape }),
      });
      const analyzeText = await analyzeRes.text();
      let annotations: Annotation[] = [];
      if (analyzeRes.ok) {
        try {
          const data = safeParseJson<{ annotations?: Annotation[] }>(analyzeText);
          annotations = Array.isArray(data.annotations) ? data.annotations : [];
        } catch {
          annotations = [];
        }
      }
      if (annotations.length === 0) {
        const errData = (() => {
          try {
            return safeParseJson<{ error?: string; details?: string }>(analyzeText);
          } catch {
            return {};
          }
        })();
        const raw = (errData.details || errData.error || "").toLowerCase();
        let message = errData.details || errData.error || "LLM analysis failed. Set OPENAI_API_KEY in frontend/.env.";
        if (raw.includes("429") || raw.includes("insufficient_quota") || raw.includes("exceeded your current quota")) {
          message = "API quota exceeded. Add billing or credits at platform.openai.com.";
        } else if (raw.includes("api key") || raw.includes("invalid") || raw.includes("unauthorized")) {
          message = "Invalid or missing API key. Check OPENAI_API_KEY in frontend/.env.";
        } else if (raw.includes("timed out") || raw.includes("timeout")) {
          message = "Analysis timed out. Try again.";
        }
        setError(message);
        // Fallback placeholders so the page still shows boxes
        normalizedScrape.steps.forEach((step, stepIndex) => {
          step.elements.forEach((_, boxIndex) => {
            annotations.push({
              stepIndex,
              boxIndex,
              category: "Legitimacy",
              issue_description: "",
              actionable_improvement: "",
              pass: true,
              brief_reason: "Analysis unavailable.",
              score: 0,
            });
          });
        });
      }
      // Overall score: 100 - average of per-element scores (score is 0=good, 100=bad)
      const withScores = annotations.filter(a => typeof a.score === 'number');
      const avgLeak = withScores.length
        ? withScores.reduce((s, a) => s + (a.score ?? 0), 0) / withScores.length
        : 0;
      const overallScore = Math.round(100 - avgLeak);
      setResult({ page_sections: [], annotations, overallScore: Math.max(0, Math.min(100, overallScore)) });
    } catch (err: any) {
      console.error(err);
      const msg = err?.message ?? "An error occurred during the audit.";
      if (msg.toLowerCase().includes("aborted")) {
        setError("Request was cancelled or timed out. Try again.");
      } else {
        setError(msg);
      }
    } finally {
      setIsAnalyzing(false);
      setAnalysisPhase(null);
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
                {typeof result.overallScore === "number" && (
                  <div className="bg-[#083a4f] p-4 rounded-xl border border-[#083a4f]/20 text-white">
                    <div className="text-3xl font-bold mb-1">{result.overallScore}</div>
                    <div className="text-xs font-medium uppercase tracking-wider opacity-90">FLOW Health Score (0–100)</div>
                  </div>
                )}
                <div className="bg-[#c0d5d6] p-4 rounded-xl border border-[#c0d5d6]/50">
                  <div className="text-3xl font-bold text-[#083a4f] mb-1">{result.annotations.filter(a => !a.pass).length}</div>
                  <div className="text-xs font-medium text-[#083a4f]/60 uppercase tracking-wider">Total Leaks Found</div>
                </div>
                <div className="bg-[#c0d5d6] p-3 rounded-xl border border-[#c0d5d6]/50">
                  <div className="text-lg font-bold text-[#083a4f]">{result.annotations.length}</div>
                  <div className="text-xs font-medium text-[#083a4f]/60 uppercase tracking-wider">Elements Analyzed</div>
                </div>
                {scrapeResult && scrapeResult.steps.length > 1 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-[#083a4f]/60 uppercase tracking-wider">Per step</h3>
                    {scrapeResult.steps.map((step, idx) => {
                      const count = result.annotations.filter(a => (a.stepIndex ?? 0) === idx && !a.pass).length;
                      return (
                        <div key={idx} className="flex items-center justify-between text-sm bg-[#c0d5d6] p-2 rounded-lg border border-[#c0d5d6]/50">
                          <span className="text-[#083a4f]/80 truncate">{step.label ?? `Step ${idx + 1}`}</span>
                          <span className="text-xs font-bold text-[#083a4f] shrink-0">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-2">
                  {['Friction', 'Legitimacy', 'Offer Clarity', 'Willingness'].map(cat => {
                    const count = result.annotations.filter(a => a.category === cat && !a.pass).length;
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
              {scrapeResult && scrapeResult.steps.length > 1 ? (
                <div className="flex items-center gap-1 rounded border border-slate-200 overflow-hidden bg-white">
                  {scrapeResult.steps.map((step, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => { setCurrentStepIndex(idx); setActiveBoxIndex(null); }}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${currentStepIndex === idx ? 'bg-[#083a4f] text-white' : 'bg-white text-[#083a4f]/70 hover:bg-slate-50'}`}
                    >
                      {step.label ?? `Step ${idx + 1}`}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-medium bg-[#c0d5d6] px-2 py-1 rounded border border-slate-200">{scrapeResult ? `${currentStepIndex + 1} / ${scrapeResult.steps.length}` : '0 / 0'}</span>
              )}
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
                <p className="text-lg font-medium animate-pulse">
                  {analysisPhase === 'scrape' ? 'Scraping page...' : 'Analyzing with AI (FLOW framework)...'}
                </p>
              </div>
            ) : scrapeResult ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  width: `${(scrapeResult.steps[currentStepIndex]?.pageWidth ?? 1440) * zoom}px`,
                }}
                className="relative mx-auto bg-white shadow-xl mb-8"
                onClick={(e) => e.stopPropagation()}
                onMouseLeave={() => setActiveBoxIndex(null)}
              >
                <img
                  src={scrapeResult.steps[currentStepIndex]?.screenshotUrl}
                  alt="Page Screenshot" 
                  className="w-full h-auto block select-none pointer-events-none"
                  draggable={false}
                />
                  
                  {/* Render bounding boxes for current step only */}
                  {(scrapeResult.steps[currentStepIndex]?.elements ?? []).map((box, idx) => {
                    const ann = result?.annotations.find(a => (a.stepIndex === undefined ? 0 : a.stepIndex) === currentStepIndex && a.boxIndex === idx);
                    const isActive = activeBoxIndex === idx;
                    
                    let hexColor = '#94a3b8'; // default slate-400 for unannotated
                    let baseColorClass = 'bg-slate-400 text-white';
                    
                    if (ann) {
                      if (ann.pass) {
                        hexColor = '#64748b'; // slate-500 for passed elements
                        baseColorClass = 'bg-slate-500 text-white';
                      } else {
                        baseColorClass = getCategoryColor(ann.category);
                        const hexColorMatch = baseColorClass.match(/bg-\[([^\]]+)\]/);
                        hexColor = hexColorMatch ? hexColorMatch[1] : '#fbbf24';
                      }
                    }
                    
                    // Clean overlays: no type/category labels; border only, tooltip on hover
                    const visibilityClass = isActive 
                      ? 'z-30 opacity-100 shadow-2xl' 
                      : ann 
                        ? 'z-20 opacity-85 hover:opacity-100' 
                        : 'z-10 opacity-50 hover:opacity-80';

                    const layout = (box as any).layout ?? box;

                    return (
                      <div
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveBoxIndex(idx);
                        }}
                        onMouseEnter={() => setActiveBoxIndex(idx)}
                        onMouseLeave={() => setActiveBoxIndex(null)}
                        className={`absolute cursor-pointer transition-all duration-200 border-2 ${visibilityClass}`}
                        style={{
                          left: `${layout.x * zoom}px`,
                          top: `${layout.y * zoom}px`,
                          width: `${layout.width * zoom}px`,
                          height: `${layout.height * zoom}px`,
                          borderColor: hexColor,
                          backgroundColor: isActive ? `${hexColor}40` : `${hexColor}15`,
                          boxShadow: isActive ? `0 0 0 2px white, 0 0 12px ${hexColor}` : 'none',
                          pointerEvents: 'auto',
                        }}
                      >
                        {/* Tooltip on hover; full FLOW analysis in Inspector */}
                        {(ann || isActive) && (
                          <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-3 bg-white text-[#083a4f] text-sm rounded-lg shadow-xl border border-slate-200 transition-all z-50 pointer-events-none flex flex-col gap-1.5 font-sans leading-snug text-left font-normal ${isActive ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                            {ann ? (
                              ann.pass ? (
                                <>
                                  <span className="font-bold text-[10px] uppercase tracking-wider text-emerald-600 border-b border-slate-100 pb-1 mb-0.5 block">
                                    ✓ No FLOW Issue {typeof ann.score === 'number' ? `· Score ${ann.score}` : ''}
                                  </span>
                                  <span className="text-[#083a4f]/80">{ann.brief_reason ?? 'Low conversion impact; no actionable leak.'}</span>
                                  {ann.detailed_flow_analysis && (
                                    <span className="text-[10px] text-[#083a4f]/70 block mt-1.5 border-t border-slate-100 pt-1.5">
                                      FLOW: {ann.detailed_flow_analysis.slice(0, 100)}{ann.detailed_flow_analysis.length > 100 ? '…' : ''}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="font-bold text-[10px] uppercase tracking-wider text-[#083a4f]/60 border-b border-slate-100 pb-1 mb-0.5 block">
                                    {ann.category} Issue {typeof ann.score === 'number' ? `· Severity ${ann.score}` : ''}
                                  </span>
                                  <span><span className="text-rose-500 font-semibold">Issue:</span> {ann.issue_description}</span>
                                  <span><span className="text-emerald-600 font-semibold">Fix:</span> {ann.actionable_improvement}</span>
                                  {ann.detailed_flow_analysis && (
                                    <span className="text-[10px] text-[#083a4f]/70 block mt-1.5 border-t border-slate-100 pt-1.5">
                                      FLOW: {ann.detailed_flow_analysis.slice(0, 120)}{ann.detailed_flow_analysis.length > 120 ? '…' : ''}
                                    </span>
                                  )}
                                </>
                              )
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
              {activeBoxIndex !== null && scrapeResult?.steps[currentStepIndex]?.elements[activeBoxIndex] ? (
                <motion.div
                  key={activeBoxIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 pb-8"
                >
                  {(() => {
                    const step = scrapeResult?.steps[currentStepIndex];
                    if (!step) return null;
                    const box = step.elements[activeBoxIndex];
                    if (!box) return null;
                    const ann = result?.annotations.find(a => (a.stepIndex === undefined ? 0 : a.stepIndex) === currentStepIndex && a.boxIndex === activeBoxIndex);
                    
                    return (
                      <>
                        {/* Element Data Section */}
                        <div className="space-y-3">
                          <h3 className="text-sm font-bold text-[#083a4f]/50 uppercase tracking-wider flex items-center gap-2">
                            <MousePointerClick className="w-4 h-4" /> Element Data
                          </h3>
                          <div className="space-y-2">
                            {(box.layout?.foldZone ?? (box as any).layout?.foldZone) && (
                              <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#083a4f]/10 text-[#083a4f]/80">
                                {(box.layout?.foldZone ?? (box as any).layout?.foldZone) === "above-fold" ? "Above the fold" : String((box.layout?.foldZone ?? (box as any).layout?.foldZone)).replace(/-/g, " ")}
                              </span>
                            )}
                            {(box.styles?.fontSize ?? (box as any).styles?.fontSize) && (
                              <div className="text-[10px] text-[#083a4f]/60">Font: {String((box.styles?.fontSize ?? (box as any).styles?.fontSize))} {String((box.styles?.fontWeight ?? (box as any).styles?.fontWeight) ?? "")}</div>
                            )}
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs font-mono text-[#083a4f]/80 space-y-2 break-all">
                            <div className="flex gap-2"><span className="font-bold text-[#083a4f] w-16 shrink-0">Tag:</span> &lt;{box.tagName}&gt;</div>
                            <div className="flex gap-2"><span className="font-bold text-[#083a4f] w-16 shrink-0">Type:</span> {box.type}</div>
                            <div className="flex gap-2"><span className="font-bold text-[#083a4f] w-16 shrink-0">Size:</span> {Math.round((box.layout?.width ?? (box as any).layout?.width) ?? 0)}x{Math.round((box.layout?.height ?? (box as any).layout?.height) ?? 0)}</div>
                            {((box as any).images?.src ?? (box as any).src) && <div className="flex gap-2"><span className="font-bold text-[#083a4f] w-16 shrink-0">Src:</span> <span className="line-clamp-3">{(box as any).images?.src ?? (box as any).src}</span></div>}
                            {((box as any).images?.backgroundImageUrl ?? (box as any).backgroundImage) && <div className="flex gap-2"><span className="font-bold text-[#083a4f] w-16 shrink-0">BgImage:</span> <span className="line-clamp-3">{(box as any).images?.backgroundImageUrl ?? (box as any).backgroundImage}</span></div>}
                            {(box.textContentPreview ?? (box as any).text) && <div className="flex gap-2"><span className="font-bold text-[#083a4f] w-16 shrink-0">Content:</span> <span className="line-clamp-4">{box.textContentPreview ?? (box as any).text}</span></div>}
                          </div>
                        </div>
    
                        {ann ? (
                          ann.pass ? (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <ShieldCheck className="w-4 h-4" />
                                  No FLOW Issue
                                </div>
                                {typeof ann.score === 'number' && (
                                  <span className="text-xs font-medium text-[#083a4f]/70 bg-[#083a4f]/10 px-2 py-1 rounded">Score: {ann.score}</span>
                                )}
                              </div>
                              <div className="space-y-3">
                                <h3 className="text-sm font-bold text-[#083a4f]/50 uppercase tracking-wider">Analysis</h3>
                                <div className="bg-[#e5e1dd] p-4 rounded-xl border border-emerald-200 shadow-sm">
                                  <p className="text-sm font-medium text-[#083a4f]">{ann.brief_reason ?? 'Low conversion impact; no actionable leak identified.'}</p>
                                </div>
                              </div>
                              {/* FLOW framework — always show when present; go deep */}
                              {ann.detailed_flow_analysis && (
                                <div className="space-y-3">
                                  <h3 className="text-sm font-bold text-[#083a4f]/50 uppercase tracking-wider">FLOW framework · 12 principles (deep)</h3>
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-sm text-[#083a4f] leading-relaxed whitespace-pre-line">
                                    {ann.detailed_flow_analysis}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${getCategoryColor(ann.category)}`}>
                                  {getCategoryIcon(ann.category)}
                                  {ann.category} Issue
                                </div>
                                {typeof ann.score === 'number' && (
                                  <span className="text-xs font-medium text-rose-700 bg-rose-100 px-2 py-1 rounded">Severity: {ann.score}/100</span>
                                )}
                              </div>
      
                              {/* FLOW deep analysis first so suggestions are prominent */}
                              {ann.detailed_flow_analysis && (
                                <div className="space-y-3">
                                  <h3 className="text-sm font-bold text-[#083a4f]/50 uppercase tracking-wider">FLOW framework · 12 principles (deep)</h3>
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-sm text-[#083a4f] leading-relaxed whitespace-pre-line">
                                    {ann.detailed_flow_analysis}
                                  </div>
                                </div>
                              )}

                              {/* The Problem */}
                              <div className="space-y-3">
                                <h3 className="text-sm font-bold text-[#083a4f]/50 uppercase tracking-wider">The Leak</h3>
                                <div className="bg-[#e5e1dd] p-4 rounded-xl border border-rose-200 shadow-sm relative overflow-hidden">
                                  <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                                  {ann.exact_quote && <p className="text-sm text-[#083a4f]/70 italic mb-3">"{ann.exact_quote}"</p>}
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
                          )
                        ) : (
                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3">
                            <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-[#083a4f]/80">No FLOW analysis for this element.</p>
                              <p className="text-xs text-[#083a4f]/60 mt-1">Analysis may still be in progress or this element was not included in the current batch.</p>
                            </div>
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
                    {result ? "Hover or click any element on the page to see FLOW analysis and 12-principles breakdown." : "Run an audit to see inspector details."}
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
