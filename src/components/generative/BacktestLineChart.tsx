import ReactECharts from 'echarts-for-react';

interface Props {
  dates: string[];
  portfolio: number[];
  benchmark: number[];
}

export default function BacktestLineChart({ dates, portfolio, benchmark }: Props) {
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['组合净值', '基准净值'] },
    grid: { left: 48, right: 24, top: 32, bottom: 32 },
    xAxis: { type: 'category', data: dates, boundaryGap: false },
    yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { type: 'dashed' } } },
    series: [
      {
        name: '组合净值',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: portfolio,
        lineStyle: { color: '#1f4dff', width: 2.5 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(31,77,255,0.28)' },
              { offset: 1, color: 'rgba(31,77,255,0.02)' }
            ]
          }
        }
      },
      {
        name: '基准净值',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: benchmark,
        lineStyle: { color: '#86909c', width: 1.5, type: 'dashed' }
      }
    ]
  };
  return <ReactECharts option={option} style={{ height: 280, width: '100%' }} notMerge lazyUpdate />;
}
