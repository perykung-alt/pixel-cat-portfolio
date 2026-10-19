// ล็อกอิน Google + เก็บข้อมูลพอร์ตบนคลาวด์ (Firebase Auth + Firestore)
// ข้อมูลแต่ละคนอยู่ที่ users/{uid} อ่าน/เขียนได้เฉพาะเจ้าของ (ตามกฎใน firestore.rules)
"use strict";
(function () {
  const V = "10.14.1";
  const BASE = `https://www.gstatic.com/firebasejs/${V}/`;
  const listeners = new Set();
  const Cloud = {
    configured: !!window.PCP_FIREBASE,
    ready: false,
    user: null,
    error: null,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  const emit = () => listeners.forEach((fn) => { try { fn(Cloud); } catch (e) {} });
  let M = null; // โมดูล firebase ที่โหลดแล้ว
  let auth = null, db = null;

  async function load() {
    if (M) return M;
    const [app, au, fs] = await Promise.all([
      import(BASE + "firebase-app.js"), import(BASE + "firebase-auth.js"), import(BASE + "firebase-firestore-lite.js"),
    ]);
    M = { app, au, fs };
    const a = app.initializeApp(window.PCP_FIREBASE);
    auth = au.getAuth(a);
    db = fs.getFirestore(a);
    return M;
  }

  Cloud.init = async function () {
    if (!Cloud.configured) { Cloud.ready = true; emit(); return Cloud; }
    try {
      await load();
      try { await M.au.getRedirectResult(auth); } catch (e) { Cloud.error = e.message; }
      await new Promise((resolve) => {
        let first = true;
        M.au.onAuthStateChanged(auth, (u) => {
          Cloud.user = u ? { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL } : null;
          Cloud.ready = true; emit();
          if (first) { first = false; resolve(); }
        });
      });
    } catch (e) { Cloud.error = "โหลดระบบล็อกอินไม่ได้: " + e.message; Cloud.ready = true; emit(); }
    return Cloud;
  };

  // หน้าเว็บ/Chrome: ป๊อปอัป Google · ป๊อปอัปถูกบล็อก → เปลี่ยนเป็นพาไปหน้า Google แล้วกลับมา
  Cloud.signIn = async function () {
    await load();
    const p = new M.au.GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    try { return await M.au.signInWithPopup(auth, p); }
    catch (e) {
      if (/popup-blocked|operation-not-supported/.test(e.code || "")) return M.au.signInWithRedirect(auth, p);
      throw e;
    }
  };
  // ใช้ในหน้า login.html: คืน Google ID token เพื่อส่งกลับเข้าแอป Android
  Cloud.googleIdToken = async function () {
    const res = await Cloud.signIn();
    const cred = res && M.au.GoogleAuthProvider.credentialFromResult(res);
    return cred && cred.idToken;
  };
  // แอป Android: รับ ID token จากหน้า login ใน Chrome แล้วล็อกอินในแอป
  Cloud.signInWithIdToken = async function (idToken) {
    await load();
    return M.au.signInWithCredential(auth, M.au.GoogleAuthProvider.credential(idToken));
  };
  Cloud.signOut = async function () { await load(); await M.au.signOut(auth); };

  const ref = () => M.fs.doc(db, "users", Cloud.user.uid);
  Cloud.pull = async function () {
    if (!Cloud.user) return null;
    await load();
    const snap = await M.fs.getDoc(ref());
    if (!snap.exists()) return null;
    const v = snap.data();
    return { data: v.data ? JSON.parse(v.data) : null, hist: v.hist ? JSON.parse(v.hist) : [], updatedAt: v.updatedAt || 0, device: v.device || "" };
  };
  Cloud.push = async function (data, hist, device) {
    if (!Cloud.user) return false;
    await load();
    const d = Object.assign({}, data); delete d.fresh;
    await M.fs.setDoc(ref(), {
      data: JSON.stringify(d), hist: JSON.stringify((hist || []).slice(-730)),
      updatedAt: d.updatedAt || Date.now(), device: device || "", v: 1,
    });
    return true;
  };
  window.Cloud = Cloud;
})();
