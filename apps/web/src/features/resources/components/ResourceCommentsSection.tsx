import { useState } from 'react';
import type { ResourceComment } from '@devstudy/shared';
import { useAddComment, useResourceComments } from '../api';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../../lib/toast';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Textarea } from '../../../components/ui/Textarea';

export interface ResourceCommentsSectionProps {
  resourceId: string;
}

export function ResourceCommentsSection({ resourceId }: ResourceCommentsSectionProps) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: comments = [], isLoading } = useResourceComments(resourceId);
  const addMutation = useAddComment(resourceId);

  const [content, setContent] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const handlePostComment = async () => {
    if (!user) {
      toast.push('Vui lòng đăng nhập để bình luận và đánh giá tài liệu', 'info');
      return;
    }
    if (content.trim().length < 5) {
      toast.push('Nội dung bình luận tối thiểu 5 ký tự', 'error');
      return;
    }
    await addMutation.mutateAsync({
      author: user.displayName,
      userRole: user.role,
      content: content.trim(),
      rating,
    });
    setContent('');
    toast.push('Đã đăng bình luận và đánh giá!');
  };

  const handlePostReply = async (parentId: string) => {
    if (!user) {
      toast.push('Vui lòng đăng nhập để phản hồi', 'info');
      return;
    }
    if (replyContent.trim().length < 3) {
      toast.push('Nội dung phản hồi tối thiểu 3 ký tự', 'error');
      return;
    }
    await addMutation.mutateAsync({
      author: user.displayName,
      userRole: user.role,
      content: replyContent.trim(),
      parentId,
    });
    setReplyContent('');
    setReplyToId(null);
    toast.push('Đã gửi phản hồi!');
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold text-ink">Đánh giá &amp; Bình luận ({comments.length})</h3>

      {/* New comment input */}
      <div className="mt-4 rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-700">Đánh giá tài liệu này:</span>
          <div className="flex items-center gap-1 text-amber-500">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="text-lg leading-none transition-transform hover:scale-125 focus:outline-none"
                title={`${star} sao`}
              >
                {star <= rating ? '★' : '☆'}
              </button>
            ))}
            <span className="ml-1 text-xs font-bold text-slate-600">({rating}/5 sao)</span>
          </div>
        </div>

        <Textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            user
              ? 'Chia sẻ cảm nhận, góp ý hoặc hỏi đáp về tài liệu này…'
              : 'Đăng nhập để tham gia đánh giá và bình luận tài liệu'
          }
          disabled={!user || addMutation.isPending}
        />

        <div className="flex justify-end">
          <Button onClick={handlePostComment} disabled={!user || addMutation.isPending}>
            {addMutation.isPending ? 'Đang gửi…' : 'Gửi đánh giá & bình luận'}
          </Button>
        </div>
      </div>

      {/* Comment list */}
      <div className="mt-6 space-y-4">
        {isLoading ? (
          <p className="text-sm text-slate-500">Đang tải bình luận…</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-slate-500 italic text-center py-4">
            Chưa có bình luận nào. Hãy là người đầu tiên để lại đánh giá!
          </p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                    {c.author.charAt(0)}
                  </span>
                  <div>
                    <span className="font-semibold text-sm text-ink">{c.author}</span>
                    {c.userRole && (
                      <span className="ml-2">
                        <Badge color={c.userRole === 'LECTURER' ? 'navy' : 'slate'}>
                          {c.userRole}
                        </Badge>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.rating && <span className="text-xs text-amber-600 font-bold">★ {c.rating}/5</span>}
                  <span className="text-xs text-slate-400">{c.createdAt}</span>
                </div>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">{c.content}</p>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setReplyToId(replyToId === c.id ? null : c.id)}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  {replyToId === c.id ? 'Huỷ phản hồi' : 'Phản hồi'}
                </button>
              </div>

              {/* Reply form */}
              {replyToId === c.id && (
                <div className="mt-2 pl-4 border-l-2 border-primary space-y-2">
                  <Textarea
                    rows={2}
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={`Trả lời ${c.author}…`}
                    className="text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setReplyToId(null);
                        setReplyContent('');
                      }}
                      className="text-xs py-1"
                    >
                      Huỷ
                    </Button>
                    <Button onClick={() => handlePostReply(c.id)} className="text-xs py-1">
                      Gửi trả lời
                    </Button>
                  </div>
                </div>
              )}

              {/* Nested replies */}
              {c.replies && c.replies.length > 0 && (
                <div className="mt-3 pl-4 border-l-2 border-slate-200 space-y-2">
                  {c.replies.map((r: ResourceComment) => (
                    <div key={r.id} className="rounded bg-surface p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800">{r.author}</span>
                          {r.userRole && (
                            <Badge color={r.userRole === 'LECTURER' ? 'navy' : 'slate'}>
                              {r.userRole}
                            </Badge>
                          )}
                        </div>
                        <span className="text-slate-400">{r.createdAt}</span>
                      </div>
                      <p className="text-slate-600">{r.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
