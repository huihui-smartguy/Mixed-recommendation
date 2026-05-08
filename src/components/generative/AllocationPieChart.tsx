import ReactECharts from 'echarts-for-react';
import type { Allocation } from '@/types';

interface Props {
  allocations: Allocation[];
}

export default function AllocationPieChart({ allocations }: Props) {
  const option = {
    tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        name: '大类资产',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { formatter: '{b}\n{c}%' },
        data: allocations.map((a) => ({ name: a.label, value: a.weight }))
      }
    ],
    color: ['#1f4dff', '#5e8cff', '#13c2c2', '#fa8c16', '#722ed1', '#52c41a', '#eb2f96', '#faad14']
  };
  return <ReactECharts option={option} style={{ height: 320, width: '100%' }} notMerge lazyUpdate />;
}
