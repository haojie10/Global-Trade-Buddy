import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend
} from 'recharts';

interface SimpleChartProps {
  type: 'line' | 'bar' | 'pie';
  data: Array<{ name: string; value: number; [key: string]: any }>;
  dataKey?: string;
  color?: string;
  height?: number;
  xAxisKey?: string;
  colors?: string[]; // 适用于饼图
}

export default function SimpleChart({
  type,
  data,
  dataKey = 'value',
  color = '#7c6fff',
  height = 220,
  xAxisKey = 'name',
  colors = ['#7c6fff', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']
}: SimpleChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--admin-text-secondary)',
        fontSize: '0.85rem'
      }}>
        暂无足够数据展示图表
      </div>
    );
  }

  const customTooltipStyle = {
    backgroundColor: '#12122a',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '4px',
    color: '#e0e0e0',
    fontSize: '0.8rem'
  };

  if (type === 'line') {
    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
            <XAxis
              dataKey={xAxisKey}
              stroke="var(--admin-text-secondary)"
              fontSize={10}
              tickLine={false}
            />
            <YAxis
              stroke="var(--admin-text-secondary)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={customTooltipStyle} />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              activeDot={{ r: 6 }}
              dot={{ r: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'bar') {
    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
            <XAxis
              dataKey={xAxisKey}
              stroke="var(--admin-text-secondary)"
              fontSize={10}
              tickLine={false}
            />
            <YAxis
              stroke="var(--admin-text-secondary)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={customTooltipStyle} />
            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'pie') {
    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={4}
              dataKey={dataKey}
              nameKey={xAxisKey}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={customTooltipStyle} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}
