import React, { useState, useEffect } from 'react';
import { Search, Compass } from 'lucide-react';
import type { ReaderPackage } from '../../types/book';
import { SearchIndexBuilder } from '../../builder/SearchIndexBuilder';
import '../styles/search.css';

interface SearchPanelProps {
  books: ReaderPackage[];
  onSelectResult: (workId: string, juan: number, segmentId: string, query: string) => void;
  initialSearchQuery?: string;
}

export function SearchPanel({ books, onSelectResult, initialSearchQuery }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedBookFilter, setSelectedBookFilter] = useState<string>('all');

  // 💡 自動還原搜尋結果
  useEffect(() => {
    if (initialSearchQuery) {
      setQuery(initialSearchQuery);
      setSelectedBookFilter('all');
      
      const allResults: any[] = [];
      books.forEach((book) => {
        const searchIndex = book.searchIndex;
        if (searchIndex) {
          const bookResults = SearchIndexBuilder.search(searchIndex, initialSearchQuery);
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
    }
  }, [initialSearchQuery, books]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSelectedBookFilter('all');
    const allResults: any[] = [];

    // 搜尋所有已下載書籍
    books.forEach((book) => {
      const searchIndex = book.searchIndex;
      if (searchIndex) {
        const bookResults = SearchIndexBuilder.search(searchIndex, query);
        
        // 附加書籍的 metadata 方便 UI 渲染
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
              <p style={{ fontWeight: 600, color: 'var(--color-wood-200)', marginBottom: '0.5rem' }}>未找到匹配經文</p>
              <p style={{ fontSize: '0.85rem' }}>請嘗試調整關鍵字，或確認您是否已下載該本經典。</p>
            </div>
          </div>
        )}

        {/* 初始狀態保持極簡空版面 */}
      </div>
    </div>
  );
}
export default SearchPanel;
