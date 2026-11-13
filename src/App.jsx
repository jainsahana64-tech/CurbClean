import { useEffect, useState } from "react";
import ReportWizard from "./ReportWizard.jsx";
import { api, getToken, saveToken } from "./api.js";

function Logo({ size = "w-28 h-24" }) {
  return (
    <div className="mx-auto w-fit rounded-3xl bg-white p-3 shadow-xl shadow-black/30">
      <img src="/curbclear-logo.png" alt="CurbClear logo" className={`${size} object-contain`} />
    </div>
  );
}

function Skyline() {
  const bars = [
    { x: 0, h: 70 }, { x: 40, h: 110 }, { x: 80, h: 85 }, { x: 125, h: 130 },
    { x: 170, h: 95 }, { x: 215, h: 120 }, { x: 260, h: 75 }, { x: 305, h: 105 },
  ];
  return (
    <svg viewBox="0 0 360 140" className="w-full max-w-md opacity-40" preserveAspectRatio="xMidYMax meet">
      {bars.map((b) => (
        <rect key={b.x} x={b.x} y={140 - b.h} width="34" height={b.h} rx="3" fill="#19376d" />
      ))}
    </svg>
  );
}

function Shell({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-navy-900 via-navy-700 to-navy-900 text-white flex flex-col items-center justify-center px-6 py-10">
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-mint-400/20 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-mint-400/10 blur-3xl" />
      <div className="relative w-full flex flex-col items-center">{children}</div>
      <div className="pointer-events-none absolute bottom-0 inset-x-0 flex justify-center">
        <Skyline />
      </div>
    </div>
  );
}

function Welcome({ onStart }) {
  return (
    <Shell>
      <div className="animate-float">
        <Logo size="w-32 h-28" />
      </div>
      <h1 className="mt-6 text-5xl font-bold tracking-tight animate-rise text-center">CurbClear</h1>
      <p className="mt-3 text-mint-400 text-lg animate-rise">Your city. Cleared.</p>
      <p className="mt-4 max-w-sm text-center text-slate-300 animate-rise">
        Spot an abandoned vehicle? Report it in under a minute and help keep your streets safe and clean.
      </p>
      <button
        onClick={onStart}
        className="mt-8 rounded-full bg-mint-400 px-8 py-3 font-semibold text-navy-900 animate-glow hover:scale-105 transition-transform cursor-pointer"
      >
        Get started
      </button>
    </Shell>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, error }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border px-4 py-3 text-navy-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-mint-400 ${
          error ? "border-rose-400" : "border-slate-200"
        }`}
      />
      {error && <span className="block text-xs text-rose-500 mt-1">{error}</span>}
    </label>
  );
}

function Auth({ onDone, onBack }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const e = {};
    if (mode === "signup" && !form.name.trim()) e.name = "Please enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email address.";
    if (form.password.length < 6) e.password = "Password must be at least 6 characters.";
    if (mode === "signup" && form.confirm !== form.password) e.confirm = "Passwords do not match.";
    setErrors(e);
    setServerError("");
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      const data =
        mode === "signup"
          ? await api("/api/auth/register", {
              method: "POST",
              body: { name: form.name, email: form.email, password: form.password },
            })
          : await api("/api/auth/login", {
              method: "POST",
              body: { email: form.email, password: form.password },
            });
      onDone(data.user, data.token);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <button onClick={onBack} className="self-start mb-4 text-sm text-slate-300 hover:text-white cursor-pointer">
        ← Back
      </button>
      <div className="w-full max-w-sm animate-rise">
        <div className="flex items-center gap-3 mb-5">
          <div className="rounded-xl bg-white p-1.5">
            <img src="/curbclear-logo.png" alt="" className="w-10 h-8 object-contain" />
          </div>
          <div>
            <p className="font-bold text-xl leading-tight">CurbClear</p>
            <p className="text-xs text-mint-400">Your city. Cleared.</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 text-navy-900 shadow-2xl shadow-black/40">
          <div className="grid grid-cols-2 rounded-full bg-slate-100 p-1 mb-5">
            {["login", "signup"].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErrors({}); setServerError(""); }}
                className={`rounded-full py-2 text-sm font-semibold transition-colors cursor-pointer ${
                  mode === m ? "bg-navy-900 text-white" : "text-slate-500"
                }`}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {mode === "signup" && (
              <Field label="Full name" value={form.name} onChange={set("name")} placeholder="Your name" error={errors.name} />
            )}
            <Field label="Email address" type="email" value={form.email} onChange={set("email")} placeholder="name@email.com" error={errors.email} />
            <Field label="Password" type="password" value={form.password} onChange={set("password")} placeholder="At least 6 characters" error={errors.password} />
            {mode === "signup" && (
              <Field label="Confirm password" type="password" value={form.confirm} onChange={set("confirm")} placeholder="Type it again" error={errors.confirm} />
            )}
          </div>

          {serverError && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{serverError}</p>}

          <button
            onClick={submit}
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-navy-900 py-3 font-semibold text-white hover:bg-navy-700 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>

          <p className="text-center text-xs text-slate-400 my-3">or</p>
          <button
            onClick={() => onDone({ name: "Guest" }, null)}
            className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-navy-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Continue as guest
          </button>
        </div>
      </div>
    </Shell>
  );
}

function MyReports({ token }) {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    if (!token) return;
    api("/api/reports/mine", { token })
      .then((data) => setReports(data.reports))
      .catch(() => setReports([]));
  }, [token]);

  if (!token || reports.length === 0) return null;
  return (
    <div className="mt-8 space-y-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-mint-400">Your reports</p>
      {reports.slice(0, 5).map((r) => (
        <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur">
          <img src={r.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{r.refId}</p>
            <p className="truncate text-xs text-slate-300">
              {r.vehicleType} · {r.address || "GPS location"}
            </p>
          </div>
          <span className="rounded-full bg-mint-400/20 px-3 py-1 text-xs font-semibold text-mint-400">{r.status}</span>
        </div>
      ))}
    </div>
  );
}

function Home({ name, token, onReport, onLogout }) {
  const facts = [
    { icon: "🦟", title: "Disease risk", text: "Rain water collects inside old vehicles, and mosquitoes that spread dengue breed in it." },
    { icon: "🪪", title: "Plate misuse", text: "Abandoned number plates can be stolen and used on other vehicles." },
    { icon: "🚧", title: "Blocked streets", text: "Unused vehicles take up parking and block roads and footpaths." },
  ];
  return (
    <Shell>
      <div className="animate-rise w-full max-w-md text-center">
        <Logo size="w-20 h-16" />
        <h2 className="mt-6 text-3xl font-bold">Hi, {name}!</h2>
        <p className="mt-2 text-slate-300">See a vehicle that has not moved for a long time? Let the city know.</p>
        <button
          onClick={onReport}
          className="mt-6 w-full rounded-2xl bg-mint-400 py-4 text-lg font-semibold text-navy-900 animate-glow hover:scale-[1.02] transition-transform cursor-pointer"
        >
          Start a new report
        </button>

        <MyReports token={token} />

        <div className="mt-8 space-y-3 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-mint-400">Why it matters</p>
          {facts.map((f) => (
            <div key={f.title} className="flex gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <p className="font-semibold">{f.title}</p>
                <p className="text-sm text-slate-300">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onLogout} className="mt-8 rounded-full border border-white/30 px-6 py-2 text-sm hover:bg-white/10 transition-colors cursor-pointer">
          Log out
        </button>
      </div>
    </Shell>
  );
}

export default function App() {
  const [screen, setScreen] = useState(getToken() ? "loading" : "welcome"); // loading | welcome | auth | home | report
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // If the user logged in before, restore their session
  useEffect(() => {
    const saved = getToken();
    if (!saved) return;
    api("/api/auth/me", { token: saved })
      .then((data) => {
        setUser(data.user);
        setToken(saved);
        setScreen("home");
      })
      .catch(() => {
        saveToken(null);
        setScreen("welcome");
      });
  }, []);

  const handleDone = (u, t) => {
    saveToken(t);
    setUser(u);
    setToken(t);
    setScreen("home");
  };

  const handleLogout = () => {
    saveToken(null);
    setUser(null);
    setToken(null);
    setScreen("welcome");
  };

  if (screen === "loading")
    return (
      <Shell>
        <p className="text-slate-300">Loading…</p>
      </Shell>
    );
  if (screen === "auth") return <Auth onBack={() => setScreen("welcome")} onDone={handleDone} />;
  if (screen === "report") return <ReportWizard token={token} onExit={() => setScreen("home")} />;
  if (screen === "home")
    return <Home name={user?.name || "there"} token={token} onReport={() => setScreen("report")} onLogout={handleLogout} />;
  return <Welcome onStart={() => setScreen("auth")} />;
}