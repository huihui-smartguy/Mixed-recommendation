import { useState } from 'react';
import { CaretRightOutlined } from '@ant-design/icons';

interface Props {
  steps: string[];
  active: boolean;
}

export default function ThinkingAccordion({ steps, active }: Props) {
  const [open, setOpen] = useState(true);
  if (steps.length === 0) return null;
  return (
    <div className="bubble assistant thinking">
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen((v) => !v)}
      >
        <CaretRightOutlined rotate={open ? 90 : 0} />
        <strong>思考链 (Chain of Thought)</strong>
        <span className="muted" style={{ marginLeft: 'auto' }}>
          {active ? '思考中…' : `${steps.length} 步`}
        </span>
      </div>
      {open && (
        <ol style={{ margin: '8px 0 0 20px', padding: 0 }}>
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
