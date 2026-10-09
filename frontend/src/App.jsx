import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BrainCircuit, BriefcaseBusiness, CheckCircle2, ChevronRight,
  CircleAlert, Clock3, FileText, Gauge, GraduationCap, History, LoaderCircle,
  Sparkles, Target, Upload, XCircle
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

const sampleResume = `Asra Kousar
Computer Science Engineering Student
Skills: Python, JavaScript, React, HTML, CSS, SQL, Git, REST API, Data Structures and Algorithms.
Projects:
- Read Ease: Built a browser extension to make text more accessible using HTML, CSS and JavaScript.
- Student Progress Tracker: Created a web app to track student attendance and marks using Python and SQLite.
Experience: Academic projects and team collaboration.`;
const sampleJob = `Software Engineering Intern
Requirements:
- Python or Java
- React and JavaScript
- REST API development
- SQL databases
- Git and version control
- Docker and containerization
- Cloud computing (AWS preferred)
- Data structures and algorithms
- Communication and teamwork`;

function SkillChip({ children, kind = "neutral" }) {
  return <span className={`chip chip-${kind}`}>{children}</span>;
}

function StatCard({ icon: Icon, label, value, note }) {
  return (
    <div className="stat-card">
      <div className="stat-top"><span>{label}</span><Icon size={18} /></div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

export default function App() {
  const [resume, setResume] = useState("");
  const [job, setJob] = useState("");
  const [file, setFile] = useState(null);
  const [useAI, setUseAI] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("analysis");
  const [health, setHealth] = useState({ online: false, ai: false });

  async function loadHealth() {
    try {
      const response = await fetch(`${API}/api/health`);
      const data = await response.json();
      setHealth({ online: response.ok, ai: Boolean(data.ai_configured) });
    } catch {
      setHealth({ online: false, ai: false });
    }
  }

  async function loadHistory() {
    try {
      const response = await fetch(`${API}/api/history`);
      if (!response.ok) return;
      const data = await response.json();
      setHistory(data.items || []);
    } catch {
      // History is a convenience; the main form remains usable.
    }
  }

  useEffect(() => {
    loadHealth();
    loadHistory();
  }, []);

  const matchedCount = result?.matched_skills?.length ?? 0;
  const missingCount = result?.missing_skills?.length ?? 0;
  const score = result?.match_score ?? 0;

  const scoreLabel = useMemo(() => {
    if (score >= 80) return "Strong overlap";
    if (score >= 50) return "Some important gaps";
    return "Room to build";
  }, [score]);

  function loadSample() {
    setResume(sampleResume);
    setJob(sampleJob);
    setFile(null);
    setError("");
  }

  async function analyze(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    if (!file && !resume.trim()) {
      setError("Paste your resume text or upload a PDF resume.");
      return;
    }
    if (!job.trim()) {
      setError("Paste the job description you want to compare against.");
      return;
    }

    setLoading(true);
    try {
      let response;
      if (file) {
        const form = new FormData();
        form.append("resume", file);
        form.append("job_description", job);
        form.append("use_ai", String(useAI));
        response = await fetch(`${API}/api/analyze-pdf`, { method: "POST", body: form });
      } else {
        response = await fetch(`${API}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resume_text: resume, job_description: job, use_ai: useAI })
        });
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed.");
      setResult(data);
      setActiveTab("analysis");
      await loadHistory();
    } catch (err) {
      setError(`${err.message || "Could not connect to the backend."} Make sure the Flask API is running on ${API}.`);
    } finally {
      setLoading(false);
    }
  }

  async function openHistory(id) {
    setError("");
    try {
      const response = await fetch(`${API}/api/history/${id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load this analysis.");
      setResult(data.result);
      setResume(data.resume_text);
      setJob(data.job_description);
      setFile(null);
      setActiveTab("analysis");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><BrainCircuit size={23} /></div>
          <div><strong>SkillGap<span> AI</span></strong><small>Career clarity, one step at a time</small></div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <button className={`nav-item ${activeTab === "analysis" ? "active" : ""}`} onClick={() => setActiveTab("analysis")}>
          <Gauge size={18} /> Skill analysis
        </button>
        <button className={`nav-item ${activeTab === "history" ? "active" : ""}`} onClick={() => { setActiveTab("history"); loadHistory(); }}>
          <History size={18} /> Analysis history
        </button>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><Sparkles size={18} /></div>
            <strong>Small steps count.</strong>
            <p>Use the results as a guide, not a judgment of your potential.</p>
          </div>
          <div className="api-status">
            <span className={`status-dot ${health.online ? "good" : "bad"}`} />
            API {health.online ? "connected" : "offline"}
            <span className="status-divider">·</span>
            AI {health.ai ? "enabled" : "optional"}
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <ChevronRight size={14} /> <span>{activeTab === "history" ? "History" : "Skill analysis"}</span></div>
          <div className="topbar-right"><span className="avatar">SG</span><span>Student workspace</span></div>
        </header>

        {activeTab === "history" ? (
          <section className="page">
            <div className="page-heading">
              <div><div className="eyebrow">YOUR WORKSPACE</div><h1>Analysis history</h1><p>Revisit previous comparisons and learning plans.</p></div>
              <button className="secondary-button" onClick={() => setActiveTab("analysis")}>New analysis <ArrowRight size={16} /></button>
            </div>
            <div className="panel history-panel">
              {history.length === 0 ? <div className="empty-state"><History size={32}/><h3>No analyses yet</h3><p>Your saved analyses will appear here after you run your first comparison.</p></div> :
                history.map(item => (
                  <button className="history-row" key={item.id} onClick={() => openHistory(item.id)}>
                    <div className="history-file"><FileText size={19}/></div>
                    <div className="history-info"><strong>Analysis #{item.id}</strong><small>{new Date(item.created_at).toLocaleString()}</small><span>{item.summary}</span></div>
                    <div className="history-score">{item.match_score}% <small>match</small></div><ChevronRight size={18}/>
                  </button>
                ))}
            </div>
          </section>
        ) : (
          <section className="page">
            <div className="page-heading">
              <div><div className="eyebrow">CAREER READINESS TOOL</div><h1>Know your gaps. Build your future.</h1><p>Compare your experience with a real role and turn missing skills into a clear plan.</p></div>
              <div className="heading-badge"><Sparkles size={15}/> AI-assisted insights</div>
            </div>

            <div className="step-strip">
              <div className="step active-step"><span>1</span><div><strong>Add details</strong><small>Resume + job description</small></div></div>
              <div className="step-line" />
              <div className={`step ${result ? "active-step" : ""}`}><span>2</span><div><strong>Review gaps</strong><small>Matched + missing skills</small></div></div>
              <div className="step-line" />
              <div className={`step ${result ? "active-step" : ""}`}><span>3</span><div><strong>Take action</strong><small>Personalized roadmap</small></div></div>
            </div>

            <form className="input-grid" onSubmit={analyze}>
              <div className="panel input-panel">
                <div className="panel-title"><div className="panel-icon purple"><FileText size={19}/></div><div><h2>Your resume</h2><p>Use a PDF or paste the resume text.</p></div></div>
                <label className="upload-zone">
                  <input type="file" accept="application/pdf,.pdf" onChange={e => { setFile(e.target.files?.[0] || null); setError(""); }} />
                  <div className="upload-icon"><Upload size={21}/></div>
                  <strong>{file ? file.name : "Click to upload your resume"}</strong>
                  <span>{file ? "PDF selected · click to replace" : "PDF file · up to 5 MB"}</span>
                </label>
                <div className="or-divider"><span>OR PASTE TEXT</span></div>
                <textarea value={resume} onChange={e => { setResume(e.target.value); setFile(null); }} placeholder="Paste your resume, skills, projects and experience here..." rows={8} />
                <div className="field-footer"><span>{resume.length.toLocaleString()} characters</span><button type="button" className="text-button" onClick={loadSample}>Try sample data</button></div>
              </div>

              <div className="panel input-panel">
                <div className="panel-title"><div className="panel-icon blue"><BriefcaseBusiness size={19}/></div><div><h2>Target job</h2><p>Paste the job description you want to target.</p></div></div>
                <label className="field-label" htmlFor="job">JOB DESCRIPTION</label>
                <textarea id="job" value={job} onChange={e => setJob(e.target.value)} placeholder="Paste responsibilities, requirements and preferred skills..." rows={13} />
                <div className="field-footer"><span>{job.length.toLocaleString()} characters</span><span className="subtle-label">Be specific for better results</span></div>
                <label className="toggle-row">
                  <span><Sparkles size={17}/><span><strong>Use GenAI enhancement</strong><small>Generate richer recommendations when API key is configured.</small></span></span>
                  <input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} />
                </label>
              </div>

              <div className="form-actions">
                <div className="privacy-note"><CircleAlert size={16}/> Resume text is saved in local project database history. Use sample or anonymized data for demos.</div>
                <button className="primary-button" type="submit" disabled={loading}>
                  {loading ? <><LoaderCircle className="spin" size={18}/> Analyzing...</> : <>Analyze skill gap <ArrowRight size={17}/></>}
                </button>
              </div>
              {error && <div className="error-message"><XCircle size={17}/>{error}</div>}
            </form>

            {result && (
              <section className="results-section">
                <div className="results-heading"><div><div className="eyebrow">YOUR RESULTS</div><h2>Here's your skill snapshot</h2><p>{result.summary}</p></div><span className="result-id">Analysis #{result.id}</span></div>
                {result.ai_warning && <div className="warning-message"><CircleAlert size={16}/>{result.ai_warning}</div>}
                <div className="stats-grid">
                  <div className="score-card">
                    <div className="score-ring" style={{ "--score": `${score * 3.6}deg` }}><div><strong>{score}%</strong><small>skill overlap</small></div></div>
                    <div><strong>{scoreLabel}</strong><p>{result.score_note}</p></div>
                  </div>
                  <StatCard icon={CheckCircle2} label="Matched skills" value={matchedCount} note="Recognized in both texts" />
                  <StatCard icon={Target} label="Skill gaps" value={missingCount} note="Detected in job, not resume" />
                </div>

                <div className="panel skill-panel">
                  <div className="section-title"><div><h3>Required skill breakdown</h3><p>Based on the job description and evidence in your resume.</p></div><span className="mini-count">{(result.skill_analysis || []).length} skills</span></div>
                  {(result.skill_analysis || []).length === 0 ? <p className="empty-inline">No known skills detected. Try adding explicit skill names or expand the backend skill taxonomy.</p> :
                    <div className="skill-list">{result.skill_analysis.map(row => (
                      <div className="skill-row" key={row.skill}>
                        <div className={`skill-status ${row.status}`}><span /></div>
                        <div className="skill-main"><strong>{row.skill}</strong><small>{row.status === "matched" ? (row.evidence ? `Evidence: ${row.evidence}` : "Detected in resume") : row.suggestion}</small></div>
                        <SkillChip kind={row.status === "matched" ? "success" : "warning"}>{row.status === "matched" ? "Matched" : "Gap"}</SkillChip>
                      </div>
                    ))}</div>}
                </div>

                <div className="panel roadmap-panel">
                  <div className="section-title"><div><h3>Your learning roadmap</h3><p>Use this as a draft plan; adjust it to your time and goals.</p></div><div className="roadmap-icon"><GraduationCap size={20}/></div></div>
                  <div className="roadmap-list">{(result.roadmap || []).map((item, index) => (
                    <div className="roadmap-item" key={`${item.week}-${item.focus}`}>
                      <div className="week-marker"><span>{item.week}</span></div>
                      <div className="roadmap-content"><div className="roadmap-meta"><span>WEEK {item.week}</span><span><Clock3 size={13}/> Flexible pace</span></div><h4>{item.focus}</h4>
                        <ul>{(item.tasks || []).map((task, i) => <li key={i}>{task}</li>)}</ul>
                        <div className="deliverable"><CheckCircle2 size={15}/><span><strong>Deliverable:</strong> {item.deliverable}</span></div>
                      </div>
                    </div>
                  ))}</div>
                  {result.resume_improvements?.length > 0 && <div className="extra-advice"><h4>Resume improvements</h4><ul>{result.resume_improvements.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                  {result.interview_practice?.length > 0 && <div className="extra-advice"><h4>Interview practice</h4><ul>{result.interview_practice.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                </div>
                <p className="disclaimer">This score reflects overlap with skills recognized by this prototype. It does not predict hiring outcomes, and absence from a resume does not prove absence of a skill.</p>
              </section>
            )}
            <footer className="footer">SkillGap AI <span>·</span> Built to turn career uncertainty into actionable next steps.</footer>
          </section>
        )}
      </main>
    </div>
  );
}
