import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  'h1','h2','h3','h4','h5','h6',
  'p','br','strong','em','u','code','pre','blockquote',
  'ul','ol','li','a','img','table','thead','tbody','tr','td','th',
  'div','span','hr',
]

const ALLOWED_ATTR = ['href','title','alt','src','class','id','target','rel']

export function sanitizeExplanationHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script','style','iframe','object','embed','form','input','button','link','meta'],
  })
}
