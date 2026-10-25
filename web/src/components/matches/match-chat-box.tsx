'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MatchMessage } from '@/types/database'
import { sendMatchMessage, getMatchMessages } from '@/app/actions/chat'
import { Button } from '@/components/ui/button'
import { MessageSquare, Send } from 'lucide-react'

import { formatTime } from '@/lib/format'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
interface MatchChatBoxProps {
  matchId: string
  currentUserId?: string
  initialMessages: MatchMessage[]
}

export function MatchChatBox({
  matchId,
  currentUserId,
  initialMessages,
}: MatchChatBoxProps) {
  const router = useRouter()
  const t = useTranslations('matches.chat')
  const [messages, setMessages] = useState<MatchMessage[]>(initialMessages)
  const [inputMessage, setInputMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Vừa được duyệt vào kèo thì tải lại lịch sử tin nhắn (trước đó chưa có quyền đọc)
  useEffect(() => {
    getMatchMessages(matchId).then((data) => {
      if (data.length > 0) setMessages(data)
    })
  }, [matchId])

  // Lắng nghe Realtime tin nhắn mới
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`match-chat-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_messages',
          filter: `match_id=eq.${matchId}`,
        },
        async (payload) => {
          const newMsg = payload.new as MatchMessage

          // Lấy profile người gửi nếu chưa có
          let profile = undefined
          if (newMsg.user_id) {
            const { data: p } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', newMsg.user_id)
              .single()
            profile = p || undefined
          }

          const completeMessage: MatchMessage = {
            id: newMsg.id,
            match_id: newMsg.match_id,
            user_id: newMsg.user_id,
            content: newMsg.content,
            created_at: newMsg.created_at,
            profile,
          }

          setMessages((prev) => {
            // Tránh trùng lặp id
            if (prev.some((m) => m.id === completeMessage.id)) return prev
            return [...prev, completeMessage]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId])

  async function handleSend() {
    if (!inputMessage.trim() || sending) return

    if (!currentUserId) {
      toast.info(t('loginToast'), {
        action: { label: t('loginAction'), onClick: () => router.push('/login') },
      })
      return
    }

    const content = inputMessage
    setInputMessage('')
    setSending(true)

    const res = await sendMatchMessage(matchId, content)
    setSending(false)

    if (res.error) {
      toast.error(res.error)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs flex flex-col h-[480px]">
      {/* Header */}
      <div className="px-5 py-3.5 bg-muted/40 border-b border-border/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">{t('title')}</h3>
            <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {t('live')}
        </span>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-semibold">{t('empty')}</p>
            <p className="text-xs text-muted-foreground/70">
              {t('emptyHint')}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === currentUserId
            const senderName = msg.profile?.full_name || t('playerFallback')
            const initial = senderName.charAt(0).toUpperCase()
            const timeStr = formatTime(msg.created_at)

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isMe
                      ? 'bg-emerald-700 text-white'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {initial}
                </div>

                {/* Bubble */}
                <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <div className="text-xs font-semibold text-muted-foreground px-1">
                      {senderName}
                    </div>
                  )}

                  <div
                    className={`px-3.5 py-2 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isMe
                        ? 'bg-emerald-700 text-white rounded-tr-xs'
                        : 'bg-muted/70 text-foreground border border-border/60 rounded-tl-xs'
                    }`}
                  >
                    {msg.content}
                  </div>

                  <div
                    className={`text-xs text-muted-foreground px-1 ${
                      isMe ? 'text-right' : 'text-left'
                    }`}
                  >
                    {timeStr}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input box */}
      <div className="p-3 bg-muted/30 border-t border-border/70 flex items-center gap-2">
        <input
          type="text"
          className="flex-1 bg-background border border-border rounded-xl px-3.5 py-2 text-xs sm:text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          placeholder={
            currentUserId
              ? t('placeholder')
              : t('placeholderLogin')
          }
          disabled={!currentUserId || sending}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          size="sm"
          className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl px-4 h-9 cursor-pointer shadow-xs"
          disabled={!currentUserId || !inputMessage.trim() || sending}
          onClick={handleSend}
        >
          <Send className="w-4 h-4 mr-1" />
          {t('send')}
        </Button>
      </div>
    </div>
  )
}

