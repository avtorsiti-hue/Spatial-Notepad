import { useState, useRef, useEffect } from 'react';
import { Plus, Grid, Magnet, Image as ImageIcon, Sparkles, HelpCircle, Languages, FileCode, Search, Download, X, Link as LinkIcon, ExternalLink, Trash2, Undo2, Redo2, FileText, Send, Loader2, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { useStore } from '@/store/useStore';
import { useReactFlow } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { GoogleGenAI } from "@google/genai";

export default function FloatingMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLinkInputOpen, setIsLinkInputOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [geminiPrompt, setGeminiPrompt] = useState('');
  const [geminiResponse, setGeminiResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [helpContent, setHelpContent] = useState('');
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const { 
    nodes, addNode, toggleGrid, toggleSnap, gridEnabled, snapToGrid, 
    setBackgroundImage, setBackgroundHtml, language, toggleLanguage,
    customLinks, addCustomLink, deleteCustomLink, undo, redo, clearCanvas,
    theme, setTheme, systemFonts
  } = useStore();
  const { screenToFlowPosition, setCenter } = useReactFlow();
  const bgInputRef = useRef<HTMLInputElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);

  const handleGeminiSubmit = async () => {
    if (!geminiPrompt.trim() || isGenerating) return;
    
    setIsGenerating(true);
    setGeminiResponse('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: geminiPrompt,
        config: {
          systemInstruction: language === 'ru' 
            ? "Ты - помощник для создания заметок. Помогай пользователю структурировать мысли, генерировать идеи и писать тексты. Отвечай в формате Markdown."
            : "You are a note-taking assistant. Help the user structure thoughts, generate ideas, and write texts. Respond in Markdown format.",
        },
      });
      
      setGeminiResponse(response.text || '');
    } catch (error) {
      console.error('Gemini API Error:', error);
      setGeminiResponse(language === 'ru' ? 'Ошибка при обращении к AI. Проверьте API ключ.' : 'Error calling AI. Check API key.');
    } finally {
      setIsGenerating(false);
    }
  };

  const addGeminiResponseAsNode = () => {
    if (!geminiResponse) return;
    
    const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const newPos = { x: pos.x - 125, y: pos.y - 175 };
    
    addNode('glass', newPos, {
      label: language === 'ru' ? 'Ответ AI' : 'AI Response',
      content: geminiResponse
    });
    
    setTimeout(() => {
      setCenter(newPos.x + 125, newPos.y + 175, { zoom: 1, duration: 800 });
    }, 50);
    
    setIsGeminiModalOpen(false);
    setIsOpen(false);
  };

  // Добавление нового узла под предыдущим или в центр экрана
  const handleAddNode = () => {
    let newPos;
    if (nodes.length > 0) {
      // Находим самую нижнюю ноду
      const lastNode = nodes.reduce((prev, current) => 
        (prev.position.y > current.position.y) ? prev : current
      );
      
      // Размещаем новую ноду под ней с отступом
      // Стандартная высота ноды 350px + отступ 50px
      newPos = { 
        x: lastNode.position.x, 
        y: lastNode.position.y + 400 
      };
    } else {
      // Если нод нет, добавляем в центр экрана
      const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      newPos = { x: pos.x - 100, y: pos.y - 75 };
    }

    const newNodeId = addNode('glass', newPos);
    
    // Плавно перемещаем камеру к новой ноде
    // Ширина ноды 250, высота 350. Центрируем по середине.
    setTimeout(() => {
      setCenter(newPos.x + 125, newPos.y + 175, { zoom: 1, duration: 800 });
    }, 50);

    setIsOpen(false);
  };

  // Загрузка фонового изображения
  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Загрузка HTML фона
  const handleHtmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundHtml(reader.result as string);
      };
      reader.readAsText(file);
    }
  };

  // Открытие справки (README_RU.txt)
  const handleOpenHelp = async () => {
    try {
      const response = await fetch('/README_RU.txt');
      const text = await response.text();
      setHelpContent(text);
      setIsHelpModalOpen(true);
    } catch (error) {
      console.error('Failed to load help content:', error);
      // Fallback content if fetch fails
      setHelpContent('# Ошибка\nНе удалось загрузить файл справки.');
      setIsHelpModalOpen(true);
    }
  };

  // Экспорт в HTML
  const handleExportHtml = () => {
    const data = JSON.stringify({ nodes, edges: useStore.getState().edges }, null, 2);
    const htmlContent = `
<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mind Map Feed - ${new Date().toLocaleDateString()}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        body { 
          font-family: 'Inter', sans-serif; 
          background: #fffff0; 
          color: #1a1a1a; 
          line-height: 1.6; 
          margin: 0; 
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .feed-container {
          width: 100%;
          max-width: 600px;
        }
        .post { 
          background: #ffffff; 
          border: 1px solid #e5e5e7; 
          border-radius: 20px; 
          padding: 24px; 
          margin-bottom: 32px; 
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
          overflow-wrap: break-word;
          word-wrap: break-word;
          hyphens: auto;
        }
        h1 { color: #2563eb; font-size: 2rem; margin-bottom: 40px; text-align: center; font-weight: 600; }
        h2 { color: #1d4ed8; margin-top: 0; border-bottom: 1px solid #e5e5e7; padding-bottom: 12px; font-size: 1.25rem; }
        .content { font-size: 1rem; color: #374151; }
        .content img, .content video { 
          width: 100%; 
          border-radius: 12px; 
          margin-top: 16px; 
          border: 1px solid #e5e5e7;
        }
        .meta { font-size: 0.8rem; color: #6b7280; margin-top: 60px; text-align: center; border-top: 1px solid #e5e5e7; padding-top: 30px; width: 100%; max-width: 600px; }
        pre { background: #f4f4f5; padding: 15px; border-radius: 12px; overflow-x: auto; font-size: 0.8rem; display: none; text-align: left; border: 1px solid #e5e5e7; color: #18181b; }
        .show-json:checked ~ pre { display: block; }
        .checkbox-label { cursor: pointer; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    </style>
</head>
<body>
    <h1>Mind Map Feed</h1>
    <div class="feed-container">
    ${nodes.map(n => `
        <div class="post">
            <h2>${n.data.label || (language === 'ru' ? 'Заметка' : 'Node')}</h2>
            <div class="content">
              ${n.data.content || ''}
              ${n.data.media ? (
                (n.data.mediaType as string)?.startsWith('video') 
                  ? `<video src="${n.data.media}" controls></video>` 
                  : `<img src="${n.data.media}" alt="Media content">`
              ) : ''}
            </div>
        </div>
    `).join('')}
    </div>
    
    <div class="meta">
        <p>Generated by Spatial Mind Map Assistant</p>
        <label class="checkbox-label"><input type="checkbox" class="show-json"> Show Raw Data (JSON)</label>
        <pre>${data}</pre>
    </div>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mind-map-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Поиск и переход к ноде
  const handleSearchSelect = (node: any) => {
    setCenter(node.position.x + 125, node.position.y + 175, { zoom: 1.2, duration: 800 });
    setSearchQuery('');
    setIsOpen(false);
  };

  const filteredNodes = searchQuery.trim() 
    ? nodes.filter(n => 
        (n.data?.label as string || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.data?.content as string || '').toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  // Добавление кастомной ссылки
  const handleAddCustomLink = () => {
    if (newLinkName && newLinkUrl) {
      let url = newLinkUrl;
      if (!url.startsWith('http')) url = 'https://' + url;
      addCustomLink({ name: newLinkName, url });
      setNewLinkName('');
      setNewLinkUrl('');
      setIsLinkInputOpen(false);
    }
  };

  // Тексты для интерфейса
  const t = {
    add: language === 'ru' ? 'Добавить заметку' : 'Add Node',
    gemini: language === 'ru' ? 'Спросить Gemini' : 'Ask Gemini',
    grid: language === 'ru' ? 'Сетка' : 'Grid',
    snap: language === 'ru' ? 'Привязка' : 'Snap',
    bg: language === 'ru' ? 'Свой фон (Картинка)' : 'Set Background (Image)',
    bgHtml: language === 'ru' ? 'Свой фон (HTML)' : 'Set Background (HTML)',
    help: language === 'ru' ? 'Справка' : 'Help',
    lang: language === 'ru' ? 'English' : 'Русский',
    on: language === 'ru' ? 'Вкл' : 'On',
    off: language === 'ru' ? 'Выкл' : 'Off',
    search: language === 'ru' ? 'Поиск заметки...' : 'Search nodes...',
    export: language === 'ru' ? 'Сохранить в HTML' : 'Save as HTML',
    clear: language === 'ru' ? 'Очистить холст' : 'Clear Canvas',
    addLink: language === 'ru' ? 'Добавить ссылку' : 'Add Link',
    linkName: language === 'ru' ? 'Название ссылки' : 'Link Name',
    linkUrl: language === 'ru' ? 'URL ссылки' : 'Link URL',
    settings: language === 'ru' ? 'Настройки интерфейса' : 'Interface Settings',
    uiFont: language === 'ru' ? 'Шрифт интерфейса' : 'Interface Font',
    transparency: language === 'ru' ? 'Прозрачность панелей' : 'Panel Transparency',
    colorScheme: language === 'ru' ? 'Цветовая схема' : 'Color Scheme',
    accentColor: language === 'ru' ? 'Цвет акцента' : 'Accent Color',
    dark: language === 'ru' ? 'Темная' : 'Dark',
    light: language === 'ru' ? 'Светлая' : 'Light',
  };

  // Helper to get hue from hex
  const getHueFromHex = (hex: string) => {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return Math.round(h * 360);
  };

  const hueToHex = (h: number) => {
    const hDecimal = h / 360;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = 0.5 < 0.5 ? 0.5 * (1 + 1) : 0.5 + 1 - 0.5 * 1;
    const p = 2 * 0.5 - q;
    const r = hue2rgb(p, q, hDecimal + 1 / 3);
    const g = hue2rgb(p, q, hDecimal);
    const b = hue2rgb(p, q, hDecimal - 1 / 3);
    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  return (
    <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-40 flex flex-col items-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="flex flex-col gap-3 items-end max-h-[80vh] overflow-y-auto custom-scrollbar"
          >
            {/* Панель кнопок действий */}
            <div 
              className="glass-panel p-2 rounded-xl flex flex-col gap-1 md:gap-2"
              style={{ 
                backgroundColor: `rgba(${theme.themeBrightness > 0.5 ? '255, 255, 255' : '24, 24, 27'}, ${theme.panelTransparency})`,
                color: 'var(--accent-color)'
              }}
            >
              <button onClick={handleAddNode} className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left w-48 md:w-60">
                <Plus size={18} /> <span className="text-sm md:text-base">{t.add}</span>
              </button>
              <button onClick={() => { setIsGeminiModalOpen(true); setIsOpen(false); }} className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left w-48 md:w-60">
                <Sparkles size={18} /> <span className="text-sm md:text-base">{t.gemini}</span>
              </button>
              <button onClick={() => { setIsSettingsModalOpen(true); setIsOpen(false); }} className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left w-48 md:w-60 opacity-80">
                <Settings size={18} /> <span className="text-sm md:text-base">{t.settings}</span>
              </button>
              
              {/* Кастомные ссылки */}
              {customLinks.map(link => (
                <div key={link.id} className="group/link flex items-center gap-1 w-48 md:w-60">
                  <button 
                    onClick={() => window.open(link.url, '_blank')} 
                    className="flex-1 flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left text-zinc-300 overflow-hidden"
                  >
                    <ExternalLink size={18} className="shrink-0" /> <span className="text-sm md:text-base truncate">{link.name}</span>
                  </button>
                  <button 
                    onClick={() => deleteCustomLink(link.id)}
                    className="p-2 text-zinc-500 hover:text-red-400 transition-all shrink-0"
                    title={language === 'ru' ? 'Удалить ссылку' : 'Delete link'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button 
                onClick={() => setIsLinkInputOpen(!isLinkInputOpen)} 
                className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left w-48 md:w-60 text-zinc-400"
              >
                <LinkIcon size={18} /> <span className="text-sm md:text-base">{t.addLink}</span>
              </button>

              <AnimatePresence>
                {isLinkInputOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-3 py-2 flex flex-col gap-2 bg-black/20 rounded-lg border border-white/5 overflow-hidden"
                  >
                    <input 
                      type="text"
                      value={newLinkName}
                      onChange={(e) => setNewLinkName(e.target.value)}
                      placeholder={t.linkName}
                      className="bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                    />
                    <input 
                      type="text"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder={t.linkUrl}
                      className="bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                    />
                    <button 
                      onClick={handleAddCustomLink}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold py-1.5 rounded transition-colors"
                    >
                      {language === 'ru' ? 'Добавить' : 'Add'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="h-px bg-white/10 my-1" />
              
              <button onClick={toggleGrid} className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left w-48 md:w-60">
                <Grid size={18} className={gridEnabled ? "text-blue-400" : "text-zinc-500"} /> 
                <span className="text-sm md:text-base">{t.grid} {gridEnabled ? t.on : t.off}</span>
              </button>
              <button onClick={toggleSnap} className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left w-48 md:w-60">
                <Magnet size={18} className={snapToGrid ? "text-blue-400" : "text-zinc-500"} /> 
                <span className="text-sm md:text-base">{t.snap} {snapToGrid ? t.on : t.off}</span>
              </button>
              
              <div className="h-px bg-white/10 my-1" />
              
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 w-48 md:w-60">
                  <button onClick={() => bgInputRef.current?.click()} className="flex-1 flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left">
                    <ImageIcon size={18} /> <span className="text-sm md:text-base">{t.bg}</span>
                  </button>
                  {useStore.getState().theme.backgroundImage && (
                    <button 
                      onClick={() => setBackgroundImage(undefined)}
                      className="p-2 text-zinc-500 hover:text-red-400 transition-all shrink-0"
                      title={language === 'ru' ? 'Удалить фон' : 'Clear background'}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={bgInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleBgUpload}
                />

                <div className="flex items-center gap-1 w-48 md:w-60">
                  <button onClick={() => htmlInputRef.current?.click()} className="flex-1 flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left">
                    <FileCode size={18} /> <span className="text-sm md:text-base">{t.bgHtml}</span>
                  </button>
                  {useStore.getState().theme.backgroundHtml && (
                    <button 
                      onClick={() => setBackgroundHtml(undefined)}
                      className="p-2 text-zinc-500 hover:text-red-400 transition-all shrink-0"
                      title={language === 'ru' ? 'Удалить HTML фон' : 'Clear HTML background'}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={htmlInputRef} 
                  className="hidden" 
                  accept=".html,.htm"
                  onChange={handleHtmlUpload}
                />
              </div>
              
              <button onClick={toggleLanguage} className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left w-48 md:w-60">
                <Languages size={18} /> <span className="text-sm md:text-base">{t.lang}</span>
              </button>
              
              <button onClick={handleOpenHelp} className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left w-48 md:w-60 text-zinc-400">
                <HelpCircle size={18} /> <span className="text-sm md:text-base">{t.help}</span>
              </button>

              <div className="h-px bg-white/10 my-1" />

              {/* Поиск под справкой */}
              <div className="px-2 py-1">
                <div className="relative flex items-center bg-black/20 rounded-lg border border-white/10 px-2 py-1.5 focus-within:border-blue-500/50 transition-colors">
                  <Search size={14} className="text-zinc-500" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.search}
                    className="bg-transparent border-none focus:outline-none text-xs px-2 w-full text-white placeholder:text-zinc-600"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-zinc-600 hover:text-white">
                      <X size={12} />
                    </button>
                  )}
                </div>
                
                {/* Результаты поиска */}
                <AnimatePresence>
                  {searchQuery.trim() && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 flex flex-col gap-1"
                    >
                      {filteredNodes.length > 0 ? (
                        filteredNodes.map(node => (
                          <button 
                            key={node.id}
                            onClick={() => handleSearchSelect(node)}
                            className="text-left px-2 py-1.5 hover:bg-blue-500/20 rounded text-[10px] text-zinc-300 truncate transition-colors border border-transparent hover:border-blue-500/30"
                          >
                            {(node.data?.label as string) || (language === 'ru' ? 'Заметка' : 'Node')}
                          </button>
                        ))
                      ) : (
                        <span className="text-[10px] text-zinc-600 italic px-2">No results</span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="h-px bg-white/10 my-1" />

              <button onClick={handleExportHtml} className="flex items-center gap-3 px-3 py-2 hover:bg-blue-500/20 rounded-lg transition-colors text-left w-48 md:w-60 text-emerald-400">
                <Download size={18} /> <span className="text-sm md:text-base">{t.export}</span>
              </button>
              
              <button onClick={() => { clearCanvas(); setIsOpen(false); }} className="flex items-center gap-3 px-3 py-2 hover:bg-red-500/20 rounded-lg transition-colors text-left w-48 md:w-60 text-red-400">
                <Trash2 size={18} /> <span className="text-sm md:text-base">{t.clear}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Глобальные кнопки Undo/Redo и FAB */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); undo(); }}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-zinc-900/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all shadow-xl"
            title={language === 'ru' ? 'Отменить' : 'Undo'}
          >
            <Undo2 size={20} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); redo(); }}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-zinc-900/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all shadow-xl"
            title={language === 'ru' ? 'Вернуть' : 'Redo'}
          >
            <Redo2 size={20} />
          </button>
        </div>

        {/* Основная кнопка FAB */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all duration-300 z-50",
            isOpen 
              ? "bg-zinc-800 text-white rotate-45 shadow-xl" 
              : "bg-[var(--accent-color)] text-white hover:scale-110 eclipse-glow"
          )}
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Модальное окно настроек интерфейса */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass-panel rounded-2xl overflow-hidden flex flex-col shadow-2xl border-white/10"
              style={{ backgroundColor: `rgba(${theme.colorScheme === 'light' ? '255, 255, 255' : '9, 9, 11'}, ${theme.panelTransparency})` }}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Settings className="text-zinc-400" />
                  {t.settings}
                </h2>
                <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 flex flex-col gap-6">
                {/* Выбор шрифта интерфейса */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.uiFont}</label>
                  <select 
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 text-white transition-colors custom-scrollbar"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                    value={theme.interfaceFont}
                    onChange={(e) => setTheme({ ...theme, interfaceFont: e.target.value })}
                  >
                    {systemFonts.map(font => (
                      <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                    ))}
                  </select>
                </div>

                {/* Прозрачность панелей */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.transparency}</label>
                    <span className="text-xs font-mono" style={{ color: 'var(--accent-color)' }}>{Math.round(theme.panelTransparency * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="1" 
                    step="0.01"
                    value={theme.panelTransparency}
                    onChange={(e) => setTheme({ ...theme, panelTransparency: parseFloat(e.target.value) })}
                    className="custom-range"
                  />
                </div>

                {/* Цветовая схема (Яркость) */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.colorScheme}</label>
                    <span className="text-xs font-mono" style={{ color: 'var(--accent-color)' }}>{theme.themeBrightness > 0.5 ? t.light : t.dark}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01"
                    value={theme.themeBrightness}
                    onChange={(e) => setTheme({ ...theme, themeBrightness: parseFloat(e.target.value) })}
                    className="custom-range"
                  />
                </div>

                {/* Цвет акцента */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.accentColor}</label>
                    <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: theme.accentColor }} />
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="360" 
                    step="1"
                    value={getHueFromHex(theme.accentColor)}
                    onChange={(e) => setTheme({ ...theme, accentColor: hueToHex(parseInt(e.target.value)) })}
                    className="custom-range"
                    style={{ 
                      background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                      height: '4px',
                      borderRadius: '2px'
                    }}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Модальное окно Gemini */}
      <AnimatePresence>
        {isGeminiModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGeminiModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "relative w-full max-w-2xl glass-panel rounded-2xl overflow-hidden flex flex-col shadow-2xl border-blue-500/20",
                theme.colorScheme === 'light' ? "bg-white/80 text-zinc-900" : "bg-zinc-900/80 text-white"
              )}
              style={{ backgroundColor: `rgba(${theme.colorScheme === 'light' ? '255, 255, 255' : '9, 9, 11'}, ${theme.panelTransparency})` }}
            >
              <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between bg-zinc-900/80">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="text-blue-400" />
                  {language === 'ru' ? 'AI Ассистент' : 'AI Assistant'}
                </h2>
                <button 
                  onClick={() => setIsGeminiModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-zinc-950/40 min-h-[300px] max-h-[50vh]">
                {geminiResponse ? (
                  <div className="prose prose-invert max-w-none">
                    <Markdown>{geminiResponse}</Markdown>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
                    <Sparkles size={48} className="opacity-20" />
                    <p className="text-sm italic">
                      {language === 'ru' ? 'Спросите что-нибудь у AI...' : 'Ask AI something...'}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-zinc-900/80 border-t border-white/10 flex flex-col gap-3">
                <div className="relative flex items-center">
                  <textarea 
                    value={geminiPrompt}
                    onChange={(e) => setGeminiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleGeminiSubmit();
                      }
                    }}
                    placeholder={language === 'ru' ? 'Напишите запрос...' : 'Type your prompt...'}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 text-white placeholder:text-zinc-600 resize-none h-20 custom-scrollbar"
                  />
                  <button 
                    onClick={handleGeminiSubmit}
                    disabled={isGenerating || !geminiPrompt.trim()}
                    className="absolute bottom-3 right-3 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg transition-all"
                  >
                    {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
                
                {geminiResponse && !isGenerating && (
                  <button 
                    onClick={addGeminiResponseAsNode}
                    className="flex items-center justify-center gap-2 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg border border-emerald-500/30 transition-all text-sm font-medium"
                  >
                    <Plus size={16} />
                    {language === 'ru' ? 'Создать заметку из ответа' : 'Create note from response'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Модальное окно справки */}
      <AnimatePresence>
        {isHelpModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHelpModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "relative w-full max-w-4xl max-h-[85vh] glass-panel rounded-2xl overflow-hidden flex flex-col",
                theme.colorScheme === 'light' ? "bg-white/80 text-zinc-900" : "bg-zinc-900/80 text-white"
              )}
              style={{ backgroundColor: `rgba(${theme.colorScheme === 'light' ? '255, 255, 255' : '9, 9, 11'}, ${theme.panelTransparency})` }}
            >
              <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between bg-zinc-900/80">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <HelpCircle className="text-blue-400" />
                  {language === 'ru' ? 'Справка по приложению' : 'App Help'}
                </h2>
                <button 
                  onClick={() => setIsHelpModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-zinc-950/40">
                <div className="markdown-body prose prose-invert max-w-none">
                  <Markdown>{helpContent}</Markdown>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
