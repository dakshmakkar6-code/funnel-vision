// Shared types for scraping + analysis across the app.

export type FlowCategory = "Friction" | "Legitimacy" | "Offer Clarity" | "Willingness";

export interface Annotation {
  exact_quote?: string;
  category: FlowCategory;
  issue_description: string;
  actionable_improvement: string;
  boxIndex?: number;
  stepIndex?: number;
  /** When true, element has no significant FLOW issue; brief_reason explains why */
  pass?: boolean;
  brief_reason?: string;
  /** FLOW health score 0–100: 0 = no issue, higher = worse leak (used for strength of analysis) */
  score?: number;
  /** Detailed analysis tied to 12 conversion principles & sales page best practices (show, don't tell) */
  detailed_flow_analysis?: string;
}

export interface PageSection {
  section_name: string;
  content: string;
}

export interface AuditResult {
  page_sections: PageSection[];
  annotations: Annotation[];
  /** Overall funnel health 0–100 (100 = no leaks). Computed from annotations. */
  overallScore?: number;
}

export type ElementType =
  | "text"
  | "button"
  | "image"
  | "input"
  | "background-image"
  | "container"
  | "decorative";

export interface ElementStyles {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  border?: string;
  borderRadius?: string;
  boxShadow?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: string;
  zIndex?: string;
}

export interface ElementLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  pageHeight: number;
  pageWidth: number;
  foldZone?: "above-fold" | "upper-mid" | "mid" | "lower";
}

export interface ElementImagesInfo {
  src?: string;
  alt?: string;
  objectFit?: string;
  backgroundImageUrl?: string;
  hasBackgroundImage?: boolean;
  aspectRatio?: number;
}

export interface ScrapedElement {
  id: string;
  type: ElementType;
  tagName: string;
  role?: string | null;
  ariaLabel?: string | null;
  href?: string | null;
  name?: string | null;
  placeholder?: string | null;
  inputType?: string | null;
  textContentFull?: string;
  textContentPreview?: string;
  isAboveTheFold?: boolean;
  sectionId?: string | null;
  sectionHeading?: string | null;
  styles: ElementStyles;
  layout: ElementLayout;
  images: ElementImagesInfo;
}

export interface FunnelStep {
  stepIndex: number;
  url: string;
  label?: string;
  screenshotUrl: string;
  pageHeight: number;
  pageWidth: number;
  elements: ScrapedElement[];
}

// Unified scrape result used by the frontend and analysis layer.
// The current single-page scraper maps to a single step at index 0.
export interface FunnelScrapeResult {
  flowId?: string;
  flowName?: string;
  steps: FunnelStep[];
}

