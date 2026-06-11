import React, { useEffect, useState } from "react";
import { Award, Calendar, CheckCircle2, Clock, Mail, Search, Sparkles, User as UserIcon, Trash2 } from "lucide-react";
import { Attempt } from "../types";
import { fetchUserAttempts, deleteAttempt } from "../lib/firebase";

interface HistoryPanelProps {
  isAdmin: boolean;
}

export default function HistoryPanel({ isAdmin }: HistoryPanelProps) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await fetchUserAttempts();
      setAttempts(data);
    } catch (err) {
      console.error("Error loading attempts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Custom dialog state for deleting confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleDeleteAttempt = (attemptId: string) => {
    setDeleteId(attemptId);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await deleteAttempt(deleteId);
      setDeleteId(null);
      setNotification({ message: "ลบประวัติผลสอบสำเร็จเรียบร้อยแล้ว!", type: "success" });
      await loadHistory();
    } catch (err) {
      setNotification({ message: "ล้มเหลวในการลบสถิตินักเรียน", type: "error" });
    } finally {
      setDeleting(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Deduplicate attempts by unique id AND avoid showing identical duplicate submissions (same user, same quiz, same score, completed within 30 seconds of each other)
  const getUniqueAttempts = (rawAttempts: Attempt[]): Attempt[] => {
    const list: Attempt[] = [];
    const seenGroup = new Set<string>();

    const sorted = [...rawAttempts].sort((a, b) => {
      const timeA = a.completedAt?.seconds || 0;
      const timeB = b.completedAt?.seconds || 0;
      return timeB - timeA;
    });

    for (const item of sorted) {
      if (!item.id) continue;
      const timeSec = item.completedAt?.seconds || 0;
      // round to 30 second buckets to handle slight submission offsets
      const timeBucket = Math.floor(timeSec / 30);
      const compositeKey = `${item.userId}_${item.quizId}_${item.score}_${timeBucket}`;
      
      if (!seenGroup.has(item.id) && !seenGroup.has(compositeKey)) {
        seenGroup.add(item.id);
        seenGroup.add(compositeKey);
        list.push(item);
      }
    }
    return list;
  };

  const uniqueAttempts = getUniqueAttempts(attempts);

  const totalAttempts = uniqueAttempts.length;
  const averageScorePercent = totalAttempts > 0 
    ? Math.round((uniqueAttempts.reduce((sum, item) => sum + (item.score / item.totalQuestions), 0) / totalAttempts) * 100)
    : 0;
  
  const highestScorePercent = totalAttempts > 0
    ? Math.max(...uniqueAttempts.map(item => Math.round((item.score / item.totalQuestions) * 100)))
    : 0;

  const filteredAttempts = uniqueAttempts.filter(item => {
    const searchLow = searchTerm.toLowerCase();
    return (
      item.quizTitle.toLowerCase().includes(searchLow) ||
      item.userName.toLowerCase().includes(searchLow) ||
      item.userEmail.toLowerCase().includes(searchLow)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="absolute top-4 right-4 text-indigo-100">
            <Clock className="h-10 w-10 stroke-[1.5]" />
          </div>
          <p className="text-sm font-medium text-slate-500">จำนวนการสอบทั้งหมด</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{totalAttempts} ครั้ง</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="absolute top-4 right-4 text-emerald-100">
            <Award className="h-10 w-10 stroke-[1.5]" />
          </div>
          <p className="text-sm font-medium text-slate-500">คะแนนเฉลี่ย</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-600">{averageScorePercent}%</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="absolute top-4 right-4 text-amber-100">
            <Sparkles className="h-10 w-10 stroke-[1.5]" />
          </div>
          <p className="text-sm font-medium text-slate-500">คะแนนสูงสุดที่ทำได้</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-amber-600">{highestScorePercent}%</p>
        </div>
      </div>

      {/* History Listing */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        
        {/* Header and Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 px-6 py-5 gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-950">
              {isAdmin ? "ประวัติการส่งข้อสอบของนักเรียนทั้งหมด" : "ประวัติการทำข้อสอบของคุณ"}
            </h3>
            <p className="text-xs text-slate-500">
              {isAdmin 
                ? "แสดงคะแนนสอบของทุกคนแบบเรียลไทม์ พร้อมข้อมูลรายละเอียดในการตอบ" 
                : "ตรวจสอบวิชาและชุดทดสอบที่คุณเคยทำเพื่อประเมินความก้าวหน้า"
              }
            </p>
          </div>
          
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาข้อสอบ, ชื่อนักเรียน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-4 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white"
            />
          </div>
        </div>

        {/* List Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
            <p className="text-sm text-slate-500">กำลังดึงข้อมูลคะแนน...</p>
          </div>
        ) : filteredAttempts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-slate-300 stroke-[1.2]" />
            <p className="mt-3 text-sm font-semibold text-slate-900">ไม่พบประวัติผลสอบ</p>
            <p className="text-xs text-slate-500 mt-1">
              {searchTerm ? "โปรดลองค้นหาด้วยรหัสวิชาหรือคำค้นหาอื่น" : "คุณยังไม่เริ่มทำข้อสอบวิชาใดๆ"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-4">วิชาที่สอบ</th>
                  {isAdmin && <th scope="col" className="px-6 py-4">นักเรียน</th>}
                  <th scope="col" className="px-6 py-4">คะแนน</th>
                  <th scope="col" className="px-6 py-4">ระดับเปอร์เซ็นต์</th>
                  <th scope="col" className="px-6 py-4">วัน-เวลาที่สอบ</th>
                  {isAdmin && <th scope="col" className="px-6 py-4 text-center">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredAttempts.map((item) => {
                  const percent = Math.round((item.score / item.totalQuestions) * 100);
                  let badgeColor = "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
                  if (percent < 50) badgeColor = "bg-rose-50 text-rose-700 ring-rose-600/10";
                  else if (percent < 80) badgeColor = "bg-amber-50 text-amber-700 ring-amber-600/10";

                  // Convert Timestamp to readable Thai date format
                  const dateObj = item.completedAt?.toDate ? item.completedAt.toDate() : new Date();
                  const dateText = dateObj.toLocaleDateString("th-TH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  });

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="font-semibold text-slate-900">{item.quizTitle}</div>
                        <div className="text-xs text-slate-500">รหัสสอบ: {item.quizId.slice(0, 8)}</div>
                      </td>
                      {isAdmin && (
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-1.5 font-medium text-slate-700">
                            <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                            <span>{item.userName}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                            <Mail className="h-3 w-3" />
                            <span>{item.userEmail}</span>
                          </div>
                        </td>
                      )}
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="text-base font-bold text-slate-900">{item.score}</span>
                        <span className="text-slate-500"> / {item.totalQuestions} คะแนน</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${badgeColor}`}>
                          {percent}% {percent >= 80 ? 'ดีเยี่ยม' : percent >= 50 ? 'ผ่านเกณฑ์' : 'ควรปรับปรุง'}
                        </span>
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                          <div 
                            className={`h-full ${percent >= 80 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-500 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{dateText}</span>
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="whitespace-nowrap px-6 py-4 text-center">
                          <button
                            onClick={() => handleDeleteAttempt(item.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-all cursor-pointer"
                            title="ลบผลการสอบตัวนี้"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> ลบออก
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Custom Alert/Notification Toast */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-fade-in">
          <div className={`rounded-xl px-4 py-3 shadow-lg border text-xs font-semibold flex items-center gap-2 ${
            notification.type === "success" 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}>
            <span className="text-sm">{notification.type === "success" ? "✅" : "❌"}</span>
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Beautiful Tailored In-App Confirmation Dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in" id="delete-confirmation-modal">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 border border-rose-100">
              <Trash2 className="h-5 w-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-950">🚨 ยืนยันการลบประวัติผลสอบสวน</h3>
              <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                คุณมั่นใจที่จะลบคำตอบสถิติชิ้นนี้ใช่หรือไม่? บันทึกสถิตินี้จะถูกล้างและลบออกจากระบบอย่างประเมินค่าไม่ได้ถาวรและไม่สามารถกู้คืนได้
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                disabled={deleting}
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                disabled={deleting}
              >
                {deleting ? "กำลังลบ..." : "ลบออกถาวร"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
