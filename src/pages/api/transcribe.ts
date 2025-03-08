import type { NextApiRequest, NextApiResponse } from 'next';
import fs from "fs";
import OpenAI from "openai";

const openai = new OpenAI();

// Chemistry-focused prompt to improve transcription accuracy
const CHEMISTRY_PROMPT = "The following is a chemistry-related transcript that may contain: " +
  "chemical formulas like H2O, NaCl, CH3COOH; element names like Hydrogen, Helium, Carbon; " +
  "molecular structures like alkanes, alkenes, aromatic rings; laboratory terms like titration, " +
  "crystallization; measurements in moles, grams, milliliters; and chemical bonds like covalent, " +
  "ionic, hydrogen bonds. Common chemical reactions and IUPAC nomenclature may be present.";

type TranscriptionResponse = {
  text: string;
  error?: string;
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TranscriptionResponse>
) {
  console.log('Transcribe API route called:', {
    method: req.method,
    headers: req.headers,
    contentLength: req.headers['content-length'],
  });

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed', text: '' });
  }

  try {
    const { audio, mimeType } = req.body;

    if (!audio) {
      console.error('Missing audio data in request');
      return res.status(400).json({ error: 'Missing audio data', text: '' });
    }

    if (!mimeType) {
      console.error('Missing MIME type in request');
      return res.status(400).json({ error: 'Missing MIME type', text: '' });
    }

    console.log('Received audio data for transcription:');
    console.log('MIME type:', mimeType);
    console.log('Audio data length:', audio.length);
    console.log('Audio data starts with:', audio.substring(0, 50) + '...');

    let audioBuffer;
    try {
      // Handle both raw base64 and data URL formats
      const base64Data = audio.includes('base64,') ? audio.split('base64,')[1] : audio;
      audioBuffer = Buffer.from(base64Data, 'base64');
      console.log('Successfully converted audio to buffer, size:', audioBuffer.length);
    } catch (error) {
      console.error('Failed to decode base64 audio:', error);
      return res.status(400).json({ error: 'Invalid audio data format', text: '' });
    }

    if (audioBuffer.length === 0) {
      console.error('Empty audio buffer');
      return res.status(400).json({ error: 'Empty audio data', text: '' });
    }

    // Create a unique filename based on timestamp and mime type
    const fileExt = mimeType.split('/')[1] || 'wav';
    const tempFilePath = `/tmp/audio-${Date.now()}.${fileExt}`;
    
    try {
      fs.writeFileSync(tempFilePath, audioBuffer);
      console.log('Successfully wrote audio to temp file:', tempFilePath);
      
      // Verify the file was written
      const stats = fs.statSync(tempFilePath);
      console.log('Temp file stats:', {
        size: stats.size,
        path: tempFilePath
      });
    } catch (error) {
      console.error('Failed to write audio file:', error);
      return res.status(500).json({ error: 'Failed to process audio file', text: '' });
    }

    try {
      console.log('Starting Whisper transcription...');
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
        prompt: CHEMISTRY_PROMPT,
        response_format: "text"
      });

      console.log('Transcription successful:', transcription);

      // Clean up the temporary file
      try {
        fs.unlinkSync(tempFilePath);
        console.log('Cleaned up temp file');
      } catch (error) {
        console.warn('Failed to clean up temp file:', error);
      }

      return res.status(200).json({ text: transcription });

    } catch (error) {
      console.error('Whisper API error:', error);
      // Clean up the temporary file in case of error
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log('Cleaned up temp file after error');
        } catch (cleanupError) {
          console.warn('Failed to clean up temp file after error:', cleanupError);
        }
      }
      throw error;
    }
    
  } catch (error) {
    console.error('Error in transcribe API:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred',
      text: '' 
    });
  }
}