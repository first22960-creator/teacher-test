import React, { useState, useEffect } from "react";
import { Plus, Sparkles, BookOpen, Clock, Trash2, Edit3, Check, HelpCircle, FileText, LayoutGrid, CheckCircle, Users, ShieldCheck, Eye, EyeOff, Image, Search, Phone, Mail, UserCheck, XCircle, X } from "lucide-react";
import { Category, Quiz, Question } from "../types";
import { 
  auth,
  createCategory, 
  createQuiz, 
  fetchCategories, 
  deleteCategory, 
  fetchQuizzes, 
  deleteQuiz, 
  updateQuizFreeStatus,
  subscribeToUsers, 
  deleteUserAccount,
  subscribeToPayments,
  updatePaymentStatus,
  deletePayment,
  createNotification,
  updateUserApproval,
  updateUserRole,
  fetchQuestions,
  updateQuiz,
  updateAdminPermissions
} from "../lib/firebase";

interface AdminPanelProps {
  mode?: "quiz" | "approvals";
  userProfile?: any;
}

export default function AdminPanel({ mode, userProfile }: AdminPanelProps) {
  const isOwner = auth.currentUser?.email?.toLowerCase() === "first22960@gmail.com";
  const canCreateQuiz = isOwner || userProfile?.adminPermissions?.createQuiz !== false;
  const canDeleteQuiz = isOwner || userProfile?.adminPermissions?.deleteQuiz !== false;

  console.log("[AdminPanel Permission Watcher]", {
    currentUserId: auth.currentUser?.uid,
    currentUserRole: userProfile?.role,
    permissionObjectLoaded: userProfile?.adminPermissions,
    isOwner,
    createQuiz: {
      value: userProfile?.adminPermissions?.createQuiz,
      result: canCreateQuiz
    },
    deleteQuiz: {
      value: userProfile?.adminPermissions?.deleteQuiz,
      result: canDeleteQuiz
    }
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time Users presence lists
  const [usersList, setUsersList] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"quiz" | "users" | "payments">(
    mode === "approvals" ? "users" : "quiz"
  );
  const [selectedSlip, setSelectedSlip] = useState<{ id: string; img: string } | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  useEffect(() => {
    if (mode === "quiz") {
      setActiveTab("quiz");
    } else if (mode === "approvals") {
      setActiveTab("users");
    }
  }, [mode]);

  useEffect(() => {
    // Realtime users listener
    const unsubscribeUsers = subscribeToUsers((data) => {
      setUsersList(data);
    });

    // Realtime payments listener
    const unsubscribePayments = subscribeToPayments((data) => {
      setPaymentsList(data);
    });

    return () => {
      unsubscribeUsers();
      unsubscribePayments();
    };
  }, []);

  // Beautiful Custom Dialog States for Admin Panel Deletions
  const [confirmDialog, setConfirmDialog] = useState<{
    id: string;
    type: string;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
    confirmText?: string;
  } | null>(null);
  
  const [adminNotification, setAdminNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [adminActionLoading, setAdminActionLoading] = useState(false);

  const handleDeleteUser = (userId: string) => {
    setConfirmDialog({
      id: userId,
      type: "user",
      title: "🚨 ยืนยันการลบบัญชีผู้ใช้งาน",
      message: "ต้องการยกเลิกบัญชีและสิทธิ์การเข้าใช้งานของผู้ใช้นี้ใช่หรือไม่? ผู้ใช้ดังกล่าวจะไม่ปรากฏบนไดเรกทอรีแผงควบคุมหลักอีกต่อไป",
      onConfirm: async () => {
        await deleteUserAccount(userId);
      }
    });
  };

  const handleToggleApproval = async (userId: string, currentApproved: boolean) => {
    try {
      await updateUserApproval(userId, !currentApproved);
      setAdminNotification({ 
        message: `อัปเดตสิทธิ์การใช้งานบัญชีเป็น "${!currentApproved ? 'อนุมัติแล้ว' : 'ระงับ/รออนุมัติ'}" เรียบร้อย!`, 
        type: "success" 
      });
    } catch (err: any) {
      setAdminNotification({ message: err.message || "เกิดข้อผิดพลาดในการปรับสถานะ", type: "error" });
    } finally {
      setTimeout(() => setAdminNotification(null), 3000);
    }
  };

  const handleApprovePayment = async (paymentId: string, email: string) => {
    try {
      await updatePaymentStatus(paymentId, "approved");
      
      // Auto-approve the matching registered users if they exist in usersList (with same email address)
      const matchingUsers = usersList.filter(u => u.email?.trim().toLowerCase() === email.trim().toLowerCase());
      if (matchingUsers.length > 0) {
        for (const usr of matchingUsers) {
          await updateUserApproval(usr.id || usr.uid, true);
        }
        setAdminNotification({ 
          message: `อนุมัติสลิปโอนเงิน และเปิดสิทธิ์เข้าทำเว็บบันทึกชุดสอบให้ "${email}" แล้วอัตโนมัติ!`, 
          type: "success" 
        });
      } else {
        setAdminNotification({ 
          message: `อนุมัติรายงานชำระเงินเรียบร้อยแล้ว! (ผู้สมัครอีเมล ${email} จะมีสิทธิ์ทันทีที่พวกเขากดลงทะเบียนเข้ามา)`, 
          type: "success" 
        });
      }
    } catch (err: any) {
      setAdminNotification({ message: err.message || "ล้มเหลวในการอนุมัติ", type: "error" });
    } finally {
      setTimeout(() => setAdminNotification(null), 4000);
    }
  };

  const handleRejectPayment = async (paymentId: string, email: string) => {
    try {
      await updatePaymentStatus(paymentId, "rejected");

      // Set matching user to rejected paymentStatus so they can re-upload
      const matchingUsers = usersList.filter(u => u.email?.trim().toLowerCase() === email.trim().toLowerCase());
      if (matchingUsers.length > 0) {
        for (const usr of matchingUsers) {
          await updateUserApproval(usr.id || usr.uid, false, "rejected");
        }
      }

      setAdminNotification({ message: "ปฏิเสธสลิปหลักฐานแจ้งชำระเงิน และเปิดให้ผู้ใช้งานแก้ไขสลิปใหม่เรียบร้อยแล้ว", type: "success" });
    } catch (err: any) {
      setAdminNotification({ message: err.message || "ล้มเหลวในการบันทึกสถานะ", type: "error" });
    } finally {
      setTimeout(() => setAdminNotification(null), 3000);
    }
  };

  const handleDeletePayment = (paymentId: string) => {
    setConfirmDialog({
      id: paymentId,
      type: "payment",
      title: "🚨 ยืนยันการลบประวัติหลักฐานชำระเงิน",
      message: "คุณแน่ใจว่าต้องการลบประวัติหลักฐานชำระเงินรายการนี้ออกจากฐานข้อมูล? การดำเนินการนี้ไม่สามารถยกเลิกได้",
      onConfirm: async () => {
        await deletePayment(paymentId);
      },
      confirmText: "ลบประวัติออก"
    });
  };

  const handleToggleQuizFree = async (quizId: string, currentFree: boolean) => {
    try {
      const nextFree = !currentFree;
      await updateQuizFreeStatus(quizId, nextFree);
      
      // Update local quizzes state
      setQuizzes(quizzes.map(q => q.id === quizId ? { ...q, isFree: nextFree } : q));
      
      setAdminNotification({ 
        message: `ปรับสถานะชุดข้อสอบเป็น "${nextFree ? 'เปิดทำฟรีเพื่อทดลองเรียน' : 'เฉพาะสมาชิกพรีเมียม'}" เรียบร้อยแล้ว!`, 
        type: "success" 
      });
    } catch (err: any) {
      setAdminNotification({ message: err.message || "เกิดข้อผิดพลาดในการปรับสถานะความฟรี", type: "error" });
    } finally {
      setTimeout(() => setAdminNotification(null), 3500);
    }
  };

  const handleExecuteConfirm = async () => {
    if (!confirmDialog) return;
    try {
      setAdminActionLoading(true);
      await confirmDialog.onConfirm();
      setAdminNotification({ message: "ดำเนินการตามที่เลือกเรียบร้อยแล้ว!", type: "success" });
      setConfirmDialog(null);
    } catch (err: any) {
      setAdminNotification({ message: err.message || "เกิดข้อผิดพลาดในการทำรายการ", type: "error" });
    } finally {
      setAdminActionLoading(false);
      setTimeout(() => setAdminNotification(null), 3000);
    }
  };

  // Category addition states
  const [catName, setCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  // Quiz creation states
  const [selectedCatId, setSelectedCatId] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDesc, setQuizDesc] = useState("");
  const [quizTimeLimit, setQuizTimeLimit] = useState("15");
  const [quizIsFree, setQuizIsFree] = useState(false);

  // Quiz editing states
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);

  const handleEditQuizClick = async (q: Quiz) => {
    if (!canCreateQuiz) {
      setAdminNotification({ message: "❌ ขออภัย! คุณไม่มีสิทธิ์ในการเพิ่มหรือแก้ไขข้อสอบในระบบ กรุณาติดต่อแอดมินคุณเฟิร์สเพื่อขอสิทธิ์เข้าใช้งาน", type: "error" });
      setTimeout(() => setAdminNotification(null), 5000);
      return;
    }
    try {
      setAdminActionLoading(true);
      // Fetch full questions list from subcollection
      const qList = await fetchQuestions(q.id);
      
      // Populate fields
      setEditingQuizId(q.id);
      setSelectedCatId(q.categoryId);
      setQuizTitle(q.title);
      setQuizDesc(q.description);
      setQuizTimeLimit(String(q.timeLimit));
      setQuizIsFree(!!q.isFree);
      
      // Map questions list
      setQuestionsList(qList.map(item => ({
        text: item.text,
        options: item.options,
        correctIndex: Number(item.correctIndex),
        explanation: item.explanation || ""
      })));
      
      // Scroll to top of the form so they see the editor
      const formEl = document.getElementById("admin-quiz-creation-form");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth" });
      }

      setAdminNotification({ message: `โหลดข้อมูล "${q.title}" ในโหมดแก้ไขเรียบร้อย!`, type: "success" });
    } catch (err: any) {
      setAdminNotification({ message: err.message || "ล้มเหลวในการดึงคำถามเพื่อแก้ไข", type: "error" });
    } finally {
      setAdminActionLoading(false);
      setTimeout(() => setAdminNotification(null), 3000);
    }
  };

  const handleCancelEdit = () => {
    setEditingQuizId(null);
    setQuizTitle("");
    setQuizDesc("");
    setQuizTimeLimit("15");
    setQuizIsFree(false);
    setQuestionsList([]);
  };

  // Question lists (manual or AI-generated)
  const [questionsList, setQuestionsList] = useState<Omit<Question, "createdAt">[]>([]);
  const [creatingQuiz, setCreatingQuiz] = useState(false);

  // AI Parser states
  const [rawText, setRawText] = useState("");
  const [parsingAI, setParsingAI] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const cats = await fetchCategories();
      setCategories(cats);
      if (cats.length > 0 && !selectedCatId) {
        setSelectedCatId(cats[0].id);
      }

      const qList = await fetchQuizzes();
      setQuizzes(qList);
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      setAddingCat(true);
      await createCategory(catName, "");
      setCatName("");
      setAdminNotification({ message: "สร้างหมวดใหม่สำเร็จเสร็จสิ้น!", type: "success" });
      await loadData();
    } catch (err) {
      setAdminNotification({ message: "เกิดข้อผิดพลาดในการสร้างหมวดหมู่", type: "error" });
    } finally {
      setAddingCat(false);
      setTimeout(() => setAdminNotification(null), 3000);
    }
  };

  const handleDeleteCategory = (id: string) => {
    setConfirmDialog({
      id,
      type: "category",
      title: "🚨 ยืนยันคำขอสิ้นสุดหมวดหมู่",
      message: "คุณมั่นใจที่จะลบหมวดหมู่นี้หรือไม่? แบบทดสอบทั้งหมดที่สังกัดจะยังคงอยู่แต่จะกลายเป็นหมวดทั่วไปหลัก",
      onConfirm: async () => {
        await deleteCategory(id);
        await loadData();
      }
    });
  };

  const handleDeleteQuiz = (id: string) => {
    if (!canDeleteQuiz) {
      setAdminNotification({ message: "❌ ขออภัย! คุณไม่มีสิทธิ์ในการลบข้อสอบในระบบ กรุณาติดต่อแอดมินคุณเฟิร์สเพื่อขออนุมัติ", type: "error" });
      setTimeout(() => setAdminNotification(null), 5000);
      return;
    }
    setConfirmDialog({
      id,
      type: "quiz",
      title: "🚨 ยืนยันต้องการลบชุดทดสอบ",
      message: "ต้องการลบชุดทดสอบและข้อสอบทั้งหมดในชุดนี้ใช่หรือไม่? ข้อมูลประวัติการทำข้อสอบเก่าทั้งหมดจะยังคงอยู่หรือถูกกักตัวไว้",
      onConfirm: async () => {
        await deleteQuiz(id);
        await loadData();
      }
    });
  };

  // Triggers server-side parsing of text into multiple-choice list
  const handleParseWithAI = async () => {
    if (!rawText.trim()) return;

    try {
      setParsingAI(true);
      // Simulate dynamic reassuring phases
      setAiStatusMessage("กำลังเชื่อมต่อระบบวิเคราะห์อัจฉริยะ...");
      setTimeout(() => setAiStatusMessage("กำลังวิเคราะห์ความหมายของภาษาและเนื้อหา..."), 1200);
      setTimeout(() => setAiStatusMessage("กำลังจัดโครงสร้างข้อสอบพร้อมตัวเลือก 4 ข้อ..."), 2500);

      const response = await fetch("/api/gemini/parse-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText })
      });

      if (!response.ok) {
        let errMessage = "เกิดข้อผิดพลาดในการเรียกเซิร์ฟเวอร์";
        try {
          const responseText = await response.text();
          try {
            const errData = JSON.parse(responseText);
            errMessage = errData.error || errMessage;
            if (errData.details) {
              errMessage += `: ${errData.details}`;
            }
          } catch {
            // Not JSON
            errMessage = `เซิร์ฟเวอร์ตอบกลับด้วย HTML/รหัสผิดพลาด (${response.status}): ${responseText.substring(0, 100)}...`;
          }
        } catch {
          errMessage = `เซิร์ฟเวอร์ตอบกลับผิดพลาดระดับเครือข่าย สถานะ: ${response.status}`;
        }
        throw new Error(errMessage);
      }

      let data: any;
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        throw new Error(`คำตอบจากเซิร์ฟเวอร์ไม่ใช่ JSON ที่ถูกต้อง: ${responseText.substring(0, 100)}...`);
      }

      if (data.questions && Array.isArray(data.questions)) {
        setQuestionsList([...questionsList, ...data.questions]);
        setRawText("");
        setAiStatusMessage("");
        setAdminNotification({ message: `ระบบสกัดโจทย์วิเคราะห์สำเร็จ! เพิ่มเข้าไป ${data.questions.length} ข้อในรายการตรวจสอบแล้ว`, type: "success" });
      } else {
        throw new Error("โครงสร้างคำตอบที่ส่งกลับมาสกัดไม่ถูกต้อง");
      }

    } catch (err: any) {
      setAdminNotification({ message: `ล้มเหลวในการสร้างข้อสอบด้วย AI: ${err.message}`, type: "error" });
    } finally {
      setParsingAI(false);
      setAiStatusMessage("");
      setTimeout(() => setAdminNotification(null), 5000);
    }
  };

  // Save the constructed quiz complete with questions directly in the DB
  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateQuiz) {
      setAdminNotification({ message: "❌ ขออภัย! คุณไม่มีสิทธิ์ในการเพิ่มหรือแก้ไขข้อสอบในระบบ กรุณาติดต่อแอดมินคุณเฟิร์สเพื่อขอสิทธิ์เข้าถึง", type: "error" });
      setTimeout(() => setAdminNotification(null), 5000);
      return;
    }
    if (!selectedCatId || !quizTitle.trim()) {
      setAdminNotification({ message: "กรุณากรอกข้อมูลส่วนหมวดหมู่ และหัวเรื่องให้ครบถ้วน", type: "error" });
      setTimeout(() => setAdminNotification(null), 4000);
      return;
    }
    if (questionsList.length === 0) {
      setAdminNotification({ message: "กรุณาเพิ่มข้อสอบอย่างน้อย 1 ข้อ (สามารถพิมพ์คู่มือหรือวางเนื้อหาให้ AI จัดข้อสอบได้)", type: "error" });
      setTimeout(() => setAdminNotification(null), 4000);
      return;
    }

    try {
      setCreatingQuiz(true);
      if (editingQuizId) {
        // Edit Mode
        await updateQuiz(editingQuizId, selectedCatId, quizTitle.trim(), quizDesc.trim() || `${quizTitle} (แบบทดสอบ)`, Number(quizTimeLimit), questionsList, quizIsFree);
        setAdminNotification({ message: "อัปเดตชุดแบบทดสอบและเนื้อหารายประเด็นเสร็จเรียบร้อย!", type: "success" });
        setEditingQuizId(null);
      } else {
        // Creation Mode
        await createQuiz(selectedCatId, quizTitle, quizDesc.trim() || `${quizTitle} (แบบทดสอบ)`, Number(quizTimeLimit), questionsList, quizIsFree);
        
        // Notify all users about the new quiz (if it's free, notify everyone, else notify premium members)
        const notifyMessage = quizIsFree 
          ? `🔥 แบบฝึกหัดใหม่เปิดให้ลองทำฟรี: "${quizTitle}"!` 
          : `📚 มีชุดแบบฝึกหัดพรีเมียมใหม่ให้ตลุย: "${quizTitle}"!`;
        await createNotification(notifyMessage, "new_quiz", "all");
        setAdminNotification({ message: "บันทึกข้อมูลชุดแบบทดสอบและข้อสอบทั้งหมดเสร็จเรียบร้อยแล้ว!", type: "success" });
      }

      // Cleanup States
      setQuizTitle("");
      setQuizDesc("");
      setQuizTimeLimit("15");
      setQuizIsFree(false);
      setQuestionsList([]);
      await loadData();
    } catch (err) {
      setAdminNotification({ message: "ไม่สามารถบันทึกข้อสอบได้ กรุณาติดต่อทีมสนับสนุนผู้ดูแลระบบ", type: "error" });
    } finally {
      setCreatingQuiz(false);
      setTimeout(() => setAdminNotification(null), 4000);
    }
  };

  const handleUpdateQuestionField = (idx: number, field: string, value: any) => {
    const updated = [...questionsList];
    if (field === "text") {
      updated[idx].text = value;
    } else if (field === "correctIndex") {
      updated[idx].correctIndex = Number(value);
    } else if (field === "explanation") {
      updated[idx].explanation = value;
    }
    setQuestionsList(updated);
  };

  const handleUpdateOptionField = (qIdx: number, oIdx: number, value: string) => {
    const updated = [...questionsList];
    updated[qIdx].options[oIdx] = value;
    setQuestionsList(updated);
  };

  const handleRemoveQuestion = (idx: number) => {
    const updated = questionsList.filter((_, i) => i !== idx);
    setQuestionsList(updated);
  };

  const handleAddEmptyQuestion = () => {
    setQuestionsList([
      ...questionsList,
      {
        text: "คำถามใหม่ยังไม่ได้ระบุ...",
        options: ["ตัวเลือกก", "ตัวเลือกข", "ตัวเลือกค", "ตัวเลือกง"],
        correctIndex: 0,
        explanation: "คำอธิบายรายละเอียดดัชนีคำตอบ"
      }
    ]);
  };

  return (
    <div className="space-y-8 pb-12">
      
      {/* Intro Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" /> {mode === "approvals" ? "แผงอนุมัติสมาชิกและสลิปพรีเมียม" : "แผงควบคุมหลักสูตรและแบบทดสอบ"}
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {mode === "approvals" 
              ? "ตรวจสอบสิทธิ์ผู้สอบ เปิดระบบเข้าทำข้อสอบเสมือนจริง และประเมินใบสลิปของสมาชิกใหม่" 
              : "ออกแบบวิชาหลักสูตร ชุดคำถามวิเคราะห์ และแบบฝึกหัดทบทวนรายบุคคล"}
          </p>
        </div>

        {/* Real-time Online Indicator */}
        <div className="flex items-center gap-1.5 self-start md:self-auto bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full text-[10px] text-slate-600 font-bold">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>เจ้าของระบบ / แอดมินออนไลน์ : {usersList.filter(u => u.status === 'online').length} คน</span>
        </div>
      </div>

      {/* Modern Horizontal Navigation Tabs */}
      {mode === "approvals" && (
        <div className="flex flex-wrap border-b border-slate-100 pb-px gap-4 md:gap-7">
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-xs font-bold relative transition-colors cursor-pointer ${
              activeTab === "users" ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {activeTab === "users" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
            )}
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" /> ไดเรกทอรีและสิทธิ์ใช้งานผู้เข้าสอบ ({usersList.length})
            </span>
          </button>

          <button
            onClick={() => setActiveTab("payments")}
            className={`pb-3 text-xs font-bold relative transition-colors cursor-pointer ${
              activeTab === "payments" ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {activeTab === "payments" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
            )}
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> ประวัติและรูปสลิปแจ้งโอนเงิน ({paymentsList.length})
            </span>
          </button>
        </div>
      )}

      {!mode && (
        <div className="flex flex-wrap border-b border-slate-100 pb-px gap-4 md:gap-7">
          <button
            onClick={() => setActiveTab("quiz")}
            className={`pb-3 text-xs font-bold relative transition-colors cursor-pointer ${
              activeTab === "quiz" ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {activeTab === "quiz" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
            )}
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> จัดการหลักสูตรและแบบทดสอบ ({quizzes.length})
            </span>
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-xs font-bold relative transition-colors cursor-pointer ${
              activeTab === "users" ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {activeTab === "users" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
            )}
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" /> ไดเรกทอรีและสิทธิ์ใช้งานผู้เข้าสอบ ({usersList.length})
            </span>
          </button>

          <button
            onClick={() => setActiveTab("payments")}
            className={`pb-3 text-xs font-bold relative transition-colors cursor-pointer ${
              activeTab === "payments" ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {activeTab === "payments" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
            )}
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> ประวัติและรูปสลิปแจ้งโอนเงิน ({paymentsList.length})
            </span>
          </button>
        </div>
      )}

      {activeTab === "quiz" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Manage Categories */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Add Category Form */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
              <LayoutGrid className="h-4 w-4 text-indigo-600" />
              <span>สร้างหมวดหมู่ / รายวิชาใหม่</span>
            </h3>

            <form onSubmit={handleAddCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ชื่อวิชา (ภาษาไทย)</label>
                <input
                  type="text"
                  placeholder="เช่น คณิตศาสตร์ ม.3, General English"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={addingCat}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{addingCat ? "กำลังบันทึก..." : "เพิ่มหมวดหมู่"}</span>
              </button>
            </form>
          </div>

          {/* Categories List */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-950">หมวดหมู่ทั้งหมด ({categories.length})</h3>
            
            {loading ? (
              <p className="text-xs text-slate-400">กำลังดึงข้อมูล...</p>
            ) : categories.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl text-center">ยังไม่มีหมวดหมู่รายวิชา</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100/70 transition-colors border border-slate-100">
                    <div className="overflow-hidden pr-3">
                      <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{c.description}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(c.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                      title="ลบวิชานี้"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>



        </div>

        {/* Right Column: AI-Backed Quiz Constructor */}
        <div className="lg:col-span-2 space-y-6 relative">
          {!canCreateQuiz && (
            <div className="absolute inset-0 z-40 bg-slate-50/70 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in min-h-[400px]">
              <div className="bg-white border border-slate-100 p-6 rounded-2xl max-w-sm shadow-xl space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600 border border-rose-100 animate-bounce">
                  <ShieldCheck className="h-7 w-7 stroke-[2]" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">🔒 สิทธิ์การจัดการข้อสอบถูกจำกัด</h4>
                  <p className="text-[11px] text-slate-500 font-semibold leading-relaxed mt-2">
                    บัญชีของคุณไม่มีสิทธิ์ "เพิ่ม/แก้ไขข้อสอบ" ในระบบขณะนี้ ระบบได้จำกัดการเข้าถึงปุ่มเครื่องมือและการสกัดอัตโนมัติ กรุณาติดต่อแอดมินคุณเฟิร์สระดับสูงเพื่อพิจารณาปลดล็อกความสามารถนี้
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Main Creator Module */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-indigo-50 pb-4 gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-950 flex items-center gap-1.5">
                  <BookOpen className="h-5 w-5 text-indigo-600" />
                  <span>สร้างชุดแบบทดสอบใหม่</span>
                </h3>
                <p className="text-xxs text-slate-500">กรอกข้อมูลทั่วไปและใช้ AI สกัดข้อสอบจากสรุปย่อในฟอร์มย่อย</p>
              </div>
              <span className="inline-flex self-start items-center rounded-md bg-indigo-50 px-2 py-1 text-xxs font-semibold text-indigo-700 gap-1.5 animate-pulse">
                <Sparkles className="h-3 w-3" /> ออกข้อสอบง่ายด้วย AI
              </span>
            </div>

            <form onSubmit={handleSaveQuiz} className="space-y-6">
              
              {/* Form Metadata Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">เลือกวิชา / สังกัดหมวดหมู่</label>
                  <select
                    value={selectedCatId}
                    onChange={(e) => setSelectedCatId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none bg-white focus:border-indigo-500"
                    required
                  >
                    {categories.length === 0 ? (
                      <option value="">-- กรุณาสร้างวิชาด้านซ้ายก่อน --</option>
                    ) : (
                      categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">หัวข้อแบบทดสอบ</label>
                    <input
                      type="text"
                      placeholder="เช่น สอบย่อยบทที่ 1 อัตราส่วนและร้อยละ"
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">เวลา (นาที)</label>
                    <input
                      type="number"
                      min="5"
                      max="120"
                      value={quizTimeLimit}
                      onChange={(e) => setQuizTimeLimit(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>


              </div>



              {/* AI Parser Sub-box */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/20 p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <span>สกัดและเก็งข้อสอบอัตโนมัติ</span>
                  </h4>
                  <span className="text-[10px] text-slate-500 leading-none">ขับเคลื่อนด้วยระบบจับประเด็นอัจฉริยะ</span>
                </div>
                
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  คุณสามารถก็อบบันทึกย่อการติว บทเรียนวิชาการ ข้อสรุปความรู้ หรือข้อสอบเก่าฟอร์แมตกระจัดกระจายมาวางในช่องได้เลย 
                  ระบบสกัดอัจฉริยะจะแปลงข้อมูลเหล่านี้ให้ออกมาเป็นโครงสร้างปรนัย 4 ตัวเลือกภาษาไทยที่มีความถูกต้อง มีดัชนีเฉลยและเฉลยอธิบายคุณทันที!
                  <strong className="block text-indigo-700 mt-1">💡 เพื่อผลลัพธ์ที่ดีที่สุด: แนะนำให้วางเนื้อหาเพื่อวิเคราะห์หรือสกดข้อสอบครั้งละประมาณ 5-15 ข้อ เพื่อให้ประมวลผลได้รวดเร็วทันใจและแม่นยำสูงสุด!</strong>
                </p>

                <textarea
                  placeholder="วางตำราเรียน สรุปเนื้อหา หรือข้อสอบดิบลงที่นี่... ตัวอย่าง:&#10;1. โลกของเราห่างจากดวงอาทิตย์เป็นลำดับที่เท่าไหร่? ตอบ ลำดับที่สาม&#10;2. น้ำประกอบด้วยไฮโดรเจนและออกซิเจน"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-xs outline-none focus:border-indigo-500 font-mono resize-y"
                />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  {parsingAI ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"></div>
                      <span className="text-[11px] font-bold text-indigo-600">{aiStatusMessage || "กำลังวิเคราะห์ข้อสอบด้วยระบบอัตโนมัติ..."}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400">ระบุบทสรุปติว 1 หน้า หรือข้อคำสั่งย่อย</span>
                  )}

                  <button
                    type="button"
                    onClick={handleParseWithAI}
                    disabled={parsingAI || !rawText.trim()}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4.5 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>แปลงเนื้อหาเป็นข้อสอบปรนัย</span>
                  </button>
                </div>
              </div>

              {/* Renders list of reviewable exam questions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-900">รายการข้อสอบในชุดทดสอบนี้ ({questionsList.length} ข้อ)</h4>
                  <button
                    type="button"
                    onClick={handleAddEmptyQuestion}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xxs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> เพิ่มข้อสอบเปล่าด้วยมือ
                  </button>
                </div>

                {questionsList.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-400">
                    ยังไม่มีข้อสอบในชุดนี้ คุณสามารถใช้ระบบประมวลผลสกัดอัตโนมัติด้านบน หรือเพิ่มข้อสอบทีละข้อด้วยตัวคุณเอง
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-1">
                    {questionsList.map((item, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4.5 space-y-3 relative group">
                        
                        <div className="flex items-center justify-between">
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">ข้อสอบที่ {idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(idx)}
                            className="text-slate-400 hover:text-rose-600 rounded p-1.5 transition-colors opacity-80 group-hover:opacity-100"
                            title="ลบข้อนี้"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Editable question text */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">โจทก์ / คำถาม</label>
                          <input
                            type="text"
                            value={item.text}
                            onChange={(e) => handleUpdateQuestionField(idx, "text", e.target.value)}
                            className="w-full rounded border border-slate-200 bg-white px-2.5 py-1 text-xs outline-none focus:border-indigo-500"
                            required
                          />
                        </div>

                        {/* Editable options 4 choices */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {item.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400 w-4">{String.fromCharCode(65 + oIdx)}.</span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => handleUpdateOptionField(idx, oIdx, e.target.value)}
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-indigo-500"
                                required
                              />
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">ระบุข้อที่ถูกต้อง (0-3)</label>
                            <select
                              value={item.correctIndex}
                              onChange={(e) => handleUpdateQuestionField(idx, "correctIndex", e.target.value)}
                              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-500"
                              required
                            >
                              <option value="0">ก (A)</option>
                              <option value="1">ข (B)</option>
                              <option value="2">ค (C)</option>
                              <option value="3">ง (D)</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">คำอธิบายเฉลยหลักความจริง</label>
                            <input
                              type="text"
                              value={item.explanation}
                              placeholder="เช่น เพราะสูตร H2O แทนคำตอบน้ำที่เป็นธาตุเคมีร่วม..."
                              onChange={(e) => handleUpdateQuestionField(idx, "explanation", e.target.value)}
                              className="w-full rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Save All */}
              <div className="border-t border-slate-100 pt-5 flex justify-end gap-3">
                {editingQuizId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <span>ยกเลิกการแก้ไข</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={creatingQuiz || questionsList.length === 0}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-6 py-2.5 text-xs font-bold text-white transition-colors disabled:opacity-40 cursor-pointer shadow-sm ${
                    editingQuizId ? "bg-indigo-600 hover:bg-indigo-550 lg:hover:bg-indigo-500" : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>
                    {creatingQuiz 
                      ? "กำลังบันทึกชุดโครงสร้าง..." 
                      : editingQuizId 
                        ? "อัปเดตข้อมูลแบบทดสอบ" 
                        : "บันทึกแบบทดสอบ"}
                  </span>
                </button>
              </div>

            </form>

          </div>

          {/* Active Quizzes Registry (Listing & Administration delete) */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-950">ชุดทดสอบที่เปิดสอบอยู่ทั้งหมด ({quizzes.length} ชุด)</h3>
            
            {quizzes.length === 0 ? (
              <p className="text-xs text-slate-400 text-center bg-slate-50 py-8 rounded-xl border border-slate-100">ยังไม่ได้รับการขึ้นทะเบียนข้อสอบ</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {quizzes.map((q) => {
                  const cat = categories.find(c => c.id === q.categoryId);

                  return (
                    <div key={q.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between hover:bg-slate-100/50 transition-colors">
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="rounded bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold text-indigo-700">
                            {cat ? cat.name : "ทั่วไป"}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleEditQuizClick(q)}
                              className="text-slate-400 hover:text-indigo-600 p-1 rounded transition-colors cursor-pointer"
                              title="แก้ไขชุดข้อสอบนี้"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteQuiz(q.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                              title="ลบชุดสอบนี้"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-2">{q.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-1 pb-2 line-clamp-2">{q.description}</p>
                      </div>

                      <div className="border-t border-slate-150 pt-2.5 flex flex-col gap-2 mt-2">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {q.questionsCount} ข้อ</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {q.timeLimit} นาที</span>
                        </div>
                        
                        <div className="flex items-center justify-between border-t border-dashed border-slate-200/60 pt-2 mt-0.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${q.isFree ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
                            {q.isFree ? "✨ ทดลองทำฟรี" : "🔒 เฉพาะพรีเมียม"}
                          </span>
                          <button
                            onClick={() => handleToggleQuizFree(q.id, !!q.isFree)}
                            className="text-[9.5px] font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-slate-50 border border-slate-200 px-2 py-0.5 rounded transition-all cursor-pointer"
                          >
                            {q.isFree ? "จำกัดเฉพาะพรีเมียม" : "เปิดให้ทดลองฟรี"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
      )}

      {activeTab === "users" && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden space-y-4">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">ค้นหาบัญชีและสิทธิ์อนุมัติเข้าใช้งาน</h3>
              <p className="text-[11px] text-slate-500 mt-1">ผู้ใช้ทั้งหมดในฐานข้อมูล Firestore แอดมินสามารถตรวจสอบ ดูรหัสผ่าน และสับเปลี่ยนให้สิทธิ์ผ่านเว็บแบบเรียลไทม์</p>
            </div>
            
            <div className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-xl px-4 py-2 font-semibold">
              ทั้งหมด {usersList.length} บัญชี | รออนุมัติ {usersList.filter(u => u.approved === false).length} บัญชี
            </div>
          </div>

          <div className="overflow-x-auto">
            {usersList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <Users className="h-10 w-10 mx-auto text-slate-200" />
                <p className="text-xs font-medium">ยังไม่พบผู้ใช้งานลงทะเบียนอยู่ในระบบ</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-y border-slate-100 font-bold text-slate-500 text-[10px] uppercase">
                    <th className="py-3 px-6">ชื่อแสดงผู้สอบ / สถานะ</th>
                    <th className="py-3 px-6">อีเมลลงทะเบียน</th>
                    <th className="py-3 px-6">รหัสผ่านสำหรับเข้าสอบ (แอดมินเห็นทั้งหมด)</th>
                    <th className="py-3 px-6">สิทธิ์เข้าทดสอบครูผู้ช่วย</th>
                    <th className="py-3 px-6">บทบาท/แต่งตั้งแอดมิน</th>
                    <th className="py-3 px-6">อัปเดตล่าสุด</th>
                    <th className="py-3 px-6 text-right">ลบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {usersList.map((usr) => {
                    const approved = usr.approved === true;
                    const isSelfAdmin = usr.email?.toLowerCase() === "first22960@gmail.com";

                    return (
                      <tr key={usr.id || usr.uid} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 font-semibold text-slate-800">
                          <div className="flex items-center gap-2.5">
                            <span className="relative">
                              <span className={`block h-2 w-2 rounded-full absolute -top-0.5 -right-0.5 ${usr.status === 'online' ? 'bg-emerald-500 ring-2 ring-white' : 'bg-slate-300'}`} />
                              <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-100">
                                {usr.displayName?.[0]?.toUpperCase() || usr.email?.[0]?.toUpperCase() || "?"}
                              </div>
                            </span>
                            <div>
                              <div className="text-slate-900 font-bold flex items-center gap-1.5 flex-wrap">
                                <span>{usr.displayName || "ยังไม่ระบุชื่อ"}</span>
                                {isSelfAdmin && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md font-bold">Admin</span>}
                              </div>
                              <div className="text-[10px] text-slate-400 capitalize">{usr.status || "offline"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-mono text-[11px]">
                          {usr.email}
                        </td>
                        <td className="py-4 px-6">
                          {usr.plainPassword ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold bg-indigo-50 border border-indigo-100/60 px-2.5 py-1 rounded-lg text-indigo-700">
                              {usr.plainPassword}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">ผ่าน Google / ไม่มีข้อมูลรหัสในระบบ</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {isSelfAdmin ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-[10px] font-bold">
                              ✓ มีสิทธิ์ผู้ดูแลถาวร
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {approved ? (
                                <div className="space-y-1 text-center">
                                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs font-bold shadow-xxs">
                                    ✓ อนุมัติแล้ว
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleToggleApproval(usr.id || usr.uid, false)}
                                    className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all cursor-pointer"
                                  >
                                    อนุมัติ
                                  </button>
                                  <button
                                    onClick={() => {
                                      setConfirmDialog({
                                        id: usr.id || usr.uid,
                                        type: "user",
                                        title: "🚨 ยืนยันการปฏิเสธคำขอเข้าสอบ",
                                        message: `ต้องการไม่อนุมัติและปฏิเสธคำขอของบัญชี ${usr.email || ""} ใช่หรือไม่? บัญชีจะถูกนำออกจากระบบและต้องสมัครบัญชีเพื่อลองใหม่อีกครั้ง`,
                                        onConfirm: async () => {
                                          await deleteUserAccount(usr.id || usr.uid);
                                        },
                                        confirmText: "ปฏิเสธคำขอ"
                                      });
                                    }}
                                    className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all cursor-pointer"
                                  >
                                    ไม่อนุมัติ
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {isSelfAdmin ? (
                            <span className="inline-flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full text-[10px] font-bold">
                              ★ เจ้าของระบบ (Owner)
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <div className="text-[10px] font-bold text-slate-600">
                                บทบาท: <span className={usr.role === "admin" ? "text-rose-600 font-extrabold" : "text-sky-700"}>{usr.role === "admin" ? "แอดมิน" : "ผู้สอบ"}</span>
                              </div>
                              {isOwner && (
                                <button
                                  onClick={async () => {
                                    const nextRole = usr.role === "admin" ? "student" : "admin";
                                    try {
                                      await updateUserRole(usr.id || usr.uid, nextRole);
                                      setAdminNotification({
                                        message: `แต่งตั้ง ${usr.email || usr.displayName || "ผู้ใช้นี้"} เป็น ${nextRole === "admin" ? "แอดมิน" : "ผู้สอบทั่วไป"} เรียบร้อย!`,
                                        type: "success"
                                      });
                                      setTimeout(() => setAdminNotification(null), 3000);
                                    } catch (err: any) {
                                      setAdminNotification({ message: err.message || "เกิดข้อผิดพลาดในการแต่งตั้ง", type: "error" });
                                    }
                                  }}
                                  className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[9px] font-bold border transition-all cursor-pointer w-fit ${
                                    usr.role === "admin"
                                      ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                                      : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
                                  }`}
                                >
                                  {usr.role === "admin" ? "ถอนสิทธิ์แอดมิน" : "แต่งตั้งแอดมิน"}
                                </button>
                              )}
                              {usr.role === "admin" && isOwner && (
                                <div className="mt-2.5 p-2 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1.5 w-44 shadow-xs">
                                  <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3 text-emerald-500" /> จัดการสิทธิ์แอดมิน:
                                  </div>
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer hover:text-indigo-600 transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={usr.adminPermissions?.createQuiz !== false}
                                      onChange={async (e) => {
                                        const curPerms = usr.adminPermissions || { createQuiz: true, createAnnouncement: true, deleteQuiz: true };
                                        await updateAdminPermissions(usr.id || usr.uid, {
                                          ...curPerms,
                                          createQuiz: e.target.checked
                                        });
                                      }}
                                      className="rounded text-indigo-600 focus:ring-none scale-90 cursor-pointer"
                                    />
                                    <span>เพิ่ม/แก้ไขข้อสอบ</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer hover:text-indigo-600 transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={usr.adminPermissions?.createAnnouncement !== false}
                                      onChange={async (e) => {
                                        const curPerms = usr.adminPermissions || { createQuiz: true, createAnnouncement: true, deleteQuiz: true };
                                        await updateAdminPermissions(usr.id || usr.uid, {
                                          ...curPerms,
                                          createAnnouncement: e.target.checked
                                        });
                                      }}
                                      className="rounded text-indigo-600 focus:ring-none scale-90 cursor-pointer"
                                    />
                                    <span>สร้างประกาศข่าวสาร</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer hover:text-rose-600 transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={usr.adminPermissions?.deleteQuiz !== false}
                                      onChange={async (e) => {
                                        const curPerms = usr.adminPermissions || { createQuiz: true, createAnnouncement: true, deleteQuiz: true };
                                        await updateAdminPermissions(usr.id || usr.uid, {
                                          ...curPerms,
                                          deleteQuiz: e.target.checked
                                        });
                                      }}
                                      className="rounded text-indigo-600 focus:ring-none scale-90 cursor-pointer"
                                    />
                                    <span>ลบข้อสอบในระบบ</span>
                                  </label>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6 text-[10px] text-slate-400 font-mono">
                          {usr.lastSeenAt ? new Date(usr.lastSeenAt).toLocaleString("th-TH") : "ไม่ปรากฏข้อมูล"}
                        </td>
                        <td className="py-4 px-6 text-right">
                          {isSelfAdmin ? null : (
                            <button
                              onClick={() => handleDeleteUser(usr.id || usr.uid)}
                              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="ลบบัญชีผู้ใช้งานนี้"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden space-y-4">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">รายการสลิปและโอนเงินพรีเมียม (99.- บาท)</h3>
              <p className="text-[11px] text-slate-500 mt-1">ผู้ใช้แจ้งสลิปชำระเงินเข้ามา ระบบจะอัปเดตสถานะและเปิดให้กดสับเปลี่ยนอนุมัติผู้สมัครอัตโนมัติเมื่อตรวจสอบสลิป</p>
            </div>
            
            <div className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-xl px-4 py-2 font-semibold">
              สลิปทั้งหมด {paymentsList.length} รายการ | ค้างตรวจสอบ {paymentsList.filter(p => p.status === 'pending').length} รายการ
            </div>
          </div>

          {/* Status filters */}
          <div className="px-6 flex items-center gap-2 border-b border-slate-50 pb-3 overflow-x-auto scrollbar-none font-bold text-xs">
            <span className="text-slate-400 text-[10px] uppercase font-mono mr-2">ตัวกรองสลิป:</span>
            <button
              onClick={() => setPaymentFilter("all")}
              className={`rounded-full px-3.5 py-1 text-xs transition-all cursor-pointer ${
                paymentFilter === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
              }`}
            >
              ทั้งหมด ({paymentsList.length})
            </button>
            <button
              onClick={() => setPaymentFilter("pending")}
              className={`rounded-full px-3.5 py-1 text-xs transition-all cursor-pointer flex items-center gap-1 ${
                paymentFilter === "pending"
                  ? "bg-amber-650 text-white shadow-sm"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/50"
              }`}
            >
              <Clock className="h-3 w-3" /> รอตรวจสอบ ({paymentsList.filter(p => p.status === 'pending').length})
            </button>
            <button
              onClick={() => setPaymentFilter("approved")}
              className={`rounded-full px-3.5 py-1 text-xs transition-all cursor-pointer flex items-center gap-1 ${
                paymentFilter === "approved"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/50"
              }`}
            >
              <Check className="h-3 w-3 stroke-[3]" /> อนุมัติแล้ว ({paymentsList.filter(p => p.status === 'approved').length})
            </button>
            <button
              onClick={() => setPaymentFilter("rejected")}
              className={`rounded-full px-3.5 py-1 text-xs transition-all cursor-pointer flex items-center gap-1 ${
                paymentFilter === "rejected"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-rose-55 text-rose-700 hover:bg-rose-100 border border-rose-200/50"
              }`}
            >
              <X className="h-3 w-3" /> ปฏิเสธแล้ว ({paymentsList.filter(p => p.status === 'rejected').length})
            </button>
          </div>

          <div className="overflow-x-auto">
            {paymentsList.filter(p => paymentFilter === "all" || p.status === paymentFilter).length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <FileText className="h-10 w-10 mx-auto text-slate-200" />
                <p className="text-xs font-semibold text-slate-700">ไม่พบข้อมูลประวัติการส่งหลักฐานชำระเงินตามสถานะนี้</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-y border-slate-100 font-bold text-slate-500 text-[10px] uppercase">
                    <th className="py-3 px-6">ผู้ส่งรายการ</th>
                    <th className="py-3 px-6">อีเมลประสานงาน</th>
                    <th className="py-3 px-6">เบอร์ติดต่อ</th>
                    <th className="py-3 px-6">ภาพหลักฐานสลิป</th>
                    <th className="py-3 px-6">วันที่อัปโหลด</th>
                    <th className="py-3 px-6 text-center">สถานะสลิป</th>
                    <th className="py-3 px-6 text-right">จัดการแผงอนุมัติโอนเงิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-750">
                  {paymentsList
                    .filter(p => paymentFilter === "all" || p.status === paymentFilter)
                    .map((pay) => {
                      return (
                        <tr key={pay.id} className="hover:bg-slate-50/50 transition-colors font-medium">
                          <td className="py-4 px-6 font-bold text-slate-800">
                            {pay.name}
                          </td>
                          <td className="py-4 px-6 text-slate-600 font-mono font-semibold">
                            {pay.email}
                          </td>
                          <td className="py-4 px-6 text-slate-600 font-mono">
                            {pay.phone}
                          </td>
                          <td className="py-4 px-6">
                            {pay.slipDataURL ? (
                              <button
                                onClick={() => setSelectedSlip({ id: pay.id, img: pay.slipDataURL })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-all cursor-pointer"
                              >
                                <Image className="h-3.5 w-3.5 text-indigo-500" />
                                <span>ดูรูปขยายสลิป</span>
                              </button>
                            ) : (
                              <span className="text-rose-500 font-bold">ไม่มีไฟล์แนบ</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-[10px] text-slate-400 font-mono">
                            {pay.createdAt ? new Date(pay.createdAt.seconds * 1000).toLocaleString("th-TH") : "กำลังประมวลผล..."}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {pay.status === "approved" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                ✓ โอนผ่านสำเร็จ
                              </span>
                            ) : pay.status === "rejected" ? (
                              <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                ✗ ปฏิเสธสลิปแล้ว
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                รอแอดมินตรวจ
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            {pay.status === "pending" ? (
                              <div className="inline-flex gap-2 justify-end items-center">
                                <button
                                  onClick={() => handleApprovePayment(pay.id, pay.email)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 rounded-xl text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Check className="h-3 w-3 stroke-[3]" />
                                  <span>อนุมัติ & เปิดเข้าทำข้อสอบ</span>
                                </button>
                                <button
                                  onClick={() => handleRejectPayment(pay.id, pay.email)}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                                >
                                  <span>ปฏิเสธสลิป</span>
                                </button>
                                <button
                                  onClick={() => handleDeletePayment(pay.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer ml-1"
                                  title="ลบรายงานนี้ออกจากระบบ"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 justify-end">
                                <span className="text-[10px] text-slate-400 font-semibold italic">
                                  {pay.status === "approved" ? "อนุมัติเรียบร้อย" : "ปฏิเสธสลิปเรียบร้อย"}
                                </span>
                                <button
                                  onClick={() => handleDeletePayment(pay.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="ลบประวัติชำระเงินนี้"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Slip Viewer Modal Extension */}
      {selectedSlip && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/85 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800">หลักฐานสลิปโอนเงิน (ID: {selectedSlip.id})</span>
              <button
                onClick={() => setSelectedSlip(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 bg-slate-200/50 hover:bg-slate-250 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 bg-slate-50 flex items-center justify-center">
              <img src={selectedSlip.img} alt="Slip Evidence" className="max-h-[60vh] object-contain rounded-xl shadow-md border border-slate-200" referrerPolicy="no-referrer" />
            </div>
            <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedSlip(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Admin Alert/Notification Toast */}
      {adminNotification && (
        <div className="fixed bottom-5 right-5 z-50 animate-fade-in">
          <div className={`rounded-xl px-4 py-3 shadow-lg border text-xs font-semibold flex items-center gap-2 ${
            adminNotification.type === "success" 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}>
            <span className="text-sm">{adminNotification.type === "success" ? "✅" : "❌"}</span>
            <span>{adminNotification.message}</span>
          </div>
        </div>
      )}

      {/* Beautiful Admin In-App Deletion Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in" id="admin-confirmation-modal">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 border border-rose-100 animate-pulse">
              <Trash2 className="h-5 w-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-950">{confirmDialog.title}</h3>
              <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                {confirmDialog.message}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                disabled={adminActionLoading}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleExecuteConfirm}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                disabled={adminActionLoading}
              >
                {adminActionLoading ? "กำลังดำเนินการ..." : (confirmDialog.confirmText || "ลบออกถาวร")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
