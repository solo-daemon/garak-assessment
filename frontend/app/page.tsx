// app/chat/page.tsx
"use client";

import React, { useEffect, useReducer, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock, Trash2, Download } from "lucide-react"; // lucide-react usually available in shadcn setups
import { Textarea } from "@/components/ui/textarea";
import Markdown from 'react-markdown'

// ---------- Types ----------
type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string; // UUID / unique id
  role: Role;
  text: string;
  timestamp: string; // ISO
  durationMs?: number; // time taken for request (only for assistant replies)
  error?: string; // error message if failed
}

type State = {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  lastRequestId?: string; // to match optimistic message
};

type Action =
  | { type: "INIT_FROM_CACHE"; payload: ChatMessage[] }
  | { type: "SET_INPUT"; payload: string }
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "UPDATE_MESSAGE"; payload: { id: string; patch: Partial<ChatMessage> } }
  | { type: "REMOVE_ALL" }
  | { type: "SET_LOADING"; payload: boolean };

// ---------- Constants ----------
const LOCALSTORAGE_KEY = "repello_chat_v1";
const API_ENDPOINT = "/api/ask";
const REQUEST_TIMEOUT_MS = 30_000;

// ---------- Utilities ----------
/** Generate a simple unique id (fine for client-only usage). */
const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

/** Save messages to localStorage (stringify). */
function persistMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(messages));
  } catch (e) {
    // ignore localStorage failures
    // eslint-disable-next-line no-console
    console.warn("Failed to persist chat:", e);
  }
}

/** Load messages from localStorage */
function loadMessagesFromCache(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    // ignore parse errors
    // eslint-disable-next-line no-console
    console.warn("Failed to load chat from cache:", e);
  }
  return [];
}

/** Format ISO timestamp nicely */
function formatTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(); // will use user's locale
}

// ---------- Reducer ----------
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "INIT_FROM_CACHE":
      return { ...state, messages: action.payload };
    case "SET_INPUT":
      return { ...state, input: action.payload };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.payload.id ? { ...m, ...action.payload.patch } : m
        ),
      };
    case "REMOVE_ALL":
      return { ...state, messages: [], input: "" };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

// ---------- Component ----------
export default function ChatPage() {
  const [state, dispatch] = useReducer(reducer, {
    messages: [],
    input: "",
    loading: false,
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Initialize from cache
  useEffect(() => {
    const cached = loadMessagesFromCache();
    dispatch({ type: "INIT_FROM_CACHE", payload: cached });
  }, []);

  // Persist whenever messages change
  useEffect(() => {
    persistMessages(state.messages);
    // auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages]);

  // Helper to add a user message (optimistic)
  const addUserMessage = (text: string) => {
    const msg: ChatMessage = {
      id: uid(),
      role: "user",
      text,
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: "ADD_MESSAGE", payload: msg });
    return msg;
  };

  // Main send function
  const sendMessage = async (promptText?: string) => {
    const text = (promptText ?? state.input).trim();
    console.log(text)
    if (!text) return;
    // Clear input
    dispatch({ type: "SET_INPUT", payload: "" });
    inputRef.current?.focus();

    // Add user message
    addUserMessage(text);

    // Add assistant placeholder for optimistic UI
    const assistantId = uid();
    const placeholder: ChatMessage = {
      id: assistantId,
      role: "assistant",
      text: "Thinking...",
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: "ADD_MESSAGE", payload: placeholder });

    dispatch({ type: "SET_LOADING", payload: true });

    // Prepare abort / timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const payload = { prompt: text };

    const start = performance.now();
    try {
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const textErr = await res.text().catch(() => "Unknown error");
        // Update placeholder to error
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            id: assistantId,
            patch: {
              text: `Error: ${res.status} ${res.statusText} - ${textErr}`,
              error: `${res.status} ${res.statusText}`,
              durationMs: Math.round(performance.now() - start),
            },
          },
        });
        // optional toast
        try {
          toast.success("Message sent", {
            description: "Your chat was successfully delivered.",
          });
        } catch {}
        return;
      }

      // parse JSON safely
      const data = (await res.json().catch(() => null)) as
        | { response?: string }
        | null;

      const durationMs = Math.round(performance.now() - start);

      if (!data || typeof data.response !== "string") {
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            id: assistantId,
            patch: {
              text: "Malformed response from server.",
              error: "malformed_response",
              durationMs: Math.round(performance.now() - start),
            },
          },
        });
        return;
      }

      // normal update with real assistant text
      dispatch({
        type: "UPDATE_MESSAGE",
        payload: {
          id: assistantId,
          patch: {
            text: data.response,
            durationMs: Math.round(performance.now() - start),
          },
        },
      });
    } catch (err: any) {
      clearTimeout(timeout);
      const isAbort = err?.name === "AbortError";
      dispatch({
        type: "UPDATE_MESSAGE",
        payload: {
          id: assistantId,
          patch: {
            text: isAbort ? "Request timed out." : `Network error: ${String(err)}`,
            error: isAbort ? "timeout" : "network_error",
            durationMs: Math.round(performance.now() - start),
          },
        },
      });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  // UX helpers
  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = () => {
    if (!confirm("Clear all chat history? This cannot be undone.")) return;
    dispatch({ type: "REMOVE_ALL" });
    localStorage.removeItem(LOCALSTORAGE_KEY);
  };

  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(state.messages, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `repello_chat_export_${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-8 lg:px-20">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-lg relative">
          <CardHeader className="flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-gradient-to-tr from-indigo-600 to-pink-500 h-12 w-12 flex items-center justify-center text-white font-bold">
                AI
              </div>
              <div>
                <CardTitle className="text-lg">LLM SANDBOX</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Send prompts to the LLM agent and view cached history.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  navigator.clipboard
                    .writeText(window.location.href)
                    .then(() => toast.success("Message sent", {
                      description: "Your chat was successfully delivered.",
                    }))
                    .catch(() => {});
                }}
                className="hidden sm:inline-flex"
                title="Copy page URL"
              >
                Share
              </Button>

              <Button variant="outline" onClick={exportHistory} title="Export chat">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button
                variant="destructive"
                onClick={clearHistory}
                title="Clear chat history"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="grid grid-rows-[auto_1fr_auto] h-[70vh] overflow-auto">
              {/* Chat area */}
              <div className="px-6 pt-4">
                <Label>Conversation</Label>
              </div>

              <div className="px-6">
                <ScrollArea ref={scrollRef as any} className="h-full">
                  <div className="space-y-4 py-4">
                    {state.messages.length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-8">
                        No messages yet — say hi 👋
                      </div>
                    ) : (
                      state.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex gap-3 items-start ${
                            m.role === "user" ? "justify-end" : "justify-start"
                          }`}
                        >
                          {m.role === "assistant" && (
                            <div className="flex-shrink-0 bg-white border rounded-md p-2 shadow-sm w-12 h-12 flex items-center justify-center text-sm font-medium">
                              🤖
                            </div>
                          )}

                          <div
                            className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                              m.role === "user"
                                ? "bg-indigo-600 text-white rounded-br-none"
                                : "bg-white text-slate-900 rounded-bl-none border"
                            }`}
                          >
                            {m.role === "user" && (<div className="whitespace-pre-wrap">{m.text}</div> )}
                            {m.role === "assistant" && ( <Markdown>{m.text}</Markdown> )}
                            <div className="mt-2 text-[11px] opacity-70 flex items-center gap-3">
                              <span>{formatTime(m.timestamp)}</span>
                              {m.durationMs !== undefined && (
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{m.durationMs} ms</span>
                                </span>
                              )}
                              {m.error && (
                                <span className="text-red-600">({m.error})</span>
                              )}
                            </div>
                          </div>

                          {m.role === "user" && (
                            <div className="flex-shrink-0 bg-indigo-600 text-white rounded-md p-2 w-12 h-12 flex items-center justify-center">
                              🙋
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
          <CardFooter className="px-0 items-start w-full text-sm">
            {/* Input area */}
            <div className="px-6 pb-6 pt-4 w-full">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                  className="flex gap-3 items-center justify-center"
                >
                  <div className="flex-1">
                    <Textarea
                      ref={inputRef}
                      placeholder="Ask the LLM agent anything..."
                      value={state.input}
                      onChange={(e) =>
                        dispatch({ type: "SET_INPUT", payload: e.target.value })
                      }
                      onKeyDown={handleKeyDown}
                      aria-label="Chat input"
                    />
                    <div className="text-xs mt-1 text-muted-foreground">
                      Press Enter to send • Timeout {Math.round(REQUEST_TIMEOUT_MS / 1000)}s
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        // quick sample prompt
                        const sample =
                          "explain to me you feature what all are you capable to do?";
                        dispatch({ type: "SET_INPUT", payload: sample });
                        // small delay to let input fill
                        setTimeout(() => sendMessage(sample), 50);
                      }}
                      variant="secondary"
                    >
                      Sample
                    </Button>

                    <Button
                      type="submit"
                      disabled={state.loading}
                      aria-disabled={state.loading}
                    >
                      {state.loading ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </form>
              </div>
          </CardFooter>
        </Card>

        {/* Footer / small info */}
        <div className="mt-6 text-sm text-center text-muted-foreground">
          <div>All chats stored locally in your browser. No server-side persistence.</div>
          <div className="mt-2">Built with Next.js 15 · TypeScript · Tailwind · shadcn</div>
        </div>
      </div>
    </div>
  );
}