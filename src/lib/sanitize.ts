import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  // text
  'h1','h2','h3','h4','h5','h6',
  'p','br','strong','em','u','code','pre','blockquote',
  'ul','ol','li','a','img','figure','figcaption',
  // table
  'table','thead','tbody','tfoot','tr','td','th','caption','colgroup','col',
  // layout
  'div','span','hr','section','article','aside','header','footer','details','summary',
  // inline svg + structure
  'svg','g','defs','symbol','use','marker','clipPath','mask','pattern',
  // svg shapes
  'path','rect','circle','ellipse','line','polyline','polygon','text','tspan','textPath',
  // svg gradients/filters
  'linearGradient','radialGradient','stop','filter','feGaussianBlur','feOffset','feMerge','feMergeNode','feColorMatrix',
  'title','desc',
]

const ALLOWED_ATTR = [
  // generic
  'href','title','alt','src','class','id','target','rel','colspan','rowspan','style','role','aria-label','aria-hidden','tabindex',
  // svg core
  'viewBox','preserveAspectRatio','xmlns','version','width','height',
  // svg shapes
  'd','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','points','dx','dy',
  // svg styling (inline)
  'fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','stroke-opacity','opacity',
  // svg transforms / refs
  'transform','clip-path','mask','filter','marker-start','marker-mid','marker-end','xlink:href','href',
  // svg text
  'font-family','font-size','font-weight','text-anchor','dominant-baseline','letter-spacing','word-spacing',
  // svg gradients
  'offset','stop-color','stop-opacity','gradientUnits','gradientTransform','spreadMethod',
]

export function sanitizeExplanationHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script','iframe','object','embed','form','input','button','link','meta'],
    ADD_URI_SAFE_ATTR: ['xlink:href'],
  })
}
