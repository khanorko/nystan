import { useState, useCallback, useRef } from 'react';

interface UseAudioReturn {
  audioBlob: Blob | null;
  audioUrl: string | null;
  isRecording: boolean;
  recordingDuration: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  selectFromFile: () => Promise<void>;
  clearAudio: () => void;
  playAudio: () => void;
  stopAudio: () => void;
}

export function useAudio(): UseAudioReturn {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];
    setRecordingDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4',
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        const url = URL.createObjectURL(blob);

        setAudioBlob(blob);
        setAudioUrl(url);
        setIsRecording(false);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      // Update duration every second
      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Kunde inte starta inspelning'
      );
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  const selectFromFile = useCallback(async () => {
    setError(null);

    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';

      // Handle file selection
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          // Read the file as ArrayBuffer to create a proper blob
          const reader = new FileReader();
          reader.onload = () => {
            const arrayBuffer = reader.result as ArrayBuffer;
            const blob = new Blob([arrayBuffer], { type: file.type || 'audio/mpeg' });
            const url = URL.createObjectURL(blob);

            setAudioBlob(blob);
            setAudioUrl(url);
          };
          reader.onerror = () => {
            setError('Kunde inte läsa ljudfilen');
          };
          reader.readAsArrayBuffer(file);
        }
      };

      input.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte välja ljud');
    }
  }, []);

  const clearAudio = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
    setError(null);
  }, [audioUrl]);

  const playAudio = useCallback(() => {
    if (audioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
      }
      audioRef.current.play();
    }
  }, [audioUrl]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  return {
    audioBlob,
    audioUrl,
    isRecording,
    recordingDuration,
    error,
    startRecording,
    stopRecording,
    selectFromFile,
    clearAudio,
    playAudio,
    stopAudio,
  };
}
