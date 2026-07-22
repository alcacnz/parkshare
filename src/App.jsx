import { useState, useEffect } from "react";

const NZ_TIMEZONE = "Pacific/Auckland";
const SUPABASE_URL = "https://buslyaosiesozpfwbadu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1c2x5YW9zaWVzb3pwZndiYWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MDAwMTEsImV4cCI6MjA5NTQ3NjAxMX0.fYK_Lwq_40Ha5PNBwXtdgJQLTVtpEjuWQl3zLnIAIZs";
const HEADERS = { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };
const DRIVEWAY_W = 36;
const DISABLED_SPOTS = ["21"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// ─── SUPABASE API ─────────────────────────────────────────────────────────────
async function fetchSpots() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/parking_spots?select=*&order=id`, { headers: HEADERS });
  return res.json();
}
async function updateSpotDB(id, changes) {
  await fetch(`${SUPABASE_URL}/rest/v1/parking_spots?id=eq.${id}`, {
    method: "PATCH", headers: { ...HEADERS, "Prefer": "return=minimal" }, body: JSON.stringify(changes),
  });
}
async function syncSpotOwner(spotId, ownerName) {
  if (!spotId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/parking_spots?id=eq.${spotId}`, {
    method: "PATCH", headers: { ...HEADERS, "Prefer": "return=minimal" },
    body: JSON.stringify({ owner: ownerName || "", status: ownerName ? "reserved" : "available" }),
  });
}
async function fetchUsers() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*&order=first_name`, { headers: HEADERS });
  return res.json();
}
async function loginUser(username, password) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}&password=eq.${encodeURIComponent(password)}&select=*`, { headers: HEADERS });
  const data = await res.json();
  return data[0] || null;
}
async function createUser(user) {
  await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: "POST", headers: { ...HEADERS, "Prefer": "return=minimal" }, body: JSON.stringify(user),
  });
}
async function updateUser(id, changes) {
  await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${id}`, {
    method: "PATCH", headers: { ...HEADERS, "Prefer": "return=minimal" }, body: JSON.stringify(changes),
  });
}
async function deleteUser(id) {
  await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${id}`, {
    method: "DELETE", headers: { ...HEADERS, "Prefer": "return=minimal" },
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function todayNZ() { return new Date().toLocaleDateString("en-CA", { timeZone: NZ_TIMEZONE }); }
function fmt(s) { if (!s) return ""; return new Date(s + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short" }); }
function getNZDateTime() {
  const now = new Date();
  return {
    date: now.toLocaleDateString("en-NZ", { timeZone: NZ_TIMEZONE, day: "numeric", month: "short", year: "numeric" }),
    day: now.toLocaleDateString("en-NZ", { timeZone: NZ_TIMEZONE, weekday: "long" }),
    time: now.toLocaleTimeString("en-NZ", { timeZone: NZ_TIMEZONE, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}
function getTodayDayNum() {
  const day = new Date().toLocaleDateString("en-US", { timeZone: NZ_TIMEZONE, weekday: "short" });
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 }[day.slice(0, 3)];
}
function fullName(user) { return `${user.first_name} ${user.last_name}`; }

function isDedicated(spot) { return !!spot.owner; }
function computeStatus(spot) {
  if (spot.booked_by) return "booked";
  if (!isDedicated(spot)) return "available";
  const today = todayNZ();
  // Slice to YYYY-MM-DD to handle Supabase timezone formats
  const relFrom = spot.released_from ? spot.released_from.substring(0, 10) : null;
  const relUntil = spot.released_until ? spot.released_until.substring(0, 10) : null;
  if (relFrom && relUntil && today >= relFrom && today <= relUntil) return "available";
  const dayNum = getTodayDayNum();
  if (dayNum && spot.wfh_days && spot.wfh_days.split(",").map(d => d.trim()).includes(String(dayNum))) return "available";
  return "reserved";
}

const C = {
  reserved:  { bg: "#B91C1C", border: "#991818", text: "#FEE2E2", label: "Reserved" },
  available: { bg: "#1D9E75", border: "#0F6E56", text: "#E1F5EE", label: "Available" },
  booked:    { bg: "#B91C1C", border: "#991818", text: "#FEE2E2", label: "Booked" },
};
const btn = (bg, color, extra = {}) => ({
  background: bg, color, border: "none", borderRadius: 7, padding: "10px 14px",
  cursor: "pointer", fontWeight: 600, fontSize: 13, width: "100%",
  textAlign: "center", marginBottom: 6, display: "block", ...extra,
});

// ─── CLOCK ────────────────────────────────────────────────────────────────────
function Clock() {
  const [dt, setDt] = useState(getNZDateTime());
  useEffect(() => { const t = setInterval(() => setDt(getNZDateTime()), 1000); return () => clearInterval(t); }, []);
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ color: "white", fontSize: 13, fontWeight: 700 }}>{dt.day}, {dt.date}</div>
      <div style={{ color: "#9FE1CB", fontSize: 12 }}>{dt.time} NZT</div>
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) { setError("Please enter username and password"); return; }
    setLoading(true);
    setError("");
    const user = await loginUser(username.trim(), password);
    setLoading(false);
    if (user) { onLogin(user); }
    else { setError("Invalid username or password"); }
  };

  return (
    <div style={{ background: "#0F6E56", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 32, width: "100%", maxWidth: 360, boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ color: "#0F6E56", fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>ParkShare</div>
          <div style={{ color: "#888", fontSize: 13, marginTop: 4 }}>Atlas Copco Group NZ</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "#666", fontWeight: 600, display: "block", marginBottom: 4 }}>Username</label>
            <input value={username} onChange={e => { setUsername(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Enter your username"
              style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#666", fontWeight: 600, display: "block", marginBottom: 4 }}>Password</label>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Enter your password"
              style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }} />
          </div>
          {error && <p style={{ color: "#c00", fontSize: 13, margin: 0, textAlign: "center" }}>{error}</p>}
          <button onClick={handleLogin} disabled={loading} style={{ background: "#0F6E56", color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.7 : 1, marginTop: 4 }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: "#aaa", marginTop: 20, marginBottom: 0 }}>Contact HR if you need access</p>
      </div>
    </div>
  );
}

// ─── USER MANAGER ─────────────────────────────────────────────────────────────
function UserManager({ onClose, showToast, spots, onSpotsUpdated }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", username: "", password: "", role: "staff", spot_id: "" });
  const [saving, setSaving] = useState(false);

  const load = () => fetchUsers().then(data => { setUsers(data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const resetForm = () => setForm({ first_name: "", last_name: "", username: "", password: "", role: "staff", spot_id: "" });

  const handleAdd = async () => {
    if (!form.first_name || !form.last_name || !form.username || !form.password) { showToast("All fields required"); return; }
    setSaving(true);
    await createUser(form);
    // Sync parking spot owner
    await syncSpotOwner(form.spot_id, form.spot_id ? `${form.first_name} ${form.last_name}` : "");
    await load();
    setSaving(false);
    setShowAdd(false);
    resetForm();
    if (onSpotsUpdated) onSpotsUpdated();
    showToast("User created");
  };

  const handleUpdate = async (id) => {
    setSaving(true);
    const u = users.find(u => u.id === id);
    const newSpot = u._spot ?? u.spot_id;
    const oldSpot = u.spot_id;
    const newName = `${u._fn ?? u.first_name} ${u._ln ?? u.last_name}`;
    await updateUser(id, { first_name: u._fn ?? u.first_name, last_name: u._ln ?? u.last_name, username: u._un ?? u.username, password: u._pw ?? u.password, role: u._role ?? u.role, spot_id: newSpot });
    // Sync spots
    if (oldSpot && oldSpot !== newSpot) await syncSpotOwner(oldSpot, "");
    if (newSpot) await syncSpotOwner(newSpot, newName);
    await load();
    setSaving(false);
    setEditingId(null);
    if (onSpotsUpdated) onSpotsUpdated();
    showToast("User updated");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    const u = users.find(u => u.id === id);
    await deleteUser(id);
    // Clear their spot
    if (u?.spot_id) await syncSpotOwner(u.spot_id, "");
    await load();
    if (onSpotsUpdated) onSpotsUpdated();
    showToast("User deleted");
  };

  const editField = (id, field, value) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, [field]: value } : u));
  };

  const availableSpots = spots.filter(s => !DISABLED_SPOTS.includes(s.id) && (s.section === "front" || s.section === "back")).sort((a, b) => parseInt(a.id) - parseInt(b.id));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
      <div style={{ background: "white", borderRadius: 14, padding: 20, width: "100%", maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, color: "#085041", fontSize: 16 }}>User Management</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setShowAdd(true); resetForm(); }} style={{ background: "#0F6E56", color: "white", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Add User</button>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#aaa" }}>✕</button>
          </div>
        </div>

        {/* Add user form */}
        {showAdd && (
          <div style={{ background: "#f9fafb", borderRadius: 10, padding: 14, marginBottom: 14, border: "1px solid #e5e7eb" }}>
            <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 14, color: "#085041" }}>New User</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} placeholder="First name"
                style={{ flex: 1, minWidth: 120, border: "1px solid #ddd", borderRadius: 6, padding: "7px 10px", fontSize: 13 }} />
              <input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Last name"
                style={{ flex: 1, minWidth: 120, border: "1px solid #ddd", borderRadius: 6, padding: "7px 10px", fontSize: 13 }} />
              <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="Username"
                style={{ flex: 1, minWidth: 120, border: "1px solid #ddd", borderRadius: 6, padding: "7px 10px", fontSize: 13 }} />
              <input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Password"
                style={{ flex: 1, minWidth: 120, border: "1px solid #ddd", borderRadius: 6, padding: "7px 10px", fontSize: 13 }} />
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                style={{ flex: 1, minWidth: 100, border: "1px solid #ddd", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}>
                <option value="staff">Staff</option>
              </select>
              <select value={form.spot_id} onChange={e => setForm(p => ({ ...p, spot_id: e.target.value }))}
                style={{ flex: 1, minWidth: 100, border: "1px solid #ddd", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}>
                <option value="">No spot</option>
                {availableSpots.map(s => <option key={s.id} value={s.id}>Spot {s.id}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={handleAdd} disabled={saving} style={{ ...btn("#0F6E56", "white", { marginBottom: 0 }), flex: 1 }}>Save</button>
              <button onClick={() => setShowAdd(false)} style={{ ...btn("#f3f4f6", "#555", { marginBottom: 0 }), flex: 1 }}>Cancel</button>
            </div>
          </div>
        )}

        {/* User list */}
        {loading ? <p style={{ textAlign: "center", color: "#888" }}>Loading...</p> : (
          <div style={{ overflowY: "auto", flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  {["Name", "Username", "Password", "Role", "Spot", ""].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 12, color: "#666", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    {editingId === u.id ? (
                      <>
                        <td style={{ padding: "6px 4px" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <input value={u._fn ?? u.first_name} onChange={e => editField(u.id, "_fn", e.target.value)}
                              style={{ width: 80, border: "1px solid #ddd", borderRadius: 4, padding: "4px 6px", fontSize: 12 }} />
                            <input value={u._ln ?? u.last_name} onChange={e => editField(u.id, "_ln", e.target.value)}
                              style={{ width: 80, border: "1px solid #ddd", borderRadius: 4, padding: "4px 6px", fontSize: 12 }} />
                          </div>
                        </td>
                        <td style={{ padding: "6px 4px" }}>
                          <input value={u._un ?? u.username} onChange={e => editField(u.id, "_un", e.target.value)}
                            style={{ width: 100, border: "1px solid #ddd", borderRadius: 4, padding: "4px 6px", fontSize: 12 }} />
                        </td>
                        <td style={{ padding: "6px 4px" }}>
                          <input value={u._pw ?? u.password} onChange={e => editField(u.id, "_pw", e.target.value)}
                            style={{ width: 100, border: "1px solid #ddd", borderRadius: 4, padding: "4px 6px", fontSize: 12 }} />
                        </td>
                        <td style={{ padding: "6px 4px" }}>
                          {u.role === "admin" ? (
                            <span style={{ fontSize: 12, color: "#666" }}>admin</span>
                          ) : (
                            <select value={u._role ?? u.role} onChange={e => editField(u.id, "_role", e.target.value)}
                              style={{ border: "1px solid #ddd", borderRadius: 4, padding: "4px 6px", fontSize: 12 }}>
                              <option value="staff">Staff</option>
                            </select>
                          )}
                        </td>
                        <td style={{ padding: "6px 4px" }}>
                          <select value={u._spot ?? u.spot_id} onChange={e => editField(u.id, "_spot", e.target.value)}
                            style={{ border: "1px solid #ddd", borderRadius: 4, padding: "4px 6px", fontSize: 12 }}>
                            <option value="">None</option>
                            {availableSpots.map(s => <option key={s.id} value={s.id}>Spot {s.id}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "6px 4px" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => handleUpdate(u.id)} disabled={saving} style={{ background: "#0F6E56", color: "white", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>Save</button>
                            <button onClick={() => setEditingId(null)} style={{ background: "#f3f4f6", color: "#555", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: "8px 10px" }}>{u.first_name} {u.last_name}</td>
                        <td style={{ padding: "8px 10px", color: "#666" }}>{u.username}</td>
                        <td style={{ padding: "8px 10px", color: "#999" }}>••••••</td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ background: u.role === "admin" ? "#085041" : "#f3f4f6", color: u.role === "admin" ? "white" : "#555", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{u.role}</span>
                        </td>
                        <td style={{ padding: "8px 10px", color: "#666" }}>{u.spot_id ? `Spot ${u.spot_id}` : "—"}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => setEditingId(u.id)} style={{ background: "#f3f4f6", color: "#555", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>Edit</button>
                            {u.role !== "admin" && (
                              <button onClick={() => handleDelete(u.id)} style={{ background: "#fff4f4", color: "#B91C1C", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>Delete</button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SPOT TILES ───────────────────────────────────────────────────────────────
function SpotTile({ spot, selected, onSelect, isLast, currentUser }) {
  const disabled = DISABLED_SPOTS.includes(spot.id);
  const isMySpot = currentUser?.spot_id === spot.id;

  if (disabled) {
    return (
      <div style={{ flex: 1, minWidth: 36, cursor: "not-allowed", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 0", borderRight: isLast ? "none" : "1px solid #444444", opacity: 0.5 }}>
        <span style={{ fontSize: 9, color: "#cccccc" }}>{" "}</span>
        <div style={{ width: 36, height: 52, borderRadius: 3, background: "#6b7280", border: "1px dashed #9ca3af", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 7, color: "#e5e7eb", fontWeight: 700 }}>No Park</span>
        </div>
        <span style={{ fontSize: 15, color: "#cccccc", fontWeight: 700 }}>{spot.id}</span>
      </div>
    );
  }

  const status = computeStatus(spot);
  const c = C[status];
  const sel = selected?.id === spot.id;

  return (
    <div onClick={() => onSelect(spot)} style={{ flex: 1, minWidth: 36, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 0", borderRight: isLast ? "none" : "1px solid #444444", background: sel ? "rgba(255,255,255,0.08)" : "transparent", transition: "background 0.15s" }}>
      <span style={{ fontSize: 11, color: c.text, fontWeight: 600, textAlign: "center", maxWidth: 48, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
        {status === "booked" ? spot.booked_by : status === "reserved" ? spot.owner : ""}
      </span>
      <div style={{ width: 36, height: 52, borderRadius: 3, background: c.bg, border: `2px solid ${isMySpot ? "#FFD700" : c.border}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {isMySpot && <div style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, background: "#FFD700", borderRadius: "50%" }} />}
        {status === "available" && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.text} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {status === "reserved" && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.text} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
        {status === "booked" && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </div>
      <span style={{ fontSize: 15, color: "#cccccc", fontWeight: 700 }}>{spot.id}</span>
    </div>
  );
}

function DoorTile() {
  return (
    <div style={{ flex: 1, minWidth: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 0", borderRight: "1px solid #444444" }}>
      <span style={{ fontSize: 9, color: "#cccccc" }}>{" "}</span>
      <div style={{ width: 36, height: 52, borderRadius: 3, background: "#888888", border: "1px solid #666666", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 8, color: "#dddddd", fontWeight: 700 }}>DOOR</span>
      </div>
      <span style={{ fontSize: 15, color: "#cccccc", fontWeight: 700 }}>{" "}</span>
    </div>
  );
}

function TempTile({ label, isLast }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 6px", borderRight: isLast ? "none" : "1px dashed #9ca3af" }}>
      <div style={{ width: 52, height: 28, borderRadius: 3, background: "#6b7280", border: "2px dashed #9ca3af", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "#e5e7eb", fontWeight: 700 }}>{label}</span>
      </div>
    </div>
  );
}

// ─── ALLOCATION MANAGER ───────────────────────────────────────────────────────
function AllocationManager({ onClose, showToast, onSpotsUpdated }) {
  const [users, setUsers] = useState([]);
  const [localSpots, setLocalSpots] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchSpots()]).then(([u, s]) => {
      setUsers(u);
      setLocalSpots(
        s.filter(sp => (sp.section === "front" || sp.section === "back") && !DISABLED_SPOTS.includes(sp.id))
         .sort((a, b) => parseInt(a.id) - parseInt(b.id))
         .map(sp => ({ ...sp, _owner: sp.owner || "", _wfh: sp.wfh_days || "" }))
      );
      setLoading(false);
    });
  }, []);

  const toggleWfh = (spotId, num) => {
    setLocalSpots(prev => prev.map(s => {
      if (s.id !== spotId) return s;
      const days = s._wfh ? s._wfh.split(",").map(d => d.trim()).filter(Boolean) : [];
      const updated = days.includes(num) ? days.filter(d => d !== num) : [...days, num];
      return { ...s, _wfh: updated.sort().join(",") };
    }));
  };

  const handleOwnerChange = (spotId, selectedName) => {
    setLocalSpots(prev => prev.map(s => s.id === spotId ? { ...s, _owner: selectedName } : s));
  };

  const saveAll = async () => {
    setSaving(true);
    for (const spot of localSpots) {
      const status = spot._owner ? "reserved" : "available";
      // Update parking spot
      await fetch(`${SUPABASE_URL}/rest/v1/parking_spots?id=eq.${spot.id}`, {
        method: "PATCH", headers: { ...HEADERS, "Prefer": "return=minimal" },
        body: JSON.stringify({ owner: spot._owner, wfh_days: spot._wfh, status }),
      });
      // Sync user's spot_id
      const matchedUser = users.find(u => fullName(u) === spot._owner);
      if (matchedUser) await updateUser(matchedUser.id, { spot_id: spot.id });
      const prevOwner = localSpots.find(s => s.id === spot.id && s.owner !== spot._owner)?.owner;
      if (prevOwner) {
        const prevUser = users.find(u => fullName(u) === prevOwner);
        if (prevUser) await updateUser(prevUser.id, { spot_id: "" });
      }
    }
    setSaving(false);
    showToast("Allocation saved");
    onSpotsUpdated();
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
      <div style={{ background: "white", borderRadius: 14, padding: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, color: "#085041", fontSize: 16 }}>Parking Allocation</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#aaa" }}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #eee" }}>
          <span style={{ width: 32, fontSize: 11, color: "#999", fontWeight: 700 }}>Slot</span>
          <span style={{ flex: 1, fontSize: 11, color: "#999", fontWeight: 700 }}>Owner</span>
          <span style={{ width: 190, fontSize: 11, color: "#999", fontWeight: 700 }}>WFH Days</span>
        </div>
        {loading ? <p style={{ textAlign: "center", color: "#888", padding: 20 }}>Loading...</p> :
        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {localSpots.map(spot => (
            <div key={spot.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ width: 32, fontSize: 13, fontWeight: 700, color: "#085041", flexShrink: 0 }}>{spot.id}</span>
              <select value={spot._owner} onChange={e => handleOwnerChange(spot.id, e.target.value)}
                style={{ flex: 1, border: "1px solid #ddd", borderRadius: 6, padding: "6px 8px", fontSize: 13, boxSizing: "border-box", background: "white" }}>
                <option value="">— No owner —</option>
                {users.sort((a,b) => a.first_name.localeCompare(b.first_name)).map(u => (
                  <option key={u.id} value={fullName(u)}>{fullName(u)}</option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 3, width: 190 }}>
                {DAYS.map((day, i) => {
                  const num = String(i + 1);
                  const sel = spot._wfh.split(",").map(d => d.trim()).includes(num);
                  return (
                    <button key={day} onClick={() => toggleWfh(spot.id, num)} style={{ flex: 1, padding: "5px 0", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: 700, background: sel ? "#0F6E56" : "#f3f4f6", color: sel ? "white" : "#777" }}>{day}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>}
        <button onClick={saveAll} disabled={saving} style={{ marginTop: 14, background: "#0F6E56", color: "white", border: "none", borderRadius: 7, padding: "11px", cursor: "pointer", fontWeight: 600, fontSize: 14, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "Save Allocation"}
        </button>
      </div>
    </div>
  );
}

// ─── USER SELECT ──────────────────────────────────────────────────────────────
function UserSelect({ value, onChange }) {
  const [users, setUsers] = useState([]);
  useEffect(() => { fetchUsers().then(setUsers); }, []);
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", border: "1px solid #ddd", borderRadius: 6, padding: "8px 10px", fontSize: 13, boxSizing: "border-box", background: "white" }}>
      <option value="">— No owner —</option>
      {users.sort((a,b) => a.first_name.localeCompare(b.first_name)).map(u => (
        <option key={u.id} value={fullName(u)}>{fullName(u)}</option>
      ))}
    </select>
  );
}

// ─── SPOT PANEL ───────────────────────────────────────────────────────────────
function SpotPanel({ spot, isAdmin, currentUser, showReleasePicker, setShowReleasePicker, showReleaseNameInput, setShowReleaseNameInput, releaseNameError, setReleaseNameError, showBookingInput, setShowBookingInput, showConfirmRelease, setShowConfirmRelease, startDate, endDate, onStartChange, onEndChange, onClose, onBook, onRelease, onReleaseToday, onCancelRelease, onReleaseBooking, onAdminAssign, onAdminClearOwner, onAdminCancelBooking, editName, setEditName }) {
  if (!spot) return null;
  const status = computeStatus(spot);
  const dedicated = isDedicated(spot);
  const c = C[status];
  const myName = currentUser ? fullName(currentUser) : "";
  const isMySpot = currentUser?.spot_id === spot.id;

  return (
    <div style={{ background: "white", borderRadius: 12, padding: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.13)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#085041" }}>Spot {spot.id} {isMySpot && <span style={{ fontSize: 12, background: "#FFD700", color: "#333", borderRadius: 4, padding: "2px 6px", marginLeft: 6 }}>Your spot</span>}</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{dedicated ? `Dedicated for ${spot.owner}` : "Open parking"}</div>
          {status === "booked" && <div style={{ fontSize: 12, color: "#B91C1C", fontWeight: 600, marginTop: 3 }}>Booked by {spot.booked_by}</div>}
          {status === "available" && spot.released_from && <div style={{ fontSize: 12, color: "#0F6E56", fontWeight: 600, marginTop: 3 }}>Released: {fmt(spot.released_from)} – {fmt(spot.released_until)}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600, background: c.bg + "22", color: c.bg, border: `1px solid ${c.bg}44` }}>{c.label}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#bbb" }}>✕</button>
        </div>
      </div>

      {isAdmin ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ borderBottom: "1px solid #f0f0f0", paddingBottom: 12 }}>
            <p style={{ fontSize: 12, color: "#666", margin: "0 0 6px", fontWeight: 600 }}>Permanent owner</p>
            <UserSelect value={editName} onChange={setEditName} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={onAdminAssign} style={{ ...btn("#0F6E56", "white", { marginBottom: 0 }), flex: 1 }}>Save</button>
              {dedicated && <button onClick={onAdminClearOwner} style={{ ...btn("#f3f4f6", "#666", { marginBottom: 0 }), flex: 1 }}>Clear owner</button>}
            </div>
          </div>
          {dedicated && status === "reserved" && <button onClick={onReleaseToday} style={btn("#f3f4f6", "#085041", { marginBottom: 0 })}>Release for today</button>}
          {dedicated && status === "available" && spot.released_from && <button onClick={onCancelRelease} style={btn("#fff4f4", "#B91C1C", { border: "1px solid #fcc", marginBottom: 0 })}>Cancel release</button>}
          {status === "booked" && <button onClick={onAdminCancelBooking} style={btn("#fff4f4", "#B91C1C", { border: "1px solid #fcc", marginBottom: 0 })}>Cancel booking</button>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {status === "available" && (
            showBookingInput ? (
              <>
                <div style={{ background: "#f0faf5", borderRadius: 8, padding: "10px 12px" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#085041", fontWeight: 600 }}>Book as {myName}?</p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#666" }}>Booking is for today only</p>
                </div>
                <button onClick={onBook} style={btn("#0F6E56", "white", { marginBottom: 0 })}>Confirm booking</button>
                <button onClick={() => setShowBookingInput(false)} style={btn("#f3f4f6", "#555", { marginBottom: 0 })}>Cancel</button>
              </>
            ) : (
              <button onClick={() => setShowBookingInput(true)} style={btn("#0F6E56", "white", { marginBottom: 0 })}>Book this spot</button>
            )
          )}
          {status === "reserved" && (
            isMySpot ? (
              showReleasePicker ? (
                <>
                  <p style={{ margin: 0, fontSize: 12, color: "#555", fontWeight: 600 }}>Select release period</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 3 }}>From</label>
                      <input type="date" value={startDate} min={todayNZ()} onChange={e => onStartChange(e.target.value)}
                        style={{ width: "100%", border: "1px solid #ddd", borderRadius: 6, padding: "7px 8px", fontSize: 13, boxSizing: "border-box" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 3 }}>To</label>
                      <input type="date" value={endDate} min={startDate} onChange={e => onEndChange(e.target.value)}
                        style={{ width: "100%", border: "1px solid #ddd", borderRadius: 6, padding: "7px 8px", fontSize: 13, boxSizing: "border-box" }} />
                    </div>
                  </div>
                  <button onClick={onRelease} style={btn("#085041", "white", { marginBottom: 0 })}>Confirm period release</button>
                  <button onClick={() => setShowReleasePicker(false)} style={btn("#f3f4f6", "#555", { marginBottom: 0 })}>Back</button>
                </>
              ) : (
                <>
                  <div style={{ background: "#FFF8E1", borderRadius: 8, padding: "10px 12px" }}>
                    <p style={{ color: "#92620A", fontWeight: 600, fontSize: 13, margin: 0 }}>This is your spot</p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={onReleaseToday} style={{ ...btn("#085041", "white", { marginBottom: 0 }), flex: 1 }}>Today only</button>
                    <button onClick={() => setShowReleasePicker(true)} style={{ ...btn("#0a5c47", "white", { marginBottom: 0 }), flex: 1 }}>Select period</button>
                  </div>
                </>
              )
            ) : (
              <div style={{ background: "#FEF2F2", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <p style={{ color: "#B91C1C", fontWeight: 600, fontSize: 13, margin: 0 }}>Reserved for {spot.owner}</p>
              </div>
            )
          )}
          {status === "booked" && (
            showConfirmRelease ? (
              <>
                <p style={{ margin: 0, fontSize: 12, color: "#555", fontWeight: 600 }}>Release spot booked by {spot.booked_by}?</p>
                <button onClick={onReleaseBooking} style={btn("#0F6E56", "white", { marginBottom: 0 })}>Yes, release it</button>
                <button onClick={() => setShowConfirmRelease(false)} style={btn("#f3f4f6", "#555", { marginBottom: 0 })}>Cancel</button>
              </>
            ) : (
              <>
                <div style={{ background: "#FEF2F2", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <p style={{ color: "#B91C1C", fontWeight: 600, fontSize: 14, margin: "0 0 2px" }}>Booked by {spot.booked_by}</p>
                  <p style={{ color: "#991818", fontSize: 12, margin: 0 }}>Today only</p>
                </div>
                {(spot.booked_by === myName || isAdmin) && (
                  <button onClick={() => setShowConfirmRelease(true)} style={btn("#f3f4f6", "#555", { marginBottom: 0 })}>Release this spot</button>
                )}
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function ParkShare() {
  const [currentUser, setCurrentUser] = useState(null);
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [showAllocation, setShowAllocation] = useState(false);
  const [showUserManager, setShowUserManager] = useState(false);
  const [toast, setToast] = useState(null);
  const [editName, setEditName] = useState("");
  const [showReleasePicker, setShowReleasePicker] = useState(false);
  const [showReleaseNameInput, setShowReleaseNameInput] = useState(false);
  const [releaseNameError, setReleaseNameError] = useState(false);
  const [showBookingInput, setShowBookingInput] = useState(false);
  const [showConfirmRelease, setShowConfirmRelease] = useState(false);
  const [startDate, setStartDate] = useState(todayNZ());
  const [endDate, setEndDate] = useState(todayNZ());

  useEffect(() => {
    if (!currentUser) return;
    fetchSpots().then(data => { setSpots(data); setLoading(false); });
    const interval = setInterval(() => fetchSpots().then(data => setSpots(data)), 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  if (!currentUser) return <LoginScreen onLogin={setCurrentUser} />;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const updateSpot = async (id, changes) => {
    await updateSpotDB(id, changes);
    setSpots(prev => prev.map(s => s.id === id ? { ...s, ...changes } : s));
    setSelected(prev => prev ? { ...prev, ...changes } : prev);
  };

  const resetPanel = () => {
    setShowBookingInput(false); setShowConfirmRelease(false);
    setShowReleaseNameInput(false); setShowReleasePicker(false);
    setReleaseNameError(false);
    setStartDate(todayNZ()); setEndDate(todayNZ());
  };

  const selectSpot = (spot) => { setSelected(spot); setEditName(spot.owner || ""); resetPanel(); };
  const handleStartChange = (v) => { setStartDate(v); if (endDate < v) setEndDate(v); };
  const handleEndChange = (v) => { setEndDate(v); };

  const handleBook = async () => {
    if (!selected) return;
    const latest = await fetchSpots();
    const current = latest.find(s => s.id === selected.id);
    if (current?.booked_by) { showToast("Just booked by someone else!"); resetPanel(); setSpots(latest); return; }
    await updateSpot(selected.id, { booked_by: fullName(currentUser), status: "booked" });
    showToast(`Spot ${selected.id} booked`);
    resetPanel();
  };

  const handleRelease = async () => {
    if (!selected) return;
    await updateSpot(selected.id, { booked_by: null, status: "available", released_from: startDate, released_until: endDate });
    showToast(`Spot ${selected.id} released: ${fmt(startDate)} – ${fmt(endDate)}`);
    resetPanel();
  };

  const handleReleaseToday = async () => {
    if (!selected) return;
    const today = todayNZ();
    await updateSpot(selected.id, { booked_by: null, status: "available", released_from: today, released_until: today });
    showToast(`Spot ${selected.id} released for today`);
    resetPanel();
  };

  const handleCancelRelease = async () => {
    if (!selected) return;
    await updateSpot(selected.id, { released_from: null, released_until: null, booked_by: null, status: "reserved" });
    showToast(`Release cancelled`);
    resetPanel();
  };

  const handleReleaseBooking = async () => {
    if (!selected) return;
    const base = computeStatus({ ...selected, booked_by: null });
    await updateSpot(selected.id, { booked_by: null, status: base });
    showToast(`Spot ${selected.id} released`);
    resetPanel();
  };

  const handleAdminAssign = async () => {
    if (!selected) return;
    const newOwner = editName.trim();
    await updateSpot(selected.id, { owner: newOwner, status: newOwner ? "reserved" : "available", released_from: null, released_until: null, booked_by: null });
    // Sync user spot_id
    const allUsers = await fetchUsers();
    if (newOwner) {
      const matchedUser = allUsers.find(u => fullName(u) === newOwner);
      if (matchedUser) await updateUser(matchedUser.id, { spot_id: selected.id });
    }
    // Clear previous user's spot_id
    const prevOwner = selected.owner;
    if (prevOwner && prevOwner !== newOwner) {
      const prevUser = allUsers.find(u => fullName(u) === prevOwner);
      if (prevUser) await updateUser(prevUser.id, { spot_id: "" });
    }
    showToast(`Spot ${selected.id} updated`);
  };

  const handleAdminClearOwner = async () => {
    if (!selected) return;
    const prevOwner = selected.owner;
    await updateSpot(selected.id, { owner: "", status: "available", released_from: null, released_until: null, booked_by: null });
    if (prevOwner) {
      const allUsers = await fetchUsers();
      const prevUser = allUsers.find(u => fullName(u) === prevOwner);
      if (prevUser) await updateUser(prevUser.id, { spot_id: "" });
    }
    showToast(`Spot ${selected.id} cleared`);
  };

  const handleAdminCancelBooking = async () => {
    if (!selected) return;
    const base = computeStatus({ ...selected, booked_by: null });
    await updateSpot(selected.id, { booked_by: null, status: base });
    showToast(`Booking cancelled`);
    resetPanel();
  };

  const isAdmin = currentUser.role === "admin";
  const frontSpots = spots.filter(s => s.section === "front" && s.id !== "29").sort((a, b) => parseInt(a.id) - parseInt(b.id));
  const spot29 = spots.find(s => s.id === "29");
  const backSpots = spots.filter(s => s.section === "back").sort((a, b) => parseInt(a.id) - parseInt(b.id));
  const allRegular = [...frontSpots, ...(spot29 ? [spot29] : []), ...backSpots].filter(s => !DISABLED_SPOTS.includes(s.id));
  const availCount = allRegular.filter(s => computeStatus(s) === "available").length;
  const bookedCount = allRegular.filter(s => computeStatus(s) === "booked").length;
  const reservedCount = allRegular.filter(s => computeStatus(s) === "reserved").length;

  if (loading) return (
    <div style={{ background: "#0F6E56", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "white", fontSize: 16, fontWeight: 600 }}>Loading ParkShare...</div>
    </div>
  );

  const spotRow = (spotsArr) => (
    <div style={{ background: "#666666", borderRadius: 8, padding: "8px 6px", border: "1px solid #444444" }}>
      <div style={{ display: "flex", width: "100%" }}>
        {spotsArr.map((s, i) => <SpotTile key={s.id} spot={s} selected={selected} onSelect={selectSpot} isLast={i === spotsArr.length - 1} currentUser={currentUser} />)}
      </div>
    </div>
  );

  return (
    <div style={{ background: "#0F6E56", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 16px 80px" }}>

        {toast && (
          <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#085041", color: "white", padding: "10px 18px", borderRadius: 8, zIndex: 999, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
            {toast}
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ color: "white", fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>ParkShare</div>
            <div style={{ color: "#9FE1CB", fontSize: 12 }}>Atlas Copco Group NZ</div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Clock />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <span style={{ color: "#9FE1CB", fontSize: 12, alignSelf: "center" }}>👤 {fullName(currentUser)}</span>
              <button onClick={() => setShowRules(true)} style={{ background: "transparent", border: "1px solid #5DCAA5", color: "#5DCAA5", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>Rules</button>
              {isAdmin && <>
                <button onClick={() => setShowAllocation(true)} style={{ background: "transparent", border: "1px solid #5DCAA5", color: "#cccccc", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>Allocation</button>
                <button onClick={() => setShowUserManager(true)} style={{ background: "transparent", border: "1px solid #5DCAA5", color: "#cccccc", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>Users</button>
              </>}
              <button onClick={() => setCurrentUser(null)} style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>Sign out</button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[{ label: "available", value: availCount, color: "#1D9E75" }, { label: "booked", value: bookedCount, color: "#B91C1C" }, { label: "reserved", value: reservedCount, color: "#cccccc" }].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#085041", borderRadius: 8, padding: "8px 0", flex: 1, textAlign: "center" }}>
              <div style={{ color, fontSize: 28, fontWeight: 800 }}>{value}</div>
              <div style={{ color: "#cccccc", fontSize: 15 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#1D9E75" }} /><span style={{ fontSize: 15, color: "#cccccc" }}>Available</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#B91C1C" }} /><span style={{ fontSize: 15, color: "#cccccc" }}>Reserved / Booked</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#6b7280", border: "2px dashed #9ca3af" }} /><span style={{ fontSize: 15, color: "#cccccc" }}>Temp / Disabled</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFD700" }} /><span style={{ fontSize: 15, color: "#cccccc" }}>Your spot</span></div>
        </div>

        {/* PARKING MAP */}
        <div style={{ background: "#666666", borderRadius: 12, padding: 12, marginBottom: 6 }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 1000 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ width: DRIVEWAY_W, flexShrink: 0, background: "#666666", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#cccccc", fontSize: 11, fontWeight: 700, writingMode: "vertical-rl", transform: "rotate(180deg)", letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>Driveway</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "50%", flexShrink: 0 }}>
                      <div style={{ background: "#666666", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                        <span style={{ color: "#cccccc", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>← Driveway →</span>
                      </div>
                      <div>{spotRow(backSpots)}</div>
                    </div>
                    <div style={{ flex: 1, background: "#FFFFFF", borderRadius: 8, minHeight: 80 }} />
                  </div>
                  <div style={{ background: "#FFFFFF", borderRadius: 8, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#085041", fontWeight: 700, fontSize: 18 }}>Atlas Copco Group HQ</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ background: "#666666", borderRadius: 8, padding: "8px 6px", border: "1px solid #444444" }}>
                        <div style={{ display: "flex", width: "100%" }}>
                          <DoorTile />
                          {frontSpots.map((s, i) => <SpotTile key={s.id} spot={s} selected={selected} onSelect={selectSpot} isLast={i === frontSpots.length - 1} currentUser={currentUser} />)}
                        </div>
                      </div>
                    </div>
                    {spot29 && (
                      <div style={{ background: "#666666", borderRadius: 8, padding: "8px 6px", border: "2px dashed #9ca3af" }}>
                        <SpotTile spot={spot29} selected={selected} onSelect={selectSpot} isLast={true} currentUser={currentUser} />
                      </div>
                    )}
                  </div>
                  <div style={{ background: "#666666", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", borderBottom: "2px solid #1a3a0a", flexWrap: "nowrap" }}>
                      <div style={{ flex: 1, padding: "10px 12px", textAlign: "center" }}>
                        <span style={{ color: "#cccccc", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>← Driveway →</span>
                      </div>
                      <div style={{ padding: "6px", border: "2px dashed #9ca3af", borderRadius: 6, margin: 4, flexShrink: 0 }}>
                        <div style={{ display: "flex" }}>
                          <TempTile label="31" isLast={false} />
                          <TempTile label="30" isLast={true} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", paddingRight: "20%", background: "#1a3a0a" }}>
                      <div style={{ width: 50, background: "#666666", padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: "#cccccc", fontSize: 11, fontWeight: 700, writingMode: "vertical-rl", transform: "rotate(180deg)", letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>Driveway</span>
                      </div>
                    </div>
                    <div style={{ padding: "10px 12px", textAlign: "center", borderTop: "2px solid #1a3a0a" }}>
                      <span style={{ color: "#cccccc", fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Great South Road</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Spot Panel Modal */}
        {selected && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
            <div style={{ maxWidth: 480, width: "100%" }}>
              <SpotPanel
                spot={selected} isAdmin={isAdmin} currentUser={currentUser}
                editName={editName} setEditName={setEditName}
                showReleasePicker={showReleasePicker} setShowReleasePicker={setShowReleasePicker}
                showReleaseNameInput={showReleaseNameInput} setShowReleaseNameInput={setShowReleaseNameInput}
                releaseNameError={releaseNameError} setReleaseNameError={setReleaseNameError}
                showBookingInput={showBookingInput} setShowBookingInput={setShowBookingInput}
                showConfirmRelease={showConfirmRelease} setShowConfirmRelease={setShowConfirmRelease}
                startDate={startDate} endDate={endDate}
                onStartChange={handleStartChange} onEndChange={handleEndChange}
                onClose={() => { setSelected(null); resetPanel(); }}
                onBook={handleBook} onRelease={handleRelease} onReleaseToday={handleReleaseToday}
                onCancelRelease={handleCancelRelease} onReleaseBooking={handleReleaseBooking}
                onAdminAssign={handleAdminAssign} onAdminClearOwner={handleAdminClearOwner}
                onAdminCancelBooking={handleAdminCancelBooking}
              />
            </div>
          </div>
        )}

        {/* Allocation Manager */}
        {showAllocation && <AllocationManager onClose={() => setShowAllocation(false)} showToast={showToast} onSpotsUpdated={() => fetchSpots().then(data => setSpots(data))} />}

        {/* User Manager */}
        {showUserManager && <UserManager onClose={() => setShowUserManager(false)} showToast={showToast} spots={spots} onSpotsUpdated={() => fetchSpots().then(data => setSpots(data))} />}

        {/* Rules Modal */}
        {showRules && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
            <div style={{ background: "white", borderRadius: 14, padding: 20, maxWidth: 320, width: "100%" }}>
              <h3 style={{ margin: "0 0 12px", color: "#085041", fontSize: 16 }}>Parking Rules</h3>
              <ul style={{ fontSize: 13, color: "#444", paddingLeft: 18, margin: "0 0 14px", lineHeight: 1.9 }}>
                <li>Spots are permanently allocated by HR</li>
                <li>Book an available spot for today only</li>
                <li>Release your spot if you are WFH or on leave</li>
                <li>All bookings reset at midnight NZST</li>
                <li>Spots 30 & 31 are temporary unmanaged spots</li>
              </ul>
              <div style={{ fontSize: 13, color: "#555", marginBottom: 14 }}>
                <strong>Contact HR:</strong><br />Christine Manlapaz<br />+64 21 488 953
              </div>
              <button onClick={() => setShowRules(false)} style={btn("#0F6E56", "white", { marginBottom: 0 })}>Close</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
