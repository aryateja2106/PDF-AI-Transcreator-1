import { NextRequest, NextResponse } from 'next/server';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { transcreationQueries } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage, documentId, apiKey } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: 'Text and target language are required' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Gemini API key is required' },
        { status: 400 }
      );
    }

    // Check for cached transcreation if documentId is provided
    if (documentId) {
      const cached = transcreationQueries.findByDocumentAndLanguage.get(
        documentId,
        targetLanguage
      ) as { id: number; transcreated_text: string } | undefined;

      if (cached) {
        console.log("Returning cached transcreation");
        return NextResponse.json({
          transcreatedText: cached.transcreated_text,
          transcreationId: cached.id,
          cached: true,
          tokensUsed: 0, // No tokens used for cached response
        });
      }
    }

    console.log('Starting transcreation to', targetLanguage);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    // New Prompt for better, more readable transcreation
    const prompt = `
      As an expert academic translator and summarizer, your task is to transcreate the following text from a research paper into ${targetLanguage}.

      Your goal is to make the content clear, readable, and sound natural when narrated. Follow these rules strictly:
      1.  **Simplify, Don't Just Translate**: Do not provide a literal, word-for-word translation. Instead, rephrase and simplify complex sentences. Break down long, convoluted sentences into shorter, more digestible ones (ideally 15-20 words).
      2.  **Use Common Vocabulary**: Replace technical jargon and overly formal words with more common, everyday equivalents in ${targetLanguage}, unless the term is a critical keyword that cannot be translated (e.g., "BERT", "GAN").
      3.  **Optimize for Audio**: The final text should be optimized for text-to-speech (TTS). It should flow smoothly and be easy to listen to. Read it aloud in your "mind" to check the cadence.
      4.  **Preserve Core Meaning**: While simplifying, you must retain the original text's core concepts, findings, and nuances. Do not add new information or opinions.
      5.  **Format for Readability**: Use paragraphs to structure the content logically.

      Here is the text to transcreate:
      ---
      ${text}
      ---
    `;

    // Calculate token usage
    const { totalTokens } = await model.countTokens(prompt);
    console.log(`Estimated tokens for transcreation: ${totalTokens}`);

    const result = await model.generateContent(prompt);
    const response = result.response;
    const transcreatedText = response.text();

    let transcreationId: number | bigint | null = null;
    if (documentId) {
      const result = transcreationQueries.insert.run(
        documentId,
        targetLanguage,
        transcreatedText,
        text.length,
        transcreatedText.length
      );
      transcreationId = result.lastInsertRowid;
      console.log(`Stored new transcreation with ID: ${transcreationId}`);
    }

    return NextResponse.json({
      transcreatedText,
      transcreationId,
      cached: false,
      tokensUsed: totalTokens,
    });
  } catch (error) {
    console.error("Transcreation error:", error);
    
    // Handle specific API errors
    if (error instanceof Error) {
      if (error.message.includes('API_KEY') || error.message.includes('401')) {
        return NextResponse.json(
          { error: 'Invalid Google API key. Please check your GOOGLE_API_KEY environment variable.' },
          { status: 401 }
        );
      }
      if (error.message.includes('quota') || error.message.includes('limit') || error.message.includes('429')) {
        return NextResponse.json(
          { error: 'API quota exceeded. Please try again later.' },
          { status: 429 }
        );
      }
      if (error.message.includes('model') || error.message.includes('Model')) {
        return NextResponse.json(
          { error: 'AI model temporarily unavailable. Please try again.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to transcreate content. Please try again or contact support.' },
      { status: 500 }
    );
  }
} 