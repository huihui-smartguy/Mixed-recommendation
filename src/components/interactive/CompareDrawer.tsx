import { Drawer, Table, Tag } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { Product } from '@/types';
import { fmtPct } from '@/utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
  products: Product[];
}

export default function CompareDrawer({ open, onClose, products }: Props) {
  const indicators = [
    { name: '近1年', max: 35 },
    { name: '近3年', max: 80 },
    { name: '夏普', max: 2 },
    { name: '抗回撤', max: 50 },
    { name: '稳定性', max: 100 }
  ];

  const radarOption = {
    legend: { bottom: 0, type: 'scroll' },
    tooltip: {},
    radar: { indicator: indicators },
    series: [
      {
        type: 'radar',
        data: products.map((p) => ({
          name: `${p.name} (${p.code})`,
          value: [
            Math.max(0, p.return1y),
            Math.max(0, p.return3y),
            Math.max(0, p.sharpe),
            50 + p.maxDrawdown, // 回撤越小（数字越接近0）越大
            Math.max(0, 100 - Math.abs(p.maxDrawdown))
          ]
        }))
      }
    ],
    color: ['#1f4dff', '#fa8c16', '#13c2c2', '#722ed1']
  };

  const columns = [
    { title: '产品', dataIndex: 'name', key: 'name' },
    { title: '代码', dataIndex: 'code', key: 'code', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '近1年',
      dataIndex: 'return1y',
      key: 'return1y',
      align: 'right' as const,
      render: (v: number) => <span className={`numeric ${v >= 0 ? 'up' : 'down'}`}>{fmtPct(v)}</span>
    },
    {
      title: '近3年',
      dataIndex: 'return3y',
      key: 'return3y',
      align: 'right' as const,
      render: (v: number) => <span className={`numeric ${v >= 0 ? 'up' : 'down'}`}>{fmtPct(v)}</span>
    },
    {
      title: '最大回撤',
      dataIndex: 'maxDrawdown',
      key: 'maxDrawdown',
      align: 'right' as const,
      render: (v: number) => <span className="numeric down">{fmtPct(v)}</span>
    },
    {
      title: '夏普',
      dataIndex: 'sharpe',
      key: 'sharpe',
      align: 'right' as const,
      render: (v: number) => <span className="numeric">{v.toFixed(2)}</span>
    }
  ];

  return (
    <Drawer
      title={`推荐方案对比台 · 已选 ${products.length} 项`}
      open={open}
      onClose={onClose}
      width={Math.min(720, window.innerWidth)}
      destroyOnClose
    >
      {products.length === 0 ? (
        <div className="muted">尚未选择产品。请在对话流中勾选「加入对比」。</div>
      ) : (
        <>
          <h4 style={{ marginTop: 0 }}>多维雷达图</h4>
          <ReactECharts option={radarOption} style={{ height: 360 }} notMerge lazyUpdate />
          <h4>横向指标对照</h4>
          <Table
            rowKey="code"
            dataSource={products}
            columns={columns}
            pagination={false}
            size="small"
          />
        </>
      )}
    </Drawer>
  );
}
