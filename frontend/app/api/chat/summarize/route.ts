import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Ensure your OpenAI API key is set in environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text for summarization is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('[API /chat/summarize] OpenAI API Key not configured.');
      return NextResponse.json({ error: 'OpenAI API Key not configured on server' }, { status: 500 });
    }
    
    // Simple truncation if text is very short, to avoid API call for tiny inputs
    if (text.trim().length < 50) { // Arbitrary short length
        let title = text.split('\n')[0].trim();
        if (title.length > 70) { // Max length for titles
            title = title.substring(0, 70).trim();
            const lastSpace = title.lastIndexOf(' ');
            if (lastSpace > 35 && lastSpace > 0) { 
                title = title.substring(0, lastSpace);
            }
            title += "...";
        }
        return NextResponse.json({ summary: title.trim() || "New Chat" });
    }

    console.log('[API /chat/summarize] Requesting summary from OpenAI for text:', text.substring(0, 100) + "...");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at summarizing text into a single, concise sentence that can be used as a chat title. The title should capture the main topic or question. Aim for around 10-15 words or less if possible.",
        },
        {
          role: "user",
          content: `Summarize the following text into a single, concise sentence to be used as a chat title. Text: ###${text}###`,
        },
      ],
      max_tokens: 40, // Max tokens for the summary title
      temperature: 0.3, // Lower temperature for more deterministic titles
      n: 1,
    });

    let summary = completion.choices[0]?.message?.content?.trim() || '';
    console.log('[API /chat/summarize] OpenAI Raw Summary:', summary);

    // Enhanced cleanup for the summary
    if (summary) {
      // Remove leading/trailing quotes (single or double)
      summary = summary.replace(/^['"]|['"]$/g, '');

      // Remove common trailing punctuation unless it's a question mark or part of an ellipsis
      if (!summary.endsWith('...') && summary.length > 0) {
        const lastChar = summary[summary.length - 1];
        if (lastChar === '.' || lastChar === ',' || lastChar === '!' || lastChar === ';') {
          summary = summary.substring(0, summary.length - 1);
        }
      }
      summary = summary.trim(); // Trim again after potential modifications
    }
    
    // Apply max length and ellipsis if needed
    if (summary.length > 70) { 
        summary = summary.substring(0, 70).trim();
        // Ensure we don't add ellipsis if it already ends with one from substringing a sentence that had one
        if (!summary.endsWith('...')) {
            // Smart ellipsis: try to break at last space if sensible
            const lastSpace = summary.lastIndexOf(' ');
            if (lastSpace > 35 && lastSpace > 0) { // Heuristic: cut at space if it's in the latter half
                summary = summary.substring(0, lastSpace);
            }
            summary += "...";
        }
    }

    if (!summary || summary.length < 5 && summary.toLowerCase() !== "new chat") { // If summary is very short (and not "New Chat"), it might be poor quality
      console.warn('[API /chat/summarize] OpenAI returned a very short or potentially poor summary (' + summary + '). Falling back to simple truncation.');
      // Fallback to simple truncation if API fails or returns empty
      let fallbackTitle = text.split('\n')[0].trim();
      if (fallbackTitle.length > 70) {
        fallbackTitle = fallbackTitle.substring(0, 70).trim() + "...";
      }
      summary = fallbackTitle || "New Chat"; // Ensure there's always some title
    }

    console.log('[API /chat/summarize] Final Summary:', summary);
    return NextResponse.json({ summary });

  } catch (error: any) {
    console.error('[API /chat/summarize] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate summary' }, { status: 500 });
  }
} 