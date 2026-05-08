import { useReportStore } from '@/stores/useReportStore';
import ConversationTrigger from './ConversationTrigger';
import ButtonWizard from './ButtonWizard';
import ReportViewer from './ReportViewer';

/**
 * 生成式工作台
 *
 * 布局：
 *   ┌──────────────────────────────────────────────┐
 *   │ ConversationTrigger    │  ButtonWizard       │   <- 触发区双卡并列
 *   ├──────────────────────────────────────────────┤
 *   │ ReportViewer (Step-Loading / Markdown 报告)  │   <- 报告主体全宽
 *   └──────────────────────────────────────────────┘
 */
export default function ReportWorkspace() {
  const task = useReportStore((s) => s.task);
  return (
    <div className="report-workspace">
      <div className="trigger-grid">
        <ConversationTrigger />
        <ButtonWizard />
      </div>
      <div className="report-main">
        <ReportViewer
          stage={task.stage}
          progress={task.progress}
          message={task.stageMessage}
          payload={task.payload}
        />
      </div>
    </div>
  );
}
