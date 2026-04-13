import { useState } from "react";
import Modal from "./Modal";
import FieldGroup from "./FieldGroup";
import styles from './SettingsModal.module.css';

const ROLE_LEVELS = ["junior", "mid", "mid-senior", "senior", "staff"];
const GERMAN_LEVELS = ["none", "basic", "conversational", "fluent"];

export default function SettingsModal({ open, onClose, profile, defaultProfile, onSave }) {
  const [form, setForm] = useState(() => ({ ...profile }));
  const [lookupStatus, setLookupStatus] = useState(null); // null | "loading" | "ok" | "error"

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const updateHome = (k, v) => setForm(p => ({ ...p, home: { ...p.home, [k]: v } }));

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  const handleLoadSample = () => {
    setForm({ ...defaultProfile });
  };

  const handleLookupAddress = async () => {
    const addr = form.home?.address;
    if (!addr || addr.trim().length < 3) return;
    setLookupStatus("loading");
    try {
      const q = encodeURIComponent(`${addr}, Vienna, Austria`);
      // Nominatim rate limits apply — see https://operations.osmfoundation.org/policies/nominatim/
      const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&addressdetails=1`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (data.length > 0) {
        const lat = Math.round(parseFloat(data[0].lat) * 10000) / 10000;
        const lng = Math.round(parseFloat(data[0].lon) * 10000) / 10000;
        setForm(p => ({ ...p, home: { ...p.home, lat, lng } }));
        setLookupStatus("ok");
      } else {
        setLookupStatus("error");
      }
    } catch {
      setLookupStatus("error");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Profile Settings">
      <div className={styles.grid2}>
        <FieldGroup label="Years of Experience">
          <input
            type="number"
            min="0"
            className={styles.input}
            value={form.yearsExperience ?? ""}
            onChange={e => update("yearsExperience", parseInt(e.target.value) || 0)}
          />
        </FieldGroup>
        <FieldGroup label="Role Level">
          <select
            className={styles.input}
            value={form.roleLevel || "mid"}
            onChange={e => update("roleLevel", e.target.value)}
            aria-label="Role level"
          >
            {ROLE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </FieldGroup>
      </div>
      <FieldGroup label="German Level">
        <select
          className={styles.input}
          value={form.germanLevel || "none"}
          onChange={e => update("germanLevel", e.target.value)}
          aria-label="German level"
        >
          {GERMAN_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </FieldGroup>
      <div className={styles.grid3}>
        <FieldGroup label="Salary Floor (€k)">
          <input
            type="number"
            className={styles.input}
            value={form.salaryFloor ?? ""}
            onChange={e => update("salaryFloor", parseInt(e.target.value) || 0)}
          />
        </FieldGroup>
        <FieldGroup label="Salary Target (€k)">
          <input
            type="number"
            className={styles.input}
            value={form.salaryTarget ?? ""}
            onChange={e => update("salaryTarget", parseInt(e.target.value) || 0)}
          />
        </FieldGroup>
        <FieldGroup label="Salary Stretch (€k)">
          <input
            type="number"
            className={styles.input}
            value={form.salaryStretch ?? ""}
            onChange={e => update("salaryStretch", parseInt(e.target.value) || 0)}
          />
        </FieldGroup>
      </div>
      <div className={styles.sectionHeader}>Home Location</div>
      <FieldGroup label="Address">
        <div className={styles.addressRow}>
          <input
            className={styles.input}
            value={form.home?.address || ""}
            onChange={e => { updateHome("address", e.target.value); setLookupStatus(null); }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleLookupAddress(); } }}
            placeholder="e.g. Rennweg 97, 1030 Wien"
          />
          <button
            onClick={handleLookupAddress}
            disabled={lookupStatus === "loading"}
            className={styles.lookupButton}
          >
            {lookupStatus === "loading" ? "..." : "Lookup"}
          </button>
        </div>
        {lookupStatus === "ok" && (
          <div className={styles.lookupSuccess}>Coordinates updated</div>
        )}
        {lookupStatus === "error" && (
          <div className={styles.lookupError}>Address not found -- try a more specific address</div>
        )}
      </FieldGroup>
      <div className={styles.grid2}>
        <FieldGroup label="Latitude">
          <input
            type="number"
            step="0.0001"
            className={styles.input}
            value={form.home?.lat ?? ""}
            onChange={e => updateHome("lat", parseFloat(e.target.value) || 0)}
          />
        </FieldGroup>
        <FieldGroup label="Longitude">
          <input
            type="number"
            step="0.0001"
            className={styles.input}
            value={form.home?.lng ?? ""}
            onChange={e => updateHome("lng", parseFloat(e.target.value) || 0)}
          />
        </FieldGroup>
      </div>
      <div className={styles.coordHint}>
        You can also drag the home pin on the map to set your location.
      </div>
      <div className={styles.actions}>
        <button onClick={handleLoadSample} className={styles.sampleButton}>Load sample profile</button>
        <button onClick={onClose} className={styles.cancelButton}>Cancel</button>
        <button onClick={handleSave} className={styles.saveButton}>Save</button>
      </div>
    </Modal>
  );
}
