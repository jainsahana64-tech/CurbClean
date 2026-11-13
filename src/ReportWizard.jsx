import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";

const STEPS = ["Photo", "Location", "Details", "Review"];
const VEHICLE_TYPES = ["Car", "Bike / Scooter", "Auto", "Truck / Bus", "Other"];
const CONDITIONS = [
  "Flat tyres",
  "Rusted / damaged",
  "Broken windows",
  "Covered in dust or leaves",
  "Overgrown with weeds",
  "Number plate missing",
  "Water collecting inside",
  "Parts stripped",
];
const DURATIONS = ["Less than a week", "1-4 weeks", "1-6 months", "More than 6 months", "Not sure"];

function Spinner() {
  return <span className="inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />;
}

export default function ReportWizard({ onExit, token }) {
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState({ file: null, url: "" });
  const [coords, setCoords] = useState(null);
  const [locStatus, setLocStatus] = useState("idle"); // idle | loading | success | error
  const [locError, setLocError] = useState("");
  const [address, setAddress] = useState("");
  const [plate, setPlate] = useState("");
  const [noPlate, setNoPlate] = useState(false);
  const [vehicleType, setVehicleType] = useState("Car");
  const [conditions, setConditions] = useState([]);
  const [duration, setDuration] = useState("1-4 weeks");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refId, setRefId] = useState("");

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  // Free the preview image memory when the photo changes or the screen closes
  useEffect(() => {
    return () => {
      if (photo.url) URL.revokeObjectURL(photo.url);
    };
  }, [photo.url]);

  const pickPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setPhoto({ file, url: URL.createObjectURL(file) });
    setError("");
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocStatus("error");
      setLocError("This browser cannot share location. Please type the address instead.");
      return;
    }
    setLocStatus("loading");
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("success");
        setError("");
      },
      (err) => {
        setLocStatus("error");
        setLocError(
          err.code === 1
            ? "Location permission was blocked. Allow it in the browser, or type the address instead."
            : "Could not get your location. Please type the address instead."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const toggleCondition = (c) =>
    setConditions((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]));

  const validate = () => {
    if (step === 0 && !photo.file) return "Please add a photo of the vehicle.";
    if (step === 1 && !coords && address.trim().length < 5)
      return "Use your current location or type the address (at least 5 characters).";
    if (step === 2) {
      if (!noPlate && plate.trim().length < 4) return "Type the number plate, or tick 'Plate not visible'.";
      if (conditions.length === 0) return "Select at least one condition that describes the vehicle.";
    }
    return "";
  };

  const next = () => {
    const msg = validate();
    setError(msg);
    if (!msg) setStep((s) => s + 1);
  };

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("image", photo.file);
      if (coords) {
        form.append("latitude", coords.lat);
        form.append("longitude", coords.lng);
      }
      form.append("address", address.trim());
      form.append("plate", plate.trim());
      form.append("noPlate", String(noPlate));
      form.append("vehicleType", vehicleType);
      form.append("conditions", JSON.stringify(conditions));
      form.append("duration", duration);
      form.append("notes", notes.trim());

      const data = await api("/api/reports", { method: "POST", body: form, token });
      setRefId(data.refId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const chip = (active) =>
    `rounded-full border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
      active ? "bg-navy-900 border-navy-900 text-white" : "bg-white border-slate-200 text-navy-700 hover:bg-slate-50"
    }`;

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-mint-400";

  // ---------- Success screen ----------
  if (refId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-navy-900 to-navy-700 text-white flex items-center justify-center px-6">
        <div className="max-w-sm text-center animate-rise">
          <div className="mx-auto w-20 h-20 rounded-full bg-mint-400 text-navy-900 text-4xl font-bold flex items-center justify-center animate-glow">
            ✓
          </div>
          <h2 className="mt-6 text-3xl font-bold">Report submitted!</h2>
          <p className="mt-3 text-slate-300">Your reference number is</p>
          <p className="mt-1 text-3xl font-bold text-mint-400 tracking-wider">{refId}</p>
          <p className="mt-4 text-sm text-slate-300">
            Your report has been saved. Keep this number to follow up with the authorities.
          </p>
          <button onClick={onExit} className="mt-8 rounded-full bg-mint-400 px-8 py-3 font-semibold text-navy-900 cursor-pointer">
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-900 to-navy-700 text-white px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between">
          <button onClick={onExit} className="text-sm text-slate-300 hover:text-white cursor-pointer">✕ Cancel</button>
          <p className="text-sm text-slate-300">Step {step + 1} of 4 · {STEPS[step]}</p>
        </div>

        <div className="mt-3 h-2 rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full rounded-full bg-mint-400 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div key={step} className="mt-5 rounded-3xl bg-white p-6 text-navy-900 shadow-2xl shadow-black/40 animate-rise">
          {/* ---------- Step 1: Photo ---------- */}
          {step === 0 && (
            <div>
              <h2 className="text-2xl font-bold">Take or upload a photo</h2>
              <p className="mt-1 text-sm text-slate-500">A clear shot of the whole vehicle and its number plate helps most.</p>

              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={pickPhoto} className="hidden" />
              <input ref={galleryRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />

              {photo.url ? (
                <img src={photo.url} alt="Selected vehicle" className="mt-4 w-full h-56 rounded-2xl object-cover" />
              ) : (
                <div className="mt-4 flex h-56 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-mint-400 bg-mint-100/50 text-slate-500">
                  <span className="text-4xl">📷</span>
                  <span className="mt-2 text-sm">No photo yet</span>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button onClick={() => cameraRef.current.click()} className="rounded-xl bg-navy-900 py-3 text-sm font-semibold text-white cursor-pointer">
                  Take photo
                </button>
                <button onClick={() => galleryRef.current.click()} className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-navy-700 cursor-pointer">
                  Upload from gallery
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">On a laptop, "Take photo" opens the file picker instead of a camera.</p>
            </div>
          )}

          {/* ---------- Step 2: Location ---------- */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold">Where is the vehicle?</h2>
              <p className="mt-1 text-sm text-slate-500">Share your location, type the address, or both.</p>

              <button onClick={getLocation} className="mt-4 w-full rounded-xl bg-navy-900 py-3 text-sm font-semibold text-white cursor-pointer flex items-center justify-center gap-2">
                {locStatus === "loading" ? (<><Spinner /> Finding you…</>) : "📍 Use my current location"}
              </button>

              {locStatus === "success" && coords && (
                <p className="mt-3 rounded-lg bg-mint-100 px-3 py-2 text-sm text-navy-700">
                  Location locked: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </p>
              )}
              {locStatus === "error" && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{locError}</p>}

              <p className="my-4 text-center text-xs text-slate-400">or type it yourself</p>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Address or landmark</label>
              <textarea
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="E.g. Near the bus stop on 5th Cross, Jayanagar, Bengaluru"
                className={`${inputCls} resize-none`}
              />
            </div>
          )}

          {/* ---------- Step 3: Details ---------- */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold">Tell us about the vehicle</h2>
                <p className="mt-1 text-sm text-slate-500">This helps officials decide how urgent it is.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Number plate</label>
                <input
                  value={plate}
                  disabled={noPlate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="KA 01 AB 1234"
                  className={`${inputCls} font-mono tracking-wider disabled:opacity-40`}
                />
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={noPlate} onChange={(e) => setNoPlate(e.target.checked)} />
                  Plate not visible
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Vehicle type</label>
                <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inputCls}>
                  {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Condition (pick all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => (
                    <button key={c} onClick={() => toggleCondition(c)} className={chip(conditions.includes(c))}>{c}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">How long has it been there?</label>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <button key={d} onClick={() => setDuration(d)} className={chip(duration === d)}>{d}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Extra notes (optional)</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else officials should know…" className={`${inputCls} resize-none`} />
              </div>
            </div>
          )}

          {/* ---------- Step 4: Review ---------- */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold">Review your report</h2>
              {photo.url && <img src={photo.url} alt="Vehicle" className="mt-4 w-full h-40 rounded-2xl object-cover" />}
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ["Location", [coords && `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`, address.trim()].filter(Boolean).join(" · ")],
                  ["Number plate", noPlate ? "Not visible" : plate],
                  ["Vehicle type", vehicleType],
                  ["Condition", conditions.join(", ")],
                  ["Time there", duration],
                  ["Notes", notes.trim() || "None"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <dt className="w-24 shrink-0 text-slate-400">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

          <div className="mt-6 flex gap-3">
            {step > 0 && (
              <button onClick={() => { setError(""); setStep((s) => s - 1); }} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-navy-700 cursor-pointer">
                ← Back
              </button>
            )}
            {step < 3 ? (
              <button onClick={next} className="flex-1 rounded-xl bg-navy-900 py-3 font-semibold text-white hover:bg-navy-700 transition-colors cursor-pointer">
                Next →
              </button>
            ) : (
              <button onClick={submit} disabled={submitting} className="flex-1 rounded-xl bg-mint-400 py-3 font-semibold text-navy-900 disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2">
                {submitting ? (<><Spinner /> Submitting…</>) : "Submit report"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}