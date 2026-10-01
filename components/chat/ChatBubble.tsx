'use client';

import React from 'react';
import { Message, AITheme } from '@/types';
import { Badge } from '@/components/ui/Badge';

interface ChatBubbleProps {
  message: Message;
  aiTheme: AITheme;
  currentStudentId?: string;
}

export function ChatBubble({ message, aiTheme, currentStudentId }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isSelf = isUser && message.studentId === currentStudentId;

  const formatTime = (ts: number) => {
    try {
      const d = new Date(ts);
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  return (
    <div
      className={`chat-bubble-wrap ${isUser ? 'user' : 'assistant'}`}
      style={{
        display: 'flex',
        width: '100%',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        alignItems: 'flex-start',
        gap: '12px',
      }}
    >
      {/* AI Avatar on left */}
      {!isUser && (
        <div
          className="ai-avatar"
          style={{
            width: '38px',
            height: '38px',
            fontSize: '18px',
            backgroundColor: aiTheme.primaryColor || 'var(--brand-primary)',
            border: '2px solid hsla(220, 20%, 93%, 0.1)',
            boxShadow: '0 2px 10px hsla(245, 60%, 55%, 0.25)',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          <span>{aiTheme.avatar}</span>
        </div>
      )}

      {/* Message content container */}
      <div
        className="flex flex-col"
        style={{
          maxWidth: isUser ? '78%' : '84%',
          alignItems: isUser ? 'flex-end' : 'flex-start',
        }}
      >
        {/* If in collaboration room and from another student */}
        {isUser && !isSelf && message.roomCode && (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--brand-accent)',
              marginBottom: '4px',
              padding: '2px 8px',
              background: 'hsla(245, 60%, 55%, 0.12)',
              borderRadius: '6px',
            }}
          >
            👥 Teman Sekelas ({message.studentId.slice(0, 6)})
          </span>
        )}

        {/* Bubble */}
        <div
          className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}
          style={{
            width: 'fit-content',
            wordBreak: 'break-word',
          }}
        >
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
            {message.content}
          </div>
        </div>

        {/* Metadata: question-category badge + timestamp */}
        <div
          className="chat-bubble-meta"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '6px',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            padding: '0 4px',
          }}
        >
          {isUser && message.questionLevel && (
            <Badge level={message.questionLevel} />
          )}
          <span
            className="font-mono"
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              fontWeight: 500,
            }}
            suppressHydrationWarning
          >
            {formatTime(message.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

