// frontend/src/features/fees/AdminFees.jsx

import { useEffect, useState, useMemo } from "react";
import API from "../../api";
import "../../App.css";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";

// ================= HELPERS =================
const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const ini = (name) =>
  (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function getStatus(fee) {
  if (fee.status === "paid") return "paid";
  const today = new Date();
  const due = fee.due_date ? new Date(fee.due_date) : null;
  if (due && due < today) return "overdue";
  return "pending";
}

const STATUS_ORDER = ["overdue", "pending", "paid"];

const SM = {
  paid:    { label: "Paid",    bg: "#dcfce7", color: "#166534", bar: "#16a34a" },
  pending: { label: "Pending", bg: "#fef3c7", color: "#92400e", bar: "#f59e0b" },
  overdue: { label: "Overdue", bg: "#fee2e2", color: "#b91c1c", bar: "#ef4444" },
};

const AV_BG = { paid: "#eaf2fd", pending: "#fef3c7", overdue: "#fee2e2" };
const AV_TC = { paid: "#1d4ed8", pending: "#92400e", overdue: "#b91c1c" };
const GM = {
  overdue: { label: "Overdue", rowBg: "#fef2f2", rowColor: "#b91c1c" },
  pending: { label: "Pending", rowBg: "#fef3c7", rowColor: "#92400e" },
  paid:    { label: "Paid",    rowBg: "#f0fdf4", rowColor: "#166534" },
};

const DEPT_COLORS = ["#10b981","#3b82f6","#8b5cf6","#0ea5e9","#f59e0b","#ef4444","#06b6d4","#84cc16"];

const FEE_TYPES = ["Tuition", "Van fees", "Exam fees", "Lab fees", "Library", "Hostel"];
const YEARS = [1, 2, 3, 4];

// ================= GROUPED LIST =================
function GroupedList({ fees, onEdit, compact = false }) {
  const sorted = [...fees].sort(
    (a, b) => STATUS_ORDER.indexOf(getStatus(a)) - STATUS_ORDER.indexOf(getStatus(b))
  );
  const groups = { overdue: [], pending: [], paid: [] };
  sorted.forEach((f) => { const s = getStatus(f); if (groups[s]) groups[s].push(f); });

  if (!fees.length) return (
    <div style={{ padding: 30, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
      No students found
    </div>
  );

  return (
    <>
      {STATUS_ORDER.map((g) => {
        if (!groups[g].length) return null;
        const m = GM[g];
        return (
          <div key={g}>
            <div style={{
              padding: "8px 18px", fontSize: 10, fontWeight: 700,
              letterSpacing: ".07em", textTransform: "uppercase",
              background: m.rowBg, color: m.rowColor,
              borderBottom: "1px solid #f1f5f9",
            }}>
              {m.label} — {groups[g].length} student{groups[g].length > 1 ? "s" : ""}
            </div>
            {groups[g].map((fee) => (
              <StuRow key={fee.id} fee={fee} onEdit={onEdit} compact={compact} />
            ))}
          </div>
        );
      })}
    </>
  );
}

// ================= STUDENT ROW =================
function StuRow({ fee, onEdit, compact }) {
  const status = getStatus(fee);
  const m = SM[status];
  const pct = fee.status === "paid" ? 100 :
    fee.amount > 0 ? Math.round((Number(fee.paid_amount || 0) / Number(fee.amount)) * 100) : 0;

  return (
    <div style={{
      display: "flex", alignItems: "center",
      padding: compact ? "9px 0" : "12px 18px",
      borderBottom: "1px solid #f8fafc",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        background: AV_BG[status] || "#f1f5f9", color: AV_TC[status] || "#374151",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, flexShrink: 0, marginRight: 12,
      }}>
        {ini(fee.student_name || "?")}
      </div>
      <div style={{ minWidth: 110 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
          {fee.student_name || "Student"}
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
          {fee.department || "—"}
        </div>
      </div>
      <div style={{ flex: 1, margin: "0 16px" }}>
        <div style={{ fontSize: 11, color: "#64748b" }}>{fee.term || "—"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 4, background: "#e5e7eb" }}>
            <div style={{ height: 4, borderRadius: 4, background: m.bar, width: `${pct}%` }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, minWidth: 28, color: m.bar }}>{pct}%</span>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{money(fee.amount)}</div>
        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Due: {fee.due_date || "—"}</div>
        {fee.extended_date && (
          <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>Ext: {fee.extended_date}</div>
        )}
        <span style={{
          display: "inline-block", padding: "3px 10px", borderRadius: 20,
          fontSize: 10, fontWeight: 700, marginTop: 4,
          background: m.bg, color: m.color,
        }}>
          {m.label}
        </span>
      </div>
      <button
        onClick={() => onEdit(fee)}
        style={{
          padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0",
          background: "#fff", fontSize: 11, cursor: "pointer", color: "#374151", marginLeft: 10,
        }}
      >
        ✏️
      </button>
    </div>
  );
}

// ================= CSV DOWNLOAD =================
function downloadCSV(fees, filename) {
  const header = "Name,Department,Term,Total (₹),Due Date,Extended Date,Status\n";
  const rows = fees.map((f) => {
    const s = getStatus(f);
    return `"${f.student_name || ""}","${f.department || ""}","${f.term || ""}",${f.amount},"${f.due_date || ""}","${f.extended_date || "-"}","${SM[s]?.label || s}"`;
  });
  const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ================= DEPT MODAL =================
function DeptModal({ dept, fees, onClose, onEdit }) {
  const [mf, setMf] = useState("all");

  const dFees = dept.filter ? fees.filter((f) => f.department === dept.filter) : fees;
  const filtered = mf === "all" ? dFees : dFees.filter((f) => getStatus(f) === mf);
  const counts = {
    overdue: dFees.filter((f) => getStatus(f) === "overdue").length,
    pending: dFees.filter((f) => getStatus(f) === "pending").length,
    paid:    dFees.filter((f) => f.status === "paid").length,
  };
  const dlFees = mf === "all"
    ? dFees.filter((f) => getStatus(f) !== "paid")
    : filtered.filter((f) => getStatus(f) !== "paid");

  const pills = [
    { key: "all",     bg: "#f1f5f9", color: "#0f172a", border: "#0f172a", label: `All (${dFees.length})` },
    { key: "overdue", bg: "#fee2e2", color: "#b91c1c", border: "#dc2626", label: `Overdue (${counts.overdue})` },
    { key: "pending", bg: "#fef3c7", color: "#92400e", border: "#f59e0b", label: `Pending (${counts.pending})` },
    { key: "paid",    bg: "#dcfce7", color: "#166534", border: "#16a34a", label: `Paid (${counts.paid})` },
  ];

  const dlLabel = mf === "paid" ? null
    : mf === "all" ? "Download unpaid & pending"
    : `Download ${mf} list`;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 620,
        maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{dept.name}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {dFees.length} students · filter by status below
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {dlLabel && (
                <button
                  onClick={() => downloadCSV(dlFees, `${(dept.filter || "all").replace(/\s+/g, "-").toLowerCase()}-${mf}-fees.csv`)}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #d5e8fe",
                    background: "#eff6ff", fontSize: 11, fontWeight: 600, cursor: "pointer",
                    color: "#1d4ed8", display: "flex", alignItems: "center", gap: 5 }}
                >
                  ⬇ {dlLabel}
                </button>
              )}
              <button onClick={onClose}
                style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #e2e8f0",
                  background: "#f8fafc", cursor: "pointer", fontSize: 16, color: "#64748b",
                  display: "flex", alignItems: "center", justifyContent: "center" }}
              >✕</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {pills.map((p) => (
              <button key={p.key} onClick={() => setMf(p.key)}
                style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", background: p.bg, color: p.color,
                  border: `2px solid ${mf === p.key ? p.border : "transparent"}`, transition: ".15s" }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: "10px 18px", overflowY: "auto", flex: 1 }}>
          <GroupedList fees={filtered} onEdit={onEdit} compact />
        </div>
      </div>
    </div>
  );
}

// ================= GENERATE FEES FORM (bulk by course + year) =================
function GenerateFeeForm({ courses, onClose, onGenerate }) {
  const [form, setForm] = useState({
    course: "", year: "", fee_type: "", amount: "", due_date: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8,
    border: "1px solid #e2e8f0", fontSize: 13, color: "#0f172a", boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 };

  const ready = form.course && form.year && form.fee_type && form.amount;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 1100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 480, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #f1f5f9",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Add Fees</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Applied to every student in the chosen course &amp; year
            </div>
          </div>
          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #e2e8f0",
              background: "#f8fafc", cursor: "pointer", fontSize: 16, color: "#64748b",
              display: "flex", alignItems: "center", justifyContent: "center" }}
          >✕</button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Course</label>
            <select style={inputStyle} value={form.course} onChange={(e) => set("course", e.target.value)}>
              <option value="">— Select course —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Year</label>
              <select style={inputStyle} value={form.year} onChange={(e) => set("year", e.target.value)}>
                <option value="">— Year —</option>
                {YEARS.map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fee type</label>
              <select style={inputStyle} value={form.fee_type} onChange={(e) => set("fee_type", e.target.value)}>
                <option value="">— Type —</option>
                {FEE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Amount (₹)</label>
            <input style={inputStyle} type="number" placeholder="e.g. 25000"
              value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </div>

          <div style={{ marginBottom: 4 }}>
            <label style={labelStyle}>Due date</label>
            <input style={inputStyle} type="date" value={form.due_date}
              onChange={(e) => set("due_date", e.target.value)} />
          </div>
        </div>

        <div style={{ padding: "0 20px 20px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose}
            style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid #e2e8f0",
              background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}
          >Cancel</button>
          <button
            disabled={!ready}
            onClick={() => onGenerate(form)}
            style={{ padding: "9px 18px", borderRadius: 10, border: "none",
              background: ready ? "#0f172a" : "#94a3b8", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: ready ? "pointer" : "not-allowed" }}
          >
            Generate fees
          </button>
        </div>
      </div>
    </div>
  );
}

// ================= EDIT ONE FEE =================
function FeeForm({ fee, onClose, onSave }) {
  const [form, setForm] = useState({
    term:          fee?.term || "",
    amount:        fee?.amount || "",
    due_date:      fee?.due_date || "",
    extended_date: fee?.extended_date || "",
    status:        fee?.status || "pending",
    paid_date:     fee?.paid_date || "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8,
    border: "1px solid #e2e8f0", fontSize: 13, color: "#0f172a", boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 1100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 480, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #f1f5f9",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Edit Fee</div>
          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #e2e8f0",
              background: "#f8fafc", cursor: "pointer", fontSize: 16, color: "#64748b",
              display: "flex", alignItems: "center", justifyContent: "center" }}
          >✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* student is fixed on an existing fee — show read-only */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Student</label>
            <div style={{ ...inputStyle, background: "#f8fafc", color: "#475569" }}>
              {fee?.student_name || "Student"}{fee?.department ? ` · ${fee.department}` : ""}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Fee type</label>
            <select style={inputStyle} value={form.term} onChange={(e) => set("term", e.target.value)}>
              <option value="">— Select —</option>
              {FEE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Amount (₹)</label>
            <input style={inputStyle} type="number" value={form.amount}
              onChange={(e) => set("amount", e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Due date</label>
              <input style={inputStyle} type="date" value={form.due_date}
                onChange={(e) => set("due_date", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Extended date <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span></label>
              <input style={inputStyle} type="date" value={form.extended_date}
                onChange={(e) => set("extended_date", e.target.value)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            {form.status === "paid" && (
              <div>
                <label style={labelStyle}>Paid date</label>
                <input style={inputStyle} type="date" value={form.paid_date}
                  onChange={(e) => set("paid_date", e.target.value)} />
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "0 20px 20px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose}
            style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid #e2e8f0",
              background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}
          >Cancel</button>
          <button onClick={() => onSave(form, fee.id)}
            style={{ padding: "9px 18px", borderRadius: 10, border: "none",
              background: "#0f172a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Update Fee
          </button>
        </div>
      </div>
    </div>
  );
}

// ================= MAIN =================
export default function AdminFees() {
  const [fees,    setFees]    = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [termFilter,   setTermFilter]   = useState("all");
  const [search,       setSearch]       = useState("");

  const [activeDept,   setActiveDept]   = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [editingFee,   setEditingFee]   = useState(null);

  const [open, setOpen] = useState(false);   // sidebar (mobile)

  useEffect(() => {
    fetchFees();
    fetchCourses();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchFees = async () => {
    try {
      setLoading(true);
      const res = await API.get("fees/");
      const data = res.data?.results || res.data;
      setFees(Array.isArray(data) ? data : []);
    } catch {
      showToast("❌ Failed to load fees");
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await API.get("courses/");
      const data = res.data?.results || res.data;
      setCourses(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  };

  // ================= BULK GENERATE =================
  const handleGenerate = async (form) => {
    try {
      const res = await API.post("generate-fees/", {
        course:   form.course,
        year:     form.year,
        fee_type: form.fee_type,
        amount:   form.amount,
        due_date: form.due_date || null,
      });
      showToast("✅ " + (res.data?.message || "Fees generated"));
      setShowGenerate(false);
      fetchFees();
    } catch (err) {
      showToast("❌ " + (err.response?.data?.detail || "Failed to generate fees"));
    }
  };

  // ================= EDIT ONE =================
  const handleSave = async (form, editId) => {
    try {
      const payload = {
        term:          form.term,
        amount:        form.amount,
        due_date:      form.due_date      || null,
        extended_date: form.extended_date || null,
        status:        form.status,
        paid_date:     form.status === "paid" ? (form.paid_date || null) : null,
      };
      await API.patch(`fees/${editId}/`, payload);
      showToast("✅ Fee updated");
      setEditingFee(null);
      fetchFees();
    } catch {
      showToast("❌ Failed to save fee");
    }
  };

  const handleEdit = (fee) => {
    setEditingFee(fee);
    setActiveDept(null);
  };

  // ================= COMPUTED =================
  const enriched = useMemo(() =>
    fees.map((f) => ({
      ...f,
      department:   f.department || f.student_department || "Unknown",
      student_name: f.student_name || "Student",
    })), [fees]
  );

  const deptNames = useMemo(() => {
    const names = [...new Set(enriched.map((f) => f.department).filter(Boolean))];
    return names.sort();
  }, [enriched]);

  const depts = useMemo(() => [
    { name: "All departments", filter: null },
    ...deptNames.map((n) => ({ name: n, filter: n })),
  ], [deptNames]);

  const terms = useMemo(() => {
    const t = [...new Set(fees.map((f) => f.term).filter(Boolean))];
    return t.sort();
  }, [fees]);

  const stats = useMemo(() => {
    const total   = fees.reduce((s, f) => s + Number(f.amount || 0), 0);
    const paid    = fees.filter((f) => f.status === "paid").reduce((s, f) => s + Number(f.amount || 0), 0);
    const pending = fees.filter((f) => getStatus(f) === "pending").reduce((s, f) => s + Number(f.amount || 0), 0);
    const overdue = fees.filter((f) => getStatus(f) === "overdue").reduce((s, f) => s + Number(f.amount || 0), 0);
    return {
      total, paid, pending, overdue,
      paidCnt:    fees.filter((f) => f.status === "paid").length,
      pendingCnt: fees.filter((f) => getStatus(f) === "pending").length,
      overdueCnt: fees.filter((f) => getStatus(f) === "overdue").length,
    };
  }, [fees]);

  const filtered = useMemo(() =>
    enriched.filter((f) => {
      if (statusFilter !== "all" && getStatus(f) !== statusFilter) return false;
      if (termFilter   !== "all" && f.term !== termFilter)         return false;
      if (search && !(f.student_name || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }), [enriched, statusFilter, termFilter, search]
  );

  // ================= RENDER =================
  return (
    <div className="app">
      <Navbar setOpen={setOpen} />
      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />
        <div className="main">
          <div className="content">
            <div style={{ background: "#f0f4ff", borderRadius: 16, padding: 5 }}>

              {/* ── TITLE ROW ── */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Fee Management</div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Track and manage all student payments</div>
                </div>
                <button
                  onClick={() => setShowGenerate(true)}
                  style={{ padding: "10px 20px", background: "#0f172a", color: "#fff", border: "none",
                    borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6 }}
                >
                  + Add Fees
                </button>
              </div>

              {/* ── SUMMARY CARDS ── */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
                {[
                  { key: "all",     label: "Total Fees", val: money(stats.total),   sub: `${fees.length} fees`,          color: "#0f172a", accent: "#2563eb" },
                  { key: "paid",    label: "Collected",  val: money(stats.paid),    sub: `${stats.paidCnt} paid`,        color: "#15803d", accent: "#15803d" },
                  { key: "pending", label: "Pending",    val: money(stats.pending), sub: `${stats.pendingCnt} students`, color: "#ea580c", accent: "#ea580c" },
                  { key: "overdue", label: "Overdue",    val: money(stats.overdue), sub: `${stats.overdueCnt} students`, color: "#dc2626", accent: "#dc2626" },
                ].map((c) => (
                  <div key={c.key}
                    onClick={() => setStatusFilter(statusFilter === c.key ? "all" : c.key)}
                    style={{ background: "#fff", borderRadius: 14, padding: "16px 18px",
                      border: "1px solid #e8edf8", cursor: "pointer", transition: ".15s",
                      borderBottom: `3px solid ${statusFilter === c.key ? c.accent : "transparent"}` }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: c.color, marginBottom: 6 }}>{c.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.val}</div>
                    <div style={{ fontSize: 11, marginTop: 4, fontWeight: 500, color: c.color }}>{c.sub}</div>
                  </div>
                ))}
              </div>

              {/* ── DEPARTMENT CARDS ── */}
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
                Departments — click a card to view students
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
                {depts.map((d, i) => {
                  const dFees = d.filter ? enriched.filter((f) => f.department === d.filter) : enriched;
                  const total = dFees.reduce((s, f) => s + Number(f.amount || 0), 0);
                  const paid  = dFees.filter((f) => f.status === "paid").reduce((s, f) => s + Number(f.amount || 0), 0);
                  const pct   = total > 0 ? Math.round((paid / total) * 100) : 0;
                  const c = {
                    overdue: dFees.filter((f) => getStatus(f) === "overdue").length,
                    pending: dFees.filter((f) => getStatus(f) === "pending").length,
                    paid:    dFees.filter((f) => f.status === "paid").length,
                  };
                  const accent = DEPT_COLORS[i % DEPT_COLORS.length];
                  return (
                    <div key={d.name}
                      onClick={() => setActiveDept(d)}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                      style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edf8",
                        borderTop: `3px solid ${accent}`, padding: 16, cursor: "pointer", transition: ".2s" }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>{d.name}</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                        {c.overdue > 0 && <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "#fee2e2", color: "#b91c1c" }}>{c.overdue} overdue</span>}
                        {c.pending > 0 && <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "#fef3c7", color: "#92400e" }}>{c.pending} pending</span>}
                        {c.paid    > 0 && <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "#dcfce7", color: "#166534" }}>{c.paid} paid</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                        Total: {money(total)} · {pct}% collected
                      </div>
                      <div style={{ height: 5, borderRadius: 4, background: "#e5e7eb" }}>
                        <div style={{ height: 5, borderRadius: 4, background: accent, width: `${pct}%` }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8 }}>↗ Click to view students</div>
                    </div>
                  );
                })}
              </div>

              {/* ── STUDENT LIST ── */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edf8", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 18px", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                    All students — fee status
                    {loading && <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>Loading…</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, color: "#374151", background: "#f8fafc" }}
                    >
                      <option value="all">All fee types</option>
                      {terms.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input placeholder="Search student…" value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, color: "#374151", background: "#f8fafc", width: 150 }}
                    />
                  </div>
                </div>
                <GroupedList fees={filtered} onEdit={handleEdit} />
              </div>

              {/* ── DEPT MODAL ── */}
              {activeDept && (
                <DeptModal dept={activeDept} fees={enriched}
                  onClose={() => setActiveDept(null)} onEdit={handleEdit} />
              )}

              {/* ── GENERATE FORM ── */}
              {showGenerate && (
                <GenerateFeeForm courses={courses}
                  onClose={() => setShowGenerate(false)} onGenerate={handleGenerate} />
              )}

              {/* ── EDIT FORM ── */}
              {editingFee && (
                <FeeForm fee={editingFee}
                  onClose={() => setEditingFee(null)} onSave={handleSave} />
              )}

              {/* ── TOAST ── */}
              {toast && (
                <div style={{ position: "fixed", bottom: 24, right: 24, background: "#0f172a", color: "#fff",
                  padding: "12px 20px", borderRadius: 12, fontSize: 13, zIndex: 9999, fontWeight: 500 }}>
                  {toast}
                </div>
              )}

            </div>{/* colored */}
          </div>{/* content */}
        </div>{/* main */}
      </div>{/* layout */}
    </div>
  );
}