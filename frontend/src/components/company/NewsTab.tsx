'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  published_date: string | null;
  sentiment: string | null;
  summary: string | null;
}

interface NewsTabProps {
  sponsorId: string;
}

function sentimentBadge(sentiment: string | null) {
  if (!sentiment) return <Badge>Unknown</Badge>;
  if (sentiment === 'positive') return <Badge variant="green">Positive</Badge>;
  if (sentiment === 'negative') return <Badge variant="red">Negative</Badge>;
  return <Badge variant="orange">Neutral</Badge>;
}

export function NewsTab({ sponsorId }: NewsTabProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<NewsArticle[]>(`/api/v1/sponsors/${sponsorId}/news`)
      .then(setArticles)
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [sponsorId]);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>News & Mentions ({articles.length})</CardTitle>
        </CardHeader>
      </Card>

      {articles.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-dim">
          No news articles found for this company.
        </div>
      ) : (
        articles.map((article) => (
          <Card key={article.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {sentimentBadge(article.sentiment)}
                  <span className="text-xs text-dim">{article.source}</span>
                  <span className="text-xs text-dim2">{formatDate(article.published_date)}</span>
                </div>
                <h3 className="mt-1 text-sm font-medium text-text">{article.title}</h3>
                {article.summary && (
                  <p className="mt-1 text-xs text-dim line-clamp-2">{article.summary}</p>
                )}
              </div>
              {article.url && (
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-accent">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
