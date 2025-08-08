import React, { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, DollarSign, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PortfolioData {
  date: string;
  value: number;
  change: number;
  changePercent: number;
}

interface PortfolioChartProps {
  data: PortfolioData[];
  title?: string;
  height?: number;
}

const PortfolioChart: React.FC<PortfolioChartProps> = ({
  data,
  title = '포트폴리오 수익률',
  height = 300,
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [isLoading, setIsLoading] = useState(false);
  const chartRef = useRef<any>(null);

  // 시간 범위에 따른 데이터 필터링
  const getFilteredData = () => {
    const now = new Date();
    const ranges = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };

    const daysToSubtract = ranges[timeRange];
    const cutoffDate = new Date(now.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);

    return data.filter(item => new Date(item.date) >= cutoffDate);
  };

  const filteredData = getFilteredData();

  // 차트 데이터 준비
  const chartData = {
    labels: filteredData.map(item => {
      const date = new Date(item.date);
      if (timeRange === '7d') {
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      } else if (timeRange === '30d') {
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      } else if (timeRange === '90d') {
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      } else {
        return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' });
      }
    }),
    datasets: [
      {
        label: '포트폴리오 가치',
        data: filteredData.map(item => item.value),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
      },
    ],
  };

  // 차트 옵션
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y;
            return `가치: ${value.toLocaleString()} ETH`;
          },
        },
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'xy' as const,
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: 'xy' as const,
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#6b7280',
          font: {
            size: 12,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: '#6b7280',
          font: {
            size: 12,
          },
          callback: function(value: any) {
            return `${value.toLocaleString()} ETH`;
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    elements: {
      point: {
        hoverBackgroundColor: 'rgb(59, 130, 246)',
      },
    },
  };



  // 통계 계산
  const calculateStats = () => {
    if (filteredData.length === 0) return null;

    const firstValue = filteredData[0].value;
    const lastValue = filteredData[filteredData.length - 1].value;
    const change = lastValue - firstValue;
    const changePercent = (change / firstValue) * 100;

    return {
      currentValue: lastValue,
      change,
      changePercent,
      isPositive: change >= 0,
    };
  };

  const stats = calculateStats();

  return (
    <div className="bg-white rounded-lg border p-4 sm:p-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {stats && (
            <div className="flex items-center space-x-4 mt-2">
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-gray-900">
                  {stats.currentValue.toLocaleString()}
                </span>
                <span className="text-sm text-gray-500">ETH</span>
              </div>
              <div className={`flex items-center space-x-1 ${
                stats.isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats.isPositive ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">
                  {stats.isPositive ? '+' : ''}{stats.change.toFixed(4)} ETH
                </span>
                <span className="text-sm">
                  ({stats.isPositive ? '+' : ''}{stats.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 시간 범위 선택 및 줌 컨트롤 */}
        <div className="flex space-x-2 mt-4 sm:mt-0">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range === '7d' && '7일'}
                {range === '30d' && '30일'}
                {range === '90d' && '90일'}
                {range === '1y' && '1년'}
              </button>
            ))}
          </div>
          

        </div>
      </div>

      {/* 차트 */}
      <div className="relative" style={{ height }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">데이터가 없습니다.</p>
            </div>
          </div>
        ) : (
          <Line ref={chartRef} data={chartData} options={options} />
        )}
      </div>

      {/* 추가 정보 */}
      {stats && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-500">시작 가치</p>
              <p className="text-lg font-semibold text-gray-900">
                {filteredData[0]?.value.toLocaleString()} ETH
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">현재 가치</p>
              <p className="text-lg font-semibold text-gray-900">
                {stats.currentValue.toLocaleString()} ETH
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">변동</p>
              <p className={`text-lg font-semibold ${
                stats.isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats.isPositive ? '+' : ''}{stats.change.toFixed(4)} ETH
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">변동률</p>
              <p className={`text-lg font-semibold ${
                stats.isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats.isPositive ? '+' : ''}{stats.changePercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioChart; 