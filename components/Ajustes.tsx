
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { TallerInfo } from '../types';
import { supabase } from '../supabaseClient';
import { 
    BuildingOffice2Icon, 
    PhotoIcon, 
    ArrowUpOnSquareIcon, 
    PaintBrushIcon, 
    SunIcon, 
    MoonIcon, 
    ComputerDesktopIcon, 
    DocumentTextIcon, 
    CheckCircleIcon, 
    ExclamationTriangleIcon, 
    KeyIcon, 
    ArrowRightOnRectangleIcon, 
    MagnifyingGlassPlusIcon, 
    ArrowPathIcon,
    SparklesIcon,
    ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/solid';
import ChangePasswordModal from './ChangePasswordModal';
import { applyAppTheme, applyFontSize, applyThemeClass } from '../constants';

interface AjustesProps {
    tallerInfo: TallerInfo;
    onUpdateTallerInfo: (newInfo: TallerInfo) => Promise<void>;
    onLogout: () => void;
    searchQuery: string;
}

type Theme = 'light' | 'dark' | 'system';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const HEADER_COLORS = [
    { name: 'Gris Ejecutivo', value: '#334155', bg: 'bg-slate-700' }, 
    { name: 'Azul Marino', value: '#1e3a8a', bg: 'bg-blue-900' },     
    { name: 'Verde Bosque', value: '#14532d', bg: 'bg-green-900' },   
    { name: 'Borggoña', value: '#7f1d1d', bg: 'bg-red-900' },         
    { name: 'Carbón', value: '#18181b', bg: 'bg-zinc-900' },          
    { name: 'Bronce', value: '#78350f', bg: 'bg-amber-900' },         
];

const FloatingStatus = ({ status }: { status: SaveStatus }) => {
    if (status === 'idle') return null;

    const baseClasses = "fixed top-24 right-4 md:top-24 md:right-8 z-[9999] flex items-center gap-2 px-4 py-2 rounded-full shadow-xl font-bold text-sm transition-all duration-300 transform translate-y-0 opacity-100 animate-in slide-in-from-top-4 fade-in border border-white/20 backdrop-blur-sm";
    
    let content = null;

    if (status === 'saving') {
        content = (
            <div className={`${baseClasses} bg-blue-600/90 text-white shadow-blue-500/30`}>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                <span>Guardando...</span>
            </div>
        );
    } else if (status === 'saved') {
        content = (
            <div className={`${baseClasses} bg-green-600/90 text-white shadow-green-500/30`}>
                <CheckCircleIcon className="h-5 w-5" />
                <span>Guardado</span>
            </div>
        );
    } else if (status === 'error') {
        content = (
            <div className={`${baseClasses} bg-red-600/90 text-white shadow-red-500/30`}>
                <ExclamationTriangleIcon className="h-5 w-5" />
                <span>Error al guardar</span>
            </div>
        );
    }

    return createPortal(content, document.body);
};

const Ajustes: React.FC<AjustesProps> = ({ tallerInfo, onUpdateTallerInfo, onLogout, searchQuery }) => {
    const [formData, setFormData] = useState<TallerInfo>(tallerInfo);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [lastSavedData, setLastSavedData] = useState<string>(JSON.stringify(tallerInfo));
    const isFirstRender = useRef(true);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onUpdateTallerInfoRef = useRef(onUpdateTallerInfo);

    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
    
    const [hasApiKey, setHasApiKey] = useState(false);

    useEffect(() => {
        const checkApiKey = async () => {
            const result = await window.aistudio.hasSelectedApiKey();
            setHasApiKey(result);
        };
        checkApiKey();
    }, []);

    const handleSelectKey = async () => {
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
    };

    // Sincronización automática con el sistema cuando el tema es 'system'
    useEffect(() => {
        if (theme !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const listener = () => applyThemeClass();
        
        mediaQuery.addEventListener('change', listener);
        applyThemeClass(); // Asegura estado inicial correcto

        return () => mediaQuery.removeEventListener('change', listener);
    }, [theme]);

    useEffect(() => {
        onUpdateTallerInfoRef.current = onUpdateTallerInfo;
    }, [onUpdateTallerInfo]);

    useEffect(() => {
        const incomingStr = JSON.stringify(tallerInfo);
        if (incomingStr !== lastSavedData) {
            setFormData(tallerInfo);
            setLastSavedData(incomingStr);
        }
        applyAppTheme();
        if (tallerInfo.fontSize) applyFontSize(tallerInfo.fontSize as any);
    }, [tallerInfo, lastSavedData]); 

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const currentDataStr = JSON.stringify(formData);
        if (currentDataStr === lastSavedData) return;

        setSaveStatus('idle');
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(async () => {
            setSaveStatus('saving');
            try {
                await onUpdateTallerInfoRef.current(formData);
                setLastSavedData(currentDataStr);
                setSaveStatus('saved');
                if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
                statusTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (error) {
                console.error("Autosave error:", error);
                setSaveStatus('error');
            }
        }, 1000);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [formData, lastSavedData]); 

    const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
        if (newTheme === 'system') {
            localStorage.removeItem('theme');
        } else {
            localStorage.setItem('theme', newTheme);
        }
        applyThemeClass();
    };
    
    const handleFontSizeChange = (size: 'small' | 'normal' | 'large') => {
        applyFontSize(size);
        setFormData(prev => ({ ...prev, fontSize: size }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value } as TallerInfo));
    };

    const handleColorChange = (color: string) => {
        setFormData(prev => ({ ...prev, headerColor: color }));
    };

    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;
        const file = event.target.files[0];
        const filePath = `public/${Date.now()}-${file.name}`;
        setIsUploading(true);
        try {
            const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('logos').getPublicUrl(filePath);
            setFormData(prev => ({ ...prev, logoUrl: data.publicUrl }));
        } catch (error) {
            console.error('Error uploading logo:', error);
            alert('Error al subir el logo.');
        } finally {
            setIsUploading(false);
        }
    };
    
    const ThemeButton = ({ value, currentTheme, onClick, icon: Icon, label }: { value: Theme, currentTheme: Theme, onClick: (theme: Theme) => void, icon: React.ElementType, label: string }) => (
        <button
            type="button"
            onClick={() => onClick(value)}
            className={`w-full flex flex-col items-center gap-2 rounded-md py-3 text-sm font-medium transition-colors ${
                currentTheme === value
                    ? 'bg-taller-primary text-white shadow-md'
                    : 'text-taller-gray dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 hover:bg-gray-50'
            }`}
        >
            <Icon className="h-6 w-6" />
            <span>{label}</span>
        </button>
    );

    const shouldShow = (keywords: string[]) => {
        if (!searchQuery) return true;
        return keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
    };

    const PdfPreview = () => {
        const primaryColor = formData.headerColor || '#334155';
        return (
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden shadow-lg bg-white w-full max-w-[300px] mx-auto aspect-[1/1.41] flex flex-col text-[6px] text-gray-800 relative select-none pointer-events-none">
                <div style={{ backgroundColor: primaryColor }} className="w-full h-[15%] flex items-center px-2 text-white">
                     {formData.showLogoOnPdf && formData.logoUrl && (
                        <div className="w-8 h-8 bg-white/20 mr-2 rounded flex items-center justify-center overflow-hidden">
                            <img src={formData.logoUrl} alt="logo" className="w-full h-full object-contain" />
                        </div>
                    )}
                    <div>
                        <div className="font-bold text-[8px]">{formData.nombre || 'Nombre Taller'}</div>
                        <div className="opacity-80 leading-tight mt-0.5">{formData.direccion || 'Dirección'}</div>
                        <div className="opacity-80 leading-tight">Tel: {formData.telefono || '...'}</div>
                    </div>
                </div>
                <div className="p-2 flex-1">
                    <div className="flex justify-end mb-2">
                        <div className="text-right">
                            <div className="font-bold text-[8px]">PRESUPUESTO</div>
                            <div>N°: 000001</div>
                            <div>Fecha: 01/01/2024</div>
                        </div>
                    </div>
                    <div className="bg-gray-100 p-1 mb-2 rounded">
                        <div className="font-bold">Cliente: Juan Perez</div>
                        <div>Vehículo: Ford Focus (AB123CD)</div>
                    </div>
                    <div className="mb-2">
                        <div className="font-bold mb-0.5">Descripción:</div>
                        <div className="text-[5px] text-gray-500">Service completo de 10.000km...</div>
                    </div>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr style={{ backgroundColor: primaryColor }} className="text-white">
                                <th className="p-0.5 rounded-l-sm">Cant</th>
                                <th className="p-0.5">Desc</th>
                                <th className="p-0.5 rounded-r-sm text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-gray-100">
                                <td className="p-0.5">1</td>
                                <td className="p-0.5">Aceite 5w30</td>
                                <td className="p-0.5 text-right">$ 15.000</td>
                            </tr>
                        </tbody>
                    </table>
                     <div className="mt-4 flex justify-end">
                        <div className="w-1/2 text-right space-y-0.5">
                            <div className="flex justify-between border-b border-gray-200 pb-0.5">
                                <span>Subtotal:</span>
                                <span>$ 23.000</span>
                            </div>
                            <div className="flex justify-between font-bold text-[7px]" style={{ color: primaryColor }}>
                                <span>TOTAL:</span>
                                <span>$ 23.000</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-auto p-1 text-center text-gray-400 text-[5px] border-t border-gray-100">
                    Gracias por su confianza
                </div>
                <div className="absolute inset-0 ring-1 ring-black/5 rounded-lg"></div>
            </div>
        );
    };

    return (
        <>
            <FloatingStatus status={saveStatus} />
            <div className="space-y-8 pb-32 max-w-5xl mx-auto">
                <div className="flex justify-between items-center px-4 md:px-0">
                    <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light">Ajustes del Taller</h2>
                </div>
                
                <form className="space-y-8 px-4 md:px-0" onSubmit={(e) => e.preventDefault()}>
                    {shouldShow(['datos', 'nombre', 'telefono', 'direccion', 'cuit', 'logo']) && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md transition-shadow hover:shadow-lg">
                            <h3 className="text-lg font-bold mb-6 flex items-center"><BuildingOffice2Icon className="h-6 w-6 mr-2 text-taller-primary"/>Datos del Taller</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-1 flex flex-col items-center">
                                        <label className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-2">Logo del Taller</label>
                                        <input type="file" accept="image/png, image/jpeg, image/webp" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" />
                                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="relative w-32 h-32 bg-taller-light dark:bg-gray-700 rounded-full flex items-center justify-center text-taller-gray dark:text-gray-400 border-2 border-dashed dark:border-gray-600 hover:border-taller-primary transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary">
                                            {isUploading && (
                                                <div className="absolute inset-0 bg-white/70 dark:bg-gray-800/70 flex items-center justify-center rounded-full">
                                                    <svg className="animate-spin h-8 w-8 text-taller-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                </div>
                                            )}
                                            {formData.logoUrl ? <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-full"/> : <PhotoIcon className="h-12 w-12"/>}
                                            <div className="absolute -bottom-1 -right-1 p-1.5 bg-taller-primary rounded-full text-white shadow-md"><ArrowUpOnSquareIcon className="h-4 w-4"/></div>
                                        </button>
                                    </div>
                                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div><label htmlFor="nombre" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Nombre</label><input type="text" id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/></div>
                                        <div><label htmlFor="telefono" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Teléfono</label><input type="tel" id="telefono" name="telefono" value={formData.telefono} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/></div>
                                        <div className="sm:col-span-2"><label htmlFor="direccion" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Dirección</label><input type="text" id="direccion" name="direccion" value={formData.direccion} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/></div>
                                        <div>
                                            <label htmlFor="cuit" className="block text-sm font-medium text-taller-gray dark:text-gray-400">CUIT</label>
                                            <input type="text" id="cuit" name="cuit" value={formData.cuit} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                                            <div className="flex items-center mt-3">
                                                <input id="showCuitOnPdf" name="showCuitOnPdf" type="checkbox" checked={formData.showCuitOnPdf !== false} onChange={(e) => setFormData(prev => ({ ...prev, showCuitOnPdf: e.target.checked }))} className="h-4 w-4 text-taller-primary focus:ring-taller-primary border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700" />
                                                <label htmlFor="showCuitOnPdf" className="ml-2 block text-sm text-taller-gray dark:text-gray-400">Mostrar en PDFs</label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {shouldShow(['documentos', 'pdf', 'plantilla', 'logo', 'color', 'diseño']) && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md transition-shadow hover:shadow-lg">
                            <h3 className="text-lg font-bold mb-6 flex items-center"><DocumentTextIcon className="h-6 w-6 mr-2 text-taller-primary"/>Plantillas de Documentos</h3>
                            <div className="flex flex-col lg:flex-row gap-8">
                                <div className="flex-1 space-y-6">
                                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <div className="flex flex-col">
                                            <label htmlFor="showLogoOnPdf" className="font-bold text-taller-dark dark:text-taller-light">Mostrar logo</label>
                                            <p className="text-xs text-taller-gray dark:text-gray-400">Incluye el logo en la cabecera.</p>
                                        </div>
                                        <button type="button" id="showLogoOnPdf" onClick={() => setFormData(prev => ({ ...prev, showLogoOnPdf: !prev.showLogoOnPdf }))} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-taller-primary focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${formData.showLogoOnPdf ? 'bg-taller-primary' : 'bg-gray-200 dark:bg-gray-600'}`}>
                                            <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.showLogoOnPdf ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-3">Color de Cabecera (PDF)</label>
                                        <div className="grid grid-cols-6 gap-2">
                                            {HEADER_COLORS.map((color) => (
                                                <button key={color.value} type="button" onClick={() => handleColorChange(color.value)} className={`w-full aspect-square rounded-full shadow-sm flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary ${color.bg} ${(formData.headerColor || '#334155') === color.value ? 'ring-2 ring-offset-2 ring-taller-primary scale-110' : ''}`} title={color.name}>
                                                    {(formData.headerColor || '#334155') === color.value && <CheckCircleIcon className="h-5 w-5 text-white" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col items-center">
                                    <span className="text-sm font-medium text-taller-gray dark:text-gray-400 mb-2">Vista Previa</span>
                                    <PdfPreview />
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {shouldShow(['apariencia', 'tema', 'oscuro', 'claro', 'fuente', 'texto']) && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md transition-shadow hover:shadow-lg">
                            <h3 className="text-lg font-bold mb-4 flex items-center"><PaintBrushIcon className="h-6 w-6 mr-2 text-taller-primary"/>Apariencia de la App</h3>
                            <div className="space-y-8">
                                <div>
                                    <label className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-3">Modo Visual</label>
                                    <div className="grid grid-cols-3 gap-3 bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-xl border dark:border-gray-700">
                                        <ThemeButton value="light" currentTheme={theme} onClick={handleThemeChange} icon={SunIcon} label="Claro" />
                                        <ThemeButton value="dark" currentTheme={theme} onClick={handleThemeChange} icon={MoonIcon} label="Oscuro" />
                                        <ThemeButton value="system" currentTheme={theme} onClick={handleThemeChange} icon={ComputerDesktopIcon} label="Auto" />
                                    </div>
                                    <p className="text-[10px] text-taller-gray dark:text-gray-500 mt-2 italic px-1">
                                        * El modo 'Auto' sincroniza la aplicación con el tema configurado en los ajustes de tu dispositivo.
                                    </p>
                                </div>

                                <div className="border-t dark:border-gray-700 pt-6">
                                    <label className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-3 flex items-center gap-2"><MagnifyingGlassPlusIcon className="h-5 w-5"/> Tamaño de Fuente</label>
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 p-1 rounded-lg flex flex-wrap gap-1">
                                            {['small', 'normal', 'large'].map((opt) => (
                                                <button key={opt} type="button" onClick={() => handleFontSizeChange(opt as any)} className={`flex-1 min-w-[80px] py-2 px-4 rounded-md transition-all ${(formData.fontSize || 'normal') === opt ? 'bg-white dark:bg-gray-600 text-taller-primary shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-taller-dark'}`}>
                                                    <span className="text-sm font-medium capitalize">{opt === 'small' ? 'Pequeño' : opt === 'normal' ? 'Normal' : 'Grande'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {shouldShow(['ia', 'gemini', 'clave', 'api', 'scanner', 'escaner']) && (
                        <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-gray-800 dark:to-gray-900 p-6 rounded-xl shadow-md border-2 border-indigo-100 dark:border-indigo-900/30 transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold flex items-center text-indigo-900 dark:text-indigo-100">
                                    <SparklesIcon className="h-6 w-6 mr-2 text-indigo-600 animate-pulse"/>
                                    Inteligencia Artificial (Gemini)
                                </h3>
                                {hasApiKey ? (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full uppercase tracking-wider">
                                        <CheckCircleIcon className="h-3 w-3" /> Activo
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full uppercase tracking-wider">
                                        <ExclamationTriangleIcon className="h-3 w-3" /> Pendiente
                                    </span>
                                )}
                            </div>
                            
                            <p className="text-sm text-taller-gray dark:text-gray-400 mb-6">
                                La IA permite el <strong>Escaner de Cédulas</strong> para cargar vehículos automáticamente. Para activarla, selecciona tu propia clave de API.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <button 
                                    type="button"
                                    onClick={handleSelectKey}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95"
                                >
                                    <KeyIcon className="h-5 w-5" />
                                    {hasApiKey ? 'Actualizar Clave API' : 'Configurar Clave API'}
                                </button>
                                
                                <a 
                                    href="https://ai.google.dev/gemini-api/docs/billing" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-taller-gray dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                                >
                                    <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                                    Obtener Clave Gemini
                                </a>
                            </div>

                            <p className="mt-4 text-[10px] text-center text-taller-gray opacity-60">
                                Por seguridad, la clave se gestiona directamente a través del selector de Google AI Studio.
                            </p>
                        </div>
                    )}
                </form>

                {shouldShow(['cuenta', 'salir']) && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md mt-8 mx-4 md:mx-0">
                        <div className="flex flex-wrap gap-4">
                            <button onClick={() => setIsChangePasswordModalOpen(true)} className="flex-1 justify-center flex items-center space-x-2 px-4 py-2 text-sm font-medium text-taller-secondary bg-blue-100 rounded-lg dark:bg-blue-900/50 dark:text-blue-300"><KeyIcon className="h-5 w-5" /><span>Contraseña</span></button>
                            <button onClick={onLogout} className="flex-1 justify-center flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg dark:bg-red-900/50 dark:text-red-300"><ArrowRightOnRectangleIcon className="h-5 w-5" /><span>Salir</span></button>
                        </div>
                    </div>
                )}
            </div>
            {isChangePasswordModalOpen && <ChangePasswordModal onClose={() => setIsChangePasswordModalOpen(false)} />}
        </>
    );
};

export default Ajustes;
