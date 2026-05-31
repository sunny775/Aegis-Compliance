import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Box, TextField, IconButton, Typography, Stack, Chip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import { api } from '../api/client';
import type { QASource } from '../api/types';
import { CitationChip } from './CitationChip';
import { useToast } from '../context/ToastContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: QASource[];
  streaming?: boolean;
}

const SUGGESTIONS = [
  'What PPE is required during tyre inflation?',
  'What are the exclusion zone requirements?',
  'How must tyres be stored?',
];

function updateLast(messages: ChatMessage[], fn: (m: ChatMessage) => ChatMessage): ChatMessage[] {
  const copy = [...messages];
  for (let i = copy.length - 1; i >= 0; i--) {
    if (copy[i]!.role === 'assistant') {
      copy[i] = fn(copy[i]!);
      break;
    }
  }
  return copy;
}

/** Streaming, grounded Q&A. Citation chips jump to the Full Text passage. */
export function QAChat({ docId, onCite }: { docId: string; onCite: (source: QASource) => void }) {
  const theme = useTheme();
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || pending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }, { role: 'assistant', text: '', sources: [], streaming: true }]);
    setPending(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await api.askStream(docId, q, {
        signal: ctrl.signal,
        onSources: (s) => setMessages((m) => updateLast(m, (a) => ({ ...a, sources: s }))),
        onToken: (t) => setMessages((m) => updateLast(m, (a) => ({ ...a, text: a.text + t }))),
      });
      setMessages((m) => updateLast(m, (a) => ({ ...a, streaming: false })));
    } catch (err) {
      setMessages((m) =>
        updateLast(m, (a) => ({
          ...a,
          streaming: false,
          text: a.text || 'Sorry — something went wrong answering that.',
        })),
      );
      toast.error(err instanceof Error ? err.message : 'Q&A failed');
    } finally {
      setPending(false);
      abortRef.current = null;
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 560 }}>
      <Box ref={scrollRef} sx={{ flexGrow: 1, overflowY: 'auto', px: 0.5, py: 1 }}>
        {messages.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', textAlign: 'center', color: 'text.secondary', px: 2 }}>
            <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="h5" sx={{ mb: 0.5 }}>
              Ask this document
            </Typography>
            <Typography variant="body2" sx={{ mb: 2.5, maxWidth: 360 }}>
              Answers are grounded only in the document, with clause-level citations.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" useFlexGap>
              {SUGGESTIONS.map((s) => (
                <Chip key={s} label={s} variant="outlined" onClick={() => void send(s)} sx={{ mb: 1 }} />
              ))}
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} onCite={onCite} />
            ))}
          </Stack>
        )}
      </Box>

      <Box
        component="form"
        onSubmit={onSubmit}
        sx={{ mt: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end', borderTop: `1px solid ${theme.palette.divider}`, pt: 2 }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          placeholder="Ask a question about this document…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <IconButton
          type="submit"
          disabled={pending || !input.trim()}
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': { bgcolor: 'primary.dark' },
            '&.Mui-disabled': { bgcolor: alpha(theme.palette.text.primary, 0.08) },
          }}
        >
          <SendRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

function MessageBubble({ message, onCite }: { message: ChatMessage; onCite: (s: QASource) => void }) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  const uniqueSources = dedupeSources(message.sources ?? []);

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}
    >
      <Box sx={{ maxWidth: '86%' }}>
        <Box
          sx={{
            px: 2,
            py: 1.25,
            borderRadius: 2.5,
            borderTopRightRadius: isUser ? 4 : 20,
            borderTopLeftRadius: isUser ? 20 : 4,
            backgroundColor: isUser ? 'primary.main' : alpha(theme.palette.text.primary, 0.04),
            color: isUser ? 'primary.contrastText' : 'text.primary',
            border: isUser ? 'none' : `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="body2" sx={{ color: 'inherit', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {message.text}
            {message.streaming && <BlinkingCaret />}
          </Typography>
        </Box>
        {!isUser && uniqueSources.length > 0 && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1, ml: 0.5 }}>
            <Typography variant="caption" sx={{ width: '100%', color: 'text.disabled', mb: 0.25 }}>
              Sources
            </Typography>
            {uniqueSources.map((s) => (
              <CitationChip key={s.chunkId} clauseRef={s.clauseRef} page={s.page} onClick={() => onCite(s)} />
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function BlinkingCaret() {
  return (
    <AnimatePresence>
      <Box
        component={motion.span}
        animate={{ opacity: [1, 0.2, 1] }}
        transition={{ repeat: Infinity, duration: 0.9 }}
        sx={{ display: 'inline-block', width: 7, height: 14, ml: 0.4, bgcolor: 'currentColor', verticalAlign: 'text-bottom', borderRadius: 0.5 }}
      />
    </AnimatePresence>
  );
}

function dedupeSources(sources: QASource[]): QASource[] {
  const seen = new Set<string>();
  return sources.filter((s) => (seen.has(s.chunkId) ? false : (seen.add(s.chunkId), true)));
}
