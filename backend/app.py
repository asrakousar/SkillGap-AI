import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import fitz
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "skillgap.db"
MAX_MB = int(os.getenv("MAX_CONTENT_LENGTH_MB", "5"))
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_MB * 1024 * 1024
CORS(app, resources={r"/api/*": {"origins": os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")}})

# Curated starter taxonomy. Extend this list for your target job market.
SKILL_TAXONOMY = {
    "Python": ["python", "pandas", "numpy", "django", "flask", "fastapi"],
    "Java": ["java", "spring boot", "spring"],
    "JavaScript": ["javascript", "js", "node.js", "nodejs", "express"],
    "TypeScript": ["typescript"],
    "React": ["react", "react.js", "reactjs", "next.js", "nextjs"],
    "HTML/CSS": ["html", "css", "tailwind", "bootstrap"],
    "SQL": ["sql", "sqlite", "postgresql", "mysql", "database"],
    "REST APIs": ["rest api", "restful", "api development", "http api"],
    "Git": ["git", "github", "gitlab", "version control"],
    "Docker": ["docker", "containerization", "containers"],
    "Cloud": ["aws", "azure", "gcp", "google cloud", "cloud computing"],
    "Machine Learning": ["machine learning", "scikit-learn", "sklearn", "model training"],
    "Deep Learning": ["deep learning", "pytorch", "tensorflow", "keras"],
    "Generative AI": ["generative ai", "genai", "llm", "large language model", "prompt engineering", "rag", "retrieval augmented generation"],
    "Data Analysis": ["data analysis", "data analytics", "data visualization", "power bi", "tableau", "excel"],
    "Algorithms": ["data structures", "algorithms", "dsa", "problem solving", "complexity analysis"],
    "Testing": ["unit testing", "pytest", "jest", "testing", "test automation"],
    "Linux": ["linux", "bash", "shell scripting"],
    "Cybersecurity": ["cybersecurity", "owasp", "penetration testing", "security testing"],
    "Communication": ["communication", "presentation", "stakeholder communication"],
    "Agile": ["agile", "scrum", "sprint planning"],
}

def db_connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with db_connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                resume_text TEXT NOT NULL,
                job_description TEXT NOT NULL,
                result_json TEXT NOT NULL
            )
        """)
        conn.commit()

def clean_text(value, field_name, max_chars=30000):
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a string.")
    value = value.strip()
    if not value:
        raise ValueError(f"{field_name} cannot be empty.")
    if len(value) > max_chars:
        raise ValueError(f"{field_name} is too long (maximum {max_chars} characters).")
    return value

def contains_term(text, term):
    # Match whole phrases/words where possible; this avoids "java" matching "javascript".
    escaped = re.escape(term.lower())
    pattern = r"(?<![a-z0-9+#.])" + escaped + r"(?![a-z0-9+#.])"
    return re.search(pattern, text.lower()) is not None

def extract_skills(text):
    found = []
    for skill, aliases in SKILL_TAXONOMY.items():
        if any(contains_term(text, alias) for alias in aliases):
            found.append(skill)
    return found

def skill_evidence(skill, text):
    aliases = SKILL_TAXONOMY.get(skill, [skill.lower()])
    lowered = text.lower()
    for alias in aliases:
        if contains_term(lowered, alias):
            start = lowered.find(alias.lower())
            snippet = text[max(0, start - 70):min(len(text), start + len(alias) + 100)].replace("\n", " ")
            return snippet.strip()
    return ""

def rule_based_analysis(resume_text, job_description):
    required = extract_skills(job_description)
    candidate = extract_skills(resume_text)
    if not required:
        required = []
    candidate_set = set(candidate)
    matched = [s for s in required if s in candidate_set]
    missing = [s for s in required if s not in candidate_set]
    # Transparent score: proportion of detected required skills also evidenced in resume.
    score = round((len(matched) / len(required)) * 100) if required else 0

    skill_rows = []
    for skill in required:
        if skill in candidate_set:
            skill_rows.append({
                "skill": skill,
                "status": "matched",
                "evidence": skill_evidence(skill, resume_text),
                "suggestion": "Strengthen this skill with a measurable project or work example."
            })
        else:
            skill_rows.append({
                "skill": skill,
                "status": "missing",
                "evidence": "",
                "suggestion": f"Learn the fundamentals of {skill} and build a small project that demonstrates it."
            })

    roadmap = []
    for index, skill in enumerate(missing[:5], start=1):
        roadmap.append({
            "week": index,
            "focus": skill,
            "tasks": [
                f"Learn the core concepts of {skill}.",
                f"Complete 2–3 practical exercises using {skill}.",
                f"Build a small project demonstrating {skill} and document what you learned."
            ],
            "deliverable": f"A small, demonstrable {skill} project or portfolio artifact."
        })
    if not roadmap:
        roadmap = [{
            "week": 1,
            "focus": "Strengthen evidence for matched skills",
            "tasks": [
                "Choose one required skill and build a project that uses it end to end.",
                "Add a clear README with setup instructions and screenshots.",
                "Describe your personal contribution and measurable outcome in your resume."
            ],
            "deliverable": "One documented portfolio project."
        }]

    return {
        "match_score": score,
        "score_note": "Heuristic overlap score based on skills detected by this app; it is not a hiring probability.",
        "required_skills": required,
        "candidate_skills": candidate,
        "matched_skills": matched,
        "missing_skills": missing,
        "skill_analysis": skill_rows,
        "roadmap": roadmap,
        "summary": (
            f"The job description contains {len(required)} recognized skills. "
            f"Your resume text contains {len(candidate)} recognized skills, with {len(matched)} overlapping."
            if required else
            "No skills from the current built-in taxonomy were detected in the job description. Add clearer skill names or expand the taxonomy."
        ),
        "ai_generated": False
    }

def openai_enhance(resume_text, job_description, base_result):
    if not OPENAI_API_KEY:
        return base_result
    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        prompt = f"""
You are a careful career-support assistant. Use only the information in the provided resume and job description.
Do not invent candidate experience, certifications, job requirements, or URLs.
The deterministic analysis is included as a baseline; preserve its matched/missing skill labels unless the source text clearly contradicts them.
Return JSON only, with keys:
summary (string),
roadmap (array of objects: week (integer), focus (string), tasks (array of 2-4 strings), deliverable (string)),
resume_improvements (array of strings, maximum 5),
interview_practice (array of strings, maximum 5).
Keep advice specific and realistic for a student. For missing skills, recommend learning and practice, never falsely claim the candidate already has them.
RESUME:
{resume_text[:12000]}
JOB DESCRIPTION:
{job_description[:12000]}
BASELINE ANALYSIS:
{json.dumps({"required_skills": base_result["required_skills"], "matched_skills": base_result["matched_skills"], "missing_skills": base_result["missing_skills"]})}
"""
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "Return valid JSON only. Be grounded, concise, and honest."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
        if isinstance(data.get("summary"), str) and data["summary"].strip():
            base_result["summary"] = data["summary"].strip()
        if isinstance(data.get("roadmap"), list) and data["roadmap"]:
            cleaned = []
            for i, item in enumerate(data["roadmap"][:8], start=1):
                if not isinstance(item, dict):
                    continue
                focus = str(item.get("focus", "")).strip()[:120]
                tasks = item.get("tasks", [])
                if not focus or not isinstance(tasks, list):
                    continue
                cleaned.append({
                    "week": int(item.get("week", i)) if str(item.get("week", i)).isdigit() else i,
                    "focus": focus,
                    "tasks": [str(t).strip()[:300] for t in tasks[:4] if str(t).strip()],
                    "deliverable": str(item.get("deliverable", "A documented practice project.")).strip()[:300]
                })
            if cleaned:
                base_result["roadmap"] = cleaned
        for key in ("resume_improvements", "interview_practice"):
            value = data.get(key, [])
            if isinstance(value, list):
                base_result[key] = [str(x).strip()[:300] for x in value[:5] if str(x).strip()]
        base_result["ai_generated"] = True
        return base_result
    except Exception as exc:
        # Preserve core functionality if the external provider is unavailable.
        base_result["ai_warning"] = "GenAI enhancement was unavailable; the rule-based result is shown instead."
        app.logger.warning("OpenAI enhancement failed: %s", exc)
        return base_result

def save_analysis(resume_text, job_description, result):
    created_at = datetime.now(timezone.utc).isoformat()
    with db_connect() as conn:
        cursor = conn.execute(
            "INSERT INTO analyses (created_at, resume_text, job_description, result_json) VALUES (?, ?, ?, ?)",
            (created_at, resume_text, job_description, json.dumps(result, ensure_ascii=False))
        )
        conn.commit()
        return cursor.lastrowid

def run_analysis(resume_text, job_description, use_ai):
    result = rule_based_analysis(resume_text, job_description)
    if use_ai:
        result = openai_enhance(resume_text, job_description, result)
    analysis_id = save_analysis(resume_text, job_description, result)
    result["id"] = analysis_id
    result["created_at"] = datetime.now(timezone.utc).isoformat()
    return result

@app.errorhandler(413)
def too_large(_error):
    return jsonify({"error": f"Upload too large. Maximum request size is {MAX_MB} MB."}), 413

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "ai_configured": bool(OPENAI_API_KEY)})

@app.post("/api/analyze")
def analyze():
    payload = request.get_json(silent=True) or {}
    try:
        resume_text = clean_text(payload.get("resume_text", ""), "resume_text")
        job_description = clean_text(payload.get("job_description", ""), "job_description")
        use_ai = payload.get("use_ai", True) is not False
        result = run_analysis(resume_text, job_description, use_ai)
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        app.logger.exception("Analysis failed")
        return jsonify({"error": "Analysis failed unexpectedly. Check the backend terminal for details."}), 500

@app.post("/api/analyze-pdf")
def analyze_pdf():
    if "resume" not in request.files:
        return jsonify({"error": "Upload a PDF resume using the 'resume' field."}), 400
    uploaded = request.files["resume"]
    job_description = request.form.get("job_description", "")
    use_ai = request.form.get("use_ai", "true").lower() not in ("false", "0", "no")
    if not uploaded.filename or not uploaded.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Resume must be a PDF file."}), 400
    try:
        job_description = clean_text(job_description, "job_description")
        data = uploaded.read()
        if not data:
            return jsonify({"error": "The uploaded PDF is empty."}), 400
        with fitz.open(stream=data, filetype="pdf") as doc:
            resume_text = "\n".join(page.get_text("text") for page in doc).strip()
        resume_text = clean_text(resume_text, "PDF resume text", max_chars=30000)
        return jsonify(run_analysis(resume_text, job_description, use_ai))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        app.logger.info("PDF parsing error: %s", exc)
        return jsonify({"error": "Could not read this PDF. Try a text-based PDF or paste resume text manually."}), 400

@app.get("/api/history")
def history():
    with db_connect() as conn:
        rows = conn.execute(
            "SELECT id, created_at, result_json FROM analyses ORDER BY id DESC LIMIT 20"
        ).fetchall()
    items = []
    for row in rows:
        try:
            result = json.loads(row["result_json"])
        except json.JSONDecodeError:
            result = {}
        items.append({
            "id": row["id"],
            "created_at": row["created_at"],
            "match_score": result.get("match_score", 0),
            "summary": result.get("summary", "")
        })
    return jsonify({"items": items})

@app.get("/api/history/<int:analysis_id>")
def history_detail(analysis_id):
    with db_connect() as conn:
        row = conn.execute(
            "SELECT id, created_at, resume_text, job_description, result_json FROM analyses WHERE id = ?",
            (analysis_id,)
        ).fetchone()
    if row is None:
        return jsonify({"error": "Analysis not found."}), 404
    result = json.loads(row["result_json"])
    result.update({"id": row["id"], "created_at": row["created_at"]})
    return jsonify({
        "id": row["id"],
        "created_at": row["created_at"],
        "resume_text": row["resume_text"],
        "job_description": row["job_description"],
        "result": result
    })

init_db()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
