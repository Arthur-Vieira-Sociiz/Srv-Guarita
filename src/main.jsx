import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function toImageSource(base64) {
  if (!base64) return null;
  return base64.startsWith("data:image/") ? base64 : `data:image/jpeg;base64,${base64}`;
}

function mapReading(reading) {
  const hasSchedule = Boolean(reading.legenda?.trim());
  return {
    camera: reading.idDispositivo,
    plate: reading.placa || "-",
    name: reading.nome || "-",
    status: reading.autorizado ? "authorized" : hasSchedule ? "scheduledDenied" : "denied",
    detail: reading.legenda || "Veículo sem agendamento",
    vehicleImage: toImageSource(reading.foto64),
    plateImage: toImageSource(reading.placa64),
  };
}

const accessBadges = {
  authorized: {
    className: "authorized",
    icon: "✓",
    title: "Entrada autorizada",
    detail: "Agendado hoje · 14h30 · Vistoria",
  },
  denied: {
    className: "denied",
    icon: "×",
    title: "Entrada não autorizada",
    detail: "Veículo sem agendamento",
  },
  scheduledDenied: {
    className: "scheduled-denied",
    icon: "!",
    title: "Entrada não autorizada",
    detail: "Agendado para o dia 26/09/2026 · 14h30 · Vistoria",
  },
};

const weekday = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function formatClock(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${weekday[date.getDay()]}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)} | ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function App() {
  const [settings, setSettings] = useState({ serverUrl: "http://localhost:80", cameraId: "" });
  const [reading, setReading] = useState(null);
  const [form, setForm] = useState(settings);
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const badge = reading ? (accessBadges[reading.status] || accessBadges.denied) : null;

  useEffect(() => {
    window.guarita.getSettings().then((saved) => {
      setSettings(saved);
      setForm(saved);
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setReading(null);
    async function refreshReading() {
      try {
        const latestReading = await window.guarita.getLatestReading();
        if (active && latestReading) setReading(mapReading(latestReading));
      } catch {
        // Mantém a última leitura exibida quando o servidor estiver indisponível.
      }
    }
    refreshReading();
    const timer = window.setInterval(refreshReading, 3_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [settings.serverUrl, settings.cameraId]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await window.guarita.saveSettings(form);
      setSettings(saved);
      setForm(saved);
      setShowSettings(false);
      setStatus(`Configuração salva para a câmera ${saved.cameraId || "não informada"}.`);
    } catch (error) {
      setStatus(error.message || "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="app-shell">
    <header
      className="topbar"
      onClick={() => { setForm(settings); setShowSettings(true); }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setForm(settings);
          setShowSettings(true);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Abrir configurações da guarita"
      title="Toque para abrir as configurações"
    >
      <img className="detran-logo" src="./assets/detran-al.png" alt="DETRAN Alagoas" />
      <time className="header-clock">{formatClock(clock)}</time>
    </header>

    <section className="content">
      <div className="reading-grid">
        <article className="vehicle-card">
          <div className="card-label">Câmera {reading?.camera || settings.cameraId}</div>
          <div className={`vehicle-image${reading?.vehicleImage ? "" : " empty-media"}`} aria-label="Imagem do veículo">
            {reading?.vehicleImage && <img src={reading.vehicleImage} alt="Veículo identificado na entrada" />}
          </div>
        </article>
        <article className="identity-card">
          <div className="card-label">Foto da placa</div>
          <div className={`plate-image${reading?.plateImage ? "" : " empty-media"}`} aria-label="Imagem da placa">
            {reading?.plateImage && <img src={reading.plateImage} alt={`Imagem da placa ${reading.plate}`} />}
          </div>
          <div className="identified-title">Informações identificadas</div>
          <div className="identity-row">
            <div className="info-section">
              <span className="field-label">Placa do veículo</span>
              <strong className="plate">{reading?.plate}</strong>
            </div>
            <div className="info-section">
              <span className="field-label">Nome</span>
              <strong className="person-name">{reading?.name}</strong>
            </div>
          </div>
          {badge && <div className={`authorization ${badge.className}`}><span className="check">{badge.icon}</span><div><strong>{badge.title}</strong><span>{reading.detail || badge.detail}</span></div></div>}
        </article>
      </div>
    </section>

    {status && <footer className="statusbar"><span>{status}</span></footer>}

    {showSettings && <div className="modal-backdrop" role="presentation">
      <form className="settings-modal" onSubmit={save}>
        <div className="modal-heading"><div><span className="eyebrow">CONFIGURAÇÃO LOCAL</span><h1>Configurações da guarita</h1></div><button type="button" className="close-button" onClick={() => setShowSettings(false)} aria-label="Fechar">×</button></div>
        <p>Esses dados ficam armazenados somente neste computador e serão usados na conexão com o servidor.</p>
        <label>Endereço do servidor<input required type="url" value={form.serverUrl} placeholder="http://localhost:80" onChange={(e) => setForm({ ...form, serverUrl: e.target.value })} /></label>
        <label>ID da câmera<input value={form.cameraId} placeholder="Ex.: ENTRADA-01" onChange={(e) => setForm({ ...form, cameraId: e.target.value })} /></label>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowSettings(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? "Salvando..." : "Salvar configurações"}</button></div>
      </form>
    </div>}
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
