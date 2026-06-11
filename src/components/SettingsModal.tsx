import React, { useState } from "react";
import { X, Settings, User, Key, Check, Info, Sparkles } from "lucide-react";
import { User as AuthUser, updatePassword } from "firebase/auth";
import { updateUserProfileName, updateUserPasswordInDB } from "../lib/firebase";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  onNameUpdated?: (newName: string) => void;
}

export default function SettingsModal({ isOpen, onClose, user, onNameUpdated }: SettingsModalProps) {
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Password reset state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  if (!isOpen || !user) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErrorMsg("กรุณากรอกชื่อเล่น/ชื่อผู้เข้าสอบ");
      return;
    }
    try {
      setIsUpdating(true);
      setErrorMsg("");
      setSuccessMsg("");
      
      await updateUserProfileName(displayName.trim());
      
      setSuccessMsg("อัปเดตชื่อผู้ใช้งานเรียบร้อยแล้ว!");
      if (onNameUpdated) {
        onNameUpdated(displayName.trim());
      }
      setTimeout(() => {
        onClose();
        setSuccessMsg("");
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "เกิดข้อผิดพลาดในการอัปเดตชื่อ");
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordError("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("รหัสผ่านสองช่องไม่ตรงกัน");
      return;
    }

    try {
      setIsUpdatingPassword(true);
      setPasswordError("");
      setPasswordSuccess("");

      // Update in Firebase Auth
      await updatePassword(user, newPassword);

      // Save to Firestore users collection plainPassword to keep in sync
      await updateUserPasswordInDB(newPassword);

      setPasswordSuccess("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error(err);
      if (err?.code === "auth/requires-recent-login") {
        setPasswordError("เพื่อความปลอดภัยด้านโครงสร้างรหัสผ่าน กรุณาออกจากระบบและลงชื่อเข้าใช้งานใหม่อีกครั้ง ก่อนเข้าร่วมเปลี่ยนรหัสผ่านใหม่");
      } else {
        setPasswordError(err?.message || "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl animate-scale-up z-50 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5 mb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Settings className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">ตั้งค่าบัญชีผู้สอบ</h3>
            <p className="text-[11px] text-slate-500">ปรับแต่งชื่อเรียกและข้อมูลผู้สมัครสอบครูผู้ช่วย</p>
          </div>
        </div>

        {/* Name and Profile Update Section */}
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              ชื่อเล่น / ชื่อเต็มผู้เข้าสอบ
            </label>
            <div className="relative">
              <User className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="กรอกชื่อเล่นหรือชื่อสอบจริง เช่น ครูสมชาย"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs font-semibold outline-none focus:border-indigo-500 transition-all text-slate-800"
                maxLength={40}
              />
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              * ชื่อนี้จะนำไปประกอบในการแสดงอันดับสูงสุด (Leaderboard) และใช้ประเมินคะแนนสอบ
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 block">
              อีเมลปัจจุบัน
            </label>
            <input
              type="text"
              value={user.email || "ไม่มีอีเมลสำรอง"}
              disabled
              className="w-full rounded-xl border border-slate-100 bg-slate-50/70 py-2 px-3 text-xs font-mono text-slate-500 cursor-not-allowed select-none"
            />
          </div>

          {/* Feedback alerts */}
          {errorMsg && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-800 flex items-center gap-1.5 leading-relaxed">
              <span>⚠</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-800 flex items-center gap-1.5 font-semibold">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action Button for Profile Updates */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isUpdating}
              className="w-full rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isUpdating ? "กำลังบันทึก..." : "อัปเดตโปรไฟล์"}
            </button>
          </div>
        </form>

        {/* Change Password Form */}
        <form onSubmit={handlePasswordChange} className="border-t border-slate-100 pt-5 mt-5 space-y-4">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Key className="h-4 w-4 text-slate-500" />
            <span>เปลี่ยนรหัสผ่านเข้าใช้งานห้องสอบ</span>
          </h4>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              รหัสผ่านใหม่ (อย่างน้อย 6 หลัก)
            </label>
            <input
              type="password"
              placeholder="กรอกรหัสผ่านใหม่เข้าห้องสอบ..."
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordError("");
                setPasswordSuccess("");
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold outline-none focus:border-indigo-500 transition-all text-slate-800"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              ยืนยันรหัสผ่านใหม่อีกครั้ง
            </label>
            <input
              type="password"
              placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง..."
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordError("");
                setPasswordSuccess("");
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold outline-none focus:border-indigo-500 transition-all text-slate-800"
              required
            />
          </div>

          {passwordError && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-800 flex items-center gap-1.5 leading-relaxed">
              <span>⚠</span>
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-800 flex items-center gap-1.5 font-semibold">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isUpdatingPassword || !newPassword}
              className="w-full rounded-xl bg-slate-900 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isUpdatingPassword ? "กำลังเปลี่ยนรหัสผ่าน..." : "เปลี่ยนรหัสผ่านพาสเวิร์ด"}
            </button>
          </div>
        </form>

        {/* Guidelines */}
        <div className="bg-amber-50/40 p-3.5 rounded-xl border border-amber-100/60 flex items-start gap-2 text-[10px] text-amber-950 leading-relaxed mt-4">
          <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">คำแนะนำสำหรับผู้เตรียมสอบหลักเกณฑ์ล่าสุด:</span>
            <span>เพื่อความปลอดภัย เมื่อแก้ไขสลับเปลี่ยนข้อมูลหน้าต่างบัญชี ระบบครูผู้ช่วยจะจดจำและอัปเดตข้อมูลขึ้น Cloud เพื่อควบคุมสิทธิ์สิทธิส่วนบุคคลการใช้งานของท่าต่อยอดรวดเร็วที่สุด</span>
          </div>
        </div>

      </div>
    </div>
  );
}
