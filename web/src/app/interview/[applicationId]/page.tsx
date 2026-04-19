"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

interface InterviewQuestion {
  id: string;
  text: string;
  isFollowup?: boolean;
  category:
    | "communication"
    | "problem_understanding"
    | "relevance_to_role"
    | "motivation_interest"
    | "practical_knowledge";
}

interface InterviewMeta {
  applicationId: string;
  jobId: string;
  languageCode: string;
  mode: "manual" | "auto";
  allowAiFollowups: boolean;
  maxDurationMinutes: number;
  maxQuestions: number;
  questions: InterviewQuestion[];
}

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export default function InterviewPage() {
  const params = useParams<{ applicationId: string }>();
  const router = useRouter();
  const applicationId = params.applicationId;

  const [meta, setMeta] = useState<InterviewMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [answerDraft, setAnswerDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [scoresJson, setScoresJson] = useState<any | null>(null);
  const [listening, setListening] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [addingFollowup, setAddingFollowup] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [hasRecordedAudio, setHasRecordedAudio] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const speakQuestion = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = meta?.languageCode || "en-US";
    utter.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const startVoiceCapture = () => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setRuntimeError("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = meta?.languageCode || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalText = "";
    setListening(true);

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += `${transcript} `;
        } else {
          interim += transcript;
        }
      }
      setAnswerDraft(`${finalText}${interim}`.trim());
    };

    recognition.onerror = () => {
      setRuntimeError("Voice capture failed. You can still type your answer.");
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  const stopActiveMediaStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  const clearRecordedAudio = () => {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setRecordedAudioUrl(null);
    setHasRecordedAudio(false);
  };

  const startAudioRecording = async () => {
    try {
      setRuntimeError(null);
      if (!navigator?.mediaDevices?.getUserMedia) {
        setRuntimeError("Audio recording is not supported in this browser.");
        return;
      }

      clearRecordedAudio();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setRuntimeError("Audio recording failed. You can still type your answer.");
        setIsRecording(false);
        stopActiveMediaStream();
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          setRecordedAudioUrl(url);
          setHasRecordedAudio(true);
        }
        setIsRecording(false);
        stopActiveMediaStream();
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setRuntimeError("Microphone permission denied or unavailable. You can still type your answer.");
      setIsRecording(false);
      stopActiveMediaStream();
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        setRuntimeError(null);
        let res: { data: InterviewMeta } | null = null;
        let lastErr: any = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            res = await axios.get<InterviewMeta>(
              `${API_BASE_URL}/api/applications/${applicationId}/interview-questions`,
              { withCredentials: true, timeout: 20000 },
            );
            break;
          } catch (err: any) {
            lastErr = err;
            if (attempt < 2) {
              await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
            }
          }
        }

        if (!res) {
          throw lastErr;
        }

        setMeta(res.data);
        setQuestions(res.data.questions || []);
        setRemainingSeconds((res.data.maxDurationMinutes || 10) * 60);
      } catch (err: any) {
        const message = err.response?.data?.error ?? "Failed to load interview. Please retry in a few seconds.";
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    };

    if (applicationId) {
      void fetchQuestions();
    }
  }, [applicationId]);

  const currentQuestion = questions[currentIndex];

  const finishInterview = async () => {
    if (!meta) return;
    try {
      const scoreRes = await axios.post(
        `${API_BASE_URL}/api/applications/${meta.applicationId}/interview/score`,
        {},
        { withCredentials: true },
      );
      setScoresJson(scoreRes.data);
      setCompleted(true);
    } catch (err: any) {
      const message = err.response?.data?.error ?? "Failed to score interview";
      setRuntimeError(message);
    }
  };

  useEffect(() => {
    if (!meta || completed || remainingSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [meta, completed, remainingSeconds]);

  useEffect(() => {
    if (!meta || completed) return;
    if (remainingSeconds === 0) {
      void finishInterview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, completed, meta]);

  useEffect(() => {
    if (currentQuestion?.text) {
      speakQuestion(currentQuestion.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, currentQuestion?.text]);

  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
      stopActiveMediaStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordedAudioUrl]);

  const onSubmitAnswer = async (e: FormEvent) => {
    e.preventDefault();
    if (!meta || !currentQuestion) return;
    const transcript = answerDraft.trim();
    const transcriptForStorage = transcript || (hasRecordedAudio ? "Audio response submitted by candidate." : "");

    if (!transcriptForStorage) {
      setRuntimeError("Please type your answer or record audio before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      setRuntimeError(null);

      await axios.post(
        `${API_BASE_URL}/api/applications/${meta.applicationId}/interview/answer-text`,
        {
          questionId: currentQuestion.id,
          questionText: currentQuestion.text,
          transcript: transcriptForStorage,
          languageCode: meta.languageCode,
        },
        { withCredentials: true },
      );

      let followupInserted = false;

      if (
        meta.allowAiFollowups &&
        !currentQuestion.isFollowup &&
        transcript.length > 0 &&
        transcript.split(/\s+/).length < 35 &&
        questions.length < meta.maxQuestions
      ) {
        try {
          setAddingFollowup(true);
          const followupRes = await axios.post(
            `${API_BASE_URL}/api/applications/${meta.applicationId}/interview/followup-question`,
            {
              questionText: currentQuestion.text,
              answerTranscript: transcript,
              category: currentQuestion.category,
              languageCode: meta.languageCode,
            },
            { withCredentials: true },
          );

          const fq = followupRes.data?.followup as InterviewQuestion | undefined;
          if (fq?.text) {
            const followupQuestion: InterviewQuestion = {
              ...fq,
              isFollowup: true,
            };

            setQuestions((prev) => {
              const next = [...prev];
              next.splice(currentIndex + 1, 0, followupQuestion);
              return next.slice(0, meta.maxQuestions);
            });
            followupInserted = true;
          }
        } catch {
          // Follow-up generation is best effort.
        } finally {
          setAddingFollowup(false);
        }
      }

      setAnswerDraft("");
      clearRecordedAudio();

      if (followupInserted) {
        setCurrentIndex((idx) => idx + 1);
        return;
      }

      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((idx) => idx + 1);
      } else {
        await finishInterview();
      }
    } catch (err: any) {
      const message = err.response?.data?.error ?? "Failed to save answer";
      setRuntimeError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-200">
        <p className="text-base">Preparing your interview…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-200">
        <div className="max-w-md rounded-xl border border-red-500/40 bg-red-950/40 px-6 py-5 text-base">
          <p className="font-semibold text-red-200">Interview unavailable</p>
          <p className="mt-1 text-sm text-red-100">{loadError}</p>
          <button
            type="button"
            onClick={() => router.push("/candidate")}
            className="mt-3 rounded-md border border-red-300/50 px-3 py-1 text-xs text-red-100 hover:bg-red-900/30"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!meta || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-200">
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 px-6 py-5 text-center">
          <p className="text-base">No interview questions configured for this application.</p>
          <button
            type="button"
            onClick={() => router.push("/candidate")}
            className="mt-3 rounded-md border border-zinc-600 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (completed && scoresJson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-50 px-4 py-10">
        <div className="w-full max-w-xl space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-6 py-5">
          <h1 className="text-xl font-semibold">Thank you for completing the interview</h1>
          <p className="text-base text-zinc-300">
            Your answers have been recorded and will be reviewed by the hiring team.
          </p>
          <div className="mt-2 space-y-2 text-base">
            <p className="text-sm font-medium text-zinc-400">AI interview summary (visible to recruiters)</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <ScorePill label="Communication" value={scoresJson.communicationClarity} />
              <ScorePill label="Problem understanding" value={scoresJson.problemUnderstanding} />
              <ScorePill label="Relevance to role" value={scoresJson.relevanceToRole} />
              <ScorePill label="Motivation / interest" value={scoresJson.motivationInterest} />
              <ScorePill label="Practical knowledge" value={scoresJson.practicalKnowledge} />
              <ScorePill label="Overall" value={scoresJson.overall} />
            </div>
            {scoresJson.explanation && (
              <p className="mt-2 text-sm leading-6 text-zinc-300">{scoresJson.explanation}</p>
            )}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => router.push("/candidate")}
                className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700"
              >
                Back to dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const total = questions.length;
  const step = currentIndex + 1;
  const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  const ss = String(remainingSeconds % 60).padStart(2, "0");

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-50 px-4 py-10">
      <div className="w-full max-w-xl space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-6 py-5">
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>
            Question {step} of {total}
          </span>
          <div className="flex items-center gap-3">
            <span>Time left: {mm}:{ss}</span>
            <button
              type="button"
              onClick={() => router.push("/candidate")}
              className="rounded-md border border-zinc-600 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800"
            >
              Dashboard
            </button>
          </div>
        </div>
        <div className="text-xs text-zinc-500">
          Language: {meta.languageCode} • Max questions: {meta.maxQuestions} • Target duration: {meta.maxDurationMinutes} min
        </div>

        {runtimeError && (
          <div className="rounded-md border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
            {runtimeError}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            AI interviewer question
          </p>
          <p className="text-base font-medium text-zinc-50">{currentQuestion.text}</p>
          <p className="text-sm text-zinc-400">
            The AI asks this question with voice. You can type or use voice capture for your answer.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => speakQuestion(currentQuestion.text)}
              className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:border-zinc-500"
            >
              Replay question audio
            </button>
            <button
              type="button"
              onClick={startVoiceCapture}
              className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:border-zinc-500"
              disabled={listening}
            >
              {listening ? "Listening..." : "Speak answer"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (isRecording) {
                  stopAudioRecording();
                } else {
                  void startAudioRecording();
                }
              }}
              className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:border-zinc-500"
            >
              {isRecording ? "Stop recording" : "Record audio"}
            </button>
            {hasRecordedAudio && (
              <button
                type="button"
                onClick={clearRecordedAudio}
                className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:border-zinc-500"
              >
                Remove audio
              </button>
            )}
          </div>
          {recordedAudioUrl && (
            <div className="pt-2">
              <audio controls src={recordedAudioUrl} className="w-full" />
            </div>
          )}
          <p className="text-[11px] text-zinc-500">
            You can record audio and also type. Typed answers give the best scoring quality when speech-to-text is unavailable.
          </p>
        </div>

        <form onSubmit={onSubmitAnswer} className="space-y-3 text-base">
          <textarea
            value={answerDraft}
            onChange={(e) => setAnswerDraft(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-zinc-50 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-600"
            placeholder="Type your answer here…"
          />
          {runtimeError && <p className="text-sm text-red-400">{runtimeError}</p>}
          <button
            type="submit"
            disabled={submitting || addingFollowup || remainingSeconds <= 0}
            className="inline-flex w-full items-center justify-center rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-60"
          >
            {submitting
              ? "Submitting…"
              : addingFollowup
                ? "Adding follow-up…"
                : step === total
                  ? "Submit and finish"
                  : "Submit and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
      <p className="text-[11px] text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-zinc-100">{Math.round(safe)}</p>
    </div>
  );
}
