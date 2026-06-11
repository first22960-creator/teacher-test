import React, { useState, useRef } from "react";
import { X, Check, Upload, Phone, Mail, User, CreditCard, ChevronRight, Sparkles } from "lucide-react";
import { submitPayment, createNotification } from "../lib/firebase";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PaymentModal({ isOpen, onClose }: PaymentModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [slipDataURL, setSlipDataURL] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("กรุณาเลือกไฟล์รูปภาพที่เป็นสลิปโอนเงินเท่านั้น (.png, .jpg, .jpeg)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("ขนาดรูปภาพต้องไม่เกิน 2MB เพื่อความรวดเร็วในการตรวจสอบข้อมูล");
      return;
    }

    setErrorMsg("");
    const reader = new FileReader();
    reader.onload = () => {
      setSlipDataURL(reader.result as string);
    };
    reader.onerror = () => {
      setErrorMsg("เกิดข้อผิดพลาดในการอ่านไฟล์สลิป");
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || !slipDataURL) {
      setErrorMsg("กรุณากรอกข้อมูลส่วนตัวให้ครบถ้วน พร้อมอัปโหลดหลักฐานการโอนเงิน (สลิป)");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg("");
      
      await submitPayment({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        slipDataURL
      });

      try {
        await createNotification(
          `💰 แจ้งโอนเงิน: คุณ ${name.trim()} (${email.trim().toLowerCase()}) ได้ส่งสลิปแจ้งชำระเงินเรียบร้อยแล้ว กรุณาเปิดตรวจสอบและอนุมัติสิทธิ์การเข้าใช้งานเข้าเรียนด้วยครับ`,
          "payment_request",
          "admin"
        );
      } catch (notifErr2) {
        console.warn("Failed to notify admin on payment:", notifErr2);
      }

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการส่งข้อมูลการชำระเงิน กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Box */}
      <div className="relative w-full max-w-4xl rounded-3xl border border-slate-100 bg-white shadow-2xl animate-scale-up grid grid-cols-12 overflow-hidden z-50 max-h-[90vh] overflow-y-auto">
        {success ? (
          <div className="col-span-12 p-8 py-16 flex flex-col items-center justify-center text-center space-y-5">
            <div className="h-16 w-16 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce shadow-md">
              <Check className="h-8 w-8 stroke-[3]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">แจ้งชำระเงินเรียบร้อยแล้ว!</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
                ระบบหลังบ้าน SiamQuiz ได้รับรายงานชำระเงินของท่านแล้วเรียบร้อย แอดมินจะทำการตรวจสอบสลิป 
                และเปิดสิทธิ์การใช้งานบัญชีอีเมล <span className="text-indigo-600 font-bold">"{email}"</span> ให้เข้าทดสอบระบบข้อสอบครูผู้ช่วย 1,000+ ข้อของคุณได้ทันที!
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[11px] text-slate-500 leading-relaxed max-w-md">
              🎯 <strong className="text-slate-800">ขั้นตอนถัดไป:</strong> เข้าไปที่เมนู "สมัครสมาชิกใหม่" และสมัครบัญชีด้วยอีเมลที่แจ้งไว้ด้านบน เพื่อรอเข้าสู่ระบบใช้งานได้ทันทีหลังอนุมัติเสร็จสิ้น
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition-colors cursor-pointer shadow-sm"
            >
              รับทราบ / ปิดหน้านี้
            </button>
          </div>
        ) : (
          <>
            {/* Left Side: Campaign details & QR Code */}
            <div className="col-span-12 md:col-span-6 bg-slate-50/50 p-6 md:p-8 border-r border-slate-100 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                  <Sparkles className="h-3.5 w-3.5" /> ภาค ก + ภาค ข คลังข้อสอบเตรียมสอบครูผู้ช่วยอัจฉริยะ
                </span>
                
                <div>
                  <h2 className="text-lg md:text-xl font-extrabold text-slate-900 leading-snug">
                    แพ็กเกจเข้าทำข้อสอบ <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">มากกว่า 1,000+ ข้อ!</span>
                  </h2>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed font-medium bg-indigo-50/40 p-4 rounded-xl border border-indigo-100/50">
                    📢 <strong>1. เว็บไซต์ของเราได้รวบรวมข้อสอบจริงและข้อสอบเสมือนจริงมากกว่า 1,000+ ข้อ</strong> หากท่านต้องการเข้าใช้งานระบบสอบนี้ กรุณาชำระค่าธรรมเนียมบริการเพียง <strong>99 บาท</strong> ตามช่องทางที่ท่านสะดวก ทั้งทาง บัญชีไลน์ (LINE) และ ช่องทางสแกนคิวอาร์โค้ดพร้อมเพย์ (PromptPay QR Code) และกรุณาแนบไฟล์รูปภาพสลิปหลักฐานการโอนเงินในส่วนถัดไปได้เลยครับ เพื่อการเข้าเตรียมตัวสอบที่สมบูรณ์แบบและดีที่สุด!
                  </p>
                </div>

                {/* Grid Benefits */}
                <div className="grid grid-cols-1 gap-2.5 pt-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <div className="h-5 w-5 bg-indigo-100/50 rounded-md flex items-center justify-center text-indigo-700 text-[10px]">✓</div>
                    <span>รวมแนวข้อสอบวิเคราะห์เจาะลึกภาค ก และ ภาค ข รวมกว่า 1,000+ ข้อ</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <div className="h-5 w-5 bg-indigo-100/50 rounded-md flex items-center justify-center text-indigo-700 text-[10px]">✓</div>
                    <span>ตารางสรุปเก็งคะแนนประเมินสะสมสอบแบบเจาะลึก</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <div className="h-5 w-5 bg-indigo-100/50 rounded-md flex items-center justify-center text-indigo-700 text-[10px]">✓</div>
                    <span>คำอธิบายเฉลยและเฉลยละเอียดอย่างเป็นทางการ</span>
                  </div>
                </div>
              </div>

              {/* QR Code Section */}
              <div className="bg-white p-4.5 rounded-2xl border border-slate-100 flex flex-col items-center justify-center space-y-3 shadow-xs">
                <div className="text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">โอนเงินด้วยคิวอาร์โค้ดพร้อมเพย์</span>
                  <div className="text-sm font-black text-indigo-600 mt-0.5">ราคาพิเศษจองสิทธิ์เพียง 99.- บาท เท่านั้น!</div>
                </div>

                {/* PromptPay QR code card */}
                <div className="relative border border-slate-100 rounded-xl p-3 bg-gradient-to-b from-teal-50/20 to-indigo-50/20 flex flex-col items-center justify-center w-full max-w-[220px] mx-auto">
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=000201010211303000160014013141592653580215000000000000199540599.005802TH"
                    alt="PromptPay QR Code"
                    className="h-32 w-32 object-contain"
                  />
                  <div className="text-[10px] font-bold text-slate-600 mt-1.5 flex items-center gap-1">
                    <CreditCard className="h-3 w-3 text-teal-600" />
                    <span>ชื่อบัญชี: บลูคิว ครูสองสี่ศิษย์ครูคนไทย</span>
                  </div>
                </div>

                <div className="text-[9px] text-center text-slate-400 font-medium leading-relaxed">
                  สแกนคิวอาร์โค้ดพร้อมเพย์บนแอปธนาคารของท่านเพื่อโอนเงิน 99 บาท <br />
                  แล้วทำการแนบหลักฐาน (สลิปโอนเงิน) ในแบบฟอร์มด้านขวาได้ทันที
                </div>
              </div>

              <div className="text-[10px] text-indigo-600 font-bold bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-center">
                💬 สนใจสอบถามหรือแจ้งโอนผ่าน LINE: <span className="underline select-all text-indigo-800">@ครูผู้ช่วยพรีเมียม</span>
              </div>
            </div>

            {/* Right Side: Form and Slip Uploader */}
            <div className="col-span-12 md:col-span-6 p-6 md:p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3 mb-5">
                  แจ้งชำระเงินและแนบหลักฐานสลิป (ค่าบริการ 99.- บาท)
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* Name Input */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span>ชื่อ-นามสกุลจริงผู้สมัคร</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ตัวอย่าง: ครูนพล รักษ์ศึกษา"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  {/* Email Input */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span>อีเมลที่ต้องการใช้ลงทะเบียนเข้าห้องสอบ</span>
                    </label>
                    <input
                      type="email"
                      placeholder="ตัวอย่าง: teacher_nopadol@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 font-mono"
                      required
                    />
                    <span className="text-[10px] text-amber-600 leading-normal block">
                      * กรุณาระบุเมลเดียวกันกับที่คุณจะใช้สมัครบัญชีสอบใหม่ในระบบจริง
                    </span>
                  </div>

                  {/* Phone Input */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>เบอร์โทรศัพท์ติดต่อกลับ</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="ตัวอย่าง: 0987654321"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 font-mono"
                      required
                    />
                  </div>

                  {/* Drag-and-Drop Slip Uploader */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">
                      แนบภาพหลักฐานสลิปโอนเงิน (ขนาดไม่เกิน 2MB)
                    </label>

                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                        isDragging 
                          ? "border-indigo-500 bg-indigo-50/50" 
                          : slipDataURL 
                            ? "border-emerald-200 bg-emerald-50/10" 
                            : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50"
                      }`}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />

                      {slipDataURL ? (
                        <div className="space-y-2 flex flex-col items-center">
                          <img
                            src={slipDataURL}
                            alt="Slip Preview"
                            className="h-28 max-w-full object-contain rounded-lg border border-slate-200 shadow-xxs"
                          />
                          <p className="text-[10px] text-emerald-700 font-bold">
                            ✓ ตรวจพบรูปภาพสลิปแล้ว (คลิก/ลากเพื่อเปลี่ยนภาพใหม่)
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 py-2 flex flex-col items-center">
                          <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                            <Upload className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-700">คลิกที่นี่ หรือ ลากไฟล์สลิปมาวางที่นี่</p>
                            <p className="text-[10px] text-slate-400 mt-1">รองรับไฟล์ประเภทรูปภาพขนาดไม่เกิน 2MB</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-[11px] text-rose-800 flex items-center gap-1.5 leading-relaxed">
                      <span>⚠</span>
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Submission and Action */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer mt-4"
                  >
                    {submitting ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    ) : null}
                    <span>{submitting ? "กำลังจัดส่งหลักฐาน..." : "ส่งข้อมูลและแจ้งโอนสิทธิ์บริการ 99.- บาท"}</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <div className="text-[10px] text-slate-400 text-center leading-normal">
                    ระบบมีความปลอดภัยสูง รักษาความลับทางบัญชีและการชำระเงินของท่านอย่างดีที่สุด 🔒
                  </div>

                </form>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
