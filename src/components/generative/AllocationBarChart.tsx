import ReactECharts from 'echarts-for-react';
import type { Allocation } from '@/types';

interface Props {
  allocations: Allocation[];
  /** 标题；默认"大类资产权重对照" */
  title?: string;
}

/**
 * 大类资产权重 —— 横向条形图。
 * 比传统饼图更适合做精确比例对比，且打印 / 截图友好（前端"以图片形式展示"诉求）。
 * 与 AllocationPieChart 互补：饼图看比例分布，条形图看绝对权重排序。
 */
export default function AllocationBarChart({ allocations, title = '大类资产权重对照' }: Props) {
  const sorted = [...allocations].sort((a, b) => a.weight - b.weight);
  const palette = [
    '#c97a4f',
    '#6ba87f',
    '#6c9bcf',
    '#9b6da4',
    '#b8584a',
    '#d99070',
    '#88abce',
    '#88b07c'
  ];

  const option = {
    title: { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } },
    grid: { left: 110, right: 60, top: 40, bottom: 16 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: {c}%' },
    xAxis: {
      type: 'value',
      max: Math.max(...sorted.map((a) => a.weight)) * 1.18,
      axisLabel: { formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#e8e8e8' } }
    },
    yAxis: {
      type: 'category',
      data: sorted.map((a) => a.label),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { fontWeight: 500 }
    },
    series: [
      {
        type: 'bar',
        data: sorted.map((a, i) => ({
          value: a.weight,
          itemStyle: { color: palette[i % palette.length], borderRadius: [0, 6, 6, 0] }
        })),
        barWidth: 22,
        label: {
          show: true,
          position: 'right',
          formatter: '{c}%',
          fontWeight: 600
        }
      }
    ]
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: Math.max(280, sorted.length * 44 + 80), width: '100%' }}
      notMerge
      lazyUpdate
    />
  );
}
