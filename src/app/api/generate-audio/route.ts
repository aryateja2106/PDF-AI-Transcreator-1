import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { audioQueries } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { text, language, transcreationId, apiKey } = await request.json();

    if (!text || !language) {
      return NextResponse.json(
        { error: 'Text and language are required' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key is required' },
        { status: 400 }
      );
    }

    // Check for cached audio if transcreationId is provided
    if (transcreationId) {
      const cachedAudio = audioQueries.findByTranscreation.get(transcreationId) as { audio_data: string, id: number } | undefined;
      if (cachedAudio && cachedAudio.audio_data) {
        console.log("Returning cached audio");
        return NextResponse.json({
          audioData: cachedAudio.audio_data,
          audioId: cachedAudio.id,
          cached: true,
          charactersUsed: 0,
        });
      }
    }

    // Limit text length to ~500 tokens (~2000 characters) for testing
    let processedText = text;
    const MAX_CHARS = 2000;
    if (processedText.length > MAX_CHARS) {
      // Try to cut at sentence boundary
      const truncated = processedText.substring(0, MAX_CHARS);
      const lastSentence = truncated.lastIndexOf('.');
      const lastQuestion = truncated.lastIndexOf('?');
      const lastExclamation = truncated.lastIndexOf('!');
      
      const cutPoint = Math.max(lastSentence, lastQuestion, lastExclamation);
      if (cutPoint > MAX_CHARS * 0.7) {
        processedText = truncated.substring(0, cutPoint + 1);
      } else {
        processedText = truncated + '...';
      }
      
      console.log(`Text truncated from ${text.length} to ${processedText.length} characters`);
    }

    // Map languages to appropriate voices for v3 model
    const voiceMap: Record<string, string> = {
      'Hindi': 'pNInz6obpgDQGcFmaJgB', // Adam - good for Indian languages
      'Telugu': 'pNInz6obpgDQGcFmaJgB', // Adam - supports Telugu with v3
      'Spanish': 'EXAVITQu4vr4xnSDxMaL', // Bella - multilingual
      'French': 'EXAVITQu4vr4xnSDxMaL', // Bella - multilingual
      'Chinese': 'EXAVITQu4vr4xnSDxMaL', // Bella - multilingual
    };

    const voiceId = voiceMap[language] || 'pNInz6obpgDQGcFmaJgB';

    console.log('Generating audio for language:', language);

    const elevenlabs = new ElevenLabsClient({
      apiKey: apiKey,
    });

    // Generate speech with v3 model for better language support and lower credits
    const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
      text: processedText,
      modelId: 'eleven_turbo_v2_5',
      outputFormat: 'mp3_22050_32',
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.8,
        style: 0.5,
        useSpeakerBoost: true
      }
    });

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const reader = audioStream.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Combine all chunks into a single buffer
    const buffer = Buffer.concat(chunks);
    const audioData = `data:audio/mpeg;base64,${buffer.toString("base64")}`;

    console.log('Audio generation successful:', {
      language,
      originalTextLength: text.length,
      processedTextLength: processedText.length,
      audioSize: buffer.length,
      creditOptimized: text.length > MAX_CHARS
    });

    // Store audio in database if transcreationId is provided
    let audioId = null;
    if (transcreationId) {
      console.log('Storing audio in database...');
      const insertResult = audioQueries.insert.run(
        transcreationId,
        language,
        voiceId,
        buffer.length,
        audioData
      );
      audioId = insertResult.lastInsertRowid;
      console.log('Audio stored with ID:', audioId);
    }

    return NextResponse.json({
      audioData,
      audioId,
      cached: false,
      charactersUsed: processedText.length,
    });

  } catch (error) {
    console.error('Audio generation error:', error);
    
    // Handle specific ElevenLabs API errors
    if (error instanceof Error) {
      if (error.message.includes('Unauthenticated')) {
        return NextResponse.json(
          { error: 'Invalid ElevenLabs API key. Please check your key and try again.' },
          { status: 401 }
        );
      }
      if (error.message.includes('quota') || error.message.includes('limit') || error.message.includes('429')) {
        return NextResponse.json(
          { error: 'API quota exceeded. Please try again later.' },
          { status: 429 }
        );
      }
      if (error.message.includes('voice') || error.message.includes('Voice')) {
        return NextResponse.json(
          { error: 'Voice not found or unavailable' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate audio due to an internal server error.' },
      { status: 500 }
    );
  }
} 