import DOMPurify from 'dompurify';
import { marked } from 'marked';

interface EmailContentProps {
  content: string;
  className?: string;
  isMobile?: boolean;
}

const mobileFriendlyCSS = `
  body, table, td, div, p, a, span, li {
    -webkit-text-size-adjust: 100%;
    -ms-text-size-adjust: 100%;
    font-size: 14px !important; /* Reduce base font size */
    line-height: 1.4 !important; /* Adjust line height for smaller font */
  }
  table, td {
    mso-table-lspace: 0pt !important;
    mso-table-rspace: 0pt !important;
  }
  img {
    -ms-interpolation-mode: bicubic;
    display: block !important; /* Makes images block elements */
    outline: none !important;
    text-decoration: none !important;
    border: none !important;
    max-width: 100% !important; /* Essential for responsiveness */
    height: auto !important;   /* Maintain aspect ratio */
  }
  table, td, div {
    max-width: 100% !important; /* Ensure containers don't overflow */
    width: auto !important; /* Allow shrinking, override inline fixed widths */
    box-sizing: border-box !important; /* Consistent box model */
  }
  /* More aggressive width override for common email patterns */
  *[width], *[style*="width"], *[style*="WIDTH"], *[style*="Width"] {
      width: auto !important; 
      max-width: 100% !important;
  }
  /* Prevent gigantic fonts from inline styles */
  *[style*="font-size"] {
    font-size: inherit !important; /* Force inherit from our 14px base */
  }
  h1, h2, h3, h4, h5, h6 {
    font-size: 1.2em !important; /* Slightly larger than base, but controlled */
    margin-top: 0.5em !important;
    margin-bottom: 0.3em !important;
  }
  /* More aggressive width override for common email patterns */
  *[width], *[style*="width"], *[style*="WIDTH"], *[style*="Width"] {
      width: auto !important; 
      max-width: 100% !important;
  }
  /* Attempt to make table cells stack on small screens, might be too aggressive */
  /* @media screen and (max-width: 600px) {
    table[class="container"], table[role="presentation"] { width: 100% !important; }
    td[class="stack"] { display: block !important; width: 100% !important; max-width: 100% !important; }
  } */
`;

export function EmailContent({ content, className = '', isMobile = false }: EmailContentProps) {
  // Try to detect if the content is HTML
  const isHTML = /<[a-z][\s\S]*>/i.test(content);
  
  let processedContent = content;
  
  if (!isHTML) {
    // If it's not HTML, convert potential markdown to HTML
    // Also convert URLs to clickable links
    const linkedContent = content.replace(
      /(https?:\/\/[\s\S]+?(?=\s|$|[\)\]\}\'\"\.\,\!\?\:]))/g, // Improved URL regex
      '[$1]($1)'
    );
    processedContent = marked.parse(linkedContent, { async: false }) as string;
  }

  let finalContent = processedContent;
  if (isMobile) {
    // Prepend mobile-friendly CSS. Ensure it's within a <style> tag.
    const styleTag = `<style type="text/css">${mobileFriendlyCSS}</style>`;
    finalContent = styleTag + processedContent;
  }

  // Sanitize the HTML
  const sanitizedContent = DOMPurify.sanitize(finalContent, {
    ADD_TAGS: ['style'], // Ensure style tag is allowed
    ADD_ATTR: ['target', 'rel', 'type'], // Allow type attribute for style tag
    FORBID_TAGS: ['script', 'iframe', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    WHOLE_DOCUMENT: false, // Sanitize as a fragment if not already a full doc
    IN_PLACE: false, 
  });

  return (
    <div 
      className={`email-content prose dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
} 