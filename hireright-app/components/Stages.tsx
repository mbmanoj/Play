import { JobStage } from "@/lib/types";
import { ALL_STAGES, stageIndex, stageLabel } from "@/lib/pipeline/state";

export default function Stages({ current }: { current: JobStage }) {
  const ci = stageIndex(current);
  return (
    <div className="stages">
      {ALL_STAGES.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center" }}>
          <div className={`stage-dot ${i < ci ? "done" : i === ci ? "active" : ""}`}>
            <span className="dot">{i < ci ? "✓" : i + 1}</span>
            <span>{stageLabel(s)}</span>
          </div>
          {i < ALL_STAGES.length - 1 && <span className="stage-sep" />}
        </div>
      ))}
    </div>
  );
}
