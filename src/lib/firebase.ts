import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  deleteUser
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  getDocFromServer,
  arrayUnion,
  limit
} from "firebase/firestore";
import { Category, Quiz, Question, Attempt } from "../types";
import firebaseConfig from "@/firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); // Critical for enterprise / custom db ID configuration
export const auth = getAuth(app);

// Configure Google Sign-In Provider (popup is safer and recommended for this container sandbox)
export const googleProvider = new GoogleAuthProvider();

// Standard test connection on startup as mandated by the Firebase Integration specs
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or network status.");
    }
  }
}
testConnection();

// Mandatory custom Firestore error handling framework
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Payload: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// UI trigger: Google Sign In popup with robust single-flight promise lock to prevent duplicate concurrent popups (which causes auth/cancelled-popup-request) and graceful user cancel handling.
let activeSignInPromise: Promise<any> | null = null;

export function initFreshSession() {
  if (typeof window !== "undefined") {
    const newSessionId = "sess_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
    localStorage.setItem("exam_active_session_id", newSessionId);
    localStorage.setItem("session_write_status", "pending");
    localStorage.removeItem("session_terminated_reason");
    return newSessionId;
  }
  return null;
}

export async function signInWithGoogle() {
  if (activeSignInPromise) {
    return activeSignInPromise;
  }

  initFreshSession();

  activeSignInPromise = (async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error: any) {
      const errCode = error?.code || "";
      const errMsg = error?.message || "";
      
      // Gracefully capture cancellation or closure of the popup window to avoid spamming errors or crash logs
      if (
        errCode === "auth/cancelled-popup-request" || 
        errCode === "auth/popup-closed-by-user" ||
        errMsg.includes("cancelled-popup-request") ||
        errMsg.includes("popup-closed-by-user")
      ) {
        console.warn("Google Sign-In popup request was cancelled or closed by the user / sandbox restrictions.");
        return null;
      }
      
      console.error("Google login failed:", error);
      throw error;
    } finally {
      activeSignInPromise = null;
    }
  })();

  return activeSignInPromise;
}

// UI trigger: Logout
export async function logOut(isForced: boolean = false) {
  try {
    const user = auth.currentUser;
    if (user) {
      // Set status offline in Firestore before signing out
      const path = `users/${user.uid}`;
      await setDoc(doc(db, "users", user.uid), { status: "offline", lastSeenAt: new Date().toISOString() }, { merge: true });
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("exam_active_session_id");
      localStorage.removeItem("session_write_status");
      if (!isForced) {
        localStorage.removeItem("session_terminated_reason");
      }
    }
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed:", error);
    throw error;
  }
}

// ----------------------------------------------------
// Type-Safe Firestore Database Methods
// ----------------------------------------------------

// Categories CRUD
export async function fetchCategories(): Promise<Category[]> {
  const path = "categories";
  try {
    const q = query(collection(db, path), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Category[];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createCategory(name: string, description: string): Promise<string> {
  const path = "categories";
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User must be authenticated");

    const categoryId = doc(collection(db, path)).id; // generate ID first
    const payload = {
      name,
      description,
      createdAt: serverTimestamp(),
      createdBy: user.uid
    };

    await setDoc(doc(db, path, categoryId), payload);
    return categoryId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const path = `categories/${categoryId}`;
  try {
    await deleteDoc(doc(db, "categories", categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Quizzes CRUD
export async function fetchQuizzes(categoryId?: string): Promise<Quiz[]> {
  const path = "quizzes";
  try {
    let q;
    if (categoryId) {
      q = query(collection(db, path), where("categoryId", "==", categoryId));
    } else {
      q = query(collection(db, path));
    }
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as any)
    })) as Quiz[];

    // Sort by createdAt desc client-side to avoid Firestore composite index requirement
    return docs.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createQuiz(categoryId: string, title: string, description: string, timeLimit: number, questions: Omit<Question, "createdAt">[], isFree?: boolean): Promise<string> {
  const path = "quizzes";
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User must be authenticated");

    const quizId = doc(collection(db, path)).id; // generate a precise unique ID
    const quizPayload = {
      categoryId,
      title,
      description,
      timeLimit: Number(timeLimit),
      questionsCount: questions.length,
      isFree: !!isFree,
      createdAt: serverTimestamp(),
      createdBy: user.uid
    };

    await setDoc(doc(db, path, quizId), quizPayload);

    // Save questions as subcollection as required by high scalability constraint (Pillar 1)
    const questionsPath = `quizzes/${quizId}/questions`;
    for (const q of questions) {
      const qId = doc(collection(db, questionsPath)).id;
      const qPayload = {
        text: q.text,
        options: q.options,
        correctIndex: Number(q.correctIndex),
        explanation: q.explanation || "",
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, "quizzes", quizId, "questions", qId), qPayload);
    }

    return quizId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchQuestions(quizId: string): Promise<Question[]> {
  const path = `quizzes/${quizId}/questions`;
  try {
    const snapshot = await getDocs(collection(db, "quizzes", quizId, "questions"));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Question[];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteQuiz(quizId: string): Promise<void> {
  const path = `quizzes/${quizId}`;
  try {
    // Delete the root quiz document; Firestore trigger or client routine usually cleans up questions recursively
    await deleteDoc(doc(db, "quizzes", quizId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateQuizFreeStatus(quizId: string, isFree: boolean): Promise<void> {
  const path = `quizzes/${quizId}`;
  try {
    await updateDoc(doc(db, "quizzes", quizId), { isFree });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// User Attempt submission / list
export async function submitQuizAttempt(quizId: string, quizTitle: string, score: number, totalQuestions: number): Promise<string> {
  const path = "attempts";
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User must be authenticated");

    const attemptId = doc(collection(db, path)).id;
    const attemptPayload = {
      userId: user.uid,
      userEmail: user.email || "",
      userName: user.displayName || user.email?.split("@")[0] || "ผู้ใช้นิรนาม",
      quizId,
      quizTitle,
      score: Number(score),
      totalQuestions: Number(totalQuestions),
      completedAt: serverTimestamp()
    };

    await setDoc(doc(db, path, attemptId), attemptPayload);
    return attemptId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteAttempt(attemptId: string): Promise<void> {
  const path = `attempts/${attemptId}`;
  try {
    await deleteDoc(doc(db, "attempts", attemptId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchUserAttempts(): Promise<Attempt[]> {
  const path = "attempts";
  try {
    const user = auth.currentUser;
    if (!user) return [];

    let q;
    // If active user is the bootstrapped admin, load ALL attempts to review scores!
    if (user.email === "first22960@gmail.com") {
      q = query(collection(db, path));
    } else {
      q = query(collection(db, path), where("userId", "==", user.uid));
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as any)
    })) as Attempt[];

    // Sort by completedAt desc client-side to avoid Firestore composite index requirement
    return docs.sort((a, b) => {
      const timeA = a.completedAt?.seconds || 0;
      const timeB = b.completedAt?.seconds || 0;
      return timeB - timeA;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ----------------------------------------------------
// Real-time Users presence & profile synchronization
// ----------------------------------------------------
import { onSnapshot } from "firebase/firestore";

export async function saveUserProfile(user: any, status: string = "online") {
  if (!user) return;
  try {
    const profileDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(profileDocRef);
    
    const isSystemOwner = user.email?.toLowerCase() === "first22960@gmail.com";
    const creationTime = user.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now();
    const isBrandNew = (Date.now() - creationTime) < 15000; // 15 seconds
    
    if (!docSnap.exists() && !isBrandNew && !isSystemOwner) {
      console.log("Canceled/deleted user detected. Purging auth account: ", user.email);
      try {
        await deleteUser(user);
      } catch (authErr: any) {
        if (authErr?.code === "auth/requires-recent-login" || authErr?.message?.includes("requires-recent-login")) {
          console.warn("deleteUser from saveUserProfile deferred due to requires-recent-login.");
        } else {
          console.warn("Failed to delete auth user from saveUserProfile (non-fatal):", authErr);
        }
      }
      return;
    }

    const localSessionId = typeof window !== "undefined" ? localStorage.getItem("exam_active_session_id") : null;
    const payload: any = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email?.split("@")[0] || "ผู้ใช้นิรนาม",
      photoURL: user.photoURL || "",
      lastSeenAt: new Date().toISOString(),
      status,
      ...(localSessionId ? { activeSessionId: localSessionId } : {})
    };

    if (!docSnap.exists()) {
      // Setup default approval for newly registered users
      let isApprovedFromPayment = false;
      if (user.email) {
        try {
          const paymentsRef = collection(db, "payments");
          const q = query(paymentsRef, where("email", "==", user.email));
          const paymentsSnap = await getDocs(q);
          isApprovedFromPayment = paymentsSnap.docs.some(doc => doc.data().status === "approved");
        } catch (paymentErr) {
          console.error("Error checking auto-approval from payments:", paymentErr);
        }
      }

      payload.approved = (isSystemOwner || isApprovedFromPayment) ? true : false;
      payload.role = isSystemOwner ? "admin" : "student";
      payload.isAdmin = isSystemOwner;
    }

    await setDoc(profileDocRef, payload, { merge: true });
  } catch (error) {
    console.error("Error saving user profile:", error);
  }
}

export function subscribeToUsers(callback: (users: any[]) => void) {
  const path = "users";
  const q = query(collection(db, "users"), orderBy("lastSeenAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export function subscribeToUserProfile(userId: string, callback: (data: any) => void) {
  const path = `users/${userId}`;
  return onSnapshot(doc(db, "users", userId), (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const path = `users/${userId}`;
  try {
    await deleteDoc(doc(db, "users", userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Email & password Authentication support with Admin Approval flow
export async function signUpWithEmailAndPassword(email: string, password: string, displayName: string) {
  try {
    initFreshSession();
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const user = credential.user;
    await updateProfile(user, { displayName });
    
    const isSystemAdmin = email.toLowerCase() === "first22960@gmail.com";
    const approvedStatus = isSystemAdmin ? true : false;

    const localSessionId = typeof window !== "undefined" ? localStorage.getItem("exam_active_session_id") : null;
    // Save custom profile field: approved and plainPassword in Firestore
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email || "",
      displayName: displayName,
      photoURL: "",
      lastSeenAt: new Date().toISOString(),
      status: "online",
      approved: approvedStatus,
      plainPassword: password,
      ...(localSessionId ? { activeSessionId: localSessionId } : {})
    });

    if (!isSystemAdmin) {
      try {
        await createNotification(
          `👤 สมัครสมาชิกใหม่: คุณ ${displayName} (${email}) ได้สมัครลงทะเบียนเข้าใช้งานห้องสอบ กรุณาตรวจสอบสิทธิ์และอนุเคราะห์อนุมัติเข้าเรียนด้วยครับ`,
          "approval",
          "admin"
        );
      } catch (err) {
        console.warn("Failed to notify admin on signup:", err);
      }
    }

    return user;
  } catch (error) {
    console.error("Signup failed:", error);
    throw error;
  }
}

export async function signInWithEmailPassword(email: string, password: string) {
  try {
    initFreshSession();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;
    
    const isSystemAdmin = email.toLowerCase() === "first22960@gmail.com";
    
    // Check if the Firestore user document exists.
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (!docSnap.exists() && !isSystemAdmin) {
      console.log("Deleted user tried to sign in. Removing auth account reference:", email);
      try {
        await deleteUser(user);
      } catch (authErr: any) {
        if (authErr?.code === "auth/requires-recent-login" || authErr?.message?.includes("requires-recent-login")) {
          console.warn("deleteUser from signInWithEmailPassword deferred due to requires-recent-login.");
        } else {
          console.warn("Failed to delete auth user from signInWithEmailPassword (non-fatal):", authErr);
        }
      }
      throw new Error("บัญชีผู้ใช้ของคุณนี้ได้ถูกยกเลิกสิทธิ์และลบออกจากระบบแล้ว กรุณาลงทะเบียนสมัครใหม่อีกครั้ง");
    }

    const localSessionId = typeof window !== "undefined" ? localStorage.getItem("exam_active_session_id") : null;
    // Write lastSeenAt and plainPassword
    await setDoc(doc(db, "users", user.uid), {
      lastSeenAt: new Date().toISOString(),
      status: "online",
      plainPassword: password, // keeps it updated
      ...(localSessionId ? { activeSessionId: localSessionId } : {}),
      ...(isSystemAdmin ? { approved: true, role: "admin", isAdmin: true } : {})
    }, { merge: true });

    return user;
  } catch (error: any) {
    console.error("Sign in with email/password failed:", error);
    const errCode = error?.code || "";
    const errMsg = error?.message || "";
    if (errCode === "auth/invalid-credential" || errMsg.includes("invalid-credential") || errCode === "auth/user-not-found" || errCode === "auth/wrong-password") {
      try {
        console.log("Attempting auto-signup fallback for:", email);
        const displayName = email.split("@")[0] || "ผู้สอบ";
        const newUser = await signUpWithEmailAndPassword(email, password, displayName);
        return newUser;
      } catch (signupErr: any) {
        if (signupErr?.code === "auth/email-already-in-use") {
          throw error; // keep original password/invalid-credential error if email already exists
        }
        throw signupErr;
      }
    }
    throw error;
  }
}

// User Profile Update
export async function updateUserProfileName(newName: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("คุณต้องเข้าสู่ระบบก่อนอัปเดตข้อมูล");
  
  // Update Auth Profile
  await updateProfile(user, { displayName: newName });
  // Force update user document in Firestore too
  const path = `users/${user.uid}`;
  try {
    const payload = {
      uid: user.uid,
      email: user.email || "",
      displayName: newName,
      photoURL: user.photoURL || "",
      lastSeenAt: new Date().toISOString(),
      status: "online"
    };
    await setDoc(doc(db, "users", user.uid), payload, { merge: true });
  } catch (error) {
    console.error("Error setting profile name in DB:", error);
  }
}

export async function updateUserPasswordInDB(newPassword: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("คุณต้องเข้าสู่ระบบก่อน");
  await setDoc(doc(db, "users", user.uid), { plainPassword: newPassword }, { merge: true });
}

// subscribeToAttempts for real-time leaderboards
export function subscribeToAttempts(callback: (attempts: Attempt[]) => void) {
  const path = "attempts";
  const q = query(collection(db, path));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Attempt[];
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

// ----------------------------------------------------
// Interactive Premium Payment & Admin auditing Flow
// ----------------------------------------------------

export interface PaymentDetails {
  name: string;
  email: string;
  phone: string;
  slipDataURL: string;
}

export async function submitPayment(details: PaymentDetails): Promise<string> {
  const path = "payments";
  try {
    const paymentId = doc(collection(db, path)).id;
    const payload = {
      name: details.name,
      email: details.email,
      phone: details.phone,
      slipDataURL: details.slipDataURL,
      status: "pending",
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, "payments", paymentId), payload);

    // If there is an active logged-in user, reset their approved status to false (pending review)
    const user = auth.currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), { approved: false, paymentStatus: "pending" });
      } catch (profileErr) {
        console.warn("Failed to reset user approval state inside submitPayment:", profileErr);
      }
    }

    return paymentId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToPayments(callback: (payments: any[]) => void) {
  const path = "payments";
  const q = query(collection(db, path), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function updatePaymentStatus(paymentId: string, status: "approved" | "rejected"): Promise<void> {
  const path = `payments/${paymentId}`;
  try {
    await updateDoc(doc(db, "payments", paymentId), { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePayment(paymentId: string): Promise<void> {
  const path = `payments/${paymentId}`;
  try {
    await deleteDoc(doc(db, "payments", paymentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateUserApproval(userId: string, approved: boolean, paymentStatus?: string): Promise<void> {
  const path = `users/${userId}`;
  try {
    const updatePayload: any = { approved };
    if (paymentStatus !== undefined) {
      updatePayload.paymentStatus = paymentStatus;
    }
    await updateDoc(doc(db, "users", userId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserRole(userId: string, role: "admin" | "student"): Promise<void> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, "users", userId), { role, isAdmin: role === "admin" });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeToAnnouncements(callback: (announcements: any[]) => void) {
  const path = "announcements";
  const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function createAnnouncement(title: string, content: string, imageUrl?: string): Promise<string> {
  const path = "announcements";
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Authentication required");
    const dId = doc(collection(db, path)).id;
    await setDoc(doc(db, path, dId), {
      title,
      content,
      imageUrl: imageUrl || "",
      createdAt: serverTimestamp(),
      createdBy: user.uid
    });
    return dId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  const path = `announcements/${announcementId}`;
  try {
    await deleteDoc(doc(db, "announcements", announcementId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToNotifications(userId: string | null, isAdmin: boolean, callback: (notifications: any[]) => void) {
  if (!userId) {
    return () => {};
  }

  const path = "notifications";
  const targetUserIds = ["all", userId];
  if (isAdmin) {
    targetUserIds.push("admin");
  }

  const q = query(
    collection(db, "notifications"),
    where("userId", "in", targetUserIds)
  );

  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as any)
    }));
    
    // Sort client-side of createdAt desc to avoid composite index requirement
    list.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function createNotification(text: string, type: "approval" | "new_quiz" | "new_announcement" | "payment_request", userId?: string): Promise<string> {
  const path = "notifications";
  try {
    const docRef = doc(collection(db, path));
    const payload = {
      text,
      type,
      userId: userId || "all",
      createdAt: serverTimestamp(),
      readBy: []
    };
    await setDoc(docRef, payload);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      readBy: arrayUnion(userId)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await deleteDoc(doc(db, "notifications", notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ----------------------------------------------------
// New Advanced Functions: Edit Quiz & Admin Permissions
// ----------------------------------------------------

export async function updateQuiz(
  quizId: string,
  categoryId: string,
  title: string,
  description: string,
  timeLimit: number,
  questions: Omit<Question, "createdAt">[],
  isFree?: boolean
): Promise<void> {
  const path = `quizzes/${quizId}`;
  try {
    // Update main fields
    await updateDoc(doc(db, "quizzes", quizId), {
      categoryId,
      title,
      description,
      timeLimit: Number(timeLimit),
      questionsCount: questions.length,
      isFree: !!isFree
    });

    // Delete existing questions inside the subcollection
    const qSnapshot = await getDocs(collection(db, "quizzes", quizId, "questions"));
    for (const d of qSnapshot.docs) {
      await deleteDoc(d.ref);
    }

    // Add new questions to subcollection
    const questionsPath = `quizzes/${quizId}/questions`;
    for (const q of questions) {
      const qId = doc(collection(db, questionsPath)).id;
      const qPayload = {
        text: q.text,
        options: q.options,
        correctIndex: Number(q.correctIndex),
        explanation: q.explanation || "",
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, "quizzes", quizId, "questions", qId), qPayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateAdminPermissions(
  userId: string,
  permissions: { createQuiz: boolean; createAnnouncement: boolean; deleteQuiz: boolean; }
): Promise<void> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, "users", userId), { adminPermissions: permissions });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ----------------------------------------------------
// Support Chat Real-time Operations (Requirement 7)
// ----------------------------------------------------

export async function sendSupportMessage(
  chatUserId: string,
  displayUserName: string,
  text: string,
  senderRole: "user" | "admin",
  imageUrl?: string
) {
  const path = `support_chats/${chatUserId}`;
  try {
    const chatRef = doc(db, "support_chats", chatUserId);
    const user = auth.currentUser;
    if (!user) throw new Error("Authentication required");

    const messagePayload = {
      text,
      senderId: user.uid,
      senderName: user.displayName || user.email?.split("@")[0] || "ผู้สนับสนุน",
      senderRole,
      createdAt: serverTimestamp(),
      ...(imageUrl ? { imageUrl } : {})
    };

    const messagesCollectionRef = collection(db, "support_chats", chatUserId, "messages");
    await addDoc(messagesCollectionRef, messagePayload);

    await setDoc(chatRef, {
      userId: chatUserId,
      userName: displayUserName,
      userEmail: user.email || "",
      lastMessageText: imageUrl && !text ? "🖼️ แนบรูปภาพ" : text,
      lastMessageAt: serverTimestamp(),
      ...(senderRole === "user" 
        ? { unreadByAdmin: true } 
        : { unreadByUser: true })
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToUserMessages(chatUserId: string, callback: (messages: any[]) => void) {
  const path = `support_chats/${chatUserId}/messages`;
  const q = query(
    collection(db, "support_chats", chatUserId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(list);
  }, (err) => {
    console.error("Error subscribing to messages:", err);
    handleFirestoreError(err, OperationType.LIST, path);
  });
}

export function subscribeToAllChats(callback: (chats: any[]) => void) {
  const path = "support_chats";
  const q = query(
    collection(db, "support_chats"),
    orderBy("lastMessageAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(list);
  }, (err) => {
    console.error("Error subscribing to all chats:", err);
    handleFirestoreError(err, OperationType.LIST, path);
  });
}

export async function markChatAsReadInDB(chatUserId: string, role: "user" | "admin") {
  const path = `support_chats/${chatUserId}`;
  try {
    const chatRef = doc(db, "support_chats", chatUserId);
    const snap = await getDoc(chatRef);
    if (snap.exists()) {
      const updateField = role === "admin" ? { unreadByAdmin: false } : { unreadByUser: false };
      await updateDoc(chatRef, updateField);
    }
  } catch (err) {
    console.warn("Failed to mark chat as read:", err);
  }
}

export async function deleteSupportChat(chatUserId: string): Promise<void> {
  const path = `support_chats/${chatUserId}`;
  try {
    // Delete all messages in the subcollection first
    const messagesRef = collection(db, "support_chats", chatUserId, "messages");
    const snapshot = await getDocs(messagesRef);
    const deletePromises = snapshot.docs.map(docRef => deleteDoc(docRef.ref));
    await Promise.all(deletePromises);

    // Delete the chat document
    await deleteDoc(doc(db, "support_chats", chatUserId));
  } catch (error) {
    console.error("Failed to delete support chat:", error);
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteSupportMessage(chatUserId: string, messageId: string): Promise<void> {
  const path = `support_chats/${chatUserId}/messages/${messageId}`;
  try {
    await deleteDoc(doc(db, "support_chats", chatUserId, "messages", messageId));

    // Update the parent support_chat if there are newer messages
    const messagesRef = collection(db, "support_chats", chatUserId, "messages");
    const qSnapshot = await getDocs(query(messagesRef, orderBy("createdAt", "desc"), limit(1)));
    if (!qSnapshot.empty) {
      const latestMsg = qSnapshot.docs[0].data();
      await updateDoc(doc(db, "support_chats", chatUserId), {
        lastMessageText: latestMsg.text,
        lastMessageAt: latestMsg.createdAt || serverTimestamp()
      });
    } else {
      // If no messages left, delete the empty support_chat document as well so it doesn't linger in list
      await deleteDoc(doc(db, "support_chats", chatUserId));
    }
  } catch (error) {
    console.error("Failed to delete support message:", error);
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function resolveSupportChat(chatUserId: string): Promise<void> {
  const path = `support_chats/${chatUserId}`;
  try {
    const chatRef = doc(db, "support_chats", chatUserId);
    await updateDoc(chatRef, {
      status: "resolved",
      resolvedAt: serverTimestamp(),
      unreadByAdmin: false,
      unreadByUser: false
    });
  } catch (error) {
    console.error("Failed to resolve support chat:", error);
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function reopenSupportChat(chatUserId: string): Promise<void> {
  const path = `support_chats/${chatUserId}`;
  try {
    const chatRef = doc(db, "support_chats", chatUserId);
    await updateDoc(chatRef, {
      status: "open",
      resolvedAt: null,
      unreadByAdmin: true
    });
  } catch (error) {
    console.error("Failed to reopen support chat:", error);
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
