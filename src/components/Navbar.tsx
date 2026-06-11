import React, { useState, useEffect } from "react";
import { LogIn, LogOut, Shield, Award, Sparkles, BookOpen, Users, Clock, Settings, Bell, Home, Check, Trash2, X } from "lucide-react";
import { User } from "firebase/auth";
import { signInWithGoogle, logOut, subscribeToNotifications, markNotificationAsRead, deleteNotification } from "../lib/firebase";

interface NavbarProps {
  user: any; // User profile with additional fields like uid etc.
  isAdmin: boolean;
  currentTab: "home" | "quizzes" | "admin" | "history" | "approvals";
  setTab: (tab: "home" | "quizzes" | "admin" | "history" | "approvals") => void;
  isTakingQuiz?: boolean;
  onlineUsers: any[];
  onOpenSettings?: () => void;
}

export default function Navbar({ user, isAdmin, currentTab, setTab, isTakingQuiz, onlineUsers = [], onOpenSettings }: NavbarProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const userUid = user.uid || user.id;
    const unsubscribe = subscribeToNotifications(userUid, isAdmin, (list) => {
      // Filter list: user has to match, or broadcast 'all', or is 'admin' and user is admin
      const filtered = list.filter(n => n.userId === "all" || n.userId === userUid || (isAdmin && n.userId === "admin"));
      setNotifications(filtered);
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  const userUid = user?.uid || user?.id || "";
  const unreadNotifications = notifications.filter(n => !n.readBy || !n.readBy.includes(userUid));
  const unreadCount = unreadNotifications.length;

  const handleMarkAsRead = async (id: string) => {
    if (!userUid) return;
    await markNotificationAsRead(id, userUid);
  };

  const handleDeleteNotification = async (id: string) => {
    await deleteNotification(id);
  };

  const handleMarkAllRead = async () => {
    if (!userUid) return;
    for (const n of unreadNotifications) {
      await markNotificationAsRead(n.id, userUid);
    }
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    try {
      setIsLoggingIn(true);
      await signInWithGoogle();
    } catch (err) {
      console.error("Sign in failed:", err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <>
      <header id="app-header" className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Logo Section */}
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setTab("home")}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 flex items-center gap-1">
                <span>แบบฝึกหัดครูผู้ช่วย</span>
                <span className="hidden sm:inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10 gap-0.5 animate-pulse">
                  <Sparkles className="h-2.5 w-2.5" /> ท็อปฟอร์ม
                </span>
              </h1>
              <p className="text-[10px] text-slate-500 hidden sm:block">เส้นทางสู่ข้าราชการครูผู้ช่วยด้วยระบบจำลองอัจฉริยะ</p>
            </div>
          </div>

          {/* Tab Navigation & User Controls */}
          <div className="flex items-center space-x-4">
            {user && (
              isTakingQuiz ? (
                <div id="active-quiz-banner" className="flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-1.5 text-indigo-800 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                  <span className="max-w-[120px] truncate sm:max-w-none">กำลังทดสอบอยู่...</span>
                </div>
              ) : (
                <nav className="hidden sm:flex space-x-1" aria-label="Tabs">
                  <button
                    id="tab-home-btn"
                    onClick={() => setTab("home")}
                    className={`rounded-lg px-2.5 py-2 text-xs sm:text-sm font-medium transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                      currentTab === "home"
                        ? "bg-indigo-50 text-indigo-700 font-bold"
                        : "text-slate-600 hover:bg-slate-55"
                    }`}
                  >
                    <Home className="h-3.5 w-3.5" /> หน้าแรก
                  </button>

                  <button
                    id="tab-quizzes-btn"
                    onClick={() => setTab("quizzes")}
                    className={`rounded-lg px-2.5 py-2 text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                      currentTab === "quizzes"
                        ? "bg-indigo-50 text-indigo-700 font-bold"
                        : "text-slate-600 hover:bg-slate-55"
                    }`}
                  >
                    แบบฝึกหัด
                  </button>

                  <button
                    id="tab-history-btn"
                    onClick={() => setTab("history")}
                    className={`rounded-lg px-2.5 py-2 text-xs sm:text-sm font-medium transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                      currentTab === "history"
                        ? "bg-indigo-50 text-indigo-700 font-bold"
                        : "text-slate-600 hover:bg-slate-55"
                    }`}
                  >
                    <Award className="h-3.5 w-3.5" /> ประวัติสอบ
                  </button>

                  {isAdmin && (
                    <>
                      <button
                        id="tab-admin-btn"
                        onClick={() => setTab("admin")}
                        className={`rounded-lg px-2.5 py-2 text-xs sm:text-sm font-medium transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                          currentTab === "admin"
                            ? "bg-indigo-50 text-indigo-700 font-bold"
                            : "text-slate-600 hover:bg-slate-55"
                        }`}
                      >
                        <Shield className="h-3.5 w-3.5" /> จัดการข้อสอบ
                      </button>
                      <button
                        id="tab-approvals-btn"
                        onClick={() => setTab("approvals")}
                        className={`rounded-lg px-2.5 py-2 text-xs sm:text-sm font-medium transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                          currentTab === "approvals"
                            ? "bg-indigo-50 text-indigo-700 font-bold"
                            : "text-slate-600 hover:bg-slate-55"
                        }`}
                      >
                        <Users className="h-3.5 w-3.5 text-indigo-600" /> อนุมัติสมาชิก
                      </button>
                    </>
                  )}
                </nav>
              )
            )}

            {/* Real-time Users Presence Counter Badge ONLY */}
            {user && (
              <div 
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 shrink-0 hidden md:inline-flex"
                title="จำนวนผู้ใช้งานปัจจุบัน"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] sm:text-xs">
                  ผู้ใช้งาน: <span className="font-bold">{onlineUsers.filter(u => u.status === "online").length}</span> คนออนไลน์
                </span>
              </div>
            )}

            {/* User Widget */}
            <div className="flex items-center gap-1.5 sm:gap-3 border-l border-slate-200 pl-2 sm:pl-4">
              {user ? (
                <div className="flex items-center gap-1 sm:gap-2 relative">
                  
                  {/* Notification Bell Component */}
                  <div className="relative">
                    <button
                      onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                      className="relative rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                      title="การแจ้งเตือน"
                    >
                      <Bell className="h-4.5 w-4.5" />
                      {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                        </span>
                      )}
                    </button>

                    {showNotifDropdown && (
                      <div className="absolute right-0 mt-3 w-76 sm:w-80 rounded-2xl border border-slate-100 bg-white p-4 shadow-xl z-55 space-y-3 animate-scale-up text-left text-xs font-semibold">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                          <span className="font-bold text-slate-800 flex items-center gap-1">🔔 การแจ้งเตือน <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full text-[10px]">{unreadCount}</span></span>
                          <div className="flex gap-2">
                            {unreadCount > 0 && (
                              <button 
                                onClick={handleMarkAllRead}
                                className="text-[10px] text-indigo-600 hover:underline cursor-pointer font-bold"
                              >
                                อ่านทั้งหมด
                              </button>
                            )}
                            <button 
                              onClick={() => setShowNotifDropdown(false)}
                              className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-2.5 divide-y divide-slate-100 scrollbar-none pr-0.5 font-medium">
                          {notifications.length === 0 ? (
                            <div className="py-6 text-center text-slate-400 font-bold">
                              ไม่พบรายการแจ้งเตือนในขณะนี้
                            </div>
                          ) : (
                            notifications.map((notif) => {
                              const isRead = notif.readBy && notif.readBy.includes(userUid);
                              return (
                                <div key={notif.id} className={`pt-2 flex justify-between items-start gap-1.5 group ${isRead ? 'opacity-60' : ''}`}>
                                  <div className="space-y-1 pr-1 flex-1">
                                    <p className={`text-[11px] leading-relaxed ${isRead ? 'text-slate-500' : 'font-bold text-slate-900'}`}>
                                      {notif.text}
                                    </p>
                                    <span className="text-[9px] text-slate-400 font-mono block">
                                      {notif.createdAt ? new Date(notif.createdAt.seconds * 1000).toLocaleTimeString("th-TH") : "กำลังอัปเดต..."}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {isAdmin && (
                                      <button 
                                        onClick={() => handleDeleteNotification(notif.id)}
                                        className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                                        title="ลบแจ้งเตือนออกจากระบบ"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="hidden md:block text-right">
                    <p className="text-xs font-semibold text-slate-900 leading-none">
                      {user.displayName || user.email?.split("@")[0]}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-tight flex items-center justify-end gap-0.5 mt-0.5 font-mono">
                      {isAdmin ? "เจ้าของระบบ" : "ผู้เตรียมสอบ"}
                    </p>
                  </div>

                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "user"}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 uppercase mt-0.5">
                      {user.email?.[0].toUpperCase() || "?"}
                    </div>
                  )}

                  {/* Settings Trigger for Account Settings */}
                  {onOpenSettings && (
                    <button
                      id="open-settings-btn"
                      onClick={onOpenSettings}
                      title="ตั้งค่าข้อมูลส่วนตัว"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    id="logout-btn"
                    onClick={logOut}
                    title="ออกจากระบบ"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  id="login-btn"
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoggingIn ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  <span>เข้าสู่ระบบ</span>
                </button>
              )}
            </div>

          </div>

        </div>
      </header>

      {/* Mobile Sticky Bottom Nav Bar (visible only in vertical phone view under sm breakpoint) */}
      {user && !isTakingQuiz && (
        <div id="mobile-bottom-nav" className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex items-center justify-around py-2 px-1 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] pb-safe">
          <button
            onClick={() => setTab("home")}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all relative cursor-pointer ${
              currentTab === "home" ? "text-indigo-600 font-bold" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px]">หน้าแรก</span>
          </button>

          <button
            onClick={() => setTab("quizzes")}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all relative cursor-pointer ${
              currentTab === "quizzes" ? "text-indigo-600 font-bold" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <BookOpen className="h-5 w-5" />
            <span className="text-[10px]">แบบฝึกหัด</span>
          </button>

          <button
            onClick={() => setTab("history")}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all relative cursor-pointer ${
              currentTab === "history" ? "text-indigo-600 font-bold" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Award className="h-5 w-5" />
            <span className="text-[10px]">ประวัติสอบ</span>
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => setTab("admin")}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all relative cursor-pointer ${
                  currentTab === "admin" ? "text-indigo-600 font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Shield className="h-5 w-5" />
                <span className="text-[10px]">จัดการข้อสอบ</span>
              </button>

              <button
                onClick={() => setTab("approvals")}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all relative cursor-pointer ${
                  currentTab === "approvals" ? "text-indigo-600 font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Users className="h-5 w-5 animate-pulse" />
                <span className="text-[10px]">อนุมัติสิทธิ์</span>
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
