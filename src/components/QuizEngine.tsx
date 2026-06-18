import React, { useState, useEffect, useRef } from "react";
import { Clock, HelpCircle, CheckCircle, XCircle, ArrowRight, ArrowLeft, Send, Home, BookOpen, ShieldAlert } from "lucide-react";
import { Quiz, Question } from "../types";
import { fetchQuestions, submitQuizAttempt } from "../lib/firebase";

interface QuizEngineProps {
  quiz: Quiz;
  onExit: () => void;
  onSubmitted?: () => void;
}

export default function QuizEngine({ quiz, onExit, onSubmitted }: QuizEngineProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({}); // { questionIdx: selectedOptionIdx }
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(quiz.timeLimit * 60); // minutes converted to seconds
  const [isTimeOut, setIsTimeOut] = useState(false);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Anti-cheating monitoring states
  const [tabExits, setTabExits] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [disqualified, setDisqualified] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastExitTimeRef = useRef<number>(0);

  // Auto-disqualify user when page-switch counts hit 3 exits
  const handleForceCheatingSubmit = async () => {
    if (isSubmitted || savingAttempt) return;
    try {
      setSavingAttempt(true);
      await submitQuizAttempt(quiz.id, `${quiz.title} (ถูกปรับ 0 คะแนนฐานทุจริต/ออกจากหน้าสอบเกิน 3 ครั้ง)`, 0, questions.length || 10);
      setScore(0);
      setIsSubmitted(true);
      setDisqualified(true);
      onSubmitted?.();
    } catch (error) {
      console.error("Force submit attempt failed:", error);
    } finally {
      setSavingAttempt(false);
    }
  };

  // Load Quiz Questions from Firestore on launch
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        const data = await fetchQuestions(quiz.id);
        
        // Secure Fisher-Yates shuffle helper
        const shuffleArray = <T,>(array: T[]): T[] => {
          const arr = [...array];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        };

        // Scramble both the questions list and their internal options list safely
        const scrambled = shuffleArray(data).map((q) => {
          const originalOptions = q.options || [];
          const indexedOptions = originalOptions.map((opt, index) => ({ opt, originalIdx: index }));
          const shuffledIndexed = shuffleArray(indexedOptions);
          
          return {
            ...q,
            options: shuffledIndexed.map(x => x.opt),
            correctIndex: shuffledIndexed.findIndex(x => x.originalIdx === q.correctIndex) !== -1 
              ? shuffledIndexed.findIndex(x => x.originalIdx === q.correctIndex) 
              : 0
          };
        });

        setQuestions(scrambled);
        if (quiz.timeLimit > 0) {
          setTimeLeft(quiz.timeLimit * 60);
        }
      } catch (err) {
        console.error("Error loading questions:", err);
      } finally {
        setLoading(false);
      }
    };
    loadQuestions();
  }, [quiz.id]);

  // Setup ticking countdown timer
  useEffect(() => {
    if (loading || isSubmitted || quiz.timeLimit <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setIsTimeOut(true);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, isSubmitted]);

  // Standard tab refresh prevention (warns the user, but does not auto-submit or penalize)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSubmitted && questions.length > 0) {
        e.preventDefault();
        e.returnValue = "คุณกำลังทดสอบข้อสอบอยู่ หากรีเฟรชหรือกดปิด หน้าเว็บบางส่วนของข้อสอบอาจสูญหาย";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isSubmitted, questions.length]);

  // Anti-cheating screen lock visibility detection / window blur
  useEffect(() => {
    if (loading || isSubmitted || disqualified || questions.length === 0) return;

    const handleVisibilityOrBlur = () => {
      const currentTime = Date.now();
      // Debounce signals triggered within 1.5 seconds of each other
      if (currentTime - lastExitTimeRef.current < 1500) return;
      lastExitTimeRef.current = currentTime;

      setTabExits((prevExits) => {
        const nextExits = prevExits + 1;
        if (nextExits >= 3) {
          handleForceCheatingSubmit();
          return nextExits;
        } else {
          setWarningMessage(
            `⚠️ ตรวจพบการเลิกโฟกัสหรือสลับออกนอกหน้าต่างแบบทดสอบ จำนวน ${nextExits} ครั้งสะสม! หากสลับออกจากห้องสอบครบ 3 ครั้ง ระบบความปลอดภัยจะปรับเป็น 0 คะแนน ฐานทุจริตทันที!`
          );
          setShowWarningModal(true);
          return nextExits;
        }
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleVisibilityOrBlur();
      }
    };

    const handleWindowBlur = () => {
      handleVisibilityOrBlur();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [loading, isSubmitted, disqualified, questions.length]);

  // Helper: Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
    const ss = (seconds % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const handleSelectOption = (idx: number) => {
    if (isSubmitted) return;
    setSelectedAnswers({
      ...selectedAnswers,
      [currentIdx]: idx
    });
  };

  // Triggers final scoring and sends transaction attempt record to database
  const submitExam = async (finalAnswers: Record<number, number>) => {
    if (isSubmitted || savingAttempt) return;
    try {
      setSubmissionError(null);
      setSavingAttempt(true);
      let calculatedScore = 0;
      questions.forEach((q, idx) => {
        if (finalAnswers[idx] === q.correctIndex) {
          calculatedScore += 1;
        }
      });

      // Save user score in firestore securely first, before successfully locking the submission state on-screen
      await submitQuizAttempt(quiz.id, quiz.title, calculatedScore, questions.length);
      
      setScore(calculatedScore);
      setIsSubmitted(true);
      onSubmitted?.();
    } catch (error: any) {
      console.error("Failed to submit exam attempt:", error);
      let displayError = "เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่ายความปลอดภัย โปรดลองส่งใหม่อีกครั้ง";
      try {
        if (error?.message) {
          const parsed = JSON.parse(error.message);
          if (parsed && parsed.error) {
            displayError = `ระบบฐานข้อมูลขัดข้อง: ${parsed.error}`;
          }
        }
      } catch (e) {
        if (error instanceof Error) {
          displayError = error.message;
        }
      }
      setSubmissionError(displayError);
    } finally {
      setSavingAttempt(false);
    }
  };

  const handleAutoSubmit = () => {
    submitExam(selectedAnswers);
  };

  const handleUserSubmit = () => {
    setShowSubmitModal(true);
  };

  const handleConfirmSubmit = () => {
    setShowSubmitModal(false);
    submitExam(selectedAnswers);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
        <div className="text-center">
          <p className="text-base font-semibold text-slate-800">กำลังจัดเตรียมชุดข้อสอบ...</p>
          <p className="text-xs text-slate-500">กรุณารอสักครู่ ระบบกำลังจัดเตรียมข้อมูล</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ShieldAlert className="h-14 w-14 text-rose-500 stroke-[1.2]" />
        <div>
          <h2 className="text-lg font-bold text-slate-900">ไม่พบข้อสอบในชุดนี้</h2>
          <p className="text-sm text-slate-500 mt-1">ผู้ดูแลระบบยังไม่ได้อัปโหลดข้อสอบในชุดทดสอบนี้</p>
        </div>
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
        >
          <Home className="h-4 w-4" /> กลับหน้าแรก
        </button>
      </div>
    );
  }

  // Active question details
  const activeQuestion = questions[currentIdx];
  const isSelected = selectedAnswers[currentIdx] !== undefined;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Quiz Dashboard / Session Info Bar */}
      {!isSubmitted && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 px-6 py-4 text-white shadow-md w-full">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-400" />
            <div>
              <h2 className="font-bold text-sm sm:text-base flex items-center gap-2 flex-wrap">
                <span>{quiz.title}</span>
                <span className="inline-flex items-center rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
                  Shuffle Mode Active
                </span>
              </h2>
              <p className="text-xxs text-slate-400">หมวดหมู่สอบวิชาปรนัย (ระบบสลับหัวข้อคำถามและช้อยส์คำตอบอัตโนมัติ)</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-300">ความก้าวหน้า:</span>
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold">
                {Object.keys(selectedAnswers).length} / {questions.length} ข้อ
              </span>
            </div>

            {quiz.timeLimit > 0 && (
              <div className="flex items-center gap-2 border-l border-slate-700 pl-6">
                <Clock className="h-4 w-4 text-indigo-400" />
                <span className={`font-mono text-sm font-bold ${timeLeft < 60 ? 'text-rose-400 animate-pulse' : 'text-slate-100'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}


          </div>
        </div>
      )}

      {/* Main Container */}
      {!isSubmitted ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* Questions Grid/Navigator (Sidebar) */}
          <div className="md:col-span-1 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4 order-last md:order-first">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-2">แผนผังข้อสอบ</h3>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((_, idx) => {
                const isCurrent = idx === currentIdx;
                const isAnswered = selectedAnswers[idx] !== undefined;

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-9 rounded-lg text-xs font-bold transition-all ${
                      isCurrent
                        ? "bg-indigo-600 text-white ring-2 ring-indigo-600 ring-offset-2"
                        : isAnswered
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-slate-400 leading-tight space-y-1 pt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-indigo-600 inline-block"></span>
                <span>กำลังทำข้อนี้</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-100 inline-block"></span>
                <span>ตอบแล้ว</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-slate-50 inline-block"></span>
                <span>ยังไม่ได้ตอบ</span>
              </div>
            </div>
          </div>

          {/* Active Question Box */}
          <div className="md:col-span-3 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="p-6 sm:p-8 space-y-6">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                  คำถามข้อที่ {currentIdx + 1}
                </span>
                <span className="text-xs text-slate-400">1 คะแนน</span>
              </div>

              {/* Title Question */}
              <h2 className="text-lg font-bold text-slate-900 leading-relaxed whitespace-pre-line">
                {activeQuestion.text}
              </h2>

              {/* Multiple Choice Items */}
              <div className="space-y-3.5">
                {activeQuestion.options.map((option, oIdx) => {
                  const isChecked = selectedAnswers[currentIdx] === oIdx;

                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleSelectOption(oIdx)}
                      className={`w-full text-left rounded-xl border px-5 py-4 text-sm font-medium transition-all duration-150 flex items-center justify-between gap-3 group cursor-pointer ${
                        isChecked
                          ? "border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-sm"
                          : "border-slate-100 hover:border-slate-300 hover:bg-slate-50/50 text-slate-700"
                      }`}
                      style={{ minHeight: "44px" }} // ensure touch targets are responsive
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all ${
                          isChecked
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-300 text-slate-500 group-hover:border-slate-400"
                        }`}>
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span className="leading-normal">{option}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {submissionError && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 flex items-start gap-2.5">
                  <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-rose-900">ไม่สามารถส่งข้อสอบไปยังเซิร์ฟเวอร์ได้</p>
                    <p className="text-xxs text-rose-700 leading-normal">{submissionError}</p>
                    <button
                      onClick={handleUserSubmit}
                      className="mt-2 inline-flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-rose-750 transition-colors cursor-pointer"
                    >
                      ลองกดส่งอีกครั้ง
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Nav Footer */}
            <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between gap-4">
              <button
                onClick={() => setCurrentIdx(currentIdx - 1)}
                disabled={currentIdx === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 select-none cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> ก่อนหน้า
              </button>

              {currentIdx < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIdx(currentIdx + 1)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm transition-all select-none cursor-pointer"
                >
                  ถัดไป <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleUserSubmit}
                  disabled={savingAttempt}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm transition-all select-none cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> {savingAttempt ? "กำลังบันทึก..." : "ส่งข้อสอบ"}
                </button>
              )}
            </div>

          </div>

        </div>
      ) : (
        /* ==================================================== */
        /*               SCORE / SUMMARIAL REPORT SCREEN        */
        /* ==================================================== */
        <div id="results-dashboard" className="space-y-8 animate-fade-in">
          
          {/* High Score Banner */}
          <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm text-center space-y-4 max-w-lg mx-auto">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Clock className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                {isTimeOut ? "หมดเวลาทำข้อสอบแล้ว!" : "เสร็จสิ้นการส่งข้อสอบ!"}
              </h2>
              <p className="text-xs text-slate-500 mt-1">ระบบได้ประเมินผลคะแนนของคุณและรวมคะแนนเรียลไทม์เรียบร้อยแล้ว</p>
            </div>

            {/* Real circular summary visual */}
            <div className="py-4">
              <div className="inline-block relative space-y-2">
                <div className={`text-5xl font-black ${disqualified ? 'text-rose-600' : 'text-indigo-600'}`}>
                  {disqualified ? 0 : score} <span className="text-lg text-slate-400">/ {questions.length}</span>
                </div>
                {!disqualified && (
                  <div className="mt-2">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                      เปอร์เซ็นต์คะแนน: {Math.round((score / (questions.length || 1)) * 100)}%
                    </span>
                  </div>
                )}
                <div className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-widest">
                  {disqualified ? "ถูกตัดสิทธิ์สอบสวน" : "คะแนนที่ได้รับ"}
                </div>
              </div>
            </div>

            {/* Performance descriptive text */}
            <div className="bg-slate-50 rounded-xl p-4 text-xs font-medium text-slate-600">
              {disqualified ? (
                <span className="text-rose-600 font-bold block">🚨 คุณได้รับ 0 คะแนน เนื่องจากระบบตรวจพบว่าคุณมุ่งเน้นหรือเลือกออกจากหน้าต่างทดสอบเกิน 3 ครั้ง (โหมดล็อกสอบสวนทุจริตมีเงื่อนไขสมบูรณ์เรียบร้อยแล้ว)</span>
              ) : score === questions.length ? (
                <span className="text-green-600 block">สุดยอดมาก! คุณทำคะแนนได้เต็ม 100%! ยินดีด้วย 🎉</span>
              ) : score >= questions.length * 0.8 ? (
                <span className="text-indigo-600 block">ทำผลงานได้ยอดเยี่ยมมาก! คุณผ่านเกณฑ์ยอดเยี่ยมอย่างน่าชื่นชม 🌟</span>
              ) : score >= questions.length * 0.5 ? (
                <span className="text-amber-600 block">ยินดีด้วย คุณผ่านเกณฑ์พื้นฐานมาได้อย่างปลอดภัย 👍</span>
              ) : (
                <span className="text-rose-600 block">ยังไม่ผ่านเกณฑ์ทดสอบ แนะนำให้อ่านหนังสือวิเคราะห์ข้อสอบเฉลยด้านล่างเพิ่มเติมนะ 📚</span>
              )}
            </div>

            <button
              onClick={onExit}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
            >
              <Home className="h-4 w-4" /> กลับหน้าแรก
            </button>
          </div>

          {/* Sub-detailed Solution Explanations (Red Team compliance pillar check) */}
          <div className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                เฉลยข้อสอบและสถิติการตอบของคุณ
              </h3>
              <p className="text-xs text-slate-500">ทบทวนข้อผิดพลาดเพื่อเตรียมความแข็งแกร่งในการสอบครั้งถัดไป</p>
            </div>

            {questions.map((q, idx) => {
              const uAnswer = selectedAnswers[idx];
              const isCorrect = uAnswer === q.correctIndex;

              return (
                <div key={idx} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                    <span className="text-xs font-bold text-slate-500">ข้อที่ {idx + 1}</span>
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <CheckCircle className="h-4 w-4" /> ถูกต้อง
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                        <XCircle className="h-4 w-4" /> ไม่ถูกต้อง
                      </span>
                    )}
                  </div>

                  <p className="font-bold text-slate-900 text-sm whitespace-pre-line leading-relaxed">{q.text}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {q.options.map((option, oIdx) => {
                      const isCorrectChoice = oIdx === q.correctIndex;
                      const isUserChoice = oIdx === uAnswer;

                      let styleClass = "border-slate-100 text-slate-700 bg-slate-50/20";
                      if (isCorrectChoice) {
                        styleClass = "border-emerald-200 bg-emerald-50/50 text-emerald-900";
                      } else if (isUserChoice && !isCorrect) {
                        styleClass = "border-rose-200 bg-rose-50/50 text-rose-950";
                      }

                      return (
                        <div key={oIdx} className={`rounded-xl border px-4 py-3 text-xs font-semibold flex items-center gap-2.5 ${styleClass}`}>
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            isCorrectChoice 
                              ? "bg-emerald-500 text-white" 
                              : isUserChoice 
                              ? "bg-rose-500 text-white" 
                              : "bg-slate-200 text-slate-600"
                          }`}>
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span className="leading-snug">{option}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Explanation Accordion/Field */}
                  <div className="bg-indigo-50/40 rounded-xl p-4 border border-indigo-50">
                    <p className="text-xs font-bold text-indigo-950">💡 คำอธิบายเฉลยความรู้:</p>
                    <p className="text-xs text-slate-600 leading-relaxed mt-1">{q.explanation || "ไม่มีคำอธิบายเพิ่มเติมสำหรับข้อนี้"}</p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* Beautiful High-contrast Submission Confirmation Dialog */}
      {showSubmitModal && (
        <div id="submit-confirmation-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Send className="h-5 w-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-950">📝 ยืนยันการส่งกระดาษคำตอบ</h3>
              <div className="mt-2 text-xs text-slate-500 font-medium leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100/50 space-y-2 text-left">
                <p className="font-bold text-slate-800 text-center text-xs">คุณทำข้อสอบไปแล้ว {Object.keys(selectedAnswers).length} จากทั้งหมด {questions.length} ข้อ</p>
                {questions.length - Object.keys(selectedAnswers).length > 0 ? (
                  <p className="text-rose-600 font-bold bg-rose-50 p-2 rounded-lg text-center text-[11px]">
                    ⚠️ คุณยังเว้นว่างไว้อีก {questions.length - Object.keys(selectedAnswers).length} ข้อ!
                  </p>
                ) : (
                  <p className="text-emerald-600 font-semibold text-center text-[11px]">
                    🎉 ตอบคำถามครบถ้วนทุกข้อแล้ว!
                  </p>
                )}
                <p className="text-[10px] text-slate-400 mt-1 pb-1 text-center">หากกดยืนยันแล้ว ระบบจะบันทึกคะแนนและประเมินผลสอบทันที</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                ทำต่อ
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                ยืนยันส่งข้อสอบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Threat-aware warning modal */}
      {showWarningModal && (
        <div id="warning-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-scale-up">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-rose-150 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500 border border-rose-100 animate-bounce">
              <ShieldAlert className="h-7 w-7 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-tight">🚨 ตรวจพบการเลิกโฟกัสหรือออกจากหน้าหน้าต่างสอบ!</h3>
              <p className="text-[10px] text-rose-600 font-bold mt-1 uppercase">การป้องกันการทุจริตข้อสอบออนไลน์</p>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed bg-rose-50/50 p-4 rounded-xl border border-rose-100 text-left font-medium">
                {warningMessage}
              </p>
            </div>
            <div className="text-[11px] text-slate-400 font-bold">
              ความผิดพลาด/สลับไปแท็บอื่นสะสม: <span className="text-rose-600 font-extrabold">{tabExits}</span> / 3 ครั้ง
            </div>
            <button
              onClick={() => setShowWarningModal(false)}
              className="w-full rounded-xl bg-slate-950 hover:bg-indigo-600 py-3 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
            >
              รับทราบและขอกลับเข้าสู่ห้องสอบด่วน! (ระวังครั้งถัดไป)
            </button>
          </div>
        </div>
      )}



    </div>
  );
}
