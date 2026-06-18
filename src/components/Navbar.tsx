import React, { useState, useEffect } from "react";
import { 
  LogIn, LogOut, Shield, Award, Sparkles, BookOpen, 
  Users, Clock, Settings, Bell, Home, Check, Trash2, X, 
  Menu, ChevronLeft, ChevronRight, MessageCircle 
} from "lucide-react";
import { User } from "firebase/auth";
import { WitsivaLogo } from "./WitsivaLogo";
import { 
  signInWithGoogle, 
  logOut, 
  subscribeToNotifications, 
  markNotificationAsRead, 
  deleteNotification,
  subscribeToAllChats
} from "../lib/firebase";

interface NavbarProps {
  user: any; // User profile with additional fields like uid etc.
  isAdmin: boolean;
  currentTab: "home" | "quizzes" | "admin" | "history" | "approvals" | "support";
  setTab: (tab: "home" | "quizzes" | "admin" | "history" | "approvals" | "support") => void;
  isTakingQuiz?: boolean;
  onlineUsers: any[];
  onOpenSettings?: () => void;
  pendingApprovalsCount?: number;
  quizBadge?: boolean;
  onSidebarChange?: (expanded: boolean) => void;
}

export default function Navbar({ 
  user, 
  isAdmin, 
  currentTab, 
  setTab, 
  isTakingQuiz, 
  onlineUsers = [], 
  onOpenSettings,
  pendingApprovalsCount = 0,
  quizBadge = false,
  onSidebarChange
}: NavbarProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Collapsible Sidebar state on desktop
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    return localStorage.getItem("sidebarExpanded") !== "false";
  });

  // Mobile sidebar drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Unread support chats state (admin notification count)
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);

  useEffect(() => {
    if (onSidebarChange) {
      onSidebarChange(sidebarExpanded);
    }
  }, [sidebarExpanded, onSidebarChange]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const userUid = user.uid || user.id;
    const unsubscribe = subscribeToNotifications(userUid, isAdmin, (list) => {
      const filtered = list.filter(n => n.userId === "all" || n.userId === userUid || (isAdmin && n.userId === "admin"));
      setNotifications(filtered);
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  // Subscribe to support chats if admin to show message badges
  useEffect(() => {
    if (!isAdmin || !user) return;
    const unsubscribe = subscribeToAllChats((chats) => {
      const unreadCount = chats.filter(c => c.unreadByAdmin === true).length;
      setUnreadChatsCount(unreadCount);
    });
    return () => unsubscribe();
  }, [isAdmin, user]);

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

  const toggleSidebar = () => {
    const nextState = !sidebarExpanded;
    setSidebarExpanded(nextState);
    localStorage.setItem("sidebarExpanded", String(nextState));
  };

  const navigateTo = (tab: "home" | "quizzes" | "admin" | "history" | "approvals" | "support") => {
    setTab(tab);
    setMobileDrawerOpen(false);
  };

  // Compute live user presence count
  const onlineCount = onlineUsers.filter(u => u.status === "online").length;

  return (
    <>
      {/* Top Header Panel (Full-Width Sticky top bar across screen) */}
      <header id="app-header" className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          
          {/* Left: Hamburger & Logo */}
          <div className="flex items-center space-x-3.5">
            {user && (
              <button
                onClick={() => {
                  setMobileDrawerOpen(true);
                }}
                className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                title="เปิดเมนูด้านข้าง"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigateTo("home")}>
              <WitsivaLogo className="h-10 w-10 shrink-0" />
              <div>
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                  <span>แบบฝึกหัดครูผู้ช่วย By วิทย์สิว่ะ</span>
                  <span className="hidden sm:inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10 gap-0.5 animate-pulse">
                    <Sparkles className="h-2.5 w-2.5" /> พรีเมียม
                  </span>
                </h1>
                <p className="text-[10px] text-slate-500 hidden sm:block">เส้นทางสู่ข้าราชการครูผู้ช่วยด้วยระบบจำลองอัจฉริยะ</p>
              </div>
            </div>
          </div>

          {/* Right: User actions & Bells */}
          <div className="flex items-center space-x-4">
            
            {user && isTakingQuiz && (
              <div id="active-quiz-banner" className="flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-1.5 text-indigo-800 text-xs font-bold leading-none">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                <span className="max-w-[120px] truncate sm:max-w-none">กำลังทดสอบ...</span>
              </div>
            )}

            {/* Live Presence counter display */}
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
                  ออนไลน์: <span className="font-bold">{onlineCount}</span> คน
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 sm:gap-3 border-l border-slate-100 pl-2 sm:pl-4">
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
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                        </span>
                      )}
                    </button>

                    {showNotifDropdown && (
                      <>
                        {/* Requirement 1: Click-outside backdrop to automatically close panel */}
                        <div 
                          className="fixed inset-0 z-40 bg-transparent cursor-default" 
                          onClick={() => setShowNotifDropdown(false)} 
                        />
                        
                        <div className="absolute right-0 mt-3 w-76 sm:w-80 rounded-2xl border border-slate-100 bg-white p-4 shadow-xl z-50 space-y-3 animate-scale-up text-left text-xs font-semibold">
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
                      </>
                    )}
                  </div>

                  <div className="hidden md:block text-right">
                    <p className="text-xs font-semibold text-slate-900 leading-none">
                      {user.displayName || user.email?.split("@")[0]}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-tight flex items-center justify-end gap-0.5 mt-0.5 font-mono">
                      {isAdmin ? "ผู้ดูแลระบบ" : "ผู้เตรียมสอบ"}
                    </p>
                  </div>

                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "user"}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full border border-slate-200 object-cover mt-0.5"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 uppercase mt-0.5">
                      {user.email?.[0].toUpperCase() || "?"}
                    </div>
                  )}
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

      {/* ==================================================== */}
      {/*               COLLAPSIBLE LEFT SIDEBAR LAYER         */}
      {/* ==================================================== */}
      {user && !isTakingQuiz && (
        <aside 
          id="desktop-sidebar" 
          className={`fixed top-16 bottom-0 left-0 z-30 bg-white border-r border-slate-100 hidden md:flex flex-col justify-between transition-all duration-300 ${
            sidebarExpanded ? "w-64" : "w-20"
          }`}
        >
          {/* Navigation Links body */}
          <div className="p-4 space-y-2 flex-grow">
            
            <button
              onClick={() => navigateTo("home")}
              className={`w-full flex items-center rounded-xl p-3 text-xs font-bold transition-all gap-3 cursor-pointer ${
                currentTab === "home" 
                  ? "bg-indigo-50 text-indigo-700" 
                  : "text-slate-650 hover:bg-slate-50 text-slate-600"
              }`}
            >
              <Home className="h-5 w-5 shrink-0" />
              {sidebarExpanded && <span>หน้าแรก (ประกาศ)</span>}
            </button>

            <button
              onClick={() => navigateTo("quizzes")}
              className={`w-full flex items-center justify-between rounded-xl p-3 text-xs font-bold transition-all cursor-pointer ${
                currentTab === "quizzes" 
                  ? "bg-indigo-50 text-indigo-700" 
                  : "text-slate-650 hover:bg-slate-50 text-slate-600"
              }`}
            >
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 shrink-0" />
                {sidebarExpanded && <span>แบบฝึกหัดข้อสอบ</span>}
              </div>
              {/* Requirement 4: Badge alerts on Quizzes if new exam questions are added */}
              {quizBadge && (
                <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0 shadow-sm animate-pulse mr-1" title="มีแบบฝึกหัดใหม่ที่ยังไม่ได้ทดสอบ" />
              )}
            </button>

            <button
              onClick={() => navigateTo("history")}
              className={`w-full flex items-center rounded-xl p-3 text-xs font-bold transition-all gap-3 cursor-pointer ${
                currentTab === "history" 
                  ? "bg-indigo-50 text-indigo-700" 
                  : "text-slate-650 hover:bg-slate-50 text-slate-600"
              }`}
            >
              <Award className="h-5 w-5 shrink-0" />
              {sidebarExpanded && <span>ประวัติและอันดับสอบ</span>}
            </button>

            <button
              onClick={() => navigateTo("support")}
              className={`w-full flex items-center justify-between rounded-xl p-3 text-xs font-bold transition-all cursor-pointer ${
                currentTab === "support" 
                  ? "bg-indigo-50 text-indigo-700" 
                  : "text-slate-650 hover:bg-slate-50 text-slate-600"
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 shrink-0" />
                {sidebarExpanded && <span>ห้องติดต่อช่วยเหลือ</span>}
              </div>
              {isAdmin && unreadChatsCount > 0 && (
                <span className="bg-rose-550 bg-rose-650 text-rose-650 text-xs px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-extrabold scale-90">
                  {unreadChatsCount}
                </span>
              )}
            </button>

            {/* Admin only controls toggled with badges */}
            {isAdmin && (
              <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                <p className="text-[10px] text-slate-400 font-bold px-3 uppercase tracking-wider">
                  {sidebarExpanded ? "เมนูคณะผู้บริหาร" : "แอดมิน"}
                </p>

                <button
                  onClick={() => navigateTo("admin")}
                  className={`w-full flex items-center rounded-xl p-3 text-xs font-bold transition-all gap-3 cursor-pointer ${
                    currentTab === "admin" 
                      ? "bg-indigo-50 text-indigo-700" 
                      : "text-slate-650 hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <Shield className="h-5 w-5 shrink-0 text-indigo-600" />
                  {sidebarExpanded && <span>จัดการระเบียนวิชา</span>}
                </button>

                <button
                  onClick={() => navigateTo("approvals")}
                  className={`w-full flex items-center justify-between rounded-xl p-3 text-xs font-bold transition-all cursor-pointer ${
                    currentTab === "approvals" 
                      ? "bg-indigo-50 text-indigo-700" 
                      : "text-slate-650 hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 shrink-0 text-indigo-600" />
                    {sidebarExpanded && <span>อนุมัติสมาชิก</span>}
                  </div>
                  {/* Requirement 4: Badge alert on Members Approval when there are pending approvals */}
                  {pendingApprovalsCount > 0 && (
                    <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold">
                      {pendingApprovalsCount}
                    </span>
                  )}
                </button>
              </div>
            )}

          </div>

          {/* Footer toggle button to shrink/expand */}
          <div className="p-4 border-t border-slate-100 space-y-2">
            {onOpenSettings && (
              <button
                id="open-settings-btn-sidebar"
                onClick={onOpenSettings}
                className={`w-full flex items-center rounded-xl p-3 text-xs font-bold transition-all gap-3 cursor-pointer ${
                  sidebarExpanded ? "justify-start px-3" : "justify-center px-0"
                } text-slate-600 hover:bg-slate-50 hover:text-slate-900`}
                title="ตั้งค่าข้อมูลส่วนตัว"
              >
                <Settings className="h-5 w-5 shrink-0" />
                {sidebarExpanded && <span>ตั้งค่าโปรไฟล์</span>}
              </button>
            )}

            <button
              id="logout-btn-sidebar"
              onClick={logOut}
              className={`w-full flex items-center rounded-xl p-3 text-xs font-bold transition-all gap-3 cursor-pointer ${
                sidebarExpanded ? "justify-start px-3" : "justify-center px-0"
              } text-slate-600 hover:bg-rose-50 hover:text-rose-600`}
              title="ออกจากระบบ"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {sidebarExpanded && <span>ออกจากระบบ</span>}
            </button>

            <button 
              onClick={toggleSidebar}
              className="w-full flex items-center justify-center rounded-xl p-2 bg-slate-50 border border-slate-100 text-slate-500 hover:text-slate-900 transition-all cursor-pointer hover:bg-slate-100"
              title={sidebarExpanded ? "ยุบแถบด้านข้าง" : "ขยายแถบด้านข้าง"}
            >
              {sidebarExpanded ? (
                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                  <ChevronLeft className="h-4 w-4" />
                  <span>ย่อหน้าต่าง</span>
                </div>
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </aside>
      )}

      {/* ==================================================== */}
      {/*               MOBILE SIDEBAR DRAWER SLIDE-OUT        */}
      {/* ==================================================== */}
      {user && !isTakingQuiz && mobileDrawerOpen && (
        <div id="mobile-drawer-layer" className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer content box */}
          <div className="relative w-72 max-w-xs bg-white h-full flex flex-col justify-between p-5 z-10 shadow-2xl animate-scale-up text-left">
            <div className="space-y-6">
              
              {/* Header inside drawer */}
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <div className="flex items-center space-x-2">
                  <WitsivaLogo className="h-8 w-8 shrink-0" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900 leading-none">แบบฝึกหัดครูผู้ช่วย By วิทย์สิว่ะ</h3>
                    <p className="text-[9px] text-slate-400 mt-0.5">ระบบติวสอบพรีเมียมคอร์ส</p>
                  </div>
                </div>

                <button 
                  onClick={() => setMobileDrawerOpen(false)}
                  className="rounded-lg p-1 hover:bg-slate-100 text-slate-400 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Links List inside Drawer */}
              <div className="space-y-2">
                <button
                  onClick={() => navigateTo("home")}
                  className={`w-full flex items-center rounded-xl p-3 text-xs font-bold gap-3 cursor-pointer ${
                    currentTab === "home" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Home className="h-5 w-5 text-slate-500" />
                  <span>หน้าแรก (ประกาศข่าวสาร)</span>
                </button>

                <button
                  onClick={() => navigateTo("quizzes")}
                  className={`w-full flex items-center justify-between rounded-xl p-3 text-xs font-bold cursor-pointer ${
                    currentTab === "quizzes" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-slate-500" />
                    <span>แบบฝึกหัดทดลองข้อสอบ</span>
                  </div>
                  {quizBadge && (
                    <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0 shadow-sm animate-pulse" />
                  )}
                </button>

                <button
                  onClick={() => navigateTo("history")}
                  className={`w-full flex items-center rounded-xl p-3 text-xs font-bold gap-3 cursor-pointer ${
                    currentTab === "history" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Award className="h-5 w-5 text-slate-500" />
                  <span>ประวัติข้อมูลสอบ</span>
                </button>

                <button
                  onClick={() => navigateTo("support")}
                  className={`w-full flex items-center justify-between rounded-xl p-3 text-xs font-bold cursor-pointer ${
                    currentTab === "support" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle className="h-5 w-5 text-slate-500" />
                    <span>ขอความช่วยเหลือ (แชท)</span>
                  </div>
                  {isAdmin && unreadChatsCount > 0 && (
                    <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold mr-1">
                      {unreadChatsCount}
                    </span>
                  )}
                </button>

                {isAdmin && (
                  <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                    <p className="text-[10px] text-slate-400 font-bold px-3 uppercase tracking-wider">ส่วนควบคุมแอดมิน</p>
                    
                    <button
                      onClick={() => navigateTo("admin")}
                      className={`w-full flex items-center rounded-xl p-3 text-xs font-bold gap-3 cursor-pointer ${
                        currentTab === "admin" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Shield className="h-5 w-5 text-indigo-600" />
                      <span>จัดการระเบียนหัวข้อ</span>
                    </button>

                    <button
                      onClick={() => navigateTo("approvals")}
                      className={`w-full flex items-center justify-between rounded-xl p-3 text-xs font-bold cursor-pointer ${
                        currentTab === "approvals" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-indigo-600" />
                        <span>อนุมัติส่งเมลพรีเมียม</span>
                      </div>
                      {pendingApprovalsCount > 0 && (
                        <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                          {pendingApprovalsCount}
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Settings, Logout and Profile banner info inside mobile drawer bottom */}
            <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
              <div className="space-y-1">
                {onOpenSettings && (
                  <button
                    id="open-settings-btn-mobile"
                    onClick={() => {
                      onOpenSettings();
                      setMobileDrawerOpen(false);
                    }}
                    className="w-full flex items-center rounded-xl p-2.5 text-xs font-bold gap-3 transition-all cursor-pointer text-slate-600 hover:bg-slate-50"
                  >
                    <Settings className="h-4.5 w-4.5 text-slate-500" />
                    <span>ตั้งค่าข้อมูลส่วนตัว</span>
                  </button>
                )}

                <button
                  id="logout-btn-mobile"
                  onClick={() => {
                    logOut();
                    setMobileDrawerOpen(false);
                  }}
                  className="w-full flex items-center rounded-xl p-2.5 text-xs font-bold gap-3 transition-all cursor-pointer text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4.5 w-4.5" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>

              <div className="border-t border-slate-100/50 pt-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-xs border border-indigo-100 uppercase shrink-0">
                  {user.email?.[0] || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate leading-none">{user.displayName || user.email?.split("@")[0]}</p>
                  <p className="text-[10px] text-slate-400 truncate mt-1 leading-none">{user.email}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
