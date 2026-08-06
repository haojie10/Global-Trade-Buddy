import React, { useState, useRef, useEffect } from 'react';

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (newSelected: string[]) => void;
  allOptionLabel?: string;
  style?: React.CSSProperties;
}

export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  allOptionLabel = 'All',
  style
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 监听点击外部收起下拉框 (使用 capture 捕获阶段，防止事件在 Canvas 被拦截)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside, true);
      document.addEventListener('click', handleClickOutside, true);
    }

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, true);
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [isOpen]);

  const isAllSelected = selected.length === 0 || selected.includes(allOptionLabel) || selected.length === options.length;

  const handleToggleItem = (item: string) => {
    if (item === allOptionLabel) {
      onChange([allOptionLabel]);
      return;
    }

    let currentSelected = selected.filter(s => s !== allOptionLabel);

    if (currentSelected.includes(item)) {
      currentSelected = currentSelected.filter(s => s !== item);
    } else {
      currentSelected = [...currentSelected, item];
    }

    if (currentSelected.length === 0 || currentSelected.length === options.length) {
      onChange([allOptionLabel]);
    } else {
      onChange(currentSelected);
    }
  };

  const handleSelectAll = () => {
    onChange([allOptionLabel]);
  };

  const getDisplayText = () => {
    if (isAllSelected) return `${allOptionLabel === 'All' ? '全部' : allOptionLabel}`;
    if (selected.length === 1) return selected[0];
    return `已选 ${selected.length} 项`;
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>{label}</span>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--border-radius)',
            border: isOpen ? '1px solid var(--color-accent)' : '1px solid rgba(18, 18, 18, 0.08)',
            background: 'rgba(255, 255, 255, 0.65)',
            fontSize: '0.85rem',
            outline: 'none',
            cursor: 'pointer',
            color: 'var(--color-text)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            boxShadow: isOpen ? '0 0 0 2px rgba(255, 100, 30, 0.15)' : 'none'
          }}
        >
          <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {getDisplayText()}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 9999,
            minWidth: '200px',
            maxHeight: '280px',
            overflowY: 'auto',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(18, 18, 18, 0.1)',
            borderRadius: 'var(--border-radius)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
            padding: '8px 0'
          }}
        >
          {/* 顶栏控制按钮 */}
          <div
            style={{
              padding: '6px 12px',
              borderBottom: '1px solid rgba(18, 18, 18, 0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px'
            }}
          >
            <button
              type="button"
              onClick={handleSelectAll}
              style={{
                background: 'none',
                border: 'none',
                color: isAllSelected ? 'var(--color-accent)' : 'var(--color-muted)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
                padding: 0
              }}
            >
              全选 ({allOptionLabel})
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
              {isAllSelected ? '已全选' : `已选 ${selected.length}`}
            </span>
          </div>

          {/* 动态选项列表 */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {options.map((opt) => {
              const checked = isAllSelected || selected.includes(opt);
              return (
                <label
                  key={opt}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    userSelect: 'none',
                    transition: 'background 0.15s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.03)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleItem(opt)}
                    style={{
                      accentColor: 'var(--color-accent)',
                      cursor: 'pointer'
                    }}
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
