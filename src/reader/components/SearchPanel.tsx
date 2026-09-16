import React, { useState, useEffect } from 'react';
import { Search, Compass } from 'lucide-react';
import type { ReaderPackage } from '../../types/book';
import { SearchIndexBuilder } from '../../builder/SearchIndexBuilder';
import '../styles/search.css';

interface SearchPanelProps {
  books: ReaderPackage[];
  onSelectResult: (workId: string, juan: number, segmentId: string, query: string) => void;
  initialSearchQuery?: string;
  onTriggerOnlineSearch?: (query: string) => void;
}

export function SearchPanel({ books, onSelectResult, initialSearchQuery, onTriggerOnlineSearch }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedBookFilter, setSelectedBookFilter] = useState<string>('all');

  // 💡 近期 5 個搜尋關鍵字紀錄 (LocalStorage 持久化)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cbeta_recent_local_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveRecentSearch = (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, 5);
      try {
        localStorage.setItem('cbeta_recent_local_searches', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const executeSearch = (searchQueryText: string) => {
    const trimmed = searchQueryText.trim();
    if (!trimmed) return;

    saveRecentSearch(trimmed);
    setSelectedBookFilter('all');
    const allResults: any[] = [];

    // 搜尋所有已下載書籍
    books.forEach((book) => {
      const searchIndex = book.searchIndex;
      if (searchIndex) {
        const bookResults = SearchIndexBuilder.search(searchIndex, trimmed);
        bookResults.forEach((res) => {
          allResults.push({
            ...res,
            bookTitle: book.metadata.title,
            workId: book.metadata.workId
          });
        });
      }
    });

    setResults(allResults);
    setSearched(true);
  };

  // 💡 自動還原搜尋結果
  useEffect(() => {
    if (initialSearchQuery) {
      setQuery(initialSearchQuery);
      executeSearch(initialSearchQuery);
    }
  }, [initialSearchQuery, books]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  // 💡 統計各本書籍的匹配數量
  const bookStats = React.useMemo(() => {
    const stats: { [workId: string]: { title: string; count: number } } = {};
    results.forEach((res) => {
      if (!stats[res.workId]) {
        stats[res.workId] = { title: res.bookTitle, count: 0 };
      }
      stats[res.workId].count++;
    });
    return stats;
  }, [results]);

  const filteredResults = selectedBookFilter === 'all'
    ? results
    : results.filter(res => res.workId === selectedBookFilter);

  // 限制搜尋結果摘要前後句數，並以 … 銜接
  const getTruncatedSnippet = (text: string, highlightRanges: Array<{start: number, end: number}>) => {
    if (highlightRanges.length === 0) {
      return {
        truncatedText: text.length > 60 ? text.substring(0, 60) + '…' : text,
        adjustedRanges: []
      };
    }

    const firstRange = highlightRanges[0];
    const keyStart = firstRange.start;
    const sentenceDelimiters = /[。！？；]/;

    // 1. 往前尋找最多兩句話
    let startIdx = keyStart;
    let sentenceCountBefore = 0;
    while (startIdx > 0 && sentenceCountBefore < 2) {
      startIdx--;
      if (sentenceDelimiters.test(text[startIdx])) {
        sentenceCountBefore++;
        if (sentenceCountBefore === 2) {
          startIdx++; // 越過該句號，保留後續句子
          break;
        }
      }
    }
    if (keyStart - startIdx > 35) {
      startIdx = keyStart - 35;
    }

    // 2. 往後尋找最多兩句話
    const keyEnd = highlightRanges[highlightRanges.length - 1].end;
    let endIdx = keyEnd;
    let sentenceCountAfter = 0;
    while (endIdx < text.length && sentenceCountAfter < 2) {
      if (sentenceDelimiters.test(text[endIdx])) {
        sentenceCountAfter++;
      }
      endIdx++;
    }
    if (endIdx - keyEnd > 45) {
      endIdx = keyEnd + 45;
    }

    // 3. 截取並加上「…」
    let truncatedText = text.substring(startIdx, endIdx);
    if (startIdx > 0) {
      truncatedText = '…' + truncatedText;
    }
    if (endIdx < text.length) {
      truncatedText = truncatedText + '…';
    }

    // 4. 調整高亮偏移
    const offset = startIdx - (startIdx > 0 ? 1 : 0);
    const adjustedRanges = highlightRanges
      .map(r => ({
        start: r.start - offset,
        end: r.end - offset
      }))
      .filter(r => r.start >= 0 && r.end <= truncatedText.length);

    return {
      truncatedText,
      adjustedRanges
    };
  };

  // 高亮關鍵字渲染函數
  const renderHighlightedText = (text: string, highlightRanges: Array<{start: number, end: number}>) => {
    if (highlightRanges.length === 0) return text;

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    highlightRanges.forEach((range, i) => {
      // 插入前段普通文本
      if (range.start > lastIndex) {
        elements.push(text.substring(lastIndex, range.start));
      }
      // 插入高亮文本
      elements.push(
        <mark key={`hl-${i}`} className="search-highlight">
          {text.substring(range.start, range.end)}
        </mark>
      );
      lastIndex = range.end;
    });

    // 插入尾部普通文本
    if (lastIndex < text.length) {
      elements.push(text.substring(lastIndex));
    }

    return <>{elements}</>;
  };

  return (
    <div className={`search-panel-container ${!searched ? 'is-centered' : ''}`}>

      <div className="search-bar-wrapper">
        <form onSubmit={handleSearch} className="search-panel-bar">
          <input
            type="text"
            placeholder="輸入多個關鍵字，例如：地藏 菩薩 功德"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="search-panel-btn" title="搜尋">
            <Search size={18} />
          </button>
        </form>

        {/* 💡 近期 5 個搜尋關鍵字 Chip 標籤列 (單行、灰黑小字，型式對齊圖4) */}
        {recentSearches.length > 0 && (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              marginTop: '0.55rem', 
              overflowX: 'auto', 
              whiteSpace: 'nowrap',
              paddingBottom: '0.15rem',
              width: '100%',
              maxWidth: '440px',
              paddingLeft: '0.4rem',
              boxSizing: 'border-box'
            }}
            className="custom-scrollbar"
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #718096)', flexShrink: 0, opacity: 0.85 }}>
              近期搜尋：
            </span>
            {recentSearches.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(q);
                  executeSearch(q);
                }}
                style={{
                  fontSize: '0.76rem',
                  color: 'var(--text-primary, #4a5568)',
                  backgroundColor: 'var(--theme-accent-light, rgba(0, 0, 0, 0.04))',
                  border: '1px solid var(--theme-accent-border, rgba(0, 0, 0, 0.12))',
                  borderRadius: '12px',
                  padding: '0.15rem 0.55rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
                title={`點擊立即搜尋：${q}`}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* 💡 放在中間的搜尋 bar 虛線下緣，置左（若已有近期搜尋則不再顯示） */}
        {recentSearches.length === 0 && (
          <div className="search-info-tip" style={{ marginTop: '0.2rem' }}>
            站內已下載書籍檢索
          </div>
        )}
      </div>

      {searched && (
        <div className="search-stats">
          <span>
            共搜尋到 <strong>{results.length}</strong> 處符合的經文段落
          </span>
          {query.trim().split(/\s+/).length > 1 && (
            <span style={{ color: 'var(--color-gold-400)' }}>已啟動多重關鍵字 AND 檢索</span>
          )}
        </div>
      )}

      {/* 💡 經典過濾膠囊按鈕列 (當結果跨越超過1本書時呈現) */}
      {searched && results.length > 0 && Object.keys(bookStats).length > 1 && (
        <div className="search-filter-tabs">
          <button 
            className={`filter-tab ${selectedBookFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedBookFilter('all')}
          >
            全部 ({results.length})
          </button>
          {Object.entries(bookStats).map(([workId, info]) => (
            <button
              key={workId}
              className={`filter-tab ${selectedBookFilter === workId ? 'active' : ''}`}
              onClick={() => setSelectedBookFilter(workId)}
            >
              {info.title} ({info.count})
            </button>
          ))}
        </div>
      )}

      <div className="search-results-box custom-scrollbar" style={{ marginTop: '0.5rem' }}>
        {filteredResults.map((res, index) => (
          <div
            key={`res-${index}`}
            className="search-result-card"
            onClick={() => onSelectResult(res.workId, res.juan, res.segmentId, query)}
          >
            <div className="card-header">
              <span className="card-title">{res.bookTitle}</span>
              <span className="card-location">
                第 {res.juan} 卷 · {res.tocTitle}
              </span>
            </div>
            <div className="card-snippet">
              {(() => {
                const { truncatedText, adjustedRanges } = getTruncatedSnippet(res.content, res.highlightRanges);
                return renderHighlightedText(truncatedText, adjustedRanges);
              })()}
            </div>
          </div>
        ))}

        {searched && results.length === 0 && (
          <div className="search-no-results">
            <Compass size={60} strokeWidth={1} />
            <div>
              <p style={{ fontWeight: 600, color: 'var(--color-wood-200)', marginBottom: '0.5rem' }}>未找到本地匹配經文</p>
              <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>請確認您是否已下載該本經典。</p>
              {onTriggerOnlineSearch && query.trim() && (
                <button
                  onClick={() => onTriggerOnlineSearch(query.trim())}
                  className="online-search-trigger-btn"
                  style={{
                    backgroundColor: 'var(--theme-accent)',
                    color: '#fff',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-serif)',
                    fontWeight: 600,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  🔍 在線上 CBETA 檢索並下載「{query.trim()}」
                </button>
              )}
            </div>
          </div>
        )}

        {/* 初始狀態保持極簡空版面 */}
      </div>
    </div>
  );
}
export default SearchPanel;
