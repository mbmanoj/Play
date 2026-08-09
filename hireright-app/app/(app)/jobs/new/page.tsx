import NewJobForm from "@/components/NewJobForm";
import { SAMPLE_JD } from "@/lib/seed";

export default function NewJob() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>New role</h1>
          <p>Upload a job description — the AI drafts a hiring plan you can edit and approve.</p>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 720 }}>
        <NewJobForm sampleJd={SAMPLE_JD} />
      </div>
      <div className="info" style={{ maxWidth: 720 }}>
        On upload, the AI parses the JD into must-have / nice-to-have criteria with weights and
        drafts interview questions. Nothing is screened until you approve the plan (Gate 1).
      </div>
    </>
  );
}
