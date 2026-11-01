import { useCallback, useEffect, useRef, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { WAContact, WAConversation, WAMessage } from "../../../shared/types";
import * as apiClient from "../api-client";
import axios from "axios";

const isCancelled = (e: unknown) =>
  axios.isCancel(e) || (e instanceof Error && (e.name === "AbortError" || e.name === "CanceledError"));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  if (phone.startsWith("39") && phone.length >= 11) {
    const rest = phone.slice(2);
    if (rest.startsWith("3") && rest.length === 10)
      return `+39 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
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

function displayName(phone: string, contacts: Map<string, WAContact>): string {
  return contacts.get(phone)?.name ?? formatPhone(phone);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

type ConvoItemProps = {
  convo: WAConversation;
  active: boolean;
  disabled: boolean;
  contacts: Map<string, WAContact>;
  onClick: () => void;
};

const ConvoItem = ({ convo, active, disabled, contacts, onClick }: ConvoItemProps) => {
  const preview = convo.lastMessage
    ? convo.lastMessage.content.slice(0, 60) + (convo.lastMessage.content.length > 60 ? "…" : "")
    : "No messages";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors
        ${active ? "bg-[#dcfce7] border-l-4 border-l-[#25D366]" : "hover:bg-[#f0fdf4]"}
        ${disabled && !active ? "opacity-60 cursor-default" : ""}
      `}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-semibold text-sm text-gray-900">{displayName(convo.phone, contacts)}</span>
        <span className="text-xs text-gray-400 shrink-0 ml-2">{relativeTime(convo.updated_at)}</span>
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
          <span className="text-[10px] text-[#25D366] font-semibold ml-1 block text-right">Sofia</span>
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

const BubbleSkeleton = ({ right }: { right?: boolean }) => (
  <div className={`flex ${right ? "justify-end" : "justify-start"} mb-2`}>
    <div className={`h-8 rounded-2xl animate-pulse ${right ? "bg-[#25D366]/30 w-48" : "bg-gray-200 w-40"}`} />
  </div>
);

// ─── New chat modal ────────────────────────────────────────────────────────────

type NewChatModalProps = {
  onClose: () => void;
  onStart: (phone: string, name?: string) => void;
  contacts: Map<string, WAContact>;
};

const NewChatModal = ({ onClose, onStart, contacts }: NewChatModalProps) => {
  const [rawPhone, setRawPhone] = useState("");
  const [name, setName] = useState("");

  const normalise = (raw: string) => raw.replace(/\D/g, "");

  const handleStart = () => {
    const phone = normalise(rawPhone);
    if (phone.length < 8) return;
    const existing = contacts.get(phone);
    onStart(phone, name.trim() || existing?.name);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-[#2b4463]">New conversation</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Phone number (with country code)</label>
            <input
              type="tel"
              value={rawPhone}
              onChange={(e) => setRawPhone(e.target.value)}
              placeholder="e.g. 393358246145 or +39 335 824 6145"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Contact name (optional — saved to DB)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Guest name"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={normalise(rawPhone).length < 8}
            className="flex-1 rounded-xl py-2 text-sm text-white font-semibold disabled:opacity-40"
            style={{ backgroundColor: "#25D366" }}
          >
            Open chat
          </button>
        </div>
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
  const [contacts, setContacts] = useState<Map<string, WAContact>>(new Map());
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactName, setContactName] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [mobileShowList, setMobileShowList] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // AbortController refs — cancel in-flight requests before starting new ones
  const listAbortRef = useRef<AbortController | null>(null);
  const threadAbortRef = useRef<AbortController | null>(null);

  // Scroll helpers
  const maybeScrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100)
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const forceScrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

  // Load conversations — cancels any in-flight list request first
  const loadConversations = useCallback(async () => {
    listAbortRef.current?.abort();
    listAbortRef.current = new AbortController();
    try {
      const data = await apiClient.getWAConversations(listAbortRef.current.signal);
      setConversations(data);
    } catch (e: unknown) {
      if (!isCancelled(e)) console.warn("[inbox] list error:", e);
    }
  }, []);

  // Load thread — cancels any in-flight thread request first
  const loadThread = useCallback(async (phone: string, force = false): Promise<WAMessage[] | null> => {
    threadAbortRef.current?.abort();
    threadAbortRef.current = new AbortController();
    try {
      const thread = await apiClient.getWAThread(phone, threadAbortRef.current.signal);
      return thread.messages;
    } catch (e: unknown) {
      if (!isCancelled(e)) console.warn("[inbox] thread error:", e);
      return force ? [] : null; // null = aborted/ignored; [] = real empty
    }
  }, []);

  // Load contacts
  const loadContacts = useCallback(async () => {
    try {
      const data = await apiClient.getWAContacts();
      setContacts(new Map(data.map((c) => [c.phone, c])));
    } catch { /* ignore */ }
  }, []);

  // Initial load
  useEffect(() => {
    void loadConversations();
    void loadContacts();
  }, [loadConversations, loadContacts]);

  // Poll conversations every 8s (aborts previous before firing)
  useEffect(() => {
    const id = setInterval(() => void loadConversations(), 8_000);
    return () => clearInterval(id);
  }, [loadConversations]);

  // Load thread when active phone changes
  useEffect(() => {
    if (!activePhone) return;
    setLoadingThread(true);
    loadThread(activePhone, true).then((msgs) => {
      if (msgs !== null) {
        setMessages(msgs);
        setLoadingThread(false);
        setTimeout(forceScrollToBottom, 50);
      }
    });
  }, [activePhone, loadThread, forceScrollToBottom]);

  // Poll thread every 8s when a conversation is open
  useEffect(() => {
    if (!activePhone) return;
    const id = setInterval(async () => {
      const msgs = await loadThread(activePhone);
      if (msgs === null) return; // aborted — ignore
      setMessages((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(msgs)) return prev;
        setTimeout(maybeScrollToBottom, 50);
        return msgs;
      });
    }, 8_000);
    return () => clearInterval(id);
  }, [activePhone, loadThread, maybeScrollToBottom]);

  const handleSelectConvo = (phone: string) => {
    if (loadingThread && phone !== activePhone) return; // debounce rapid clicks
    setActivePhone(phone);
    setMessages([]);
    setReply("");
    setShowContactForm(false);
    setContactName("");
    setMobileShowList(false);
  };

  const handleNewChat = async (phone: string, name?: string) => {
    setShowNewChat(false);
    // Save contact name if provided
    if (name) {
      try {
        await apiClient.saveWAContact(phone, name);
        setContacts((prev) => new Map(prev).set(phone, { phone, name }));
      } catch { /* ignore */ }
    }
    handleSelectConvo(phone);
  };

  const handleBack = () => {
    threadAbortRef.current?.abort();
    setMobileShowList(true);
    setActivePhone(null);
    setLoadingThread(false);
  };

  const handleSend = async () => {
    if (!activePhone || !reply.trim() || sending) return;
    setSending(true);
    try {
      await apiClient.sendWAReply(activePhone, reply.trim());
      setMessages((prev) => [...prev, { role: "assistant", content: reply.trim(), ts: new Date().toISOString() }]);
      setReply("");
      void loadConversations();
      setTimeout(forceScrollToBottom, 50);
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  };

  const handleSaveContact = async () => {
    if (!activePhone || !contactName.trim()) return;
    setSavingContact(true);
    try {
      await apiClient.saveWAContact(activePhone, contactName.trim());
      setContacts((prev) => new Map(prev).set(activePhone, { phone: activePhone, name: contactName.trim() }));
      setShowContactForm(false);
      setContactName("");
    } catch { /* ignore */ } finally {
      setSavingContact(false);
    }
  };

  // ── Conversation list panel ──────────────────────────────────────────────────
  const listPanel = (
    <div className={`bg-white flex flex-col overflow-hidden border-r border-gray-200 md:w-1/3 md:flex ${mobileShowList ? "flex w-full" : "hidden md:flex"}`}>
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-2">
        <span>Active conversations</span>
        <span className="ml-auto h-2 w-2 rounded-full bg-[#25D366] animate-pulse" title="Live" />
        <button
          onClick={() => setShowNewChat(true)}
          className="ml-2 h-6 w-6 rounded-full flex items-center justify-center text-white text-base leading-none hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "#25D366" }}
          title="New conversation"
          aria-label="New conversation"
        >
          +
        </button>
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
              disabled={loadingThread && activePhone !== c.phone}
              contacts={contacts}
              onClick={() => handleSelectConvo(c.phone)}
            />
          ))
        )}
      </div>
    </div>
  );

  // ── Thread panel ─────────────────────────────────────────────────────────────
  const contactForActive = activePhone ? contacts.get(activePhone) : undefined;

  const threadPanel = (
    <div className={`flex-1 flex flex-col bg-[#f0ece4] overflow-hidden md:flex ${!mobileShowList ? "flex w-full" : "hidden md:flex"}`}>
      {activePhone ? (
        <>
          {/* Header */}
          <div className="shrink-0">
            <div className="px-4 py-3 bg-[#25D366] text-white flex items-center gap-3">
              <button onClick={handleBack} className="md:hidden mr-1 text-white/90 hover:text-white" aria-label="Back">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                </svg>
              </button>
              <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold shrink-0">
                {(contactForActive?.name ?? formatPhone(activePhone)).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {contactForActive?.name ?? formatPhone(activePhone)}
                </p>
                <p className="text-xs text-white/80">
                  {loadingThread ? "Loading…" : contactForActive ? formatPhone(activePhone) : "Active · Sofia is monitoring"}
                </p>
              </div>
              <span className="h-2 w-2 rounded-full bg-white/60 animate-pulse shrink-0" title="Live polling" />
              <button
                onClick={() => { setShowContactForm((v) => !v); setContactName(contactForActive?.name ?? ""); }}
                className="shrink-0 text-xs text-white/80 hover:text-white border border-white/30 rounded px-2 py-1 transition-colors"
              >
                {contactForActive ? "Edit" : "+ Save contact"}
              </button>
            </div>

            {showContactForm && (
              <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2">
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Contact name"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  onKeyDown={(e) => e.key === "Enter" && void handleSaveContact()}
                  autoFocus
                />
                <button
                  onClick={() => void handleSaveContact()}
                  disabled={!contactName.trim() || savingContact}
                  className="text-sm px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: "#25D366" }}
                >
                  {savingContact ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setShowContactForm(false)} className="text-sm text-gray-400 hover:text-gray-600 px-1">✕</button>
              </div>
            )}
          </div>

          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4">
            {loadingThread ? (
              <>
                <BubbleSkeleton />
                <BubbleSkeleton right />
                <BubbleSkeleton />
                <BubbleSkeleton right />
              </>
            ) : messages.length === 0 ? (
              <div className="flex justify-center items-center h-full text-gray-400 text-sm">No messages</div>
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
              {sending ? (
                <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-white fill-current">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
              )}
            </button>
          </div>
        </>
      ) : (
        <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-400 gap-3">
          <FaWhatsapp className="h-16 w-16 opacity-20" />
          <p className="text-base font-medium">Select a conversation</p>
          <p className="text-sm">Choose a guest from the list to view their messages.</p>
        </div>
      )}
    </div>
  );

  return (
    <>
    {showNewChat && (
      <NewChatModal
        onClose={() => setShowNewChat(false)}
        onStart={handleNewChat}
        contacts={contacts}
      />
    )}
    <div className="flex flex-col h-[calc(100vh-130px)]">
      <div className={`px-6 py-4 border-b border-gray-200 bg-white shrink-0 ${!mobileShowList ? "hidden md:block" : ""}`}>
        <div className="flex items-center gap-2">
          <FaWhatsapp className="h-6 w-6 text-[#25D366]" />
          <h1 className="text-xl font-bold text-[#2b4463]">Sofia Inbox</h1>
          <span className="ml-2 text-xs bg-[#f0fdf4] text-[#25D366] border border-[#bbf7d0] px-2 py-0.5 rounded-full font-medium">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </span>
          <span className="ml-1 flex items-center gap-1 text-xs text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full bg-[#25D366] animate-pulse inline-block" />
            live
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">WhatsApp messages handled by Sofia AI</p>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {listPanel}
        {threadPanel}
      </div>
    </div>
    </>
  );
};

export default WAInbox;
