import { Button, Checkbox, Tag } from 'antd';
import { useState } from 'react';
import type { Product } from '@/types';
import { fmtPct } from '@/utils/format';
import Sparkline from './Sparkline';

interface FundCardProps {
  product: Product;
  selected: boolean;
  onToggle: (p: Product) => void;
}

export default function FundCard({ product, selected, onToggle }: FundCardProps) {
  const [open, setOpen] = useState(false);
  const upClass = product.changePct >= 0 ? 'up' : 'down';
  return (
    <div className="fund-card">
      <div className="row">
        <div>
          <div className="name">{product.name}</div>
          <div className="code numeric">
            <Tag color="default">{product.code}</Tag>
            <span className="muted" style={{ marginLeft: 4 }}>{product.category}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={`perf numeric ${upClass}`}>{fmtPct(product.changePct)}</div>
          <div className="muted numeric">净值 {product.netValue.toFixed(4)}</div>
        </div>
      </div>

      <div className="row">
        <Sparkline data={product.sparkline} />
        <div className="reason">{product.reason}</div>
      </div>

      {open && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 12, fontSize: 12 }}>
          <span className="numeric">
            近 1 年 <strong className={product.return1y >= 0 ? 'up' : 'down'}>{fmtPct(product.return1y)}</strong>
          </span>
          <span className="numeric">
            近 3 年 <strong className={product.return3y >= 0 ? 'up' : 'down'}>{fmtPct(product.return3y)}</strong>
          </span>
          <span className="numeric">
            最大回撤 <strong className="down">{fmtPct(product.maxDrawdown)}</strong>
          </span>
          <span className="numeric">
            夏普 <strong>{product.sharpe.toFixed(2)}</strong>
          </span>
        </div>
      )}

      <div className="actions">
        <Checkbox checked={selected} onChange={() => onToggle(product)}>
          加入对比
        </Checkbox>
        <Button size="small" type="link" onClick={() => setOpen((v) => !v)}>
          {open ? '收起详情' : '展开详情'}
        </Button>
      </div>
    </div>
  );
}
