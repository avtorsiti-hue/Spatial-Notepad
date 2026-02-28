import { useState, useEffect } from 'react';
import { ReactFlow, Background, Controls, useReactFlow, BackgroundVariant, SelectionMode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, AppWindow } from 'lucide-react';

import { useStore } from '@/store/useStore';
import GlassNode from '@/components/flow/GlassNode';
import FloatingMenu from '@/components/FloatingMenu';
import { cn } from '@/lib/utils';

const nodeTypes = {
  glass: GlassNode,
};

export default function SpatialCanvas() {
  const [isCtrlActive, setIsCtrlActive] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const { 
    nodes, edges, onNodesChange, onEdgesChange, onConnect, 
    theme, gridEnabled, snapToGrid, loadFromStorage, customFonts,
    addNode, language, isReadingMode, setSystemFonts
  } = useStore();
  const { screenToFlowPosition, setCenter } = useReactFlow();
  
  // Загрузка сохраненного состояния при монтировании
  useEffect(() => {
    loadFromStorage();

    // Определение системных шрифтов
    const detectFonts = async () => {
      try {
        // Пробуем современный API
        if ('queryLocalFonts' in window) {
          // @ts-ignore
          const localFonts = await window.queryLocalFonts();
          const fontNames = Array.from(new Set(localFonts.map((f: any) => f.family))).sort() as string[];
          setSystemFonts(fontNames);
        } else {
          // Фолбек: список распространенных шрифтов для проверки
          const commonFonts = [
            'Arial', 'Verdana', 'Helvetica', 'Tahoma', 'Trebuchet MS', 'Times New Roman', 
            'Georgia', 'Garamond', 'Courier New', 'Brush Script MT', 'Inter', 'JetBrains Mono',
            'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Playfair Display', 'Oswald'
          ];
          
          const availableFonts: string[] = [];
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (context) {
            const text = "abcdefghijklmnopqrstuvwxyz0123456789";
            context.font = "72px monospace";
            const baselineWidth = context.measureText(text).width;
            
            commonFonts.forEach(font => {
              context.font = `72px "${font}", monospace`;
              if (context.measureText(text).width !== baselineWidth) {
                availableFonts.push(font);
              }
            });
          }
          setSystemFonts(availableFonts.length > 0 ? availableFonts : ['Arial', 'Verdana', 'Times New Roman', 'Courier New']);
        }
      } catch (e) {
        console.error("Error detecting fonts:", e);
        setSystemFonts(['Arial', 'Verdana', 'Times New Roman', 'Courier New']);
      }
    };

    detectFonts();

    // Проверка режима standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Загрузка пользовательских шрифтов в документ
  useEffect(() => {
    customFonts.forEach(font => {
      const fontFace = new FontFace(font.name, `url(${font.data})`);
      fontFace.load().then(loadedFace => {
        document.fonts.add(loadedFace);
      }).catch(err => console.error("Ошибка загрузки шрифта:", font.name, err));
    });
  }, [customFonts]);

  const handleQuickAdd = () => {
    const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const newPos = { x: pos.x - 125, y: pos.y - 175 };
    addNode('glass', newPos);
    setTimeout(() => {
      setCenter(newPos.x + 125, newPos.y + 175, { zoom: 1, duration: 800 });
    }, 50);
  };

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      // Если промпт не пойман, значит приложение уже установлено или браузер не поддерживает PWA
      alert(language === 'ru' ? 'Приложение уже установлено или не поддерживается вашим браузером' : 'App is already installed or not supported by your browser');
      return;
    }
    // Show the prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
  };

  const themeVars = {
    '--accent-color': theme.accentColor,
    '--accent-glow': `${theme.accentColor}80`,
    '--accent-glow-subtle': `${theme.accentColor}33`,
    '--panel-bg': theme.themeBrightness > 0.5 
      ? `rgba(255, 255, 255, ${theme.panelTransparency})` 
      : `rgba(24, 24, 27, ${theme.panelTransparency})`,
    '--text-color': theme.themeBrightness > 0.5 ? '#18181b' : '#f4f4f5',
    '--border-color': theme.themeBrightness > 0.5 ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
  } as React.CSSProperties;

  return (
    <div 
      className={cn(
        "w-screen h-screen relative overflow-hidden transition-colors duration-700",
        theme.themeBrightness > 0.5 ? "bg-zinc-50 text-zinc-900" : "text-white"
      )} 
      style={{ 
        background: theme.background,
        fontFamily: theme.interfaceFont,
        ...themeVars
      }}
    >
      {/* Фоновое изображение */}
      {theme.backgroundImage && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-50 pointer-events-none"
          style={{ backgroundImage: `url(${theme.backgroundImage})` }}
        />
      )}

      {/* HTML Фон */}
      {theme.backgroundHtml && (
        <iframe 
          srcDoc={theme.backgroundHtml}
          className="absolute inset-0 w-full h-full border-none opacity-50 pointer-events-none"
          title="Background HTML"
        />
      )}

      {/* Эффекты фонового свечения (тема Obsidian) */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

      {/* Основной холст React Flow */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        snapToGrid={snapToGrid}
        snapGrid={[20, 20]}
        fitView
        className="touch-none"
        minZoom={0.1}
        maxZoom={4}
        selectionOnDrag={isCtrlActive}
        panOnDrag={!isCtrlActive}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode={isCtrlActive ? null : 'Control'}
        deleteKeyCode={['Backspace', 'Delete']}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#52525b', strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        {/* Сетка фона */}
        {gridEnabled && <Background color="#ffffff" gap={20} size={1} variant={BackgroundVariant.Dots} className="opacity-10" />}
      </ReactFlow>

      {/* Кнопка CTRL в левом нижнем углу */}
      {!isReadingMode && (
        <div className="fixed bottom-4 left-4 md:bottom-8 md:left-8 z-50 flex flex-col gap-3">
          <button
            onClick={() => setIsCtrlActive(!isCtrlActive)}
            className={cn(
              "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 border backdrop-blur-md",
              isCtrlActive 
                ? "bg-[var(--accent-color)] text-white border-[var(--accent-color)] scale-110 eclipse-glow" 
                : "bg-zinc-900/60 text-zinc-400 border-white/10 hover:bg-zinc-800/80 hover:text-white shadow-2xl"
            )}
            title={isCtrlActive ? "Selection Mode Active" : "Enable Selection Mode (CTRL)"}
          >
            CTRL
          </button>
        </div>
      )}

      {/* Кнопка "Добавить приложение" в левом верхнем углу */}
      {!isReadingMode && !isStandalone && deferredPrompt && (
        <div className="fixed top-4 left-4 md:top-6 md:left-6 z-50">
          <button
            onClick={handleInstallApp}
            className="px-3 py-1.5 rounded-md border border-blue-500/40 bg-blue-500/5 text-blue-400/80 font-bold text-[10px] md:text-xs uppercase tracking-wider animate-blink-glow hover:bg-blue-500/20 transition-all backdrop-blur-sm"
          >
            {language === 'ru' ? 'Добавить приложение' : 'Add Application'}
          </button>
        </div>
      )}

      {/* Плавающее меню */}
      {!isReadingMode && <FloatingMenu />}
    </div>
  );
}
