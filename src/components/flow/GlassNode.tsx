import { memo, useState, useRef, useMemo, useEffect } from 'react';
import { Handle, Position, NodeResizer, NodeProps, Node } from '@xyflow/react';
import { X, Settings, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, Type, Upload, Lock, Eye, Sparkles, Undo2, Redo2, Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Eraser, Palette, Share2, FileText, File as FileIcon, EyeOff, Plus, Download, BookOpen, ExternalLink, MoreVertical } from 'lucide-react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Dropcursor from '@tiptap/extension-dropcursor';

// Тип данных для заметки (ноды)
export type MediaItem = {
  url: string;
  type: string;
  name?: string;
};

export type GlassNodeData = {
  label?: string; // Заголовок
  content?: string; // Содержимое (HTML/Markdown)
  media?: string; // Медиа-контент (Base64) - Legacy
  mediaType?: string; // Тип медиа (image/video) - Legacy
  mediaItems?: MediaItem[]; // Список медиа-файлов
  doc?: string; // Документ (Base64 или текст)
  docName?: string; // Имя документа
  docType?: string; // Тип документа
  textColor?: string; // Цвет текста
  textAlign?: 'left' | 'center' | 'right' | 'justify'; // Выравнивание
  fontFamily?: string; // Шрифт
  parentId?: string; // ID родительской ноды для синхронизации
};

export type GlassNodeType = Node<GlassNodeData, 'glass'>;

const SYSTEM_FONTS = [
  'Inter', 'JetBrains Mono', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'
];

// Компонент для скрытого текста под паролем
const SecretBlock = ({ children, password: correctPassword, language }: { children: any, password?: string, language: string }) => {
  const [isLocked, setIsLocked] = useState(true);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleUnlock = () => {
    if (input === correctPassword) {
      setIsLocked(false);
      setError(false);
    } else {
      setError(true);
      setTimeout(() => setError(false), 1000);
    }
  };

  if (!isLocked) return <span className="bg-green-500/10 border border-green-500/20 rounded px-1">{children}</span>;

  return (
    <span className={cn(
      "inline-flex items-center gap-2 bg-zinc-800 border border-white/10 rounded px-2 py-0.5 transition-all",
      error && "border-red-500 bg-red-500/10"
    )}>
      <Lock size={12} className="text-zinc-500" />
      <input 
        type="password" 
        className="w-16 bg-transparent border-none focus:outline-none text-[10px] text-white placeholder:text-zinc-600"
        placeholder="***"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
      />
      <button onClick={handleUnlock} className="hover:text-white text-zinc-500 transition-colors">
        <Eye size={12} />
      </button>
    </span>
  );
};

const GlassNode = ({ id, data, selected }: NodeProps<GlassNodeType>) => {
  const { addNode, addEdge, updateNodeData, deleteNode, customFonts, systemFonts, addCustomFont, language, isReadingMode, setReadingMode, theme } = useStore();
  
  // Тексты настроек
  const t = {
    settings: language === 'ru' ? 'Настройки заметки' : 'Node Settings',
    title: language === 'ru' ? 'Заголовок' : 'Title',
    media: language === 'ru' ? 'Добавить медиа' : 'Add Media',
    font: language === 'ru' ? 'Шрифт' : 'Font Family',
    uploadFont: language === 'ru' ? 'Загрузить шрифт (.ttf, .woff)' : 'Upload Font (.ttf, .woff)',
    color: language === 'ru' ? 'Цвет текста' : 'Text Color',
    placeholder: language === 'ru' ? 'Введите текст...' : 'Type here...',
    editHint: language === 'ru' ? 'Двойной клик для редактирования...' : 'Double click to edit...',
    sysFonts: language === 'ru' ? 'Системные' : 'System Fonts',
    custFonts: language === 'ru' ? 'Пользовательские' : 'Custom Fonts',
    editorTitle: language === 'ru' ? 'Редактор' : 'Editor',
    node: language === 'ru' ? 'Заметка' : 'Node',
    fullscreen: language === 'ru' ? 'Режим чтения' : 'Reading Mode',
    exitFullscreen: language === 'ru' ? 'Выход' : 'Exit',
    clean: language === 'ru' ? 'Очистить форматирование' : 'Clear Formatting',
    addDoc: language === 'ru' ? 'Добавить документ' : 'Add Document',
    viewDoc: language === 'ru' ? 'Просмотр' : 'View',
  };

  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDocViewer, setShowDocViewer] = useState(false);

  // Создаем Blob URL для документов (более надежно чем base64 в iframe)
  const docBlobUrl = useMemo(() => {
    if (!data.doc) return null;
    try {
      const base64Content = data.doc.split(',')[1] || data.doc;
      const byteCharacters = atob(base64Content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.docType || 'application/octet-stream' });
      return URL.createObjectURL(blob);
    } catch (e) {
      return data.doc; // Fallback to original
    }
  }, [data.doc, data.docType]);

  // Очистка Blob URL при размонтировании
  useEffect(() => {
    return () => {
      if (docBlobUrl && docBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(docBlobUrl);
      }
    };
  }, [docBlobUrl]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);

  const extensions = useMemo(() => [
    StarterKit,
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({
      placeholder: t.placeholder,
    }),
    Image.configure({
      allowBase64: true,
      HTMLAttributes: {
        class: 'rounded-lg border border-white/10 max-w-full h-auto my-4',
      },
    }),
    Dropcursor.configure({
      color: '#3b82f6',
      width: 2,
    }),
  ], [t.placeholder]);

  const editor = useEditor({
    extensions,
    content: data.content || '',
    onUpdate: ({ editor }) => {
      // При печати пропускаем запись в глобальную историю, чтобы не спамить
      updateNodeData(id, { content: editor.getHTML() }, true);
    },
    onBlur: () => {
      // Когда пользователь закончил печатать (убрал фокус), сохраняем состояние в историю
      useStore.getState().pushHistory();
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none h-full prose prose-invert prose-sm max-w-none cursor-text custom-scrollbar',
      },
    },
  });

  // Синхронизация контента при внешних изменениях (например, Undo/Redo из стора или истории)
  useEffect(() => {
    if (editor && data.content !== editor.getHTML()) {
      editor.commands.setContent(data.content || '');
    }
  }, [data.content, editor]);

  // История изменений контента
  const [history, setHistory] = useState<string[]>([data.content || '']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isNavigatingHistory = useRef(false);

  // Следим за изменениями контента для записи в историю
  useEffect(() => {
    if (isNavigatingHistory.current) {
      isNavigatingHistory.current = false;
      return;
    }

    const currentContent = data.content || '';
    if (currentContent !== history[historyIndex]) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(currentContent);
      // Ограничиваем историю 50 шагами
      if (newHistory.length > 50) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [data.content]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      isNavigatingHistory.current = true;
      setHistoryIndex(prevIndex);
      updateNodeData(id, { content: history[prevIndex] });
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      isNavigatingHistory.current = true;
      setHistoryIndex(nextIndex);
      updateNodeData(id, { content: history[nextIndex] });
    }
  };

  const insertSecret = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to);
    const password = prompt(language === 'ru' ? "Введите пароль для скрытия:" : "Enter password for secret:");
    if (password) {
      editor.commands.insertContent(`<secret password="${password}">${text}</secret>`);
    }
  };

  // Обработка загрузки документа
  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      const isText = file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.txt');
      
      reader.onloadend = () => {
        const result = reader.result as string;
        if (isText) {
          // Автоматическое форматирование: превращаем двойные переносы в параграфы, а одиночные в <br>
          const formattedContent = result
            .trim()
            .split(/\n\s*\n/)
            .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
            .join('');

          updateNodeData(id, { 
            content: formattedContent, 
            docName: file.name,
            docType: file.type
          });
          if (editor) editor.commands.setContent(formattedContent);
        } else {
          // Для PDF и прочих - сохраняем как документ
          updateNodeData(id, { 
            doc: result, 
            docName: file.name, 
            docType: file.type 
          });
        }
      };

      if (isText) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    }
  };

  // Обработка загрузки медиафайла
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newMediaItems = [...(data.mediaItems || [])];
      
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newMediaItems.push({
            url: reader.result as string,
            type: file.type,
            name: file.name
          });
          
          // Обновляем после каждой загрузки или в конце? 
          // Лучше в конце, но FileReader асинхронный.
          if (newMediaItems.length === (data.mediaItems?.length || 0) + files.length) {
            updateNodeData(id, { mediaItems: newMediaItems });
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeMediaItem = (index: number) => {
    const newItems = [...(data.mediaItems || [])];
    newItems.splice(index, 1);
    updateNodeData(id, { mediaItems: newItems });
  };

  // Обработка загрузки пользовательского шрифта
  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fontName = file.name.split('.')[0];
        addCustomFont({ name: fontName, data: reader.result as string });
        updateNodeData(id, { fontFamily: fontName });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = () => {
    deleteNode(id);
  };

  const handleCreateMindMap = (deep = false) => {
    const { pushHistory } = useStore.getState();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = data.content || '';
    
    const parentNode = useStore.getState().nodes.find(n => n.id === id);
    const startX = parentNode?.position.x || 0;
    const startY = parentNode?.position.y || 0;

    // Функция для создания ноды параграфа
    const createParagraphNodes = (containerHtml: string, parentId: string, basePos: { x: number, y: number }) => {
      const pDiv = document.createElement('div');
      pDiv.innerHTML = containerHtml;
      
      // Извлекаем все текстовые блоки
      const paragraphs = Array.from(pDiv.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6')).map(p => p.outerHTML.trim()).filter(t => t);
      
      // Если тегов нет, пробуем разбить по двойному переносу
      let rawBlocks = paragraphs.length > 0 ? paragraphs : containerHtml.split(/<br\s*\/?>\s*<br\s*\/?>|\n\n/).map(s => s.trim()).filter(s => s);

      // Умное объединение заголовков с контентом
      const finalBlocks: string[] = [];
      for (let i = 0; i < rawBlocks.length; i++) {
        const current = rawBlocks[i];
        const plainText = current.replace(/<[^>]*>/g, '').trim();
        
        // Если блок короткий и похож на заголовок (заканчивается на : или ?)
        const isHeader = plainText.length < 60 && (plainText.endsWith(':') || plainText.endsWith('?') || plainText.endsWith(')'));
        
        if (isHeader && i < rawBlocks.length - 1) {
          // Объединяем с следующим блоком
          finalBlocks.push(current + "<br>" + rawBlocks[i+1]);
          i++; // Пропускаем следующий
        } else {
          finalBlocks.push(current);
        }
      }

      finalBlocks.forEach((text, pIndex) => {
        const pNodeId = addNode('glass', { 
          x: basePos.x + 400, 
          y: basePos.y + (pIndex - (finalBlocks.length - 1) / 2) * 250
        }, { 
          content: text, 
          label: `${t.node} ${pIndex + 1}`,
          parentId: parentId,
          initialStyle: { width: 300, height: 200 }
        }, true); // skipHistory

        addEdge({
          id: `e-${parentId}-${pNodeId}`,
          source: parentId,
          target: pNodeId,
          animated: true,
          type: 'smoothstep'
        }, true); // skipHistory
      });
    };

    // Ищем заголовки как основные разделители
    const headings = Array.from(tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6'));

    if (headings.length > 0) {
      headings.forEach((h, index) => {
        const label = h.textContent?.trim() || `${t.node} ${index + 1}`;
        let sectionContent = '';
        let next = h.nextElementSibling;
        while (next && !['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(next.tagName)) {
          sectionContent += next.outerHTML;
          next = next.nextElementSibling;
        }
        
        const chapterY = startY + (index - (headings.length - 1) / 2) * 500;
        const newNodeId = addNode('glass', { 
          x: startX + 400, 
          y: chapterY
        }, { 
          content: sectionContent, 
          label: label,
          parentId: id,
          sectionLabel: label
        }, true); // skipHistory

        addEdge({
          id: `e-${id}-${newNodeId}`,
          source: id,
          target: newNodeId,
          animated: true,
          type: 'smoothstep'
        }, true); // skipHistory

        // Если глубокое разбиение, разбиваем главу на параграфы
        if (deep && sectionContent) {
          createParagraphNodes(sectionContent, newNodeId, { x: startX + 400, y: chapterY });
        }
      });
    } else {
      // Если заголовков нет, пробуем параграфы или списки
      createParagraphNodes(data.content || '', id, { x: startX, y: startY });
    }
    
    // Сохраняем историю один раз после всех изменений
    pushHistory();
    setIsEditing(false);
  };

  const copyToTelegram = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const cleanContent = data.content?.replace(/<[^>]*>/g, '') || '';
      const title = data.label || (language === 'ru' ? 'Заметка' : 'Node');
      const message = `**${title}**\n\n${cleanContent}`;

      const filesToShare: File[] = [];
      
      // Legacy media
      if (data.media) {
        try {
          const response = await fetch(data.media);
          const blob = await response.blob();
          const extension = data.mediaType?.split('/')[1] || 'png';
          filesToShare.push(new File([blob], `image.${extension}`, { type: data.mediaType || 'image/png' }));
        } catch (e) { console.error("Error fetching legacy media", e); }
      }

      // New media items
      if (data.mediaItems && data.mediaItems.length > 0) {
        for (let i = 0; i < data.mediaItems.length; i++) {
          try {
            const item = data.mediaItems[i];
            const response = await fetch(item.url);
            const blob = await response.blob();
            const extension = item.type.split('/')[1] || 'png';
            filesToShare.push(new File([blob], `file_${i}.${extension}`, { type: item.type }));
          } catch (e) { console.error(`Error fetching media item ${i}`, e); }
        }
      }

      // Try System Share first (best for mobile Telegram)
      if (navigator.share) {
        const shareData: ShareData = {
          title: title,
          text: message,
        };
        
        if (filesToShare.length > 0 && navigator.canShare && navigator.canShare({ files: filesToShare })) {
          shareData.files = filesToShare;
        }

        try {
          await navigator.share(shareData);
          return;
        } catch (shareErr) {
          console.log("Navigator share failed, falling back to clipboard", shareErr);
        }
      }

      // Clipboard fallback
      if (filesToShare.length > 0 && window.ClipboardItem) {
        try {
          // Note: ClipboardItem usually supports only one image at a time in many browsers
          const firstImage = filesToShare.find(f => f.type.startsWith('image/'));
          if (firstImage) {
            const dataArray = [
              new ClipboardItem({ 
                [firstImage.type]: firstImage,
                'text/plain': new Blob([message], { type: 'text/plain' })
              }),
            ];
            await navigator.clipboard.write(dataArray);
            alert(language === 'ru' ? "Первое изображение и текст в буфере! Вставьте в Telegram." : "First image and text copied! Paste to Telegram.");
            return;
          }
        } catch (clipErr) {
          console.error("ClipboardItem error", clipErr);
        }
      }
      
      // Text only fallback
      await navigator.clipboard.writeText(message);
      
      // Direct Telegram link as last resort (opens Telegram app)
      const tgUrl = `tg://msg?text=${encodeURIComponent(message)}`;
      window.location.href = tgUrl;
      
      alert(language === 'ru' ? "Текст скопирован и Telegram открыт!" : "Text copied and Telegram opened!");
    } catch (err) {
      console.error("Ошибка копирования/шаринга:", err);
      alert(language === 'ru' ? "Ошибка при отправке" : "Sharing error");
    }
  };

  const handleExportHtml = (e: React.MouseEvent) => {
    e.stopPropagation();
    const title = data.label || (language === 'ru' ? 'Заметка' : 'Node');
    const content = data.content || '';
    const textColor = data.textColor || '#ffffff';
    const fontFamily = data.fontFamily || 'Inter';
    const textAlign = data.textAlign || 'left';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      background-color: #fffff0;
      color: #1a1a1a;
      font-family: '${fontFamily}', sans-serif;
      padding: 40px;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
    }
    .content {
      text-align: ${textAlign};
      color: ${textColor === '#ffffff' ? '#1a1a1a' : textColor};
    }
    .content p, .content div, .content span {
      color: inherit;
    }
    img, video {
      max-width: 100%;
      border-radius: 12px;
      margin: 24px 0;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
      border: 1px solid #e5e5e7;
    }
    pre {
      background: #f4f4f5;
      padding: 20px;
      border-radius: 12px;
      overflow-x: auto;
      border: 1px solid #e5e5e7;
      color: #18181b;
    }
    h1 { color: #2563eb; border-bottom: 1px solid #e5e5e7; padding-bottom: 15px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="content">
    ${content}
    ${data.media ? (data.mediaType?.startsWith('video') ? `<video src="${data.media}" controls></video>` : `<img src="${data.media}" alt="Media">`) : ''}
  </div>
</body>
</html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (isReadingMode) return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            if (isEditing && editor) {
              editor.chain().focus().setImage({ src: base64 }).run();
            } else {
              updateNodeData(id, { media: base64, mediaType: blob.type });
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  return (
    <div 
      onPaste={handlePaste}
      className={cn(
        "glass-node w-full h-full rounded-xl flex flex-col relative group overflow-hidden",
        selected ? "border-[var(--accent-color)] shadow-[var(--accent-glow-subtle)]" : "border-[var(--border-color)]",
        theme.themeBrightness > 0.5 ? "bg-white/80" : "bg-zinc-950/80",
        "backdrop-blur-xl",
        isReadingMode && selected && cn(
          "fixed inset-0 z-[1000] w-screen h-screen !m-0 !translate-x-0 !translate-y-0 rounded-none border-none backdrop-blur-2xl",
          theme.themeBrightness > 0.5 ? "bg-white/80" : "bg-zinc-950/80"
        )
      )}
      style={{ 
        width: (isReadingMode && selected) ? '100vw' : undefined, 
        height: (isReadingMode && selected) ? '100vh' : undefined,
        fontFamily: data.fontFamily || 'inherit',
        backgroundColor: `rgba(${theme.themeBrightness > 0.5 ? '255, 255, 255' : '9, 9, 11'}, ${theme.panelTransparency})`
      }}
    >
      {/* Ресайзер (изменение размера) - Disable in fullscreen */}
      {!isReadingMode && (
        <NodeResizer 
          isVisible={!!selected} 
          minWidth={160} 
          minHeight={100} 
          lineClassName="border-[var(--accent-color)] border-2 opacity-50"
          handleClassName="h-3.5 w-3.5 bg-white border-2 border-[var(--accent-color)] rounded-full hover:scale-125 hover:bg-[var(--accent-color)] transition-all duration-200 shadow-[0_0_10px_var(--accent-glow)] z-50"
        />
      )}

      {/* Заголовок / Область захвата */}
      {!isReadingMode && (
        <div className="custom-drag-handle h-8 w-full bg-white/5 border-b border-white/5 rounded-t-xl flex items-center justify-between px-3 cursor-grab active:cursor-grabbing relative overflow-hidden shrink-0">
          {/* Эффект перелива (Shimmer) */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />
          
          <span className="text-xs font-medium text-zinc-400 truncate flex-1 pr-2">{data.label || (language === 'ru' ? 'Заметка' : 'Node')}</span>
          
          <button 
            onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
            className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors z-10"
            title={t.settings}
          >
            <MoreVertical size={14} />
          </button>
        </div>
      )}

      {/* Панель настроек - открывается ПОВЕРХ ноды */}
      <AnimatePresence>
        {showSettings && !isReadingMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-zinc-900/80 backdrop-blur-md p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-1 shrink-0">
              <span className="text-sm font-bold text-white">{t.settings}</span>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
                <X size={16}/>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Выбор шрифта */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">{t.font}</label>
                <select 
                  className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 text-white transition-colors custom-scrollbar"
                  value={data.fontFamily || 'Inter'}
                  onChange={(e) => updateNodeData(id, { fontFamily: e.target.value })}
                >
                  <optgroup label={t.sysFonts}>
                    {systemFonts.map(font => (
                      <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                    ))}
                  </optgroup>
                  {customFonts.length > 0 && (
                    <optgroup label={t.custFonts}>
                      {customFonts.map(font => (
                        <option key={font.name} value={font.name} style={{ fontFamily: font.name }}>{font.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button 
                  onClick={() => fontInputRef.current?.click()}
                  className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <Plus size={10} /> {t.uploadFont}
                </button>
                <input 
                  type="file" 
                  ref={fontInputRef} 
                  className="hidden" 
                  accept=".ttf,.woff,.woff2,.otf"
                  onChange={handleFontUpload}
                />
              </div>

              {/* Быстрые действия */}
              <div className="grid grid-cols-4 gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleUndo(); }}
                  disabled={historyIndex <= 0}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors disabled:opacity-30 flex justify-center"
                  title={language === 'ru' ? 'Назад' : 'Undo'}
                >
                  <Undo2 size={18} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRedo(); }}
                  disabled={historyIndex >= history.length - 1}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors disabled:opacity-30 flex justify-center"
                  title={language === 'ru' ? 'Вперед' : 'Redo'}
                >
                  <Redo2 size={18} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const parentNode = useStore.getState().nodes.find(n => n.id === id);
                    if (parentNode) {
                      const newNodeId = addNode('glass', { 
                        x: parentNode.position.x + 400, 
                        y: parentNode.position.y 
                      }, { 
                        label: language === 'ru' ? 'Новая ветка' : 'New Branch',
                        parentId: id 
                      });
                      addEdge({
                        id: `e-${id}-${newNodeId}`,
                        source: id,
                        target: newNodeId,
                        animated: true,
                        type: 'smoothstep'
                      });
                    }
                    setShowSettings(false);
                  }}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors flex justify-center"
                  title={language === 'ru' ? 'Добавить ветку' : 'Add Branch'}
                >
                  <Plus size={18} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleCreateMindMap(); setShowSettings(false); }}
                  className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 hover:text-blue-300 transition-colors flex justify-center"
                  title={language === 'ru' ? 'Создать карту мыслей' : 'Create Mind Map'}
                >
                  <Sparkles size={18} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setReadingMode(!isReadingMode); setShowSettings(false); }}
                  className={cn(
                    "p-2 rounded-lg transition-colors flex justify-center",
                    isReadingMode ? "bg-blue-500/20 text-blue-400" : "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
                  )}
                  title={isReadingMode ? t.exitFullscreen : t.fullscreen}
                >
                  <BookOpen size={18} />
                </button>
                <button 
                  onClick={handleExportHtml}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-emerald-400 transition-colors flex justify-center"
                  title={language === 'ru' ? 'Экспорт в HTML' : 'Export to HTML'}
                >
                  <Download size={18} />
                </button>
                <button 
                  onClick={copyToTelegram}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-blue-400 transition-colors flex justify-center"
                  title={language === 'ru' ? 'Скопировать для Telegram' : 'Copy for Telegram'}
                >
                  <Share2 size={18} />
                </button>
                <button 
                  onClick={handleDelete}
                  className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-zinc-400 hover:text-red-400 transition-colors flex justify-center"
                  title={language === 'ru' ? 'Удалить' : 'Delete'}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">{t.title}</label>
                <input 
                  type="text" 
                  className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 text-white transition-colors"
                  value={data.label || ''}
                  onChange={(e) => updateNodeData(id, { label: e.target.value })}
                  placeholder={t.title}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => docInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 text-xs bg-white/5 hover:bg-white/10 p-2.5 rounded-lg transition-colors border border-white/5"
                >
                  <FileText size={14} /> {t.addDoc}
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 text-xs bg-white/5 hover:bg-white/10 p-2.5 rounded-lg transition-colors border border-white/5"
                >
                  <ImageIcon size={14} /> {t.media}
                </button>
              </div>
            </div>

            {/* Список загруженных медиа в настройках */}
            {data.mediaItems && data.mediaItems.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-black/20 rounded border border-white/5 max-h-32 overflow-y-auto custom-scrollbar">
                {data.mediaItems.map((item, idx) => (
                  <div key={idx} className="relative w-12 h-12 rounded border border-white/10 overflow-hidden group/item">
                    {item.type.startsWith('video') ? (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                        <FileIcon size={16} className="text-zinc-500" />
                      </div>
                    ) : (
                  <img src={item.url || undefined} className="w-full h-full object-cover" />
                    )}
                    <button 
                      onClick={() => removeMediaItem(idx)}
                      className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl opacity-0 group-hover/item:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-1 bg-white/5 p-1 rounded">
              {[
                { icon: AlignLeft, value: 'left' },
                { icon: AlignCenter, value: 'center' },
                { icon: AlignRight, value: 'right' },
                { icon: AlignJustify, value: 'justify' },
              ].map((align) => (
                <button
                  key={align.value}
                  onClick={() => updateNodeData(id, { textAlign: align.value })}
                  className={cn(
                    "flex-1 p-1 rounded flex justify-center hover:bg-white/10 transition-colors",
                    data.textAlign === align.value && "bg-blue-500/20 text-blue-400"
                  )}
                >
                  <align.icon size={14} />
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1">
               <label className="text-[10px] text-zinc-500 uppercase tracking-wider">{t.color}</label>
               <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded border border-white/10">
                 <input 
                   type="color" 
                   className="w-5 h-5 rounded bg-transparent border-none cursor-pointer"
                   value={data.textColor || '#ffffff'}
                   onChange={(e) => updateNodeData(id, { textColor: e.target.value })}
                 />
                 <span className="text-xs font-mono opacity-70">{data.textColor || '#ffffff'}</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Плавающее окно редактора Quill - слева на десктопе, сверху на мобилках */}
      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "absolute z-50 glass-panel rounded-xl shadow-2xl border border-white/20",
              "bottom-full left-1/2 -translate-x-1/2 mb-4 w-[90vw] max-w-[320px] md:w-[320px]",
              "bg-zinc-900/80 backdrop-blur-md" // 80% transparency
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white/5 px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t.editorTitle}</span>
              <button onClick={() => setIsEditing(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={12} />
              </button>
            </div>
            
            {/* Tiptap Toolbar */}
            {editor && (
              <div className="p-2 flex flex-wrap gap-1 border-b border-white/10 bg-white/5">
                <button
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={cn("p-1.5 rounded hover:bg-white/10 transition-colors", editor.isActive('bold') && "bg-blue-500/20 text-blue-400")}
                >
                  <Bold size={14} />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={cn("p-1.5 rounded hover:bg-white/10 transition-colors", editor.isActive('italic') && "bg-blue-500/20 text-blue-400")}
                >
                  <Italic size={14} />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  className={cn("p-1.5 rounded hover:bg-white/10 transition-colors", editor.isActive('underline') && "bg-blue-500/20 text-blue-400")}
                >
                  <UnderlineIcon size={14} />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  className={cn("p-1.5 rounded hover:bg-white/10 transition-colors", editor.isActive('strike') && "bg-blue-500/20 text-blue-400")}
                >
                  <Strikethrough size={14} />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1 self-center" />
                <button
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={cn("p-1.5 rounded hover:bg-white/10 transition-colors", editor.isActive('bulletList') && "bg-blue-500/20 text-blue-400")}
                >
                  <List size={14} />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={cn("p-1.5 rounded hover:bg-white/10 transition-colors", editor.isActive('orderedList') && "bg-blue-500/20 text-blue-400")}
                >
                  <ListOrdered size={14} />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1 self-center" />
                <button
                  onClick={() => editor.chain().focus().unsetAllMarks().run()}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors text-zinc-400"
                  title={t.clean || 'Clear Formatting'}
                >
                  <Eraser size={14} />
                </button>
                <button
                  onClick={insertSecret}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors text-zinc-400"
                  title="Password Protect"
                >
                  <Lock size={14} />
                </button>
                <div className="flex items-center gap-1 ml-auto">
                  <input
                    type="color"
                    onInput={e => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
                    className="w-5 h-5 rounded bg-transparent border-none cursor-pointer"
                    title="Text Color"
                  />
                </div>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

      {/* Область содержимого */}
      <div 
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-2 custom-scrollbar nowheel",
          isReadingMode && selected ? "max-w-screen-xl mx-auto w-full p-8 md:p-16" : "p-4"
        )}
        onDoubleClick={() => !isReadingMode && setIsEditing(true)}
      >
        {/* Панель инструментов редактора */}
        {!isReadingMode && isEditing && editor && (
          <div className="flex flex-wrap gap-1 mb-4 p-1 bg-zinc-900/80 rounded-lg border border-white/10 sticky top-0 z-20 backdrop-blur-sm">
            <button 
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={cn("p-1.5 rounded transition-colors", editor.isActive('bold') ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/10 text-zinc-400")}
            >
              <Bold size={14} />
            </button>
            <button 
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={cn("p-1.5 rounded transition-colors", editor.isActive('italic') ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/10 text-zinc-400")}
            >
              <Italic size={14} />
            </button>
            <button 
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={cn("p-1.5 rounded transition-colors", editor.isActive('underline') ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/10 text-zinc-400")}
            >
              <UnderlineIcon size={14} />
            </button>
            <button 
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={cn("p-1.5 rounded transition-colors", editor.isActive('strike') ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/10 text-zinc-400")}
            >
              <Strikethrough size={14} />
            </button>
            <div className="w-px h-4 bg-white/10 self-center mx-1" />
            <button 
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={cn("p-1.5 rounded transition-colors", editor.isActive('bulletList') ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/10 text-zinc-400")}
            >
              <List size={14} />
            </button>
            <button 
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={cn("p-1.5 rounded transition-colors", editor.isActive('orderedList') ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/10 text-zinc-400")}
            >
              <ListOrdered size={14} />
            </button>
            <div className="w-px h-4 bg-white/10 self-center mx-1" />
            <button 
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              className="p-1.5 hover:bg-white/10 rounded text-zinc-400 transition-colors"
              title={t.clean}
            >
              <Eraser size={14} />
            </button>
            <button 
              onClick={insertSecret}
              className="p-1.5 hover:bg-white/10 rounded text-zinc-400 transition-colors"
              title={language === 'ru' ? 'Скрытый текст' : 'Secret Text'}
            >
              <Lock size={14} />
            </button>
            <div className="w-px h-4 bg-white/10 self-center mx-1" />
            <button 
              onClick={() => setIsEditing(false)}
              className="p-1.5 hover:bg-blue-500/20 rounded text-blue-400 transition-colors ml-auto"
            >
              <Eye size={14} />
            </button>
          </div>
        )}
        {data.doc && (
          <div className="bg-white/5 rounded-lg p-3 border border-white/10 flex items-center justify-between group/doc">
            <div className="flex items-center gap-2 overflow-hidden">
              <FileIcon size={16} className="text-blue-400 shrink-0" />
              <span className="text-xs text-zinc-300 truncate">{data.docName || 'Document'}</span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover/doc:opacity-100 transition-opacity">
              <button 
                onClick={() => setShowDocViewer(!showDocViewer)}
                className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white"
                title={t.viewDoc}
              >
                {showDocViewer ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              {docBlobUrl && (
                <>
                  <a 
                    href={docBlobUrl} 
                    download={data.docName || 'document'}
                    className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-emerald-400"
                    title={language === 'ru' ? 'Скачать' : 'Download'}
                  >
                    <Download size={14} />
                  </a>
                  <button 
                    onClick={() => window.open(docBlobUrl, '_blank')}
                    className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-blue-400"
                    title={language === 'ru' ? 'Открыть в новом окне' : 'Open in new window'}
                  >
                    <ExternalLink size={14} />
                  </button>
                </>
              )}
              <button 
                onClick={() => updateNodeData(id, { doc: undefined, docName: undefined, docType: undefined })}
                className="p-1 hover:bg-red-500/20 rounded text-zinc-400 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {showDocViewer && data.doc && (
          <div className="w-full h-[400px] rounded-lg overflow-hidden border border-white/10 bg-black/40 relative">
            {data.docType === 'application/pdf' ? (
              <iframe 
                src={docBlobUrl ? `${docBlobUrl}#toolbar=0` : undefined} 
                className="w-full h-full border-none bg-white" 
                title="PDF Viewer" 
              />
            ) : (
              <div className="p-6 text-xs text-zinc-400 flex flex-col items-center justify-center h-full text-center gap-4">
                <FileText size={48} className="opacity-20" />
                <p className="max-w-[200px]">
                  {language === 'ru' 
                    ? `Предпросмотр для ${data.docName?.split('.').pop()?.toUpperCase()} ограничен. Используйте кнопки выше, чтобы скачать или открыть файл.` 
                    : `Preview for ${data.docName?.split('.').pop()?.toUpperCase()} is limited. Use the buttons above to download or open the file.`}
                </p>
                <div className="flex gap-2">
                  <a 
                    href={docBlobUrl} 
                    download={data.docName || 'document'}
                    className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors flex items-center gap-2"
                  >
                    <Download size={14} /> {language === 'ru' ? 'Скачать' : 'Download'}
                  </a>
                  <button 
                    onClick={() => window.open(docBlobUrl, '_blank')}
                    className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center gap-2"
                  >
                    <ExternalLink size={14} /> {language === 'ru' ? 'Открыть' : 'Open'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legacy Media */}
        {data.media && (
          <div className="rounded-lg overflow-hidden border border-white/10 shrink-0 relative group/media">
            <button 
              onClick={() => updateNodeData(id, { media: undefined, mediaType: undefined })}
              className="absolute top-2 right-2 z-10 p-1 bg-black/60 hover:bg-red-500/80 text-white rounded-full opacity-0 group-hover/media:opacity-100 transition-all shadow-lg"
              title={language === 'ru' ? 'Удалить медиа' : 'Remove media'}
            >
              <X size={14} />
            </button>
            {data.mediaType?.startsWith('video') ? (
              <video src={data.media || undefined} controls className="w-full h-auto max-h-[200px] object-cover" />
            ) : (
              <img src={data.media || undefined} alt="Node media" className="w-full h-auto max-h-[200px] object-cover" />
            )}
          </div>
        )}

        {/* Multiple Media Items */}
        {data.mediaItems && data.mediaItems.length > 0 && (
          <div className={cn(
            "grid gap-2 shrink-0",
            data.mediaItems.length === 1 ? "grid-cols-1" : "grid-cols-2"
          )}>
            {data.mediaItems.map((item, idx) => (
              <div key={idx} className="rounded-lg overflow-hidden border border-white/10 relative group/mediaitem aspect-video bg-black/20">
                <button 
                  onClick={() => removeMediaItem(idx)}
                  className="absolute top-1 right-1 z-10 p-1 bg-black/60 hover:bg-red-500/80 text-white rounded-full opacity-0 group-hover/mediaitem:opacity-100 transition-all shadow-lg"
                >
                  <X size={10} />
                </button>
                {item.type.startsWith('video') ? (
                  <video src={item.url || undefined} controls className="w-full h-full object-cover" />
                ) : (
                  <img src={item.url || undefined} alt={`Media ${idx}`} className="w-full h-full object-cover cursor-zoom-in" onClick={() => window.open(item.url, '_blank')} />
                )}
              </div>
            ))}
          </div>
        )}

        {isEditing ? (
          <div 
            className="flex-1 tiptap-container text-white cursor-text h-full"
            style={{ fontFamily: data.fontFamily || 'Inter' }}
          >
            <EditorContent editor={editor} className="h-full" />
          </div>
        ) : (
          <div 
            className={cn(
              "w-full h-full prose prose-invert prose-sm max-w-none cursor-text [&_*]:text-inherit",
              isReadingMode && selected && "prose-base md:prose-lg"
            )}
            style={{ 
              color: data.textColor || '#ffffff',
              textAlign: data.textAlign || 'left',
              fontFamily: data.fontFamily || 'Inter'
            }}
          >
            {data.content ? (
              <Markdown 
                rehypePlugins={[rehypeRaw]}
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  secret: ({ node, ...props }: any) => <SecretBlock {...props} language={language} />
                } as any}
              >
                {data.content}
              </Markdown>
            ) : (
              <span className="opacity-50 italic">{t.editHint}</span>
            )}
          </div>
        )}
      </div>

      {/* Кнопка выхода из режима чтения (Книжка) */}
      {isReadingMode && selected && (
        <button
          onClick={() => setReadingMode(false)}
          className="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-transform z-[1001] eclipse-glow"
          title={t.exitFullscreen}
        >
          <BookOpen size={32} />
        </button>
      )}

      {/* Точки подключения (Handles) */}
      <Handle type="target" position={Position.Left} className="!bg-zinc-600 !w-3 !h-3 !border-zinc-800" />
      <Handle type="source" position={Position.Right} className="!bg-zinc-600 !w-3 !h-3 !border-zinc-800" />
      <Handle type="target" position={Position.Top} className="!bg-zinc-600 !w-3 !h-3 !border-zinc-800" />
      <Handle type="source" position={Position.Bottom} className="!bg-zinc-600 !w-3 !h-3 !border-zinc-800" />
    </div>
  );
};

export default memo(GlassNode);
