import { useState, useEffect } from "react";

const ADMIN_CODE = "Welcome@2026!";
const NZ_TIMEZONE = "Pacific/Auckland";
const SUPABASE_URL = "https://buslyaosiesozpfwbadu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1c2x5YW9zaWVzb3pwZndiYWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MDAwMTEsImV4cCI6MjA5NTQ3NjAxMX0.fYK_Lwq_40Ha5PNBwXtdgJQLTVtpEjuWQl3zLnIAIZs";
const HEADERS = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
};

async function fetchSpots() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/parking_spots?select=*&order=id`, { headers: HEADERS });
  return res.json();
}
async function updateSpotDB(id, changes) {
  await fetch(`${SUPABASE_URL}/rest/v1/parking_spots?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...HEADERS, "Prefer": "return=minimal" },
    body: JSON.stringify(changes),
  });
}

function todayNZ() { return new Date().toLocaleDateString("en-CA", { timeZone: NZ_TIMEZONE }); }
function fmt(s) {
  if (!s) return "";
  return new Date(s + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}
function maxEnd(start) {
  const d = new Date(start + "T00:00:00");
  d.setDate(d.getDate() + 19);
  return d.toLocaleDateString("en-CA");
}
function dayCount(from, until) {
  return Math.round((new Date(until + "T00:00:00") - new Date(from + "T00:00:00")) / 86400000) + 1;
}

function isDedicated(spot) { return !!spot.owner; }
function computeStatus(spot) {
  if (spot.booked_by) return "booked";
  if (!isDedicated(spot)) return "available";
  const today = todayNZ();
  const inRange = spot.released_from && spot.released_until &&
    today >= spot.released_from && today <= spot.released_until;
  return inRange ? "available" : "reserved";
}

const C = {
  reserved:  { bg: "#444441", border: "#5F5E5A", text: "#9FE1CB", label: "Reserved" },
  available: { bg: "#1D9E75", border: "#0F6E56", text: "#E1F5EE", label: "Available" },
  booked:    { bg: "#B91C1C", border: "#991818", text: "#FEE2E2", label: "Booked" },
};

const btn = (bg, color, extra = {}) => ({
  background: bg, color, border: "none", borderRadius: 7, padding: "10px 14px",
  cursor: "pointer", fontWeight: 600, fontSize: 13, width: "100%",
  textAlign: "center", marginBottom: 6, display: "block", ...extra,
});

function SpotTile({ spot, selected, onSelect, isLast }) {
  const status = computeStatus(spot);
  const c = C[status];
  const sel = selected?.id === spot.id;
  return (
    <div onClick={() => onSelect(spot)} style={{
      flex: 1, minWidth: 36, cursor: "pointer",
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 2, padding: "4px 0",
      borderRight: isLast ? "none" : "1px solid #1D6B56",
      background: sel ? "rgba(255,255,255,0.08)" : "transparent",
      transition: "background 0.15s",
    }}>
      <span style={{
        fontSize: 9, color: c.text, fontWeight: 600, textAlign: "center",
        maxWidth: 48, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
      }}>
        {status === "booked" ? spot.booked_by : spot.owner || ""}
      </span>
      <div style={{
        width: 36, height: 52, borderRadius: 3,
        background: c.bg, border: `1px solid ${c.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {status === "available" && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={c.text} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {status === "booked" && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={c.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </div>
      <span style={{ fontSize: 9, color: "#9FE1CB", fontWeight: 700 }}>{spot.id}</span>
    </div>
  );
}

function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, onConfirm, onCancel }) {
  const today = todayNZ();
  const days = dayCount(startDate, endDate);
  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 12, color: "#555", fontWeight: 600 }}>Select release date range</p>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 3 }}>From</label>
          <input type="date" value={startDate} min={today}
            onChange={e => onStartChange(e.target.value)}
            style={{ width: "100%", border: "1px solid #ddd", borderRadius: 6, padding: "7px 8px", fontSize: 13, boxSizing: "border-box" }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 3 }}>To</label>
          <input type="date" value={endDate} min={startDate} max={maxEnd(startDate)}
            onChange={e => onEndChange(e.target.value)}
            style={{ width: "100%", border: "1px solid #ddd", borderRadius: 6, padding: "7px 8px", fontSize: 13, boxSizing: "border-box" }} />
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "#0F6E56", fontWeight: 600 }}>
        {days} day{days !== 1 ? "s" : ""} {days >= 20 ? "(max)" : ""}
      </p>
      <button onClick={onConfirm} style={btn("#0F6E56", "white", { marginBottom: 0 })}>Confirm release</button>
      <button onClick={onCancel} style={btn("#f3f4f6", "#555", { marginBottom: 0 })}>Cancel</button>
    </div>
  );
}

function SpotPanel({
  spot, isAdmin,
  editName, setEditName,
  bookingName, setBookingName,
  startDate, endDate,
  onStartChange, onEndChange,
  showReleasePicker, setShowReleasePicker,
  showBookingInput, setShowBookingInput,
  showConfirmRelease, setShowConfirmRelease,
  onClose, onBook, onRelease, onCancelRelease,
  onReleaseBooking, onAdminAssign, onAdminClearOwner,
  onAdminCancelBooking, onAdminReleaseOnBehalf,
}) {
  if (!spot) return null;
  const status = computeStatus(spot);
  const dedicated = isDedicated(spot);
  const c = C[status];

  return (
    <div style={{ background: "white", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.13)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#085041" }}>Spot {spot.id}</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            {dedicated ? `Dedicated — ${spot.owner}` : "Open parking"}
          </div>
          {status === "booked" && (
            <div style={{ fontSize: 12, color: "#B91C1C", fontWeight: 600, marginTop: 3 }}>Booked by {spot.booked_by}</div>
          )}
          {status === "available" && dedicated && spot.released_until && (
            <div style={{ fontSize: 12, color: "#0F6E56", fontWeight: 600, marginTop: 3 }}>
              Released: {fmt(spot.released_from)} – {fmt(spot.released_until)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600, background: c.bg + "22", color: c.bg, border: `1px solid ${c.bg}44` }}>
            {c.label}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#bbb", lineHeight: 1 }}>✕</button>
        </div>
      </div>

      {isAdmin ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ borderBottom: "1px solid #f0f0f0", paddingBottom: 12 }}>
            <p style={{ fontSize: 12, color: "#666", margin: "0 0 6px", fontWeight: 600 }}>Assign owner (leave blank = open parking)</p>
            <input value={editName} onChange={e => setEditName(e.target.value)}
              placeholder="Staff name or leave blank"
              style={{ width: "100%", border: "1px solid #ddd", borderRadius: 6, padding: "8px 10px", fontSize: 13, boxSizing: "border-box", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onAdminAssign} style={{ ...btn("#0F6E56", "white", { marginBottom: 0 }), flex: 1 }}>Save</button>
              {dedicated && (
                <button onClick={onAdminClearOwner} style={{ ...btn("#f3f4f6", "#666", { marginBottom: 0 }), flex: 1 }}>Set as open</button>
              )}
            </div>
          </div>
          {dedicated && status === "reserved" && (
            showReleasePicker ? (
              <DateRangePicker startDate={startDate} endDate={endDate}
                onStartChange={onStartChange} onEndChange={onEndChange}
                onConfirm={onAdminReleaseOnBehalf} onCancel={() => setShowReleasePicker(false)} />
            ) : (
              <button onClick={() => setShowReleasePicker(true)} style={btn("#f3f4f6", "#085041", { marginBottom: 0 })}>
                Release on behalf of staff
              </button>
            )
          )}
          {dedicated && status === "available" && spot.released_until && (
            <button onClick={onCancelRelease} style={btn("#fff4f4", "#B91C1C", { border: "1px solid #fcc", marginBottom: 0 })}>
              Cancel release
            </button>
          )}
          {status === "booked" && (
            <button onClick={onAdminCancelBooking} style={btn("#fff4f4", "#B91C1C", { border: "1px solid #fcc", marginBottom: 0 })}>
              Cancel booking
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {status === "available" && (
            showBookingInput ? (
              <>
                <p style={{ margin: 0, fontSize: 12, color: "#555", fontWeight: 600 }}>Enter your name to book</p>
                <input value={bookingName} onChange={e => setBookingName(e.target.value)}
                  placeholder="Your name" autoFocus
                  style={{ width: "100%", border: "1px solid #ddd", borderRadius: 6, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }} />
                <button onClick={onBook} style={btn("#0F6E56", "white", { marginBottom: 0 })}>Confirm booking</button>
                <button onClick={() => setShowBookingInput(false)} style={btn("#f3f4f6", "#555", { marginBottom: 0 })}>Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => setShowBookingInput(true)} style={btn("#0F6E56", "white", { marginBottom: 0 })}>Book this spot</button>
                <p style={{ margin: 0, fontSize: 11, color: "#aaa", textAlign: "center" }}>Booking is for today only</p>
              </>
            )
          )}
          {status === "reserved" && (
            showReleasePicker ? (
              <DateRangePicker startDate={startDate} endDate={endDate}
                onStartChange={onStartChange} onEndChange={onEndChange}
                onConfirm={onRelease} onCancel={() => setShowReleasePicker(false)} />
            ) : (
              <>
                <div style={{ background: "#FFF8E1", borderRadius: 8, padding: "10px 12px", marginBottom: 4 }}>
                  <p style={{ color: "#92620A", fontWeight: 600, fontSize: 13, margin: "0 0 2px" }}>
                    This is {spot.owner ? spot.owner + "'s" : "a"} spot
                  </p>
                  <p style={{ color: "#92620A", fontSize: 11, margin: 0 }}>Only proceed if this is your assigned spot</p>
                </div>
                <button onClick={() => setShowReleasePicker(true)} style={btn("#085041", "white", { marginBottom: 0 })}>
                  Yes, release my spot
                </button>
              </>
            )
          )}
          {status === "booked" && (
            showConfirmRelease ? (
              <>
                <p style={{ margin: 0, fontSize: 13, color: "#444" }}>Release this spot so others can use it?</p>
                <button onClick={onReleaseBooking} style={btn("#0F6E56", "white", { marginBottom: 0 })}>Yes, release it</button>
                <button onClick={() => setShowConfirmRelease(false)} style={btn("#f3f4f6", "#555", { marginBottom: 0 })}>Cancel</button>
              </>
            ) : (
              <>
                <div style={{ background: "#FEF2F2", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <p style={{ color: "#B91C1C", fontWeight: 600, fontSize: 14, margin: "0 0 2px" }}>Booked by {spot.booked_by}</p>
                  <p style={{ color: "#991818", fontSize: 12, margin: 0 }}>Today only — resets at midnight</p>
                </div>
                <button onClick={() => setShowConfirmRelease(true)} style={btn("#f3f4f6", "#555", { marginBottom: 0 })}>Release this spot</button>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function ParkShare() {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [adminError, setAdminError] = useState(false);
  const [showAdminBox, setShowAdminBox] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [toast, setToast] = useState(null);
  const [editName, setEditName] = useState("");
  const [bookingName, setBookingName] = useState("");
  const [startDate, setStartDate] = useState(todayNZ());
  const [endDate, setEndDate] = useState(todayNZ());
  const [showReleasePicker, setShowReleasePicker] = useState(false);
  const [showBookingInput, setShowBookingInput] = useState(false);
  const [showConfirmRelease, setShowConfirmRelease] = useState(false);

  useEffect(() => {
    fetchSpots().then(data => { setSpots(data); setLoading(false); });
    const interval = setInterval(() => {
      fetchSpots().then(data => setSpots(data));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const updateSpot = async (id, changes) => {
    await updateSpotDB(id, changes);
    setSpots(prev => prev.map(s => s.id === id ? { ...s, ...changes } : s));
    setSelected(prev => prev ? { ...prev, ...changes } : prev);
  };

  const resetPanel = () => {
    setShowReleasePicker(false); setShowBookingInput(false);
    setShowConfirmRelease(false); setBookingName("");
    setStartDate(todayNZ()); setEndDate(todayNZ());
  };

  const selectSpot = (spot) => { setSelected(spot); setEditName(spot.owner || ""); resetPanel(); };
  const handleStartChange = (v) => { setStartDate(v); if (endDate < v) setEndDate(v); };
  const handleEndChange = (v) => { const max = maxEnd(startDate); setEndDate(v > max ? max : v); };

  const handleBook = async () => {
    if (!bookingName.trim() || !selected) return;
    await updateSpot(selected.id, { booked_by: bookingName.trim(), status: "booked" });
    showToast(`${selected.id} booked by ${bookingName.trim()}`);
    resetPanel();
  };
  const handleRelease = async () => {
    if (!selected) return;
    await updateSpot(selected.id, { released_from: startDate, released_until: endDate, booked_by: null, status: "available" });
    showToast(`${selected.id} released: ${fmt(startDate)} – ${fmt(endDate)}`);
    resetPanel();
  };
  const handleCancelRelease = async () => {
    if (!selected) return;
    await updateSpot(selected.id, { released_from: null, released_until: null, booked_by: null, status: "reserved" });
    showToast(`${selected.id} release cancelled`);
    resetPanel();
  };
  const handleReleaseBooking = async () => {
    if (!selected) return;
    const base = computeStatus({ ...selected, booked_by: null });
    await updateSpot(selected.id, { booked_by: null, status: base });
    showToast(`${selected.id} is now available`);
    resetPanel();
  };
  const handleAdminAssign = async () => {
    if (!selected) return;
    const status = editName.trim() ? "reserved" : "available";
    await updateSpot(selected.id, { owner: editName.trim(), status, released_from: null, released_until: null, booked_by: null });
    showToast(`${selected.id} assigned to "${editName.trim() || "open"}"`);
  };
  const handleAdminClearOwner = async () => {
    if (!selected) return;
    await updateSpot(selected.id, { owner: "", status: "available", released_from: null, released_until: null, booked_by: null });
    showToast(`${selected.id} set to open parking`);
  };
  const handleAdminCancelBooking = async () => {
    if (!selected) return;
    const base = computeStatus({ ...selected, booked_by: null });
    await updateSpot(selected.id, { booked_by: null, status: base });
    showToast(`Booking for ${selected.id} cancelled`);
    resetPanel();
  };
  const handleAdminReleaseOnBehalf = async () => {
    if (!selected) return;
    await updateSpot(selected.id, { released_from: startDate, released_until: endDate, booked_by: null, status: "available" });
    showToast(`${selected.id} released: ${fmt(startDate)} – ${fmt(endDate)}`);
    resetPanel();
  };
  const unlockAdmin = () => {
    if (adminInput === ADMIN_CODE) { setIsAdmin(true); setAdminError(false); setShowAdminBox(false); showToast("Admin access granted"); }
    else setAdminError(true);
  };

  const front = spots.filter(s => s.section === "front").sort((a, b) => parseInt(a.id.slice(1)) - parseInt(b.id.slice(1)));
  const back = spots.filter(s => s.section === "back").sort((a, b) => parseInt(a.id.slice(1)) - parseInt(b.id.slice(1)));
  const availCount = spots.filter(s => computeStatus(s) === "available").length;
  const bookedCount = spots.filter(s => computeStatus(s) === "booked").length;
  const reservedCount = spots.filter(s => computeStatus(s) === "reserved").length;

  if (loading) return (
    <div style={{ background: "#0F6E56", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "white", fontSize: 16, fontWeight: 600 }}>Loading ParkShare...</div>
    </div>
  );

  const DRIVEWAY_W = 36;

  return (
    <div style={{ background: "#0F6E56", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 80px" }}>

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
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowRules(true)} style={{ background: "transparent", border: "1px solid #5DCAA5", color: "#5DCAA5", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>Rules</button>
            {isAdmin ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ background: "#1D9E75", color: "white", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600 }}>Admin ✓</span>
                <button onClick={() => { setIsAdmin(false); setAdminInput(""); }} style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>Log out</button>
              </div>
            ) : (
              <button onClick={() => setShowAdminBox(!showAdminBox)} style={{ background: "transparent", border: "1px solid #5DCAA5", color: "#5DCAA5", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}>Admin</button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { label: "available", value: availCount, color: "#1D9E75" },
            { label: "booked", value: bookedCount, color: "#B91C1C" },
            { label: "reserved", value: reservedCount, color: "#9FE1CB" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#085041", borderRadius: 8, padding: "8px 0", flex: 1, textAlign: "center" }}>
              <div style={{ color, fontSize: 20, fontWeight: 800 }}>{value}</div>
              <div style={{ color: "#9FE1CB", fontSize: 10 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Admin unlock */}
        {showAdminBox && !isAdmin && (
          <div style={{ background: "white", borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 13, color: "#085041" }}>Admin access</p>
            <input type="password" placeholder="Enter admin code" value={adminInput}
              onChange={e => { setAdminInput(e.target.value); setAdminError(false); }}
              onKeyDown={e => e.key === "Enter" && unlockAdmin()}
              style={{ width: "100%", border: `1px solid ${adminError ? "#c00" : "#ddd"}`, borderRadius: 6, padding: "8px 10px", fontSize: 13, boxSizing: "border-box", marginBottom: 6 }} />
            {adminError && <p style={{ color: "#c00", fontSize: 12, margin: "0 0 6px" }}>Incorrect code</p>}
            <button onClick={unlockAdmin} style={btn("#0F6E56", "white", { marginBottom: 0 })}>Unlock</button>
          </div>
        )}

        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          {Object.entries(C).map(([key, c]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1px solid ${c.border}` }} />
              <span style={{ fontSize: 11, color: "#9FE1CB" }}>{c.label}</span>
            </div>
          ))}
        </div>

        {/* Parking Map */}
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {/* Left Driveway */}
          <div style={{ width: DRIVEWAY_W, flexShrink: 0, background: "#085041", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#5DCAA5", fontSize: 9, fontWeight: 700, writingMode: "vertical-rl", transform: "rotate(180deg)", letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>
              Driveway
            </span>
          </div>

          {/* Main Area */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>

            {/* Back B1-B7 */}
            <div>
              <p style={{ color: "#9FE1CB", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", margin: "0 0 4px", textAlign: "center" }}>Back parking</p>
              <div style={{ background: "#085041", borderRadius: 8, padding: "8px 6px", border: "1px solid #1D6B56" }}>
                <div style={{ display: "flex", width: "100%" }}>
                  {back.map((s, i) => (
                    <SpotTile key={s.id} spot={s} selected={selected} onSelect={selectSpot} isLast={i === back.length - 1} />
                  ))}
                </div>
              </div>
            </div>

            {/* HQ */}
            <div style={{ background: "#E8DFC8", borderRadius: 8, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#085041", fontWeight: 700, fontSize: 13 }}>Atlas Copco Group HQ</span>
            </div>

            {/* Front F1-F20 */}
            <div>
              <p style={{ color: "#9FE1CB", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", margin: "0 0 4px", textAlign: "center" }}>Front parking</p>
              <div style={{ background: "#085041", borderRadius: 8, padding: "8px 6px", border: "1px solid #1D6B56" }}>
                <div style={{ display: "flex", width: "100%" }}>
                  {front.map((s, i) => (
                    <SpotTile key={s.id} spot={s} selected={selected} onSelect={selectSpot} isLast={i === front.length - 1} />
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Driveway */}
            <div style={{ background: "#085041", borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
              <span style={{ color: "#5DCAA5", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>← Driveway →</span>
            </div>

          </div>
        </div>

        {/* Small vertical driveway — T shape, 5th slot from right */}
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <div style={{ width: DRIVEWAY_W, flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", paddingRight: "211px" }}>
            <div style={{ width: DRIVEWAY_W, background: "#085041", borderRadius: 8, padding: "8px 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#5DCAA5", fontSize: 9, fontWeight: 700, writingMode: "vertical-rl", transform: "rotate(180deg)", letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                Driveway
              </span>
            </div>
          </div>
        </div>

        {/* Great South Road */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <div style={{ width: DRIVEWAY_W, flexShrink: 0 }} />
          <div style={{ flex: 1, background: "#085041", borderRadius: 8, padding: "7px 12px", textAlign: "center" }}>
            <span style={{ color: "#5DCAA5", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Great South Road</span>
          </div>
        </div>

        {/* Spot Panel */}
        <SpotPanel
          spot={selected} isAdmin={isAdmin}
          editName={editName} setEditName={setEditName}
          bookingName={bookingName} setBookingName={setBookingName}
          startDate={startDate} endDate={endDate}
          onStartChange={handleStartChange} onEndChange={handleEndChange}
          showReleasePicker={showReleasePicker} setShowReleasePicker={setShowReleasePicker}
          showBookingInput={showBookingInput} setShowBookingInput={setShowBookingInput}
          showConfirmRelease={showConfirmRelease} setShowConfirmRelease={setShowConfirmRelease}
          onClose={() => { setSelected(null); resetPanel(); }}
          onBook={handleBook} onRelease={handleRelease}
          onCancelRelease={handleCancelRelease} onReleaseBooking={handleReleaseBooking}
          onAdminAssign={handleAdminAssign} onAdminClearOwner={handleAdminClearOwner}
          onAdminCancelBooking={handleAdminCancelBooking}
          onAdminReleaseOnBehalf={handleAdminReleaseOnBehalf}
        />

        {/* Rules Modal */}
        {showRules && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
            <div style={{ background: "white", borderRadius: 14, padding: 20, maxWidth: 320, width: "100%" }}>
              <h3 style={{ margin: "0 0 12px", color: "#085041", fontSize: 16 }}>Parking rules</h3>
              <ul style={{ fontSize: 13, color: "#444", paddingLeft: 18, margin: "0 0 14px", lineHeight: 1.9 }}>
                <li>Dedicated spots are assigned by HR</li>
                <li>Open spots are available to anyone daily</li>
                <li>Book a spot for today only</li>
                <li>Release your dedicated spot for a date range (max 20 days)</li>
                <li>All bookings reset at midnight NZST</li>
                <li>If you leave early, please release your booked spot</li>
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
