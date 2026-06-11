import React, { useState } from "react";
import { Award, Trophy, Target, Calendar, UserCheck, Flame } from "lucide-react";
import { Category, Quiz, Attempt } from "../types";

interface LeaderboardProps {
  categories: Category[];
  quizzes: Quiz[];
  attempts: Attempt[];
  title?: string;
}

export default function Leaderboard({ categories, quizzes, attempts, title = "ทำเนียบผู้เตรียมสอบคะแนนดีเด่น (Real-time)" }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<string>("all");

  const getLeaderboardData = (catId: string) => {
    // 1. Get quizzes in this category (or all if catId is 'all')
    const categoryQuizzes = catId === "all" 
      ? quizzes 
      : quizzes.filter(q => q.categoryId === catId);
    
    const quizIds = categoryQuizzes.map(q => q.id);

    // 2. Filter attempts for these quizzes
    const filteredAttempts = attempts.filter(att => quizIds.includes(att.quizId));

    // 3. Group attempts by user
    const userAttemptsGroup: { [userId: string]: Attempt[] } = {};
    filteredAttempts.forEach(att => {
      if (!userAttemptsGroup[att.userId]) {
        userAttemptsGroup[att.userId] = [];
      }
      userAttemptsGroup[att.userId].push(att);
    });

    // 4. Calculate average score & percentage per user
    const leaderboardItems = Object.entries(userAttemptsGroup).map(([userId, userAtts]) => {
      let totalPerc = 0;
      let totalScoreSum = 0;
      let totalQuestionsSum = 0;
      let latestCompletedAt = userAtts[0].completedAt;

      userAtts.forEach(att => {
        const perc = att.totalQuestions > 0 ? (att.score / att.totalQuestions) : 0;
        totalPerc += perc;
        totalScoreSum += att.score;
        totalQuestionsSum += att.totalQuestions;
        if (att.completedAt && (!latestCompletedAt || att.completedAt.seconds > (latestCompletedAt.seconds || 0))) {
          latestCompletedAt = att.completedAt;
        }
      });

      const avgPercentage = totalPerc / userAtts.length;
      const uniqueQuizzesCount = new Set(userAtts.map(a => a.quizId)).size;

      const avgScore = totalScoreSum / userAtts.length;
      const avgQs = totalQuestionsSum / userAtts.length;

      return {
        id: userId, // matches .id in jsx loop mapping key=item.id
        userId: userId,
        userName: userAtts[0].userName || "ผู้สอบนิรนาม",
        quizTitle: `เฉลี่ยจาก ${uniqueQuizzesCount} ชุดข้อสอบ (${userAtts.length} ครั้ง)`,
        score: parseFloat(avgScore.toFixed(1)),
        totalQuestions: parseFloat(avgQs.toFixed(1)),
        percentage: Math.round(avgPercentage * 100),
        completedAt: latestCompletedAt
      };
    });

    // 5. Sort by percentage descending, then by average score descending, then by completedAt descending
    return leaderboardItems.sort((a, b) => {
      if (b.percentage !== a.percentage) {
        return b.percentage - a.percentage;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const timeA = a.completedAt?.seconds || 0;
      const timeB = b.completedAt?.seconds || 0;
      return timeB - timeA;
    }).slice(0, 5);
  };

  const currentLeaderboard = getLeaderboardData(activeTab);

  return (
    <div id="realtime-leaderboard-card" className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-50 pb-4">
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
            <Trophy className="h-5 w-5 text-amber-500 animate-bounce" />
            <span>{title}</span>
          </h3>
          <p className="text-[11px] text-slate-500">
            จัดอันดับครูผู้ช่วยตามคะแนนเฉลี่ยสะสมรายวิชาจากข้อสอบทุกชุด อัปเดตแบบ Real-time
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
          <Flame className="h-3 w-3 text-indigo-600" />
          <span>คะแนนเฉลี่ยรวม</span>
        </span>
      </div>

      {/* Category selector pills inside Leaderboard */}
      {categories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setActiveTab("all")}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
            }`}
          >
            ทุกวิชา
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === cat.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
              }`}
            >
              วิชา{cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Ranks list representation */}
      {currentLeaderboard.length === 0 ? (
        <div className="rounded-xl bg-slate-50/50 p-6 text-center border border-dashed border-slate-200">
          <UserCheck className="h-8 w-8 text-slate-300 mx-auto stroke-[1.2]" />
          <p className="text-xs font-semibold text-slate-500 mt-2">ยังไม่มีประวัติการสอบในวิชานี้</p>
          <p className="text-[10px] text-slate-400 mt-1">มาเริ่มต้นเป็นผู้ทำคะแนนสอบคนแรกกันเลย!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {currentLeaderboard.map((item, index) => {
            const percentage = item.totalQuestions > 0 ? Math.round((item.score / item.totalQuestions) * 100) : 0;
            const rankMedals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
            const bgGradient = [
              "bg-amber-50/40 border-amber-200/60",
              "bg-slate-50/50 border-slate-200/60",
              "bg-orange-50/30 border-orange-200/30",
              "bg-white border-slate-100",
              "bg-white border-slate-100"
            ];

            return (
              <div 
                key={item.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${bgGradient[index] || "bg-white border-slate-100"} hover:translate-x-1 duration-200`}
              >
                {/* User info & Rank */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg font-bold w-6 text-center">{rankMedals[index] || `#${index + 1}`}</span>
                  
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 truncate">
                      <span>{item.userName}</span>
                      {index === 0 && (
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1 rounded-sm uppercase tracking-wider">Top Rank</span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      แบบทดสอบ: <span className="font-semibold text-slate-500">{item.quizTitle}</span>
                    </p>
                  </div>
                </div>

                {/* Score badge details */}
                <div className="text-right shrink-0 pl-2">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-xs font-extrabold text-indigo-700">{item.score} / {item.totalQuestions} คะแนน</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      percentage >= 80 ? "bg-emerald-50 text-emerald-700" :
                      percentage >= 50 ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {percentage}%
                    </span>
                  </div>
                  {item.completedAt?.seconds ? (
                    <p className="text-[9px] text-slate-400 mt-0.5 font-mono">
                      {new Date(item.completedAt.seconds * 1000).toLocaleDateString('th-TH', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  ) : (
                    <p className="text-[9px] text-slate-400 mt-0.5 font-mono">ส่งเมื่อครู่นี้</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
