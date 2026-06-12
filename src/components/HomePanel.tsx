import React, { useState, useEffect } from "react";
import { Megaphone, Trash2, Calendar, FileText, Send, AlertCircle, CheckCircle, Sparkles, Upload, X } from "lucide-react";
import { auth, subscribeToAnnouncements, createAnnouncement, deleteAnnouncement, createNotification } from "../lib/firebase";

interface HomePanelProps {
  isAdmin: boolean;
  userId: string;
  userProfile?: any;
  pendingApprovalsCount?: number;
  onNavigateToTab?: (tab: "home" | "quizzes" | "admin" | "history" | "approvals" | "support") => void;
}

export default function HomePanel({ 
  isAdmin, 
  userId, 
  userProfile, 
  pendingApprovalsCount = 0, 
  onNavigateToTab 
}: HomePanelProps) {
  const isOwner = auth.currentUser?.email?.toLowerCase() === "first22960@gmail.com";
  const canCreateAnnouncement = isOwner || userProfile?.adminPermissions?.createAnnouncement !== false;

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setImageError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setImageError("ขนาดไฟล์ภาพต้องไม่เกิน 2MB");
        return;
      }
      setImageError("");
      const reader = new FileReader();
      reader.onload = () => {
        setBase64Image(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeToAnnouncements((data) => {
      setAnnouncements(data);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setStatus({ type: "error", text: "กรุณากรอกหัวข้อข่าวและรายละเอียดด้วย" });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus(null);
      
      // Save announcement in db with image if present
      await createAnnouncement(title.trim(), content.trim(), base64Image || "");
      
      // Notify all members of new announcement
      await createNotification(`📢 ประกาศข่าวสารใหม่: ${title.trim()}`, "new_announcement", "all");

      setTitle("");
      setContent("");
      setBase64Image(null);
      setImageError("");
      setStatus({ type: "success", text: "เผยแพร่ข่าวสารประชาสัมพันธ์และแจ้งเตือนผู้เตรียมสอบเรียบร้อยแล้ว!" });
      setTimeout(() => setStatus(null), 4000);
    } catch (err: any) {
      console.error(err);
      setStatus({ type: "error", text: "ไม่สามารถบันทึกประกาศข่าวสารได้: " + (err.message || String(err)) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string, annTitle: string) => {
    setConfirmDelete({ id, title: annTitle });
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteAnnouncement(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err: any) {
      console.error(err);
      setStatus({ type: "error", text: "ลบไม่สำเร็จ: " + (err.message || String(err)) });
      setTimeout(() => setStatus(null), 4000);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-1 sm:px-2">
      {/* Aesthetic Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-indigo-600 via-indigo-700 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-indigo-150">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-12 -mb-12 h-40 w-40 rounded-full bg-slate-500/10 blur-3xl"></div>
        
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-indigo-100 ring-1 ring-inset ring-white/10 uppercase">
              <Sparkles className="h-3 w-3 text-amber-300 fill-amber-300" /> ข่าวสาร & อัปเดตล่าสุด
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">กระดานประกาศสอบครูผู้ช่วย</h2>
            <p className="text-xs sm:text-sm text-indigo-100 max-w-xl leading-relaxed">
              ติดตามประกาศสำคัญจากผู้ดูแลระบบ ข้อมูลแนวข้อสอบ และเกณฑ์กติกาสอบราชการที่อัปเดตแบบเรียลไทม์ที่นี่!
            </p>
          </div>
          
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 border border-white/10 text-white shrink-0 self-end md:self-center">
            <Megaphone className="h-6 w-6 stroke-[1.8] animate-bounce" />
          </div>
        </div>
      </div>

      {/* Real-time Dashboard Notification for Admin Approvals (Requirement 5) */}
      {isAdmin && pendingApprovalsCount > 0 && (
        <div id="pending-approvals-alert" className="relative overflow-hidden rounded-2xl border border-red-150 bg-red-50/50 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-scale-up">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 border border-red-200">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-red-950 flex items-center gap-1.5 matches-font">
                ⚠️ มีคำขอสมัครสมาชิกใหม่ค้างอนุมัติสิทธิ์เข้าเรียน!
              </h4>
              <p className="text-[11px] text-red-800 leading-normal mt-1 font-bold">
                มีจำนวน <span className="text-red-600 font-extrabold text-xs underline decoration-2">{pendingApprovalsCount} บัญชี</span> ที่กำลังรอให้สิทธิ์อนุมัติเข้าใช้งานระบบเรียน/ทำข้อสอบอยู่เป็นทางการขณะนี้
              </p>
            </div>
          </div>
          
          <button
            onClick={() => onNavigateToTab?.("approvals")}
            className="self-start sm:self-center bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-[11px] px-4 py-2 rounded-xl border border-red-700/30 transition-all font-semibold italic cursor-pointer shadow-sm shrink-0 inline-flex items-center gap-1.5"
          >
            <span>อนุมัติและจัดการสิทธิ์ทันที</span>
            <span>→</span>
          </button>
        </div>
      )}

      {/* Admin Broadcast Creation Form */}
      {isAdmin && (
        canCreateAnnouncement ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-50 pb-3 flex items-center gap-2">
              <div className="h-6 w-1 bg-indigo-600 rounded-full"></div>
              <h3 className="text-sm font-bold text-slate-800">✍️ ส่งประกาศข่าวสารใหม่ (แผงควบคุมฝ่ายบริหาร)</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
              {status && (
                <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                  status.type === "success" 
                    ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                    : "bg-rose-50 border-rose-100 text-rose-800"
                }`}>
                  {status.type === "success" ? <CheckCircle className="h-4.5 w-4.5 shrink-0" /> : <AlertCircle className="h-4.5 w-4.5 shrink-0" />}
                  <p className="text-xs font-semibold">{status.text}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-slate-700 font-bold">หัวข้อข่าว / หัวเรื่องสำคัญ</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ระบุหัวข้อที่น่าสนใจ เช่น ประกาศรอบสอบ คอร์สเก็งข้อสอบใหม่ เป็นต้น..."
                  className="w-full rounded-xl border border-slate-200 outline-hidden py-2 px-3 text-xs focus:border-indigo-500 transition-all font-semibold text-slate-800"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-slate-700 font-bold">รายละเอียดประชาสัมพันธ์</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="พิมพ์รายระเอียดข่าวสารที่จะแชร์ให้กับสมาชิกผู้เตรียมสอบทราบ..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 outline-hidden py-2 px-3 text-xs focus:border-indigo-500 transition-all font-medium text-slate-700"
                  maxLength={2000}
                />
              </div>

              {/* Image Uploader */}
              <div className="space-y-2">
                <label className="block text-slate-700 font-bold">รูปภาพประกอบประกาศ (ถ้ามี)</label>
                
                {!base64Image ? (
                  <div 
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        if (!file.type.startsWith("image/")) {
                          setImageError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
                          return;
                        }
                        if (file.size > 2 * 1024 * 1024) {
                          setImageError("ขนาดไฟล์ภาพต้องไม่เกิน 2MB");
                          return;
                        }
                        setImageError("");
                        const reader = new FileReader();
                        reader.onload = () => {
                          setBase64Image(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 text-center cursor-pointer hover:bg-slate-50 transition-all space-y-2"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-indigo-600">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="text-xs text-slate-600">
                      <strong className="text-indigo-600 font-bold">คลิกอัปโหลดรูปภาพ</strong> หรือลากและวางรูปภาพที่นี่
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">รองรับไฟล์ภาพ JPEG, PNG, WEBP ขนาดไม่เกิน 2MB</p>
                  </div>
                ) : (
                  <div className="relative border border-slate-100 rounded-2xl overflow-hidden bg-slate-50 p-2 flex items-center gap-3 w-full">
                    <img 
                      src={base64Image} 
                      alt="Preview" 
                      className="h-16 w-16 object-cover rounded-xl border border-slate-200"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">แนบรูปภาพประชาสัมพันธ์เรียบร้อยแล้ว</p>
                      <p className="text-[10px] text-slate-400 font-medium">พร้อมบันทึกคู่กับหัวข้อข่าวสาร</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBase64Image(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer mr-2"
                    >
                      <X className="h-4.5 w-4.5" />
                    </button>
                  </div>
                )}
                
                {imageError && (
                  <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{imageError}</span>
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>เผยแพร่ข่าวสารประชาสัมพันธ์</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="rounded-3xl border border-rose-150 bg-rose-50/40 p-6 flex items-start gap-4 shadow-xs">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 border border-rose-100 shrink-0">
              <AlertCircle className="h-5.5 w-5.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-rose-950">🔒 ฟังก์ชันเขียนประกาศข่าวถูกจำกัดสิทธิ์ใช้งาน</h4>
              <p className="text-[11px] text-rose-800 leading-relaxed mt-1 font-semibold">
                คุณสามารถทำหน้าที่บริหารจัดการข้อมูลชุดข้อสอบอื่นได้ แต่อำนาจเด็ดขาดในส่วน "เขียน/เผยแพร่ข่าวสารประชาสัมพันธ์" และส่งแจ้งเตือนให้กับนักเรียนได้รับการตั้งค่าระงับการตรวจสอบสิทธิ์โดยตรงจากเจ้าของลิขสิทธิ์ระบบอย่างเป็นทางการ (Super Admin - คุณเฟิร์ส)
              </p>
            </div>
          </div>
        )
      )}

      {/* Announcements Stream Card List */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-500 tracking-wider uppercase">ประกาศปัจจุบัน ({announcements.length})</h3>
        
        {announcements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400 space-y-3">
            <FileText className="h-10 w-10 mx-auto text-slate-200" />
            <p className="text-xs font-bold text-slate-700">ไม่มีประกาศข่าวสารในขณะนี้</p>
            <p className="text-[11px] text-slate-400">เนื้อหาอัปเดตและสลิปความรู้จะปรากฏตรงนี้เมื่อแอดมินเริ่มลงประกาศ</p>
          </div>
        ) : (
          announcements.map((ann) => {
            const formattedDate = ann.createdAt 
              ? new Date(ann.createdAt.seconds * 1000).toLocaleString("th-TH") 
              : "กำลังประมวลวันที่...";

            return (
              <div 
                key={ann.id} 
                className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-all relative group"
              >
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(ann.id, ann.title)}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="ลบประกาศข่าวสารนี้"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}

                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                    <Calendar className="h-3.5 w-3.5 text-slate-300" />
                    <span>{formattedDate}</span>
                    <span className="text-slate-200">•</span>
                    <span>Admin</span>
                  </div>

                  <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                    {ann.title}
                  </h4>

                  <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-medium">
                    {ann.content}
                  </p>

                  {ann.imageUrl && (
                    <div className="mt-3.5 border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50 flex items-center justify-center max-w-2xl shadow-xxs">
                      <img 
                        src={ann.imageUrl} 
                        alt={ann.title} 
                        className="max-h-96 w-full object-contain rounded-2xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Beautiful Admin Announcement Deletion Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in" id="announcement-delete-confirmation-modal">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 border border-rose-100 animate-pulse">
              <Trash2 className="h-5 w-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-950">🚨 ยืนยันการลบประกาศข่าวสาร</h3>
              <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                คุณแน่ใจหรือไม่ว่าต้องการลบประกาศเรื่อง <strong className="text-slate-900">"{confirmDelete.title}"</strong> บันทึกประวัตินี้จะหายไปถาวร
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={executeDelete}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                ลบออกถาวร
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
