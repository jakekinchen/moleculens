import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import OpenAI from 'openai';

const openai = new OpenAI();

const CHEMISTRY_PROMPT =
  'The following is a chemistry-related transcript that may contain: ' +
  'chemical formulas like H2O, NaCl, CH3COOH; element names like Hydrogen, Helium, Carbon; ' +
  'molecular structures like alkanes, alkenes, aromatic rings; laboratory terms like titration, ' +
  'crystallization; measurements in moles, grams, milliliters; and chemical bonds like covalent, ' +
  'ionic, hydrogen bonds. Common chemical reactions and IUPAC nomenclature may be present.';

export async function POST(req: NextRequest) {
  try {
    const { audio, mimeType } = await req.json();

    if (!audio || !mimeType) {
      return NextResponse.json(
        { error: 'Missing audio data or MIME type', text: '' },
        { status: 400 }
      );
    }

    const base64Data = audio.includes('base64,') ? audio.split('base64,')[1] : audio;
    let audioBuffer: Buffer;
    try {
      audioBuffer = Buffer.from(base64Data, 'base64');
    } catch {
      return NextResponse.json({ error: 'Invalid audio data format', text: '' }, { status: 400 });
    }

    if (audioBuffer.length === 0) {
      return NextResponse.json({ error: 'Empty audio data', text: '' }, { status: 400 });
    }

    const fileExt = mimeType.split('/')[1] || 'wav';
    const tempFilePath = `/tmp/audio-${Date.now()}.${fileExt}`;

    fs.writeFileSync(tempFilePath, audioBuffer);

    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        prompt: CHEMISTRY_PROMPT,
        response_format: 'text',
      });

      fs.unlinkSync(tempFilePath);
      return NextResponse.json({ text: transcription });
    } catch (error) {
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {
          // ignore cleanup errors
        }
      }
      console.error('Whisper API error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'An unknown error occurred', text: '' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in transcribe API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred', text: '' },
      { status: 500 }
    );
  }
}
