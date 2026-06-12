import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User, deleteUser } from "firebase/auth";
import { BookOpen, HelpCircle, Shield, Key, Search, Sparkles, AlertCircle, Award, CheckCircle, Mail, Lock, UserCheck, ChevronRight, GraduationCap, Trophy, Clock, QrCode, CreditCard } from "lucide-react";
import { 
  auth, 
  fetchCategories, 
  fetchQuizzes, 
  signInWithGoogle, 
  saveUserProfile, 
  subscribeToUsers,
  signUpWithEmailAndPassword,
  signInWithEmailPassword,
  updateUserProfileName,
  subscribeToAttempts,
  subscribeToUserProfile,
  logOut
} from "./lib/firebase";
import { Category, Quiz, Attempt } from "./types";
import Navbar from "./components/Navbar";
import QuizEngine from "./components/QuizEngine";
import AdminPanel from "./components/AdminPanel";
import HistoryPanel from "./components/HistoryPanel";
import Leaderboard from "./components/Leaderboard";
import SettingsModal from "./components/SettingsModal";
import PaymentModal from "./components/PaymentModal";
import HomePanel from "./components/HomePanel";
import SupportPanel from "./components/SupportPanel";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  // Active Session enforcement states
  const [sessionWarning, setSessionWarning] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      let localSessionId = localStorage.getItem("exam_active_session_id");
      if (!localSessionId) {
        localSessionId = "sess_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
        localStorage.setItem("exam_active_session_id", localSessionId);
      }
      return localStorage.getItem("session_terminated_reason") === "another_device"
        ? "Your account has been logged in from another device. Please log in again."
        : null;
    }
    return null;
  });

  // Sidebar expanded/collapsed state synchronized with localStorage
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    return localStorage.getItem("sidebarExpanded") !== "false";
  });

  // Account Settings and Real-time Attempts states
  const [showSettings, setShowSettings] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  // Custom email/password auth form state values
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nameField, setNameField] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  const handleHeroLogin = async () => {
    if (isLoggingIn) return;
    try {
      setIsLoggingIn(true);
      setAuthError("");
      setSessionWarning(null);
      localStorage.removeItem("session_terminated_reason");

      // Generate fresh active session ID
      const newSessionId = "sess_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
      localStorage.setItem("exam_active_session_id", newSessionId);

      await signInWithGoogle();
    } catch (err: any) {
      console.error("Sign in failed:", err);
      setAuthError(err?.message || "เข้าสู่ระบบด้วย Google ขัดข้อง");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setAuthError("");
    setAuthSuccess("");
    setSessionWarning(null);
    localStorage.removeItem("session_terminated_reason");

    if (!email || !password) {
      setAuthError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    try {
      setIsLoggingIn(true);

      // Generate fresh active session ID
      const newSessionId = "sess_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
      localStorage.setItem("exam_active_session_id", newSessionId);

      if (authMode === "signup") {
        if (!nameField.trim()) {
          setAuthError("กรุณาระบุชื่อผู้สอบด้วย");
          setIsLoggingIn(false);
          return;
        }
        await signUpWithEmailAndPassword(email, password, nameField.trim());
        setAuthSuccess("สมัครสมาชิกและเข้าสู่ระบบสำเร็จ!");
      } else {
        await signInWithEmailPassword(email, password);
        setAuthSuccess("ยินดีต้อนรับกลับเข้าสู่ระบบ!");
      }
    } catch (err: any) {
      console.error("Auth submit failed:", err);
      const errCode = err?.code || "";
      const errMsg = err?.message || "";
      if (errCode === "auth/invalid-credential" || errMsg.includes("invalid-credential") || errCode === "auth/user-not-found" || errCode === "auth/wrong-password") {
        setAuthError("อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือยังไม่ได้ทำการสมัครบัญชีในระบบ? หากคุณเพิ่งเริ่มเข้าใช้งานครั้งแรก กรุณากดสลับไปที่เมนู 'ลงทะเบียนสมาชิกใหม่' ด้านล่างเพื่อเริ่มสร้างบัญชี");
      } else if (errCode === "auth/weak-password") {
        setAuthError("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      } else if (errCode === "auth/email-already-in-use") {
        setAuthError("อีเมลนี้ถูกใช้งานร่วมกับระบบอื่นแล้ว");
      } else if (errCode === "auth/operation-not-allowed" || errMsg.includes("operation-not-allowed")) {
        setAuthError("firebase-auth-disabled");
      } else {
        setAuthError(err?.message || "เกิดข้อผิดพลาดในการตรวจสอบบัญชีด้านความปลอดภัย");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // App navigation & selection
  const [currentTab, setCurrentTab] = useState<"home" | "quizzes" | "admin" | "history" | "approvals" | "support">("home");
  const [categories, setCategories] = useState<Category[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dataLoading, setDataLoading] = useState(false);

  // Active exam session
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [isTakingQuiz, setIsTakingQuiz] = useState(false);

  // Real-time online users subscription across whole system
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      setOnlineUsers([]);
      return;
    }
    const unsubscribe = subscribeToUsers((data) => {
      setOnlineUsers(data);
    });
    return () => {
      unsubscribe();
    };
  }, [user]);

  // Subscribe to public attempts (results) for the Real-time Leaderboards
  useEffect(() => {
    if (!user) {
      setAttempts([]);
      return;
    }
    const unsubscribe = subscribeToAttempts((data) => {
      setAttempts(data);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // Firebase auth state monitoring
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        saveUserProfile(currentUser, "online");
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Monitor real-time profile approval and info
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    let timer: any = null;
    const unsubscribe = subscribeToUserProfile(user.uid, (profile) => {
      setUserProfile(profile);
      if (profile === null) {
        // Debounce logout to avoid race conditions during initial account signup
        timer = setTimeout(async () => {
          const creationTime = user.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : 0;
          const isBrandNew = Date.now() - creationTime < 15000; // 15 seconds
          if (!isBrandNew) {
            try {
              await deleteUser(user);
            } catch (err: any) {
              if (err?.code === "auth/requires-recent-login" || err?.message?.includes("requires-recent-login")) {
                console.warn("deleteUser deferred due to requires-recent-login. Operation will retry on next login attempt.");
              } else {
                console.warn("Failed to delete auth user from profile subscription state (non-fatal):", err);
              }
            }
          }
          logOut();
        }, 2000);
      } else {
        if (timer) clearTimeout(timer);

        // Single Active Session Validation Check
        const localSessionId = localStorage.getItem("exam_active_session_id");
        const sessionWriteStatus = localStorage.getItem("session_write_status");

        if (localSessionId && profile.activeSessionId) {
          if (profile.activeSessionId === localSessionId) {
            localStorage.setItem("session_write_status", "confirmed");
          } else if (sessionWriteStatus !== "pending") {
            console.warn("Session invalidated because another device logged in.");
            localStorage.setItem("session_terminated_reason", "another_device");
            setSessionWarning("Your account has been logged in from another device. Please log in again.");
            logOut(true);
            return;
          }
        }
      }
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [user]);

  // Compute isAdmin dynamically when user or userProfile changes
  useEffect(() => {
    if (user) {
      const isSystemOwner = user.email?.toLowerCase() === "first22960@gmail.com";
      const isUserAdmin = userProfile?.role === "admin" || userProfile?.isAdmin === true;
      setIsAdmin(isSystemOwner || isUserAdmin);
    } else {
      setIsAdmin(false);
    }
  }, [user, userProfile]);

  // Tab visibility user presence sync
  useEffect(() => {
    if (!user) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        saveUserProfile(user, "online");
      } else {
        saveUserProfile(user, "offline");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  // Fetch quizzes and categories when tab switches to quizzes or on start
  const loadDashboardData = async () => {
    if (!user) return;
    try {
      setDataLoading(true);
      const cats = await fetchCategories();
      setCategories(cats);

      const qz = await fetchQuizzes();
      setQuizzes(qz);
    } catch (error) {
      console.error("Dashboard content loading failure:", error);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (user && currentTab === "quizzes") {
      loadDashboardData();
    }
  }, [user, currentTab]);

  // Filters quizzes based on category selection pills and search inputs
  const filteredQuizzes = quizzes.filter((q) => {
    const matchesCategory = selectedCatId === "all" || q.categoryId === selectedCatId;
    const matchesSearch =
      q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (authLoading) {
    return (
      <div id="full-page-loader" className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50 space-y-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600"></div>
        <p className="text-sm font-semibold text-slate-600 animate-pulse">กำลังตรวจสอบข้อมูลความปลอดภัยระบบสอบ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      
      {/* Dynamic Nav-header */}
      <Navbar
        user={user}
        isAdmin={isAdmin}
        currentTab={currentTab}
        setTab={(tab) => {
          setActiveQuiz(null); // safely clear active testing state on tab switch
          setIsTakingQuiz(false);
          setCurrentTab(tab);
        }}
        isTakingQuiz={isTakingQuiz}
        onlineUsers={onlineUsers}
        onOpenSettings={() => setShowSettings(true)}
        onSidebarChange={setSidebarExpanded}
      />

      {/* Main Content Stage with Sidebar Padding Transition */}
      <div className={`flex flex-col flex-grow min-h-0 transition-all duration-300 ${
        user && !isTakingQuiz
          ? sidebarExpanded
            ? "md:pl-64"
            : "md:pl-20"
          : ""
      }`}>
        <main className="flex-grow mx-auto w-full max-w-7xl px-4 pt-6 pb-24 sm:py-8 sm:px-6 lg:px-8">
        
        {/* LANDING PAGE / GUEST DISCOVERY VIEWS */}
        {!user ? (
          <div className="space-y-12 py-6 sm:py-10">
            
            {/* Split Grid for Hero Callout and Account Creator */}
            <div id="landing-hero" className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              {/* Left Side: Scholastic Educational Copysetting */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <span className="inline-flex items-center rounded-full bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-600/20 gap-1.5 shadow-xxs">
                  <GraduationCap className="h-4 w-4 text-amber-700" />
                  <span>เส้นทางสู่ข้าราชการครูผู้ช่วยปี 2569</span>
                </span>
                
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl leading-tight">
                  ระบบฝึกทำข้อสอบ <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 mt-1.5 inline-block">
                    เตรียมตัวสอบครูผู้ช่วยอัจฉริยะ
                  </span>
                </h1>
                
                <p className="text-sm text-slate-600 leading-relaxed">
                  รวบรวมแบบฝึกหัดเกณฑ์ล่าสุด ก.ค.ศ. พัฒนาและวิเคราะห์คลังข้อสอบร่วมกับกลุ่มผู้ทรงคุณวุฒิและคณะกรรมการผู้เชี่ยวชาญ สรุปสาระสำคัญ เพื่อยกระดับความรอบรู้ในการเข้าสู่เส้นทางจรรยาบรรณวิชาชีพครูอย่างมั่นคง
                </p>

                {/* Sub-areas of the Exam Syllabus */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-2">
                  <div className="flex gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xxs">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">1</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-none">ภาค ก ความรู้ความสามารถทั่วไป</h4>
                      <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">มีวิชา 1. ความรู้ความสามารถในการคิด 2. กฎหมายการศึกษา 3. ภาษาอังกฤษ</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xxs">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 text-xs font-bold">2</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-none">ภาค ข มาตรฐานความรู้และประสบการณ์วิชาชีพ</h4>
                      <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">มีวิชา 1. มาตรฐานการสอน 2. กฎหมายการศึกษา แนวทางการปฏิรูป 3. วิชาเอก</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Dual Auth Password Widget / Core Sign In Portal */}
              <div className="lg:col-span-5">
                <div className="w-full max-w-sm mx-auto rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-xl space-y-6">
                  
                  {/* Single Active Session Warning Alert Banner */}
                  {sessionWarning && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed font-bold flex items-start gap-2.5 shadow-xxs animate-fade-in">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <span className="text-slate-750">{sessionWarning}</span>
                    </div>
                  )}
                  
                  {/* Auth Mode Tabs toggles */}
                  <div className="flex p-1 bg-slate-100/80 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("login");
                        setAuthError("");
                        setAuthSuccess("");
                      }}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
                        authMode === "login"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      เข้าสู่ระบบ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signup");
                        setAuthError("");
                        setAuthSuccess("");
                      }}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
                        authMode === "signup"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      ลงทะเบียนผู้สอบใหม่
                    </button>
                  </div>

                  <div className="text-center space-y-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {authMode === "login" ? "เข้าสู่บัญชีแบบทดสอบครูผู้ช่วย" : "สร้างบัญชีผู้เตรียมสอบใหม่"}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      {authMode === "login" 
                        ? "เข้าใช้งานเพื่อทำข้อสอบ ทบทวนประวัติเฉลยความรู้ และเก็บอันดับครูดีเด่น" 
                        : "ลงทะเบียนง่ายๆ ด้วยเมลและรหัสผ่านเพื่อเริ่มต้นเก็บสถิติประวัติการทำข้อสอบอัจฉริยะ"}
                    </p>
                  </div>

                  {/* Forms input section */}
                  <form onSubmit={handleEmailAuthSubmit} className="space-y-4 text-left">
                    {authMode === "signup" && (
                      <div className="space-y-1.5">
                        <label className="text-xxs font-bold text-slate-600 block uppercase tracking-wider">
                          ชื่อ-นามสกุล / ชื่อเล่น
                        </label>
                        <div className="relative">
                          <UserCheck className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="เช่น ครูสมเจตน์"
                            value={nameField}
                            onChange={(e) => setNameField(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-indigo-500 transition-all text-slate-800"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xxs font-bold text-slate-600 block uppercase tracking-wider">
                        อีเมลผู้สอบ
                      </label>
                      <div className="relative">
                        <Mail className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                        <input
                          type="email"
                          placeholder="your.email@gmail.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-indigo-500 transition-all text-slate-800"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xxs font-bold text-slate-600 block uppercase tracking-wider">
                        รหัสผ่าน
                      </label>
                      <div className="relative">
                        <Lock className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                        <input
                          type="password"
                          placeholder="รหัสผ่านอย่างน้อย 6 หลัก"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-indigo-500 transition-all text-slate-800"
                          required
                        />
                      </div>
                    </div>

                    {/* Alert dialog inside Auth Wrapper */}
                    {authError && (
                      authError === "firebase-auth-disabled" ? (
                        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-[11px] text-slate-700 leading-relaxed font-semibold space-y-3 shadow-xs">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-amber-850 font-black text-[12px] block">⚠️ จำเป็นต้องเปิดใช้งาน Email/Password ใน Firebase Auth</strong>
                              <p className="mt-1 text-slate-600 text-[10.5px]">เนื่องจากระบบความปลอดภัยของ Firebase ต้องการให้ผู้พัฒนาเปิดสิทธิ์การใช้งาน Email/Password Sign-In ก่อนเพื่อให้ผู้สอบลงทะเบียนด้วยสลิป/รหัสผ่านเข้าห้องสอบได้</p>
                            </div>
                          </div>
                          
                          <div className="bg-white/90 rounded-xl p-3 border border-amber-150 space-y-2">
                            <span className="font-extrabold text-slate-800 text-[10px] block uppercase tracking-wider">🛠️ ขั้นตอนเปิดใช้งานภายใน 1 นาที:</span>
                            <ol className="list-decimal list-inside space-y-1 text-slate-600 font-bold pl-1 font-sans text-[10px]">
                              <li>คลิกปุ่มสีน้ำเงินด้านล่างเพื่อเปิดหน้าตั้งค่าของ Firebase Console</li>
                              <li>กดเลือกที่แท็บ <strong className="text-slate-800">Sign-in method</strong> ด้านบน</li>
                              <li>คลิกปุ่ม <strong className="text-slate-800">Add new provider</strong> และเลือก <strong className="text-indigo-600 font-black">Email/Password</strong></li>
                              <li>สับสวิตช์เปิดใช้งานคู่แรกสุด (<strong className="text-emerald-700">Enable</strong>) แล้วกดปุ่มบันทึก <strong className="text-slate-900 font-extrabold shadow-xxs">Save</strong></li>
                            </ol>
                            <div className="text-[9.5px] text-amber-800 font-bold bg-amber-50 p-2 rounded-lg border border-amber-100">
                              💡 ตอนนี้ระบบได้ทำการสลับโปรเจ็กต์ Firebase ไปเป็นของคุณโดยตรงแล้ว (<span className="font-mono text-indigo-600">e574f0d2-8380-4e2a-834d-2790e75fed34</span>)
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl bg-rose-50 text-rose-600 p-2.5 text-center text-[11.5px] font-bold border border-rose-100">
                          {authError}
                        </div>
                      )
                    )}

                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500 transition-all shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      <span>{authMode === "login" ? "เข้าระบบเพื่อเตรียมสอบทันที" : "สมัครลงทะเบียนและสร้างผลประวัติใหม่"}</span>
                    </button>
                  </form>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-150"></div>
                    <span className="flex-shrink mx-3 text-slate-400 text-[10px] font-bold uppercase">หรือ</span>
                    <div className="flex-grow border-t border-slate-150"></div>
                  </div>

                  {/* Easy Single-click login with Google */}
                  <button
                    type="button"
                    onClick={handleHeroLogin}
                    disabled={isLoggingIn}
                    className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" width="24" height="24">
                      <g transform="matrix(1, 0, 0, 1, 0, 0)">
                        <path d="M21.35,11.1H12v2.7H18.38A5.7,5.7,0,0,1,15.9,17.65l3.85,3A10,10,0,0,0,22,12,9.65,9.65,0,0,0,21.35,11.1Z" fill="#4285f4" />
                        <path d="M12,22A9.76,9.76,0,0,0,18.7,19.5l-3.85-3A6.11,6.11,0,0,1,12,17.5a5.94,5.94,0,0,1,-5.63,-4.12l-4,3.1A10,10,0,0,0,12,22Z" fill="#34a853" />
                        <path d="M6.37,13.38A5.67,5.67,0,0,1,6,12a5.67,5.67,0,0,1,.37-1.38V7.52l-4-3.1A10,10,0,0,0,1,12a10,10,0,0,0,1.38,4.58Z" fill="#fbbc05" />
                        <path d="M12,6.5a5.21,5.21,0,0,1,3.48,1.32l2.61,-2.6A9.63,9.63,0,0,0,12,2,10,10,0,0,0,2.38,4.42l4,3.1A5.94,5.94,0,0,1,12,6.5Z" fill="#ea4335" />
                      </g>
                    </svg>
                    <span>{isLoggingIn ? "กำลังประมวลผล..." : "เข้าสู่ระบบด้วยบัญชี Google"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ==================================================== */
          /*               AUTHENTICATED STUDENT VIEWS            */
          /* ==================================================== */
          <div className="animate-fade-in">
            {!userProfile && !isAdmin ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600"></div>
                <p className="text-xs font-semibold text-slate-500 text-center animate-pulse">กำลังประมวลสิทธิ์ใช้งานระบบและดึงข้อมูลโปรไฟล์จากระบบ...</p>
              </div>
            ) : activeQuiz && (activeQuiz.isFree || userProfile?.approved !== false || isAdmin) ? (
              // Active Interactive Exam taking engine (Accessible to trial users if isFree)
              <QuizEngine 
                quiz={activeQuiz} 
                onExit={() => {
                  setActiveQuiz(null);
                  setIsTakingQuiz(false);
                }} 
                onSubmitted={() => {
                  setIsTakingQuiz(false);
                  loadDashboardData();
                }}
              />
            ) : (
              currentTab === "admin" && isAdmin ? (
                // Admin module controller dashboard - Quiz Mode
                <AdminPanel mode="quiz" />
              ) : currentTab === "approvals" && isAdmin ? (
                // Admin module controller dashboard - Approvals Mode
                <AdminPanel mode="approvals" />
              ) : currentTab === "support" ? (
                <SupportPanel isAdmin={isAdmin} userProfile={userProfile} />
            ) : currentTab === "history" ? (
              // Historic results summaries (Requirement 3: locked for unapproved users)
              userProfile?.approved === false && !isAdmin ? (
                <div className="max-w-md mx-auto my-16 text-center bg-white border border-slate-100 p-8 rounded-3xl shadow-xs space-y-6 animate-scale-up">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 animate-pulse">
                    <Lock className="h-6 w-6 stroke-[2]" />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-sm font-extrabold text-slate-900">🔒 ประวัติข้อสอบสงวนสิทธิ์เฉพาะสมาชิก</h3>
                    <p className="text-xs text-slate-550 leading-relaxed font-semibold block text-slate-500">
                      ฟังก์ชันวิเคราะห์ระบบนวัตกรรมการสอบเฉลยรายข้อ และคลังสถิติผลคะแนนสะสมพัฒนาการ สงวนสิทธิ์สำหรับสมาชิกพรีเมียมเท่านั้น
                    </p>
                    <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                      แอดมินต้องการตรวจสอบหลักฐานสลิปการชำระเงินของท่าน เพื่อเปิดสิทธิ์การใช้งานกลุ่มพรีเมียมคอร์ส (99.- ตลอดชีพ)
                      <br /><br />
                      หากท่านโอนเงินสมัครแล้วและส่งสลิปภายในระบบแล้ว กรุณารอสักครู่ แอดมินกำลังตรวจสอบและจะรีบอนุมัติสิทธิ์ให้ท่านโดยเร็วที่สุด!
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setShowPayment(true)}
                        className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500 transition-all shadow-xs cursor-pointer"
                      >
                        <CreditCard className="h-4.5 w-4.5" />
                        <span>อัปเกรดสมาชิกพรีเมียม (99.- ตลอดชีพ)</span>
                      </button>
                      <a
                        href="https://line.me"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-xs cursor-pointer"
                      >
                        💬 ติดต่อส่งสลิปเพื่อขออนุมัติสิทธิ์ LINE
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <HistoryPanel isAdmin={isAdmin} />
              )
            ) : currentTab === "home" ? (
              // Dedicated News / Announcements Homepage
              userProfile?.approved === false && !isAdmin ? (
                <div className="space-y-8 my-4 max-w-6xl mx-auto animate-scale-up">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    
                    {/* Left Column: Announcements & Real-time Leaderboard */}
                    <div className="lg:col-span-2 space-y-8">
                      <div className="space-y-4">
                        <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-sm flex items-center gap-3">
                          <span className="text-2xl animate-pulse">📢</span>
                          <div>
                            <h4 className="text-sm font-bold text-slate-50">
                              ประกาศข่าวประชาสัมพันธ์ล่าสุดจากทางฝ่ายวิชาการ
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              อัปเดตบทวิเคราะห์ ตารางชี้แจง และข้อมูลข้อสอบปักหมุดล่าสุด
                            </p>
                          </div>
                        </div>
                        <HomePanel isAdmin={isAdmin} userId={user.uid} />
                      </div>

                      {/* Real-time Leaderboard below announcements (Requirement 2) */}
                      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs">
                        <Leaderboard 
                          categories={categories} 
                          quizzes={quizzes} 
                          attempts={attempts} 
                          title="อันดับคะแนนสะสมแบบ Real-time ของห้องสอบประจำรายวิชา" 
                        />
                      </div>
                    </div>

                    {/* Right column: Verification status and actions box */}
                    <div className="space-y-6 lg:sticky lg:top-6">
                      <div className="rounded-3xl bg-white border border-slate-100 p-6 shadow-md text-center space-y-6">
                        {userProfile?.paymentStatus === "rejected" ? (
                          <>
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500 border border-rose-100 animate-pulse">
                              <AlertCircle className="h-7 w-7 stroke-[2]" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-sm font-extrabold text-rose-600">❌ หลักฐานการโอนเงินไม่ผ่านการอนุมัติ</h3>
                              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                                บัญชี <span className="text-indigo-600 font-bold underline font-mono">{user.email}</span>
                              </p>
                              <div className="text-[11px] leading-relaxed bg-rose-50/50 p-4 rounded-2xl border border-rose-100 text-left text-slate-600">
                                <span className="font-bold text-rose-700">แจ้งเตือนจากแอดมิน:</span> สลิปหลักฐานโอนเงินล่าสุดของท่านไม่ถูกต้องหรือส่งผิดรูปภาพ ท่านสามารถกดปุ่มสีแดงด้านล่างเพื่ออัปโหลดส่งรูปภาพสลิปใบที่ถูกต้องใหม่อีกครั้งเพื่อรับการอนุมัติสิทธิ์พรีเมียมคอร์ส (99.- ตลอดชีพ)
                              </div>
                            </div>
                            <div className="flex flex-col gap-2.5">
                              <button
                                id="payment-trigger-trial"
                                onClick={() => setShowPayment(true)}
                                className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-500 transition-all shadow-xs cursor-pointer"
                              >
                                <CreditCard className="h-4.5 w-4.5" />
                                <span>แนบรูปภาพสลิปโอนเงินใบใหม่ในระบบ</span>
                              </button>
                              <a
                                id="line-trigger-trial"
                                href="https://line.me"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-xs cursor-pointer"
                              >
                                💬 สอบถามเพิ่มเติมผ่าน LINE
                              </a>
                              <button
                                id="signout-trigger-trial"
                                onClick={() => logOut()}
                                className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all cursor-pointer font-bold"
                              >
                                ออกจากระบบเพื่อเข้าบัญชีอื่น
                              </button>
                            </div>
                            <div className="text-[10px] text-rose-500 font-bold">
                              สถานะ: สลิปไม่ผ่านการอนุมัติ • รอแนบสลิปใบใหม่
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-500 border border-amber-100 animate-pulse">
                              <Clock className="h-7 w-7 stroke-[2]" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-sm font-extrabold text-slate-900">🕒 อยู่ระหว่างการตรวจสอบสิทธิ์การใช้งาน</h3>
                              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                                บัญชีของคุณ <span className="text-indigo-600 font-bold underline font-mono">{user.email}</span> ลงทะเบียนสมบูรณ์แล้ว
                              </p>
                              <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left text-slate-600">
                                แอดมินต้องการตรวจสอบหลักฐานสลิปการชำระเงินของท่าน เพื่อสับเปลี่ยนเปิดให้เข้าใช้งานกลุ่มพรีเมียมคอร์ส (99.- ตลอดชีพ)
                                <br /><br />
                                หากท่านโอนเงินสมัครแล้วและส่งสลิปหลักฐานเข้ามาในระบบแล้ว กรุณารอสักครู่ แอดมินกำลังเร่งตรวจสอบและจะตอบรับสิทธิ์ของท่านโดยเร็วที่สุด!
                              </div>
                            </div>
                            <div className="flex flex-col gap-2.5">
                              <button
                                id="payment-trigger-trial"
                                onClick={() => setShowPayment(true)}
                                className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500 transition-all shadow-xs cursor-pointer"
                              >
                                <CreditCard className="h-4.5 w-4.5" />
                                <span>สแกน QR Code และแนบสลิปแจ้งสิทธิ์ในระบบ</span>
                              </button>
                              <a
                                id="line-trigger-trial"
                                href="https://line.me"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-xs cursor-pointer"
                              >
                                💬 ติดต่อแอดมินด่วนผ่าน LINE อนุมัติสิทธิ์
                              </a>
                              <button
                                id="signout-trigger-trial"
                                onClick={() => logOut()}
                                className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all cursor-pointer font-bold"
                              >
                                ออกจากระบบเพื่อเข้าบัญชีอื่น
                              </button>
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold">
                              ระดับสิทธิ์: บัญชีผู้สอบค้างอนุมัติชั่วคราว • กรุณารอสักครู่
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                <HomePanel isAdmin={isAdmin} userId={user.uid} />
              )
            ) : (
              // Primary Student Portal listing categories and quizzes (Requirement 5)
              <div className="space-y-6">
                
                {/* Special trial notice alert warning for non-approved users accessing the Quizzes tab */}
                {userProfile?.approved === false && !isAdmin && (
                  <div className="rounded-2xl border border-indigo-150 bg-indigo-50/70 p-4 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-pulse">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-indigo-950">🎁 คุณเข้าใช้งานตลุยข้อสอบโหมดฟรีความจริงใจ!</h4>
                        <p className="text-[11px] text-indigo-800 leading-normal mt-0.5 font-bold">
                          คุณสามารถคลิกเปิดทำการทดสอบชุดที่มีป้ายกำกับ <span className="font-black underline text-indigo-900">FREE TRIAL</span> ได้เลยทันที! เพื่อปลดล็อกวิชาสำคัญอื่นๆ ทั้งหมดกรุณาแจ้งแนบหลักฐานชำระเงินสมัครที่หน้าแรก
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowPayment(true)}
                      className="self-start sm:self-auto inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2 text-[11px] font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      อัปเกรดสมัครสมาชิกในส่วนแจ้งโอน
                    </button>
                  </div>
                )}
                
                {/* Dashboard Banner and Search header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-900">ยินดีต้อนรับเข้าห้องสอบเสมือนจริง</h2>
                    <p className="text-xs text-slate-500">โปรดเลือกรายวิชาด้านล่างเพื่อเริ่มระดมสมองทำคะแนนทดสอบวิเคราะห์</p>
                  </div>
                  
                  {/* Real-time search filter */}
                  <div className="relative w-full md:w-80">
                    <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อแบบทดสอบ..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-4 text-xs outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Categories Tab Pill Selector */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                  <button
                    onClick={() => setSelectedCatId("all")}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                      selectedCatId === "all"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCatId(cat.id)}
                      className={`rounded-full px-4 py-1.5 text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                        selectedCatId === cat.id
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Quizzes list stage Grid view */}
                {dataLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600"></div>
                    <p className="text-xs text-slate-400">กำลังดาวน์โหลดชุดข้อสอบ...</p>
                  </div>
                ) : filteredQuizzes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <AlertCircle className="h-12 w-12 text-slate-300 stroke-[1.2]" />
                    <h3 className="text-sm font-semibold text-slate-900 mt-3">ไม่พบชุดข้อสอบ</h3>
                    <p className="text-xs text-slate-500 mt-1">ยังไม่มีผู้ออกข้อสอบในวิชานี้ หรือลองใช้คำค้นหาอื่น</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredQuizzes.map((quiz) => {
                      const catName = categories.find(c => c.id === quiz.categoryId)?.name || "ทั่วไป";
                      const isLocked = userProfile?.approved === false && !isAdmin && !quiz.isFree;

                      return (
                        <div
                          key={quiz.id}
                          className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-all group"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                {catName}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {quiz.isFree && (
                                  <span className="bg-amber-100 text-amber-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono animate-pulse">
                                    FREE TRIAL
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400 font-mono">ID: {quiz.id.slice(0, 5).toUpperCase()}</span>
                              </div>
                            </div>

                            <h3 className="mt-4 text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-normal">
                              {quiz.title}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500 line-clamp-3 leading-relaxed">
                              {quiz.description}
                            </p>
                          </div>

                          <div className="mt-6 border-t border-slate-50 pt-4 flex items-center justify-between">
                            <div className="flex items-center gap-4 text-[11px] text-slate-400 font-medium font-semibold">
                              <span className="flex items-center gap-1">📋 {quiz.questionsCount} ข้อ</span>
                              {quiz.timeLimit > 0 && <span className="flex items-center gap-1">⌚ {quiz.timeLimit} นาที</span>}
                            </div>
                            
                            {isLocked ? (
                              <button
                                onClick={() => setShowPayment(true)}
                                className="rounded-xl bg-slate-150 border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                                title="แบบฝึกหัดเฉพาะกลุ่มสมาชิกพรีเมียม สนใจแนบหลักฐานผู้ชำระเงินที่หน้าหลัก"
                              >
                                <Lock className="h-3.5 w-3.5 text-slate-400" />
                                <span>ข้อสอบพรีเมียม</span>
                              </button>
                            ) : (
                              <button
                                id={`start-quiz-${quiz.id}`}
                                onClick={() => {
                                  setActiveQuiz(quiz);
                                  setIsTakingQuiz(true);
                                }}
                                className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                              >
                                {quiz.isFree ? "ทำข้อสอบฟรี →" : "เริ่มทำข้อสอบ"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Real-time Scorers Leaderboard inside primary student portal (Requirement 5) */}
                <div className="pt-8 border-t border-slate-100">
                  <Leaderboard 
                    categories={categories} 
                    quizzes={quizzes} 
                    attempts={attempts} 
                    title="อันดับคะแนนสะสมแบบ Real-time ของห้องสอบประจำรายวิชา" 
                  />
                </div>

              </div>
            )
            )}
          </div>
        )}

      </main>

      {/* Humble Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center">
        <p className="text-xs text-slate-400">© 2026 แบบฝึกหัดครูผู้ช่วย. พัฒนาขึ้นด้วยระบบประเมินอัจฉริยะ • มั่นคง ปลอดภัย ด้วยระบบเทคโนโลยีวิเคราะห์ข้อมูลมาตรฐานสูง</p>
      </footer>
      </div>

      {/* Account Settings Dialog (Requirement 3) */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        user={user}
        onNameUpdated={(newName) => {
          if (auth.currentUser) {
            setUser({ ...auth.currentUser } as any);
          }
        }}
      />

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
      />

    </div>
  );
}
