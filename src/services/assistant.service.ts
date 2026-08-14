import fs from 'fs/promises';
import path from 'path';
import { env, isOpenAiConfigured } from '../config/env';
import { SERVICE_DEPARTMENTS, UserRole } from '../constants';
import { IJwtPayload } from '../interfaces';
import { logger } from '../utils/logger';
import { knowledgeBaseService } from './knowledgeBase.service';

export type ChatLocale = 'en' | 'ta';

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantChatResult {
  reply: string;
  provider: 'openai' | 'fallback';
  attachments: { filename: string; mimeType: string; size: number }[];
}

type OpenAiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const TEXT_MIME = new Set(['text/plain', 'text/markdown']);

function parseHistory(raw: string): ChatHistoryItem[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ChatHistoryItem =>
          Boolean(item) &&
          typeof item === 'object' &&
          (item.role === 'user' || item.role === 'assistant') &&
          typeof item.content === 'string'
      )
      .slice(-12)
      .map((item) => ({
        role: item.role,
        content: item.content.slice(0, 2000),
      }));
  } catch {
    return [];
  }
}

async function readAttachmentSummary(files: Express.Multer.File[]): Promise<{
  names: string[];
  textSnippets: string[];
  images: { mimeType: string; dataUrl: string }[];
}> {
  const names: string[] = [];
  const textSnippets: string[] = [];
  const images: { mimeType: string; dataUrl: string }[] = [];

  for (const file of files) {
    const label = file.originalname || file.filename;
    names.push(`${label} (${file.mimetype}, ${file.size} bytes)`);

    try {
      if (TEXT_MIME.has(file.mimetype)) {
        const text = await fs.readFile(file.path, 'utf8');
        textSnippets.push(`--- ${label} ---\n${text.slice(0, 4000)}`);
      } else if (IMAGE_MIME.has(file.mimetype)) {
        const buf = await fs.readFile(file.path);
        images.push({
          mimeType: file.mimetype,
          dataUrl: `data:${file.mimetype};base64,${buf.toString('base64')}`,
        });
      }
    } catch (err) {
      logger.warn('Failed to read assistant attachment', {
        file: label,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { names, textSnippets, images };
}

async function cleanupFiles(files: Express.Multer.File[]): Promise<void> {
  await Promise.all(
    files.map((file) =>
      fs.unlink(file.path).catch(() => undefined)
    )
  );
}

function systemPrompt(locale: ChatLocale, user: IJwtPayload): string {
  const language =
    locale === 'ta'
      ? 'Reply in Tamil (தமிழ்). Keep names like TVK in English when useful.'
      : 'Reply in English.';
  const audience =
    user.role === UserRole.USER
      ? 'The user is a citizen using the TVK Support app to raise and track complaints.'
      : 'The user is TVK staff (admin or support agent) using the admin app.';

  return [
    'You are the TVK Support assistant for Tamilaga Vettri Kazhagam (TVK) citizen helpdesk in Tamil Nadu.',
    audience,
    language,
    'Help with raising complaints, tracking tickets, departments, notifications, and how the app works.',
    'If the user uploaded files, acknowledge them and use any readable text. For images, describe what you can see if relevant.',
    'Do not invent ticket IDs, personal data, or claim a complaint was filed unless the user already did that in the app.',
    'Be concise, practical, and courteous.',
  ].join(' ');
}

async function openaiReply(params: {
  locale: ChatLocale;
  user: IJwtPayload;
  message: string;
  history: ChatHistoryItem[];
  attachmentNames: string[];
  textSnippets: string[];
  images: { mimeType: string; dataUrl: string }[];
}): Promise<string | null> {
  if (!isOpenAiConfigured()) return null;

  const base = env.OPENAI_BASE_URL.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;

  const extra: string[] = [];
  if (params.attachmentNames.length) {
    extra.push(`Uploaded files:\n${params.attachmentNames.join('\n')}`);
  }
  if (params.textSnippets.length) {
    extra.push(`Extracted document text:\n${params.textSnippets.join('\n\n')}`);
  }

  const userText = [params.message.trim(), ...extra].filter(Boolean).join('\n\n') || '(no text)';

  const userContent: OpenAiContentPart[] = [{ type: 'text', text: userText }];
  for (const image of params.images.slice(0, 3)) {
    userContent.push({ type: 'image_url', image_url: { url: image.dataUrl } });
  }

  const messages: Array<{ role: string; content: string | OpenAiContentPart[] }> = [
    { role: 'system', content: systemPrompt(params.locale, params.user) },
    ...params.history.map((item) => ({ role: item.role, content: item.content })),
    { role: 'user', content: userContent },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature: 0.4,
        max_tokens: 700,
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.warn('OpenAI-compatible chat failed', {
        status: response.status,
        body: body.slice(0, 500),
      });
      return null;
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | OpenAiContentPart[] } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      const text = content
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim();
      if (text) return text;
    }
    return null;
  } catch (err) {
    logger.warn('OpenAI-compatible chat error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function fallbackReply(params: {
  locale: ChatLocale;
  user: IJwtPayload;
  message: string;
  attachmentNames: string[];
  articles: Array<{ title: string; slug?: string }>;
}): string {
  const ta = params.locale === 'ta';
  const text = params.message.toLowerCase();
  const parts: string[] = [];

  if (params.attachmentNames.length) {
    parts.push(
      ta
        ? `உங்கள் இணைப்புகளைப் பெற்றேன்: ${params.attachmentNames.join(', ')}.`
        : `I received your file(s): ${params.attachmentNames.join(', ')}.`
    );
  }

  const wantsTicket =
    /ticket|complaint|raise|submit|புகார்|டிக்கெட்|பதிவு/.test(text) ||
    /how (do|can) i (file|raise|create)/.test(text);
  const wantsTrack = /track|status|update|எங்கே|நிலை|பின்தொடர்/.test(text);
  const wantsDept = /department|மின்சாரம்|தண்ணீர்|சாலை|துறை|electricity|water|ration/.test(text);
  const greeting = /^(hi|hello|hey|vanakkam|வணக்கம்)\b/.test(text.trim());

  if (greeting && !wantsTicket && !wantsTrack) {
    parts.push(
      ta
        ? 'வணக்கம். நான் TVK உதவி உதவியாளர். புகார் பதிவு, நிலை பார்ப்பது, அல்லது துறைகள் பற்றி கேட்கலாம்.'
        : 'Hello. I am the TVK Support assistant. Ask me how to raise a complaint, track status, or which department to choose.'
    );
  } else if (wantsTicket) {
    parts.push(
      params.user.role === UserRole.USER
        ? ta
          ? 'புகார் பதிவு செய்ய Home அல்லது Raise தாவலுக்குச் சென்று துறை, இடம் மற்றும் விவரத்தை நிரப்பவும். தேவைப்பட்டால் படம் அல்லது ஆவணத்தை இணைக்கவும்.'
          : 'To raise a complaint, open the Raise tab, choose a department and location, describe the issue, then submit. You can attach photos or documents on that form.'
        : ta
          ? 'குடிமக்கள் Raise திரையில் புகார் பதிவு செய்கிறார்கள். ஊழியர்கள் Tickets பக்கத்தில் பார்க்கவும், ஒதுக்கவும், நிலையை மாற்றவும் முடியும்.'
          : 'Citizens file complaints from the Raise screen. Staff can view, assign, and update them from Tickets.'
    );
  } else if (wantsTrack) {
    parts.push(
      params.user.role === UserRole.USER
        ? ta
          ? 'உங்கள் புகார்களை My Complaints (Live Updates) திரையில் பார்க்கலாம். ஒரு புகாரைத் திறந்து கருத்துகளையும் நிலையையும் காணலாம்.'
          : 'Track your complaints on My Complaints. Open a ticket to see status, comments, and attachments.'
        : ta
          ? 'Tickets பக்கத்தில் வடிகட்டிகள் மூலம் நிலை, தாமதம் மற்றும் துறை வாரியாக பார்க்கலாம்.'
          : 'Use the Tickets page filters to review status, overdue items, and departments.'
    );
  } else if (wantsDept) {
    const names = SERVICE_DEPARTMENTS.map((d) => d.name).slice(0, 8).join(', ');
    parts.push(
      ta
        ? `முக்கிய துறைகள்: ${names}. பொருந்தாவிட்டால் Other / General தேர்வு செய்யவும்.`
        : `Common departments include ${names}. If none fit, choose Other / General.`
    );
  } else if (params.message.trim()) {
    parts.push(
      ta
        ? 'TVK உதவி மையம் புகார் பதிவு, பின்தொடர்தல் மற்றும் துறை வழிகாட்டலுக்கு உதவும். என்ன செய்ய வேண்டும் என்று சுருக்கமாகச் சொல்லுங்கள்.'
        : 'I can help with TVK complaints, tracking, and which department to use. Tell me what you need in a sentence or two.'
    );
  } else if (!params.attachmentNames.length) {
    parts.push(
      ta
        ? 'ஒரு கேள்வியைத் தட்டச்சு செய்யவும் அல்லது படம்/ஆவணத்தை இணைக்கவும்.'
        : 'Type a question or attach an image or document.'
    );
  }

  if (params.articles.length) {
    const titles = params.articles.map((a) => a.title).join('; ');
    parts.push(
      ta
        ? `தொடர்புடைய உதவிக் கட்டுரைகள்: ${titles}.`
        : `Related help articles: ${titles}.`
    );
  }

  return parts.join('\n\n');
}

export class AssistantService {
  async chat(params: {
    user: IJwtPayload;
    message: string;
    locale: ChatLocale;
    historyRaw: string;
    files: Express.Multer.File[];
  }): Promise<AssistantChatResult> {
    const locale: ChatLocale = params.locale === 'ta' ? 'ta' : 'en';
    const history = parseHistory(params.historyRaw);
    const files = params.files ?? [];
    const attachments = files.map((file) => ({
      filename: file.originalname || path.basename(file.filename),
      mimeType: file.mimetype,
      size: file.size,
    }));

    try {
      const { names, textSnippets, images } = await readAttachmentSummary(files);

      let articles: Array<{ title: string; slug?: string }> = [];
      const query = params.message.trim();
      if (query.length >= 3) {
        try {
          const result = await knowledgeBaseService.searchArticles(query, 1, 3);
          articles = (result.articles ?? []).map((article: { title?: string; slug?: string }) => ({
            title: article.title ?? '',
            slug: article.slug,
          })).filter((a) => a.title);
        } catch {
          articles = [];
        }
      }

      const ai = await openaiReply({
        locale,
        user: params.user,
        message: params.message,
        history,
        attachmentNames: names,
        textSnippets: [
          ...textSnippets,
          ...articles.map((a) => `Help article: ${a.title}`),
        ],
        images,
      });

      if (ai) {
        return { reply: ai, provider: 'openai', attachments };
      }

      return {
        reply: fallbackReply({
          locale,
          user: params.user,
          message: params.message,
          attachmentNames: names,
          articles,
        }),
        provider: 'fallback',
        attachments,
      };
    } finally {
      await cleanupFiles(files);
    }
  }
}

export const assistantService = new AssistantService();
