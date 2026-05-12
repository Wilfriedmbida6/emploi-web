// ══════════════════════════════════════════════════════════════
//  SERVEUR TEMPS RÉEL — Emploi pour Tous
// ══════════════════════════════════════════════════════════════

const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const cors       = require("cors");

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 4000;

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"], credentials: true }
});

// ── Routes HTTP ────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Serveur Emploi pour Tous operationnel" });
});

// Debug : voir les connectés
app.get("/users", (req, res) => {
  const list = [];
  connectedUsers.forEach((u) => list.push({ name: u.name, userId: u.userId }));
  res.json({ count: list.length, users: list });
});

/**
 * POST /offre
 * Body : { title, company, location, type, description, offerId }
 *
 * Appelé depuis votre backend (ou un admin) quand une nouvelle offre
 * est publiée. Diffuse une notification à tous les utilisateurs connectés.
 *
 * Exemple curl :
 *   curl -X POST http://localhost:4000/offre \
 *        -H "Content-Type: application/json" \
 *        -d '{"title":"Dev React","company":"Acme","offerId":"abc123"}'
 */
app.post("/offre", (req, res) => {
  const { title, company, location, type, description, offerId } = req.body;

  if (!title || !offerId) {
    return res.status(400).json({ error: "title et offerId sont requis" });
  }

  const payload = {
    id:          Date.now(),
    type:        "new_offer",
    offerId,
    title,
    company:     company     || "",
    location:    location    || "",
    offerType:   type        || "",
    description: description || "",
    time:        new Date().toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }),
    read:        false,
  };

  // Broadcast à tous les clients connectés
  io.emit("new_offer", payload);
  console.log(`Nouvelle offre diffusée : "${title}" (id: ${offerId})`);

  res.json({ status: "ok", broadcasted: connectedUsers.size });
});

// ── État en mémoire ────────────────────────────────────────────

const connectedUsers = new Map();

// Chercher un socketId par nom (insensible à la casse) OU userId
const findSocket = (nameOrId) => {
  for (const [, user] of connectedUsers) {
    if (
      user.name?.toLowerCase() === nameOrId?.toLowerCase() ||
      user.userId === nameOrId
    ) return user.socketId;
  }
  return null;
};

// ── WebSocket ─────────────────────────────────────────────────

io.on("connection", (socket) => {
  const { userId, name } = socket.handshake.auth;
  if (!name) return;

  // Supprimer l'ancien socket du même user (reconnexion)
  for (const [sid, user] of connectedUsers) {
    if (user.userId === userId || user.name?.toLowerCase() === name?.toLowerCase()) {
      connectedUsers.delete(sid);
    }
  }

  connectedUsers.set(socket.id, { userId, name, socketId: socket.id });

  const allNames = [];
  connectedUsers.forEach(u => allNames.push(u.name));
  console.log(`Connecté : "${name}" | En ligne : [${allNames.join(", ")}]`);

  io.emit("user_online", { name, userId, online: true });

  // ── Envoi d'un message ──────────────────────────────────────
  socket.on("message", (data) => {
    const { to, ...msgData } = data;
    const time    = new Date().toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
    const id      = msgData.msgId || Date.now();
    const from    = name;
    const payload = { ...msgData, id, from, time };

    const destSocketId = findSocket(to);
    console.log(`Message : "${from}" -> "${to}" | Dest socket : ${destSocketId || "INTROUVABLE"}`);

    if (destSocketId) {
      io.to(destSocketId).emit("message", payload);
      socket.emit("msg_status", { msgId: id, status: "delivered" });

      // Notification de nouveau message (badge +1 côté client)
      io.to(destSocketId).emit("notification", {
        id:   Date.now(),
        type: "message",
        msg:  `Nouveau message de ${from}`,
        from,
        time: "À l'instant",
        read: false,
      });
    } else {
      socket.emit("msg_status", { msgId: id, status: "sent" });
      console.log(`  Hors ligne. Connectés : [${allNames.join(", ")}]`);
    }
  });

  // ── Statut de message (envoyé / livré) ──────────────────────
  socket.on("msg_status", ({ msgId, status, to }) => {
    const dest = findSocket(to);
    if (dest) io.to(dest).emit("msg_status", { msgId, status });
  });

  // ── Accusé de lecture ───────────────────────────────────────
  //
  // Le client envoie cet événement quand l'utilisateur OUVRE
  // la conversation et voit les messages non lus.
  //
  // Payload attendu :
  //   { to: "NomOuUserId", msgIds: [id1, id2, ...] }
  //
  // Ce que ça fait :
  //   1. Met à jour le statut des messages en "read" chez l'expéditeur
  //      → l'expéditeur affiche ✓✓ (double coche lue)
  //   2. Envoie un événement "clear_badge" au destinataire
  //      → le destinataire supprime son badge non-lu pour cette conv
  //
  socket.on("read_receipt", ({ to, msgIds }) => {
    const destSocketId = findSocket(to);

    if (destSocketId) {
      // Notifie l'expéditeur que ses messages ont été lus
      io.to(destSocketId).emit("msg_status", {
        msgIds,               // tableau d'ids
        status: "read",
        from: name,           // celui qui a lu
      });
    }

    // Confirme au lecteur que le badge doit être supprimé
    // (utile si la confirmation arrive en double onglet / appareil)
    socket.emit("clear_badge", { from: to });

    console.log(`Lu : "${name}" a lu ${msgIds?.length ?? 1} message(s) de "${to}"`);
  });

  // ── Indicateur de frappe ────────────────────────────────────
  socket.on("typing", ({ to, typing }) => {
    const dest = findSocket(to);
    if (dest) io.to(dest).emit("typing", { from: name, typing });
  });

  // ── Déconnexion ─────────────────────────────────────────────
  socket.on("disconnect", () => {
    connectedUsers.delete(socket.id);
    io.emit("user_online", { name, userId, online: false });
    console.log(`Déconnecté : "${name}" | Restants : ${connectedUsers.size}`);
  });
});

// ── Démarrage ─────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
