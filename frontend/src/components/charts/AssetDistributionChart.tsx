import React, { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie, Doughnut } from 'react-chartjs-2';
import { PieChart, BarChart3, Filter, Search } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

interface AssetData {
  id: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface AssetDistributionChartProps {
  data: AssetData[];
  title?: string;
  type?: 'pie' | 'doughnut';
  height?: number;
}

const AssetDistributionChart: React.FC<AssetDistributionChartProps> = ({
  data,
  title = '자산 분포',
  type = 'doughnut',
  height = 300,
}) => {
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [minPercentage, setMinPercentage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPercentage = item.percentage >= minPercentage;
      return matchesSearch && matchesPercentage;
    });
  }, [data, searchTerm, minPercentage]);

  // 차트 데이터 준비
  const chartData = {
    labels: filteredData.map(item => item.name),
    datasets: [
      {
        data: filteredData.map(item => item.value),
        backgroundColor: filteredData.map(item => item.color),
        borderColor: filteredData.map(item => item.color),
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverOffset: 4,
      },
    ],
  };

  // 차트 옵션
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            size: 12,
          },
          generateLabels: (chart: any) => {
            const datasets = chart.data.datasets[0];
            return chart.data.labels.map((label: string, index: number) => {
              const value = datasets.data[index];
              const percentage = data[index].percentage;
              return {
                text: `${label} (${percentage.toFixed(1)}%)`,
                fillStyle: datasets.backgroundColor[index],
                strokeStyle: datasets.borderColor[index],
                lineWidth: 2,
                pointStyle: 'circle',
                hidden: false,
                index: index,
              };
            });
          },
        },
        onClick: (event: any, legendItem: any) => {
          const index = legendItem.index;
          const assetId = data[index].id;
          setSelectedAsset(selectedAsset === assetId ? null : assetId);
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed;
            const percentage = data[context.dataIndex].percentage;
            return `${label}: ${value.toLocaleString()} ETH (${percentage.toFixed(1)}%)`;
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  // 총 자산 가치 계산
  const totalValue = filteredData.reduce((sum, item) => sum + item.value, 0);

  // 선택된 자산 정보
  const selectedAssetData = selectedAsset ? filteredData.find(item => item.id === selectedAsset) : null;

  return (
    <div className="bg-white rounded-lg border p-4 sm:p-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center space-x-4 mt-2">
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-gray-900">
                {totalValue.toLocaleString()}
              </span>
              <span className="text-sm text-gray-500">ETH</span>
            </div>
            <span className="text-sm text-gray-500">
              총 {data.length}개 자산
            </span>
          </div>
        </div>

        {/* 차트 타입 선택 및 필터 */}
        <div className="flex space-x-2 mt-4 sm:mt-0">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {/* 차트 타입 변경 로직 */}}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                type === 'pie'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <PieChart className="w-4 h-4 inline mr-1" />
              파이
            </button>
            <button
              onClick={() => {/* 차트 타입 변경 로직 */}}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                type === 'doughnut'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-1" />
              도넛
            </button>
          </div>
          
          {/* 필터 토글 버튼 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              showFilters
                ? 'bg-primary-100 text-primary-600'
                : 'bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
            title="필터"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 필터 패널 */}
      {showFilters && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                자산명 검색
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="자산명을 입력하세요..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                최소 비중 (%)
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={minPercentage}
                onChange={(e) => setMinPercentage(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>{minPercentage}%</span>
                <span>50%</span>
              </div>
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-600">
            {filteredData.length}개 자산 표시 중 (전체 {data.length}개)
          </div>
        </div>
      )}

      {/* 차트 */}
      <div className="relative" style={{ height }}>
        {filteredData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <PieChart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">
                {data.length === 0 ? '자산 데이터가 없습니다.' : '필터 조건에 맞는 자산이 없습니다.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row items-center space-y-6 lg:space-y-0 lg:space-x-6">
            {/* 차트 */}
            <div className="flex-1" style={{ height }}>
              {type === 'pie' ? (
                <Pie data={chartData} options={options} />
              ) : (
                <Doughnut data={chartData} options={options} />
              )}
            </div>

            {/* 선택된 자산 상세 정보 */}
            {selectedAssetData && (
              <div className="lg:w-64 bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">자산 상세</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">자산명</p>
                    <p className="font-medium text-gray-900">{selectedAssetData.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">보유량</p>
                    <p className="font-medium text-gray-900">
                      {selectedAssetData.value.toLocaleString()} ETH
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">비중</p>
                    <p className="font-medium text-gray-900">
                      {selectedAssetData.percentage.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">색상</p>
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: selectedAssetData.color }}
                      />
                      <span className="text-sm text-gray-900">
                        {selectedAssetData.color}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 자산 목록 */}
      {filteredData.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-4">
            자산 목록 {filteredData.length !== data.length && `(${filteredData.length}/${data.length})`}
          </h4>
          <div className="space-y-3">
            {filteredData.map((asset) => (
              <div
                key={asset.id}
                className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                  selectedAsset === asset.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedAsset(selectedAsset === asset.id ? null : asset.id)}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: asset.color }}
                  />
                  <div>
                    <p className="font-medium text-gray-900">{asset.name}</p>
                    <p className="text-sm text-gray-500">{asset.percentage.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">
                    {asset.value.toLocaleString()} ETH
                  </p>
                  <p className="text-sm text-gray-500">
                    {((asset.value / totalValue) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetDistributionChart; 