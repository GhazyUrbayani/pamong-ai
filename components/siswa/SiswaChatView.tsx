'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Message, AITheme, Session } from '@/types';
import { AICharacter } from '@/components/chat/AICharacter';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { QuotaCounter } from '@/components/chat/QuotaCounter';
import { BottomNav } from '@/components/ui/BottomNav';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import aiThemes from '@/config/ai-themes.json';

const SUGGESTED_PROMPTS = [
  '🔬 Apa perbedaan reaksi terang & reaksi gelap?',
  '🌿 Mengapa fotolisis air sangat krusial bagi Fotosistem II?',
  '🧠 Bagaimana jika konsentrasi CO2 terbatas saat cahaya terik?',
  '🌵 Kenapa tumbuhan CAM membuka stomata pada malam hari?',
];

export default function SiswaChatView() {
  const router = useRouter();

  const [student, setStudent] = useState<any>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [currentThemeKey, setCurrentThemeKey] = useState<string>('biologi');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatUsed, setChatUsed] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  // True when the last reply came from the offline stub instead of a model.
  const [isDegraded, setIsDegraded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Initial Load & Auth verification
  useEffect(() => {
    const token = localStorage.getItem('siswa_token');
    const storedStudent = localStorage.getItem('siswa_data');
    const storedSession = localStorage.getItem('siswa_session');

    if (!token || !storedStudent) {
      router.push('/siswa/login');
      return;
    }

    const parsedStudent = JSON.parse(storedStudent);
    const parsedSession = storedSession ? JSON.parse(storedSession) : null;

    setStudent(parsedStudent);
    setSession(parsedSession);

    if (parsedSession?.aiTheme) {
      setCurrentThemeKey(parsedSession.aiTheme);
    }

    // Fetch initial chat history
    fetchHistory(token);
  }, [router]);

  // 2. Fetch chat history
  const fetchHistory = async (token: string) => {
    try {
      const res = await fetch('/api/chat/history', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setChatUsed(data.chatUsed || 0);
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('[Chat] Failed to load history:', err);
    }
  };

  // 3. Polling for room collaboration (every 3.5 seconds)
  useEffect(() => {
    const token = localStorage.getItem('siswa_token');
    if (!token) return;

    const interval = setInterval(() => {
      fetchHistory(token);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  // 4. Send Message Handler
  const handleSendMessage = async (text: string) => {
    const token = localStorage.getItem('siswa_token');
    if (!token || !session) return;

    const optimisticId = crypto.randomUUID();
    const optimisticMessage: Message = {
      id: optimisticId,
      sessionId: session.id,
      studentId: student.id,
      roomCode: student.roomCode || null,
      role: 'user',
      content: text,
      questionLevel: null,
      createdAt: Date.now(),
    };

    // Optimistic UI update
    setMessages((prev) => [...prev, optimisticMessage]);
    setChatUsed((prev) => prev + 1);
    setIsLoading(true);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim pesan');
      }

      // Surface whether this reply actually came from a model
      setIsDegraded(Boolean(data.degraded));

      // Update the user message with classified questionLevel
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticId ? { ...m, questionLevel: data.questionLevel, classificationProvenance: data.classificationProvenance } : m
        )
      );

      // Append assistant response
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        studentId: student.id,
        roomCode: student.roomCode || null,
        role: 'assistant',
        content: data.reply,
        questionLevel: null,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setTimeout(scrollToBottom, 50);
    } catch (err: any) {
      console.error('[Chat error]', err);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        studentId: student.id,
        roomCode: student.roomCode || null,
        role: 'assistant',
        content: `⚠️ Terjadi kendala: ${err.message || 'Gagal menghubungi AI.'}`,
        questionLevel: null,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const themeConfig: AITheme =
    (aiThemes as Record<string, any>)[currentThemeKey] || aiThemes.umum;

  const quotaTotal = session?.quotaPerStudent || 20;
  const isQuotaExceeded = chatUsed >= quotaTotal;

  return (
    <div
      className="chat-container has-bottom-nav"
      style={
        {
          '--ai-primary': themeConfig.primaryColor,
          '--ai-accent': themeConfig.accentColor,
          '--ai-bg-gradient': (themeConfig as any).bgGradient || 'var(--bg-base)',
        } as React.CSSProperties
      }
    >
      {/* Demo Switcher Quick Top Bar */}
      <div
        style={{
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8125rem',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'hsla(230, 22%, 7%, 0.95)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Akun Siswa:</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {student?.displayName || 'Siswa'}
          </span>
          <span
            className="font-mono"
            style={{ fontSize: '0.75rem', color: 'var(--brand-accent)' }}
          >
            @{student?.username}
          </span>
        </div>
        <a
          href="/guru/dashboard"
          style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-accent)' }}
        >
          → Kembali ke Dashboard Guru
        </a>
      </div>


      {/* Degraded-mode banner: the stub is NOT grounded in the teacher's module,
          so it must never be mistaken for a real answer. */}
      {isDegraded && (
        <div
          role="status"
          style={{
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '0.8125rem',
            lineHeight: 1.45,
            color: 'var(--status-yellow)',
            background: 'var(--status-yellow-bg)',
            borderBottom: '1px solid var(--status-yellow)',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '1rem', lineHeight: 1.2 }}>
            ⚠️
          </span>
          <span>
            <strong>Layanan AI tidak berjalan normal.</strong> Balasan ini berasal dari mode demo
            atau pesan kegagalan provider, bukan jawaban model yang dapat dinilai sebagai grounded.
            Mode seperti ini tidak dihitung sebagai klasifikasi pertanyaan yang valid.
          </span>
        </div>
      )}

      {/* Header */}
      <header className="chat-header justify-between">
        <AICharacter
          theme={themeConfig}
          subject={session?.subject || 'Materi Guru'}
          isTyping={isLoading}
        />

        <div className="flex items-center gap-2">
          {student?.roomCode && (
            <span
              className="text-xs px-2 py-1 rounded-md font-mono"
              style={{
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                color: 'var(--brand-accent)',
                border: '1px solid var(--brand-primary)',
              }}
              title="Room Kolaborasi Aktif"
            >
              👥 Room: {student.roomCode}
            </span>
          )}

          {/* Theme Switcher Button */}
          <button
            onClick={() => setIsThemePickerOpen(!isThemePickerOpen)}
            className="btn btn-ghost"
            style={{
              width: '36px',
              height: '36px',
              minHeight: '36px',
              padding: 0,
              fontSize: '18px',
            }}
            title="Ganti Tema Karakter AI"
            aria-label="Ganti Karakter AI"
          >
            🎨
          </button>
        </div>
      </header>

      {/* Theme Picker Modal / Dropdown */}
      {isThemePickerOpen && (
        <div
          className="p-3 glass border-b animate-fadeIn"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-secondary uppercase">
              Pilih Preset Karakter AI:
            </span>
            <button
              onClick={() => setIsThemePickerOpen(false)}
              className="text-xs text-muted"
            >
              Tutup ✕
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(aiThemes).map(([key, t]) => (
              <button
                key={key}
                onClick={() => {
                  setCurrentThemeKey(key);
                  setIsThemePickerOpen(false);
                }}
                className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all ${
                  currentThemeKey === key ? 'ring-2' : 'opacity-70'
                }`}
                style={{
                  backgroundColor: `${t.primaryColor}22`,
                  color: t.primaryColor,
                  border: `1px solid ${t.primaryColor}`,
                }}
              >
                <span>{t.avatar}</span>
                <span>{t.fullName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quota Counter Bar */}
      <div style={{ padding: '0 16px', background: 'rgba(9, 9, 14, 0.4)' }}>
        <QuotaCounter used={chatUsed} total={quotaTotal} />
      </div>

      {/* Message List */}
      <main className="chat-messages" role="log" aria-live="polite">
        {/* Welcome Greeting from AI */}
        {messages.length === 0 && (
          <div className="text-center my-auto p-6 animate-fadeUp">
            <div
              className="ai-avatar mx-auto mb-3"
              style={{
                width: '64px',
                height: '64px',
                fontSize: '32px',
                backgroundColor: themeConfig.primaryColor,
                margin: '0 auto 16px',
              }}
            >
              <span>{themeConfig.avatar}</span>
            </div>
            <h2
              className="font-bold text-base mb-1"
              style={{ color: 'var(--text-primary)' }}
            >
              {themeConfig.fullName}
            </h2>
            <p className="text-xs text-secondary mb-4 max-w-xs mx-auto">
              {themeConfig.greeting}
            </p>
            <div
              className="card text-left text-xs text-muted max-w-sm mx-auto"
              style={{ background: 'rgba(17, 17, 24, 0.6)' }}
            >
              <p className="font-semibold text-brand mb-1">💡 Tips Belajar:</p>
              <p>
                Variasikan pertanyaanmu: fakta, penjelasan proses, serta penerapan atau
                penalaran. Kategori ini menggambarkan bentuk pertanyaan, bukan nilai kemampuan.
              </p>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            message={m}
            aiTheme={themeConfig}
            currentStudentId={student?.id}
          />
        ))}

        {isLoading && (
          <div className="chat-bubble-wrap assistant">
            <div
              className="ai-avatar"
              style={{
                width: '32px',
                height: '32px',
                fontSize: '16px',
                backgroundColor: themeConfig.primaryColor,
              }}
            >
              <span>{themeConfig.avatar}</span>
            </div>
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Suggested Prompt Chips */}
      <div
        style={{
          width: '100%',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            maxWidth: '940px',
            margin: '0 auto',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
          }}
          className="no-scrollbar"
        >
          <span
            style={{
              fontSize: '0.8125rem',
              color: 'var(--brand-accent)',
              whiteSpace: 'nowrap',
              fontWeight: 700,
            }}
          >
            💡 Pemantik:
          </span>
          {SUGGESTED_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt.replace(/^[^\s]+\s/, ''))}
              disabled={isLoading || isQuotaExceeded}
              style={{
                fontSize: '0.8125rem',
                fontWeight: 500,
                padding: '6px 14px',
                borderRadius: '9999px',
                whiteSpace: 'nowrap',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>



      {/* Chat Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        isQuotaExceeded={isQuotaExceeded}
        placeholder={`Tanyakan pada ${themeConfig.name}...`}
      />

      {/* PWA Prompt */}
      <InstallPrompt variant="siswa" />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
