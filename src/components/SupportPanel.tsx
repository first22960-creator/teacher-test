import React, { useState, useEffect, useRef } from "react";
import { Send, LogIn, Sparkles, Smile, ShieldAlert, MessageCircle, User, Clock, Check, Inbox, Search, Trash2, Paperclip, Image, X, Maximize2, CheckCircle, RefreshCw } from "lucide-react";
import { onSnapshot, doc } from "firebase/firestore";
import { 
  auth, 
  sendSupportMessage, 
  subscribeToUserMessages, 
  subscribeToAllChats, 
  markChatAsReadInDB,
  deleteSupportChat,
  deleteSupportMessage,
  resolveSupportChat,
  reopenSupportChat,
  db
} from "../lib/firebase";

interface SupportPanelProps {
  isAdmin: boolean;
  userProfile?: any;
}

export default function SupportPanel({ isAdmin, userProfile }: SupportPanelProps) {
  const user = auth.currentUser;
  const currentUserId = user?.uid || "";
  const currentUserName = userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "ผู้ใช้ค้างสิทธิ์";

  // State for standard student view
  const [userMessages, setUserMessages] = useState<any[]>([]);
  const [userText, setUserText] = useState("");
  const [userSending, setUserSending] = useState(false);
  const [userImage, setUserImage] = useState<string | null>(null);

  // State for admin view
  const [allChats, setAllChats] = useState<any[]>([]);
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null);
  const [selectedChatMessages, setSelectedChatMessages] = useState<any[]>([]);
  const [adminText, setAdminText] = useState("");
  const [adminSending, setAdminSending] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminImage, setAdminImage] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<"active" | "resolved">("active");

  // Lightbox Image viewer modal
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Student's own chat status document from DB
  const [userChatDoc, setUserChatDoc] = useState<any | null>(null);

  // Confirmation Modal and Delete Logic State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "chat" | "message" | "resolve";
    chatId: string;
    messageId?: string;
    title: string;
    description: string;
  }>({
    isOpen: false,
    type: "chat",
    chatId: "",
    messageId: "",
    title: "",
    description: ""
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, role: "user" | "admin") => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("กรุณาเลือกไฟล์ภาพประเภท JPG, JPEG, PNG หรือ WEBP เท่านั้น");
      return;
    }
    
    // Check size, e.g. < 1.5MB to be safe for firestore payload limits
    if (file.size > 1.5 * 1024 * 1024) {
      alert("ขนาดไฟล์ภาพต้องไม่เกิน 1.5 MB เพื่อความรวดเร็วในการส่งข้อมูล");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (role === "admin") {
        setAdminImage(base64);
      } else {
        setUserImage(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInitiateDeleteChat = (e: React.MouseEvent, chatId: string, isFromAdmin: boolean) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      type: "chat",
      chatId,
      messageId: "",
      title: isFromAdmin ? "⚠️ ลบการสนทนาทั้งหมด?" : "⚠️ ลบประวัติการสนทนาส่วนตัว?",
      description: isFromAdmin 
        ? "คุณแน่ใจหรือไม่ว่าต้องการลบห้องสนทนานี้และข้อความย่อยทั้งหมดอย่างถาวร? การดำเนินการนี้ไม่สามารถย้อนกลับได้"
        : "คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการสนทนาส่วนตัวทั้งหมด? ข้อความทั้งหมดจะถูกลบออกจากทั้งหน้าจอของคุณและระบบหลังบ้านอย่างถาวร"
    });
  };

  const handleInitiateResolveChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      type: "resolve",
      chatId,
      messageId: "",
      title: "✅ ยืนยันเครื่องหมายแก้ไขปัญหาเสร็จสมบูรณ์?",
      description: "เมื่อเปลี่ยนสถานะเป็นได้รับการแก้ไขแล้ว (Resolved) บทสนทนานี้จะย้ายไปเก็บที่แถบประวัติประเมินผลหลังบ้าน ทั้งคุณและแอดมินคนอื่นๆ เพื่อความสะอาดเรียบร้อยของหน้าจอทำงาน"
    });
  };

  const handleInitiateDeleteMessage = (chatId: string, messageId: string) => {
    setConfirmModal({
      isOpen: true,
      type: "message",
      chatId,
      messageId,
      title: "ลบข้อความนี้?",
      description: "คุณแน่ใจหรือไม่ว่าต้องการลบข้อความที่เลือกนี้? ข้อความจะหายไปในทันทีของระบบแชททั้งสองฝ่าย"
    });
  };

  const handleConfirmDelete = async () => {
    const { chatId, messageId, type } = confirmModal;
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    try {
      if (type === "chat") {
        await deleteSupportChat(chatId);
        // If we are deleting the active chat in administrator view, reset selection
        if (isAdmin && selectedChatUserId === chatId) {
          setSelectedChatUserId(null);
        }
      } else if (type === "message" && messageId) {
        await deleteSupportMessage(chatId, messageId);
      } else if (type === "resolve") {
        await resolveSupportChat(chatId);
      }
    } catch (err) {
      console.error("Error confirming deletion / action:", err);
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to student's own chat messages
  useEffect(() => {
    if (isAdmin || !currentUserId) return;
    
    // Mark as read when entering
    markChatAsReadInDB(currentUserId, "user");

    const unsubscribe = subscribeToUserMessages(currentUserId, (msgs) => {
      setUserMessages(msgs);
    });

    return () => unsubscribe();
  }, [isAdmin, currentUserId]);

  // Subscribe to student's own support chat status document
  useEffect(() => {
    if (isAdmin || !currentUserId) return;

    const chatRef = doc(db, "support_chats", currentUserId);
    const unsubscribeDoc = onSnapshot(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        setUserChatDoc(snapshot.data());
      } else {
        setUserChatDoc(null);
      }
    });

    return () => unsubscribeDoc();
  }, [isAdmin, currentUserId]);

  // Subscribe to all chats list for Admin view
  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribe = subscribeToAllChats((chats) => {
      setAllChats(chats);
      
      // Auto select first chat if none is selected, or if current selection was deleted
      if (chats.length > 0) {
        if (!selectedChatUserId || !chats.some(c => c.userId === selectedChatUserId)) {
          setSelectedChatUserId(chats[0].userId);
        }
      } else {
        setSelectedChatUserId(null);
      }
    });

    return () => unsubscribe();
  }, [isAdmin, selectedChatUserId]);

  // Subscribe to selected user's chat messages for Admin
  useEffect(() => {
    if (!isAdmin || !selectedChatUserId) {
      setSelectedChatMessages([]);
      return;
    }

    // Mark as read by admin when viewing
    markChatAsReadInDB(selectedChatUserId, "admin");

    const unsubscribe = subscribeToUserMessages(selectedChatUserId, (msgs) => {
      setSelectedChatMessages(msgs);
    });

    return () => unsubscribe();
  }, [isAdmin, selectedChatUserId]);

  // Scroll to bottom helper
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [userMessages, selectedChatMessages]);

  // Student send message handler
  const handleUserSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!userText.trim() && !userImage) || !currentUserId) return;

    try {
      setUserSending(true);
      await sendSupportMessage(currentUserId, currentUserName, userText.trim(), "user", userImage || undefined);
      setUserText("");
      setUserImage(null);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setUserSending(false);
    }
  };

  // Admin send message handler
  const handleAdminSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!adminText.trim() && !adminImage) || !selectedChatUserId) return;

    const targetChat = allChats.find(c => c.userId === selectedChatUserId);
    const targetName = targetChat?.userName || "ผู้สอบ";

    try {
      setAdminSending(true);
      await sendSupportMessage(selectedChatUserId, targetName, adminText.trim(), "admin", adminImage || undefined);
      setAdminText("");
      setAdminImage(null);
    } catch (err) {
      console.error("Failed to send admin message:", err);
    } finally {
      setAdminSending(false);
    }
  };

  const filteredChats = allChats.filter(chat => {
    const isResolved = chat.status === "resolved";
    const matchesTab = adminTab === "resolved" ? isResolved : !isResolved;
    if (!matchesTab) return false;

    return (
      chat.userName?.toLowerCase().includes(adminSearch.toLowerCase()) ||
      chat.userEmail?.toLowerCase().includes(adminSearch.toLowerCase()) ||
      chat.lastMessageText?.toLowerCase().includes(adminSearch.toLowerCase())
    );
  });

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 text-center bg-white border border-slate-100 p-8 rounded-3xl shadow-xs space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500 border border-rose-100">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">กรุณาเข้าสู่ระบบกก่อนเข้าใช้งานแผงสนทนา</h3>
        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
          เพื่อความรวดเร็วและคุ้มครองข้อมูลส่วนบุคคลของท่าน กรุณาอินบ็อกซ์เข้ามาสอบถามทางข้อความติวหลังตรวจสอบสิทธิ์
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Visual Header */}
      <div className="relative overflow-hidden rounded-3xl bg-indigo-900 p-6 sm:p-7 text-white shadow-lg space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-indigo-100 uppercase">
          <Sparkles className="h-3 w-3 text-amber-300 animate-pulse" /> ห้องคุยติดต่อแอดมินแบบเรียลไทม์
        </span>
        <h2 className="text-lg sm:text-xl font-black">💬 ฝ่ายบริการสนับสนุนและวิทยากรสอนเตรียมสอบครูผู้ช่วย</h2>
        <p className="text-xs text-indigo-100 max-w-xl leading-relaxed">
          มีคำถามเกี่ยวกับเนื้อหา เกณฑ์รอบสอบ ระบบสมัครหลักสูตรพรีเมียม หรือพบจุดข้อผิดพลาดของข้อสอบ? ส่งอินบ็อกซ์ข้อความหาทีมผู้ดูแลที่ออนไลน์ได้ทันทีตลอด 24 ชม.!
        </p>
      </div>

      {isAdmin ? (
        /* ==================================================== */
        /*                 ADMINISTRATIVE CHAT SYSTEM           */
        /* ==================================================== */
        <div className="grid grid-cols-1 md:grid-cols-12 rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden h-[600px]">
          
          {/* Left Panel: Chat List */}
          <div className="md:col-span-4 border-r border-slate-100 flex flex-col bg-slate-50/50">
            <div className="p-4 border-b border-slate-100 bg-white">
              <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">ค้นหาแชทลูกศิษย์ ({filteredChats.length})</label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาด้วยชื่อ, อีเมล หรือข้อความ..."
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-4 text-xs font-semibold outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              {/* Segmented Control Tabs */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mt-3">
                <button
                  type="button"
                  onClick={() => setAdminTab("active")}
                  className={`py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                    adminTab === "active"
                      ? "bg-white text-indigo-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  ห้องสนทนา ({allChats.filter(c => c.status !== "resolved").length})
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab("resolved")}
                  className={`py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                    adminTab === "resolved"
                      ? "bg-white text-indigo-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  แก้ไขแล้ว ({allChats.filter(c => c.status === "resolved").length})
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredChats.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <Inbox className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">ไม่มีหัวข้อสนทนาที่สอดคล้อง</p>
                </div>
              ) : (
                filteredChats.map((chat) => {
                  const isActive = selectedChatUserId === chat.userId;
                  const isUnread = chat.unreadByAdmin === true;

                  return (
                    <div
                      key={chat.userId}
                      onClick={() => setSelectedChatUserId(chat.userId)}
                      className={`w-full text-left p-4 flex gap-3 transition-colors cursor-pointer relative items-start group ${
                        isActive ? "bg-indigo-50/50 border-l-4 border-indigo-600" : "bg-white hover:bg-slate-100/40"
                      }`}
                    >
                      <div className="h-9 w-9 rounded-full bg-slate-200 text-slate-700 border border-slate-100 flex items-center justify-center font-bold text-xs shrink-0 uppercase animate-fade-in">
                        {chat.userName?.[0] || chat.userEmail?.[0] || "U"}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex justify-between items-center">
                          <p className={`text-xs truncate ${isUnread ? "font-extrabold text-slate-900" : "font-semibold text-slate-800"}`}>
                            {chat.userName}
                          </p>
                          <span className="text-[9px] text-slate-400 font-mono font-bold group-hover:opacity-0 transition-opacity">
                            {chat.lastMessageAt ? new Date(chat.lastMessageAt.seconds * 1000).toLocaleTimeString("th-TH") : ""}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{chat.userEmail}</p>
                        <p className={`text-[11px] truncate whitespace-nowrap block ${isUnread ? "text-indigo-900 font-bold" : "text-slate-500 font-medium"}`}>
                          {chat.lastMessageText || "ส่งงานแนบ..."}
                        </p>
                      </div>

                      {/* Delete chat button */}
                      <button
                        type="button"
                        onClick={(e) => handleInitiateDeleteChat(e, chat.userId, true)}
                        className="opacity-0 group-hover:opacity-100 absolute top-3.5 right-3.5 bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg border border-rose-100 transition-all cursor-pointer shadow-xs z-10 animate-fade-in"
                        title="ลบการสนทนานี้ถาวร"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>

                      {isUnread && (
                        <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0 self-center absolute right-3 mt-1.5 animate-pulse group-hover:opacity-0 transition-opacity" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Chat Thread Messages */}
          <div className="md:col-span-8 flex flex-col bg-white">
            {selectedChatUserId ? (
              <>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 leading-none">
                        {allChats.find(c => c.userId === selectedChatUserId)?.userName || "กำลังอัปเดต..."}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">ID: {selectedChatUserId}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Resolution status badge or button */}
                    {allChats.find(c => c.userId === selectedChatUserId)?.status === "resolved" ? (
                      <div className="flex flex-col items-end">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[10px] font-black border border-emerald-100 shadow-xxs">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>แก้ไขลุล่วงแล้ว</span>
                        </span>
                        {allChats.find(c => c.userId === selectedChatUserId)?.resolvedAt && (
                          <span className="text-[8px] text-slate-400 font-mono font-bold mt-1">
                            {new Date(allChats.find(c => c.userId === selectedChatUserId).resolvedAt.seconds * 1000).toLocaleString("th-TH")}
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleInitiateResolveChat(e, selectedChatUserId)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 text-xs font-black transition-all cursor-pointer shadow-xs animate-fade-in"
                        title="ทำเครื่องหมายว่าได้รับการแก้ไขแล้ว"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>ปิดการสนทนา</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleInitiateDeleteChat(e, selectedChatUserId, true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs animate-fade-in"
                      title="ลบห้องสนทนานี้ทั้งหมด"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>ลบแชท</span>
                    </button>
                  </div>
                </div>

                {/* Messages Panel */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
                  {selectedChatMessages.map((msg) => {
                    const isAdminMsg = msg.senderRole === "admin";
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isAdminMsg ? "items-end" : "items-start"} group/msg relative`}
                      >
                        <div className={`flex items-center gap-2 ${isAdminMsg ? "flex-row-reverse" : "flex-row"}`}>
                          <div
                            className={`max-w-[75%] rounded-2xl p-3 shadow-xxs font-sans text-xs ${
                              isAdminMsg
                                ? "bg-slate-900 text-slate-100 rounded-tr-none"
                                : "bg-white border border-slate-100 text-slate-800 rounded-tl-none font-medium"
                            }`}
                          >
                            {/* Render image attachment if exists */}
                            {msg.imageUrl && (
                              <div 
                                onClick={() => setLightboxImage(msg.imageUrl)}
                                className="relative group max-w-sm rounded-xl overflow-hidden shadow-xxs border border-slate-100 bg-slate-50 cursor-zoom-in mb-1.5"
                              >
                                <img src={msg.imageUrl} alt="ภากแนบช่วยเหลือ" className="w-full max-h-56 object-cover hover:scale-[1.02] transition-all duration-200" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 flex items-center justify-center transition-all">
                                  <Maximize2 className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            )}

                            {msg.text && (
                              <p className="whitespace-pre-wrap leading-relaxed font-semibold">{msg.text}</p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleInitiateDeleteMessage(selectedChatUserId, msg.id)}
                            className="opacity-80 md:opacity-0 group-hover/msg:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all duration-155 cursor-pointer"
                            title="ลบข้อความนี้"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono scale-90 mt-1 block px-1">
                          {msg.senderName} • {msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString("th-TH") : "เมื่อสักครู่"}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Sender Form */}
                <div className="border-t border-slate-100 bg-white">
                  {/* Image upload preview */}
                  {adminImage && (
                    <div className="px-4 pt-3 flex items-center gap-2 animate-fade-in">
                      <div className="relative rounded-lg overflow-hidden border border-slate-200 h-16 w-16 group shadow-xxs bg-slate-50">
                        <img src={adminImage} className="h-full w-full object-cover" alt="พรีวิวรูปถาพ" />
                        <button
                          type="button"
                          onClick={() => setAdminImage(null)}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="ยกเลิกการแนบรูปภาพ"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-bold animate-pulse">แนบรูปภาพสำหรับการพรีวิวเรียบร้อย (กดคลิกรูปเพื่อลบ)</span>
                    </div>
                  )}

                  <form onSubmit={handleAdminSend} className="p-4 flex gap-2 items-center">
                    <label className="bg-slate-50 border border-slate-200 rounded-xl h-10 aspect-square flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all cursor-pointer grow-0 shrink-0 shadow-xxs">
                      <Image className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageChange(e, "admin")}
                      />
                    </label>

                    <input
                      type="text"
                      placeholder={adminImage ? "พิมพ์คำบรรยายในภาพ (ไม่บังคับ)..." : "พิมพ์ตอบกลับผู้ใช้งาน ค้นหาแนวร่วมเฉลยที่นี่..."}
                      value={adminText}
                      onChange={(e) => setAdminText(e.target.value)}
                      required={!adminImage}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-2 px-4 shadow-xxs text-xs outline-none focus:border-indigo-500 font-medium h-10 text-slate-800"
                    />
                    <button
                      type="submit"
                      disabled={adminSending}
                      className="bg-indigo-600 text-white rounded-xl aspect-square h-10 flex items-center justify-center hover:bg-indigo-500 transition-colors disabled:opacity-50 cursor-pointer shrink-0 shadow-sm"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                <MessageCircle className="h-12 w-12 text-slate-200" />
                <p className="text-xs font-bold text-slate-700">ยินดีต้อนรับสู่ศูนย์บริการติวเตอร์แอดมิน</p>
                <p className="text-[11px] text-slate-450 max-w-sm">กรุณาเลือกช่องแชทลูกศิษย์หรือคนลงทะเบียนจากแถบเครื่องมือซ้ายมือเพื่อเริ่มการสนทนาโต้ตอบตอบคำถามประยุกต์</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================================================== */
        /*                 STUDENT / END USER CHAT VIEW         */
        /* ==================================================== */
        (() => {
          const isResolved = userChatDoc?.status === "resolved";
          const resolvedAt = userChatDoc?.resolvedAt;

          return (
            <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden flex flex-col h-[550px]">
              {/* Thread header */}
              <div className="p-4 border-b border-indigo-50 bg-indigo-50/10 flex items-center justify-between animate-fade-in text-slate-800">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isResolved ? "bg-amber-400" : "bg-emerald-400"}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isResolved ? "bg-amber-500" : "bg-emerald-500"}`}></span>
                  </span>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 leading-none">
                      {isResolved ? "ห้องแนะแนว (ได้รับการแก้ไขปัญหาแล้ว)" : "เจ้าหน้าที่แนะแนวและผู้ดูแลระบบออนไลน์"}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">ยินดีไขข้อข้องใจเรื่องบทเรียนเฉลยและระบบธุรกรรม</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Student Resolve Option */}
                  {userMessages.length > 0 && !isResolved && (
                    <button
                      type="button"
                      onClick={(e) => handleInitiateResolveChat(e, currentUserId)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 text-xs font-black transition-all cursor-pointer shadow-xs animate-fade-in"
                      title="ทำเครื่องหมายเสร็จสิ้นแก้ไขปัญหา"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>สิ้นสุดการสนทนา</span>
                    </button>
                  )}

                  {userMessages.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => handleInitiateDeleteChat(e, currentUserId, false)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-sm animate-fade-in"
                      title="ลบประวัติแนะนำทั้งหมด"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>ลบประวัติแชท</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Messages stage */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3.5 bg-slate-50/30">
                {userMessages.length === 0 ? (
                  <div className="py-20 text-center text-slate-450 space-y-3">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-700">เริ่มพิมพ์ส่งคำถามแรกของคุณหาแอดมินได้เลยครับ!</p>
                      <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                        พิมพ์ข้อความฝากหลักเกณฑ์รอบข้อสอบ, ปัญหาการอัปโหลดไฟล์ หรือข้อแนะแนวที่อยากปรึกษา ระบบแชทเฉลยด่วนหลังบ้านจะสลักส่งตรงเข้าเตือนมือถือของกลุ่มแอดมินทันที
                      </p>
                    </div>
                  </div>
                ) : (
                  userMessages.map((msg) => {
                    const isMe = msg.senderRole === "user";
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"} group/msg relative`}
                      >
                        <div className={`flex items-center gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                          <div
                            className={`max-w-[80%] rounded-2xl p-3.5 text-xs shadow-xxs ${
                              isMe
                                ? "bg-indigo-600 text-white rounded-tr-none font-bold text-right"
                                : "bg-white border border-slate-100 text-slate-800 rounded-tl-none font-medium text-left"
                            }`}
                          >
                            {/* Embedded picture attachment */}
                            {msg.imageUrl && (
                              <div 
                                onClick={() => setLightboxImage(msg.imageUrl)}
                                className="relative group max-w-sm rounded-xl overflow-hidden shadow-xxs border border-slate-100 bg-slate-50 cursor-zoom-in mb-1.5"
                              >
                                <img src={msg.imageUrl} alt="ภากแนบช่วยเหลือ" className="w-full max-h-56 object-cover hover:scale-[1.02] transition-all duration-200" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 flex items-center justify-center transition-all">
                                  <Maximize2 className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            )}

                            {msg.text && (
                              <p className="whitespace-pre-wrap leading-relaxed text-left">{msg.text}</p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleInitiateDeleteMessage(currentUserId, msg.id)}
                            className="opacity-80 md:opacity-0 group-hover/msg:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all duration-150 cursor-pointer"
                            title="ลบข้อความนี้"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono mt-1 block px-1">
                          {isMe ? "คุณ" : "ผู้ให้คำปรึกษา"} • {msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString("th-TH") : "เมื่อครู่"}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {isResolved ? (
                /* Resolution Action Banner */
                <div className="p-5 border-t border-slate-100 bg-emerald-50/20 text-center space-y-3 animate-fade-in">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-150">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-800">การสนทนาสิ้นสุดลงและรับการทำเครื่องหมายว่าถูกแก้ไขแล้ว</h4>
                    {resolvedAt && (
                      <p className="text-[10px] text-slate-400 font-bold font-mono">
                        เมื่อ {new Date(resolvedAt.seconds * 1000).toLocaleString("th-TH")}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500 max-w-sm mx-auto font-bold leading-relaxed">
                      ขอบพระคุณที่เข้ามาติดต่อผู้ดูแลระบบ! หากมีปัญหาติดขัดอื่นๆ หรือแบบฝึกหัดสงสัยเพิ่มเติม สามารถกดเปิดข้อซักถามแชทใหม่ได้เลยครับ
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => reopenSupportChat(currentUserId)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 text-xs font-black transition-all cursor-pointer shadow-md shadow-indigo-150 border border-indigo-500 active:scale-95"
                  >
                    <RefreshCw className="h-3.5 w-3.5 animate-spin-slow" />
                    <span>🚀 เริ่มต้นข้อซักถามใหม่ (Start New Chat)</span>
                  </button>
                </div>
              ) : (
                /* User submit text box with attachment support */
                <div className="border-t border-slate-100 bg-white">
                  {/* User Image preview */}
                  {userImage && (
                    <div className="px-4 pt-3 flex items-center gap-2 animate-fade-in">
                      <div className="relative rounded-lg overflow-hidden border border-slate-200 h-16 w-16 group shadow-xxs bg-slate-50">
                        <img src={userImage} className="h-full w-full object-cover" alt="รูปภาพนำส่งรีวิว" />
                        <button
                          type="button"
                          onClick={() => setUserImage(null)}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="ยกเลิกการแนบรูปภาพ"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-bold animate-pulse">แนบรูปภาพสำหรับการพรีวิวเรียบร้อย (คลิกเพื่อลบ)</span>
                    </div>
                  )}

                  <form onSubmit={handleUserSend} className="p-4 flex gap-2 items-center">
                    <label className="bg-slate-50 border border-slate-200 rounded-xl h-10 aspect-square flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all cursor-pointer grow-0 shrink-0 shadow-xxs">
                      <Image className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageChange(e, "user")}
                      />
                    </label>

                    <input
                      type="text"
                      placeholder={userImage ? "ระบุคำบรรยายประกอบรูปภาพ (ไม่บังคับ)..." : "พิมพ์คำถามหรือข้อสงสัย ปรึกษาแอดมินได้เลยที่นี่ครับ..."}
                      value={userText}
                      onChange={(e) => setUserText(e.target.value)}
                      required={!userImage}
                      className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold outline-hidden focus:border-indigo-500 font-sans text-slate-800 bg-white h-10"
                      maxLength={1000}
                    />
                    <button
                      type="submit"
                      disabled={userSending}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 aspect-square flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer shadow-sm select-none"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* Confirmation Modal Overlay */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4 animate-scale-up">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500 border border-rose-100">
              <Trash2 className="h-5 w-5 animate-bounce" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-sm font-extrabold text-slate-900">{confirmModal.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                {confirmModal.description}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 text-xs font-bold transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white py-2.5 text-xs font-bold transition-all cursor-pointer shadow-sm shadow-rose-150"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox full-screen modal */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full cursor-pointer transition-colors border border-white/5"
          >
            <X className="h-6 w-6" />
          </button>
          <img 
            src={lightboxImage} 
            alt="ชมภาพขนาดใหญ่" 
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl animate-scale-up border border-white/10" 
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
}
