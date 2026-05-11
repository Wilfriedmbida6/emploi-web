import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

// ══════════════════════════════════════════════════════════════
//  ⚠️  CONFIG SUPABASE — 2 endroits à modifier
//  1. SUPABASE_URL  → Settings > API > Project URL
//  2. SUPABASE_ANON → Settings > API Keys > Publishable key
// ══════════════════════════════════════════════════════════════

// mes clé
const SERVER_URL    = "https://server-ept-production.up.railway.app/";
const SUPABASE_URL  = "https://jyhrsjpotdtzqmlkstlh.supabase.co";
const SUPABASE_ANON = "sb_publishable_euGDreRpPT-ykZjeEiCiMQ_fkbVAais";

// ══════════════════════════════════════════════════════════════
//  CLIENT SUPABASE LÉGER (sans npm — appels fetch directs)
//  Toutes les fonctions d'auth et de DB passent par ici
// ══════════════════════════════════════════════════════════════
const sb = {
  // Headers communs
  headers: (token) => ({
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON,
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  }),

  // ── AUTH ──────────────────────────────────────────────────
  // Inscription
  async signUp(email, password, meta) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST", headers: sb.headers(),
      body: JSON.stringify({ email, password, data: meta }),
    });
    return r.json();
  },

  // Connexion
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: sb.headers(),
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },

  // Déconnexion
  async signOut(token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST", headers: sb.headers(token),
    });
  },

  // Récupérer session depuis localStorage
  getSession() {
    try {
      const raw = localStorage.getItem("ept_session");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  // Sauvegarder session
  saveSession(session) {
    try { localStorage.setItem("ept_session", JSON.stringify(session)); } catch {}
  },

  // Effacer session
  clearSession() {
    try { localStorage.removeItem("ept_session"); } catch {}
  },

  // Rafraîchir le token
  async refreshToken(refresh_token) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: sb.headers(),
      body: JSON.stringify({ refresh_token }),
    });
    return r.json();
  },

  // ── DATABASE ──────────────────────────────────────────────
  // Lire des lignes : sb.select("profiles", "id,name,role", token)
  async select(table, columns = "*", token, filter = "") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}${filter}`, {
      headers: sb.headers(token),
    });
    return r.json();
  },

  // Insérer une ligne
  async insert(table, data, token) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...sb.headers(token), "Prefer": "return=representation" },
      body: JSON.stringify(data),
    });
    return r.json();
  },

  // Mettre à jour
  async update(table, match, data, token) {
    const filter = Object.entries(match).map(([k,v])=>`${k}=eq.${v}`).join("&");
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
      method: "PATCH",
      headers: { ...sb.headers(token), "Prefer": "return=representation" },
      body: JSON.stringify(data),
    });
    return r.json();
  },

  // Supprimer
  async delete(table, match, token) {
    const filter = Object.entries(match).map(([k,v])=>`${k}=eq.${v}`).join("&");
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
      method: "DELETE", headers: sb.headers(token),
    });
  },
};

// Compte admin (vérification locale, jamais envoyé à Supabase)
const ADMIN_EMAIL = "admin@emploipourtous.com";
const ADMIN_PASS  = "Admin@2025!";

// ══════════════════════════════════════════════════════════════
//  DONNÉES DE DÉMONSTRATION
// ══════════════════════════════════════════════════════════════
const mockUsers = [
  { id:1, name:"Mamadou Diallo",  role:"technicien", avatar:"MD", city:"Dakar",   rating:4.8, exp:7,  skills:["Plomberie","Électricité"], status:"active", joined:"2025-01-10", jobs:34, online:true },
  { id:2, name:"Fatou Ndiaye",    role:"technicien", avatar:"FN", city:"Abidjan", rating:4.5, exp:3,  skills:["Peinture","Carrelage"],    status:"active", joined:"2025-02-15", jobs:18, online:false },
  { id:3, name:"Kofi Atta",       role:"technicien", avatar:"KA", city:"Accra",   rating:4.9, exp:12, skills:["Menuiserie","Soudure"],    status:"active", joined:"2024-11-01", jobs:87, online:true },
  { id:4, name:"Aminata Touré",   role:"client",     avatar:"AT", city:"Conakry", rating:4.2, exp:0,  skills:[],                          status:"active", joined:"2025-03-05", jobs:0,  online:true },
  { id:5, name:"Ibrahima Sow",    role:"technicien", avatar:"IS", city:"Bamako",  rating:3.9, exp:5,  skills:["Climatisation"],           status:"muted",  joined:"2025-01-22", jobs:21, online:false },
  { id:6, name:"Aïcha Coulibaly", role:"client",     avatar:"AC", city:"Lomé",    rating:4.6, exp:0,  skills:[],                          status:"active", joined:"2025-04-01", jobs:0,  online:true },
];
const mockJobs = [
  { id:1, title:"Réparation fuite d'eau urgente",   category:"Plomberie",    city:"Dakar",   budget:"15 000 FCFA",  urgent:true,  postedBy:"Aminata Touré",   date:"2025-04-29", status:"open",   applicants:3 },
  { id:2, title:"Installation panneau solaire 5kW", category:"Électricité",  city:"Abidjan", budget:"450 000 FCFA", urgent:false, postedBy:"Aïcha Coulibaly", date:"2025-04-28", status:"open",   applicants:7 },
  { id:3, title:"Peinture appartement F4",          category:"Peinture",     city:"Accra",   budget:"80 000 FCFA",  urgent:false, postedBy:"Aminata Touré",   date:"2025-04-27", status:"closed", applicants:12 },
  { id:4, title:"Climatisation bureau 3 pièces",    category:"Climatisation",city:"Bamako",  budget:"120 000 FCFA", urgent:true,  postedBy:"Aïcha Coulibaly", date:"2025-04-29", status:"open",   applicants:2 },
  { id:5, title:"Carrelage cuisine + bain",         category:"Carrelage",    city:"Lomé",    budget:"95 000 FCFA",  urgent:false, postedBy:"Aminata Touré",   date:"2025-04-26", status:"open",   applicants:5 },
];
// Notifs admin (new_user, report = admin seulement)
const mockAdminNotifs = [
  { id:1, type:"new_user",    msg:"Nouveau membre : Aïcha Coulibaly",      time:"Il y a 2h", read:false },
  { id:2, type:"new_job",     msg:"Nouvelle offre : Installation solaire", time:"Il y a 3h", read:false },
  { id:3, type:"report",      msg:"Signalement sur Ibrahima Sow",          time:"Il y a 5h", read:false },
  { id:4, type:"new_user",    msg:"Nouveau membre : Kofi Atta",            time:"Il y a 1j", read:true  },
];
// Notifs utilisateur (messages, offres, candidatures — PAS new_user ni report)
const mockNotifs = [
  { id:2, type:"new_job",     msg:"Nouvelle offre : Installation solaire", time:"Il y a 3h", read:false },
  { id:5, type:"message",     msg:"Nouveau message de Mamadou Diallo",     time:"Il y a 1j", read:true, from:"Mamadou Diallo" },
  { id:6, type:"application", msg:"Candidature reçue pour votre offre",   time:"Il y a 2j", read:true  },
];
const mockMessages = [
  { id:1, from:"Mamadou Diallo", text:"Bonjour ! J'ai un problème avec mon profil.", time:"10:30", isMe:false },
  { id:2, from:"Moi",            text:"Bonjour, quel est le problème exactement ?",  time:"10:32", isMe:true  },
  { id:3, from:"Mamadou Diallo", text:"Je n'arrive pas à uploader mon CV.",           time:"10:33", isMe:false },
];
const CATEGORIES = [
  "Plomberie","Électricité","Peinture","Menuiserie","Carrelage",
  "Climatisation","Soudure","Jardinage","Nettoyage","Sécurité",
  "Informatique","Électroménager","Ménagère","Repassage","Cuisine",
  "Garde d'enfants","Aide aux personnes âgées","Maçonnerie","Couture",
  "Coiffure","Mécanique","Déménagement","Livraison","Autre (préciser)",
];

// ══════════════════════════════════════════════════════════════
//  DESIGN SYSTEM
// ══════════════════════════════════════════════════════════════
const C = { bg:"#0d1b2a", card:"#122236", accent:"#1E88E5", gold:"#FFB800", red:"#EF5350", green:"#00E676", muted:"#607080", border:"#1e3a52", text:"#E8F0FE", sub:"#90A4AE" };
const AVATAR_COLORS = ["#1565C0","#6A1B9A","#00796B","#C62828","#F57F17","#2E7D32","#0277BD","#AD1457"];
const getColor = (name="A") => AVATAR_COLORS[(name?.charCodeAt(0)||65) % AVATAR_COLORS.length];

const css = {
  app:   { fontFamily:"'DM Sans',sans-serif", background:C.bg, minHeight:"100vh", height:"100vh", overflowY:"auto", WebkitOverflowScrolling:"touch", color:C.text },
  card:  { background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:20, marginBottom:14 },
  input: { background:"#0a1520", border:`1px solid ${C.border}`, borderRadius:10, padding:"11px 14px", color:C.text, fontSize:14, width:"100%", outline:"none", fontFamily:"inherit", boxSizing:"border-box" },
  label: { fontSize:12, color:C.sub, fontWeight:600, marginBottom:5, display:"block" },
  page:  { padding:"20px 20px 120px", maxWidth:520, margin:"0 auto", overflowX:"hidden" },
  title: { fontSize:22, fontWeight:800, fontFamily:"Georgia,serif", marginBottom:4, color:C.text },
  btn:   (bg=C.accent, extra={}) => ({ background:bg, color:"#fff", border:"none", borderRadius:10, padding:"10px 20px", cursor:"pointer", fontWeight:700, fontSize:14, fontFamily:"inherit", ...extra }),
  nav:   { display:"flex", alignItems:"center", gap:8, padding:"0 20px", height:60, background:"#091623", borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, zIndex:100 },
  bottomNav: { display:"flex", position:"fixed", bottom:0, left:0, right:0, background:"#091623", borderTop:`1px solid ${C.border}`, zIndex:999, paddingBottom:"env(safe-area-inset-bottom,0px)" },
};

// ── Mini-composants ────────────────────────────────────────────
const Chip = ({ label, color }) => (
  <span style={{ background:color+"22", color, border:`1px solid ${color}44`, borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700 }}>{label}</span>
);
const Av = ({ initials="?", size=44, bg="#1565C0", online }) => (
  <div style={{ position:"relative", display:"inline-flex", flexShrink:0 }}>
    <div style={{ width:size, height:size, borderRadius:"50%", background:bg, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:size*.34, fontFamily:"Georgia,serif", border:"2px solid rgba(255,255,255,.12)" }}>{initials}</div>
    {online!=null && <div style={{ position:"absolute", bottom:1, right:1, width:10, height:10, borderRadius:"50%", background:online?"#00E676":"#607080", border:`2px solid ${C.bg}` }} />}
  </div>
);
const Toast = ({ t }) => (
  <div style={{ position:"fixed", top:70, left:"50%", transform:"translateX(-50%)", background:t.err?"#C62828":"#2E7D32", color:"#fff", padding:"12px 26px", borderRadius:12, fontWeight:700, fontSize:14, zIndex:9999, boxShadow:"0 8px 32px rgba(0,0,0,.5)", whiteSpace:"nowrap", pointerEvents:"none" }}>
    {t.err?"✕ ":"✓ "}{t.msg}
  </div>
);
const Logo = ({ size=44 }) => (
  <div style={{ width:size, height:size, borderRadius:size*.24, background:"linear-gradient(135deg,#1E88E5,#0D47A1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 4px 14px #1E88E555" }}>
    <span style={{ fontSize:size*.46, fontWeight:900, color:"#fff", fontFamily:"Georgia,serif", lineHeight:1 }}>E</span>
  </div>
);
const BtnPrimary = ({ label, onClick, loading, style={} }) => (
  <button style={{ ...css.btn("linear-gradient(135deg,#1E88E5,#0D47A1)"), width:"100%", padding:"13px 0", fontSize:15, opacity:loading?.5:1, ...style }} onClick={onClick} disabled={loading}>
    {loading ? "⏳ Chargement..." : label}
  </button>
);

// ══════════════════════════════════════════════════════════════
//  APP ROOT
// ══════════════════════════════════════════════════════════════
export default function App() {
  // Auth state
  const [screen, setScreen]     = useState("loading"); // loading | login | admin | user
  const [authMode, setAuthMode] = useState("login");
  const [regStep, setRegStep]   = useState(1);
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken]     = useState(null); // JWT Supabase

  // UI state
  const [activeChatContact, setActiveChatContact] = useState(null);
  const socketRef = useRef(null);
  const [tab, _setTab]        = useState("home");
  const [prevTab, setPrevTab_unused] = useState("home");
  const setTab = (newTab) => { setPrevTab_unused(tab); _setTab(newTab); };
  const [searchQ, setSearchQ] = useState("");
  const [selUser, setSelUser] = useState(null);
  const [showJob, setShowJob] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [newMsg, setNewMsg]     = useState("");
  const [myRatings, setMyRatings] = useState({});

  const [highlightJob, setHighlightJob] = useState(null);
  const [onlineFilter, setOnlineFilter] = useState(false);
  const [viewProfileUser, setViewProfileUser] = useState(null);
  const chatRef = useRef(null);

  // Data
  const [users, setUsers]   = useState(mockUsers);
  const [jobs, setJobs]     = useState(mockJobs);
  const [notifs, setNotifs] = useState(mockNotifs);         // notifs utilisateur
  const [adminNotifs, setAdminNotifs] = useState(mockAdminNotifs); // notifs admin seulement
  const [msgs, setMsgs]     = useState(mockMessages);
  const [jobForm, setJobForm] = useState({ title:"", category:"", city:"", budget:"", urgent:false });
  // États chat globaux (persistent quand on change d'onglet)
  const [chatMsgs, setChatMsgs]       = useState(() => { try { return JSON.parse(localStorage.getItem('ept_msgs')||'{}'); } catch{return {};} });
  const [chatTyping, setChatTyping]   = useState({});
  const [chatStatus, setChatStatus]   = useState({});

  // Form fields
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [showPw, setShowPw] = useState(false);
  const [rName, setRName]   = useState("");
  const [rEmail, setREmail] = useState("");
  const [rPass, setRPass]   = useState("");
  const [rRole, setRRole]   = useState("technicien");
  const [rCity, setRCity]   = useState("");
  const [rExp, setRExp]     = useState("0");
  const [rSkills, setRSkills] = useState([]);

  const unread      = notifs.filter(n => !n.read).length;
  const adminUnread = screen==="admin" ? (adminNotifs||[]).filter(n=>!n.read).length : 0;

  const toast$ = (msg, err=false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── RESTAURATION DE SESSION AU DÉMARRAGE ─────────────────────
  useEffect(() => {
    const restore = async () => {
      const session = sb.getSession();
      if (!session?.access_token) { setScreen("login"); return; }



      // Vérifier si le token est encore valide
      try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: sb.headers(session.access_token),
        });

        if (r.ok) {
          // Token valide — restaurer l'utilisateur
          const user = await r.json();
          const profile = await sb.select("profiles", "*", session.access_token, `&id=eq.${user.id}`);
          const p = Array.isArray(profile) ? profile[0] : null;
          setCurrentUser({ ...user, ...(p || {}), token: session.access_token });
          setAuthToken(session.access_token);
          
          if (user.email === ADMIN_EMAIL) { setScreen("admin"); setTab("dashboard"); }
          else { 
            await loadUsers(session.access_token);
            await loadJobs(session.access_token);
            setScreen("user"); setTab("home"); 
          }

        } else if (session.refresh_token) {
          // Token expiré → rafraîchir
          const refreshed = await sb.refreshToken(session.refresh_token);
          if (refreshed.access_token) {
            sb.saveSession(refreshed);
            setAuthToken(refreshed.access_token);
            setCurrentUser({ ...refreshed.user, token: refreshed.access_token });
            setScreen("user"); setTab("home");
          } else {
            sb.clearSession(); setScreen("login");
          }
        } else {
          sb.clearSession(); setScreen("login");
        }
      } catch {
        // Pas de réseau — connexion offline avec session locale
        setCurrentUser({ email: session.user_email || "utilisateur", name: session.user_name || "Utilisateur" });
        setScreen("user"); setTab("home");
      }
    };
    restore();
  }, []);
  // ─── CHARGER DONNÉES SUPABASE ─────────────────────────────────
  const loadUsers = async (token) => {
    try {
      const data = await sb.select("profiles", "*", token);
      if (Array.isArray(data) && data.length > 0) {
        setUsers(data.map(u => ({
          ...u,
          avatar: u.name?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() || "?",
          online: u.online || false,
          jobs: u.jobs_done || 0,
        })));
      }
    } catch(e) { console.error("loadUsers error", e); }
  };

  const loadJobs = async (token) => {
    try {
      const data = await sb.select("jobs", "*", token);
      if (Array.isArray(data) && data.length > 0) setJobs(data);
    } catch(e) { console.error("loadJobs error", e); }
  };

  // ─── SOCKET.IO — CONNEXION TEMPS RÉEL ─────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      auth: {
        userId: currentUser.id,
        name: currentUser.name || currentUser.email
      }
    });
    socketRef.current = socket;
    socket.on("connect", () => console.log("🟢 Socket connecté à Railway"));
    socket.on("user_online", ({ name, online }) => {
      setUsers(u => u.map(x => x.name === name ? { ...x, online } : x));
    });
    socket.on("notification", (notif) => {
      setNotifs(n => [{ ...notif, id: Date.now(), read: false }, ...n]);
    });
    socket.on("message", (m) => {
      setChatMsgs(prev => {
        const next = { ...prev, [m.from]: [...(prev[m.from]||[]), { ...m, isMe:false }] };
        try { localStorage.setItem('ept_msgs', JSON.stringify(next)); } catch{}
        return next;
      });
    });
    socket.on("msg_status", ({ msgId, status }) => {
      setChatStatus(s => ({ ...s, [msgId]: status }));
    });
    socket.on("typing", ({ from, typing }) => {
      setChatTyping(t => ({ ...t, [from]: typing }));
      if (typing) setTimeout(() => setChatTyping(t => ({ ...t, [from]: false })), 3000);
    });
    return () => {
      // Ne pas déconnecter — garder le socket vivant entre les onglets
      // Seulement déconnecter si l'utilisateur se déconnecte (currentUser devient null)
      if (!currentUser) socket.disconnect();
    };
  }, [currentUser?.id]);  // ✅ Seulement quand l'ID change, pas à chaque re-render

  // ─── OPEN PROFILE ─────────────────────────────────────────────
  const openProfile = (userName) => {
    const u = users.find(x => x.name === userName);
    if (u) {
      setViewProfileUser(u); // will show as modal overlay
    } else {
      setTab("techniciens");
    }
  };

  // ─── LOGIN ────────────────────────────────────────────────────
  const doLogin = async () => {
    if (!email || !pass) { toast$("Remplissez tous les champs", true); return; }

    // Admin local
    if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && pass === ADMIN_PASS) {
      setScreen("admin"); setTab("dashboard"); toast$("Bienvenue Admin 👑"); return;
    }

    setLoading(true);
    try {
      const d = await sb.signIn(email.trim(), pass);

      if (d.error || !d.access_token) {
        toast$(d.error_description || "Email ou mot de passe incorrect", true);
        setLoading(false); return;
      }

      // Sauvegarder la session (persist au rechargement)
      sb.saveSession({ ...d, user_email: email.trim() });
      setAuthToken(d.access_token);

      // Charger le profil depuis la table "profiles"
      const profiles = await sb.select("profiles", "*", d.access_token, `&id=eq.${d.user.id}`);
      const profile  = Array.isArray(profiles) ? profiles[0] : null;

      const user = {
        ...d.user,
        ...(profile || {}),
        name:  profile?.name  || d.user.user_metadata?.full_name || email.split("@")[0],
        role:  profile?.role  || d.user.user_metadata?.role || "client",
        city:  profile?.city  || d.user.user_metadata?.city || "",
        token: d.access_token,
      };

      setCurrentUser(user);
      await loadUsers(d.access_token);
      await loadJobs(d.access_token);
      setScreen("user"); setTab("home");
      toast$(`Bienvenue ${user.name} ! 🎉`);
      
    } catch {
      toast$("Erreur réseau. Vérifiez votre connexion.", true);
    }
    setLoading(false);
  };

  // ─── REGISTER ────────────────────────────────────────────────
  const doRegister = async () => {
    if (regStep === 1) {
      if (!rName || !rEmail || !rPass) { toast$("Remplissez les champs obligatoires", true); return; }
      if (rPass.length < 6) { toast$("Mot de passe : 6 caractères minimum", true); return; }
      setRegStep(2); return;
    }

    setLoading(true);
    try {
      // 1. Créer le compte Auth Supabase
      const d = await sb.signUp(rEmail.trim(), rPass, {
        full_name: rName, role: rRole, city: rCity,
      });

      if (d.error || (!d.user && !d.id)) {
        toast$(d.error_description || d.msg || "Erreur lors de l'inscription", true);
        setLoading(false); return;
      }

      const userId = d.user?.id || d.id;

      // 2. Créer le profil dans la table "profiles"
      //    (la table doit exister — voir SQL ci-dessous)
      const profileData = {
        id:       userId,
        name:     rName,
        role:     rRole,
        city:     rCity,
        exp:      parseInt(rExp) || 0,
        skills:   rSkills || [],
        email:    rEmail.trim(),
        rating:   0,
        jobs_done:0,
        status:   "active",
        online:   true,
        joined:   new Date().toISOString().slice(0,10),
      };

      // Utiliser le token si dispo (auto-confirm activé), sinon le token anon
      const token = d.access_token || SUPABASE_ANON;
      await sb.insert("profiles", profileData, token);

      if (d.access_token) {
        // Auto-confirm activé → connexion directe
        sb.saveSession({ ...d, user_email: rEmail.trim(), user_name: rName });
        setAuthToken(d.access_token);
        setCurrentUser({ ...profileData, ...d.user, token: d.access_token });
        setUsers(u => [{ ...profileData, id: userId, avatar: rName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(), online:true }, ...u]);
        setScreen("user"); setTab("home");
        toast$("Compte créé ! Bienvenue 🎉");
      } else {
        // Email de confirmation envoyé
        toast$("✅ Compte créé ! Vérifiez votre email pour confirmer votre compte.", false);
        setAuthMode("login"); setRegStep(1);
      }

    } catch {
      toast$("Erreur réseau. Réessayez.", true);
    }
    setLoading(false);
  };

  const doLogout = async () => {
    if (authToken) {
      try { await sb.signOut(authToken); } catch {}
    }
    sb.clearSession();
    setScreen("login"); setCurrentUser(null); setAuthToken(null);
    setEmail(""); setPass(""); setRegStep(1); setAuthMode("login");
    toast$("Déconnecté");
  };

   const sendMsg = (text = null) => {
  const txt = text || newMsg.trim();
  if (!txt) return;
  
  const msg = {
    to: activeChatContact?.name,
    text: txt,
    msgId: Date.now()
  };
  
  socketRef.current?.emit("message", msg);
  setMsgs(m => [...m, { 
    id: Date.now(), 
    from: "Moi", 
    text: txt, 
    time: new Date().toLocaleTimeString("fr", {hour:"2-digit", minute:"2-digit"}), 
    isMe: true 
  }]);
  if (!text) setNewMsg("");
  setTimeout(() => chatRef.current?.scrollTo(0, 9999), 80);
};

  const openChat = (contactName, online=true) => {
    setActiveChatContact({ name:contactName, initials:contactName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(), online });
    setTab("chat");
  };

  const handlePostuler = (job) => {
    // Récupérer infos candidat
    let myName = "Moi", hasCv = false;
    try {
      const p = JSON.parse(localStorage.getItem("ept_profile") || "{}");
      myName = p.name || currentUser?.email || "Moi";
      hasCv  = !!localStorage.getItem("ept_cv_name");
    } catch(e){}

    // Déterminer salutation
    const now  = new Date().getHours();
    const sal  = now >= 6 && now < 18 ? "Bonjour" : "Bonsoir";
    const titre = job.title;
    const dest  = job.postedBy || "Madame/Monsieur";

    let msgText = hasCv
      ? `${sal} Mr/Mme ${dest}, je suis intéressé(e) par votre offre "${titre}", à cet effet j'y joins ci-après mon CV. Dans l'attente d'une suite favorable, je vous remercie Mr/Mme.`
      : `${sal} Mr/Mme ${dest}, je suis intéressé(e) par votre offre "${titre}". Dans l'attente d'une suite favorable, je vous passe mes sincères remerciements.`;

    if (hasCv) {
      const cvName = localStorage.getItem("ept_cv_name") || "mon_cv.pdf";
      msgText += ` [📄 CV joint : ${cvName}]`;
    }

    // Mettre à jour le nb de candidats
    setJobs(jj => jj.map(j => j.id===job.id ? { ...j, applicants:(j.applicants||0)+1 } : j));
    // Ouvrir le chat avec le propriétaire et envoyer le message
    sendMsg(msgText);
    openChat(dest, true);
    toast$("Candidature envoyée et message transmis ! ✓");
  };

  const postJob = async () => {
    if (!jobForm.title || !jobForm.category) { toast$("Titre et catégorie requis", true); return; }
    const authorName  = currentUser?.name || currentUser?.email || "Moi";
    const authorPhoto = currentUser?.photo_url || null;
    const newJob = {
      ...jobForm,
      posted_by: authorName,
      posted_by_photo: authorPhoto,
      date: new Date().toISOString().slice(0,10),
      status: "open",
      applicants: 0,
    };
    // Sauvegarder dans Supabase
    try {
      const saved = await sb.insert("jobs", newJob, authToken);
      const job = Array.isArray(saved) ? saved[0] : { ...newJob, id: Date.now(), postedBy: authorName };
      setJobs(j => [{ ...job, postedBy: job.posted_by || authorName }, ...j]);
    } catch(e) {
      // Fallback local si erreur
      setJobs(j => [{ id:Date.now(), ...newJob, postedBy: authorName }, ...j]);
    }
    setJobForm({ title:"",category:"",city:"",budget:"",urgent:false });
    setShowJob(false); toast$("Offre publiée ! ✅");
  };

  const filteredUsers = (list) => list.filter(u =>
    u.name?.toLowerCase().includes(searchQ.toLowerCase()) ||
    u.city?.toLowerCase().includes(searchQ.toLowerCase()) ||
    u.skills?.some(s => s.toLowerCase().includes(searchQ.toLowerCase())) ||
    u.role?.toLowerCase().includes(searchQ.toLowerCase())
  );

  // ══════════════════════════════════════════════════════════════
  //  ÉCRAN LOGIN / REGISTER
  // ══════════════════════════════════════════════════════════════
  if (screen === "loading") return (
    <div style={{ ...css.app, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20 }}>
      <div style={{ fontSize:48 }}>🏗️</div>
      <div style={{ fontWeight:800, fontSize:20, color:C.text, fontFamily:"Georgia,serif" }}>Emploi pour Tous</div>
      <div style={{ fontSize:13, color:C.sub }}>Connexion en cours…</div>
      <div style={{ width:40, height:4, borderRadius:4, background:C.border, overflow:"hidden", marginTop:8 }}>
        <div style={{ width:"60%", height:"100%", background:C.accent, borderRadius:4, animation:"typingDot 1s infinite" }} />
      </div>
    </div>
  );

  if (screen === "login") return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:C.bg, minHeight:"100vh", color:C.text, overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
      <Fonts />
      {toast && <Toast t={toast} />}
      <div style={{ position:"fixed", inset:0, background:"radial-gradient(ellipse at 20% 20%,#1E88E522,transparent 60%),radial-gradient(ellipse at 80% 80%,#FFB80011,transparent 60%)", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", padding:"32px 24px 80px", minHeight:"100vh" }}>
        <Logo size={64} />
        <h1 style={{ fontFamily:"Georgia,serif", fontSize:24, fontWeight:800, margin:"12px 0 4px", textAlign:"center" }}>Emploi pour Tous</h1>
        <p style={{ color:C.sub, fontSize:13, marginBottom:24, textAlign:"center" }}>La plateforme de services à domicile en Afrique 🌍</p>

        <div style={{ ...css.card, width:"100%", maxWidth:480 }}>
          {/* Onglets */}
          <div style={{ display:"flex", background:"#0a1520", borderRadius:10, padding:4, marginBottom:20 }}>
            {["login","register"].map(m => (
              <button key={m} style={{ flex:1, padding:"9px 0", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit", background:authMode===m?C.accent:"transparent", color:authMode===m?"#fff":C.sub, transition:"all .2s" }}
                onClick={()=>{ setAuthMode(m); setRegStep(1); }}>
                {m==="login"?"🔑 Se connecter":"✨ S'inscrire"}
              </button>
            ))}
          </div>

          {authMode === "login" && <>
            <label style={css.label}>Adresse email</label>
            <input style={{ ...css.input, marginBottom:14 }} type="email" placeholder="votre@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} />
            <label style={css.label}>Mot de passe</label>
            <div style={{ position:"relative", marginBottom:20 }}>
              <input style={{ ...css.input, paddingRight:44 }} type={showPw?"text":"password"} placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} />
              <button style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.sub, cursor:"pointer", fontSize:18 }} onClick={()=>setShowPw(p=>!p)}>{showPw?"🙈":"👁️"}</button>
            </div>
            <BtnPrimary label="Se connecter →" onClick={doLogin} loading={loading} />
            <div style={{ marginTop:16, padding:"10px 14px", background:"#1565C011", borderRadius:8, border:"1px solid #1565C033", fontSize:12, color:C.sub }}>
              <strong style={{ color:C.gold }}>👑 Admin :</strong> admin@emploipourtous.com / Admin@2025!
            </div>
          </>}

          {authMode === "register" && <>
            {regStep === 1 && <>
              <div style={{ fontSize:11, color:C.accent, fontWeight:700, marginBottom:14, textTransform:"uppercase", letterSpacing:1 }}>Étape 1 / 2 — Informations</div>
              <label style={css.label}>Nom complet *</label>
              <input style={{ ...css.input, marginBottom:12 }} placeholder="Prénom Nom" value={rName} onChange={e=>setRName(e.target.value)} />
              <label style={css.label}>Email *</label>
              <input style={{ ...css.input, marginBottom:12 }} type="email" placeholder="email@exemple.com" value={rEmail} onChange={e=>setREmail(e.target.value)} />
              <label style={css.label}>Mot de passe * (6 car. min.)</label>
              <div style={{ position:"relative", marginBottom:14 }}>
                <input style={{ ...css.input, paddingRight:44 }} type={showPw?"text":"password"} placeholder="••••••••" value={rPass} onChange={e=>setRPass(e.target.value)} />
                <button style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.sub, cursor:"pointer", fontSize:18 }} onClick={()=>setShowPw(p=>!p)}>{showPw?"🙈":"👁️"}</button>
              </div>
              <label style={css.label}>Rôle *</label>
              <div style={{ display:"flex", gap:10, marginBottom:16 }}>
                {[{v:"client",l:"👤 Client"},{v:"technicien",l:"🔧 Technicien"}].map(r=>(
                  <button key={r.v} style={{ flex:1, padding:"11px 0", borderRadius:10, border:`1px solid ${rRole===r.v?C.accent:C.border}`, background:rRole===r.v?C.accent:"#0a1520", color:rRole===r.v?"#fff":C.sub, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>setRRole(r.v)}>{r.l}</button>
                ))}
              </div>
              <BtnPrimary label="Suivant →" onClick={doRegister} loading={loading} />
            </>}

            {regStep === 2 && <>
              <div style={{ fontSize:11, color:C.accent, fontWeight:700, marginBottom:14, textTransform:"uppercase", letterSpacing:1 }}>Étape 2 / 2 — Votre profil</div>
              <label style={css.label}>Ville</label>
              <input style={{ ...css.input, marginBottom:12 }} placeholder="Ex: Dakar" value={rCity} onChange={e=>setRCity(e.target.value)} />
              {rRole==="technicien" && <>
                <label style={css.label}>Années d'expérience</label>
                <input style={{ ...css.input, marginBottom:12 }} type="number" min="0" value={rExp} onChange={e=>setRExp(e.target.value)} />
                <label style={css.label}>Compétences (cliquez pour sélectionner)</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10, maxHeight:160, overflowY:"auto", padding:"4px 0" }}>
                  {CATEGORIES.map(c=>(
                    <button key={c} style={{ padding:"5px 10px", borderRadius:20, border:`1px solid ${rSkills.includes(c)?C.accent:C.border}`, background:rSkills.includes(c)?C.accent:"#0a1520", color:rSkills.includes(c)?"#fff":C.sub, fontWeight:600, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}
                      onClick={()=>setRSkills(sk=>sk.includes(c)?sk.filter(x=>x!==c):[...sk,c])}>{c}</button>
                  ))}
                </div>
                <label style={css.label}>Ou précisez votre métier / compétence</label>
                <input style={{ ...css.input, marginBottom:16 }}
                  placeholder="Ex: Ménagère, Repasseur, Baby-sitter, Cuisinier, Gardien..."
                  onBlur={e=>{ const v=e.target.value.trim(); if(v&&!rSkills.includes(v)) setRSkills(sk=>[...sk,v]); e.target.value=""; }}
                  onKeyDown={e=>{ if(e.key==="Enter"){ const v=e.target.value.trim(); if(v&&!rSkills.includes(v)) setRSkills(sk=>[...sk,v]); e.target.value=""; }}} />
                {rSkills.length>0&&(
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
                    {rSkills.map(sk=>(
                      <span key={sk} style={{ background:C.accent+"22", color:C.accent, border:`1px solid ${C.accent}44`, borderRadius:20, padding:"4px 10px", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
                        {sk}
                        <button style={{ background:"none", border:"none", color:C.accent, cursor:"pointer", fontSize:14, lineHeight:1, padding:0 }} onClick={()=>setRSkills(s=>s.filter(x=>x!==sk))}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </>}
              <div style={{ display:"flex", gap:10, position:"sticky", bottom:0, background:C.card, paddingTop:12, marginTop:8, borderTop:`1px solid ${C.border}` }}>
                <button style={{ ...css.btn("#1e3a52"), flex:1, border:`1px solid ${C.border}` }} onClick={()=>setRegStep(1)}>← Retour</button>
                <div style={{ flex:2 }}><BtnPrimary label="✓ Créer mon compte" onClick={doRegister} loading={loading} /></div>
              </div>
            </>}
          </>}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  //  BARRE DE NAV COMMUNE
  // ══════════════════════════════════════════════════════════════
  const NavBar = ({ title, extra }) => (
    <div style={css.nav}>
      <Logo size={32} />
      <span style={{ fontWeight:800, fontSize:15, fontFamily:"Georgia,serif", flex:1 }}>{title}</span>
      {extra}
      <button style={{ ...css.btn("#1e3a52"), padding:"6px 12px", border:`1px solid ${C.border}`, fontSize:13, marginLeft:6 }} onClick={doLogout}>Déconn.</button>
    </div>
  );

  const TabBar = ({ tabs }) => (
    <div style={css.bottomNav}>
      {tabs.map(t => (
        <button key={t.id} style={{ flex:1, background:"none", border:"none", color:tab===t.id?C.accent:C.muted, padding:"10px 0", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, fontSize:18, position:"relative" }} onClick={()=>setTab(t.id)}>
          {t.icon}
          <span style={{ fontSize:9, fontWeight:700 }}>{t.label}</span>
          {t.badge>0&&<span style={{ position:"absolute", top:5, right:"calc(50% - 18px)", background:C.red, color:"#fff", borderRadius:"50%", width:15, height:15, fontSize:9, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>{t.badge}</span>}
          {tab===t.id&&<div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:28, height:3, background:C.accent, borderRadius:"0 0 4px 4px" }} />}
        </button>
      ))}
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  //  ADMIN
  // ══════════════════════════════════════════════════════════════
  if (screen === "admin") {
    const adminTabs = [
      { id:"dashboard", icon:"⊞",  label:"Dashboard" },
      { id:"users",     icon:"👥", label:"Membres" },
      { id:"jobs",      icon:"💼", label:"Offres" },
      { id:"notifs",    icon:"🔔", label:"Notifs", badge:unread },
      { id:"messages",  icon:"💬", label:"Messages" },
    ];
    return (
      <div style={css.app}>
        <Fonts />
        {toast && <Toast t={toast} />}
        <NavBar title="👑 Admin Panel" extra={
          <button style={{ ...css.btn("#1e3a52"), padding:"6px 12px", border:`1px solid ${C.border}`, fontSize:13, position:"relative" }} onClick={()=>setTab("notifs")}>
            🔔{unread>0&&<span style={{ position:"absolute", top:-4, right:-4, background:C.red, color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:9, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>{unread}</span>}
          </button>
        } />
        <div style={css.page}>
          {tab==="dashboard" && <AdminDash users={users} jobs={jobs} notifs={adminNotifs} setAdminNotifs={setAdminNotifs} setTab={setTab} />}
          {tab==="users"     && <AdminMembers users={filteredUsers(users)} searchQ={searchQ} setSearchQ={setSearchQ} selUser={selUser} setSelUser={setSelUser}
            onMute={id=>{ setUsers(u=>u.map(x=>x.id===id?{...x,status:"muted"}:x)); toast$("Utilisateur muté"); }}
            onActivate={id=>{ setUsers(u=>u.map(x=>x.id===id?{...x,status:"active"}:x)); toast$("Utilisateur activé"); }}
            onDelete={id=>{ if(window.confirm("Supprimer cet utilisateur ?")){ setUsers(u=>u.filter(x=>x.id!==id)); toast$("Utilisateur supprimé"); } }}
            setTab={setTab} />}
          {tab==="reported"  && <AdminMembers users={filteredUsers(users.filter(u=>adminNotifs.some(n=>n.type==="report"&&n.msg.includes(u.name.split(" ")[0]))))} searchQ={searchQ} setSearchQ={setSearchQ} selUser={selUser} setSelUser={setSelUser}
            onMute={id=>{ setUsers(u=>u.map(x=>x.id===id?{...x,status:"muted"}:x)); toast$("Utilisateur muté"); }}
            onActivate={id=>{ setUsers(u=>u.map(x=>x.id===id?{...x,status:"active"}:x)); toast$("Utilisateur activé"); }}
            onDelete={id=>{ if(window.confirm("Supprimer cet utilisateur ?")){ setUsers(u=>u.filter(x=>x.id!==id)); toast$("Utilisateur supprimé"); } }}
            setTab={setTab} reportedView />}
          {tab==="jobs"    && <AdminJobsTab jobs={jobs} setJobs={setJobs} toast$={toast$} setTab={setTab} />}
          {tab==="notifs"  && <NotifsTab notifs={adminNotifs} setNotifs={setAdminNotifs} unread={adminNotifs.filter(n=>!n.read).length} setTab={setTab} isAdmin />}
          {tab==="messages"&& <ChatTab msgs={msgs} setMsgs={setMsgs} newMsg={newMsg} setNewMsg={setNewMsg} sendMsg={sendMsg} chatRef={chatRef} voiceOn={voiceOn} setVoiceOn={setVoiceOn} setTab={setTab} prevTab={prevTab} currentUser={currentUser} />}
        </div>
        <TabBar tabs={adminTabs} />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  UTILISATEUR
  // ══════════════════════════════════════════════════════════════
  const userTabs = [
    { id:"home",        icon:"🏠", label:"Accueil" },
    { id:"jobs",        icon:"💼", label:"Offres" },
    { id:"techniciens", icon:"🔧", label:"Techs" },
    { id:"chat",        icon:"💬", label:"Chat" },
    { id:"profile",     icon:"👤", label:"Profil" },
  ];
  return (
    <div style={css.app}>
      <Fonts />
      {toast && <Toast t={toast} />}
      {/* ── MODAL PROFIL VISITEUR ── */}
      {viewProfileUser && (
        <ProfileModal user={viewProfileUser} onClose={()=>setViewProfileUser(null)} toast$={toast$} openChat={openChat} myRatings={myRatings} setMyRatings={setMyRatings} />
      )}
      <NavBar title="Emploi pour Tous" extra={
        <>
          <button style={{ ...css.btn("#1e3a52"), padding:"6px 12px", border:`1px solid ${C.border}`, fontSize:13 }} onClick={()=>{ setActiveChatContact(null); setTab("chat"); }}>💬</button>
          <button style={{ ...css.btn("#1e3a52"), padding:"6px 12px", border:`1px solid ${C.border}`, fontSize:13, marginLeft:6, position:"relative" }} onClick={()=>setTab("notifs")}>
            🔔{unread>0&&<span style={{ position:"absolute", top:-4, right:-4, background:C.red, color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:9, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>{unread}</span>}
          </button>
        </>
      } />
      <div style={css.page}>
        {tab==="home"        && <HomeTab users={users} jobs={jobs} setTab={setTab} toast$={toast$} openChat={openChat} handlePostuler={handlePostuler} setOnlineFilter={setOnlineFilter} openProfile={openProfile} />}
        {tab==="jobs"        && <JobsTab jobs={jobs} setJobs={setJobs} showJob={showJob} setShowJob={setShowJob} jobForm={jobForm} setJobForm={setJobForm} postJob={postJob} toast$={toast$} currentUser={currentUser} setTab={setTab} openChat={openChat} handlePostuler={handlePostuler} highlightJob={highlightJob} prevTab={prevTab} openProfile={openProfile} />}
        {tab==="techniciens" && <TechsTab users={filteredUsers(users.filter(u=>u.role==="technicien" && (!onlineFilter || u.online)))} searchQ={searchQ} setSearchQ={setSearchQ} selUser={selUser} setSelUser={setSelUser} setTab={setTab} toast$={toast$} myRatings={myRatings} setMyRatings={setMyRatings} openChat={openChat} onlineFilter={onlineFilter} setOnlineFilter={setOnlineFilter} viewProfileUser={viewProfileUser} setViewProfileUser={setViewProfileUser} />}
        {tab==="chat"        && <ChatTab msgs={msgs} setMsgs={setMsgs} newMsg={newMsg} setNewMsg={setNewMsg} sendMsg={sendMsg} chatRef={chatRef} voiceOn={voiceOn} setVoiceOn={setVoiceOn} activeChatContact={activeChatContact} setActiveChatContact={setActiveChatContact} setTab={setTab} prevTab={prevTab} currentUser={currentUser} appSocketRef={socketRef} chatMsgs={chatMsgs} setChatMsgs={setChatMsgs} chatTyping={chatTyping} chatStatus={chatStatus} setChatStatus={setChatStatus} />}
        {tab==="profile"     && <ProfileTab currentUser={currentUser} doLogout={doLogout} toast$={toast$} openChat={openChat} setTab={setTab} />}
        {tab==="notifs"      && <NotifsTab notifs={notifs} setNotifs={setNotifs} unread={unread} setTab={setTab} openChat={openChat} setHighlightJob={setHighlightJob} />}
      </div>
      <TabBar tabs={userTabs} />
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
//  PROFILE MODAL — Overlay profil technicien
// ══════════════════════════════════════════════════════════════
function ProfileModal({ user:u, onClose, toast$, openChat, myRatings, setMyRatings }) {
  const bg = getColor(u.name);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", zIndex:2000, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}
      onClick={onClose}>
      <div style={{ background:C.card, borderRadius:"24px 24px 0 0", padding:"24px 20px 40px", maxHeight:"88vh", overflowY:"auto", WebkitOverflowScrolling:"touch" }}
        onClick={e=>e.stopPropagation()}>
        {/* Drag handle */}
        <div style={{ width:40, height:4, borderRadius:4, background:C.border, margin:"0 auto 20px" }} />
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
          <Av initials={u.avatar||"??"} bg={bg} size={64} online={u.online} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:18, color:C.text }}>{u.name}</div>
            <div style={{ fontSize:12, color:C.sub }}>📍 {u.city||"—"} · {u.exp} ans d'exp.</div>
            {u.rating>0 && <div style={{ color:"#FFB800", fontSize:13, marginTop:3 }}>{"★".repeat(Math.floor(u.rating))}<span style={{ color:C.sub, fontSize:11, marginLeft:4 }}>{u.rating}/5</span></div>}
            <div style={{ fontSize:11, marginTop:4, color:u.online?"#00E676":"#607080", fontWeight:700 }}>{u.online?"● En ligne":"● Hors ligne"}</div>
          </div>
          <button style={{ background:"#1e3a52", border:"none", borderRadius:10, padding:"8px 12px", color:C.sub, fontSize:18, cursor:"pointer" }} onClick={onClose}>✕</button>
        </div>
        {/* Compétences */}
        {u.skills?.length>0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
            {u.skills.map(sk=><Chip key={sk} label={sk} color={C.accent} />)}
          </div>
        )}
        {/* Stats */}
        <div style={{ background:"#0a1520", borderRadius:12, padding:14, marginBottom:14, fontSize:13, lineHeight:2, color:C.sub }}>
          <div>🎓 <strong style={{ color:C.text }}>Expérience :</strong> {u.exp} ans</div>
          <div>🏆 <strong style={{ color:C.text }}>Missions :</strong> {u.jobs}</div>
          <div>⭐ <strong style={{ color:C.text }}>Note :</strong> {u.rating>0?`${u.rating}/5`:"Pas encore noté"}</div>
          <div>📍 <strong style={{ color:C.text }}>Localisation :</strong> {u.city||"—"}</div>
          <div>🔧 <strong style={{ color:C.text }}>Spécialités :</strong> {u.skills?.join(", ")||"—"}</div>
        </div>
        {/* Résumé */}
        <div style={{ background:"#0a1520", borderRadius:12, padding:14, marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:6 }}>📄 Résumé professionnel</div>
          <div style={{ fontSize:12, color:C.sub, lineHeight:1.7 }}>Professionnel avec {u.exp} ans d'expérience en {u.skills?.[0]||"services"}. Disponible rapidement pour toute mission.</div>
        </div>
        {/* Note */}
        <div style={{ background:"#0a1520", borderRadius:12, padding:14, marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:8 }}>⭐ Donner une note</div>
          <div style={{ display:"flex", gap:8 }}>
            {[1,2,3,4,5].map(star=>(
              <button key={star} style={{ background:"none", border:"none", cursor:"pointer", fontSize:30, color:(myRatings[u.id]||0)>=star?"#FFB800":"#2a3a4a", padding:0 }}
                onClick={()=>{ setMyRatings(r=>({...r,[u.id]:star})); toast$(`Note ${star}/5 envoyée ⭐`); }}>★</button>
            ))}
          </div>
        </div>
        {/* Actions */}
        <div style={{ display:"flex", gap:10, marginBottom:10 }}>
          <button style={{ ...css.btn(C.accent), flex:2, padding:"13px 0", fontSize:14 }} onClick={()=>{ onClose(); openChat?.(u.name, u.online); }}>💬 Contacter</button>
          <button style={{ ...css.btn("#6A1B9A"), flex:1, padding:"13px 0", fontSize:14 }} onClick={()=>toast$("Appel en cours... 📞")}>📞</button>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button style={{ ...css.btn(C.gold), flex:1, padding:"11px 0", fontSize:13 }} onClick={()=>toast$("Téléchargement CV... 📄")}>📋 CV</button>
          <button style={{ ...css.btn(C.red), flex:1, padding:"11px 0", fontSize:13 }} onClick={()=>{ toast$("Signalement envoyé à l'admin"); onClose(); }}>🚩 Signaler</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  JOBCARD — Carte offre avec auteur cliquable
// ══════════════════════════════════════════════════════════════
function JobCard({ job:j, toast$, compact=false, openChat, handlePostuler, setTab, highlighted=false, onViewProfile, currentUserName, onDeleteJob }) {
  const [showAuthor, setShowAuthor]   = useState(false);
  const [confirmDel, setConfirmDel]   = useState(false);
  const isMyJob = currentUserName && j.postedBy === currentUserName;
  const initials = (j.postedBy||"??").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const bg = j.postedByPhoto || null;
  const clr = getColor(j.postedBy||"A");
  return (
    <div style={{ background:C.card, borderRadius:16, border:`2px solid ${highlighted?C.gold:C.border}`, padding:18, marginBottom:14, borderLeft:`4px solid ${j.status==="open"?C.green:C.muted}`, boxShadow:highlighted?"0 0 20px #FFB80066":"none", transition:"all .3s" }}>
      {highlighted && <div style={{ background:C.gold+"22", borderRadius:8, padding:"6px 12px", marginBottom:10, fontSize:12, fontWeight:700, color:C.gold }}>⭐ Offre mise en avant</div>}
      {/* Auteur */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, cursor:"pointer" }} onClick={()=>setShowAuthor(v=>!v)}>
        {bg ? <img src={bg} alt="pp" style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.accent}`, flexShrink:0 }} />
            : <div style={{ width:40, height:40, borderRadius:"50%", background:clr, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:14, color:"#fff", flexShrink:0 }}>{initials}</div>}
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:14, color:C.text }}>{j.postedBy||"Anonyme"}</div>
          <div style={{ fontSize:11, color:C.sub }}>🗓 {j.date} · 📍 {j.city||"—"}</div>
        </div>
        <span style={{ color:C.sub, fontSize:13 }}>{showAuthor?"▲":"▼"}</span>
      </div>
      {/* Mini profil */}
      {showAuthor && (
        <div style={{ background:"#0a1520", borderRadius:12, padding:14, marginBottom:12, border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {bg ? <img src={bg} alt="pp" style={{ width:54, height:54, borderRadius:"50%", objectFit:"cover" }} />
                : <div style={{ width:54, height:54, borderRadius:"50%", background:clr, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:20, color:"#fff" }}>{initials}</div>}
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{j.postedBy||"Anonyme"}</div>
              <div style={{ fontSize:12, color:C.sub }}>📍 {j.city||"—"}</div>
              <div style={{ fontSize:11, color:C.green, marginTop:2 }}>● Membre actif</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:12 }}>
            <button style={{ flex:1, padding:"9px 0", borderRadius:10, border:"none", background:C.accent, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}
              onClick={()=>{ setShowAuthor(false); openChat?.(j.postedBy, true); }}>💬 Message</button>
            <button style={{ flex:1, padding:"9px 0", borderRadius:10, border:`1px solid ${C.border}`, background:"#1e3a52", color:C.text, fontWeight:700, fontSize:13, cursor:"pointer" }}
              onClick={()=>{ setShowAuthor(false); if(onViewProfile) onViewProfile(j.postedBy); else setTab?.("techniciens"); }}>👤 Voir profil</button>
          </div>
        </div>
      )}
      {/* Contenu */}
      <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{j.title}</div>
      <div style={{ fontSize:12, color:C.sub, marginTop:3 }}>🏷 {j.category} · 📍 {j.city||"—"}</div>
      {j.description && <div style={{ fontSize:13, color:C.sub, marginTop:6, lineHeight:1.6, padding:"8px 10px", background:"#0a1520", borderRadius:8 }}>{j.description}</div>}
      <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
        <span style={{ background:(j.status==="open"?C.green:C.muted)+"22", color:j.status==="open"?C.green:C.muted, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{j.status==="open"?"✅ Ouvert":"🔒 Fermé"}</span>
        {j.urgent&&<span style={{ background:C.red+"22", color:C.red, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>🔥 Urgent</span>}
        {j.budget&&<span style={{ background:C.gold+"22", color:C.gold, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>💰 {j.budget}</span>}
        <span style={{ background:C.accent+"22", color:C.accent, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>👥 {j.applicants||0} candidat{j.applicants!==1?"s":""}</span>
      </div>
      {!compact && j.status==="open" && !isMyJob && (
        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <button style={{ flex:2, padding:"11px 0", borderRadius:10, border:"none", background:"linear-gradient(135deg,#1E88E5,#0D47A1)", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}
            onClick={()=>handlePostuler?.(j)}>✓ Postuler</button>
          <button style={{ flex:1, padding:"11px 0", borderRadius:10, border:`1px solid ${C.border}`, background:"#1e3a52", color:C.text, fontWeight:700, fontSize:13, cursor:"pointer" }}
            onClick={()=>openChat?.(j.postedBy, true)}>💬 Contacter</button>
        </div>
      )}
      {/* Bouton supprimer — visible uniquement pour l'auteur */}
      {isMyJob && (
        <div style={{ marginTop:12 }}>
          {!confirmDel ? (
            <button style={{ width:"100%", padding:"10px 0", borderRadius:10, border:`1px solid ${C.red}55`, background:C.red+"11", color:C.red, fontWeight:700, fontSize:13, cursor:"pointer" }}
              onClick={()=>setConfirmDel(true)}>
              🗑️ Supprimer ma publication
            </button>
          ) : (
            <div style={{ background:C.red+"11", borderRadius:10, border:`1px solid ${C.red}44`, padding:"12px 14px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:10 }}>⚠️ Confirmer la suppression ?</div>
              <div style={{ display:"flex", gap:8 }}>
                <button style={{ flex:2, padding:"10px 0", borderRadius:10, border:"none", background:C.red, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}
                  onClick={()=>{ onDeleteJob?.(j.id); toast$?.("Publication supprimée 🗑️"); }}>
                  ✓ Oui, supprimer
                </button>
                <button style={{ flex:1, padding:"10px 0", borderRadius:10, border:`1px solid ${C.border}`, background:"#1e3a52", color:C.sub, fontWeight:700, fontSize:13, cursor:"pointer" }}
                  onClick={()=>setConfirmDel(false)}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
//  HOMETAB — Accueil utilisateur
// ══════════════════════════════════════════════════════════════
function HomeTab({ users, jobs, setTab, toast$, openChat, handlePostuler, setOnlineFilter, openProfile }) {
  return <>
    {/* Hero */}
    <div style={{ background:"linear-gradient(135deg,#1565C0,#0D47A1)", borderRadius:20, padding:24, marginBottom:20, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:-20, right:-20, width:120, height:120, borderRadius:"50%", background:"rgba(255,255,255,.05)" }} />
      <p style={{ fontSize:13, color:"rgba(255,255,255,.7)", margin:0 }}>Bienvenue 👋</p>
      <h2 style={{ fontFamily:"Georgia,serif", fontSize:22, margin:"6px 0 8px", color:"#fff" }}>Trouvez le bon prestataire</h2>
      <p style={{ fontSize:13, color:"rgba(255,255,255,.7)", margin:"0 0 16px" }}>Services à domicile en toute confiance 🌍</p>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        <button style={{ background:"#fff", color:"#0D47A1", border:"none", borderRadius:10, padding:"10px 18px", fontWeight:800, fontSize:13, cursor:"pointer" }} onClick={()=>setTab("techniciens")}>🔧 Trouver un prestataire</button>
        <button style={{ background:"rgba(255,255,255,.15)", color:"#fff", border:"1px solid rgba(255,255,255,.3)", borderRadius:10, padding:"10px 18px", fontWeight:700, fontSize:13, cursor:"pointer" }} onClick={()=>setTab("jobs")}>+ Publier une offre</button>
      </div>
    </div>

    {/* Stats cliquables */}
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
      {[
        { l:"Prestataires", v:users.filter(u=>u.role==="technicien").length, i:"🔧", t:"techniciens", filter:false },
        { l:"Offres actives",v:jobs.filter(j=>j.status==="open").length,     i:"💼", t:"jobs",        filter:false },
        { l:"En ligne",      v:users.filter(u=>u.role==="technicien"&&u.online).length, i:"🟢", t:"techniciens", filter:true  },
      ].map(s=>(
        <div key={s.l} onClick={()=>{ setOnlineFilter?.(s.filter); setTab(s.t); }}
          style={{ background:"#122236", borderRadius:16, border:"1px solid #1e3a52", padding:"14px 8px", marginBottom:0, textAlign:"center", cursor:"pointer" }}>
          <div style={{ fontSize:24 }}>{s.i}</div>
          <div style={{ fontWeight:800, fontSize:20, fontFamily:"Georgia,serif", color:"#E8F0FE" }}>{s.v}</div>
          <div style={{ fontSize:10, color:"#90A4AE" }}>{s.l}</div>
          <div style={{ fontSize:9, color:"#1E88E5", marginTop:2 }}>Voir →</div>
        </div>
      ))}
    </div>

    {/* Offres récentes */}
    <p style={{ fontWeight:800, fontSize:15, margin:"0 0 12px", color:"#E8F0FE" }}>Offres récentes 💼</p>
    {jobs.filter(j=>j.status==="open").map(j=>(
      <JobCard key={j.id} job={j} toast$={toast$} openChat={openChat} handlePostuler={handlePostuler} setTab={setTab} compact onViewProfile={openProfile} />
    ))}

    {/* Top prestataires */}
    <p style={{ fontWeight:800, fontSize:15, margin:"16px 0 12px", color:"#E8F0FE" }}>Top prestataires ⭐</p>
    <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:12 }}>
      {users.filter(u=>u.role==="technicien"&&u.rating>0).map(u=>(
        <div key={u.id} onClick={()=>setTab("techniciens")}
          style={{ background:"#122236", borderRadius:16, border:"1px solid #1e3a52", minWidth:138, marginBottom:0, textAlign:"center", padding:"16px 12px", flexShrink:0, cursor:"pointer" }}>
          <Av initials={u.avatar||"??"} bg={getColor(u.name)} size={48} online={u.online} />
          <div style={{ fontWeight:700, fontSize:12, marginTop:8, color:"#E8F0FE" }}>{u.name.split(" ")[0]}</div>
          <div style={{ fontSize:10, color:"#90A4AE" }}>{u.skills?.[0]||"Prestataire"}</div>
          <div style={{ color:"#FFB800", fontSize:12, marginTop:2 }}>{"★".repeat(Math.floor(u.rating))}<span style={{ color:"#90A4AE", fontSize:11, marginLeft:4 }}>{u.rating}</span></div>
          <button style={{ marginTop:8, padding:"5px 10px", borderRadius:8, border:"none", background:"#1E88E522", color:"#1E88E5", fontWeight:700, fontSize:11, cursor:"pointer" }}
            onClick={(e)=>{ e.stopPropagation(); openChat?.(u.name, u.online); }}>
            💬 Contacter
          </button>
        </div>
      ))}
    </div>
  </>;
}

// ══════════════════════════════════════════════════════════════
//  JOBSTAB — Onglet offres utilisateur
// ══════════════════════════════════════════════════════════════
function JobsTab({ jobs, setJobs, showJob, setShowJob, jobForm, setJobForm, postJob, toast$, currentUser, setTab, openChat, handlePostuler, highlightJob, openProfile }) {
  const [filter, setFilter]               = useState("all");
  const [useCustom, setUseCustom]         = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const CATS = ["Plomberie","Électricité","Peinture","Menuiserie","Carrelage","Climatisation","Soudure","Jardinage","Nettoyage","Sécurité","Informatique","Électroménager","Ménagère","Repassage","Cuisine","Garde d'enfants","Aide aux personnes âgées","Maçonnerie","Couture","Coiffure","Mécanique","Déménagement","Livraison"];
  const list = filter==="all"?jobs:jobs.filter(j=>j.status===filter);

  const handlePost = () => {
    const finalCat = useCustom ? customCategory.trim() : jobForm.category;
    if (!jobForm.title)  { toast$("Le titre est obligatoire", true); return; }
    if (!finalCat)       { toast$("Précisez le type de service", true); return; }
    setJobForm(f => ({ ...f, category: finalCat }));
    setTimeout(() => postJob(), 50);
  };

  return <>
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
      <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }} onClick={()=>setTab("home")}>←</button>
      <p style={{ ...css.title, marginBottom:0, flex:1 }}>Offres d'emploi</p>
      <button style={css.btn(C.green)} onClick={()=>setShowJob(v=>!v)}>+ Publier</button>
    </div>
    <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
      {[{v:"all",l:"Toutes"},{v:"open",l:"Ouvertes"},{v:"closed",l:"Fermées"}].map(f=>(
        <button key={f.v} style={{ ...css.btn(filter===f.v?C.accent:"#1e3a52"), padding:"6px 14px", fontSize:12, border:`1px solid ${filter===f.v?C.accent:C.border}` }} onClick={()=>setFilter(f.v)}>{f.l}</button>
      ))}
    </div>
    {showJob&&(
      <div style={{ ...css.card, border:`1px solid ${C.green}55`, marginBottom:16 }}>
        <p style={{ fontWeight:800, fontSize:15, marginBottom:4, color:C.green }}>📝 Publier une annonce</p>
        <p style={{ fontSize:12, color:"#90A4AE", marginBottom:14 }}>Décrivez votre besoin librement</p>
        <label style={css.label}>Titre de l'annonce *</label>
        <input style={{ ...css.input, marginBottom:14 }} placeholder="Ex: Cherche ménagère 3×/semaine..." value={jobForm.title} onChange={e=>setJobForm(f=>({...f,title:e.target.value}))} />
        <label style={css.label}>Type de service *</label>
        <div style={{ display:"flex", background:"#0a1520", borderRadius:10, padding:4, marginBottom:12, border:`1px solid ${C.border}` }}>
          <button style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none", fontWeight:700, fontSize:12, fontFamily:"inherit", cursor:"pointer", background:!useCustom?C.accent:"transparent", color:!useCustom?"#fff":C.sub }} onClick={()=>setUseCustom(false)}>📋 Liste</button>
          <button style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none", fontWeight:700, fontSize:12, fontFamily:"inherit", cursor:"pointer", background:useCustom?C.accent:"transparent", color:useCustom?"#fff":C.sub }} onClick={()=>setUseCustom(true)}>✏️ Écrire</button>
        </div>
        {!useCustom && <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>{CATS.map(c=><button key={c} style={{ padding:"6px 12px", borderRadius:20, border:`1px solid ${jobForm.category===c?C.accent:C.border}`, background:jobForm.category===c?C.accent:"#0a1520", color:jobForm.category===c?"#fff":C.sub, fontWeight:600, fontSize:11, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>setJobForm(f=>({...f,category:c}))}>{c}</button>)}</div>}
        {useCustom && <input style={{ ...css.input, marginBottom:12 }} placeholder="Ex: Ménagère, Baby-sitter, Gardien..." value={customCategory} onChange={e=>setCustomCategory(e.target.value)} />}
        {((useCustom&&customCategory)||(!useCustom&&jobForm.category)) && <div style={{ padding:"8px 12px", background:"#00E67611", borderRadius:10, border:"1px solid #00E67633", marginBottom:12, fontSize:13, color:C.green, fontWeight:700 }}>✅ {useCustom?customCategory:jobForm.category}</div>}
        <label style={css.label}>Description</label>
        <textarea style={{ ...css.input, resize:"vertical", minHeight:70, marginBottom:12 }} placeholder="Horaires, exigences, détails..." value={jobForm.description||""} onChange={e=>setJobForm(f=>({...f,description:e.target.value}))} />
        <label style={css.label}>Ville / Quartier</label>
        <input style={{ ...css.input, marginBottom:12 }} placeholder="Ex: Douala Bonapriso..." value={jobForm.city} onChange={e=>setJobForm(f=>({...f,city:e.target.value}))} />
        <label style={css.label}>Budget / Salaire</label>
        <input style={{ ...css.input, marginBottom:12 }} placeholder="Ex: 80 000 FCFA/mois, À négocier" value={jobForm.budget} onChange={e=>setJobForm(f=>({...f,budget:e.target.value}))} />
        <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", marginBottom:14, padding:"10px 12px", background:"#0a1520", borderRadius:10, border:`1px solid ${jobForm.urgent?C.red:C.border}`, fontSize:13, color:C.text }}>
          <input type="checkbox" checked={jobForm.urgent} onChange={e=>setJobForm(f=>({...f,urgent:e.target.checked}))} style={{ width:16, height:16 }} />
          <div><div style={{ fontWeight:700 }}>🔥 Besoin urgent</div><div style={{ fontSize:11, color:C.muted }}>Votre annonce sera mise en avant</div></div>
        </label>
        <div style={{ display:"flex", gap:10, position:"sticky", bottom:0, background:C.card, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
          <button style={{ ...css.btn("linear-gradient(135deg,#00796B,#00E676)"), flex:2, padding:"12px 0" }} onClick={handlePost}>✓ Publier</button>
          <button style={{ ...css.btn("#1e3a52"), flex:1, border:`1px solid ${C.border}` }} onClick={()=>{ setShowJob(false); setCustomCategory(""); setUseCustom(false); }}>Annuler</button>
        </div>
      </div>
    )}
    {list.map(j=>(
      <div key={j.id} id={`job-${j.id}`} style={highlightJob===j.id?{outline:`3px solid ${C.gold}`,borderRadius:18,boxShadow:`0 0 20px ${C.gold}44`}:{}} ref={highlightJob===j.id ? el=>{ if(el) setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"center"}),200); } : null}>
        <JobCard job={j} toast$={toast$} openChat={openChat} handlePostuler={handlePostuler} setTab={setTab} highlighted={highlightJob===j.id} onViewProfile={openProfile}
          currentUserName={currentUser?.name} onDeleteJob={(id)=>setJobs(jj=>jj.filter(x=>x.id!==id))} />
      </div>
    ))}
  </>;
}

// ══════════════════════════════════════════════════════════════
//  ADMIN TABS
// ══════════════════════════════════════════════════════════════
function AdminDash({ users, jobs, notifs, setAdminNotifs, setTab }) {
  const stats = [
    { label:"Membres",       value:users.length,                                  icon:"👥", color:C.accent,  tab:"users" },
    { label:"Techniciens",   value:users.filter(u=>u.role==="technicien").length, icon:"🔧", color:C.gold,    tab:"users" },
    { label:"Offres actives",value:jobs.filter(j=>j.status==="open").length,      icon:"💼", color:C.green,   tab:"jobs" },
    { label:"Signalements",  value:notifs.filter(n=>n.type==="report").length,    icon:"⚠️", color:C.red,     tab:"reported" },
    { label:"En ligne",      value:users.filter(u=>u.online).length,              icon:"🟢", color:"#00BCD4", tab:"users" },
    { label:"Non lus",       value:notifs.filter(n=>!n.read).length,             icon:"🔔", color:"#FF9800", tab:"notifs" },
  ];


  const navFromNotif = (n) => {
    setAdminNotifs?.(nn=>nn.map(x=>x.id===n.id?{...x,read:true}:x));
    if (n.type==="new_user")    setTab?.("users");
    else if (n.type==="new_job")setTab?.("jobs");
    else if (n.type==="report") setTab?.("reported");
    else if (n.type==="message")setTab?.("messages");
    else setTab?.("notifs");
  };

  return <>
    <p style={css.title}>Tableau de bord</p>
    <p style={{ fontSize:13, color:C.sub, marginBottom:20 }}>Vue d'ensemble — Emploi pour Tous</p>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
      {stats.map(s => (
        <div key={s.label} onClick={()=>setTab?.(s.tab)} style={{ ...css.card, marginBottom:0, borderLeft:`3px solid ${s.color}`, padding:"16px 14px", cursor:"pointer", transition:"opacity .2s" }}>
          <div style={{ fontSize:22 }}>{s.icon}</div>
          <div style={{ fontSize:28, fontWeight:800, color:s.color, fontFamily:"Georgia,serif" }}>{s.value}</div>
          <div style={{ fontSize:11, color:C.sub }}>{s.label}</div>
          <div style={{ fontSize:10, color:s.color, marginTop:4 }}>Voir →</div>
        </div>
      ))}
    </div>
    <p style={{ fontWeight:800, fontSize:15, marginBottom:12 }}>Activité récente</p>
    {notifs.slice(0,5).map(n => (
      <div key={n.id} onClick={()=>navFromNotif(n)} style={{ ...css.card, display:"flex", alignItems:"center", gap:12, padding:"12px 14px", marginBottom:8, borderLeft:`3px solid ${n.read?C.border:C.accent}`, cursor:"pointer" }}>
        <span style={{ fontSize:18 }}>{n.type==="new_user"?"👤":n.type==="new_job"?"💼":n.type==="report"?"⚠️":"💬"}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:n.read?500:700 }}>{n.msg}</div>
          <div style={{ fontSize:11, color:C.muted }}>{n.time}</div>
          <div style={{ fontSize:11, color:C.accent, marginTop:2 }}>Tap pour voir →</div>
        </div>
        {!n.read&&<div style={{ width:8, height:8, borderRadius:"50%", background:C.accent }} />}
      </div>
    ))}
  </>;
}

function AdminMembers({ users, searchQ, setSearchQ, selUser, setSelUser, onMute, onActivate, onDelete, setTab, reportedView }) {
  return <>
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
      {setTab && <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }} onClick={()=>setTab("dashboard")}>←</button>}
      <p style={{ ...css.title, marginBottom:0, flex:1 }}>{reportedView ? "⚠️ Membres signalés" : "Membres"} ({users.length})</p>
    </div>
    <input style={{ ...css.input, marginBottom:16 }} placeholder="🔍 Quel service ? Ex: Électricien, Plombier, Ménagère..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
    {users.map(u => (
      <div key={u.id} style={{ ...css.card, marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <Av initials={u.avatar||"??"} bg={getColor(u.name)} size={42} online={u.online} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>{u.name}</div>
            <div style={{ fontSize:11, color:C.sub }}>{u.role} · {u.city} · {u.joined}</div>
            <div style={{ display:"flex", gap:6, marginTop:4, flexWrap:"wrap" }}>
              <Chip label={u.status==="active"?"Actif":u.status==="muted"?"Muté":"Banni"} color={u.status==="active"?C.green:u.status==="muted"?C.gold:C.red} />
              {u.rating>0&&<Chip label={`★ ${u.rating}`} color={C.gold} />}
              <Chip label={`${u.jobs} missions`} color={C.accent} />
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
          <button style={{ ...css.btn(C.accent), flex:1, padding:"8px 0", fontSize:12 }} onClick={()=>setSelUser(selUser?.id===u.id?null:u)}>{selUser?.id===u.id?"Fermer":"Détails"}</button>
          {u.status!=="muted"
            ?<button style={{ ...css.btn(C.gold), flex:1, padding:"8px 0", fontSize:12 }} onClick={()=>onMute(u.id)}>Muter</button>
            :<button style={{ ...css.btn(C.green), flex:1, padding:"8px 0", fontSize:12 }} onClick={()=>onActivate(u.id)}>Activer</button>
          }
          <button style={{ ...css.btn(C.red), flex:1, padding:"8px 0", fontSize:12 }} onClick={()=>onDelete(u.id)}>Suppr.</button>
        </div>
        {selUser?.id===u.id&&(
          <div style={{ marginTop:12, padding:14, background:"#0a1520", borderRadius:10, fontSize:13, color:C.sub, lineHeight:2 }}>
            <div>🎓 <strong style={{ color:C.text }}>Expérience :</strong> {u.exp} ans</div>
            <div>🏆 <strong style={{ color:C.text }}>Missions :</strong> {u.jobs}</div>
            <div>⭐ <strong style={{ color:C.text }}>Note :</strong> {u.rating>0?`${u.rating}/5`:"Non noté"}</div>
            <div>📍 <strong style={{ color:C.text }}>Ville :</strong> {u.city||"—"}</div>
            <div>🔧 <strong style={{ color:C.text }}>Compétences :</strong> {u.skills?.join(", ")||"—"}</div>
          </div>
        )}
      </div>
    ))}
  </>;
}

function AdminJobsTab({ jobs, setJobs, toast$, setTab }) {
  return <>
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
      {setTab && <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }} onClick={()=>setTab("dashboard")}>←</button>}
      <p style={{ ...css.title, marginBottom:0, flex:1 }}>Offres ({jobs.length})</p>
    </div>
    {jobs.map(j => (
      <div key={j.id} style={{ ...css.card, marginBottom:10, borderLeft:`3px solid ${j.status==="open"?C.green:C.muted}` }}>
        <div style={{ fontWeight:700, fontSize:14 }}>{j.title}</div>
        <div style={{ fontSize:12, color:C.sub, marginTop:3 }}>{j.category} · {j.city} · {j.date}</div>
        <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
          <Chip label={j.status==="open"?"Ouvert":"Fermé"} color={j.status==="open"?C.green:C.muted} />
          {j.urgent&&<Chip label="🔥 Urgent" color={C.red} />}
          {j.budget&&<Chip label={j.budget} color={C.gold} />}
          <Chip label={`${j.applicants} candidats`} color={C.accent} />
        </div>
        <div style={{ display:"flex", gap:8, marginTop:10 }}>
          <button style={{ ...css.btn(j.status==="open"?C.muted:C.green), flex:1, padding:"8px 0", fontSize:12 }}
            onClick={()=>setJobs(jj=>jj.map(x=>x.id===j.id?{...x,status:x.status==="open"?"closed":"open"}:x))}>
            {j.status==="open"?"Fermer":"Rouvrir"}
          </button>
          <button style={{ ...css.btn(C.red), flex:1, padding:"8px 0", fontSize:12 }}
            onClick={()=>{ if(window.confirm("Supprimer cette offre ?")){ setJobs(jj=>jj.filter(x=>x.id!==j.id)); toast$("Offre supprimée"); } }}>
            Supprimer
          </button>
        </div>
      </div>
    ))}
  </>;
}

function NotifsTab({ notifs, setNotifs, unread, setTab, openChat, setHighlightJob, isAdmin }) {
  const icons   = { new_user:"👤", new_job:"💼", report:"⚠️", message:"💬", review:"⭐", application:"📋" };
  const navTo   = (n) => {
    setNotifs(nn=>nn.map(x=>x.id===n.id?{...x,read:true}:x));
    if (isAdmin) {
      if (n.type==="new_user")    setTab?.("users");
      else if (n.type==="new_job")setTab?.("jobs");
      else if (n.type==="report") setTab?.("reported");
      else if (n.type==="message")setTab?.("messages");
      else setTab?.("dashboard");
    } else {
      if (n.type==="message")          openChat?.(n.from||"Support EPT", true);
      else if (n.type==="new_job")     { setTab?.("jobs"); if(n.jobId) setHighlightJob?.(n.jobId); }
      else if (n.type==="new_user")    setTab?.("techniciens");
      else if (n.type==="application") setTab?.("jobs");
      else if (n.type==="review")      setTab?.("profile");
      else if (n.type==="report")      setTab?.("profile");
    }
  };
  return <>
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
      <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }} onClick={()=>setTab?.(isAdmin?"dashboard":"home")}>←</button>
      <p style={{ ...css.title, marginBottom:0, flex:1 }}>Notifications {unread>0&&<span style={{ background:C.red, color:"#fff", borderRadius:20, padding:"2px 9px", fontSize:13, marginLeft:8 }}>{unread}</span>}</p>
      {unread>0&&<button style={{ ...css.btn("#1e3a52"), padding:"7px 14px", fontSize:12, border:`1px solid ${C.border}` }} onClick={()=>setNotifs(n=>n.map(x=>({...x,read:true})))}>Tout lire</button>}
    </div>
    {notifs.map(n => (
      <div key={n.id}
        style={{ ...css.card, display:"flex", gap:12, alignItems:"center", marginBottom:8, borderLeft:`3px solid ${n.read?C.border:C.accent}`, padding:"12px 14px", cursor:"pointer", transition:"opacity .2s" }}
        onClick={()=>navTo(n)}>
        <div style={{ width:42, height:42, borderRadius:"50%", background:
          n.type==="message"?"#1E88E522":n.type==="new_job"?"#00E67622":n.type==="report"?"#EF535022":"#FFB80022",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
          {icons[n.type]||"🔔"}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:n.read?500:700, fontSize:13 }}>{n.msg}</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{n.time}</div>
          <div style={{ fontSize:11, color:C.accent, marginTop:3 }}>
            {n.type==="message"?"Tap pour ouvrir le chat →":
             n.type==="new_job"?"Tap pour voir les offres →":
             n.type==="new_user"?"Tap pour voir les techniciens →":"Tap pour ouvrir →"}
          </div>
        </div>
        {!n.read&&<div style={{ width:10, height:10, borderRadius:"50%", background:C.accent, flexShrink:0 }} />}
      </div>
    ))}
    {notifs.length===0&&<div style={{ textAlign:"center", color:C.sub, padding:"40px 0" }}>Aucune notification 🎉</div>}
  </>;
}

const DEFAULT_CONTACTS = [
  { name:"Support EPT",    online:true,  initials:"SE", color:"#C62828" },
  { name:"Mamadou Diallo", online:true,  initials:"MD", color:"#1565C0" },
  { name:"Kofi Atta",      online:false, initials:"KA", color:"#6A1B9A" },
];

function ChatTab({ msgs, setMsgs, newMsg, setNewMsg, sendMsg, chatRef, voiceOn, setVoiceOn, activeChatContact, setActiveChatContact, setTab, prevTab, currentUser, appSocketRef, chatMsgs, setChatMsgs, chatTyping, chatStatus, setChatStatus }) {
  const [activeC, setActiveC]               = useState(null);
  // Utiliser les états globaux du App root
  const localMsgs    = chatMsgs   || {};
  const setLocalMsgs = setChatMsgs;
  const typingContacts = chatTyping || {};
  const msgStatus    = chatStatus  || {};
  const [socketReady, setSocketReady]       = useState(false);
  const [selectedMsg, setSelectedMsg]       = useState(null); // menu contextuel long-press

  // Voix
  const [voiceTimer, setVoiceTimer]         = useState(0);
  const [voiceState, setVoiceState]         = useState("idle"); // idle|recording|paused|preview
  const [voiceSeconds, setVoiceSeconds]     = useState(0);
  const [voiceUrl, setVoiceUrl]             = useState(null);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const mediaRecRef   = useRef(null);
  const chunksRef     = useRef([]);
  const voiceTimerRef = useRef(null);
  const audioPreviewRef = useRef(null);

  const timerRef      = useRef(null);
  const typingTimer   = useRef(null);
  const chatBottomRef = useRef(null);

  const myName = currentUser?.name || "Moi";
  const fmtSecs = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  // ── Socket status depuis App root ──
  useEffect(() => {
    const socket = appSocketRef?.current;
    if (!socket) return;
    setSocketReady(socket.connected);
    const onConnect    = () => setSocketReady(true);
    const onDisconnect = () => setSocketReady(false);
    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [appSocketRef?.current]);

  // ── Envoi message texte ────────────────────────────────────
  const addMsg = (contactName, text) => {
    const time  = new Date().toLocaleTimeString("fr", { hour:"2-digit", minute:"2-digit" });
    const msgId = Date.now();
    const m     = { id:msgId, from:myName, text, time, isMe:true, status:"sent" };

    setLocalMsgs(prev => {
      const next = { ...prev, [contactName]: [...(prev[contactName]||[]), m] };
      try { localStorage.setItem('ept_msgs', JSON.stringify(next)); } catch{}
      return next;
    });
    setChatStatus(s => ({ ...s, [msgId]: "sent" }));

    const sock = appSocketRef?.current;
<<<<<<< HEAD
    const doSend = (s) => s.emit("message", { to: contactName, text, msgId });
=======
    // ✅ Sauvegarder dans Supabase
    const myName = (currentUser?.name || currentUser?.email)?.trim();
    fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      method: "POST",
      headers: { ...sb.headers(authToken), "Prefer": "return=minimal" },
      body: JSON.stringify({
        content: text,
        sender_name: myName,
        receiver_name: contactName?.trim(),
      })
    }).catch(e => console.error("save msg", e));

    const doSend = (s) => s.emit("message", { to: contactName?.trim(), text, msgId });
>>>>>>> parent of 07ff313 (fix: authToken guard + conflit variable myName)

    if (sock?.connected) {
      doSend(sock);
      console.log("📤 Message envoyé à", contactName);
    } else if (sock) {
      // ✅ Attendre la connexion puis envoyer
      console.warn("⏳ Socket pas encore connecté, attente...");
      sock.once("connect", () => {
        doSend(sock);
        console.log("📤 Message envoyé après reconnexion à", contactName);
      });
    } else {
      console.warn("⚠️ Pas de socket");
    }
  };

  // ── Indicateur frappe sortant ──────────────────────────────
  const onTyping = () => {
    const sock = appSocketRef?.current;
    if (!sock?.connected || !activeC) return;
    sock.emit("typing", { to: activeC.name, typing: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => sock?.emit("typing", { to: activeC.name, typing: false }), 2000);
  };

  // ── Marquer comme lu en ouvrant la conv ───────────────────
  useEffect(() => {
    if (activeC && socketReady) {
      getMsgs(activeC.name).filter(m => !m.isMe && m.id).forEach(m =>
        appSocketRef?.current?.emit("msg_status", { msgId:m.id, status:"read", to:activeC.name })
      );
    }
  }, [activeC]);

  // ── Voice recording ────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecRef.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type:"audio/webm" });
        setVoiceUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        setVoiceState("preview");
        clearInterval(voiceTimerRef.current);
      };
      mr.start(100);
      setVoiceState("recording"); setVoiceSeconds(0);
      voiceTimerRef.current = setInterval(() => setVoiceSeconds(s => s+1), 1000);
    } catch { setVoiceSupported(false); }
  };
  const pauseRecording  = () => { mediaRecRef.current?.pause();  clearInterval(voiceTimerRef.current); setVoiceState("paused"); };
  const resumeRecording = () => {
    mediaRecRef.current?.resume();
    voiceTimerRef.current = setInterval(() => setVoiceSeconds(s => s+1), 1000);
    setVoiceState("recording");
  };
  const stopRecording   = () => { clearInterval(voiceTimerRef.current); mediaRecRef.current?.stop(); };
  const cancelRecording = () => {
    clearInterval(voiceTimerRef.current);
    if (mediaRecRef.current?.state !== "inactive") {
      mediaRecRef.current.ondataavailable = null;
      mediaRecRef.current.onstop = null;
      mediaRecRef.current.stop();
    }
    setVoiceState("idle"); setVoiceSeconds(0);
    if (voiceUrl) { URL.revokeObjectURL(voiceUrl); setVoiceUrl(null); }
  };
  const sendVoiceMsg = (contactName) => {
    if (!voiceUrl) return;
    const dur   = fmtSecs(voiceSeconds);
    const msgId = Date.now();
    const time  = new Date().toLocaleTimeString("fr", { hour:"2-digit", minute:"2-digit" });
    const m     = { id:msgId, from:myName, text:"", time, isMe:true, status:"sent", isVoice:true, voiceUrl, voiceDur:dur };
    setLocalMsgs(prev => ({ ...prev, [contactName]: [...(prev[contactName]||[]), m] }));
    setMsgStatus(s => ({ ...s, [msgId]: "sent" }));
    // Note: upload audio via Socket en étape suivante
    setTimeout(() => setMsgStatus(s => ({ ...s, [msgId]: "delivered" })), 500);
    setTimeout(() => { setTypingContacts(t=>({...t,[contactName]:true})); }, 1200);
    setTimeout(() => { setTypingContacts(t=>({...t,[contactName]:false})); setMsgStatus(s=>({...s,[msgId]:"read"})); }, 3800);
    setVoiceState("idle"); setVoiceSeconds(0); setVoiceUrl(null);
  };

  // ── Appel voix (conservé pour l'étape suivante) ────────────
  const startVoice = () => { setVoiceOn(true); setVoiceTimer(0); timerRef.current = setInterval(() => setVoiceTimer(t=>t+1), 1000); };
  const endVoice   = () => { setVoiceOn(false); clearInterval(timerRef.current); setVoiceTimer(0); };
  const fmtTime    = fmtSecs;

  useEffect(() => {
    if (activeChatContact?.name) {
      const existing = DEFAULT_CONTACTS.find(c => c.name === activeChatContact.name);
      setActiveC(existing || { ...activeChatContact, initials: activeChatContact.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() });
    }
  }, [activeChatContact?.name]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [localMsgs, activeC]);

  const getMsgs = (name) => {
    const base = name === "Mamadou Diallo" ? msgs.map(m => ({ ...m, status:m.isMe?"read":undefined })) : [];
    return [...base, ...(localMsgs[name]||[])];
  };
  const markRead = (name) => {
    setLocalMsgs(prev => {
      const updated = (prev[name]||[]).map(m => ({ ...m, read: true }));
      const next = { ...prev, [name]: updated };
      try { localStorage.setItem('ept_msgs', JSON.stringify(next)); } catch{}
      return next;
    });
  };

  // ── LISTE DES CONVERSATIONS ────────────────────────────────
  const realNames = Object.keys(localMsgs).filter(n => n && !DEFAULT_CONTACTS.find(d => d.name === n));
  const allContacts = [...DEFAULT_CONTACTS, ...realNames.map(n => ({ name:n, online:true, initials:n.split(" ").map(w=>w[0]).join("").slice(0,2) }))];

  if (!activeC) return (
    <>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }}
          onClick={()=>setTab?.(prevTab&&prevTab!=="chat"?prevTab:"home")}>←</button>
        <p style={{ ...css.title, marginBottom:0, flex:1 }}>Messages 💬</p>
        {/* Indicateur connexion Socket */}
        <div title={socketReady?"Temps réel actif":"Mode hors ligne"}
          style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:socketReady?"#00E676":"#607080" }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:socketReady?"#00E676":"#607080" }} />
          {socketReady?"En direct":"Hors ligne"}
        </div>
      </div>

      {allContacts.map(c => {
        const allMsgs = getMsgs(c.name);
        const last    = allMsgs[allMsgs.length-1];
        const unread  = allMsgs.filter(m => !m.isMe && !m.read).length;
        return (
          <div key={c.name} style={{ background:"#122236", borderRadius:14, padding:14, marginBottom:10, display:"flex", alignItems:"center", gap:12, border:"1px solid #1e3a52", cursor:"pointer" }}
            onClick={()=>setActiveC(c)}>
            <div style={{ position:"relative" }}>
              <div style={{ width:50, height:50, borderRadius:"50%", background:getColor(c.name), display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16, color:"#fff" }}>
                {c.name.split(" ").map(w=>w[0]).join("").slice(0,2)}
              </div>
              <div style={{ position:"absolute", bottom:1, right:1, width:12, height:12, borderRadius:"50%", background:c.online?"#00E676":"#607080", border:"2px solid #122236" }} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:14, color:"#E8F0FE" }}>{c.name}</div>
              <div style={{ fontSize:12, color:"#90A4AE", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {last?.isVoice?"🎙 Message vocal":last?.text?.slice(0,40)||"Démarrer la conversation"}{last?.text?.length>40?"...":""}
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
              <div style={{ fontSize:11, color:"#607080" }}>{last?.time||""}</div>
              {unread>0 && <div style={{ width:18, height:18, borderRadius:"50%", background:C.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"#fff" }}>{unread}</div>}
            </div>
          </div>
        );
      })}
    </>
  );

  // ── FENÊTRE DE CHAT ────────────────────────────────────────
  useEffect(() => { if (activeC) markRead(activeC.name); }, [activeC?.name]);
  const cMsgs   = getMsgs(activeC.name);
  const bg      = getColor(activeC.name);
  const initials= activeC.initials||activeC.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 140px)" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, padding:"10px 0" }}>
        <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }}
          onClick={()=>{ setActiveC(null); setActiveChatContact?.(null); }}>←</button>
        <div style={{ width:42, height:42, borderRadius:"50%", background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:15, color:"#fff", flexShrink:0 }}>{initials}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:15, color:"#E8F0FE" }}>{activeC.name}</div>
          <div style={{ fontSize:11, color:voiceOn?"#EF5350":activeC.online?"#00E676":"#607080" }}>
            {voiceOn?"🔴 Appel en cours...":activeC.online?"En ligne":"Hors ligne"}
          </div>
        </div>
        <button style={{ background:"#1e3a52", border:"none", borderRadius:10, padding:"9px 12px", cursor:"pointer", fontSize:18 }}
          onClick={voiceOn?endVoice:startVoice}>{voiceOn?"📴":"📞"}</button>
        <button style={{ background:"#1e3a52", border:"none", borderRadius:10, padding:"9px 12px", cursor:"pointer", fontSize:18 }}>📹</button>
      </div>

      {/* Appel vocal actif */}
      {voiceOn && (
        <div style={{ background:"#0D47A1", borderRadius:14, padding:20, textAlign:"center", marginBottom:12 }}>
          <div style={{ fontSize:40 }}>📞</div>
          <div style={{ fontWeight:800, color:"#fff", fontSize:15, marginTop:8 }}>Appel avec {activeC.name.split(" ")[0]}</div>
          <div style={{ fontFamily:"monospace", fontSize:24, color:"#FFB800", marginTop:6 }}>{fmtTime(voiceTimer)}</div>
          <div style={{ display:"flex", gap:16, justifyContent:"center", marginTop:14 }}>
            {[{i:"🔇",l:"Muet"},{i:"🔊",l:"HP"},{i:"📷",l:"Caméra"}].map(b=>(
              <div key={b.l} style={{ textAlign:"center" }}>
                <button style={{ width:52, height:52, borderRadius:"50%", background:"rgba(255,255,255,.15)", border:"none", fontSize:22, cursor:"pointer" }}>{b.i}</button>
                <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", marginTop:4 }}>{b.l}</div>
              </div>
            ))}
            <div style={{ textAlign:"center" }}>
              <button style={{ width:52, height:52, borderRadius:"50%", background:"#EF5350", border:"none", fontSize:22, cursor:"pointer" }} onClick={endVoice}>📴</button>
              <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", marginTop:4 }}>Fin</div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", padding:"4px 0", marginBottom:8 }}>
        {cMsgs.length===0 && (
          <div style={{ textAlign:"center", color:"#607080", padding:"40px 0", fontSize:13 }}>
            Démarrez la conversation avec {activeC.name.split(" ")[0]} 👋
          </div>
        )}
        {cMsgs.map((m,i) => {
          const status    = m.isMe ? (msgStatus[m.id]||m.status||"sent") : null;
          const checkmark = status==="read"      ? <span style={{ color:"#1E88E5", fontSize:11, marginLeft:3 }}>✓✓</span>
                          : status==="delivered" ? <span style={{ color:"#607080", fontSize:11, marginLeft:3 }}>✓✓</span>
                          : status==="sent"      ? <span style={{ color:"#607080", fontSize:11, marginLeft:3 }}>✓</span> : null;
          return (
            <div key={m.id||i} style={{ display:"flex", justifyContent:m.isMe?"flex-end":"flex-start", gap:8, alignItems:"flex-end", marginBottom:8 }}>
              {!m.isMe && <div style={{ width:28, height:28, borderRadius:"50%", background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:10, color:"#fff", flexShrink:0 }}>{initials}</div>}
              <div style={{ background:m.isMe?"#1E88E5":"#1e3a52", borderRadius:m.isMe?"14px 14px 2px 14px":"14px 14px 14px 2px", padding:"10px 14px", maxWidth:"74%", fontSize:13, color:"#E8F0FE", lineHeight:1.5 }}>
                {m.isVoice ? (
                  <div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,.7)", marginBottom:4 }}>🎙 {m.voiceDur}</div>
                    <audio src={m.voiceUrl} controls style={{ width:"100%", height:32, borderRadius:6 }} />
                  </div>
                ) : m.text}
                <div style={{ fontSize:10, color:"rgba(255,255,255,.45)", marginTop:4, textAlign:"right", display:"flex", alignItems:"center", justifyContent:"flex-end" }}>
                  <span>{m.time}</span>{checkmark}
                </div>
              </div>
            </div>
          );
        })}
        {/* Indicateur frappe */}
        {typingContacts[activeC.name] && (
          <div style={{ display:"flex", alignItems:"flex-end", gap:8, marginBottom:8 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:10, color:"#fff", flexShrink:0 }}>{initials}</div>
            <div style={{ background:"#1e3a52", borderRadius:"14px 14px 14px 2px", padding:"10px 16px" }}>
              <span style={{ display:"inline-flex", gap:3, alignItems:"center" }}>
                {[0,.2,.4].map(d => <span key={d} style={{ width:6, height:6, borderRadius:"50%", background:"#90A4AE", display:"inline-block", animation:`typingDot 1.2s infinite ${d}s` }} />)}
              </span>
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* UI enregistrement vocal */}
      {voiceState==="recording" && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"#EF535015", borderRadius:14, border:"1px solid #EF535044", marginBottom:8 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#EF5350", animation:"pulse 1s infinite", flexShrink:0 }} />
          <span style={{ fontSize:13, color:"#EF5350", fontWeight:700, flex:1 }}>🎙 {fmtSecs(voiceSeconds)}</span>
          <button style={{ background:"#1e3a52", border:"none", borderRadius:8, padding:"6px 12px", color:"#FFB800", fontWeight:700, fontSize:13, cursor:"pointer" }} onClick={pauseRecording}>⏸</button>
          <button style={{ background:"#EF5350", border:"none", borderRadius:8, padding:"6px 12px", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }} onClick={stopRecording}>⏹</button>
          <button style={{ background:"none", border:"none", color:"#607080", fontSize:18, cursor:"pointer" }} onClick={cancelRecording}>✕</button>
        </div>
      )}
      {voiceState==="paused" && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"#FFB80015", borderRadius:14, border:"1px solid #FFB80044", marginBottom:8 }}>
          <span style={{ fontSize:18 }}>⏸</span>
          <span style={{ fontSize:13, color:"#FFB800", fontWeight:700, flex:1 }}>Pause — {fmtSecs(voiceSeconds)}</span>
          <button style={{ background:"#00E676", border:"none", borderRadius:8, padding:"6px 12px", color:"#000", fontWeight:700, fontSize:13, cursor:"pointer" }} onClick={resumeRecording}>▶</button>
          <button style={{ background:"#1E88E5", border:"none", borderRadius:8, padding:"6px 12px", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }} onClick={stopRecording}>⏹</button>
          <button style={{ background:"none", border:"none", color:"#607080", fontSize:18, cursor:"pointer" }} onClick={cancelRecording}>✕</button>
        </div>
      )}
      {voiceState==="preview" && voiceUrl && (
        <div style={{ background:"#1E88E522", borderRadius:14, border:"1px solid #1E88E544", padding:"12px 14px", marginBottom:8 }}>
          <div style={{ fontSize:11, color:"#90A4AE", marginBottom:6, fontWeight:700 }}>🎙 {fmtSecs(voiceSeconds)} — Écouter avant envoi :</div>
          <audio ref={audioPreviewRef} src={voiceUrl} controls style={{ width:"100%", height:34, marginBottom:8, borderRadius:8 }} />
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ flex:2, background:"linear-gradient(135deg,#1E88E5,#0D47A1)", border:"none", borderRadius:10, padding:"10px 0", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}
              onClick={()=>sendVoiceMsg(activeC.name)}>➤ Envoyer</button>
            <button style={{ flex:1, background:"#1e3a52", border:"none", borderRadius:10, padding:"10px 0", color:"#90A4AE", fontWeight:700, fontSize:13, cursor:"pointer" }} onClick={cancelRecording}>✕</button>
          </div>
        </div>
      )}
      {!voiceSupported && <div style={{ fontSize:12, color:C.red, padding:"6px 10px", background:"#EF535011", borderRadius:8, marginBottom:8 }}>⚠️ Micro non autorisé</div>}

      {/* Barre de saisie */}
      <div style={{ display:"flex", gap:8, padding:"10px 0", borderTop:"1px solid #1e3a52" }}>
        <button style={{ background:voiceState!=="idle"?"#EF535033":"#1e3a52", border:"none", borderRadius:10, padding:"10px 12px", cursor:"pointer", fontSize:18, color:voiceState==="recording"?"#EF5350":voiceState==="paused"?"#FFB800":"#90A4AE" }}
          onClick={voiceState==="idle"?startRecording:voiceState==="recording"?pauseRecording:voiceState==="paused"?resumeRecording:cancelRecording}>
          {voiceState==="recording"?"🔴":voiceState==="paused"?"⏸":voiceState==="preview"?"✕":"🎙"}
        </button>
        <button style={{ background:"#1e3a52", border:"none", borderRadius:10, padding:"10px 12px", cursor:"pointer", fontSize:18, color:"#90A4AE" }}>📎</button>
        <input style={{ flex:1, background:"#0a1520", border:"1px solid #1e3a52", borderRadius:20, padding:"10px 16px", color:"#E8F0FE", fontSize:14, outline:"none", fontFamily:"inherit" }}
          placeholder={`Message à ${activeC.name.split(" ")[0]}…`}
          value={newMsg} onChange={e=>{ setNewMsg(e.target.value); onTyping(); }}
          onKeyDown={e=>{ if(e.key==="Enter"&&newMsg.trim()){ addMsg(activeC.name, newMsg.trim()); setNewMsg(""); } }} />
        <button style={{ background:"linear-gradient(135deg,#1E88E5,#0D47A1)", border:"none", borderRadius:10, padding:"10px 16px", cursor:"pointer", fontSize:18, color:"#fff" }}
          onClick={()=>{ if(newMsg.trim()){ addMsg(activeC.name, newMsg.trim()); setNewMsg(""); } }}>➤</button>
      </div>
    </div>
  );
}



function TechsTab({ users, searchQ, setSearchQ, selUser, setSelUser, setTab, toast$, myRatings, setMyRatings, openChat, onlineFilter, setOnlineFilter, viewProfileUser, setViewProfileUser }) {
  // Auto-select the profile to view if passed from HomeTab
  useEffect(() => {
    if (viewProfileUser) {
      setSelUser(viewProfileUser);
      setViewProfileUser?.(null);
    }
  }, [viewProfileUser]);
  return <>
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
      <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }} onClick={()=>{ setOnlineFilter?.(false); setTab("home"); }}>←</button>
      <p style={{ ...css.title, marginBottom:0 }}>
        {onlineFilter ? "🟢 En ligne" : "Techniciens"} ({users.length})
      </p>
      {onlineFilter && (
        <button style={{ background:"#00E67622", border:"1px solid #00E67644", borderRadius:20, padding:"4px 12px", color:"#00E676", fontWeight:700, fontSize:11, cursor:"pointer" }} onClick={()=>setOnlineFilter?.(false)}>
          ✕ Filtre en ligne
        </button>
      )}
    </div>
    <input style={{ ...css.input, marginBottom:16 }} placeholder="🔍 Quel service recherchez-vous ? Électricien, plombier, ménagère..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
    {[...users].map(u=>(
      <div key={u.id} style={{ ...css.card, marginBottom:10 }}>
        <div style={{ display:"flex", gap:12 }}>
          <Av initials={u.avatar||"??"} bg={getColor(u.name)} size={54} online={u.online} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:15 }}>{u.name}</div>
            <div style={{ fontSize:12, color:C.sub }}>📍 {u.city||"—"} · {u.exp} ans d'exp.</div>
            {u.rating>0&&<div style={{ color:"#FFB800", fontSize:13, marginTop:2 }}>{"★".repeat(Math.floor(u.rating))}<span style={{ color:C.sub, fontSize:11, marginLeft:4 }}>{u.rating}/5</span></div>}
            <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
              {u.skills?.map(sk=><Chip key={sk} label={sk} color={C.accent} />)}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
          <button style={{ ...css.btn(C.accent), flex:1, padding:"8px 0", fontSize:13 }} onClick={()=>setSelUser(selUser?.id===u.id?null:u)}>{selUser?.id===u.id?"Fermer ↑":"Voir profil"}</button>
          <button style={{ ...css.btn("#00E67611"), flex:1, padding:"8px 0", fontSize:13, border:"1px solid #00E67633", color:C.green }} onClick={()=>openChat?.(u.name, u.online)}>💬 Contacter</button>
          <button style={{ ...css.btn("#6A1B9A11"), flex:1, padding:"8px 0", fontSize:13, border:"1px solid #6A1B9A33", color:"#BA68C8" }} onClick={()=>toast$("Appel en cours... 📞")}>📞 Appeler</button>
        </div>
        {selUser?.id===u.id&&(
          <div style={{ marginTop:14, padding:14, background:"#0a1520", borderRadius:10 }}>
            <div style={{ fontSize:13, lineHeight:1.9, color:C.sub }}>
              <div>🎓 <strong style={{ color:C.text }}>Expérience :</strong> {u.exp} ans</div>
              <div>🏆 <strong style={{ color:C.text }}>Missions :</strong> {u.jobs}</div>
              <div>⭐ <strong style={{ color:C.text }}>Note :</strong> {u.rating>0?`${u.rating}/5`:"Pas encore noté"}</div>
              <div>📍 <strong style={{ color:C.text }}>Localisation :</strong> {u.city||"—"}</div>
              <div>🔧 <strong style={{ color:C.text }}>Spécialités :</strong> {u.skills?.join(", ")||"—"}</div>
              <div style={{ marginTop:10, padding:"10px 12px", background:"#122236", borderRadius:8 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:4 }}>📄 Résumé professionnel</div>
                <div style={{ fontSize:12 }}>Professionnel avec {u.exp} ans d'expérience en {u.skills?.[0]||"services"}. Disponible rapidement.</div>
              </div>
            </div>
            <div style={{ marginTop:12, padding:"10px 12px", background:"#122236", borderRadius:8 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:8 }}>⭐ Donner une note</div>
              <div style={{ display:"flex", gap:6 }}>
                {[1,2,3,4,5].map(star=>(
                  <button key={star} style={{ background:"none", border:"none", cursor:"pointer", fontSize:26, color:(myRatings[u.id]||0)>=star?"#FFB800":"#2a3a4a" }}
                    onClick={()=>{ setMyRatings(r=>({...r,[u.id]:star})); toast$(`Note ${star}/5 envoyée ⭐`); }}>★</button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <button style={{ ...css.btn(C.gold), flex:1, padding:"8px 0", fontSize:12 }} onClick={()=>toast$("Téléchargement CV... 📄")}>📋 Télécharger CV</button>
              <button style={{ ...css.btn(C.red), flex:1, padding:"8px 0", fontSize:12 }} onClick={()=>toast$("Signalement envoyé à l'admin")}>🚩 Signaler</button>
            </div>
          </div>
        )}
      </div>
    ))}
    {users.length===0&&<div style={{ textAlign:"center", color:C.sub, padding:"40px 0", fontSize:14 }}>Aucun technicien trouvé 🔍</div>}
  </>;
}

function ProfileTab({ currentUser, doLogout, toast$, openChat, setTab }) {
  // ── Charger les données sauvegardées ──────────────────────────
  const getSaved = (key, fallback, isJson=true) => {
    try {
      const v = localStorage.getItem(key);
      if (!v) return fallback;
      return isJson ? JSON.parse(v) : v;
    } catch { return fallback; }
  };
  const savedProfile = getSaved("ept_profile", {});

  const [editing, setEditing]         = useState(false);
  const [form, setForm]               = useState({
    name: currentUser?.name  || savedProfile.name  || "Mon Profil",
    city: currentUser?.city  || savedProfile.city  || "Ma ville",
    bio:  currentUser?.bio   || savedProfile.bio   || "Décrivez votre expérience ici...",
    phone:currentUser?.phone || savedProfile.phone || "",
    exp:  currentUser?.exp   || savedProfile.exp   || "0",
  });
  const [cvName, setCvName]           = useState(getSaved("ept_cv_name", null, false));
  const [photoUrl, setPhotoUrl]       = useState(getSaved("ept_photo", null, false));
  const [location, setLocation]       = useState(() => { try { const l = localStorage.getItem("ept_location"); return l ? JSON.parse(l) : null; } catch { return null; } });
  const [locLoading, setLocLoading]   = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifPrefs, setNotifPrefs]   = useState(() => { try { const n = localStorage.getItem("ept_notifs"); return n ? JSON.parse(n) : { messages:true, missions:true, offres:true, alertes:true }; } catch { return { messages:true, missions:true, offres:true, alertes:true }; } });
  const [passwords, setPasswords]     = useState({ current:"", newp:"", confirm:"" });
  const [showPw, setShowPw]           = useState(false);
  const fileInputRef                  = useRef(null);
  const photoInputRef                 = useRef(null);

  // Calcul complétion profil
  const completion = Math.min(100, [
    form.name !== "Mon Profil", form.city !== "Ma ville",
    form.bio !== "Décrivez votre expérience ici...",
    !!form.phone, !!cvName, !!photoUrl, !!location, +form.exp > 0,
  ].filter(Boolean).length * 13);

  // ── UPLOAD CV ──────────────────────────────────────────────
  const handleCVUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      toast$("Seuls les fichiers PDF sont acceptés", true); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast$("Fichier trop grand (max 5 MB)", true); return;
    }
    setCvName(file.name);
    try { localStorage.setItem("ept_cv_name", file.name); } catch(e) {}
    toast$(`CV "${file.name}" uploadé avec succès ! 📄`);
  };

  // ── UPLOAD PHOTO ───────────────────────────────────────────
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast$("Sélectionnez une image (JPG, PNG...)", true); return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoUrl(ev.target.result);
      try { localStorage.setItem("ept_photo", ev.target.result); } catch(e) {}
      toast$("Photo de profil mise à jour ! 📸");
    };
    reader.readAsDataURL(file);
  };

  // ── LOCALISATION GPS ───────────────────────────────────────
  const handleLocation = () => {
    if (!navigator.geolocation) {
      toast$("Géolocalisation non supportée sur ce navigateur", true); return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const d = await r.json();
          const ville = d.address?.city || d.address?.town || d.address?.village || "Votre position";
          setLocation({ lat: latitude, lng: longitude, ville });
          setForm(f => {
            const nf = { ...f, city: ville };
            try { localStorage.setItem("ept_profile", JSON.stringify(nf)); } catch(e) {}
            return nf;
          });
          toast$(`📍 Position détectée : ${ville}`);
        } catch {
          setLocation({ lat: latitude, lng: longitude, ville: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` });
          toast$("📍 Position GPS enregistrée !");
        }
        setLocLoading(false);
      },
      (err) => {
        setLocLoading(false);
        const msgs = { 1:"Permission refusée. Autorisez la localisation.", 2:"Position introuvable.", 3:"Délai dépassé." };
        toast$(msgs[err.code] || "Erreur de localisation", true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── CHANGER MOT DE PASSE ───────────────────────────────────
  const handleChangePassword = async () => {
    if (!passwords.newp || passwords.newp.length < 6) {
      toast$("Nouveau mot de passe trop court (6 min.)", true); return;
    }
    if (passwords.newp !== passwords.confirm) {
      toast$("Les mots de passe ne correspondent pas", true); return;
    }
    const hasSupabase = typeof SUPABASE_ANON !== "undefined" && SUPABASE_ANON !== "REMPLACEZ_PAR_VOTRE_PUBLISHABLE_KEY";
    if (hasSupabase) {
      try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          method: "PUT",
          headers: { "Content-Type":"application/json", "apikey":SUPABASE_ANON },
          body: JSON.stringify({ password: passwords.newp }),
        });
        if (r.ok) { toast$("Mot de passe mis à jour ✓"); setShowPassModal(false); setPasswords({ current:"", newp:"", confirm:"" }); }
        else toast$("Erreur lors du changement", true);
      } catch { toast$("Erreur réseau", true); }
    } else {
      // Mode démo
      toast$("Mot de passe mis à jour ✓");
      setShowPassModal(false);
      setPasswords({ current:"", newp:"", confirm:"" });
    }
  };

  const initials = form.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() || "??";

  return <>
    {/* ── MODAL MOT DE PASSE ── */}
    {showPassModal && (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
        <div style={{ ...css.card, width:"100%", maxWidth:380, margin:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <span style={{ fontWeight:800, fontSize:16 }}>🔒 Changer le mot de passe</span>
            <button style={{ background:"none", border:"none", color:C.sub, fontSize:20, cursor:"pointer" }} onClick={()=>setShowPassModal(false)}>✕</button>
          </div>
          <label style={css.label}>Nouveau mot de passe *</label>
          <div style={{ position:"relative", marginBottom:12 }}>
            <input style={{ ...css.input, paddingRight:44 }} type={showPw?"text":"password"} placeholder="Minimum 6 caractères" value={passwords.newp} onChange={e=>setPasswords(p=>({...p,newp:e.target.value}))} />
            <button style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.sub, cursor:"pointer", fontSize:16 }} onClick={()=>setShowPw(v=>!v)}>{showPw?"🙈":"👁️"}</button>
          </div>
          <label style={css.label}>Confirmer le mot de passe *</label>
          <input style={{ ...css.input, marginBottom:16, borderColor: passwords.confirm && passwords.newp !== passwords.confirm ? C.red : C.border }} type="password" placeholder="Répétez le mot de passe" value={passwords.confirm} onChange={e=>setPasswords(p=>({...p,confirm:e.target.value}))} />
          {passwords.confirm && passwords.newp !== passwords.confirm && (
            <div style={{ fontSize:12, color:C.red, marginBottom:12 }}>⚠️ Les mots de passe ne correspondent pas</div>
          )}
          <div style={{ display:"flex", gap:10 }}>
            <button style={{ ...css.btn(C.green), flex:2, padding:"12px 0" }} onClick={handleChangePassword}>✓ Confirmer</button>
            <button style={{ ...css.btn("#1e3a52"), flex:1, border:`1px solid ${C.border}` }} onClick={()=>setShowPassModal(false)}>Annuler</button>
          </div>
        </div>
      </div>
    )}

    {/* ── MODAL NOTIFICATIONS ── */}
    {showNotifModal && (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
        <div style={{ ...css.card, width:"100%", maxWidth:380, margin:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <span style={{ fontWeight:800, fontSize:16 }}>🔔 Notifications</span>
            <button style={{ background:"none", border:"none", color:C.sub, fontSize:20, cursor:"pointer" }} onClick={()=>setShowNotifModal(false)}>✕</button>
          </div>
          {[
            { key:"messages", label:"💬 Nouveaux messages",    desc:"Quand quelqu'un vous envoie un message" },
            { key:"missions", label:"💼 Nouvelles missions",   desc:"Offres correspondant à vos compétences" },
            { key:"offres",   label:"📢 Offres d'emploi",      desc:"Nouvelles annonces dans votre ville" },
            { key:"alertes",  label:"⚠️ Alertes de sécurité",  desc:"Connexions et activités suspectes" },
          ].map(n => (
            <div key={n.key} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:13 }}>{n.label}</div>
                <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>{n.desc}</div>
              </div>
              <div style={{ width:44, height:24, borderRadius:12, background:notifPrefs[n.key]?C.green:"#1e3a52", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}
                onClick={()=>setNotifPrefs(p=>({...p,[n.key]:!p[n.key]}))}>
                <div style={{ position:"absolute", top:2, left:notifPrefs[n.key]?20:2, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
              </div>
            </div>
          ))}
          <button style={{ ...css.btn(C.accent), width:"100%", padding:"12px 0", marginTop:16 }} onClick={()=>{ setShowNotifModal(false); toast$("Préférences de notification sauvegardées ✓"); }}>
            ✓ Sauvegarder
          </button>
        </div>
      </div>
    )}

    {/* ── INPUTS CACHÉS ── */}
    <input ref={fileInputRef}  type="file" accept=".pdf,application/pdf" style={{ display:"none" }} onChange={handleCVUpload} />
    <input ref={photoInputRef} type="file" accept="image/*"              style={{ display:"none" }} onChange={handlePhotoUpload} />

    {/* ── AVATAR ── */}
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
      <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }} onClick={()=>setTab?.("home")}>←</button>
      <p style={{ ...css.title, marginBottom:0, flex:1 }}>Mon Profil</p>
    </div>
    <div style={{ textAlign:"center", marginBottom:20 }}>
      <div style={{ position:"relative", display:"inline-block" }}>
        {photoUrl
          ? <img src={photoUrl} alt="profil" style={{ width:84, height:84, borderRadius:"50%", objectFit:"cover", border:"3px solid #1E88E5" }} />
          : <Av initials={initials} bg="#1565C0" size={84} online />
        }
        <button style={{ position:"absolute", bottom:0, right:0, width:28, height:28, borderRadius:"50%", background:C.accent, border:"2px solid #0d1b2a", cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={()=>photoInputRef.current?.click()}>📸</button>
      </div>
      <h2 style={{ fontFamily:"Georgia,serif", fontSize:20, margin:"10px 0 2px" }}>{form.name}</h2>
      <p style={{ color:C.sub, fontSize:13, margin:0 }}>{currentUser?.email||"utilisateur@email.com"}</p>
      {location && <p style={{ color:C.green, fontSize:12, margin:"4px 0 0" }}>📍 {location.ville}</p>}
    </div>

    {/* ── BARRE COMPLÉTION ── */}
    <div style={css.card}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ fontSize:13, fontWeight:700 }}>Profil complété</span>
        <span style={{ fontSize:13, fontWeight:800, color:completion>=80?C.green:C.gold }}>{completion}%</span>
      </div>
      <div style={{ background:"#0a1520", borderRadius:99, height:10 }}>
        <div style={{ background:`linear-gradient(90deg,#1E88E5,${completion>=80?"#00E676":"#FFB800"})`, borderRadius:99, height:10, width:`${completion}%`, transition:"width .6s" }} />
      </div>
      <div style={{ fontSize:11, color:C.sub, marginTop:8 }}>
        {completion < 100 ? `Encore ${100-completion}% — ajoutez ${!cvName?"votre CV":!photoUrl?"une photo":!location?"votre GPS":"plus d'infos"}` : "✅ Profil 100% complet !"}
      </div>
    </div>

    {/* ── FORMULAIRE INFOS ── */}
    {editing ? (
      <div style={css.card}>
        <p style={{ fontWeight:800, fontSize:15, marginBottom:14, color:C.accent }}>✏️ Modifier mon profil</p>
        <label style={css.label}>Nom complet</label>
        <input style={{ ...css.input, marginBottom:10 }} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
        <label style={css.label}>Téléphone</label>
        <input style={{ ...css.input, marginBottom:10 }} type="tel" placeholder="+237 6XX XXX XXX" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} />
        <label style={css.label}>Ville</label>
        <input style={{ ...css.input, marginBottom:10 }} placeholder="Ex: Douala" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} />
        <label style={css.label}>Années d'expérience</label>
        <input style={{ ...css.input, marginBottom:10 }} type="number" min="0" value={form.exp} onChange={e=>setForm(f=>({...f,exp:e.target.value}))} />
        <label style={css.label}>Bio / Présentation</label>
        <textarea style={{ ...css.input, resize:"vertical", minHeight:90, marginBottom:14 }} value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} />
        <div style={{ display:"flex", gap:10 }}>
          <button style={{ ...css.btn(C.green), flex:2, padding:"12px 0" }} onClick={async ()=>{
            setEditing(false);
            try { localStorage.setItem("ept_profile", JSON.stringify(form)); } catch(e) {}
            // Sauvegarder dans Supabase
            if (currentUser?.id && currentUser?.token) {
              try {
                await sb.update("profiles", { id: currentUser.id }, {
                  name: form.name,
                  phone: form.phone,
                  city: form.city,
                  exp: parseInt(form.exp) || 0,
                  bio: form.bio,
                }, currentUser.token);
              } catch(e) { console.error("Erreur sauvegarde profil", e); }
            }
            toast$("Profil mis à jour ✓");
          }}>✓ Sauvegarder</button>
          <button style={{ ...css.btn("#1e3a52"), flex:1, border:`1px solid ${C.border}` }} onClick={()=>setEditing(false)}>Annuler</button>
        </div>
      </div>
    ) : (
      <div style={css.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontWeight:800, fontSize:15 }}>Informations</span>
          <button style={{ background:"none", border:"none", color:C.accent, cursor:"pointer", fontWeight:700, fontSize:13 }} onClick={()=>setEditing(true)}>✏️ Modifier</button>
        </div>
        {[
          { icon:"👤", label:"Nom",         value:form.name },
          { icon:"📞", label:"Téléphone",   value:form.phone||"Non renseigné" },
          { icon:"📍", label:"Ville",       value:form.city },
          { icon:"🎓", label:"Expérience",  value:`${form.exp} ans` },
          { icon:"📧", label:"Email",       value:currentUser?.email||"—" },
        ].map(r=>(
          <div key={r.label} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontSize:16 }}>{r.icon}</span>
            <span style={{ color:C.sub, fontSize:12, width:80 }}>{r.label}</span>
            <span style={{ color:C.text, fontSize:13, fontWeight:600, flex:1 }}>{r.value}</span>
          </div>
        ))}
        {form.bio && form.bio !== "Décrivez votre expérience ici..." && (
          <div style={{ marginTop:10, fontSize:13, color:C.sub, lineHeight:1.7 }}>📝 {form.bio}</div>
        )}
      </div>
    )}

    {/* ── CV UPLOADÉ ── */}
    {cvName && (
      <div style={{ ...css.card, border:`1px solid ${C.gold}44`, display:"flex", alignItems:"center", gap:12 }}>
        <span style={{ fontSize:28 }}>📄</span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:13, color:C.gold }}>CV uploadé ✓</div>
          <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>{cvName}</div>
        </div>
        <button style={{ ...css.btn(C.red), padding:"6px 12px", fontSize:12 }} onClick={()=>{ setCvName(null); try{localStorage.removeItem("ept_cv_name");}catch(e){} toast$("CV supprimé"); }}>✕</button>
      </div>
    )}

    {/* ── ACTIONS ── */}
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

      {/* Upload CV */}
      <div style={{ ...css.card, display:"flex", alignItems:"center", gap:12, marginBottom:0, cursor:"pointer", padding:"14px 16px", border:`1px solid ${cvName?C.gold+"44":C.border}` }}
        onClick={()=>fileInputRef.current?.click()}>
        <span style={{ fontSize:22 }}>📄</span>
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:600, fontSize:14, display:"block" }}>{cvName?"Remplacer mon CV":"Uploader mon CV (PDF)"}</span>
          {cvName
            ? <span style={{ fontSize:11, color:C.gold }}>✓ {cvName}</span>
            : <span style={{ fontSize:11, color:C.sub }}>Format PDF · Max 5 MB</span>
          }
        </div>
        <span style={{ color:cvName?C.gold:C.sub, fontSize:18 }}>{cvName?"✓":"+"}</span>
      </div>

      {/* Photo profil */}
      <div style={{ ...css.card, display:"flex", alignItems:"center", gap:12, marginBottom:0, cursor:"pointer", padding:"14px 16px", border:`1px solid ${photoUrl?C.green+"44":C.border}` }}
        onClick={()=>photoInputRef.current?.click()}>
        <span style={{ fontSize:22 }}>📸</span>
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:600, fontSize:14, display:"block" }}>{photoUrl?"Changer la photo":"Ajouter une photo de profil"}</span>
          <span style={{ fontSize:11, color:C.sub }}>JPG, PNG · Apparaît sur votre profil</span>
        </div>
        <span style={{ color:photoUrl?C.green:C.sub, fontSize:18 }}>{photoUrl?"✓":"+"}</span>
      </div>

      {/* Mot de passe */}
      <div style={{ ...css.card, display:"flex", alignItems:"center", gap:12, marginBottom:0, cursor:"pointer", padding:"14px 16px" }}
        onClick={()=>setShowPassModal(true)}>
        <span style={{ fontSize:22 }}>🔒</span>
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:600, fontSize:14, display:"block" }}>Changer le mot de passe</span>
          <span style={{ fontSize:11, color:C.sub }}>Sécurisez votre compte</span>
        </div>
        <span style={{ color:C.sub }}>›</span>
      </div>

      {/* Notifications */}
      <div style={{ ...css.card, display:"flex", alignItems:"center", gap:12, marginBottom:0, cursor:"pointer", padding:"14px 16px" }}
        onClick={()=>setShowNotifModal(true)}>
        <span style={{ fontSize:22 }}>🔔</span>
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:600, fontSize:14, display:"block" }}>Préférences de notification</span>
          <span style={{ fontSize:11, color:C.sub }}>
            {Object.values(notifPrefs).filter(Boolean).length}/4 activées
          </span>
        </div>
        <span style={{ color:C.sub }}>›</span>
      </div>

      {/* GPS */}
      <div style={{ ...css.card, display:"flex", alignItems:"center", gap:12, marginBottom:0, cursor:"pointer", padding:"14px 16px", border:`1px solid ${location?C.green+"44":C.border}` }}
        onClick={handleLocation}>
        <span style={{ fontSize:22 }}>{locLoading?"⏳":"📍"}</span>
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:600, fontSize:14, display:"block" }}>{locLoading?"Détection en cours...":"Ma localisation GPS"}</span>
          <span style={{ fontSize:11, color:location?C.green:C.sub }}>
            {location ? `✓ ${location.ville}` : "Cliquez pour détecter votre position"}
          </span>
        </div>
        <span style={{ color:location?C.green:C.sub, fontSize:18 }}>{location?"✓":"›"}</span>
      </div>

      {/* Support */}
      <div style={{ ...css.card, display:"flex", alignItems:"center", gap:12, marginBottom:0, cursor:"pointer", padding:"14px 16px", border:"1px solid #1E88E544" }}
        onClick={()=>openChat?.("Support EPT", true)}>
        <span style={{ fontSize:22 }}>🆘</span>
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:600, fontSize:14, display:"block" }}>Support / Aide</span>
          <span style={{ fontSize:11, color:C.sub }}>Contacter l'équipe Emploi pour Tous</span>
        </div>
        <span style={{ color:C.accent }}>💬</span>
      </div>

      <button style={{ ...css.btn(C.red), width:"100%", padding:"13px 0", fontSize:15, marginTop:4 }} onClick={doLogout}>
        🚪 Se déconnecter
      </button>
    </div>
  </>;
}

// ── FONTS ─────────────────────────────────────────────────────
function Fonts() {
  return (
    <link
      href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap"
      rel="stylesheet"
    />
  );
}

// ── CSS GLOBAL SCROLL ─────────────────────────────────────────
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      background: #0d1b2a;
      height: 100%;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      scroll-behavior: smooth;
    }
    #root { min-height: 100vh; overflow-y: auto; }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: #0a1520; }
    ::-webkit-scrollbar-thumb { background: #1e3a52; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #1E88E5; }
    button { -webkit-tap-highlight-color: transparent; cursor: pointer; }
    input, textarea, select { -webkit-appearance: none; }
    @keyframes typingDot {
      0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-4px); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `;
  document.head.appendChild(style);
}
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

// ══════════════════════════════════════════════════════════════
//  ⚠️  CONFIG SUPABASE — 2 endroits à modifier
//  1. SUPABASE_URL  → Settings > API > Project URL
//  2. SUPABASE_ANON → Settings > API Keys > Publishable key
// ══════════════════════════════════════════════════════════════

// mes clé
const SERVER_URL    = "https://server-ept-production.up.railway.app/";
const SUPABASE_URL  = "https://jyhrsjpotdtzqmlkstlh.supabase.co";
const SUPABASE_ANON = "sb_publishable_euGDreRpPT-ykZjeEiCiMQ_fkbVAais";

// ══════════════════════════════════════════════════════════════
//  CLIENT SUPABASE LÉGER (sans npm — appels fetch directs)
//  Toutes les fonctions d'auth et de DB passent par ici
// ══════════════════════════════════════════════════════════════
const sb = {
  // Headers communs
  headers: (token) => ({
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON,
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  }),

  // ── AUTH ──────────────────────────────────────────────────
  // Inscription
  async signUp(email, password, meta) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST", headers: sb.headers(),
      body: JSON.stringify({ email, password, data: meta }),
    });
    return r.json();
  },

  // Connexion
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: sb.headers(),
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },

  // Déconnexion
  async signOut(token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST", headers: sb.headers(token),
    });
  },

  // Récupérer session depuis localStorage
  getSession() {
    try {
      const raw = localStorage.getItem("ept_session");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  // Sauvegarder session
  saveSession(session) {
    try { localStorage.setItem("ept_session", JSON.stringify(session)); } catch {}
  },

  // Effacer session
  clearSession() {
    try { localStorage.removeItem("ept_session"); } catch {}
  },

  // Rafraîchir le token
  async refreshToken(refresh_token) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: sb.headers(),
      body: JSON.stringify({ refresh_token }),
    });
    return r.json();
  },

  // ── DATABASE ──────────────────────────────────────────────
  // Lire des lignes : sb.select("profiles", "id,name,role", token)
  async select(table, columns = "*", token, filter = "") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}${filter}`, {
      headers: sb.headers(token),
    });
    return r.json();
  },

  // Insérer une ligne
  async insert(table, data, token) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...sb.headers(token), "Prefer": "return=representation" },
      body: JSON.stringify(data),
    });
    return r.json();
  },

  // Mettre à jour
  async update(table, match, data, token) {
    const filter = Object.entries(match).map(([k,v])=>`${k}=eq.${v}`).join("&");
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
      method: "PATCH",
      headers: { ...sb.headers(token), "Prefer": "return=representation" },
      body: JSON.stringify(data),
    });
    return r.json();
  },

  // Supprimer
  async delete(table, match, token) {
    const filter = Object.entries(match).map(([k,v])=>`${k}=eq.${v}`).join("&");
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
      method: "DELETE", headers: sb.headers(token),
    });
  },
};

// Compte admin (vérification locale, jamais envoyé à Supabase)
const ADMIN_EMAIL = "admin@emploipourtous.com";
const ADMIN_PASS  = "Admin@2025!";

// ══════════════════════════════════════════════════════════════
//  DONNÉES DE DÉMONSTRATION
// ══════════════════════════════════════════════════════════════
const mockUsers = [
  { id:1, name:"Mamadou Diallo",  role:"technicien", avatar:"MD", city:"Dakar",   rating:4.8, exp:7,  skills:["Plomberie","Électricité"], status:"active", joined:"2025-01-10", jobs:34, online:true },
  { id:2, name:"Fatou Ndiaye",    role:"technicien", avatar:"FN", city:"Abidjan", rating:4.5, exp:3,  skills:["Peinture","Carrelage"],    status:"active", joined:"2025-02-15", jobs:18, online:false },
  { id:3, name:"Kofi Atta",       role:"technicien", avatar:"KA", city:"Accra",   rating:4.9, exp:12, skills:["Menuiserie","Soudure"],    status:"active", joined:"2024-11-01", jobs:87, online:true },
  { id:4, name:"Aminata Touré",   role:"client",     avatar:"AT", city:"Conakry", rating:4.2, exp:0,  skills:[],                          status:"active", joined:"2025-03-05", jobs:0,  online:true },
  { id:5, name:"Ibrahima Sow",    role:"technicien", avatar:"IS", city:"Bamako",  rating:3.9, exp:5,  skills:["Climatisation"],           status:"muted",  joined:"2025-01-22", jobs:21, online:false },
  { id:6, name:"Aïcha Coulibaly", role:"client",     avatar:"AC", city:"Lomé",    rating:4.6, exp:0,  skills:[],                          status:"active", joined:"2025-04-01", jobs:0,  online:true },
];
const mockJobs = [
  { id:1, title:"Réparation fuite d'eau urgente",   category:"Plomberie",    city:"Dakar",   budget:"15 000 FCFA",  urgent:true,  postedBy:"Aminata Touré",   date:"2025-04-29", status:"open",   applicants:3 },
  { id:2, title:"Installation panneau solaire 5kW", category:"Électricité",  city:"Abidjan", budget:"450 000 FCFA", urgent:false, postedBy:"Aïcha Coulibaly", date:"2025-04-28", status:"open",   applicants:7 },
  { id:3, title:"Peinture appartement F4",          category:"Peinture",     city:"Accra",   budget:"80 000 FCFA",  urgent:false, postedBy:"Aminata Touré",   date:"2025-04-27", status:"closed", applicants:12 },
  { id:4, title:"Climatisation bureau 3 pièces",    category:"Climatisation",city:"Bamako",  budget:"120 000 FCFA", urgent:true,  postedBy:"Aïcha Coulibaly", date:"2025-04-29", status:"open",   applicants:2 },
  { id:5, title:"Carrelage cuisine + bain",         category:"Carrelage",    city:"Lomé",    budget:"95 000 FCFA",  urgent:false, postedBy:"Aminata Touré",   date:"2025-04-26", status:"open",   applicants:5 },
];
// Notifs admin (new_user, report = admin seulement)
const mockAdminNotifs = [
  { id:1, type:"new_user",    msg:"Nouveau membre : Aïcha Coulibaly",      time:"Il y a 2h", read:false },
  { id:2, type:"new_job",     msg:"Nouvelle offre : Installation solaire", time:"Il y a 3h", read:false },
  { id:3, type:"report",      msg:"Signalement sur Ibrahima Sow",          time:"Il y a 5h", read:false },
  { id:4, type:"new_user",    msg:"Nouveau membre : Kofi Atta",            time:"Il y a 1j", read:true  },
];
// Notifs utilisateur (messages, offres, candidatures — PAS new_user ni report)
const mockNotifs = [
  { id:2, type:"new_job",     msg:"Nouvelle offre : Installation solaire", time:"Il y a 3h", read:false },
  { id:5, type:"message",     msg:"Nouveau message de Mamadou Diallo",     time:"Il y a 1j", read:true, from:"Mamadou Diallo" },
  { id:6, type:"application", msg:"Candidature reçue pour votre offre",   time:"Il y a 2j", read:true  },
];
const mockMessages = [
  { id:1, from:"Mamadou Diallo", text:"Bonjour ! J'ai un problème avec mon profil.", time:"10:30", isMe:false },
  { id:2, from:"Moi",            text:"Bonjour, quel est le problème exactement ?",  time:"10:32", isMe:true  },
  { id:3, from:"Mamadou Diallo", text:"Je n'arrive pas à uploader mon CV.",           time:"10:33", isMe:false },
];
const CATEGORIES = [
  "Plomberie","Électricité","Peinture","Menuiserie","Carrelage",
  "Climatisation","Soudure","Jardinage","Nettoyage","Sécurité",
  "Informatique","Électroménager","Ménagère","Repassage","Cuisine",
  "Garde d'enfants","Aide aux personnes âgées","Maçonnerie","Couture",
  "Coiffure","Mécanique","Déménagement","Livraison","Autre (préciser)",
];

// ══════════════════════════════════════════════════════════════
//  DESIGN SYSTEM
// ══════════════════════════════════════════════════════════════
const C = { bg:"#0d1b2a", card:"#122236", accent:"#1E88E5", gold:"#FFB800", red:"#EF5350", green:"#00E676", muted:"#607080", border:"#1e3a52", text:"#E8F0FE", sub:"#90A4AE" };
const AVATAR_COLORS = ["#1565C0","#6A1B9A","#00796B","#C62828","#F57F17","#2E7D32","#0277BD","#AD1457"];
const getColor = (name="A") => AVATAR_COLORS[(name?.charCodeAt(0)||65) % AVATAR_COLORS.length];

const css = {
  app:   { fontFamily:"'DM Sans',sans-serif", background:C.bg, minHeight:"100vh", height:"100vh", overflowY:"auto", WebkitOverflowScrolling:"touch", color:C.text },
  card:  { background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:20, marginBottom:14 },
  input: { background:"#0a1520", border:`1px solid ${C.border}`, borderRadius:10, padding:"11px 14px", color:C.text, fontSize:14, width:"100%", outline:"none", fontFamily:"inherit", boxSizing:"border-box" },
  label: { fontSize:12, color:C.sub, fontWeight:600, marginBottom:5, display:"block" },
  page:  { padding:"20px 20px 120px", maxWidth:520, margin:"0 auto", overflowX:"hidden" },
  title: { fontSize:22, fontWeight:800, fontFamily:"Georgia,serif", marginBottom:4, color:C.text },
  btn:   (bg=C.accent, extra={}) => ({ background:bg, color:"#fff", border:"none", borderRadius:10, padding:"10px 20px", cursor:"pointer", fontWeight:700, fontSize:14, fontFamily:"inherit", ...extra }),
  nav:   { display:"flex", alignItems:"center", gap:8, padding:"0 20px", height:60, background:"#091623", borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, zIndex:100 },
  bottomNav: { display:"flex", position:"fixed", bottom:0, left:0, right:0, background:"#091623", borderTop:`1px solid ${C.border}`, zIndex:999, paddingBottom:"env(safe-area-inset-bottom,0px)" },
};

// ── Mini-composants ────────────────────────────────────────────
const Chip = ({ label, color }) => (
  <span style={{ background:color+"22", color, border:`1px solid ${color}44`, borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700 }}>{label}</span>
);
const Av = ({ initials="?", size=44, bg="#1565C0", online }) => (
  <div style={{ position:"relative", display:"inline-flex", flexShrink:0 }}>
    <div style={{ width:size, height:size, borderRadius:"50%", background:bg, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:size*.34, fontFamily:"Georgia,serif", border:"2px solid rgba(255,255,255,.12)" }}>{initials}</div>
    {online!=null && <div style={{ position:"absolute", bottom:1, right:1, width:10, height:10, borderRadius:"50%", background:online?"#00E676":"#607080", border:`2px solid ${C.bg}` }} />}
  </div>
);
const Toast = ({ t }) => (
  <div style={{ position:"fixed", top:70, left:"50%", transform:"translateX(-50%)", background:t.err?"#C62828":"#2E7D32", color:"#fff", padding:"12px 26px", borderRadius:12, fontWeight:700, fontSize:14, zIndex:9999, boxShadow:"0 8px 32px rgba(0,0,0,.5)", whiteSpace:"nowrap", pointerEvents:"none" }}>
    {t.err?"✕ ":"✓ "}{t.msg}
  </div>
);
const Logo = ({ size=44 }) => (
  <div style={{ width:size, height:size, borderRadius:size*.24, background:"linear-gradient(135deg,#1E88E5,#0D47A1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 4px 14px #1E88E555" }}>
    <span style={{ fontSize:size*.46, fontWeight:900, color:"#fff", fontFamily:"Georgia,serif", lineHeight:1 }}>E</span>
  </div>
);
const BtnPrimary = ({ label, onClick, loading, style={} }) => (
  <button style={{ ...css.btn("linear-gradient(135deg,#1E88E5,#0D47A1)"), width:"100%", padding:"13px 0", fontSize:15, opacity:loading?.5:1, ...style }} onClick={onClick} disabled={loading}>
    {loading ? "⏳ Chargement..." : label}
  </button>
);

// ══════════════════════════════════════════════════════════════
//  APP ROOT
// ══════════════════════════════════════════════════════════════
export default function App() {
  // Auth state
  const [screen, setScreen]     = useState("loading"); // loading | login | admin | user
  const [authMode, setAuthMode] = useState("login");
  const [regStep, setRegStep]   = useState(1);
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken]     = useState(null); // JWT Supabase

  // UI state
  const [activeChatContact, setActiveChatContact] = useState(null);
  const socketRef = useRef(null);
  const [tab, _setTab]        = useState("home");
  const [prevTab, setPrevTab_unused] = useState("home");
  const setTab = (newTab) => { setPrevTab_unused(tab); _setTab(newTab); };
  const [searchQ, setSearchQ] = useState("");
  const [selUser, setSelUser] = useState(null);
  const [showJob, setShowJob] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [newMsg, setNewMsg]     = useState("");
  const [myRatings, setMyRatings] = useState({});

  const [highlightJob, setHighlightJob] = useState(null);
  const [onlineFilter, setOnlineFilter] = useState(false);
  const [viewProfileUser, setViewProfileUser] = useState(null);
  const chatRef = useRef(null);

  // Data
  const [users, setUsers]   = useState(mockUsers);
  const [jobs, setJobs]     = useState(mockJobs);
  const [notifs, setNotifs] = useState(mockNotifs);         // notifs utilisateur
  const [adminNotifs, setAdminNotifs] = useState(mockAdminNotifs); // notifs admin seulement
  const [msgs, setMsgs]     = useState(mockMessages);
  const [jobForm, setJobForm] = useState({ title:"", category:"", city:"", budget:"", urgent:false });

  // Form fields
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [showPw, setShowPw] = useState(false);
  const [rName, setRName]   = useState("");
  const [rEmail, setREmail] = useState("");
  const [rPass, setRPass]   = useState("");
  const [rRole, setRRole]   = useState("technicien");
  const [rCity, setRCity]   = useState("");
  const [rExp, setRExp]     = useState("0");
  const [rSkills, setRSkills] = useState([]);

  const unread      = notifs.filter(n => !n.read).length;
  const adminUnread = screen==="admin" ? (adminNotifs||[]).filter(n=>!n.read).length : 0;

  const toast$ = (msg, err=false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── RESTAURATION DE SESSION AU DÉMARRAGE ─────────────────────
  useEffect(() => {
    const restore = async () => {
      const session = sb.getSession();
      if (!session?.access_token) { setScreen("login"); return; }



      // Vérifier si le token est encore valide
      try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: sb.headers(session.access_token),
        });

        if (r.ok) {
          // Token valide — restaurer l'utilisateur
          const user = await r.json();
          const profile = await sb.select("profiles", "*", session.access_token, `&id=eq.${user.id}`);
          const p = Array.isArray(profile) ? profile[0] : null;
          setCurrentUser({ ...user, ...(p || {}), token: session.access_token });
          setAuthToken(session.access_token);
          
          if (user.email === ADMIN_EMAIL) { setScreen("admin"); setTab("dashboard"); }
          else { 
            await loadUsers(session.access_token);
            await loadJobs(session.access_token);
            setScreen("user"); setTab("home"); 
          }

        } else if (session.refresh_token) {
          // Token expiré → rafraîchir
          const refreshed = await sb.refreshToken(session.refresh_token);
          if (refreshed.access_token) {
            sb.saveSession(refreshed);
            setAuthToken(refreshed.access_token);
            setCurrentUser({ ...refreshed.user, token: refreshed.access_token });
            setScreen("user"); setTab("home");
          } else {
            sb.clearSession(); setScreen("login");
          }
        } else {
          sb.clearSession(); setScreen("login");
        }
      } catch {
        // Pas de réseau — connexion offline avec session locale
        setCurrentUser({ email: session.user_email || "utilisateur", name: session.user_name || "Utilisateur" });
        setScreen("user"); setTab("home");
      }
    };
    restore();
  }, []);
  // ─── CHARGER DONNÉES SUPABASE ─────────────────────────────────
  const loadUsers = async (token) => {
    try {
      const data = await sb.select("profiles", "*", token);
      if (Array.isArray(data) && data.length > 0) {
        setUsers(data.map(u => ({
          ...u,
          avatar: u.name?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() || "?",
          online: u.online || false,
          jobs: u.jobs_done || 0,
        })));
      }
    } catch(e) { console.error("loadUsers error", e); }
  };

  const loadJobs = async (token) => {
    try {
      const data = await sb.select("jobs", "*", token);
      if (Array.isArray(data) && data.length > 0) setJobs(data);
    } catch(e) { console.error("loadJobs error", e); }
  };

  // ─── SOCKET.IO — CONNEXION TEMPS RÉEL ─────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      auth: {
        userId: currentUser.id,
        name: currentUser.name || currentUser.email
      }
    });
    socketRef.current = socket;
    socket.on("connect", () => console.log("🟢 Socket connecté à Railway"));
    socket.on("user_online", ({ name, online }) => {
      setUsers(u => u.map(x => x.name === name ? { ...x, online } : x));
    });
    socket.on("notification", (notif) => {
      setNotifs(n => [{ ...notif, id: Date.now(), read: false }, ...n]);
    });
    return () => socket.disconnect();
  }, [currentUser]);

  // ─── OPEN PROFILE ─────────────────────────────────────────────
  const openProfile = (userName) => {
    const u = users.find(x => x.name === userName);
    if (u) {
      setViewProfileUser(u); // will show as modal overlay
    } else {
      setTab("techniciens");
    }
  };

  // ─── LOGIN ────────────────────────────────────────────────────
  const doLogin = async () => {
    if (!email || !pass) { toast$("Remplissez tous les champs", true); return; }

    // Admin local
    if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && pass === ADMIN_PASS) {
      setScreen("admin"); setTab("dashboard"); toast$("Bienvenue Admin 👑"); return;
    }

    setLoading(true);
    try {
      const d = await sb.signIn(email.trim(), pass);

      if (d.error || !d.access_token) {
        toast$(d.error_description || "Email ou mot de passe incorrect", true);
        setLoading(false); return;
      }

      // Sauvegarder la session (persist au rechargement)
      sb.saveSession({ ...d, user_email: email.trim() });
      setAuthToken(d.access_token);

      // Charger le profil depuis la table "profiles"
      const profiles = await sb.select("profiles", "*", d.access_token, `&id=eq.${d.user.id}`);
      const profile  = Array.isArray(profiles) ? profiles[0] : null;

      const user = {
        ...d.user,
        ...(profile || {}),
        name:  profile?.name  || d.user.user_metadata?.full_name || email.split("@")[0],
        role:  profile?.role  || d.user.user_metadata?.role || "client",
        city:  profile?.city  || d.user.user_metadata?.city || "",
        token: d.access_token,
      };

      setCurrentUser(user);
      await loadUsers(d.access_token);
      await loadJobs(d.access_token);
      setScreen("user"); setTab("home");
      toast$(`Bienvenue ${user.name} ! 🎉`);
      
    } catch {
      toast$("Erreur réseau. Vérifiez votre connexion.", true);
    }
    setLoading(false);
  };

  // ─── REGISTER ────────────────────────────────────────────────
  const doRegister = async () => {
    if (regStep === 1) {
      if (!rName || !rEmail || !rPass) { toast$("Remplissez les champs obligatoires", true); return; }
      if (rPass.length < 6) { toast$("Mot de passe : 6 caractères minimum", true); return; }
      setRegStep(2); return;
    }

    setLoading(true);
    try {
      // 1. Créer le compte Auth Supabase
      const d = await sb.signUp(rEmail.trim(), rPass, {
        full_name: rName, role: rRole, city: rCity,
      });

      if (d.error || (!d.user && !d.id)) {
        toast$(d.error_description || d.msg || "Erreur lors de l'inscription", true);
        setLoading(false); return;
      }

      const userId = d.user?.id || d.id;

      // 2. Créer le profil dans la table "profiles"
      //    (la table doit exister — voir SQL ci-dessous)
      const profileData = {
        id:       userId,
        name:     rName,
        role:     rRole,
        city:     rCity,
        exp:      parseInt(rExp) || 0,
        skills:   rSkills || [],
        email:    rEmail.trim(),
        rating:   0,
        jobs_done:0,
        status:   "active",
        online:   true,
        joined:   new Date().toISOString().slice(0,10),
      };

      // Utiliser le token si dispo (auto-confirm activé), sinon le token anon
      const token = d.access_token || SUPABASE_ANON;
      await sb.insert("profiles", profileData, token);

      if (d.access_token) {
        // Auto-confirm activé → connexion directe
        sb.saveSession({ ...d, user_email: rEmail.trim(), user_name: rName });
        setAuthToken(d.access_token);
        setCurrentUser({ ...profileData, ...d.user, token: d.access_token });
        setUsers(u => [{ ...profileData, id: userId, avatar: rName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(), online:true }, ...u]);
        setScreen("user"); setTab("home");
        toast$("Compte créé ! Bienvenue 🎉");
      } else {
        // Email de confirmation envoyé
        toast$("✅ Compte créé ! Vérifiez votre email pour confirmer votre compte.", false);
        setAuthMode("login"); setRegStep(1);
      }

    } catch {
      toast$("Erreur réseau. Réessayez.", true);
    }
    setLoading(false);
  };

  const doLogout = async () => {
    if (authToken) {
      try { await sb.signOut(authToken); } catch {}
    }
    sb.clearSession();
    setScreen("login"); setCurrentUser(null); setAuthToken(null);
    setEmail(""); setPass(""); setRegStep(1); setAuthMode("login");
    toast$("Déconnecté");
  };

   const sendMsg = (text = null) => {
  const txt = text || newMsg.trim();
  if (!txt) return;
  
  const msg = {
    to: activeChatContact?.name,
    text: txt,
    msgId: Date.now()
  };
  
  socketRef.current?.emit("message", msg);
  setMsgs(m => [...m, { 
    id: Date.now(), 
    from: "Moi", 
    text: txt, 
    time: new Date().toLocaleTimeString("fr", {hour:"2-digit", minute:"2-digit"}), 
    isMe: true 
  }]);
  if (!text) setNewMsg("");
  setTimeout(() => chatRef.current?.scrollTo(0, 9999), 80);
};

  const openChat = (contactName, online=true) => {
    setActiveChatContact({ name:contactName, initials:contactName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(), online });
    setTab("chat");
  };

  const handlePostuler = (job) => {
    // Récupérer infos candidat
    let myName = "Moi", hasCv = false;
    try {
      const p = JSON.parse(localStorage.getItem("ept_profile") || "{}");
      myName = p.name || currentUser?.email || "Moi";
      hasCv  = !!localStorage.getItem("ept_cv_name");
    } catch(e){}

    // Déterminer salutation
    const now  = new Date().getHours();
    const sal  = now >= 6 && now < 18 ? "Bonjour" : "Bonsoir";
    const titre = job.title;
    const dest  = job.postedBy || "Madame/Monsieur";

    let msgText = hasCv
      ? `${sal} Mr/Mme ${dest}, je suis intéressé(e) par votre offre "${titre}", à cet effet j'y joins ci-après mon CV. Dans l'attente d'une suite favorable, je vous remercie Mr/Mme.`
      : `${sal} Mr/Mme ${dest}, je suis intéressé(e) par votre offre "${titre}". Dans l'attente d'une suite favorable, je vous passe mes sincères remerciements.`;

    if (hasCv) {
      const cvName = localStorage.getItem("ept_cv_name") || "mon_cv.pdf";
      msgText += ` [📄 CV joint : ${cvName}]`;
    }

    // Mettre à jour le nb de candidats
    setJobs(jj => jj.map(j => j.id===job.id ? { ...j, applicants:(j.applicants||0)+1 } : j));
    // Ouvrir le chat avec le propriétaire et envoyer le message
    sendMsg(msgText);
    openChat(dest, true);
    toast$("Candidature envoyée et message transmis ! ✓");
  };

  const postJob = async () => {
    if (!jobForm.title || !jobForm.category) { toast$("Titre et catégorie requis", true); return; }
    const authorName  = currentUser?.name || currentUser?.email || "Moi";
    const authorPhoto = currentUser?.photo_url || null;
    const newJob = {
      ...jobForm,
      posted_by: authorName,
      posted_by_photo: authorPhoto,
      date: new Date().toISOString().slice(0,10),
      status: "open",
      applicants: 0,
    };
    // Sauvegarder dans Supabase
    try {
      const saved = await sb.insert("jobs", newJob, authToken);
      const job = Array.isArray(saved) ? saved[0] : { ...newJob, id: Date.now(), postedBy: authorName };
      setJobs(j => [{ ...job, postedBy: job.posted_by || authorName }, ...j]);
    } catch(e) {
      // Fallback local si erreur
      setJobs(j => [{ id:Date.now(), ...newJob, postedBy: authorName }, ...j]);
    }
    setJobForm({ title:"",category:"",city:"",budget:"",urgent:false });
    setShowJob(false); toast$("Offre publiée ! ✅");
  };

  const filteredUsers = (list) => list.filter(u =>
    u.name?.toLowerCase().includes(searchQ.toLowerCase()) ||
    u.city?.toLowerCase().includes(searchQ.toLowerCase()) ||
    u.skills?.some(s => s.toLowerCase().includes(searchQ.toLowerCase())) ||
    u.role?.toLowerCase().includes(searchQ.toLowerCase())
  );

  // ══════════════════════════════════════════════════════════════
  //  ÉCRAN LOGIN / REGISTER
  // ══════════════════════════════════════════════════════════════
  if (screen === "loading") return (
    <div style={{ ...css.app, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20 }}>
      <div style={{ fontSize:48 }}>🏗️</div>
      <div style={{ fontWeight:800, fontSize:20, color:C.text, fontFamily:"Georgia,serif" }}>Emploi pour Tous</div>
      <div style={{ fontSize:13, color:C.sub }}>Connexion en cours…</div>
      <div style={{ width:40, height:4, borderRadius:4, background:C.border, overflow:"hidden", marginTop:8 }}>
        <div style={{ width:"60%", height:"100%", background:C.accent, borderRadius:4, animation:"typingDot 1s infinite" }} />
      </div>
    </div>
  );

  if (screen === "login") return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:C.bg, minHeight:"100vh", color:C.text, overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
      <Fonts />
      {toast && <Toast t={toast} />}
      <div style={{ position:"fixed", inset:0, background:"radial-gradient(ellipse at 20% 20%,#1E88E522,transparent 60%),radial-gradient(ellipse at 80% 80%,#FFB80011,transparent 60%)", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", padding:"32px 24px 80px", minHeight:"100vh" }}>
        <Logo size={64} />
        <h1 style={{ fontFamily:"Georgia,serif", fontSize:24, fontWeight:800, margin:"12px 0 4px", textAlign:"center" }}>Emploi pour Tous</h1>
        <p style={{ color:C.sub, fontSize:13, marginBottom:24, textAlign:"center" }}>La plateforme de services à domicile en Afrique 🌍</p>

        <div style={{ ...css.card, width:"100%", maxWidth:480 }}>
          {/* Onglets */}
          <div style={{ display:"flex", background:"#0a1520", borderRadius:10, padding:4, marginBottom:20 }}>
            {["login","register"].map(m => (
              <button key={m} style={{ flex:1, padding:"9px 0", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit", background:authMode===m?C.accent:"transparent", color:authMode===m?"#fff":C.sub, transition:"all .2s" }}
                onClick={()=>{ setAuthMode(m); setRegStep(1); }}>
                {m==="login"?"🔑 Se connecter":"✨ S'inscrire"}
              </button>
            ))}
          </div>

          {authMode === "login" && <>
            <label style={css.label}>Adresse email</label>
            <input style={{ ...css.input, marginBottom:14 }} type="email" placeholder="votre@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} />
            <label style={css.label}>Mot de passe</label>
            <div style={{ position:"relative", marginBottom:20 }}>
              <input style={{ ...css.input, paddingRight:44 }} type={showPw?"text":"password"} placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} />
              <button style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.sub, cursor:"pointer", fontSize:18 }} onClick={()=>setShowPw(p=>!p)}>{showPw?"🙈":"👁️"}</button>
            </div>
            <BtnPrimary label="Se connecter →" onClick={doLogin} loading={loading} />
            <div style={{ marginTop:16, padding:"10px 14px", background:"#1565C011", borderRadius:8, border:"1px solid #1565C033", fontSize:12, color:C.sub }}>
              <strong style={{ color:C.gold }}>👑 Admin :</strong> admin@emploipourtous.com / Admin@2025!
            </div>
          </>}

          {authMode === "register" && <>
            {regStep === 1 && <>
              <div style={{ fontSize:11, color:C.accent, fontWeight:700, marginBottom:14, textTransform:"uppercase", letterSpacing:1 }}>Étape 1 / 2 — Informations</div>
              <label style={css.label}>Nom complet *</label>
              <input style={{ ...css.input, marginBottom:12 }} placeholder="Prénom Nom" value={rName} onChange={e=>setRName(e.target.value)} />
              <label style={css.label}>Email *</label>
              <input style={{ ...css.input, marginBottom:12 }} type="email" placeholder="email@exemple.com" value={rEmail} onChange={e=>setREmail(e.target.value)} />
              <label style={css.label}>Mot de passe * (6 car. min.)</label>
              <div style={{ position:"relative", marginBottom:14 }}>
                <input style={{ ...css.input, paddingRight:44 }} type={showPw?"text":"password"} placeholder="••••••••" value={rPass} onChange={e=>setRPass(e.target.value)} />
                <button style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.sub, cursor:"pointer", fontSize:18 }} onClick={()=>setShowPw(p=>!p)}>{showPw?"🙈":"👁️"}</button>
              </div>
              <label style={css.label}>Rôle *</label>
              <div style={{ display:"flex", gap:10, marginBottom:16 }}>
                {[{v:"client",l:"👤 Client"},{v:"technicien",l:"🔧 Technicien"}].map(r=>(
                  <button key={r.v} style={{ flex:1, padding:"11px 0", borderRadius:10, border:`1px solid ${rRole===r.v?C.accent:C.border}`, background:rRole===r.v?C.accent:"#0a1520", color:rRole===r.v?"#fff":C.sub, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>setRRole(r.v)}>{r.l}</button>
                ))}
              </div>
              <BtnPrimary label="Suivant →" onClick={doRegister} loading={loading} />
            </>}

            {regStep === 2 && <>
              <div style={{ fontSize:11, color:C.accent, fontWeight:700, marginBottom:14, textTransform:"uppercase", letterSpacing:1 }}>Étape 2 / 2 — Votre profil</div>
              <label style={css.label}>Ville</label>
              <input style={{ ...css.input, marginBottom:12 }} placeholder="Ex: Dakar" value={rCity} onChange={e=>setRCity(e.target.value)} />
              {rRole==="technicien" && <>
                <label style={css.label}>Années d'expérience</label>
                <input style={{ ...css.input, marginBottom:12 }} type="number" min="0" value={rExp} onChange={e=>setRExp(e.target.value)} />
                <label style={css.label}>Compétences (cliquez pour sélectionner)</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10, maxHeight:160, overflowY:"auto", padding:"4px 0" }}>
                  {CATEGORIES.map(c=>(
                    <button key={c} style={{ padding:"5px 10px", borderRadius:20, border:`1px solid ${rSkills.includes(c)?C.accent:C.border}`, background:rSkills.includes(c)?C.accent:"#0a1520", color:rSkills.includes(c)?"#fff":C.sub, fontWeight:600, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}
                      onClick={()=>setRSkills(sk=>sk.includes(c)?sk.filter(x=>x!==c):[...sk,c])}>{c}</button>
                  ))}
                </div>
                <label style={css.label}>Ou précisez votre métier / compétence</label>
                <input style={{ ...css.input, marginBottom:16 }}
                  placeholder="Ex: Ménagère, Repasseur, Baby-sitter, Cuisinier, Gardien..."
                  onBlur={e=>{ const v=e.target.value.trim(); if(v&&!rSkills.includes(v)) setRSkills(sk=>[...sk,v]); e.target.value=""; }}
                  onKeyDown={e=>{ if(e.key==="Enter"){ const v=e.target.value.trim(); if(v&&!rSkills.includes(v)) setRSkills(sk=>[...sk,v]); e.target.value=""; }}} />
                {rSkills.length>0&&(
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
                    {rSkills.map(sk=>(
                      <span key={sk} style={{ background:C.accent+"22", color:C.accent, border:`1px solid ${C.accent}44`, borderRadius:20, padding:"4px 10px", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
                        {sk}
                        <button style={{ background:"none", border:"none", color:C.accent, cursor:"pointer", fontSize:14, lineHeight:1, padding:0 }} onClick={()=>setRSkills(s=>s.filter(x=>x!==sk))}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </>}
              <div style={{ display:"flex", gap:10, position:"sticky", bottom:0, background:C.card, paddingTop:12, marginTop:8, borderTop:`1px solid ${C.border}` }}>
                <button style={{ ...css.btn("#1e3a52"), flex:1, border:`1px solid ${C.border}` }} onClick={()=>setRegStep(1)}>← Retour</button>
                <div style={{ flex:2 }}><BtnPrimary label="✓ Créer mon compte" onClick={doRegister} loading={loading} /></div>
              </div>
            </>}
          </>}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  //  BARRE DE NAV COMMUNE
  // ══════════════════════════════════════════════════════════════
  const NavBar = ({ title, extra }) => (
    <div style={css.nav}>
      <Logo size={32} />
      <span style={{ fontWeight:800, fontSize:15, fontFamily:"Georgia,serif", flex:1 }}>{title}</span>
      {extra}
      <button style={{ ...css.btn("#1e3a52"), padding:"6px 12px", border:`1px solid ${C.border}`, fontSize:13, marginLeft:6 }} onClick={doLogout}>Déconn.</button>
    </div>
  );

  const TabBar = ({ tabs }) => (
    <div style={css.bottomNav}>
      {tabs.map(t => (
        <button key={t.id} style={{ flex:1, background:"none", border:"none", color:tab===t.id?C.accent:C.muted, padding:"10px 0", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, fontSize:18, position:"relative" }} onClick={()=>setTab(t.id)}>
          {t.icon}
          <span style={{ fontSize:9, fontWeight:700 }}>{t.label}</span>
          {t.badge>0&&<span style={{ position:"absolute", top:5, right:"calc(50% - 18px)", background:C.red, color:"#fff", borderRadius:"50%", width:15, height:15, fontSize:9, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>{t.badge}</span>}
          {tab===t.id&&<div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:28, height:3, background:C.accent, borderRadius:"0 0 4px 4px" }} />}
        </button>
      ))}
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  //  ADMIN
  // ══════════════════════════════════════════════════════════════
  if (screen === "admin") {
    const adminTabs = [
      { id:"dashboard", icon:"⊞",  label:"Dashboard" },
      { id:"users",     icon:"👥", label:"Membres" },
      { id:"jobs",      icon:"💼", label:"Offres" },
      { id:"notifs",    icon:"🔔", label:"Notifs", badge:unread },
      { id:"messages",  icon:"💬", label:"Messages" },
    ];
    return (
      <div style={css.app}>
        <Fonts />
        {toast && <Toast t={toast} />}
        <NavBar title="👑 Admin Panel" extra={
          <button style={{ ...css.btn("#1e3a52"), padding:"6px 12px", border:`1px solid ${C.border}`, fontSize:13, position:"relative" }} onClick={()=>setTab("notifs")}>
            🔔{unread>0&&<span style={{ position:"absolute", top:-4, right:-4, background:C.red, color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:9, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>{unread}</span>}
          </button>
        } />
        <div style={css.page}>
          {tab==="dashboard" && <AdminDash users={users} jobs={jobs} notifs={adminNotifs} setAdminNotifs={setAdminNotifs} setTab={setTab} />}
          {tab==="users"     && <AdminMembers users={filteredUsers(users)} searchQ={searchQ} setSearchQ={setSearchQ} selUser={selUser} setSelUser={setSelUser}
            onMute={id=>{ setUsers(u=>u.map(x=>x.id===id?{...x,status:"muted"}:x)); toast$("Utilisateur muté"); }}
            onActivate={id=>{ setUsers(u=>u.map(x=>x.id===id?{...x,status:"active"}:x)); toast$("Utilisateur activé"); }}
            onDelete={id=>{ if(window.confirm("Supprimer cet utilisateur ?")){ setUsers(u=>u.filter(x=>x.id!==id)); toast$("Utilisateur supprimé"); } }}
            setTab={setTab} />}
          {tab==="reported"  && <AdminMembers users={filteredUsers(users.filter(u=>adminNotifs.some(n=>n.type==="report"&&n.msg.includes(u.name.split(" ")[0]))))} searchQ={searchQ} setSearchQ={setSearchQ} selUser={selUser} setSelUser={setSelUser}
            onMute={id=>{ setUsers(u=>u.map(x=>x.id===id?{...x,status:"muted"}:x)); toast$("Utilisateur muté"); }}
            onActivate={id=>{ setUsers(u=>u.map(x=>x.id===id?{...x,status:"active"}:x)); toast$("Utilisateur activé"); }}
            onDelete={id=>{ if(window.confirm("Supprimer cet utilisateur ?")){ setUsers(u=>u.filter(x=>x.id!==id)); toast$("Utilisateur supprimé"); } }}
            setTab={setTab} reportedView />}
          {tab==="jobs"    && <AdminJobsTab jobs={jobs} setJobs={setJobs} toast$={toast$} setTab={setTab} />}
          {tab==="notifs"  && <NotifsTab notifs={adminNotifs} setNotifs={setAdminNotifs} unread={adminNotifs.filter(n=>!n.read).length} setTab={setTab} isAdmin />}
          {tab==="messages"&& <ChatTab msgs={msgs} setMsgs={setMsgs} newMsg={newMsg} setNewMsg={setNewMsg} sendMsg={sendMsg} chatRef={chatRef} voiceOn={voiceOn} setVoiceOn={setVoiceOn} setTab={setTab} prevTab={prevTab} currentUser={currentUser} />}
        </div>
        <TabBar tabs={adminTabs} />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  UTILISATEUR
  // ══════════════════════════════════════════════════════════════
  const userTabs = [
    { id:"home",        icon:"🏠", label:"Accueil" },
    { id:"jobs",        icon:"💼", label:"Offres" },
    { id:"techniciens", icon:"🔧", label:"Techs" },
    { id:"chat",        icon:"💬", label:"Chat" },
    { id:"profile",     icon:"👤", label:"Profil" },
  ];
  return (
    <div style={css.app}>
      <Fonts />
      {toast && <Toast t={toast} />}
      {/* ── MODAL PROFIL VISITEUR ── */}
      {viewProfileUser && (
        <ProfileModal user={viewProfileUser} onClose={()=>setViewProfileUser(null)} toast$={toast$} openChat={openChat} myRatings={myRatings} setMyRatings={setMyRatings} />
      )}
      <NavBar title="Emploi pour Tous" extra={
        <>
          <button style={{ ...css.btn("#1e3a52"), padding:"6px 12px", border:`1px solid ${C.border}`, fontSize:13 }} onClick={()=>{ setActiveChatContact(null); setTab("chat"); }}>💬</button>
          <button style={{ ...css.btn("#1e3a52"), padding:"6px 12px", border:`1px solid ${C.border}`, fontSize:13, marginLeft:6, position:"relative" }} onClick={()=>setTab("notifs")}>
            🔔{unread>0&&<span style={{ position:"absolute", top:-4, right:-4, background:C.red, color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:9, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>{unread}</span>}
          </button>
        </>
      } />
      <div style={css.page}>
        {tab==="home"        && <HomeTab users={users} jobs={jobs} setTab={setTab} toast$={toast$} openChat={openChat} handlePostuler={handlePostuler} setOnlineFilter={setOnlineFilter} openProfile={openProfile} />}
        {tab==="jobs"        && <JobsTab jobs={jobs} setJobs={setJobs} showJob={showJob} setShowJob={setShowJob} jobForm={jobForm} setJobForm={setJobForm} postJob={postJob} toast$={toast$} currentUser={currentUser} setTab={setTab} openChat={openChat} handlePostuler={handlePostuler} highlightJob={highlightJob} prevTab={prevTab} openProfile={openProfile} />}
        {tab==="techniciens" && <TechsTab users={filteredUsers(users.filter(u=>u.role==="technicien" && (!onlineFilter || u.online)))} searchQ={searchQ} setSearchQ={setSearchQ} selUser={selUser} setSelUser={setSelUser} setTab={setTab} toast$={toast$} myRatings={myRatings} setMyRatings={setMyRatings} openChat={openChat} onlineFilter={onlineFilter} setOnlineFilter={setOnlineFilter} viewProfileUser={viewProfileUser} setViewProfileUser={setViewProfileUser} />}
        {tab==="chat"        && <ChatTab msgs={msgs} setMsgs={setMsgs} newMsg={newMsg} setNewMsg={setNewMsg} sendMsg={sendMsg} chatRef={chatRef} voiceOn={voiceOn} setVoiceOn={setVoiceOn} activeChatContact={activeChatContact} setActiveChatContact={setActiveChatContact} setTab={setTab} prevTab={prevTab} currentUser={currentUser} />}
        {tab==="profile"     && <ProfileTab currentUser={currentUser} doLogout={doLogout} toast$={toast$} openChat={openChat} setTab={setTab} />}
        {tab==="notifs"      && <NotifsTab notifs={notifs} setNotifs={setNotifs} unread={unread} setTab={setTab} openChat={openChat} setHighlightJob={setHighlightJob} />}
      </div>
      <TabBar tabs={userTabs} />
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
//  PROFILE MODAL — Overlay profil technicien
// ══════════════════════════════════════════════════════════════
function ProfileModal({ user:u, onClose, toast$, openChat, myRatings, setMyRatings }) {
  const bg = getColor(u.name);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", zIndex:2000, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}
      onClick={onClose}>
      <div style={{ background:C.card, borderRadius:"24px 24px 0 0", padding:"24px 20px 40px", maxHeight:"88vh", overflowY:"auto", WebkitOverflowScrolling:"touch" }}
        onClick={e=>e.stopPropagation()}>
        {/* Drag handle */}
        <div style={{ width:40, height:4, borderRadius:4, background:C.border, margin:"0 auto 20px" }} />
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
          <Av initials={u.avatar||"??"} bg={bg} size={64} online={u.online} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:18, color:C.text }}>{u.name}</div>
            <div style={{ fontSize:12, color:C.sub }}>📍 {u.city||"—"} · {u.exp} ans d'exp.</div>
            {u.rating>0 && <div style={{ color:"#FFB800", fontSize:13, marginTop:3 }}>{"★".repeat(Math.floor(u.rating))}<span style={{ color:C.sub, fontSize:11, marginLeft:4 }}>{u.rating}/5</span></div>}
            <div style={{ fontSize:11, marginTop:4, color:u.online?"#00E676":"#607080", fontWeight:700 }}>{u.online?"● En ligne":"● Hors ligne"}</div>
          </div>
          <button style={{ background:"#1e3a52", border:"none", borderRadius:10, padding:"8px 12px", color:C.sub, fontSize:18, cursor:"pointer" }} onClick={onClose}>✕</button>
        </div>
        {/* Compétences */}
        {u.skills?.length>0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
            {u.skills.map(sk=><Chip key={sk} label={sk} color={C.accent} />)}
          </div>
        )}
        {/* Stats */}
        <div style={{ background:"#0a1520", borderRadius:12, padding:14, marginBottom:14, fontSize:13, lineHeight:2, color:C.sub }}>
          <div>🎓 <strong style={{ color:C.text }}>Expérience :</strong> {u.exp} ans</div>
          <div>🏆 <strong style={{ color:C.text }}>Missions :</strong> {u.jobs}</div>
          <div>⭐ <strong style={{ color:C.text }}>Note :</strong> {u.rating>0?`${u.rating}/5`:"Pas encore noté"}</div>
          <div>📍 <strong style={{ color:C.text }}>Localisation :</strong> {u.city||"—"}</div>
          <div>🔧 <strong style={{ color:C.text }}>Spécialités :</strong> {u.skills?.join(", ")||"—"}</div>
        </div>
        {/* Résumé */}
        <div style={{ background:"#0a1520", borderRadius:12, padding:14, marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:6 }}>📄 Résumé professionnel</div>
          <div style={{ fontSize:12, color:C.sub, lineHeight:1.7 }}>Professionnel avec {u.exp} ans d'expérience en {u.skills?.[0]||"services"}. Disponible rapidement pour toute mission.</div>
        </div>
        {/* Note */}
        <div style={{ background:"#0a1520", borderRadius:12, padding:14, marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:8 }}>⭐ Donner une note</div>
          <div style={{ display:"flex", gap:8 }}>
            {[1,2,3,4,5].map(star=>(
              <button key={star} style={{ background:"none", border:"none", cursor:"pointer", fontSize:30, color:(myRatings[u.id]||0)>=star?"#FFB800":"#2a3a4a", padding:0 }}
                onClick={()=>{ setMyRatings(r=>({...r,[u.id]:star})); toast$(`Note ${star}/5 envoyée ⭐`); }}>★</button>
            ))}
          </div>
        </div>
        {/* Actions */}
        <div style={{ display:"flex", gap:10, marginBottom:10 }}>
          <button style={{ ...css.btn(C.accent), flex:2, padding:"13px 0", fontSize:14 }} onClick={()=>{ onClose(); openChat?.(u.name, u.online); }}>💬 Contacter</button>
          <button style={{ ...css.btn("#6A1B9A"), flex:1, padding:"13px 0", fontSize:14 }} onClick={()=>toast$("Appel en cours... 📞")}>📞</button>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button style={{ ...css.btn(C.gold), flex:1, padding:"11px 0", fontSize:13 }} onClick={()=>toast$("Téléchargement CV... 📄")}>📋 CV</button>
          <button style={{ ...css.btn(C.red), flex:1, padding:"11px 0", fontSize:13 }} onClick={()=>{ toast$("Signalement envoyé à l'admin"); onClose(); }}>🚩 Signaler</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  JOBCARD — Carte offre avec auteur cliquable
// ══════════════════════════════════════════════════════════════
function JobCard({ job:j, toast$, compact=false, openChat, handlePostuler, setTab, highlighted=false, onViewProfile, currentUserName, onDeleteJob }) {
  const [showAuthor, setShowAuthor]   = useState(false);
  const [confirmDel, setConfirmDel]   = useState(false);
  const isMyJob = currentUserName && j.postedBy === currentUserName;
  const initials = (j.postedBy||"??").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const bg = j.postedByPhoto || null;
  const clr = getColor(j.postedBy||"A");
  return (
    <div style={{ background:C.card, borderRadius:16, border:`2px solid ${highlighted?C.gold:C.border}`, padding:18, marginBottom:14, borderLeft:`4px solid ${j.status==="open"?C.green:C.muted}`, boxShadow:highlighted?"0 0 20px #FFB80066":"none", transition:"all .3s" }}>
      {highlighted && <div style={{ background:C.gold+"22", borderRadius:8, padding:"6px 12px", marginBottom:10, fontSize:12, fontWeight:700, color:C.gold }}>⭐ Offre mise en avant</div>}
      {/* Auteur */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, cursor:"pointer" }} onClick={()=>setShowAuthor(v=>!v)}>
        {bg ? <img src={bg} alt="pp" style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.accent}`, flexShrink:0 }} />
            : <div style={{ width:40, height:40, borderRadius:"50%", background:clr, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:14, color:"#fff", flexShrink:0 }}>{initials}</div>}
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:14, color:C.text }}>{j.postedBy||"Anonyme"}</div>
          <div style={{ fontSize:11, color:C.sub }}>🗓 {j.date} · 📍 {j.city||"—"}</div>
        </div>
        <span style={{ color:C.sub, fontSize:13 }}>{showAuthor?"▲":"▼"}</span>
      </div>
      {/* Mini profil */}
      {showAuthor && (
        <div style={{ background:"#0a1520", borderRadius:12, padding:14, marginBottom:12, border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {bg ? <img src={bg} alt="pp" style={{ width:54, height:54, borderRadius:"50%", objectFit:"cover" }} />
                : <div style={{ width:54, height:54, borderRadius:"50%", background:clr, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:20, color:"#fff" }}>{initials}</div>}
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{j.postedBy||"Anonyme"}</div>
              <div style={{ fontSize:12, color:C.sub }}>📍 {j.city||"—"}</div>
              <div style={{ fontSize:11, color:C.green, marginTop:2 }}>● Membre actif</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:12 }}>
            <button style={{ flex:1, padding:"9px 0", borderRadius:10, border:"none", background:C.accent, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}
              onClick={()=>{ setShowAuthor(false); openChat?.(j.postedBy, true); }}>💬 Message</button>
            <button style={{ flex:1, padding:"9px 0", borderRadius:10, border:`1px solid ${C.border}`, background:"#1e3a52", color:C.text, fontWeight:700, fontSize:13, cursor:"pointer" }}
              onClick={()=>{ setShowAuthor(false); if(onViewProfile) onViewProfile(j.postedBy); else setTab?.("techniciens"); }}>👤 Voir profil</button>
          </div>
        </div>
      )}
      {/* Contenu */}
      <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{j.title}</div>
      <div style={{ fontSize:12, color:C.sub, marginTop:3 }}>🏷 {j.category} · 📍 {j.city||"—"}</div>
      {j.description && <div style={{ fontSize:13, color:C.sub, marginTop:6, lineHeight:1.6, padding:"8px 10px", background:"#0a1520", borderRadius:8 }}>{j.description}</div>}
      <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
        <span style={{ background:(j.status==="open"?C.green:C.muted)+"22", color:j.status==="open"?C.green:C.muted, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{j.status==="open"?"✅ Ouvert":"🔒 Fermé"}</span>
        {j.urgent&&<span style={{ background:C.red+"22", color:C.red, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>🔥 Urgent</span>}
        {j.budget&&<span style={{ background:C.gold+"22", color:C.gold, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>💰 {j.budget}</span>}
        <span style={{ background:C.accent+"22", color:C.accent, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>👥 {j.applicants||0} candidat{j.applicants!==1?"s":""}</span>
      </div>
      {!compact && j.status==="open" && !isMyJob && (
        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <button style={{ flex:2, padding:"11px 0", borderRadius:10, border:"none", background:"linear-gradient(135deg,#1E88E5,#0D47A1)", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}
            onClick={()=>handlePostuler?.(j)}>✓ Postuler</button>
          <button style={{ flex:1, padding:"11px 0", borderRadius:10, border:`1px solid ${C.border}`, background:"#1e3a52", color:C.text, fontWeight:700, fontSize:13, cursor:"pointer" }}
            onClick={()=>openChat?.(j.postedBy, true)}>💬 Contacter</button>
        </div>
      )}
      {/* Bouton supprimer — visible uniquement pour l'auteur */}
      {isMyJob && (
        <div style={{ marginTop:12 }}>
          {!confirmDel ? (
            <button style={{ width:"100%", padding:"10px 0", borderRadius:10, border:`1px solid ${C.red}55`, background:C.red+"11", color:C.red, fontWeight:700, fontSize:13, cursor:"pointer" }}
              onClick={()=>setConfirmDel(true)}>
              🗑️ Supprimer ma publication
            </button>
          ) : (
            <div style={{ background:C.red+"11", borderRadius:10, border:`1px solid ${C.red}44`, padding:"12px 14px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:10 }}>⚠️ Confirmer la suppression ?</div>
              <div style={{ display:"flex", gap:8 }}>
                <button style={{ flex:2, padding:"10px 0", borderRadius:10, border:"none", background:C.red, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}
                  onClick={()=>{ onDeleteJob?.(j.id); toast$?.("Publication supprimée 🗑️"); }}>
                  ✓ Oui, supprimer
                </button>
                <button style={{ flex:1, padding:"10px 0", borderRadius:10, border:`1px solid ${C.border}`, background:"#1e3a52", color:C.sub, fontWeight:700, fontSize:13, cursor:"pointer" }}
                  onClick={()=>setConfirmDel(false)}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
//  HOMETAB — Accueil utilisateur
// ══════════════════════════════════════════════════════════════
function HomeTab({ users, jobs, setTab, toast$, openChat, handlePostuler, setOnlineFilter, openProfile }) {
  return <>
    {/* Hero */}
    <div style={{ background:"linear-gradient(135deg,#1565C0,#0D47A1)", borderRadius:20, padding:24, marginBottom:20, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:-20, right:-20, width:120, height:120, borderRadius:"50%", background:"rgba(255,255,255,.05)" }} />
      <p style={{ fontSize:13, color:"rgba(255,255,255,.7)", margin:0 }}>Bienvenue 👋</p>
      <h2 style={{ fontFamily:"Georgia,serif", fontSize:22, margin:"6px 0 8px", color:"#fff" }}>Trouvez le bon prestataire</h2>
      <p style={{ fontSize:13, color:"rgba(255,255,255,.7)", margin:"0 0 16px" }}>Services à domicile en toute confiance 🌍</p>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        <button style={{ background:"#fff", color:"#0D47A1", border:"none", borderRadius:10, padding:"10px 18px", fontWeight:800, fontSize:13, cursor:"pointer" }} onClick={()=>setTab("techniciens")}>🔧 Trouver un prestataire</button>
        <button style={{ background:"rgba(255,255,255,.15)", color:"#fff", border:"1px solid rgba(255,255,255,.3)", borderRadius:10, padding:"10px 18px", fontWeight:700, fontSize:13, cursor:"pointer" }} onClick={()=>setTab("jobs")}>+ Publier une offre</button>
      </div>
    </div>

    {/* Stats cliquables */}
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
      {[
        { l:"Prestataires", v:users.filter(u=>u.role==="technicien").length, i:"🔧", t:"techniciens", filter:false },
        { l:"Offres actives",v:jobs.filter(j=>j.status==="open").length,     i:"💼", t:"jobs",        filter:false },
        { l:"En ligne",      v:users.filter(u=>u.role==="technicien"&&u.online).length, i:"🟢", t:"techniciens", filter:true  },
      ].map(s=>(
        <div key={s.l} onClick={()=>{ setOnlineFilter?.(s.filter); setTab(s.t); }}
          style={{ background:"#122236", borderRadius:16, border:"1px solid #1e3a52", padding:"14px 8px", marginBottom:0, textAlign:"center", cursor:"pointer" }}>
          <div style={{ fontSize:24 }}>{s.i}</div>
          <div style={{ fontWeight:800, fontSize:20, fontFamily:"Georgia,serif", color:"#E8F0FE" }}>{s.v}</div>
          <div style={{ fontSize:10, color:"#90A4AE" }}>{s.l}</div>
          <div style={{ fontSize:9, color:"#1E88E5", marginTop:2 }}>Voir →</div>
        </div>
      ))}
    </div>

    {/* Offres récentes */}
    <p style={{ fontWeight:800, fontSize:15, margin:"0 0 12px", color:"#E8F0FE" }}>Offres récentes 💼</p>
    {jobs.filter(j=>j.status==="open").map(j=>(
      <JobCard key={j.id} job={j} toast$={toast$} openChat={openChat} handlePostuler={handlePostuler} setTab={setTab} compact onViewProfile={openProfile} />
    ))}

    {/* Top prestataires */}
    <p style={{ fontWeight:800, fontSize:15, margin:"16px 0 12px", color:"#E8F0FE" }}>Top prestataires ⭐</p>
    <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:12 }}>
      {users.filter(u=>u.role==="technicien"&&u.rating>0).map(u=>(
        <div key={u.id} onClick={()=>setTab("techniciens")}
          style={{ background:"#122236", borderRadius:16, border:"1px solid #1e3a52", minWidth:138, marginBottom:0, textAlign:"center", padding:"16px 12px", flexShrink:0, cursor:"pointer" }}>
          <Av initials={u.avatar||"??"} bg={getColor(u.name)} size={48} online={u.online} />
          <div style={{ fontWeight:700, fontSize:12, marginTop:8, color:"#E8F0FE" }}>{u.name.split(" ")[0]}</div>
          <div style={{ fontSize:10, color:"#90A4AE" }}>{u.skills?.[0]||"Prestataire"}</div>
          <div style={{ color:"#FFB800", fontSize:12, marginTop:2 }}>{"★".repeat(Math.floor(u.rating))}<span style={{ color:"#90A4AE", fontSize:11, marginLeft:4 }}>{u.rating}</span></div>
          <button style={{ marginTop:8, padding:"5px 10px", borderRadius:8, border:"none", background:"#1E88E522", color:"#1E88E5", fontWeight:700, fontSize:11, cursor:"pointer" }}
            onClick={(e)=>{ e.stopPropagation(); openChat?.(u.name, u.online); }}>
            💬 Contacter
          </button>
        </div>
      ))}
    </div>
  </>;
}

// ══════════════════════════════════════════════════════════════
//  JOBSTAB — Onglet offres utilisateur
// ══════════════════════════════════════════════════════════════
function JobsTab({ jobs, setJobs, showJob, setShowJob, jobForm, setJobForm, postJob, toast$, currentUser, setTab, openChat, handlePostuler, highlightJob, openProfile }) {
  const [filter, setFilter]               = useState("all");
  const [useCustom, setUseCustom]         = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const CATS = ["Plomberie","Électricité","Peinture","Menuiserie","Carrelage","Climatisation","Soudure","Jardinage","Nettoyage","Sécurité","Informatique","Électroménager","Ménagère","Repassage","Cuisine","Garde d'enfants","Aide aux personnes âgées","Maçonnerie","Couture","Coiffure","Mécanique","Déménagement","Livraison"];
  const list = filter==="all"?jobs:jobs.filter(j=>j.status===filter);

  const handlePost = () => {
    const finalCat = useCustom ? customCategory.trim() : jobForm.category;
    if (!jobForm.title)  { toast$("Le titre est obligatoire", true); return; }
    if (!finalCat)       { toast$("Précisez le type de service", true); return; }
    setJobForm(f => ({ ...f, category: finalCat }));
    setTimeout(() => postJob(), 50);
  };

  return <>
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
      <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }} onClick={()=>setTab("home")}>←</button>
      <p style={{ ...css.title, marginBottom:0, flex:1 }}>Offres d'emploi</p>
      <button style={css.btn(C.green)} onClick={()=>setShowJob(v=>!v)}>+ Publier</button>
    </div>
    <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
      {[{v:"all",l:"Toutes"},{v:"open",l:"Ouvertes"},{v:"closed",l:"Fermées"}].map(f=>(
        <button key={f.v} style={{ ...css.btn(filter===f.v?C.accent:"#1e3a52"), padding:"6px 14px", fontSize:12, border:`1px solid ${filter===f.v?C.accent:C.border}` }} onClick={()=>setFilter(f.v)}>{f.l}</button>
      ))}
    </div>
    {showJob&&(
      <div style={{ ...css.card, border:`1px solid ${C.green}55`, marginBottom:16 }}>
        <p style={{ fontWeight:800, fontSize:15, marginBottom:4, color:C.green }}>📝 Publier une annonce</p>
        <p style={{ fontSize:12, color:"#90A4AE", marginBottom:14 }}>Décrivez votre besoin librement</p>
        <label style={css.label}>Titre de l'annonce *</label>
        <input style={{ ...css.input, marginBottom:14 }} placeholder="Ex: Cherche ménagère 3×/semaine..." value={jobForm.title} onChange={e=>setJobForm(f=>({...f,title:e.target.value}))} />
        <label style={css.label}>Type de service *</label>
        <div style={{ display:"flex", background:"#0a1520", borderRadius:10, padding:4, marginBottom:12, border:`1px solid ${C.border}` }}>
          <button style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none", fontWeight:700, fontSize:12, fontFamily:"inherit", cursor:"pointer", background:!useCustom?C.accent:"transparent", color:!useCustom?"#fff":C.sub }} onClick={()=>setUseCustom(false)}>📋 Liste</button>
          <button style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none", fontWeight:700, fontSize:12, fontFamily:"inherit", cursor:"pointer", background:useCustom?C.accent:"transparent", color:useCustom?"#fff":C.sub }} onClick={()=>setUseCustom(true)}>✏️ Écrire</button>
        </div>
        {!useCustom && <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>{CATS.map(c=><button key={c} style={{ padding:"6px 12px", borderRadius:20, border:`1px solid ${jobForm.category===c?C.accent:C.border}`, background:jobForm.category===c?C.accent:"#0a1520", color:jobForm.category===c?"#fff":C.sub, fontWeight:600, fontSize:11, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>setJobForm(f=>({...f,category:c}))}>{c}</button>)}</div>}
        {useCustom && <input style={{ ...css.input, marginBottom:12 }} placeholder="Ex: Ménagère, Baby-sitter, Gardien..." value={customCategory} onChange={e=>setCustomCategory(e.target.value)} />}
        {((useCustom&&customCategory)||(!useCustom&&jobForm.category)) && <div style={{ padding:"8px 12px", background:"#00E67611", borderRadius:10, border:"1px solid #00E67633", marginBottom:12, fontSize:13, color:C.green, fontWeight:700 }}>✅ {useCustom?customCategory:jobForm.category}</div>}
        <label style={css.label}>Description</label>
        <textarea style={{ ...css.input, resize:"vertical", minHeight:70, marginBottom:12 }} placeholder="Horaires, exigences, détails..." value={jobForm.description||""} onChange={e=>setJobForm(f=>({...f,description:e.target.value}))} />
        <label style={css.label}>Ville / Quartier</label>
        <input style={{ ...css.input, marginBottom:12 }} placeholder="Ex: Douala Bonapriso..." value={jobForm.city} onChange={e=>setJobForm(f=>({...f,city:e.target.value}))} />
        <label style={css.label}>Budget / Salaire</label>
        <input style={{ ...css.input, marginBottom:12 }} placeholder="Ex: 80 000 FCFA/mois, À négocier" value={jobForm.budget} onChange={e=>setJobForm(f=>({...f,budget:e.target.value}))} />
        <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", marginBottom:14, padding:"10px 12px", background:"#0a1520", borderRadius:10, border:`1px solid ${jobForm.urgent?C.red:C.border}`, fontSize:13, color:C.text }}>
          <input type="checkbox" checked={jobForm.urgent} onChange={e=>setJobForm(f=>({...f,urgent:e.target.checked}))} style={{ width:16, height:16 }} />
          <div><div style={{ fontWeight:700 }}>🔥 Besoin urgent</div><div style={{ fontSize:11, color:C.muted }}>Votre annonce sera mise en avant</div></div>
        </label>
        <div style={{ display:"flex", gap:10, position:"sticky", bottom:0, background:C.card, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
          <button style={{ ...css.btn("linear-gradient(135deg,#00796B,#00E676)"), flex:2, padding:"12px 0" }} onClick={handlePost}>✓ Publier</button>
          <button style={{ ...css.btn("#1e3a52"), flex:1, border:`1px solid ${C.border}` }} onClick={()=>{ setShowJob(false); setCustomCategory(""); setUseCustom(false); }}>Annuler</button>
        </div>
      </div>
    )}
    {list.map(j=>(
      <div key={j.id} id={`job-${j.id}`} style={highlightJob===j.id?{outline:`3px solid ${C.gold}`,borderRadius:18,boxShadow:`0 0 20px ${C.gold}44`}:{}} ref={highlightJob===j.id ? el=>{ if(el) setTimeout(()=>el.scrollIntoView({behavior:"smooth",block:"center"}),200); } : null}>
        <JobCard job={j} toast$={toast$} openChat={openChat} handlePostuler={handlePostuler} setTab={setTab} highlighted={highlightJob===j.id} onViewProfile={openProfile}
          currentUserName={currentUser?.name} onDeleteJob={(id)=>setJobs(jj=>jj.filter(x=>x.id!==id))} />
      </div>
    ))}
  </>;
}

// ══════════════════════════════════════════════════════════════
//  ADMIN TABS
// ══════════════════════════════════════════════════════════════
function AdminDash({ users, jobs, notifs, setAdminNotifs, setTab }) {
  const stats = [
    { label:"Membres",       value:users.length,                                  icon:"👥", color:C.accent,  tab:"users" },
    { label:"Techniciens",   value:users.filter(u=>u.role==="technicien").length, icon:"🔧", color:C.gold,    tab:"users" },
    { label:"Offres actives",value:jobs.filter(j=>j.status==="open").length,      icon:"💼", color:C.green,   tab:"jobs" },
    { label:"Signalements",  value:notifs.filter(n=>n.type==="report").length,    icon:"⚠️", color:C.red,     tab:"reported" },
    { label:"En ligne",      value:users.filter(u=>u.online).length,              icon:"🟢", color:"#00BCD4", tab:"users" },
    { label:"Non lus",       value:notifs.filter(n=>!n.read).length,             icon:"🔔", color:"#FF9800", tab:"notifs" },
  ];


  const navFromNotif = (n) => {
    setAdminNotifs?.(nn=>nn.map(x=>x.id===n.id?{...x,read:true}:x));
    if (n.type==="new_user")    setTab?.("users");
    else if (n.type==="new_job")setTab?.("jobs");
    else if (n.type==="report") setTab?.("reported");
    else if (n.type==="message")setTab?.("messages");
    else setTab?.("notifs");
  };

  return <>
    <p style={css.title}>Tableau de bord</p>
    <p style={{ fontSize:13, color:C.sub, marginBottom:20 }}>Vue d'ensemble — Emploi pour Tous</p>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
      {stats.map(s => (
        <div key={s.label} onClick={()=>setTab?.(s.tab)} style={{ ...css.card, marginBottom:0, borderLeft:`3px solid ${s.color}`, padding:"16px 14px", cursor:"pointer", transition:"opacity .2s" }}>
          <div style={{ fontSize:22 }}>{s.icon}</div>
          <div style={{ fontSize:28, fontWeight:800, color:s.color, fontFamily:"Georgia,serif" }}>{s.value}</div>
          <div style={{ fontSize:11, color:C.sub }}>{s.label}</div>
          <div style={{ fontSize:10, color:s.color, marginTop:4 }}>Voir →</div>
        </div>
      ))}
    </div>
    <p style={{ fontWeight:800, fontSize:15, marginBottom:12 }}>Activité récente</p>
    {notifs.slice(0,5).map(n => (
      <div key={n.id} onClick={()=>navFromNotif(n)} style={{ ...css.card, display:"flex", alignItems:"center", gap:12, padding:"12px 14px", marginBottom:8, borderLeft:`3px solid ${n.read?C.border:C.accent}`, cursor:"pointer" }}>
        <span style={{ fontSize:18 }}>{n.type==="new_user"?"👤":n.type==="new_job"?"💼":n.type==="report"?"⚠️":"💬"}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:n.read?500:700 }}>{n.msg}</div>
          <div style={{ fontSize:11, color:C.muted }}>{n.time}</div>
          <div style={{ fontSize:11, color:C.accent, marginTop:2 }}>Tap pour voir →</div>
        </div>
        {!n.read&&<div style={{ width:8, height:8, borderRadius:"50%", background:C.accent }} />}
      </div>
    ))}
  </>;
}

function AdminMembers({ users, searchQ, setSearchQ, selUser, setSelUser, onMute, onActivate, onDelete, setTab, reportedView }) {
  return <>
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
      {setTab && <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }} onClick={()=>setTab("dashboard")}>←</button>}
      <p style={{ ...css.title, marginBottom:0, flex:1 }}>{reportedView ? "⚠️ Membres signalés" : "Membres"} ({users.length})</p>
    </div>
    <input style={{ ...css.input, marginBottom:16 }} placeholder="🔍 Quel service ? Ex: Électricien, Plombier, Ménagère..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
    {users.map(u => (
      <div key={u.id} style={{ ...css.card, marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <Av initials={u.avatar||"??"} bg={getColor(u.name)} size={42} online={u.online} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>{u.name}</div>
            <div style={{ fontSize:11, color:C.sub }}>{u.role} · {u.city} · {u.joined}</div>
            <div style={{ display:"flex", gap:6, marginTop:4, flexWrap:"wrap" }}>
              <Chip label={u.status==="active"?"Actif":u.status==="muted"?"Muté":"Banni"} color={u.status==="active"?C.green:u.status==="muted"?C.gold:C.red} />
              {u.rating>0&&<Chip label={`★ ${u.rating}`} color={C.gold} />}
              <Chip label={`${u.jobs} missions`} color={C.accent} />
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
          <button style={{ ...css.btn(C.accent), flex:1, padding:"8px 0", fontSize:12 }} onClick={()=>setSelUser(selUser?.id===u.id?null:u)}>{selUser?.id===u.id?"Fermer":"Détails"}</button>
          {u.status!=="muted"
            ?<button style={{ ...css.btn(C.gold), flex:1, padding:"8px 0", fontSize:12 }} onClick={()=>onMute(u.id)}>Muter</button>
            :<button style={{ ...css.btn(C.green), flex:1, padding:"8px 0", fontSize:12 }} onClick={()=>onActivate(u.id)}>Activer</button>
          }
          <button style={{ ...css.btn(C.red), flex:1, padding:"8px 0", fontSize:12 }} onClick={()=>onDelete(u.id)}>Suppr.</button>
        </div>
        {selUser?.id===u.id&&(
          <div style={{ marginTop:12, padding:14, background:"#0a1520", borderRadius:10, fontSize:13, color:C.sub, lineHeight:2 }}>
            <div>🎓 <strong style={{ color:C.text }}>Expérience :</strong> {u.exp} ans</div>
            <div>🏆 <strong style={{ color:C.text }}>Missions :</strong> {u.jobs}</div>
            <div>⭐ <strong style={{ color:C.text }}>Note :</strong> {u.rating>0?`${u.rating}/5`:"Non noté"}</div>
            <div>📍 <strong style={{ color:C.text }}>Ville :</strong> {u.city||"—"}</div>
            <div>🔧 <strong style={{ color:C.text }}>Compétences :</strong> {u.skills?.join(", ")||"—"}</div>
          </div>
        )}
      </div>
    ))}
  </>;
}

function AdminJobsTab({ jobs, setJobs, toast$, setTab }) {
  return <>
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
      {setTab && <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }} onClick={()=>setTab("dashboard")}>←</button>}
      <p style={{ ...css.title, marginBottom:0, flex:1 }}>Offres ({jobs.length})</p>
    </div>
    {jobs.map(j => (
      <div key={j.id} style={{ ...css.card, marginBottom:10, borderLeft:`3px solid ${j.status==="open"?C.green:C.muted}` }}>
        <div style={{ fontWeight:700, fontSize:14 }}>{j.title}</div>
        <div style={{ fontSize:12, color:C.sub, marginTop:3 }}>{j.category} · {j.city} · {j.date}</div>
        <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
          <Chip label={j.status==="open"?"Ouvert":"Fermé"} color={j.status==="open"?C.green:C.muted} />
          {j.urgent&&<Chip label="🔥 Urgent" color={C.red} />}
          {j.budget&&<Chip label={j.budget} color={C.gold} />}
          <Chip label={`${j.applicants} candidats`} color={C.accent} />
        </div>
        <div style={{ display:"flex", gap:8, marginTop:10 }}>
          <button style={{ ...css.btn(j.status==="open"?C.muted:C.green), flex:1, padding:"8px 0", fontSize:12 }}
            onClick={()=>setJobs(jj=>jj.map(x=>x.id===j.id?{...x,status:x.status==="open"?"closed":"open"}:x))}>
            {j.status==="open"?"Fermer":"Rouvrir"}
          </button>
          <button style={{ ...css.btn(C.red), flex:1, padding:"8px 0", fontSize:12 }}
            onClick={()=>{ if(window.confirm("Supprimer cette offre ?")){ setJobs(jj=>jj.filter(x=>x.id!==j.id)); toast$("Offre supprimée"); } }}>
            Supprimer
          </button>
        </div>
      </div>
    ))}
  </>;
}

function NotifsTab({ notifs, setNotifs, unread, setTab, openChat, setHighlightJob, isAdmin }) {
  const icons   = { new_user:"👤", new_job:"💼", report:"⚠️", message:"💬", review:"⭐", application:"📋" };
  const navTo   = (n) => {
    setNotifs(nn=>nn.map(x=>x.id===n.id?{...x,read:true}:x));
    if (isAdmin) {
      if (n.type==="new_user")    setTab?.("users");
      else if (n.type==="new_job")setTab?.("jobs");
      else if (n.type==="report") setTab?.("reported");
      else if (n.type==="message")setTab?.("messages");
      else setTab?.("dashboard");
    } else {
      if (n.type==="message")          openChat?.(n.from||"Support EPT", true);
      else if (n.type==="new_job")     { setTab?.("jobs"); if(n.jobId) setHighlightJob?.(n.jobId); }
      else if (n.type==="new_user")    setTab?.("techniciens");
      else if (n.type==="application") setTab?.("jobs");
      else if (n.type==="review")      setTab?.("profile");
      else if (n.type==="report")      setTab?.("profile");
    }
  };
  return <>
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
      <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }} onClick={()=>setTab?.(isAdmin?"dashboard":"home")}>←</button>
      <p style={{ ...css.title, marginBottom:0, flex:1 }}>Notifications {unread>0&&<span style={{ background:C.red, color:"#fff", borderRadius:20, padding:"2px 9px", fontSize:13, marginLeft:8 }}>{unread}</span>}</p>
      {unread>0&&<button style={{ ...css.btn("#1e3a52"), padding:"7px 14px", fontSize:12, border:`1px solid ${C.border}` }} onClick={()=>setNotifs(n=>n.map(x=>({...x,read:true})))}>Tout lire</button>}
    </div>
    {notifs.map(n => (
      <div key={n.id}
        style={{ ...css.card, display:"flex", gap:12, alignItems:"center", marginBottom:8, borderLeft:`3px solid ${n.read?C.border:C.accent}`, padding:"12px 14px", cursor:"pointer", transition:"opacity .2s" }}
        onClick={()=>navTo(n)}>
        <div style={{ width:42, height:42, borderRadius:"50%", background:
          n.type==="message"?"#1E88E522":n.type==="new_job"?"#00E67622":n.type==="report"?"#EF535022":"#FFB80022",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
          {icons[n.type]||"🔔"}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:n.read?500:700, fontSize:13 }}>{n.msg}</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{n.time}</div>
          <div style={{ fontSize:11, color:C.accent, marginTop:3 }}>
            {n.type==="message"?"Tap pour ouvrir le chat →":
             n.type==="new_job"?"Tap pour voir les offres →":
             n.type==="new_user"?"Tap pour voir les techniciens →":"Tap pour ouvrir →"}
          </div>
        </div>
        {!n.read&&<div style={{ width:10, height:10, borderRadius:"50%", background:C.accent, flexShrink:0 }} />}
      </div>
    ))}
    {notifs.length===0&&<div style={{ textAlign:"center", color:C.sub, padding:"40px 0" }}>Aucune notification 🎉</div>}
  </>;
}

const DEFAULT_CONTACTS = [
  { name:"Support EPT",    online:true,  initials:"SE", color:"#C62828" },
  { name:"Mamadou Diallo", online:true,  initials:"MD", color:"#1565C0" },
  { name:"Kofi Atta",      online:false, initials:"KA", color:"#6A1B9A" },
];

function ChatTab({ msgs, setMsgs, newMsg, setNewMsg, sendMsg, chatRef, voiceOn, setVoiceOn, activeChatContact, setActiveChatContact, setTab, prevTab, currentUser }) {
  const [activeC, setActiveC]               = useState(null);
  const [localMsgs, setLocalMsgs]           = useState(() => { try { return JSON.parse(localStorage.getItem('ept_msgs')||'{}'); } catch{return {};} });
  const [typingContacts, setTypingContacts] = useState({});
  const [msgStatus, setMsgStatus]           = useState({});
  const [socketReady, setSocketReady]       = useState(false);
  const [selectedMsg, setSelectedMsg]       = useState(null); // menu contextuel long-press

  // Voix
  const [voiceTimer, setVoiceTimer]         = useState(0);
  const [voiceState, setVoiceState]         = useState("idle"); // idle|recording|paused|preview
  const [voiceSeconds, setVoiceSeconds]     = useState(0);
  const [voiceUrl, setVoiceUrl]             = useState(null);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const mediaRecRef   = useRef(null);
  const chunksRef     = useRef([]);
  const voiceTimerRef = useRef(null);
  const audioPreviewRef = useRef(null);

  const socketRef     = useRef(null);
  const timerRef      = useRef(null);
  const typingTimer   = useRef(null);
  const chatBottomRef = useRef(null);

  const myName = currentUser?.name || "Moi";
  const fmtSecs = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  // ── Init Socket.io ─────────────────────────────────────────
  useEffect(() => {
    // Charger socket.io-client depuis CDN
    const loadSocket = () => {
      const socket = window.io(SERVER_URL, {
        transports: ["websocket", "polling"],
        auth: { userId: currentUser?.id || "guest", name: myName },
      });
      socketRef.current = socket;

      socket.on("connect",    () => { setSocketReady(true);  console.log("🟢 Socket connecté"); });
      socket.on("disconnect", () => { setSocketReady(false); console.log("🔴 Socket déconnecté"); });

      // Message entrant
      socket.on("message", (m) => {
        setLocalMsgs(prev => {
          const next = { ...prev, [m.from]: [...(prev[m.from]||[]), { ...m, isMe: false }] };
          try { localStorage.setItem('ept_msgs', JSON.stringify(next)); } catch{}
          return next;
        });
        // Marquer comme "read" si on est dans cette conv
        setActiveC(cur => {
          if (cur?.name === m.from) {
            socket.emit("msg_status", { msgId: m.id, status: "read", to: m.from });
          }
          return cur;
        });
      });

      // Mise à jour statut (delivered / read)
      socket.on("msg_status", ({ msgId, status }) => {
        setMsgStatus(s => ({ ...s, [msgId]: status }));
      });

      // Indicateur frappe
      socket.on("typing", ({ from, typing }) => {
        setTypingContacts(t => ({ ...t, [from]: typing }));
        if (typing) {
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() =>
            setTypingContacts(t => ({ ...t, [from]: false })), 3000);
        }
      });

      // Statut en ligne
      socket.on("user_online", ({ name, online }) => {
        // On pourrait mettre à jour la liste des contacts ici
      });
    };

    if (window.io) { loadSocket(); }
    else {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.5/socket.io.min.js";
      s.onload = loadSocket;
      document.head.appendChild(s);
    }

    return () => { socketRef.current?.disconnect(); };
  }, []);

  // ── Envoi message texte ────────────────────────────────────
  const addMsg = (contactName, text) => {
    const time  = new Date().toLocaleTimeString("fr", { hour:"2-digit", minute:"2-digit" });
    const msgId = Date.now();
    const m     = { id:msgId, from:myName, text, time, isMe:true, status:"sent" };

    setLocalMsgs(prev => {
      const next = { ...prev, [contactName]: [...(prev[contactName]||[]), m] };
      try { localStorage.setItem('ept_msgs', JSON.stringify(next)); } catch{}
      return next;
    });
    setMsgStatus(s => ({ ...s, [msgId]: "sent" }));

    if (socketReady) {
      // Envoi réel via Socket.io
      socketRef.current.emit("message", { to:contactName, text, msgId });
    } else {
      // Mode démo hors ligne
      if (contactName === "Mamadou Diallo") sendMsg(text);
      setTimeout(() => setMsgStatus(s => ({ ...s, [msgId]: "delivered" })), 600);
      setTimeout(() => setTypingContacts(t => ({ ...t, [contactName]: true })), 1500);
      setTimeout(() => {
        setTypingContacts(t => ({ ...t, [contactName]: false }));
        setMsgStatus(s => ({ ...s, [msgId]: "read" }));
      }, 4000);
    }
  };

  // ── Indicateur frappe sortant ──────────────────────────────
  const onTyping = () => {
    if (!socketReady || !activeC) return;
    socketRef.current.emit("typing", { to: activeC.name, typing: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() =>
      socketRef.current?.emit("typing", { to: activeC.name, typing: false }), 2000);
  };

  // ── Marquer comme lu en ouvrant la conv ───────────────────
  useEffect(() => {
    if (activeC && socketReady) {
      getMsgs(activeC.name).filter(m => !m.isMe && m.id).forEach(m =>
        socketRef.current.emit("msg_status", { msgId:m.id, status:"read", to:activeC.name })
      );
    }
  }, [activeC]);

  // ── Voice recording ────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecRef.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type:"audio/webm" });
        setVoiceUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        setVoiceState("preview");
        clearInterval(voiceTimerRef.current);
      };
      mr.start(100);
      setVoiceState("recording"); setVoiceSeconds(0);
      voiceTimerRef.current = setInterval(() => setVoiceSeconds(s => s+1), 1000);
    } catch { setVoiceSupported(false); }
  };
  const pauseRecording  = () => { mediaRecRef.current?.pause();  clearInterval(voiceTimerRef.current); setVoiceState("paused"); };
  const resumeRecording = () => {
    mediaRecRef.current?.resume();
    voiceTimerRef.current = setInterval(() => setVoiceSeconds(s => s+1), 1000);
    setVoiceState("recording");
  };
  const stopRecording   = () => { clearInterval(voiceTimerRef.current); mediaRecRef.current?.stop(); };
  const cancelRecording = () => {
    clearInterval(voiceTimerRef.current);
    if (mediaRecRef.current?.state !== "inactive") {
      mediaRecRef.current.ondataavailable = null;
      mediaRecRef.current.onstop = null;
      mediaRecRef.current.stop();
    }
    setVoiceState("idle"); setVoiceSeconds(0);
    if (voiceUrl) { URL.revokeObjectURL(voiceUrl); setVoiceUrl(null); }
  };
  const sendVoiceMsg = (contactName) => {
    if (!voiceUrl) return;
    const dur   = fmtSecs(voiceSeconds);
    const msgId = Date.now();
    const time  = new Date().toLocaleTimeString("fr", { hour:"2-digit", minute:"2-digit" });
    const m     = { id:msgId, from:myName, text:"", time, isMe:true, status:"sent", isVoice:true, voiceUrl, voiceDur:dur };
    setLocalMsgs(prev => ({ ...prev, [contactName]: [...(prev[contactName]||[]), m] }));
    setMsgStatus(s => ({ ...s, [msgId]: "sent" }));
    // Note: upload audio via Socket en étape suivante
    setTimeout(() => setMsgStatus(s => ({ ...s, [msgId]: "delivered" })), 500);
    setTimeout(() => { setTypingContacts(t=>({...t,[contactName]:true})); }, 1200);
    setTimeout(() => { setTypingContacts(t=>({...t,[contactName]:false})); setMsgStatus(s=>({...s,[msgId]:"read"})); }, 3800);
    setVoiceState("idle"); setVoiceSeconds(0); setVoiceUrl(null);
  };

  // ── Appel voix (conservé pour l'étape suivante) ────────────
  const startVoice = () => { setVoiceOn(true); setVoiceTimer(0); timerRef.current = setInterval(() => setVoiceTimer(t=>t+1), 1000); };
  const endVoice   = () => { setVoiceOn(false); clearInterval(timerRef.current); setVoiceTimer(0); };
  const fmtTime    = fmtSecs;

  useEffect(() => {
    if (activeChatContact?.name) {
      const existing = DEFAULT_CONTACTS.find(c => c.name === activeChatContact.name);
      setActiveC(existing || { ...activeChatContact, initials: activeChatContact.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() });
    }
  }, [activeChatContact?.name]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [localMsgs, activeC]);

  const getMsgs = (name) => {
    const base = name === "Mamadou Diallo" ? msgs.map(m => ({ ...m, status:m.isMe?"read":undefined })) : [];
    return [...base, ...(localMsgs[name]||[])];
  };

  // ── LISTE DES CONVERSATIONS ────────────────────────────────
  const realNames = Object.keys(localMsgs).filter(n => n && !DEFAULT_CONTACTS.find(d => d.name === n));
  const allContacts = [...DEFAULT_CONTACTS, ...realNames.map(n => ({ name:n, online:true, initials:n.split(" ").map(w=>w[0]).join("").slice(0,2) }))];

  if (!activeC) return (
    <>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }}
          onClick={()=>setTab?.(prevTab&&prevTab!=="chat"?prevTab:"home")}>←</button>
        <p style={{ ...css.title, marginBottom:0, flex:1 }}>Messages 💬</p>
        {/* Indicateur connexion Socket */}
        <div title={socketReady?"Temps réel actif":"Mode hors ligne"}
          style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:socketReady?"#00E676":"#607080" }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:socketReady?"#00E676":"#607080" }} />
          {socketReady?"En direct":"Hors ligne"}
        </div>
      </div>

      {allContacts.map(c => {
        const allMsgs = getMsgs(c.name);
        const last    = allMsgs[allMsgs.length-1];
        const unread  = allMsgs.filter(m => !m.isMe && !m.read).length;
        return (
          <div key={c.name} style={{ background:"#122236", borderRadius:14, padding:14, marginBottom:10, display:"flex", alignItems:"center", gap:12, border:"1px solid #1e3a52", cursor:"pointer" }}
            onClick={()=>setActiveC(c)}>
            <div style={{ position:"relative" }}>
              <div style={{ width:50, height:50, borderRadius:"50%", background:getColor(c.name), display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16, color:"#fff" }}>
                {c.name.split(" ").map(w=>w[0]).join("").slice(0,2)}
              </div>
              <div style={{ position:"absolute", bottom:1, right:1, width:12, height:12, borderRadius:"50%", background:c.online?"#00E676":"#607080", border:"2px solid #122236" }} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:14, color:"#E8F0FE" }}>{c.name}</div>
              <div style={{ fontSize:12, color:"#90A4AE", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {last?.isVoice?"🎙 Message vocal":last?.text?.slice(0,40)||"Démarrer la conversation"}{last?.text?.length>40?"...":""}
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
              <div style={{ fontSize:11, color:"#607080" }}>{last?.time||""}</div>
              {unread>0 && <div style={{ width:18, height:18, borderRadius:"50%", background:C.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"#fff" }}>{unread}</div>}
            </div>
          </div>
        );
      })}
    </>
  );

  // ── FENÊTRE DE CHAT ────────────────────────────────────────
  const cMsgs   = getMsgs(activeC.name);
  const bg      = getColor(activeC.name);
  const initials= activeC.initials||activeC.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 140px)" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, padding:"10px 0" }}>
        <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }}
          onClick={()=>{ setActiveC(null); setActiveChatContact?.(null); }}>←</button>
        <div style={{ width:42, height:42, borderRadius:"50%", background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:15, color:"#fff", flexShrink:0 }}>{initials}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:15, color:"#E8F0FE" }}>{activeC.name}</div>
          <div style={{ fontSize:11, color:voiceOn?"#EF5350":activeC.online?"#00E676":"#607080" }}>
            {voiceOn?"🔴 Appel en cours...":activeC.online?"En ligne":"Hors ligne"}
          </div>
        </div>
        <button style={{ background:"#1e3a52", border:"none", borderRadius:10, padding:"9px 12px", cursor:"pointer", fontSize:18 }}
          onClick={voiceOn?endVoice:startVoice}>{voiceOn?"📴":"📞"}</button>
        <button style={{ background:"#1e3a52", border:"none", borderRadius:10, padding:"9px 12px", cursor:"pointer", fontSize:18 }}>📹</button>
      </div>

      {/* Appel vocal actif */}
      {voiceOn && (
        <div style={{ background:"#0D47A1", borderRadius:14, padding:20, textAlign:"center", marginBottom:12 }}>
          <div style={{ fontSize:40 }}>📞</div>
          <div style={{ fontWeight:800, color:"#fff", fontSize:15, marginTop:8 }}>Appel avec {activeC.name.split(" ")[0]}</div>
          <div style={{ fontFamily:"monospace", fontSize:24, color:"#FFB800", marginTop:6 }}>{fmtTime(voiceTimer)}</div>
          <div style={{ display:"flex", gap:16, justifyContent:"center", marginTop:14 }}>
            {[{i:"🔇",l:"Muet"},{i:"🔊",l:"HP"},{i:"📷",l:"Caméra"}].map(b=>(
              <div key={b.l} style={{ textAlign:"center" }}>
                <button style={{ width:52, height:52, borderRadius:"50%", background:"rgba(255,255,255,.15)", border:"none", fontSize:22, cursor:"pointer" }}>{b.i}</button>
                <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", marginTop:4 }}>{b.l}</div>
              </div>
            ))}
            <div style={{ textAlign:"center" }}>
              <button style={{ width:52, height:52, borderRadius:"50%", background:"#EF5350", border:"none", fontSize:22, cursor:"pointer" }} onClick={endVoice}>📴</button>
              <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", marginTop:4 }}>Fin</div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", padding:"4px 0", marginBottom:8 }}>
        {cMsgs.length===0 && (
          <div style={{ textAlign:"center", color:"#607080", padding:"40px 0", fontSize:13 }}>
            Démarrez la conversation avec {activeC.name.split(" ")[0]} 👋
          </div>
        )}
        {cMsgs.map((m,i) => {
          const status    = m.isMe ? (msgStatus[m.id]||m.status||"sent") : null;
          const checkmark = status==="read"      ? <span style={{ color:"#1E88E5", fontSize:11, marginLeft:3 }}>✓✓</span>
                          : status==="delivered" ? <span style={{ color:"#607080", fontSize:11, marginLeft:3 }}>✓✓</span>
                          : status==="sent"      ? <span style={{ color:"#607080", fontSize:11, marginLeft:3 }}>✓</span> : null;
          return (
            <div key={m.id||i} style={{ display:"flex", justifyContent:m.isMe?"flex-end":"flex-start", gap:8, alignItems:"flex-end", marginBottom:8 }}>
              {!m.isMe && <div style={{ width:28, height:28, borderRadius:"50%", background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:10, color:"#fff", flexShrink:0 }}>{initials}</div>}
              <div style={{ background:m.isMe?"#1E88E5":"#1e3a52", borderRadius:m.isMe?"14px 14px 2px 14px":"14px 14px 14px 2px", padding:"10px 14px", maxWidth:"74%", fontSize:13, color:"#E8F0FE", lineHeight:1.5 }}>
                {m.isVoice ? (
                  <div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,.7)", marginBottom:4 }}>🎙 {m.voiceDur}</div>
                    <audio src={m.voiceUrl} controls style={{ width:"100%", height:32, borderRadius:6 }} />
                  </div>
                ) : m.text}
                <div style={{ fontSize:10, color:"rgba(255,255,255,.45)", marginTop:4, textAlign:"right", display:"flex", alignItems:"center", justifyContent:"flex-end" }}>
                  <span>{m.time}</span>{checkmark}
                </div>
              </div>
            </div>
          );
        })}
        {/* Indicateur frappe */}
        {typingContacts[activeC.name] && (
          <div style={{ display:"flex", alignItems:"flex-end", gap:8, marginBottom:8 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:10, color:"#fff", flexShrink:0 }}>{initials}</div>
            <div style={{ background:"#1e3a52", borderRadius:"14px 14px 14px 2px", padding:"10px 16px" }}>
              <span style={{ display:"inline-flex", gap:3, alignItems:"center" }}>
                {[0,.2,.4].map(d => <span key={d} style={{ width:6, height:6, borderRadius:"50%", background:"#90A4AE", display:"inline-block", animation:`typingDot 1.2s infinite ${d}s` }} />)}
              </span>
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* UI enregistrement vocal */}
      {voiceState==="recording" && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"#EF535015", borderRadius:14, border:"1px solid #EF535044", marginBottom:8 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#EF5350", animation:"pulse 1s infinite", flexShrink:0 }} />
          <span style={{ fontSize:13, color:"#EF5350", fontWeight:700, flex:1 }}>🎙 {fmtSecs(voiceSeconds)}</span>
          <button style={{ background:"#1e3a52", border:"none", borderRadius:8, padding:"6px 12px", color:"#FFB800", fontWeight:700, fontSize:13, cursor:"pointer" }} onClick={pauseRecording}>⏸</button>
          <button style={{ background:"#EF5350", border:"none", borderRadius:8, padding:"6px 12px", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }} onClick={stopRecording}>⏹</button>
          <button style={{ background:"none", border:"none", color:"#607080", fontSize:18, cursor:"pointer" }} onClick={cancelRecording}>✕</button>
        </div>
      )}
      {voiceState==="paused" && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"#FFB80015", borderRadius:14, border:"1px solid #FFB80044", marginBottom:8 }}>
          <span style={{ fontSize:18 }}>⏸</span>
          <span style={{ fontSize:13, color:"#FFB800", fontWeight:700, flex:1 }}>Pause — {fmtSecs(voiceSeconds)}</span>
          <button style={{ background:"#00E676", border:"none", borderRadius:8, padding:"6px 12px", color:"#000", fontWeight:700, fontSize:13, cursor:"pointer" }} onClick={resumeRecording}>▶</button>
          <button style={{ background:"#1E88E5", border:"none", borderRadius:8, padding:"6px 12px", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }} onClick={stopRecording}>⏹</button>
          <button style={{ background:"none", border:"none", color:"#607080", fontSize:18, cursor:"pointer" }} onClick={cancelRecording}>✕</button>
        </div>
      )}
      {voiceState==="preview" && voiceUrl && (
        <div style={{ background:"#1E88E522", borderRadius:14, border:"1px solid #1E88E544", padding:"12px 14px", marginBottom:8 }}>
          <div style={{ fontSize:11, color:"#90A4AE", marginBottom:6, fontWeight:700 }}>🎙 {fmtSecs(voiceSeconds)} — Écouter avant envoi :</div>
          <audio ref={audioPreviewRef} src={voiceUrl} controls style={{ width:"100%", height:34, marginBottom:8, borderRadius:8 }} />
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ flex:2, background:"linear-gradient(135deg,#1E88E5,#0D47A1)", border:"none", borderRadius:10, padding:"10px 0", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}
              onClick={()=>sendVoiceMsg(activeC.name)}>➤ Envoyer</button>
            <button style={{ flex:1, background:"#1e3a52", border:"none", borderRadius:10, padding:"10px 0", color:"#90A4AE", fontWeight:700, fontSize:13, cursor:"pointer" }} onClick={cancelRecording}>✕</button>
          </div>
        </div>
      )}
      {!voiceSupported && <div style={{ fontSize:12, color:C.red, padding:"6px 10px", background:"#EF535011", borderRadius:8, marginBottom:8 }}>⚠️ Micro non autorisé</div>}

      {/* Barre de saisie */}
      <div style={{ display:"flex", gap:8, padding:"10px 0", borderTop:"1px solid #1e3a52" }}>
        <button style={{ background:voiceState!=="idle"?"#EF535033":"#1e3a52", border:"none", borderRadius:10, padding:"10px 12px", cursor:"pointer", fontSize:18, color:voiceState==="recording"?"#EF5350":voiceState==="paused"?"#FFB800":"#90A4AE" }}
          onClick={voiceState==="idle"?startRecording:voiceState==="recording"?pauseRecording:voiceState==="paused"?resumeRecording:cancelRecording}>
          {voiceState==="recording"?"🔴":voiceState==="paused"?"⏸":voiceState==="preview"?"✕":"🎙"}
        </button>
        <button style={{ background:"#1e3a52", border:"none", borderRadius:10, padding:"10px 12px", cursor:"pointer", fontSize:18, color:"#90A4AE" }}>📎</button>
        <input style={{ flex:1, background:"#0a1520", border:"1px solid #1e3a52", borderRadius:20, padding:"10px 16px", color:"#E8F0FE", fontSize:14, outline:"none", fontFamily:"inherit" }}
          placeholder={`Message à ${activeC.name.split(" ")[0]}…`}
          value={newMsg} onChange={e=>{ setNewMsg(e.target.value); onTyping(); }}
          onKeyDown={e=>{ if(e.key==="Enter"&&newMsg.trim()){ addMsg(activeC.name, newMsg.trim()); setNewMsg(""); } }} />
        <button style={{ background:"linear-gradient(135deg,#1E88E5,#0D47A1)", border:"none", borderRadius:10, padding:"10px 16px", cursor:"pointer", fontSize:18, color:"#fff" }}
          onClick={()=>{ if(newMsg.trim()){ addMsg(activeC.name, newMsg.trim()); setNewMsg(""); } }}>➤</button>
      </div>
    </div>
  );
}



function TechsTab({ users, searchQ, setSearchQ, selUser, setSelUser, setTab, toast$, myRatings, setMyRatings, openChat, onlineFilter, setOnlineFilter, viewProfileUser, setViewProfileUser }) {
  // Auto-select the profile to view if passed from HomeTab
  useEffect(() => {
    if (viewProfileUser) {
      setSelUser(viewProfileUser);
      setViewProfileUser?.(null);
    }
  }, [viewProfileUser]);
  return <>
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
      <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }} onClick={()=>{ setOnlineFilter?.(false); setTab("home"); }}>←</button>
      <p style={{ ...css.title, marginBottom:0 }}>
        {onlineFilter ? "🟢 En ligne" : "Techniciens"} ({users.length})
      </p>
      {onlineFilter && (
        <button style={{ background:"#00E67622", border:"1px solid #00E67644", borderRadius:20, padding:"4px 12px", color:"#00E676", fontWeight:700, fontSize:11, cursor:"pointer" }} onClick={()=>setOnlineFilter?.(false)}>
          ✕ Filtre en ligne
        </button>
      )}
    </div>
    <input style={{ ...css.input, marginBottom:16 }} placeholder="🔍 Quel service recherchez-vous ? Électricien, plombier, ménagère..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
    {[...users].map(u=>(
      <div key={u.id} style={{ ...css.card, marginBottom:10 }}>
        <div style={{ display:"flex", gap:12 }}>
          <Av initials={u.avatar||"??"} bg={getColor(u.name)} size={54} online={u.online} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:15 }}>{u.name}</div>
            <div style={{ fontSize:12, color:C.sub }}>📍 {u.city||"—"} · {u.exp} ans d'exp.</div>
            {u.rating>0&&<div style={{ color:"#FFB800", fontSize:13, marginTop:2 }}>{"★".repeat(Math.floor(u.rating))}<span style={{ color:C.sub, fontSize:11, marginLeft:4 }}>{u.rating}/5</span></div>}
            <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
              {u.skills?.map(sk=><Chip key={sk} label={sk} color={C.accent} />)}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
          <button style={{ ...css.btn(C.accent), flex:1, padding:"8px 0", fontSize:13 }} onClick={()=>setSelUser(selUser?.id===u.id?null:u)}>{selUser?.id===u.id?"Fermer ↑":"Voir profil"}</button>
          <button style={{ ...css.btn("#00E67611"), flex:1, padding:"8px 0", fontSize:13, border:"1px solid #00E67633", color:C.green }} onClick={()=>openChat?.(u.name, u.online)}>💬 Contacter</button>
          <button style={{ ...css.btn("#6A1B9A11"), flex:1, padding:"8px 0", fontSize:13, border:"1px solid #6A1B9A33", color:"#BA68C8" }} onClick={()=>toast$("Appel en cours... 📞")}>📞 Appeler</button>
        </div>
        {selUser?.id===u.id&&(
          <div style={{ marginTop:14, padding:14, background:"#0a1520", borderRadius:10 }}>
            <div style={{ fontSize:13, lineHeight:1.9, color:C.sub }}>
              <div>🎓 <strong style={{ color:C.text }}>Expérience :</strong> {u.exp} ans</div>
              <div>🏆 <strong style={{ color:C.text }}>Missions :</strong> {u.jobs}</div>
              <div>⭐ <strong style={{ color:C.text }}>Note :</strong> {u.rating>0?`${u.rating}/5`:"Pas encore noté"}</div>
              <div>📍 <strong style={{ color:C.text }}>Localisation :</strong> {u.city||"—"}</div>
              <div>🔧 <strong style={{ color:C.text }}>Spécialités :</strong> {u.skills?.join(", ")||"—"}</div>
              <div style={{ marginTop:10, padding:"10px 12px", background:"#122236", borderRadius:8 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:4 }}>📄 Résumé professionnel</div>
                <div style={{ fontSize:12 }}>Professionnel avec {u.exp} ans d'expérience en {u.skills?.[0]||"services"}. Disponible rapidement.</div>
              </div>
            </div>
            <div style={{ marginTop:12, padding:"10px 12px", background:"#122236", borderRadius:8 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:8 }}>⭐ Donner une note</div>
              <div style={{ display:"flex", gap:6 }}>
                {[1,2,3,4,5].map(star=>(
                  <button key={star} style={{ background:"none", border:"none", cursor:"pointer", fontSize:26, color:(myRatings[u.id]||0)>=star?"#FFB800":"#2a3a4a" }}
                    onClick={()=>{ setMyRatings(r=>({...r,[u.id]:star})); toast$(`Note ${star}/5 envoyée ⭐`); }}>★</button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <button style={{ ...css.btn(C.gold), flex:1, padding:"8px 0", fontSize:12 }} onClick={()=>toast$("Téléchargement CV... 📄")}>📋 Télécharger CV</button>
              <button style={{ ...css.btn(C.red), flex:1, padding:"8px 0", fontSize:12 }} onClick={()=>toast$("Signalement envoyé à l'admin")}>🚩 Signaler</button>
            </div>
          </div>
        )}
      </div>
    ))}
    {users.length===0&&<div style={{ textAlign:"center", color:C.sub, padding:"40px 0", fontSize:14 }}>Aucun technicien trouvé 🔍</div>}
  </>;
}

function ProfileTab({ currentUser, doLogout, toast$, openChat, setTab }) {
  // ── Charger les données sauvegardées ──────────────────────────
  const getSaved = (key, fallback, isJson=true) => {
    try {
      const v = localStorage.getItem(key);
      if (!v) return fallback;
      return isJson ? JSON.parse(v) : v;
    } catch { return fallback; }
  };
  const savedProfile = getSaved("ept_profile", {});

  const [editing, setEditing]         = useState(false);
  const [form, setForm]               = useState({
    name: currentUser?.name  || savedProfile.name  || "Mon Profil",
    city: currentUser?.city  || savedProfile.city  || "Ma ville",
    bio:  currentUser?.bio   || savedProfile.bio   || "Décrivez votre expérience ici...",
    phone:currentUser?.phone || savedProfile.phone || "",
    exp:  currentUser?.exp   || savedProfile.exp   || "0",
  });
  const [cvName, setCvName]           = useState(getSaved("ept_cv_name", null, false));
  const [photoUrl, setPhotoUrl]       = useState(getSaved("ept_photo", null, false));
  const [location, setLocation]       = useState(() => { try { const l = localStorage.getItem("ept_location"); return l ? JSON.parse(l) : null; } catch { return null; } });
  const [locLoading, setLocLoading]   = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifPrefs, setNotifPrefs]   = useState(() => { try { const n = localStorage.getItem("ept_notifs"); return n ? JSON.parse(n) : { messages:true, missions:true, offres:true, alertes:true }; } catch { return { messages:true, missions:true, offres:true, alertes:true }; } });
  const [passwords, setPasswords]     = useState({ current:"", newp:"", confirm:"" });
  const [showPw, setShowPw]           = useState(false);
  const fileInputRef                  = useRef(null);
  const photoInputRef                 = useRef(null);

  // Calcul complétion profil
  const completion = Math.min(100, [
    form.name !== "Mon Profil", form.city !== "Ma ville",
    form.bio !== "Décrivez votre expérience ici...",
    !!form.phone, !!cvName, !!photoUrl, !!location, +form.exp > 0,
  ].filter(Boolean).length * 13);

  // ── UPLOAD CV ──────────────────────────────────────────────
  const handleCVUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      toast$("Seuls les fichiers PDF sont acceptés", true); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast$("Fichier trop grand (max 5 MB)", true); return;
    }
    setCvName(file.name);
    try { localStorage.setItem("ept_cv_name", file.name); } catch(e) {}
    toast$(`CV "${file.name}" uploadé avec succès ! 📄`);
  };

  // ── UPLOAD PHOTO ───────────────────────────────────────────
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast$("Sélectionnez une image (JPG, PNG...)", true); return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoUrl(ev.target.result);
      try { localStorage.setItem("ept_photo", ev.target.result); } catch(e) {}
      toast$("Photo de profil mise à jour ! 📸");
    };
    reader.readAsDataURL(file);
  };

  // ── LOCALISATION GPS ───────────────────────────────────────
  const handleLocation = () => {
    if (!navigator.geolocation) {
      toast$("Géolocalisation non supportée sur ce navigateur", true); return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const d = await r.json();
          const ville = d.address?.city || d.address?.town || d.address?.village || "Votre position";
          setLocation({ lat: latitude, lng: longitude, ville });
          setForm(f => {
            const nf = { ...f, city: ville };
            try { localStorage.setItem("ept_profile", JSON.stringify(nf)); } catch(e) {}
            return nf;
          });
          toast$(`📍 Position détectée : ${ville}`);
        } catch {
          setLocation({ lat: latitude, lng: longitude, ville: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` });
          toast$("📍 Position GPS enregistrée !");
        }
        setLocLoading(false);
      },
      (err) => {
        setLocLoading(false);
        const msgs = { 1:"Permission refusée. Autorisez la localisation.", 2:"Position introuvable.", 3:"Délai dépassé." };
        toast$(msgs[err.code] || "Erreur de localisation", true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── CHANGER MOT DE PASSE ───────────────────────────────────
  const handleChangePassword = async () => {
    if (!passwords.newp || passwords.newp.length < 6) {
      toast$("Nouveau mot de passe trop court (6 min.)", true); return;
    }
    if (passwords.newp !== passwords.confirm) {
      toast$("Les mots de passe ne correspondent pas", true); return;
    }
    const hasSupabase = typeof SUPABASE_ANON !== "undefined" && SUPABASE_ANON !== "REMPLACEZ_PAR_VOTRE_PUBLISHABLE_KEY";
    if (hasSupabase) {
      try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          method: "PUT",
          headers: { "Content-Type":"application/json", "apikey":SUPABASE_ANON },
          body: JSON.stringify({ password: passwords.newp }),
        });
        if (r.ok) { toast$("Mot de passe mis à jour ✓"); setShowPassModal(false); setPasswords({ current:"", newp:"", confirm:"" }); }
        else toast$("Erreur lors du changement", true);
      } catch { toast$("Erreur réseau", true); }
    } else {
      // Mode démo
      toast$("Mot de passe mis à jour ✓");
      setShowPassModal(false);
      setPasswords({ current:"", newp:"", confirm:"" });
    }
  };

  const initials = form.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() || "??";

  return <>
    {/* ── MODAL MOT DE PASSE ── */}
    {showPassModal && (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
        <div style={{ ...css.card, width:"100%", maxWidth:380, margin:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <span style={{ fontWeight:800, fontSize:16 }}>🔒 Changer le mot de passe</span>
            <button style={{ background:"none", border:"none", color:C.sub, fontSize:20, cursor:"pointer" }} onClick={()=>setShowPassModal(false)}>✕</button>
          </div>
          <label style={css.label}>Nouveau mot de passe *</label>
          <div style={{ position:"relative", marginBottom:12 }}>
            <input style={{ ...css.input, paddingRight:44 }} type={showPw?"text":"password"} placeholder="Minimum 6 caractères" value={passwords.newp} onChange={e=>setPasswords(p=>({...p,newp:e.target.value}))} />
            <button style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.sub, cursor:"pointer", fontSize:16 }} onClick={()=>setShowPw(v=>!v)}>{showPw?"🙈":"👁️"}</button>
          </div>
          <label style={css.label}>Confirmer le mot de passe *</label>
          <input style={{ ...css.input, marginBottom:16, borderColor: passwords.confirm && passwords.newp !== passwords.confirm ? C.red : C.border }} type="password" placeholder="Répétez le mot de passe" value={passwords.confirm} onChange={e=>setPasswords(p=>({...p,confirm:e.target.value}))} />
          {passwords.confirm && passwords.newp !== passwords.confirm && (
            <div style={{ fontSize:12, color:C.red, marginBottom:12 }}>⚠️ Les mots de passe ne correspondent pas</div>
          )}
          <div style={{ display:"flex", gap:10 }}>
            <button style={{ ...css.btn(C.green), flex:2, padding:"12px 0" }} onClick={handleChangePassword}>✓ Confirmer</button>
            <button style={{ ...css.btn("#1e3a52"), flex:1, border:`1px solid ${C.border}` }} onClick={()=>setShowPassModal(false)}>Annuler</button>
          </div>
        </div>
      </div>
    )}

    {/* ── MODAL NOTIFICATIONS ── */}
    {showNotifModal && (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
        <div style={{ ...css.card, width:"100%", maxWidth:380, margin:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <span style={{ fontWeight:800, fontSize:16 }}>🔔 Notifications</span>
            <button style={{ background:"none", border:"none", color:C.sub, fontSize:20, cursor:"pointer" }} onClick={()=>setShowNotifModal(false)}>✕</button>
          </div>
          {[
            { key:"messages", label:"💬 Nouveaux messages",    desc:"Quand quelqu'un vous envoie un message" },
            { key:"missions", label:"💼 Nouvelles missions",   desc:"Offres correspondant à vos compétences" },
            { key:"offres",   label:"📢 Offres d'emploi",      desc:"Nouvelles annonces dans votre ville" },
            { key:"alertes",  label:"⚠️ Alertes de sécurité",  desc:"Connexions et activités suspectes" },
          ].map(n => (
            <div key={n.key} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:13 }}>{n.label}</div>
                <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>{n.desc}</div>
              </div>
              <div style={{ width:44, height:24, borderRadius:12, background:notifPrefs[n.key]?C.green:"#1e3a52", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}
                onClick={()=>setNotifPrefs(p=>({...p,[n.key]:!p[n.key]}))}>
                <div style={{ position:"absolute", top:2, left:notifPrefs[n.key]?20:2, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
              </div>
            </div>
          ))}
          <button style={{ ...css.btn(C.accent), width:"100%", padding:"12px 0", marginTop:16 }} onClick={()=>{ setShowNotifModal(false); toast$("Préférences de notification sauvegardées ✓"); }}>
            ✓ Sauvegarder
          </button>
        </div>
      </div>
    )}

    {/* ── INPUTS CACHÉS ── */}
    <input ref={fileInputRef}  type="file" accept=".pdf,application/pdf" style={{ display:"none" }} onChange={handleCVUpload} />
    <input ref={photoInputRef} type="file" accept="image/*"              style={{ display:"none" }} onChange={handlePhotoUpload} />

    {/* ── AVATAR ── */}
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
      <button style={{ background:"#1e3a52", border:"none", color:"#E8F0FE", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:16, fontWeight:700 }} onClick={()=>setTab?.("home")}>←</button>
      <p style={{ ...css.title, marginBottom:0, flex:1 }}>Mon Profil</p>
    </div>
    <div style={{ textAlign:"center", marginBottom:20 }}>
      <div style={{ position:"relative", display:"inline-block" }}>
        {photoUrl
          ? <img src={photoUrl} alt="profil" style={{ width:84, height:84, borderRadius:"50%", objectFit:"cover", border:"3px solid #1E88E5" }} />
          : <Av initials={initials} bg="#1565C0" size={84} online />
        }
        <button style={{ position:"absolute", bottom:0, right:0, width:28, height:28, borderRadius:"50%", background:C.accent, border:"2px solid #0d1b2a", cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={()=>photoInputRef.current?.click()}>📸</button>
      </div>
      <h2 style={{ fontFamily:"Georgia,serif", fontSize:20, margin:"10px 0 2px" }}>{form.name}</h2>
      <p style={{ color:C.sub, fontSize:13, margin:0 }}>{currentUser?.email||"utilisateur@email.com"}</p>
      {location && <p style={{ color:C.green, fontSize:12, margin:"4px 0 0" }}>📍 {location.ville}</p>}
    </div>

    {/* ── BARRE COMPLÉTION ── */}
    <div style={css.card}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ fontSize:13, fontWeight:700 }}>Profil complété</span>
        <span style={{ fontSize:13, fontWeight:800, color:completion>=80?C.green:C.gold }}>{completion}%</span>
      </div>
      <div style={{ background:"#0a1520", borderRadius:99, height:10 }}>
        <div style={{ background:`linear-gradient(90deg,#1E88E5,${completion>=80?"#00E676":"#FFB800"})`, borderRadius:99, height:10, width:`${completion}%`, transition:"width .6s" }} />
      </div>
      <div style={{ fontSize:11, color:C.sub, marginTop:8 }}>
        {completion < 100 ? `Encore ${100-completion}% — ajoutez ${!cvName?"votre CV":!photoUrl?"une photo":!location?"votre GPS":"plus d'infos"}` : "✅ Profil 100% complet !"}
      </div>
    </div>

    {/* ── FORMULAIRE INFOS ── */}
    {editing ? (
      <div style={css.card}>
        <p style={{ fontWeight:800, fontSize:15, marginBottom:14, color:C.accent }}>✏️ Modifier mon profil</p>
        <label style={css.label}>Nom complet</label>
        <input style={{ ...css.input, marginBottom:10 }} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
        <label style={css.label}>Téléphone</label>
        <input style={{ ...css.input, marginBottom:10 }} type="tel" placeholder="+237 6XX XXX XXX" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} />
        <label style={css.label}>Ville</label>
        <input style={{ ...css.input, marginBottom:10 }} placeholder="Ex: Douala" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} />
        <label style={css.label}>Années d'expérience</label>
        <input style={{ ...css.input, marginBottom:10 }} type="number" min="0" value={form.exp} onChange={e=>setForm(f=>({...f,exp:e.target.value}))} />
        <label style={css.label}>Bio / Présentation</label>
        <textarea style={{ ...css.input, resize:"vertical", minHeight:90, marginBottom:14 }} value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} />
        <div style={{ display:"flex", gap:10 }}>
          <button style={{ ...css.btn(C.green), flex:2, padding:"12px 0" }} onClick={async ()=>{
            setEditing(false);
            try { localStorage.setItem("ept_profile", JSON.stringify(form)); } catch(e) {}
            // Sauvegarder dans Supabase
            if (currentUser?.id && currentUser?.token) {
              try {
                await sb.update("profiles", { id: currentUser.id }, {
                  name: form.name,
                  phone: form.phone,
                  city: form.city,
                  exp: parseInt(form.exp) || 0,
                  bio: form.bio,
                }, currentUser.token);
              } catch(e) { console.error("Erreur sauvegarde profil", e); }
            }
            toast$("Profil mis à jour ✓");
          }}>✓ Sauvegarder</button>
          <button style={{ ...css.btn("#1e3a52"), flex:1, border:`1px solid ${C.border}` }} onClick={()=>setEditing(false)}>Annuler</button>
        </div>
      </div>
    ) : (
      <div style={css.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontWeight:800, fontSize:15 }}>Informations</span>
          <button style={{ background:"none", border:"none", color:C.accent, cursor:"pointer", fontWeight:700, fontSize:13 }} onClick={()=>setEditing(true)}>✏️ Modifier</button>
        </div>
        {[
          { icon:"👤", label:"Nom",         value:form.name },
          { icon:"📞", label:"Téléphone",   value:form.phone||"Non renseigné" },
          { icon:"📍", label:"Ville",       value:form.city },
          { icon:"🎓", label:"Expérience",  value:`${form.exp} ans` },
          { icon:"📧", label:"Email",       value:currentUser?.email||"—" },
        ].map(r=>(
          <div key={r.label} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontSize:16 }}>{r.icon}</span>
            <span style={{ color:C.sub, fontSize:12, width:80 }}>{r.label}</span>
            <span style={{ color:C.text, fontSize:13, fontWeight:600, flex:1 }}>{r.value}</span>
          </div>
        ))}
        {form.bio && form.bio !== "Décrivez votre expérience ici..." && (
          <div style={{ marginTop:10, fontSize:13, color:C.sub, lineHeight:1.7 }}>📝 {form.bio}</div>
        )}
      </div>
    )}

    {/* ── CV UPLOADÉ ── */}
    {cvName && (
      <div style={{ ...css.card, border:`1px solid ${C.gold}44`, display:"flex", alignItems:"center", gap:12 }}>
        <span style={{ fontSize:28 }}>📄</span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:13, color:C.gold }}>CV uploadé ✓</div>
          <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>{cvName}</div>
        </div>
        <button style={{ ...css.btn(C.red), padding:"6px 12px", fontSize:12 }} onClick={()=>{ setCvName(null); try{localStorage.removeItem("ept_cv_name");}catch(e){} toast$("CV supprimé"); }}>✕</button>
      </div>
    )}

    {/* ── ACTIONS ── */}
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

      {/* Upload CV */}
      <div style={{ ...css.card, display:"flex", alignItems:"center", gap:12, marginBottom:0, cursor:"pointer", padding:"14px 16px", border:`1px solid ${cvName?C.gold+"44":C.border}` }}
        onClick={()=>fileInputRef.current?.click()}>
        <span style={{ fontSize:22 }}>📄</span>
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:600, fontSize:14, display:"block" }}>{cvName?"Remplacer mon CV":"Uploader mon CV (PDF)"}</span>
          {cvName
            ? <span style={{ fontSize:11, color:C.gold }}>✓ {cvName}</span>
            : <span style={{ fontSize:11, color:C.sub }}>Format PDF · Max 5 MB</span>
          }
        </div>
        <span style={{ color:cvName?C.gold:C.sub, fontSize:18 }}>{cvName?"✓":"+"}</span>
      </div>

      {/* Photo profil */}
      <div style={{ ...css.card, display:"flex", alignItems:"center", gap:12, marginBottom:0, cursor:"pointer", padding:"14px 16px", border:`1px solid ${photoUrl?C.green+"44":C.border}` }}
        onClick={()=>photoInputRef.current?.click()}>
        <span style={{ fontSize:22 }}>📸</span>
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:600, fontSize:14, display:"block" }}>{photoUrl?"Changer la photo":"Ajouter une photo de profil"}</span>
          <span style={{ fontSize:11, color:C.sub }}>JPG, PNG · Apparaît sur votre profil</span>
        </div>
        <span style={{ color:photoUrl?C.green:C.sub, fontSize:18 }}>{photoUrl?"✓":"+"}</span>
      </div>

      {/* Mot de passe */}
      <div style={{ ...css.card, display:"flex", alignItems:"center", gap:12, marginBottom:0, cursor:"pointer", padding:"14px 16px" }}
        onClick={()=>setShowPassModal(true)}>
        <span style={{ fontSize:22 }}>🔒</span>
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:600, fontSize:14, display:"block" }}>Changer le mot de passe</span>
          <span style={{ fontSize:11, color:C.sub }}>Sécurisez votre compte</span>
        </div>
        <span style={{ color:C.sub }}>›</span>
      </div>

      {/* Notifications */}
      <div style={{ ...css.card, display:"flex", alignItems:"center", gap:12, marginBottom:0, cursor:"pointer", padding:"14px 16px" }}
        onClick={()=>setShowNotifModal(true)}>
        <span style={{ fontSize:22 }}>🔔</span>
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:600, fontSize:14, display:"block" }}>Préférences de notification</span>
          <span style={{ fontSize:11, color:C.sub }}>
            {Object.values(notifPrefs).filter(Boolean).length}/4 activées
          </span>
        </div>
        <span style={{ color:C.sub }}>›</span>
      </div>

      {/* GPS */}
      <div style={{ ...css.card, display:"flex", alignItems:"center", gap:12, marginBottom:0, cursor:"pointer", padding:"14px 16px", border:`1px solid ${location?C.green+"44":C.border}` }}
        onClick={handleLocation}>
        <span style={{ fontSize:22 }}>{locLoading?"⏳":"📍"}</span>
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:600, fontSize:14, display:"block" }}>{locLoading?"Détection en cours...":"Ma localisation GPS"}</span>
          <span style={{ fontSize:11, color:location?C.green:C.sub }}>
            {location ? `✓ ${location.ville}` : "Cliquez pour détecter votre position"}
          </span>
        </div>
        <span style={{ color:location?C.green:C.sub, fontSize:18 }}>{location?"✓":"›"}</span>
      </div>

      {/* Support */}
      <div style={{ ...css.card, display:"flex", alignItems:"center", gap:12, marginBottom:0, cursor:"pointer", padding:"14px 16px", border:"1px solid #1E88E544" }}
        onClick={()=>openChat?.("Support EPT", true)}>
        <span style={{ fontSize:22 }}>🆘</span>
        <div style={{ flex:1 }}>
          <span style={{ fontWeight:600, fontSize:14, display:"block" }}>Support / Aide</span>
          <span style={{ fontSize:11, color:C.sub }}>Contacter l'équipe Emploi pour Tous</span>
        </div>
        <span style={{ color:C.accent }}>💬</span>
      </div>

      <button style={{ ...css.btn(C.red), width:"100%", padding:"13px 0", fontSize:15, marginTop:4 }} onClick={doLogout}>
        🚪 Se déconnecter
      </button>
    </div>
  </>;
}

// ── FONTS ─────────────────────────────────────────────────────
function Fonts() {
  return (
    <link
      href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap"
      rel="stylesheet"
    />
  );
}

// ── CSS GLOBAL SCROLL ─────────────────────────────────────────
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      background: #0d1b2a;
      height: 100%;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      scroll-behavior: smooth;
    }
    #root { min-height: 100vh; overflow-y: auto; }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: #0a1520; }
    ::-webkit-scrollbar-thumb { background: #1e3a52; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #1E88E5; }
    button { -webkit-tap-highlight-color: transparent; cursor: pointer; }
    input, textarea, select { -webkit-appearance: none; }
    @keyframes typingDot {
      0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-4px); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `;
  document.head.appendChild(style);
}
