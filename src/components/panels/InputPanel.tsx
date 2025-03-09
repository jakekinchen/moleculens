import React, { useState, useRef, useEffect, useCallback } from 'react';
import { pollJobStatus, fetchMoleculeData, generateMoleculeHTML } from '@/services/api';
import { ArrowDownTrayIcon, ExclamationTriangleIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { VisualizationOutput } from '@/types';
import CHEMISTRY_TOPICS from './chemistry_topics';

// Import the VisualizationData interface from the API file
interface VisualizationData {
  html: string;
  pdb_data: string;
  title: string;
  timecode_markers: string[];
  total_elements: number;
}

interface InputPanelProps {
  onVisualizationUpdate: (pdbData: string, html?: string, title?: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
  currentPrompt: string;
  onPromptChange: (prompt: string) => void;
  onPromptSubmit: (prompt: string, visualization?: VisualizationOutput) => void;
  model: string | null;
  isInteractive: boolean;
  usePubChem?: boolean;
  currentHtml?: string;
  currentTitle?: string;
}

// Update the JobStatusResponse interface to include legacy fields
interface ExtendedJobStatusResponse {
  job_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  visualization?: VisualizationData;
  error?: string;
  // Legacy fields
  pdb_data?: string;
  result_html?: string;
}

// Add new interfaces for audio recording
interface AudioRecordingState {
  isRecording: boolean;
  audioBlob: Blob | null;
  isProcessing: boolean;
  error: string | null;
  isInitialized: boolean;
  pendingTranscription: boolean;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  onVisualizationUpdate,
  onLoadingChange,
  currentPrompt,
  onPromptChange,
  onPromptSubmit,
  model,
  isInteractive,
  usePubChem,
  currentHtml: initialHtml,
  currentTitle: initialTitle
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentScript, setCurrentScript] = useState<string | null>(null);
  const [currentHtml, setCurrentHtml] = useState<string | null>(initialHtml || null);
  const [title, setTitle] = useState<string | null>(initialTitle || null);
  const [error, setError] = useState<string | null>(null);
  const [isScientificError, setIsScientificError] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isSuggestHovered, setIsSuggestHovered] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Add new state for audio recording
  const [audioState, setAudioState] = useState<AudioRecordingState>({
    isRecording: false,
    audioBlob: null,
    isProcessing: false,
    error: null,
    isInitialized: false,
    pendingTranscription: false
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // We're keeping these references for future use with real audio
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null);
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);
  const animationFrameRef = useRef<number>();
  // Ref for smooth audio visualization
  const prevAudioValuesRef = useRef<number[]>([]);

  // Function to properly resize textarea accounting for padding
  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Get the computed styles
    const computedStyle = window.getComputedStyle(textarea);
    
    // Set the new height including padding
    const newHeight = Math.max(
      textarea.scrollHeight, // Content height
      parseFloat(computedStyle.minHeight) || 0 // Min height if set
    );
    
    textarea.style.height = `${newHeight}px`;
  };

  // Update textarea size when prompt changes
  useEffect(() => {
    resizeTextarea();
  }, [currentPrompt]);

  // Update HTML and title when they change from props
  useEffect(() => {
    if (initialHtml) setCurrentHtml(initialHtml);
    if (initialTitle) setTitle(initialTitle);
  }, [initialHtml, initialTitle]);

  // Check supported MIME types
  const getSupportedMimeType = () => {
    const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
    console.log('Checking supported MIME types...');
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('Found supported type:', type);
        return type;
      }
    }
    console.log('No supported types found, falling back to audio/webm');
    return 'audio/webm'; // Default fallback
  };

  // Function to update audio visualization with smooth random noise
  // We keep the real audio processing code (commented out) for future use
  const updateAudioVisualization = useCallback(() => {
    // Initialize values if needed
    if (prevAudioValuesRef.current.length === 0) {
      prevAudioValuesRef.current = Array(8).fill(50);
    }
    
    // Generate random data for visualization
    const fakeData = new Uint8Array(8);
    
    // Speech pattern simulation parameters
    const time = Date.now() / 1000; // Use time for sinusoidal patterns
    const speakingFrequency = Math.sin(time * 1.5) * 0.5 + 0.5; // Oscillates between 0 and 1
    const isSpeakingLoudly = speakingFrequency > 0.7; // Threshold for "louder" moments
    
    // Fill the array with smoothly transitioning values
    for (let i = 0; i < 8; i++) {
      // Create a base oscillation pattern
      const waveOffset = i * (Math.PI / 4); // Distribute wave phases
      const baseOscillation = Math.sin(time * 2 + waveOffset) * 0.5 + 0.5; // 0 to 1
      
      // Apply speaking intensity
      let targetValue;
      if (isSpeakingLoudly) {
        // Louder speaking (higher values)
        targetValue = 70 + (baseOscillation * 120) + (Math.sin(time * 10 + i) * 20);
      } else {
        // Softer speaking or background
        targetValue = 40 + (baseOscillation * 70) + (Math.sin(time * 5 + i) * 10);
      }
      
      // Smooth transition from previous value (easing)
      const prevValue = prevAudioValuesRef.current[i] || 50;
      const easeFactor = 0.15; // Lower = smoother but slower transitions
      const smoothedValue = prevValue + (targetValue - prevValue) * easeFactor;
      
      // Update previous values for next frame
      prevAudioValuesRef.current[i] = smoothedValue;
      
      // Set value with threshold
      fakeData[i] = Math.max(30, Math.min(255, smoothedValue));
    }
    
    setAudioData(fakeData);
    animationFrameRef.current = requestAnimationFrame(updateAudioVisualization);
    
    /* Real audio processing code - keeping for future use
    if (!audioAnalyser || !audioData) return;
    
    audioAnalyser.getByteFrequencyData(audioData);
    const normalizedData = new Uint8Array(8);
    
    // Process the frequency data into 8 segments for better visualization
    const samplesPerSegment = Math.floor(audioData.length / 8);
    for (let i = 0; i < 8; i++) {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < samplesPerSegment; j++) {
        const idx = i * samplesPerSegment + j;
        if (audioData[idx] > 0) { // Only count non-zero values
          sum += audioData[idx];
          count++;
        }
      }
      
      // Enhanced normalization with minimum threshold to ensure bars are always visible
      const minThreshold = 30; // Ensure at least some activity is shown
      const amplification = 2.5; // Amplify values to make quieter sounds more visible
      normalizedData[i] = count > 0 
        ? Math.min(255, Math.max(minThreshold, (sum / count) * amplification)) 
        : minThreshold;
    }
    
    setAudioData(normalizedData);
    */
    
  }, []);

  // Clean up audio context and animation frame
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Update toggleRecording to include audio analysis
  const toggleRecording = async () => {
    try {
      if (!audioState.isInitialized) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = getSupportedMimeType();
        console.log('Using MIME type:', mimeType);
        
        // Set up initial dummy data for visualization
        // We're using random noise instead of real audio analysis
        setAudioData(new Uint8Array(8).fill(40));
        
        /* Real audio analysis code - keeping for future use
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        
        // Configure analyzer for waveform data - more sensitive settings
        analyser.fftSize = 256; // Balanced FFT size for better frequency resolution
        analyser.smoothingTimeConstant = 0.5; // Smooth out rapid changes
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        source.connect(analyser);
        
        setAudioAnalyser(analyser);
        setAudioData(new Uint8Array(analyser.frequencyBinCount));
        */
        
        let recorder;
        try {
          recorder = new MediaRecorder(stream, { mimeType });
        } catch (e) {
          console.warn('Failed with specified MIME type, using default');
          recorder = new MediaRecorder(stream);
        }
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };
        
        recorder.onstop = () => {
          console.log('MediaRecorder.onstop fired, creating audio blob');
          if (chunksRef.current.length === 0) {
            console.error('No audio chunks recorded');
            setAudioState(prev => ({
              ...prev,
              isRecording: false,
              error: 'No audio data recorded',
              isProcessing: false,
              pendingTranscription: false
            }));
            return;
          }

          const blob = new Blob(chunksRef.current, { type: mimeType });
          console.log('Created audio blob:', { size: blob.size, type: blob.type });
          
          // Clean up audio visualization
          setAudioData(null);
          prevAudioValuesRef.current = []; // Reset smooth animation values
          
          /* Real audio cleanup code - for future use
          source.disconnect();
          setAudioAnalyser(null);
          */
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          
          chunksRef.current = [];

          // Set the audio blob in state and check if we should transcribe
          setAudioState(prev => {
            console.log('Setting audio state, transcription pending:', prev.pendingTranscription);
            
            // If transcription was requested, process it in the next tick
            if (prev.pendingTranscription) {
              console.log('Will start transcription after state update');
              setTimeout(() => handleTranscription(blob), 0);
            }
            
            return {
              ...prev,
              audioBlob: blob,
              isRecording: false,
              isProcessing: prev.pendingTranscription
            };
          });
        };
        
        mediaRecorderRef.current = recorder;
        setAudioState(prev => ({ ...prev, isInitialized: true }));
      }
      
      if (!audioState.isRecording) {
        chunksRef.current = [];
        mediaRecorderRef.current?.start(100);
        setAudioState(prev => ({ 
          ...prev, 
          isRecording: true, 
          audioBlob: null, 
          error: null 
        }));
        
        // Start audio visualization (random noise version)
        animationFrameRef.current = requestAnimationFrame(updateAudioVisualization);
      } else {
        mediaRecorderRef.current?.stop();
        setAudioState(prev => ({ ...prev, isRecording: false }));
        
        // Stop audio visualization
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      }
    } catch (err) {
      console.error('Failed to initialize/toggle media recorder:', err);
      setAudioState(prev => ({ 
        ...prev, 
        error: 'Failed to access microphone. Please check permissions.',
        isRecording: false
      }));
    }
  };

  // Update cancelRecording to handle cleanup
  const cancelRecording = () => {
    if (mediaRecorderRef.current && audioState.isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    // Reset visualization state
    prevAudioValuesRef.current = [];
    
    setAudioState(prev => ({
      ...prev,
      isRecording: false,
      audioBlob: null,
      isProcessing: false,
      error: null,
      pendingTranscription: false
      // Keep isInitialized true since we've already set up the recorder
    }));
  };

  // Handle transcription
  const handleTranscription = async (directBlob?: Blob) => {
    const audioBlob = directBlob || audioState.audioBlob;
    
    if (!audioBlob) {
      console.error('No audio blob available for transcription');
      setAudioState(prev => ({
        ...prev,
        isProcessing: false,
        error: 'No audio data available',
        pendingTranscription: false
      }));
      return;
    }

    console.log('Starting transcription with blob:', { size: audioBlob.size, type: audioBlob.type });
    setAudioState(prev => ({ ...prev, isProcessing: true, error: null }));

    let timeoutId: NodeJS.Timeout | undefined;

    try {
      // Convert blob to base64
      const reader = new FileReader();
      
      const transcriptionPromise = new Promise((resolve, reject) => {
        let isResolved = false;

        reader.onload = async () => {
          try {
            const base64Audio = reader.result as string;
            const mimeType = audioBlob.type || 'audio/webm';
            
            console.log('Preparing audio for transcription:');
            console.log('MIME type:', mimeType);
            console.log('Audio data length:', base64Audio.length);
            
            // Log the request URL and details
            const apiUrl = '/api/transcribe';
            console.log('Sending request to:', apiUrl);
            
            const requestData = { 
              audio: base64Audio,
              mimeType: mimeType
            };
            console.log('Request details:', {
              url: apiUrl,
              method: 'POST',
              mimeType: mimeType,
              audioLength: base64Audio.length
            });
            
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(requestData)
            });

            console.log('Received response:', {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries())
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('Transcription API error response:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
              });
              throw new Error(`API error: ${response.status} ${errorText}`);
            }

            const responseText = await response.text();
            console.log('Raw response text:', responseText);

            let data;
            try {
              data = JSON.parse(responseText);
              console.log('Parsed response data:', data);
            } catch (parseError) {
              console.error('Failed to parse response as JSON:', parseError);
              throw new Error('Invalid response format from server');
            }

            if (data.error) {
              throw new Error(data.error);
            }

            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeoutId);

              // Update the prompt with transcribed text - prevent newline
              const newText = data.text.trim();
              const currentText = currentPrompt.trim();
              const updatedText = currentText 
                ? `${currentText} ${newText}`
                : newText;
              onPromptChange(updatedText);
              
              // Reset audio state
              setAudioState({
                isRecording: false,
                audioBlob: null,
                isProcessing: false,
                error: null,
                isInitialized: true,
                pendingTranscription: false
              });

              resolve(data);
            }
          } catch (err) {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeoutId);
              console.error('Error in transcription process:', err);
              reject(err);
            }
          }
        };

        reader.onerror = () => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            console.error('FileReader error:', reader.error);
            reject(new Error('Failed to read audio file'));
          }
        };
      });

      reader.readAsDataURL(audioBlob);
      
      // Set a timeout for the transcription
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          console.error('Transcription timed out after 30 seconds');
          reject(new Error('Transcription timed out'));
        }, 30000); // 30 second timeout
      });

      await Promise.race([transcriptionPromise, timeoutPromise]);

    } catch (err) {
      console.error('Transcription error:', err);
      setAudioState(prev => ({
        ...prev,
        isProcessing: false,
        error: err instanceof Error ? err.message : 'Failed to transcribe audio',
        pendingTranscription: false
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Poll for job updates
  const pollForUpdates = async (id: string) => {
    try {
      const pollInterval = setInterval(async () => {
        const result = await pollJobStatus(id) as ExtendedJobStatusResponse;
        
        console.log('Job status update:', result);
        
        switch (result.status) {
          case 'completed':
            clearInterval(pollInterval);
            setIsLoading(false);
            onLoadingChange(false);
            
            if (result.visualization) {
              // Handle the structured visualization data
              const { pdb_data, html, title, timecode_markers, total_elements } = result.visualization;
              console.log('Visualization received:', { title, total_elements });
              
              // Update the visualization and store both PDB data and HTML
              setCurrentScript(pdb_data);
              setCurrentHtml(html);
              setTitle(title);
              onVisualizationUpdate(pdb_data, html, title);
              const visualizationOutput: VisualizationOutput = { pdb_data, html, title, timecode_markers, total_elements };
              onPromptSubmit(currentPrompt, visualizationOutput);
            } else if (result.pdb_data) {
              // Fallback for legacy response formats
              const pdbData = result.pdb_data;
              const html = result.result_html || '';
              setCurrentScript(pdbData);
              setCurrentHtml(html);
              onVisualizationUpdate(pdbData, html);
              const visualizationOutput: VisualizationOutput = { pdb_data: pdbData, html };
              onPromptSubmit(currentPrompt, visualizationOutput);
            }
            break;
          
          case 'processing':
            // Update progress if available
            if (result.progress !== undefined) {
              const progressPercent = Math.round(result.progress * 100);
              console.log(`Processing: ${progressPercent}% complete`);
              // Could update a progress bar here
            }
            break;
          
          case 'failed':
            clearInterval(pollInterval);
            setIsLoading(false);
            onLoadingChange(false);
            setError(`Processing failed: ${result.error || 'Unknown error'}`);
            break;
          
          default:
            console.warn('Unknown status received:', result.status);
            break;
        }
      }, 2000); // Poll every 2 seconds
      
      // Cleanup function to clear interval if component unmounts
      return () => clearInterval(pollInterval);
    } catch (error) {
      console.error('Error polling for updates:', error);
      setIsLoading(false);
      onLoadingChange(false);
      setError('Failed to check processing status');
    }
  }; // eslint-disable-next-line @typescript-eslint/no-unused-vars

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPrompt.trim() || isLoading) return;
    
    setIsLoading(true);
    onLoadingChange(true);
    setError(null);
    setIsScientificError(false);
    
    console.log('Making request for:', currentPrompt, 'with model:', model, 'interactive mode:', isInteractive, 'PubChem mode:', usePubChem);

    try {
      // Step A: Fetch molecule data only
      const moleculeData = await fetchMoleculeData(currentPrompt);
      const pdbData = moleculeData.pdb_data;
      const name = moleculeData.name;

      if (!pdbData) {
        throw new Error('No PDB data returned from fetchMoleculeData');
      }

      setCurrentScript(pdbData);
      setTitle(name);
      setCurrentHtml(null); // No HTML generated yet

      // Pass partial data upward if needed
      onVisualizationUpdate(pdbData, undefined, name);
      onPromptSubmit(currentPrompt, { pdb_data: pdbData, html: '', title: name });

      setIsLoading(false);
      onLoadingChange(false);
    } catch (err: unknown) {
      setIsLoading(false);
      onLoadingChange(false);
      
      // Check if this is a scientific content validation error
      if (err instanceof Error && err.message.includes('Non-molecular prompt')) {
        setIsScientificError(true);
        setError(`Your prompt should be related to molecular structures. Click on the "Suggest Molecule" button to get started.`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to process prompt');
      }
    }
  };

  const handleDownload = () => {
    // If script is not in local state, use the one from props
    if (!currentScript && !currentHtml) return;
    
    // Use the backend-generated HTML if available, otherwise fall back to an empty string
    const htmlContent = currentHtml || '';
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'visualization'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSuggestTopic = () => {
    const randomTopic = CHEMISTRY_TOPICS[Math.floor(Math.random() * CHEMISTRY_TOPICS.length)];
    onPromptChange(randomTopic);
    setIsScientificError(false);
    setError(null);
    
    // Focus the textarea after suggesting a topic
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Resize will be handled by the useEffect
    }
  };

  // Update the waveform visualization to use real waveform data
  const getBarHeight = (value: number) => {
    // More sensitive scaling for better visual feedback
    const minHeight = 20;
    const maxHeight = 65;
    const normalizedValue = value / 255;
    // Use a non-linear scale to make small sounds more visible
    const scaledValue = Math.pow(normalizedValue, 0.25); 
    return Math.max(minHeight, Math.min(maxHeight, minHeight + (scaledValue * (maxHeight - minHeight))));
  };

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl shadow-xl border border-gray-700">
      <div className="flex flex-col gap-1 mb-1">
        <h2 className="text-lg font-semibold text-white">
          Molecular Structure Visualization
        </h2>
        <p className="text-gray-400 text-xs sm:text-sm">
          Enter a molecular topic or structure to generate an interactive 3D visualization.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={currentPrompt}
              onChange={(e) => {
                onPromptChange(e.target.value);
                // Resize will be handled by the useEffect
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isLoading && currentPrompt.trim()) {
                    handleSubmit(e);
                  }
                }
              }}
              placeholder="Enter your prompt about molecular structures..."
              className="w-full min-h-[7rem] py-4 px-4 pb-20 text-gray-100 bg-gray-700/50 rounded-lg
                         border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30
                         placeholder-gray-500 transition-all duration-200 ease-in-out
                         hover:border-gray-500 overflow-hidden leading-relaxed"
              style={{ resize: 'none' }}
              rows={1}
              disabled={isLoading}
              maxLength={500}
              aria-label="Molecular structure prompt input"
            />
            
            {/* Buttons inside the input field at the bottom*/}
            <div className="absolute inset-x-0 bottom-0 min-h-[3.5rem] px-3 flex items-center justify-end gap-2">
              {/* Container for all interactive elements with proper positioning */}
              <div className="relative flex items-center gap-2 min-h-[3.5rem] w-full">
                
                {/* Audio recording visualization */}
                {audioState.isRecording && (
                  <div className="absolute right-0 flex items-center h-8 
                               bg-blue-500/20 border border-blue-500/30 rounded-full px-6 audio-recording
                               transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
                    {/* Animated audio waveform visualization */}
                    <div className="flex items-center justify-center gap-[3px] h-full min-w-[60px]">
                      {audioData ? (
                        // Render bars based on actual audio data
                        Array.from({ length: 10 }).map((_, i) => {
                          const value = audioData[i % 8] || 0;
                          return (
                            <div 
                              key={i}
                              className="w-[3px] bg-blue-400 rounded-full audio-bar"
                              style={{
                                height: `${getBarHeight(value)}%`,
                                transform: `scaleY(${1 + (value / 512)})`,
                                opacity: 0.7 + (value / 512),
                                backgroundColor: value > 150 ? '#3b82f6' : '#60a5fa'
                              }}
                            />
                          );
                        })
                      ) : (
                        // Fallback animated bars while initializing
                        Array.from({ length: 10 }).map((_, i) => (
                          <div 
                            key={i}
                            className="w-[3px] bg-blue-400 rounded-full animate-[audio-wave_1s_ease-in-out_infinite_alternate]"
                            style={{ 
                              height: '35%',
                              animationDelay: `${i * 0.05}s` 
                            }}
                          />
                        ))
                      )}
                    </div>
                    
                    {/* Check and X buttons */}
                    <div className="flex items-center gap-1 ml-2">
                      {/* Check button to stop and submit */}
                      <button
                        type="button"
                        onClick={() => {
                          console.log('Checkmark button clicked');
                          if (mediaRecorderRef.current && audioState.isRecording) {
                            console.log('Stopping recording and flagging for transcription');
                            setAudioState(prev => ({
                              ...prev,
                              pendingTranscription: true
                            }));
                            setTimeout(() => {
                              mediaRecorderRef.current?.stop();
                            }, 0);
                          }
                        }}
                        className="h-6 w-6 flex items-center justify-center rounded-full 
                                  bg-blue-500/50 hover:bg-blue-500/70 text-white transition-all duration-200"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      
                      {/* X button to cancel */}
                      <button
                        type="button"
                        onClick={cancelRecording}
                        className="h-6 w-6 flex items-center justify-center rounded-full 
                                  bg-blue-500/30 hover:bg-blue-500/50 text-white transition-all duration-200"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Container for all right-aligned controls */}
                <div className="flex items-center gap-2 ml-auto">
                  {/* Right-aligned controls container */}
                  <div className={`flex items-center gap-2 ${currentPrompt.trim() ? 'mr-0' : '-mr-2'} transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                                ${!audioState.isRecording ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'}`}>
                    
                    {/* Suggest button */}
                    <div 
                      className="relative flex items-center justify-center"
                      onMouseEnter={() => setIsSuggestHovered(true)}
                      onMouseLeave={() => setIsSuggestHovered(false)}
                    >
                      <button
                        type="button"
                        onClick={handleSuggestTopic}
                        className={`transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center justify-center
                                  h-8 rounded-md bg-transparent hover:bg-gray-600/40 text-blue-400
                                  focus:outline-none focus:ring-1 focus:ring-blue-500/50
                                  ${isSuggestHovered ? 'px-3' : 'px-1.5'}`}
                        aria-label="Suggest molecule"
                        disabled={isLoading}
                      >
                        <div className="flex items-center">
                          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0">
                            <path d="M10 16.584V18.9996C10 20.1042 10.8954 20.9996 12 20.9996C13.1046 20.9996 14 20.1042 14 18.9996L14 16.584M12 3V4M18.3643 5.63574L17.6572 6.34285M5.63574 5.63574L6.34285 6.34285M4 12H3M21 12H20M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <div 
                            className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                                      ${isSuggestHovered ? 'w-16 opacity-100 ml-2' : 'w-0 opacity-0 ml-0'}`}
                          >
                            <span className="whitespace-nowrap font-medium">Suggest</span>
                          </div>
                        </div>
                      </button>
                    </div>
                    
                    {/* Microphone button - only show when not recording or processing */}
                    {!audioState.isProcessing && (
                      <button
                        type="button"
                        onClick={toggleRecording}
                        className="h-8 w-8 flex items-center justify-center rounded-md 
                                  bg-transparent hover:bg-gray-600/40 text-gray-400
                                  transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                        aria-label="Start voice input"
                      >
                        <MicrophoneIcon className="w-5 h-5" />
                      </button>
                    )}
                    
                    {/* Processing indicator - shows during transcription */}
                    {audioState.isProcessing && (
                      <div className="h-8 w-8 flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  {/* Enter Button - with transform-based animation */}
                  <div className={`flex items-center transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                                ${currentPrompt.trim() && !isLoading && !audioState.isRecording
                                  ? 'w-8 opacity-100 transform translate-x-0 scale-100' 
                                  : 'w-0 opacity-0 transform -translate-x-1 scale-90'}`}>
                    <button
                      type="submit"
                      className="h-8 w-8 flex items-center justify-center rounded-md bg-blue-500 hover:bg-blue-400 
                               text-white transition-colors duration-200"
                      aria-label="Generate visualization"
                      disabled={!currentPrompt.trim() || isLoading || audioState.isRecording}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 20V4M12 4L6 10M12 4L18 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-2 text-blue-400 text-sm">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Generating visualization...</span>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className={`transform transition-all duration-200 ease-in-out
                           ${isScientificError ? 'bg-yellow-500/10' : 'bg-red-500/10'} 
                           rounded-lg p-3`}>
              <div className={`text-xs sm:text-sm ${isScientificError ? 'text-yellow-400' : 'text-red-400'} 
                             flex items-start gap-2`}>
                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="break-words">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Download button - only shows when visualization is available */}
        {(currentScript || currentHtml) && !isLoading && (() => {
          const isMobile = typeof navigator !== 'undefined'
            && /android|iphone|ipad|mobile/i.test(navigator.userAgent.toLowerCase());

          if (isMobile) return null;

          if (currentScript && !currentHtml) {
            return (
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (!currentScript || !title) {
                      throw new Error('No molecule data to generate HTML');
                    }
                    setIsLoading(true);
                    onLoadingChange(true);

                    const moleculeData = {
                      pdb_data: currentScript,
                      name: title
                    };
                    const resp = await generateMoleculeHTML(moleculeData);
                    const html = resp.html;

                    setCurrentHtml(html);
                    onVisualizationUpdate(currentScript, html, title);
                    setIsLoading(false);
                    onLoadingChange(false);
                  } catch (err: any) {
                    setIsLoading(false);
                    onLoadingChange(false);
                    setError(err.message || 'Failed to generate presentation');
                  }
                }}
                className="self-end flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                           bg-gradient-to-r from-blue-600 to-blue-500
                           hover:from-blue-500 hover:to-blue-400
                           text-white text-sm font-medium shadow-md shadow-blue-500/20
                           transition-all duration-200 ease-in-out
                           focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                Generate Presentation
              </button>
            );
          }

          if (currentHtml) {
            return (
              <button
                type="button"
                onClick={handleDownload}
                className="self-end flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                           bg-gradient-to-r from-green-600 to-green-500
                           hover:from-green-500 hover:to-green-400
                           text-white text-sm font-medium shadow-md shadow-green-500/20
                           transition-all duration-200 ease-in-out
                           focus:outline-none focus:ring-2 focus:ring-green-500/50"
                aria-label="Download visualization"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                <span>Download</span>
              </button>
            );
          }

          return null;
        })()}

        {/* Processing indicator */}
        {audioState.isProcessing && (
          <div className="flex items-center gap-2 text-blue-500 mt-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Converting speech to text...</span>
          </div>
        )}
      </form>
    </div>
  );
};