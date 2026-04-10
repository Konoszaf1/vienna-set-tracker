import { useState } from "react";
import { STATUS_OPTIONS, CULTURE_OPTIONS } from "../constants";
import FieldGroup from "./FieldGroup";
import styles from './CompanyForm.module.css';

export default function CompanyForm({ company, onSave, onCancel }) {
  const [form, setForm] = useState(company || {
    id: Date.now().toString(), name: "", logo: "🏢", district: "", address: "",
    lat: 48.2082, lng: 16.3738, langReq: "de-basic",
    kununuRating: null, glassdoorRating: null, cultureTags: [],
    techStack: [], languages: ["English"], notes: "", status: "interested",
    jobUrl: "", industry: "",
  });
  const [techInput, setTechInput] = useState("");

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.grid2}>
        <FieldGroup label="Company Name">
          <input className={styles.input} value={form.name} onChange={e => update("name", e.target.value)} placeholder="e.g. Bitpanda" required />
        </FieldGroup>
        <FieldGroup label="Emoji Logo">
          <input className={styles.input} value={form.logo} onChange={e => update("logo", e.target.value)} placeholder="🏢" />
        </FieldGroup>
      </div>
      <div className={styles.grid2}>
        <FieldGroup label="District">
          <input className={styles.input} value={form.district} onChange={e => update("district", e.target.value)} placeholder="e.g. 9th - Alsergrund" />
        </FieldGroup>
        <FieldGroup label="Industry">
          <input className={styles.input} value={form.industry} onChange={e => update("industry", e.target.value)} placeholder="e.g. FinTech" />
        </FieldGroup>
      </div>
      <FieldGroup label="Address">
        <input className={styles.input} value={form.address} onChange={e => update("address", e.target.value)} placeholder="Full address" />
      </FieldGroup>
      <div className={styles.grid2}>
        <FieldGroup label="Latitude">
          <input type="number" step="0.0001" className={styles.input} value={form.lat} onChange={e => update("lat", parseFloat(e.target.value) || 0)} />
        </FieldGroup>
        <FieldGroup label="Longitude">
          <input type="number" step="0.0001" className={styles.input} value={form.lng} onChange={e => update("lng", parseFloat(e.target.value) || 0)} />
        </FieldGroup>
      </div>
      <div className={styles.grid2}>
        <FieldGroup label="Kununu Rating">
          <input type="number" step="0.1" min="0" max="5" className={styles.input} value={form.kununuRating ?? ""} onChange={e => update("kununuRating", e.target.value ? parseFloat(e.target.value) : null)} placeholder="0-5" />
        </FieldGroup>
        <FieldGroup label="Glassdoor Rating">
          <input type="number" step="0.1" min="0" max="5" className={styles.input} value={form.glassdoorRating ?? ""} onChange={e => update("glassdoorRating", e.target.value ? parseFloat(e.target.value) : null)} placeholder="0-5" />
        </FieldGroup>
      </div>
      <FieldGroup label="Status">
        <div className={styles.tagContainer}>
          {STATUS_OPTIONS.map(s => (
            <button
              type="button"
              key={s.value}
              onClick={() => update("status", s.value)}
              className={styles.statusButton}
              style={form.status === s.value ? { borderColor: s.color, background: s.bg, color: s.color } : undefined}
            >
              {s.label}
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Culture Tags">
        <div className={styles.tagContainer}>
          {CULTURE_OPTIONS.map(t => (
            <button
              type="button"
              key={t}
              onClick={() => update("cultureTags", form.cultureTags.includes(t) ? form.cultureTags.filter(x => x !== t) : [...form.cultureTags, t])}
              className={`${styles.cultureButton} ${form.cultureTags.includes(t) ? styles.cultureActive : ''}`}
            >
              {t}
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Languages">
        <div className={styles.langContainer}>
          {["English", "German"].map(l => (
            <button
              type="button"
              key={l}
              onClick={() => update("languages", form.languages.includes(l) ? form.languages.filter(x => x !== l) : [...form.languages, l])}
              className={`${styles.langButton} ${form.languages.includes(l) ? styles.langActive : ''}`}
            >
              {l}
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Tech Stack">
        <div className={styles.techInputRow}>
          <input
            className={`${styles.input} ${styles.techInputField}`}
            value={techInput}
            onChange={e => setTechInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (techInput.trim()) { update("techStack", [...form.techStack, techInput.trim()]); setTechInput(""); } } }}
            placeholder="Type & press Enter"
          />
        </div>
        <div className={styles.techTags}>
          {form.techStack.map((t, i) => (
            <button type="button" key={i} onClick={() => update("techStack", form.techStack.filter((_, j) => j !== i))} className={styles.techItem} aria-label={`Remove ${t}`}>
              {t} ✕
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Job Posting URL">
        <input type="url" className={styles.input} value={form.jobUrl} onChange={e => update("jobUrl", e.target.value)} placeholder="https://..." />
      </FieldGroup>
      <FieldGroup label="Personal Notes">
        <textarea className={`${styles.input} ${styles.textarea}`} value={form.notes} onChange={e => update("notes", e.target.value)} placeholder="Your thoughts, impressions, contact info..." />
      </FieldGroup>
      <div className={styles.actions}>
        <button type="button" onClick={onCancel} className={styles.cancelButton}>Cancel</button>
        <button type="submit" className={styles.saveButton}>Save Company</button>
      </div>
    </form>
  );
}
