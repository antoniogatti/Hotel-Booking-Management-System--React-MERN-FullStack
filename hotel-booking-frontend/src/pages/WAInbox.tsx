import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { PendingReply, WAContact, WAConversation, WAMessage } from "../../../shared/types";
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

function displayName(phone: string, contacts: Map<string, WAContact>, fallbackName?: string): string {
  return contacts.get(phone)?.name ?? fallbackName ?? formatPhone(phone);
}

const PAGE_SIZE = 20;
const THREAD_PAGE_SIZE = 30;
const POLL_MS = 8_000;
const MAX_POLL_MS = 60_000;

// WhatsApp-style doodle wallpaper (original artwork, tiled)
const CHAT_WALLPAPER: React.CSSProperties = {
  backgroundColor: "#cfe3df",
  backgroundImage: "url('/common/wa-doodle.svg')",
  backgroundSize: "260px 260px",
};

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
        <span className={`text-sm text-gray-900 truncate ${convo.unread ? "font-bold" : "font-semibold"}`}>
          {displayName(convo.phone, contacts, convo.name)}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {convo.hasPending && (
            <span className="h-2 w-2 rounded-full bg-orange-400" title="Sofia draft pending approval" />
          )}
          <span className="text-xs text-gray-400">{relativeTime(convo.updated_at)}</span>
          {convo.unread && !convo.hasPending && (
            <span className="h-2.5 w-2.5 rounded-full bg-[#25D366] shrink-0" title="Unread" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {convo.hasPending && (
          <span className="text-[10px] bg-orange-400 text-white px-1 rounded shrink-0">draft</span>
        )}
        {!convo.hasPending && convo.lastMessage?.role === "assistant" && (
          <span className="text-[10px] bg-[#25D366] text-white px-1 rounded shrink-0">Sofia</span>
        )}
        <p className={`text-xs truncate ${convo.unread ? "text-gray-800 font-medium" : "text-gray-500"}`}>{preview}</p>
      </div>
    </button>
  );
};

// ─── Message status ticks ─────────────────────────────────────────────────────

const Ticks = ({ status }: { status?: "sent" | "delivered" | "read" }) => {
  if (!status) return null;
  if (status === "sent") return (
    <svg viewBox="0 0 16 11" className="inline h-3 w-3 ml-1 align-middle" fill="none">
      <path d="M1 5.5L5 9.5L15 1" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const color = status === "read" ? "#53bdeb" : "rgba(255,255,255,0.7)";
  return (
    <svg viewBox="0 0 20 11" className="inline h-3 w-4 ml-1 align-middle" fill="none">
      <path d="M1 5.5L5 9.5L13 1" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 5.5L11 9.5L19 1" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

// ─── Rich text parser ──────────────────────────────────────────────────────────

const URL_RE = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;

function applyMarkdown(text: string, keyBase: number): React.ReactNode[] {
  const BOLD_RE = /\*([^*\n]+)\*/g;
  const ITALIC_RE = /_([^_\n]+)_/g;
  const STRIKE_RE = /~([^~\n]+)~/g;

  let result: React.ReactNode[] = [text];

  const applyPattern = (
    nodes: React.ReactNode[],
    re: RegExp,
    wrap: (s: string, k: number) => React.ReactNode
  ): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    nodes.forEach((node, ni) => {
      if (typeof node !== "string") { out.push(node); return; }
      const parts = node.split(re);
      parts.forEach((p, pi) => {
        if (pi % 2 === 1) out.push(wrap(p, keyBase * 1000 + ni * 100 + pi));
        else if (p) out.push(p);
      });
    });
    return out;
  };

  result = applyPattern(result, BOLD_RE, (s, k) => <strong key={k}>{s}</strong>);
  result = applyPattern(result, ITALIC_RE, (s, k) => <em key={k}>{s}</em>);
  result = applyPattern(result, STRIKE_RE, (s, k) => <s key={k}>{s}</s>);

  // Newlines → <br/>
  const withBreaks: React.ReactNode[] = [];
  result.forEach((node, ni) => {
    if (typeof node !== "string") { withBreaks.push(node); return; }
    node.split("\n").forEach((line, li) => {
      if (li > 0) withBreaks.push(<br key={`br-${keyBase}-${ni}-${li}`} />);
      if (line) withBreaks.push(line);
    });
  });
  return withBreaks;
}

function parseWhatsAppText(text: string): React.ReactNode[] {
  URL_RE.lastIndex = 0;
  const parts = text.split(URL_RE);
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    URL_RE.lastIndex = 0;
    if (URL_RE.test(part)) {
      URL_RE.lastIndex = 0;
      nodes.push(
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
           className="underline opacity-90 hover:opacity-100 break-all">
          {part}
        </a>
      );
    } else {
      nodes.push(...applyMarkdown(part, i));
    }
  });
  URL_RE.lastIndex = 0;
  return nodes;
}

// ─── Audio bubble ──────────────────────────────────────────────────────────────

const WAVEFORM_HEIGHTS = [3,5,8,12,7,10,14,9,6,11,15,8,5,12,9,7,13,10,6,8,11,14,7,9,5,12,8,4];

const AudioBubble = ({ msg, isUser }: { msg: WAMessage; isUser: boolean }) => {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [dur, setDur] = useState(msg.duration ?? 0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const src = msg.mediaId ? apiClient.getWAMediaUrl(msg.mediaId) : "";
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const progress = dur > 0 ? currentTime / dur : 0;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { void el.play().catch(() => null); setPlaying(true); }
  };

  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"} mb-2`}>
      <div
        className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl ${isUser ? "bg-white shadow-sm rounded-tl-sm border border-gray-100" : "rounded-tr-sm"}`}
        style={{ minWidth: 200, maxWidth: 280, ...(isUser ? {} : { backgroundColor: "#25D366" }) }}
      >
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => setDur(audioRef.current?.duration ?? 0)}
          onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        />
        <button
          onClick={toggle}
          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-[#25D366]" : "bg-white/20"}`}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-white fill-current">
              <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-white fill-current">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        <div className="flex items-center gap-[2px] flex-1 h-8">
          {WAVEFORM_HEIGHTS.map((h, i) => {
            const filled = i / WAVEFORM_HEIGHTS.length < progress;
            return (
              <div
                key={i}
                className="rounded-full transition-colors"
                style={{
                  width: 2,
                  height: h,
                  backgroundColor: isUser
                    ? (filled ? "#25D366" : "#d1d5db")
                    : (filled ? "white" : "rgba(255,255,255,0.35)"),
                }}
              />
            );
          })}
        </div>

        <div className="flex flex-col items-end shrink-0 gap-0.5">
          <span className={`text-[11px] font-medium tabular-nums ${isUser ? "text-gray-500" : "text-white/80"}`}>
            {playing || currentTime > 0 ? fmt(currentTime) : fmt(dur)}
          </span>
          {!isUser && (
            <span className="flex"><Ticks status={msg.status} /></span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Image bubble ──────────────────────────────────────────────────────────────

const ImageBubble = ({ msg, isUser }: { msg: WAMessage; isUser: boolean }) => {
  const [open, setOpen] = useState(false);
  const src = msg.mediaId ? apiClient.getWAMediaUrl(msg.mediaId) : "";
  return (
    <>
      <div className={`flex ${isUser ? "justify-start" : "justify-end"} mb-2`}>
        <div className="max-w-[240px]">
          <button
            onClick={() => setOpen(true)}
            className="block rounded-2xl overflow-hidden shadow-sm hover:opacity-95 transition-opacity"
            style={isUser ? { border: "1px solid #e5e7eb" } : {}}
          >
            <img
              src={src}
              alt={msg.caption || "Image"}
              className="w-full object-cover max-h-[200px]"
              loading="lazy"
            />
          </button>
          {msg.caption && (
            <p className={`text-xs mt-1 px-1 ${isUser ? "text-gray-600" : "text-white/80"}`}>{msg.caption}</p>
          )}
          <p className={`text-[10px] text-gray-400 mt-0.5 flex items-center gap-0.5 ${isUser ? "justify-start ml-1" : "justify-end mr-1"}`}>
            <span>{formatDate(msg.ts)} {formatTime(msg.ts)}</span>
            {!isUser && <Ticks status={msg.status} />}
          </p>
        </div>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <img src={src} alt={msg.caption || "Image"} className="max-w-full max-h-full object-contain rounded-lg" />
          <button
            className="absolute top-4 right-4 text-white text-2xl leading-none opacity-70 hover:opacity-100"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >✕</button>
        </div>
      )}
    </>
  );
};

// ─── Text bubble ───────────────────────────────────────────────────────────────

type BubbleProps = { msg: WAMessage };

const Bubble = ({ msg }: BubbleProps) => {
  const isUser = msg.role === "user";
  if (msg.mediaType === "audio") return <AudioBubble msg={msg} isUser={isUser} />;
  if (msg.mediaType === "image") return <ImageBubble msg={msg} isUser={isUser} />;
  const label = msg.source === "approved_ai" ? "Sofia ✓" : msg.source === "manual" ? "You" : "Sofia";
  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"} mb-2`}>
      <div className="max-w-[75%]">
        {!isUser && (
          <span className="text-[10px] text-[#25D366] font-semibold ml-1 block text-right">{label}</span>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-white shadow-sm text-gray-800 rounded-tl-sm"
              : "text-white rounded-tr-sm"
          }`}
          style={isUser ? {} : { backgroundColor: "#25D366" }}
        >
          {parseWhatsAppText(msg.content)}
        </div>
        <p className={`text-[10px] text-gray-400 mt-0.5 flex items-center gap-0.5 ${isUser ? "justify-start ml-1" : "justify-end mr-1"}`}>
          <span>{formatDate(msg.ts)} {formatTime(msg.ts)}</span>
          {!isUser && <Ticks status={msg.status} />}
        </p>
      </div>
    </div>
  );
};

// ─── Pending reply card ────────────────────────────────────────────────────────

type PendingCardProps = {
  pending: PendingReply;
  onApprove: (text: string) => Promise<void>;
  onDiscard: () => Promise<void>;
};

const PendingCard = ({ pending, onApprove, onDiscard }: PendingCardProps) => {
  const [selected, setSelected] = useState(pending.suggestions[0] ?? "");
  const [edited, setEdited] = useState(pending.suggestions[0] ?? "");
  const [approving, setApproving] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const handleSelect = (s: string) => { setSelected(s); setEdited(s); };

  const handleApprove = async () => {
    if (!edited.trim() || approving) return;
    setApproving(true);
    try { await onApprove(edited.trim()); } finally { setApproving(false); }
  };

  const handleDiscard = async () => {
    setDiscarding(true);
    try { await onDiscard(); } finally { setDiscarding(false); }
  };

  return (
    <div className="border-t border-orange-200 bg-orange-50 px-4 py-3 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-orange-700">Sofia's draft</span>
        <span className="text-[10px] bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded-full">pending approval</span>
        <span className="text-[10px] text-gray-400 ml-auto truncate max-w-[120px]" title={pending.inReplyTo}>
          re: {pending.inReplyTo.slice(0, 40)}{pending.inReplyTo.length > 40 ? "…" : ""}
        </span>
      </div>
      {pending.suggestions.length > 1 && (
        <div className="flex flex-col gap-1 mb-2">
          {pending.suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSelect(s)}
              className={`text-left text-xs px-2 py-1.5 rounded-lg border transition-colors truncate ${
                selected === s
                  ? "border-orange-400 bg-orange-100 text-orange-800 font-medium"
                  : "border-gray-200 bg-white text-gray-600 hover:border-orange-300"
              }`}
              title={s}
            >
              <span className="font-mono text-[10px] mr-1 text-gray-400">#{i + 1}</span>
              {s.slice(0, 80)}{s.length > 80 ? "…" : ""}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={edited}
        onChange={(e) => setEdited(e.target.value)}
        rows={3}
        className="w-full resize-none border border-orange-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white mb-2"
        placeholder="Edit Sofia's reply before sending…"
      />
      <div className="flex gap-2">
        <button
          onClick={handleDiscard}
          disabled={discarding || approving}
          className="flex-1 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          {discarding ? "Discarding…" : "Discard"}
        </button>
        <button
          onClick={handleApprove}
          disabled={!edited.trim() || approving || discarding}
          className="flex-[2] py-1.5 rounded-lg text-sm text-white font-semibold disabled:opacity-40 transition-colors"
          style={{ backgroundColor: "#25D366" }}
        >
          {approving ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
};

const ConvoSkeleton = () => (
  <div className="px-4 py-3 border-b border-gray-100 animate-pulse">
    <div className="h-3 w-32 bg-gray-200 rounded mb-2" />
    <div className="h-2.5 w-48 bg-gray-100 rounded" />
  </div>
);

const BubbleSkeleton =({ right }: { right?: boolean }) => (
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

const is404 = (e: unknown) => axios.isAxiosError(e) && e.response?.status === 404;

const sendErrorMessage = (e: unknown): string => {
  if (axios.isAxiosError(e)) {
    if (!e.response) return "Can't reach the server. Check your connection and try again.";
    const msg = e.response.data?.message;
    if (typeof msg === "string" && msg) return msg;
    if (e.response.status === 401) return "Your session expired — please sign in again.";
    return `The server returned an error (${e.response.status}). Try again in a moment.`;
  }
  return "Something went wrong. Please try again.";
};

const WAInbox = () => {
  const [conversations, setConversations] = useState<WAConversation[]>([]);
  const [totalConvos, setTotalConvos] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMoreConvos, setLoadingMoreConvos] = useState(false);
  const [listError, setListError] = useState(false);

  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [threadStart, setThreadStart] = useState(0); // index of messages[0] in the full thread
  const [threadName, setThreadName] = useState<string | undefined>();
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [threadError, setThreadError] = useState(false);
  const [threadReloadKey, setThreadReloadKey] = useState(0);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Map<string, WAContact>>(new Map());
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactName, setContactName] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [mobileShowList, setMobileShowList] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);

  // Draft/approve mode state
  const [pendingReply, setPendingReply] = useState<PendingReply | undefined>(undefined);
  const [autoByPhone, setAutoByPhone] = useState<Map<string, boolean>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const listSentinelRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  // Refs mirror state that async callbacks / timers need to read without going stale
  const activePhoneRef = useRef<string | null>(null);
  activePhoneRef.current = activePhone;
  const conversationsRef = useRef<WAConversation[]>([]);
  conversationsRef.current = conversations;
  const threadRef = useRef({ start: 0, total: 0 });
  const loadingThreadRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const loadingMoreConvosRef = useRef(false);
  const contactsLoadedRef = useRef(false);
  const restoreScrollRef = useRef<number | null>(null);
  const threadAbortRef = useRef<AbortController | null>(null);

  const hasMoreConvos = conversations.length < totalConvos;

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

  // After older messages are prepended, keep the viewport on the message the user was reading
  useLayoutEffect(() => {
    const el = messagesContainerRef.current;
    if (el && restoreScrollRef.current !== null) {
      el.scrollTop += el.scrollHeight - restoreScrollRef.current;
      restoreScrollRef.current = null;
    }
  }, [messages]);

  // ── Conversation list (lazy: first page, then more on scroll) ──────────────────

  // Refresh the first page. Already-loaded later pages are kept.
  const refreshFirstPage = useCallback(async (): Promise<boolean> => {
    try {
      const page = await apiClient.getWAConversations({ limit: PAGE_SIZE, skip: 0 });
      setConversations((prev) => {
        const seen = new Set(page.conversations.map((c) => c.phone));
        return [...page.conversations, ...prev.filter((c) => !seen.has(c.phone))];
      });
      setTotalConvos(page.total);
      setListError(false);
      return true;
    } catch (e: unknown) {
      if (!isCancelled(e)) {
        console.warn("[inbox] list error:", e);
        setListError(true);
      }
      return false;
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadMoreConvos = useCallback(async () => {
    if (loadingMoreConvosRef.current) return;
    loadingMoreConvosRef.current = true;
    setLoadingMoreConvos(true);
    try {
      const page = await apiClient.getWAConversations({
        limit: PAGE_SIZE,
        skip: conversationsRef.current.length,
      });
      setConversations((prev) => {
        const seen = new Set(prev.map((c) => c.phone));
        return [...prev, ...page.conversations.filter((c) => !seen.has(c.phone))];
      });
      setTotalConvos(page.total);
    } catch {
      /* the sentinel fires again on the next scroll */
    } finally {
      loadingMoreConvosRef.current = false;
      setLoadingMoreConvos(false);
    }
  }, []);

  // Load the next page when the sentinel at the bottom of the list scrolls into view
  useEffect(() => {
    const sentinel = listSentinelRef.current;
    if (!sentinel || !hasMoreConvos || listLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreConvos();
      },
      { root: listContainerRef.current, rootMargin: "120px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreConvos, listLoading, conversations.length, loadMoreConvos]);

  const loadContacts = useCallback(async (): Promise<boolean> => {
    try {
      const data = await apiClient.getWAContacts();
      setContacts(new Map(data.map((c) => [c.phone, c])));
      contactsLoadedRef.current = true;
      return true;
    } catch {
      return false; // retried on the next poll tick
    }
  }, []);

  // ── Thread (lazy: latest page, older history on scroll up) ─────────────────────

  useEffect(() => {
    if (!activePhone) return;
    const ctrl = new AbortController();
    threadAbortRef.current = ctrl;
    loadingThreadRef.current = true;
    setLoadingThread(true);
    setThreadError(false);

    apiClient
      .getWAThread(activePhone, { limit: THREAD_PAGE_SIZE }, ctrl.signal)
      .then((t) => {
        threadRef.current = { start: t.start, total: t.total };
        setMessages(t.messages);
        setThreadStart(t.start);
        setThreadName(t.name);
        setPendingReply(t.pendingReply);
        setAutoByPhone((prev) => new Map(prev).set(activePhone, t.auto ?? false));
      })
      .catch((e: unknown) => {
        if (isCancelled(e)) return;
        if (is404(e)) {
          // brand-new chat: nothing stored yet
          threadRef.current = { start: 0, total: 0 };
          setMessages([]);
          setThreadStart(0);
          setPendingReply(undefined);
        } else {
          console.warn("[inbox] thread error:", e);
          setThreadError(true);
        }
      })
      .finally(() => {
        if (ctrl.signal.aborted) return;
        loadingThreadRef.current = false;
        setLoadingThread(false);
        setTimeout(forceScrollToBottom, 50);
        setTimeout(() => replyRef.current?.focus(), 80);
      });

    return () => ctrl.abort();
  }, [activePhone, threadReloadKey, forceScrollToBottom]);

  const loadOlder = useCallback(async () => {
    const phone = activePhoneRef.current;
    const { start } = threadRef.current;
    if (!phone || start === 0 || loadingOlderRef.current || loadingThreadRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const t = await apiClient.getWAThread(phone, { before: start, limit: THREAD_PAGE_SIZE });
      if (activePhoneRef.current !== phone) return;
      restoreScrollRef.current = messagesContainerRef.current?.scrollHeight ?? null;
      threadRef.current = { start: t.start, total: threadRef.current.total };
      setThreadStart(t.start);
      setMessages((prev) => [...t.messages, ...prev]);
    } catch (e: unknown) {
      if (!isCancelled(e)) console.warn("[inbox] older messages error:", e);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, []);

  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop < 60) void loadOlder();
  };

  // Fetch only messages newer than what we already hold
  const pollThread = useCallback(async (): Promise<boolean> => {
    const phone = activePhoneRef.current;
    if (!phone || loadingThreadRef.current) return true;
    try {
      const t = await apiClient.getWAThread(phone, { after: threadRef.current.total });
      if (activePhoneRef.current !== phone) return true;
      if (t.total < threadRef.current.total) {
        setThreadReloadKey((k) => k + 1); // history shrank (e.g. expired) — reload from scratch
        return true;
      }
      if (t.messages.length > 0) {
        threadRef.current = { start: threadRef.current.start, total: t.total };
        setMessages((prev) => [...prev, ...t.messages]);
        setTimeout(maybeScrollToBottom, 50);
      }
      if (t.name) setThreadName(t.name);
      // Always sync pendingReply and auto on each poll
      setPendingReply(t.pendingReply);
      setAutoByPhone((prev) => new Map(prev).set(phone, t.auto ?? false));
      return true;
    } catch (e: unknown) {
      return is404(e); // no conversation stored yet is not an outage
    }
  }, [maybeScrollToBottom]);

  // ── Initial load + polling ─────────────────────────────────────────────────────

  useEffect(() => {
    void refreshFirstPage();
    void loadContacts();
  }, [refreshFirstPage, loadContacts]);

  // Self-scheduling poll: never overlaps itself, pauses while the tab is hidden and
  // backs off exponentially while the server is failing (instead of hammering it).
  useEffect(() => {
    let stopped = false;
    let running = false;
    let delay = POLL_MS;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (running || stopped) return;
      running = true;
      if (!document.hidden) {
        const results = await Promise.all([
          refreshFirstPage(),
          contactsLoadedRef.current ? Promise.resolve(true) : loadContacts(),
          pollThread(),
        ]);
        delay = results.every(Boolean) ? POLL_MS : Math.min(delay * 2, MAX_POLL_MS);
      }
      running = false;
      if (!stopped) timer = setTimeout(() => void tick(), delay);
    };

    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        void tick();
      }
    };

    timer = setTimeout(() => void tick(), POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshFirstPage, loadContacts, pollThread]);

  const resetThread = () => {
    setSendError(null);
    threadRef.current = { start: 0, total: 0 };
    setMessages([]);
    setThreadStart(0);
    setThreadName(undefined);
    setThreadError(false);
    setPendingReply(undefined);
  };

  const handleSelectConvo = (phone: string) => {
    if (loadingThread && phone !== activePhone) return; // debounce rapid clicks
    resetThread();
    setActivePhone(phone);
    setReply("");
    setShowContactForm(false);
    setContactName("");
    setMobileShowList(false);
    // Optimistically clear unread + fire-and-forget backend mark-read
    setConversations((prev) => prev.map((c) => c.phone === phone ? { ...c, unread: false } : c));
    void apiClient.markWARead(phone);
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
    loadingThreadRef.current = false;
    setMobileShowList(true);
    setActivePhone(null);
    setLoadingThread(false);
  };

  const handleSend = async () => {
    if (!activePhone || !reply.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await apiClient.sendWAReply(activePhone, reply.trim());
      threadRef.current = { start: threadRef.current.start, total: threadRef.current.total + 1 };
      setMessages((prev) => [...prev, { role: "assistant", content: reply.trim(), ts: new Date().toISOString(), source: "manual" }]);
      setPendingReply(undefined);
      setReply("");
      void refreshFirstPage();
      setTimeout(forceScrollToBottom, 50);
    } catch (e: unknown) {
      setSendError(sendErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const handleApprove = async (text: string) => {
    if (!activePhone) return;
    setSendError(null);
    try {
      await apiClient.approveWAReply(activePhone, text);
    } catch (e: unknown) {
      setSendError(sendErrorMessage(e));
      return;
    }
    threadRef.current = { start: threadRef.current.start, total: threadRef.current.total + 1 };
    setMessages((prev) => [...prev, { role: "assistant", content: text, ts: new Date().toISOString(), source: "approved_ai" }]);
    setPendingReply(undefined);
    void refreshFirstPage();
    setTimeout(forceScrollToBottom, 50);
  };

  const handleDiscard = async () => {
    if (!activePhone) return;
    await apiClient.dismissWAPending(activePhone);
    setPendingReply(undefined);
    void refreshFirstPage();
  };

  const handleToggleAuto = async () => {
    if (!activePhone) return;
    const current = autoByPhone.get(activePhone) ?? false;
    const next = !current;
    setAutoByPhone((prev) => new Map(prev).set(activePhone, next));
    try {
      await apiClient.toggleWAAuto(activePhone, next);
      void refreshFirstPage();
    } catch {
      setAutoByPhone((prev) => new Map(prev).set(activePhone, current)); // revert on error
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
      <div ref={listContainerRef} className="flex-1 overflow-y-auto">
        {listLoading ? (
          <>
            <ConvoSkeleton />
            <ConvoSkeleton />
            <ConvoSkeleton />
          </>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 p-6">
            <FaWhatsapp className="h-10 w-10 opacity-30" />
            <p className="text-sm text-center">
              {listError
                ? "Can't reach the server — retrying automatically…"
                : "No conversations yet. When guests message the B&B, they'll appear here."}
            </p>
          </div>
        ) : (
          <>
            {conversations.map((c) => (
              <ConvoItem
                key={c.phone}
                convo={c}
                active={activePhone === c.phone}
                disabled={loadingThread && activePhone !== c.phone}
                contacts={contacts}
                onClick={() => handleSelectConvo(c.phone)}
              />
            ))}
            {hasMoreConvos && (
              <div ref={listSentinelRef} className="py-3 text-center text-xs text-gray-400">
                {loadingMoreConvos ? "Loading…" : ""}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── Thread panel ─────────────────────────────────────────────────────────────
  const contactForActive = activePhone ? contacts.get(activePhone) : undefined;
  const activeName = contactForActive?.name ?? threadName;
  const isAuto = activePhone ? (autoByPhone.get(activePhone) ?? false) : false;

  const threadPanel = (
    <div className={`flex-1 flex flex-col bg-[#cfe3df] overflow-hidden md:flex ${!mobileShowList ? "flex w-full" : "hidden md:flex"}`}>
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
                {(activeName ?? formatPhone(activePhone)).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {activeName ?? formatPhone(activePhone)}
                </p>
                <p className="text-xs text-white/80">
                  {loadingThread ? "Loading…" : activeName ? formatPhone(activePhone) : "Active · Sofia is monitoring"}
                </p>
              </div>
              <span className="h-2 w-2 rounded-full bg-white/60 animate-pulse shrink-0" title="Live polling" />
              {/* Auto/draft toggle */}
              <button
                onClick={() => void handleToggleAuto()}
                title={isAuto ? "Auto ON — Sofia sends immediately. Click for draft mode." : "Draft mode — Sofia drafts, you approve. Click for auto."}
                className={`shrink-0 text-xs rounded-full px-2.5 py-1 font-semibold border transition-colors ${
                  isAuto
                    ? "bg-white text-[#25D366] border-white"
                    : "bg-white/10 text-white/80 border-white/30 hover:bg-white/20"
                }`}
              >
                {isAuto ? "Auto" : "Draft"}
              </button>
              <button
                onClick={() => { setShowContactForm((v) => !v); setContactName(activeName ?? ""); }}
                className="shrink-0 text-xs text-white/80 hover:text-white border border-white/30 rounded px-2 py-1 transition-colors"
              >
                {activeName ? "Edit" : "+ Contact"}
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
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="flex-1 overflow-y-auto px-4 py-4"
            style={CHAT_WALLPAPER}
          >
            {loadingThread ? (
              <>
                <BubbleSkeleton />
                <BubbleSkeleton right />
                <BubbleSkeleton />
                <BubbleSkeleton right />
              </>
            ) : threadError ? (
              <div className="flex flex-col justify-center items-center h-full gap-2 text-sm text-gray-600">
                <p>Couldn't load this conversation.</p>
                <button
                  onClick={() => setThreadReloadKey((k) => k + 1)}
                  className="px-3 py-1 rounded-full bg-white shadow-sm text-[#25D366] font-medium"
                >
                  Retry
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex justify-center items-center h-full text-gray-600 text-sm">No messages</div>
            ) : (
              <>
                {threadStart > 0 && (
                  <div className="flex justify-center mb-3">
                    <button
                      onClick={() => void loadOlder()}
                      disabled={loadingOlder}
                      className="text-xs px-3 py-1 rounded-full bg-white/90 shadow-sm text-gray-600 disabled:opacity-60"
                    >
                      {loadingOlder ? "Loading…" : `Load earlier messages (${threadStart})`}
                    </button>
                  </div>
                )}
                {messages.map((m, i) => <Bubble key={threadStart + i} msg={m} />)}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pending draft card */}
          {pendingReply && (
            <PendingCard
              pending={pendingReply}
              onApprove={handleApprove}
              onDiscard={handleDiscard}
            />
          )}

          {sendError && (
            <div role="alert" className="px-4 py-2 bg-red-50 border-t border-red-200 text-sm text-red-700 flex items-start gap-2 shrink-0">
              <span className="flex-1">Message not sent: {sendError}</span>
              <button onClick={() => setSendError(null)} className="text-red-400 hover:text-red-600" aria-label="Dismiss">✕</button>
            </div>
          )}

          {/* Reply input */}
          <div className="px-4 py-3 bg-white border-t border-gray-200 flex items-end gap-2 shrink-0">
            <textarea
              ref={replyRef}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a manual reply… (Enter to send, Shift+Enter for newline)"
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

  const unreadCount = conversations.filter((c) => c.unread).length;

  // Update browser tab title with unread count
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) Sofia Inbox` : "Sofia Inbox";
    return () => { document.title = "Palazzo Pinto"; };
  }, [unreadCount]);

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
            {totalConvos || conversations.length} conversation{(totalConvos || conversations.length) !== 1 ? "s" : ""}
          </span>
          {unreadCount > 0 && (
            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
              {unreadCount} unread
            </span>
          )}
          {(() => {
            const pendingCount = conversations.filter((c) => c.hasPending).length;
            return pendingCount > 0 ? (
              <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full font-medium">
                {pendingCount} draft{pendingCount !== 1 ? "s" : ""} pending
              </span>
            ) : null;
          })()}
          <span className="ml-1 flex items-center gap-1 text-xs text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full bg-[#25D366] animate-pulse inline-block" />
            live
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">WhatsApp messages handled by Sofia AI · default: draft mode</p>
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
