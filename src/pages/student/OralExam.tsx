import { useState, useRef, useEffect, useCallback } from "react";
import { uploadOralSubmission } from "../../lib/oralExamSubmissions";

type Phase = "instructions" | "question" | "recording" | "preview" | "uploading" | "submitted";

const ORAL_QUESTIONS = [
  {
    id: 1,
    subject: "Sanskrit",
    question: "पाणिनि के अष्टाध्यायी की संरचना एवं महत्व पर अपने विचार प्रस्तुत करें।",
    english: "Describe the structure and importance of Panini's Ashtadhyayi in Sanskrit grammar.",
    maxDuration: 300, // seconds
    prepTime: 60,
  },
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function OralExam() {
  const [submittedStudent, setSubmittedStudent] = useState<{ registrationNumber: string; fullName: string } | null>(null);
  const [phase, setPhase] = useState<Phase>("instructions");
  const [questionIdx] = useState(0);
  const [prepCountdown, setPrepCountdown] = useState(0);
  const [recordCountdown, setRecordCountdown] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const q = ORAL_QUESTIONS[questionIdx];

  /* ── Camera setup ── */
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
      }
      setCameraActive(true);
      setMicActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setCameraError("Camera / microphone permission denied. Please allow access in your browser settings and reload.");
      } else if (msg.includes("NotFound") || msg.includes("Devices")) {
        setCameraError("No camera or microphone found. Please connect a device and try again.");
      } else {
        setCameraError("Could not access camera: " + msg);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    setMicActive(false);
  }, []);

  useEffect(() => () => { stopCamera(); if (timerRef.current) clearInterval(timerRef.current); }, [stopCamera]);

  /* ── Prep timer → then auto-start recording ── */
  const startPrep = useCallback(() => {
    setPhase("question");
    setPrepCountdown(q.prepTime);
    timerRef.current = setInterval(() => {
      setPrepCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          startRecording();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, [q.prepTime]);

  /* ── Recording ── */
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const options = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? { mimeType: "video/webm;codecs=vp9,opus" }
      : MediaRecorder.isTypeSupported("video/webm")
      ? { mimeType: "video/webm" }
      : {};
    const recorder = new MediaRecorder(streamRef.current, options);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
      stopCamera();
      setPhase("preview");
    };
    recorder.start(500);
    recorderRef.current = recorder;
    setRecordCountdown(q.maxDuration);
    setPhase("recording");

    timerRef.current = setInterval(() => {
      setRecordCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          stopRecording();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, [q.maxDuration, stopCamera]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  }, []);

  /* ── Upload to private storage ── */
  const submitVideo = useCallback(async () => {
    if (!recordedBlob) return;
    setPhase("uploading");
    setUploadProgress(0);
    setUploadError(null);
    try {
      const savedSubmission = await uploadOralSubmission({
        blob: recordedBlob,
        subject: q.subject,
        question: q.english,
      });
      setSubmittedStudent({ registrationNumber: savedSubmission.registration_number, fullName: savedSubmission.student_name });
      setUploadProgress(100);
      setPhase("submitted");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Video upload failed. Please try again.");
      setPhase("preview");
      setUploadProgress(0);
    }
  }, [recordedBlob, q.subject, q.english]);

  const retake = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setPhase("instructions");
    setCameraActive(false);
  }, [recordedUrl]);

  /* ── Phases ── */

  if (phase === "submitted") {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 style={{ fontFamily: "var(--font-display)" }} className="text-2xl font-bold text-brown">Oral Examination</h1>
        <div className="bg-cream border-2 border-gold/30 rounded-2xl p-10 text-center shadow-sm">
          <div className="text-6xl mb-4">🎉</div>
          <h2 style={{ fontFamily: "var(--font-display)" }} className="text-2xl font-bold text-maroon mb-2">Video Submitted!</h2>
          <p className="text-brown-mid text-sm mb-6 leading-relaxed">
            Your oral examination video has been uploaded to private storage and is pending evaluation by our examiners.
            You will be notified once evaluation is complete.
          </p>
          <div className="bg-cream-dark rounded-xl p-5 text-left text-sm space-y-2.5 mb-6 max-w-sm mx-auto">
            {[
              ["Registration No.", submittedStudent?.registrationNumber ?? "—"],
              ["Submitted At", new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })],
              ["File Size", recordedBlob ? `${(recordedBlob.size / 1024 / 1024).toFixed(2)} MB` : "—"],
              ["Evaluation Status", "Pending Review"],
              ["Expected Result", "25 October 2026"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <span className="text-brown-mid">{k}</span>
                <span className="font-semibold text-brown">{v}</span>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mb-6 text-left">
                🔒 Your video is stored in private storage. Only signed-in accounts authorized by the database policies can access it.
          </div>
          <button
            onClick={() => window.history.back()}
            className="px-8 py-3 bg-maroon text-cream rounded-xl font-semibold text-sm hover:bg-maroon-dark transition-colors"
          >
            Return to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  if (phase === "uploading") {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 style={{ fontFamily: "var(--font-display)" }} className="text-2xl font-bold text-brown">Oral Examination</h1>
        <div className="bg-cream border border-cream-dark rounded-2xl p-10 text-center shadow-sm">
          <div className="text-5xl mb-6">📤</div>
          <h2 style={{ fontFamily: "var(--font-display)" }} className="text-xl font-bold text-brown mb-2">Uploading Your Video…</h2>
          <p className="text-brown-mid text-sm mb-8">Please do not close or navigate away from this page.</p>
          <div className="max-w-sm mx-auto">
            <div className="flex justify-between text-xs text-brown-mid mb-2">
              <span>Upload Progress</span>
              <span className="font-semibold text-maroon">{uploadProgress}%</span>
            </div>
            <div className="h-3 bg-cream-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-maroon to-saffron rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="mt-3 text-xs text-brown-light">
              {uploadProgress < 30 && "Preparing upload…"}
              {uploadProgress >= 30 && uploadProgress < 70 && "Uploading to secure server…"}
              {uploadProgress >= 70 && uploadProgress < 100 && "Finalizing…"}
              {uploadProgress === 100 && "Upload complete ✓"}
            </div>
          </div>
          {recordedBlob && (
            <p className="text-xs text-brown-mid mt-6">
              File size: {(recordedBlob.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </div>
      </div>
    );
  }

  if (phase === "preview") {
    const sizeMB = recordedBlob ? (recordedBlob.size / 1024 / 1024).toFixed(2) : "—";
    return (
      <div className="space-y-6 max-w-3xl">
        <h1 style={{ fontFamily: "var(--font-display)" }} className="text-2xl font-bold text-brown">Review Your Response</h1>
        {uploadError && <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl p-4">{uploadError}</p>}

        <div className="bg-cream border border-cream-dark rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-maroon/5 border-b border-cream-dark px-6 py-4">
            <p className="text-xs text-brown-mid font-semibold uppercase tracking-wide mb-1">Question</p>
            <p className="text-brown font-medium">{q.question}</p>
            <p className="text-xs text-brown-mid mt-1 italic">{q.english}</p>
          </div>

          {/* Playback */}
          <div className="bg-black aspect-video relative">
            {recordedUrl ? (
              <video
                ref={playbackRef}
                src={recordedUrl}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-white/40 text-sm">No recording</div>
            )}
          </div>

          <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-4 text-sm text-brown-mid">
              <span>📁 Size: <strong className="text-brown">{sizeMB} MB</strong></span>
              <span>🎬 Format: <strong className="text-brown">WebM</strong></span>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={retake}
                className="px-5 py-2.5 border-2 border-maroon text-maroon rounded-lg font-semibold text-sm hover:bg-maroon/5 transition-colors"
              >
                🔄 Retake Video
              </button>
              <button
                onClick={submitVideo}
                className="px-6 py-2.5 bg-maroon text-cream rounded-lg font-semibold text-sm hover:bg-maroon-dark transition-colors shadow-md"
              >
                Submit Response →
              </button>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>⚠️ Before submitting:</strong> Review your response in the player above. Once submitted, you cannot re-record.
          Make sure your audio and video are clear and your response addresses the question fully.
        </div>
      </div>
    );
  }

  /* ── Instructions / Question / Recording phases share the camera UI ── */
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 style={{ fontFamily: "var(--font-display)" }} className="text-2xl font-bold text-brown">Oral Examination</h1>
        <span className="text-xs bg-maroon/10 text-maroon px-3 py-1 rounded-full font-semibold">
          {phase === "recording" ? "🔴 Recording" : phase === "question" ? "📋 Preparation" : "📋 Instructions"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Camera + controls */}
        <div className="lg:col-span-3 space-y-4">
          {/* Video preview */}
          <div className="bg-black rounded-2xl overflow-hidden aspect-video relative shadow-xl">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90">
                {cameraError ? (
                  <div className="text-center px-6">
                    <div className="text-3xl mb-3">⚠️</div>
                    <p className="text-red-400 text-sm leading-relaxed">{cameraError}</p>
                    <button onClick={startCamera} className="mt-4 px-4 py-2 bg-maroon text-cream rounded-lg text-sm font-semibold">
                      Try Again
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-4xl">📷</div>
                    <p className="text-white/60 text-sm text-center px-4">Camera preview will appear here.<br />Click "Enable Camera" to begin.</p>
                  </>
                )}
              </div>
            )}

            {/* Recording overlay */}
            {phase === "recording" && (
              <>
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  REC
                </div>
                <div className="absolute top-4 right-4 bg-black/60 text-white text-sm font-mono px-3 py-1 rounded-lg">
                  {formatTime(recordCountdown)}
                </div>
              </>
            )}

            {/* Prep overlay */}
            {phase === "question" && prepCountdown > 0 && (
              <div className="absolute top-4 right-4 bg-saffron text-white text-sm font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                ⏱ Prep: {formatTime(prepCountdown)}
              </div>
            )}

            {/* Camera / mic status */}
            {cameraActive && (
              <div className="absolute bottom-4 left-4 flex gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cameraActive ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                  📷 {cameraActive ? "On" : "Off"}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${micActive ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                  🎤 {micActive ? "On" : "Off"}
                </span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-3 flex-wrap">
            {phase === "instructions" && !cameraActive && (
              <button
                onClick={startCamera}
                className="flex-1 bg-maroon text-cream py-3 rounded-xl font-semibold text-sm hover:bg-maroon-dark transition-colors"
              >
                📷 Enable Camera & Microphone
              </button>
            )}
            {phase === "instructions" && cameraActive && (
              <button
                onClick={startPrep}
                className="flex-1 bg-saffron text-cream py-3 rounded-xl font-semibold text-sm hover:bg-saffron-light transition-colors"
              >
                📋 Ready — Start Preparation Time →
              </button>
            )}
            {phase === "question" && (
              <button
                onClick={() => {
                  if (timerRef.current) clearInterval(timerRef.current);
                  startRecording();
                }}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors"
              >
                🔴 Start Recording Now
              </button>
            )}
            {phase === "recording" && (
              <button
                onClick={stopRecording}
                className="flex-1 bg-cream border-2 border-red-500 text-red-600 py-3 rounded-xl font-semibold text-sm hover:bg-red-50 transition-colors"
              >
                ⏹ Stop Recording
              </button>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Question */}
          <div className="bg-cream border border-cream-dark rounded-xl p-5">
            <p className="text-xs text-brown-mid font-semibold uppercase tracking-wide mb-2">
              Question {questionIdx + 1} of {ORAL_QUESTIONS.length}
            </p>
            <p className="text-brown font-semibold leading-relaxed mb-2">{q.question}</p>
            <p className="text-xs text-brown-mid italic border-t border-cream-dark pt-2 mt-2">{q.english}</p>
            <div className="flex gap-3 mt-3 text-xs">
              <span className="bg-maroon/10 text-maroon px-2 py-0.5 rounded-full font-semibold">{q.subject}</span>
              <span className="bg-cream-dark text-brown-mid px-2 py-0.5 rounded-full">Max {formatTime(q.maxDuration)}</span>
              <span className="bg-cream-dark text-brown-mid px-2 py-0.5 rounded-full">Prep {formatTime(q.prepTime)}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-cream border border-cream-dark rounded-xl p-5">
            <p className="text-xs font-semibold text-brown-mid uppercase tracking-wide mb-3">Process</p>
            <div className="space-y-3">
              {[
                { step: "Enable camera & mic", done: cameraActive, current: !cameraActive && phase === "instructions" },
                { step: `Preparation (${formatTime(q.prepTime)})`, done: phase === "recording", current: phase === "question" },
                { step: `Record response (max ${formatTime(q.maxDuration)})`, done: false, current: phase === "recording" },
                { step: "Preview & submit", done: false, current: false },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    s.done ? "bg-green-500 text-white" :
                    s.current ? "bg-saffron text-white ring-2 ring-saffron/30" :
                    "bg-cream-dark text-brown-light"
                  }`}>
                    {s.done ? "✓" : i + 1}
                  </div>
                  <span className={s.done ? "text-green-700" : s.current ? "text-brown font-semibold" : "text-brown-light"}>
                    {s.step}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          {phase === "instructions" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-2">
              <p className="font-semibold">📋 Instructions</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Ensure good lighting and quiet environment.</li>
                <li>Speak clearly towards the microphone.</li>
                <li>You have {formatTime(q.prepTime)} preparation time before recording starts.</li>
                <li>Maximum recording length: {formatTime(q.maxDuration)}.</li>
                <li>You may retake once before final submission.</li>
                <li>Do not close this tab during recording or upload.</li>
              </ul>
            </div>
          )}

          {/* Recording info */}
          {phase === "recording" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 space-y-1">
              <p className="font-semibold">🔴 Recording in Progress</p>
              <p>Time remaining: <strong>{formatTime(recordCountdown)}</strong></p>
              <p>Recording will stop automatically when time runs out.</p>
            </div>
          )}

          {/* Security notice */}
          <div className="bg-cream-dark rounded-xl p-4 text-xs text-brown-mid">
            🔒 <strong>Privacy:</strong> Your video is encrypted and stored on a private server. Only authorized examiners can access it for evaluation purposes.
          </div>
        </div>
      </div>
    </div>
  );
}
