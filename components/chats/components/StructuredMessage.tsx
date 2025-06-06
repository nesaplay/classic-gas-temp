"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Make Entry type generic
type Entry = Record<string, any>;

interface StructuredMessageProps {
  content: string;
}

// Helper function to format keys nicely (optional, but improves readability)
const formatKey = (key: string): string => {
  const words = key.replace(/_/g, ' ').split(' ');
  return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

// Update parsing function to be more generic
const parseStructuredContent = (content: string): { summary: string | null; structure: Entry[] | Entry | null } => {
  let summary: string | null = null;
  let structure: Entry[] | Entry | null = null; // Can be array or object

  // Regex to find the last JSON-like array or object structure
  // This looks for patterns starting with { or [ and ending with } or ], handling basic nesting.
  // It's not a perfect JSON parser but aims to capture the main structure.
  // It prioritizes finding an array `[...]` first.
  const structureRegex = /(\[[\s\S]*\]|\{[\s\S]*\})\s*$/;
  const match = content.match(structureRegex);

  if (match && match[1]) {
    const structureString = match[1];
    // Extract the text before the found structure as the summary
    const summaryEndIndex = match.index;
    if (summaryEndIndex !== undefined && summaryEndIndex > 0) {
       // Trim whitespace and potentially remove trailing list markers like "- "
       summary = content.substring(0, summaryEndIndex).trim().replace(/-\s*$/, '').trim();
    } else if (summaryEndIndex === 0) {
        // Structure starts at the beginning, no preceding summary text
        summary = null;
    }

    try {
      // Attempt to parse the extracted structure string
      structure = JSON.parse(structureString);
    } catch (error) {
      console.error("Failed to parse structured content JSON:", error, "String was:", structureString);
      // If parsing fails, we keep structure as null
      // Reset summary if we couldn't parse structure, treat whole content as text
      if (summaryEndIndex === undefined || summaryEndIndex === 0) {
         summary = content; // Parsing failed, treat whole thing as summary/text
      } 
    }
  } else {
    // No structure found, treat the entire content as summary/text
    summary = content;
  }
  
  // If structure wasn't parsed successfully, ensure summary contains the full original content
  if (structure === null && summary !== content) {
      summary = content;
  }

  return { summary, structure };
};

// Rename component and prop usage
const StructuredMessage: React.FC<StructuredMessageProps> = ({ content }) => {
  // Use renamed parsing function and destructured variables
  const { summary, structure } = parseStructuredContent(content);

  // Render as plain markdown if no structure was parsed successfully
  if (!structure) {
    // Use summary which should contain the full content if parsing failed
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary || content}</ReactMarkdown>; 
  }

  // Determine if the structure is an array or a single object
  const entries = Array.isArray(structure) ? structure : [structure];

  return (
    <div className="space-y-3 w-full">
      {summary && (
        <div>
          <div className="text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
          </div>
        </div>
      )}
      {/* Render entries if the structure was an array or a single object */}
      {entries.length > 0 && (
        <div className="mt-2">
          {/* Optional: Add a label only if there was also a summary? */}
          {/* {summary && <p className="font-semibold mb-1 text-sm">Details:</p>} */}
          <ul className="list-none space-y-3 pl-0 text-sm">
            {entries.map((entry, index) => (
              <li key={index} className="border-t border-gray-200 dark:border-gray-700 pt-2 first:border-t-0 first:pt-0"> {/* Improved styling */} 
                {Object.entries(entry).map(([key, value]) => {
                  // Return empty fragment instead of null if value is empty
                  if (value === null || value === undefined || value === '') return <React.Fragment key={key}></React.Fragment>;

                  let displayValue: React.ReactNode = value;
                  if ((key === 'due_by' || key.endsWith('_at') || key.endsWith('_date')) && typeof value === 'string') {
                    try {
                      const date = new Date(value);
                      if (!isNaN(date.getTime())) {
                        displayValue = date.toLocaleString();
                      }
                    } catch {}
                  }

                  // Ensure displayValue is a string for rendering
                  const finalDisplayValue = (typeof displayValue === 'string' || typeof displayValue === 'number' || typeof displayValue === 'boolean') 
                                            ? String(displayValue) 
                                            : JSON.stringify(displayValue);

                  return (
                    <p key={key} className="mb-0.5">
                      <strong>{formatKey(key)}:</strong>{' '}{/* Correct space */} 
                      {finalDisplayValue}
                    </p>
                  );
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default StructuredMessage; 