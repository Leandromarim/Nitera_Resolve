'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Ticket } from './types';

const SOUND_KEY = 'nr-chamados-som';
let ctx: AudioContext | null = null;

/** Libera o áudio: o navegador só deixa tocar som depois de um clique na página. */
function audio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

export type ChimeTone = 'sino' | 'alerta' | 'suave' | 'campainha';

/** Notas de cada toque: frequência (Hz), início (s), duração (s) e forma da onda. */
const TONES: Record<ChimeTone, { notes: [number, number, number][]; wave: OscillatorType; gap: number }> = {
  sino: { notes: [[880, 0, 0.45], [1174.66, 0.16, 0.45], [1567.98, 0.32, 0.5]], wave: 'sine', gap: 0.75 },
  alerta: { notes: [[988, 0, 0.18], [740, 0.2, 0.18], [988, 0.4, 0.18], [740, 0.6, 0.18]], wave: 'square', gap: 0.95 },
  suave: { notes: [[659.25, 0, 0.6], [987.77, 0.25, 0.8]], wave: 'triangle', gap: 1.2 },
  campainha: { notes: [[1318.5, 0, 0.12], [1318.5, 0.14, 0.12], [1318.5, 0.28, 0.12], [1046.5, 0.42, 0.4]], wave: 'sine', gap: 0.95 },
};

/** Toca o aviso sonoro (sem arquivo de áudio). `times` repete o toque; `volume` vai de 0 a 100. */
export function playTicketChime(times = 1, tone: ChimeTone = 'sino', volume = 80) {
  const ac = audio();
  if (!ac || volume <= 0) return;
  const { notes, wave, gap } = TONES[tone] ?? TONES.sino;
  const peak = Math.max(0.001, Math.min(1, volume / 100) * (wave === 'square' ? 0.18 : 0.45));
  for (let r = 0; r < times; r++) {
    for (const [freq, start, dur] of notes) {
      const t = ac.currentTime + r * gap + start;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }
}

export const VOICE_TEXT = 'Chegou um novo chamado';

/** Escolhe uma voz em português do Brasil, se o computador tiver (Windows e Chrome costumam ter). */
function ptVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'pt-BR') ?? voices.find((v) => v.lang?.toLowerCase().startsWith('pt'));
}

/** Fala o aviso em voz alta (síntese de voz do navegador). `delayMs` espera o toque terminar antes de falar. */
export function speakTicketAlert(text = VOICE_TEXT, volume = 80, delayMs = 0) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || volume <= 0 || !text.trim()) return;
  setTimeout(() => {
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.volume = Math.min(1, volume / 100);
    u.rate = 1;
    const v = ptVoice();
    if (v) u.voice = v;
    synth.cancel();
    synth.speak(u);
  }, delayMs);
}

// algumas vozes só ficam disponíveis depois do primeiro pedido
if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.getVoices();

/** Libera o áudio a partir de um clique (necessário nos navegadores). */
export const unlockAudio = () => !!audio();

/**
 * Avisa quando chega chamado novo na fila: som, notificação do sistema (com a aba em segundo plano)
 * e contador no título da aba. A preferência de som fica salva neste navegador.
 * `queueKey` identifica a fila visível (ex.: o setor escolhido): ao trocar de fila, a próxima carga
 * vira a nova base e não toca som pelos chamados que já estavam lá.
 */
export function useNewTicketAlert(tickets: Ticket[] | undefined, onNew?: (t: Ticket[]) => void, queueKey = '') {
  const [soundOn, setSoundOn] = useState(true);
  const seen = useRef<Set<string> | null>(null);
  const unseen = useRef(0);
  const baseTitle = useRef('');
  const queue = useRef(queueKey);
  const baseline = useRef<Ticket[] | undefined>(undefined);

  useEffect(() => {
    try {
      setSoundOn(localStorage.getItem(SOUND_KEY) !== '0');
    } catch {}
    baseTitle.current = document.title;
    // o primeiro clique em qualquer lugar libera o áudio
    const unlock = () => audio();
    window.addEventListener('pointerdown', unlock, { once: true });
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        unseen.current = 0;
        document.title = baseTitle.current;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      document.removeEventListener('visibilitychange', onVis);
      document.title = baseTitle.current;
    };
  }, []);

  useEffect(() => {
    if (queue.current !== queueKey) {
      // trocou de fila: ignora a lista antiga (ainda na tela) e usa a próxima carga como base
      queue.current = queueKey;
      seen.current = null;
      baseline.current = tickets;
      return;
    }
    if (!tickets || tickets === baseline.current) return;
    baseline.current = undefined;
    const ids = new Set(tickets.map((t) => t.id));
    if (!seen.current) {
      seen.current = ids; // primeira carga: não toca
      return;
    }
    const fresh = tickets.filter((t) => !seen.current!.has(t.id));
    seen.current = ids;
    if (!fresh.length) return;

    if (soundOn) {
      playTicketChime(fresh.some((t) => t.priority === 'CRITICA') ? 2 : 1);
      speakTicketAlert(fresh.length > 1 ? `Chegaram ${fresh.length} chamados novos` : VOICE_TEXT, 90, 900);
    }
    onNew?.(fresh);
    if (document.visibilityState !== 'visible') {
      unseen.current += fresh.length;
      document.title = `(${unseen.current}) Novo chamado · ${baseTitle.current}`;
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const t = fresh[0];
        const n = new Notification(fresh.length > 1 ? `${fresh.length} chamados novos` : `Novo chamado #${t.number}`, {
          body: fresh.length > 1 ? fresh.map((x) => `#${x.number} ${x.title}`).join('\n') : t.title,
          tag: 'nr-chamado-novo',
          icon: '/favicon.png',
        });
        n.onclick = () => {
          window.focus();
          window.location.href = `/chamados/${t.id}`;
          n.close();
        };
      }
    }
  }, [tickets, soundOn, onNew, queueKey]);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      try {
        localStorage.setItem(SOUND_KEY, next ? '1' : '0');
      } catch {}
      if (next) {
        playTicketChime();
        speakTicketAlert(VOICE_TEXT, 90, 900);
      }
      return next;
    });
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch(() => undefined);
  }, []);

  return { soundOn, toggleSound };
}
