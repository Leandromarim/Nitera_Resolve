'use client';

import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { uploadFile } from '@/lib/api';
import { Button, Field, Input, Modal, clsx, useToast } from '@/components/ui';

function ToolButton({ label, active, onClick, disabled, children }: { label: string; active?: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={clsx(
        'grid size-8 shrink-0 place-items-center rounded-lg transition disabled:opacity-30 [&_svg]:size-4',
        active ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200' : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-700',
      )}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-slate-300 dark:bg-slate-700" aria-hidden />;

function Toolbar({ editor, onLink, onImage, uploading }: { editor: Editor; onLink: () => void; onImage?: () => void; uploading: boolean }) {
  const c = () => editor.chain().focus();
  return (
    <div role="toolbar" aria-label="Formatação" className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/95 px-2 py-1.5 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
      <ToolButton label="Desfazer" onClick={() => c().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 />
      </ToolButton>
      <ToolButton label="Refazer" onClick={() => c().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 />
      </ToolButton>
      <Sep />
      <ToolButton label="Parágrafo" active={editor.isActive('paragraph')} onClick={() => c().setParagraph().run()}>
        <Pilcrow />
      </ToolButton>
      <ToolButton label="Título 1" active={editor.isActive('heading', { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()}>
        <Heading1 />
      </ToolButton>
      <ToolButton label="Título 2" active={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </ToolButton>
      <ToolButton label="Título 3" active={editor.isActive('heading', { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </ToolButton>
      <Sep />
      <ToolButton label="Negrito" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()}>
        <Bold />
      </ToolButton>
      <ToolButton label="Itálico" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}>
        <Italic />
      </ToolButton>
      <ToolButton label="Tachado" active={editor.isActive('strike')} onClick={() => c().toggleStrike().run()}>
        <Strikethrough />
      </ToolButton>
      <Sep />
      <ToolButton label="Lista com marcadores" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}>
        <List />
      </ToolButton>
      <ToolButton label="Lista numerada" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}>
        <ListOrdered />
      </ToolButton>
      <ToolButton label="Citação" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}>
        <Quote />
      </ToolButton>
      <ToolButton label="Linha divisória" onClick={() => c().setHorizontalRule().run()}>
        <Minus />
      </ToolButton>
      <Sep />
      <ToolButton label="Inserir link" active={editor.isActive('link')} onClick={onLink}>
        <Link2 />
      </ToolButton>
      <ToolButton label="Remover link" disabled={!editor.isActive('link')} onClick={() => c().extendMarkRange('link').unsetLink().run()}>
        <Link2Off />
      </ToolButton>
      {onImage && (
        <ToolButton label="Inserir imagem" onClick={onImage} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        </ToolButton>
      )}
    </div>
  );
}

/**
 * Editor de texto rico (HTML) para as páginas do portal.
 * `semImagem`: sem envio de imagens (as imagens do editor são arquivos públicos; módulos com dados internos usam anexos próprios).
 */
export function RichEditor({ value, onChange, label = 'Conteúdo', semImagem = false, altura = 320 }: { value: string; onChange: (html: string) => void; label?: string; semImagem?: boolean; altura?: number }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const lastEmitted = useRef(value);
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: null, target: '_blank' } },
      }),
      Image.configure({ HTMLAttributes: { loading: 'lazy' } }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose-ha max-w-none px-4 py-3 text-[15px] focus:outline-none sm:px-6',
        style: `min-height: ${altura}px`,
        'aria-label': label,
        role: 'textbox',
        'aria-multiline': 'true',
      },
      handleDrop: (view, event) => {
        const file = event.dataTransfer?.files?.[0];
        if (semImagem && file) {
          event.preventDefault();
          return true;
        }
        if (file && file.type.startsWith('image/')) {
          event.preventDefault();
          insertImage(file);
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const file = event.clipboardData?.files?.[0];
        if (semImagem && file) return true;
        if (file && file.type.startsWith('image/')) {
          insertImage(file);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? '' : editor.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  editorRef.current = editor;

  // conteúdo trocado de fora (ex.: abrir outra página)
  useEffect(() => {
    if (editor && value !== lastEmitted.current) {
      lastEmitted.current = value;
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  async function insertImage(file: File) {
    setUploading(true);
    try {
      const f = await uploadFile(file, { public: true, images: true });
      editorRef.current?.chain().focus().setImage({ src: f.url, alt: f.originalName.replace(/\.[^.]+$/, '') }).run();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  const openLink = () => {
    if (!editor) return;
    setLinkUrl(editor.getAttributes('link').href ?? '');
    setLinkOpen(true);
  };
  const applyLink = () => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else if (!/^(https?:\/\/|mailto:|tel:|\/)/i.test(url)) return toast('O link precisa começar com https://, mailto:, tel: ou /', 'error');
    else if (editor.state.selection.empty && !editor.isActive('link')) editor.chain().focus().insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setLinkOpen(false);
  };

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-brand-500 dark:bg-slate-900 dark:ring-slate-700">
        {editor ? (
          <>
            <Toolbar editor={editor} onLink={openLink} onImage={semImagem ? undefined : () => fileRef.current?.click()} uploading={uploading} />
            <EditorContent editor={editor} />
          </>
        ) : (
          <div className="grid place-items-center text-sm text-slate-400" style={{ minHeight: altura + 40 }}>Carregando editor…</div>
        )}
      </div>
      {!semImagem && <p className="text-xs text-slate-500">Dica: arraste ou cole imagens direto no texto.</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) insertImage(f);
        }}
      />
      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Inserir link"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLinkOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={applyLink}>Aplicar</Button>
          </>
        }
      >
        <Field label="Endereço" hint="Deixe vazio para remover o link. Selecione o texto antes para transformá-lo em link.">
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" autoFocus onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyLink())} />
        </Field>
      </Modal>
    </div>
  );
}
