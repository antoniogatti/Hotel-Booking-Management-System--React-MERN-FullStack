import { useEffect, useRef, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { WAConversation, WAMessage } from "../../../shared/types";
import * as apiClient from "../api-client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  // Convert "393358246145" → "+39 335 824 6145" (heuristic: handle IT numbers)
  if (phone.startsWith("39") && phone.length >= 11) {
    const rest = phone.slice(2);
    if (rest.startsWith("3") && rest.length === 10) {
      // Mobile: +39 3XX XXX XXXX
      return `+39 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
    }
    return `+39 ${rest}`;
  }
  return `+${phone}`;
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

// ─── Sub-components ────────────────────────────────────────────────────────────

type ConvoItemProps = {
  convo: WAConversation;
  active: boolean;
  onClick: () => void;
};

const ConvoItem = ({ convo, active, onClick }: ConvoItemProps) => {
  const preview = convo.lastMessage
    ? convo.lastMessage.content.slice(0, 60) + (convo.lastMessage.content.length > 60 ? "…" : "")
    : "No messages";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-[#f0fdf4] transition-colors ${
        active ? "bg-[#dcfce7] border-l-4 border-l-[#25D366]" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-semibold text-sm text-gray-900">{formatPhone(convo.phone)}</span>
        <span className="text-xs text-gray-400 shrink-0 ml-2">
          {relativeTime(convo.updated_at)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {convo.lastMessage?.role === "assistant" && (
          <span className="text-[10px] bg-[#25D366] text-white px-1 rounded shrink-0">Sofia</span>
        )}
        <p className="text-xs text-gray-500 truncate">{preview}</p>
      </div>
    </button>
  );
};

type BubbleProps = { msg: WAMessage };

const Bubble = ({ msg }: BubbleProps) => {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"} mb-2`}>
      <div className="max-w-[75%]">
        {!isUser && (
          <span className="text-[10px] text-[#25D366] font-semibold ml-1 block text-right">
            Sofia
          </span>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
              : "text-white rounded-tr-sm"
          }`}
          style={isUser ? {} : { backgroundColor: "#25D366" }}
        >
          {msg.content}
        </div>
        <p className={`text-[10px] text-gray-400 mt-0.5 ${isUser ? "text-left ml-1" : "text-right mr-1"}`}>
          {formatDate(msg.ts)} {formatTime(msg.ts)}
        </p>
      </div>
    </div>
  );
};

// ─── Main page ─────────────────────────────────────────────────────────────────

const WAInbox = () => {
  const [conversations, setConversations] = useState<WAConversation[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  // Load conversation list + auto-refresh every 10s
  const loadConversations = async () => {
    try {
      const data = await apiClient.getWAConversations();
      setConversations(data);
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    void loadConversations();
    const interval = setInterval(() => void loadConversations(), 10_000);
    return () => clearInterval(interval);
  }, []);

  // Load thread when active phone changes
  useEffect(() => {
    if (!activePhone) return;
    setLoadingThread(true);
    apiClient.getWAThread(activePhone)
      .then((thread) => {
        setMessages(thread.messages);
        setLoadingThread(false);
      })
      .catch(() => setLoadingThread(false));
  }, [activePhone]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSelectConvo = (phone: string) => {
    setActivePhone(phone);
    setMessages([]);
    setReply("");
  };

  const handleSend = async () => {
    if (!activePhone || !reply.trim() || sending) return;
    setSending(true);
    try {
      await apiClient.sendWAReply(activePhone, reply.trim());
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply.trim(), ts: new Date().toISOString() },
      ]);
      setReply("");
      void loadConversations();
    } catch {
      // silently ignore
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-130px)]">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <FaWhatsapp className="h-6 w-6 text-[#25D366]" />
          <h1 className="text-xl font-bold text-[#2b4463]">Sofia Inbox</h1>
          <span className="ml-2 text-xs bg-[#f0fdf4] text-[#25D366] border border-[#bbf7d0] px-2 py-0.5 rounded-full font-medium">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">WhatsApp messages handled by Sofia AI</p>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: conversation list */}
        <div className="w-1/3 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
            Active conversations
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 p-6">
                <FaWhatsapp className="h-10 w-10 opacity-30" />
                <p className="text-sm text-center">No conversations yet. When guests message the B&amp;B, they'll appear here.</p>
              </div>
            ) : (
              conversations.map((c) => (
                <ConvoItem
                  key={c.phone}
                  convo={c}
                  active={activePhone === c.phone}
                  onClick={() => handleSelectConvo(c.phone)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: chat thread */}
        <div className="flex-1 flex flex-col bg-[#f0ece4] overflow-hidden">
          {activePhone ? (
            <>
              {/* Thread header */}
              <div className="px-4 py-3 bg-[#25D366] text-white flex items-center gap-3 shrink-0">
                <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                  {formatPhone(activePhone).slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-sm">{formatPhone(activePhone)}</p>
                  <p className="text-xs text-white/80">Active · Sofia is monitoring</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {loadingThread ? (
                  <div className="flex justify-center items-center h-full text-gray-400 text-sm">
                    Loading…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex justify-center items-center h-full text-gray-400 text-sm">
                    No messages
                  </div>
                ) : (
                  messages.map((m, i) => <Bubble key={i} msg={m} />)
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              <div className="px-4 py-3 bg-white border-t border-gray-200 flex items-end gap-2 shrink-0">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a reply… (Enter to send, Shift+Enter for newline)"
                  rows={2}
                  className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!reply.trim() || sending}
                  className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-colors disabled:opacity-40"
                  style={{ backgroundColor: reply.trim() && !sending ? "#25D366" : "#9ca3af" }}
                  aria-label="Send"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-white fill-current">
                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <FaWhatsapp className="h-16 w-16 opacity-20" />
              <p className="text-base font-medium">Select a conversation</p>
              <p className="text-sm">Choose a guest from the list to view their messages.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WAInbox;
