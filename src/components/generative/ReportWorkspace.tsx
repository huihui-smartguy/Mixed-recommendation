import { useReportStore } from '@/stores/useReportStore';
import ProfileWizard from './ProfileWizard';
import ReportViewer from './ReportViewer';

export default function ReportWorkspace() {
  const task = useReportStore((s) => s.task);
  return (
    <div className="panel-grid">
      <ProfileWizard />
      <ReportViewer
        stage={task.stage}
        progress={task.progress}
        message={task.stageMessage}
        payload={task.payload}
      />
    </div>
  );
}
