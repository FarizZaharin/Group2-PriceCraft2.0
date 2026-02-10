import { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../shared/Toast';
import { db } from '../../lib/database';
import { canCommentOnRow } from '../../lib/permissions';
import { RowComment, User } from '../../types';

interface RowCommentsPanelProps {
  rowId: string;
  estimateOwnerId: string;
  onClose: () => void;
}

export default function RowCommentsPanel({ rowId, onClose }: RowCommentsPanelProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [comments, setComments] = useState<RowComment[]>([]);
  const [userMap, setUserMap] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canComment = user && canCommentOnRow(user.role);

  useEffect(() => {
    loadComments();
  }, [rowId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const data = await db.rowComments.getByRowId(rowId);
      setComments(data);

      const uniqueUserIds = [...new Set(data.map((c) => c.created_by_user_id))];
      const users: Record<string, User> = {};
      for (const uid of uniqueUserIds) {
        const u = await db.users.getById(uid);
        if (u) users[uid] = u;
      }
      setUserMap(users);
    } catch {
      showToast('error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!user || !newComment.trim()) return;
    setPosting(true);
    try {
      const comment = await db.rowComments.create({
        boq_row_id: rowId,
        comment_text: newComment.trim(),
        created_by_user_id: user.id,
      });
      setComments((prev) => [...prev, comment]);
      if (!userMap[user.id]) {
        setUserMap((prev) => ({ ...prev, [user.id]: user }));
      }
      setNewComment('');
    } catch {
      showToast('error', 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePostComment();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Comments</h3>
            <span className="text-sm text-gray-500">({comments.length})</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="text-center text-sm text-gray-500 py-8">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No comments yet</p>
              {canComment && (
                <p className="text-xs text-gray-400 mt-1">Start the conversation below</p>
              )}
            </div>
          ) : (
            comments.map((comment) => {
              const author = userMap[comment.created_by_user_id];
              const isOwnComment = user?.id === comment.created_by_user_id;
              return (
                <div
                  key={comment.id}
                  className={`flex gap-3 ${isOwnComment ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                      isOwnComment
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {author ? getInitials(author.name) : '??'}
                  </div>
                  <div className={`max-w-[80%] ${isOwnComment ? 'text-right' : ''}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-gray-900">
                        {author?.name || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                    <div
                      className={`inline-block px-3 py-2 rounded-lg text-sm leading-relaxed ${
                        isOwnComment
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {comment.comment_text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {canComment && (
          <div className="border-t border-gray-200 p-4">
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a comment..."
                rows={2}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handlePostComment}
                disabled={posting || !newComment.trim()}
                className="self-end px-3 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
