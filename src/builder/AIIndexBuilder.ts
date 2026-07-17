import type { BookContent, BookEmbedding } from '../types/book';

/**
   * AIIndexBuilder - 預留未來 AI RAG/Embedding 建置結構的基礎
   * 現階段僅作為架構骨架，不執行實際的外部 LLM / Embedding API 調用
   */
export class AIIndexBuilder {
  /**
   * 預留未來建立 Embedding 向量索引的接口
   * 可以在此處擴展為調用本地 transformers.js 或遠端 Embedding API
   */
  static async buildAIIndex(content: BookContent): Promise<BookEmbedding> {
    const items: BookEmbedding['items'] = [];

    // 模擬或預留將段落 (TextSegment) 轉化為 Vector 的過程
    content.juans.forEach(juanData => {
      juanData.segments.forEach(seg => {
        items.push({
          segmentId: seg.id,
          vector: [], // 預留向量陣列，例如未來使用 [0.12, -0.45, ...]
          text: seg.content
        });
      });
    });

    // 模擬一個非同步的延遲，體現 AI Indexer 運作
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      workId: content.workId,
      items
    };
  }

  /**
   * 預留未來執行本地相似度 (Cosine Similarity) 檢索的演算法
   */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
