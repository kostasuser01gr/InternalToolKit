"use client";

import { Mic, MicOff } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { features } from "@/lib/constants/features";

type VoiceInputProps = {
  id: string;
  name: string;
  placeholder?: string;
  rows?: number;
  defaultValue?: string;
  transcriptFieldName?: string;
};

type SpeechRecognitionWithFallback = {
  start: () => void;
  stop: () => void;
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionWithFallback;
    SpeechRecognition?: new () => SpeechRecognitionWithFallback;
  }

  interface SpeechRecognitionEvent {
    results: {
      [index: number]: {
        [index: number]: {
          transcript: string;
        };
      };
      length: number;
    };
  }
}

function getRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function VoiceInput({
  id,
  name,
  placeholder,
  rows = 3,
  defaultValue = "",
  transcriptFieldName,
}: VoiceInputProps) {
  const speechEnabled = features.voiceInput;
  const [value, setValue] = useState(defaultValue);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionWithFallback | null>(null);

  const canUseSpeech = useMemo(
    () => speechEnabled && Boolean(getRecognitionConstructor()),
    [speechEnabled],
  );

  function stopRecording() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  function startRecording() {
    const RecognitionCtor = getRecognitionConstructor();

    if (!RecognitionCtor) {
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = "el-GR";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const latestResult = event.results[event.results.length - 1];
      const transcript = latestResult?.[0]?.transcript?.trim() ?? "";
      if (!transcript) {
        return;
      }

      setVoiceTranscript((prev) => `${prev} ${transcript}`.trim());
      setValue((prev) => `${prev} ${transcript}`.trim());
    };

    recognition.onerror = () => {
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = recognition;
    setRecording(true);
    recognition.start();
  }

  return (
    <div className="space-y-2">
      <Textarea
        id={id}
        name={name}
        rows={rows}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
      />

      {transcriptFieldName ? (
        <input
          type="hidden"
          name={transcriptFieldName}
          value={voiceTranscript}
        />
      ) : null}

      {canUseSpeech ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={recording ? stopRecording : startRecording}
        >
          {recording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          {recording ? "Stop voice input" : "Start voice input"}
        </Button>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">
          Voice input is disabled. Enable `NEXT_PUBLIC_FEATURE_VOICE_INPUT=1` to use Web Speech API.
        </p>
      )}
    </div>
  );
}
