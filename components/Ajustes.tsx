
import React, { useState, useEffect, useRef } from 'react';
import type { TallerInfo } from '../types';
import { supabase } from '../supabaseClient';
import { ArrowRightOnRectangleIcon, BuildingOffice2Icon, PhotoIcon, ArrowUpOnSquareIcon, PaintBrushIcon, DevicePhoneMobileIcon, SunIcon, MoonIcon, ComputerDesktopIcon, DocumentTextIcon, SparklesIcon, CheckCircleIcon, ExclamationTriangleIcon, KeyIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';
import ChangePasswordModal from './ChangePasswordModal';

interface AjustesProps {
    tallerInfo: TallerInfo;
    onUpdateTallerInfo: (newInfo: TallerInfo) => Promise<void>;
    onLogout: () => void;
    searchQuery: string;
}

type Theme = 'light' | 'dark' | 'system';

const Ajustes: React.FC<AjustesProps> = ({ tallerInfo, onUpdateTallerInfo, onLogout, searchQuery }) => {
    const [formData, setFormData] = useState<TallerInfo>(tallerInfo);
    const [isSaved, setIsSaved] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [geminiStatus, setGeminiStatus] = useState<'checking' | 'active' | 'inactive'>('checking');
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

    useEffect(() => {
        setFormData(tallerInfo);
    }, [tallerInfo]);

    useEffect(() => {
        const key = localStorage.getItem('gemini_api_key');
        setGeminiApiKey(key || '');
        setGeminiStatus(key ? 'active' : 'inactive');
    }, []);

    const handleSaveApiKey = () => {
        if (geminiApiKey.trim()) {
            localStorage.setItem('gemini_api_key', geminiApiKey.trim());
            setGeminiStatus('active');
        } else {
            handleDeleteApiKey();
        }
    };

    const handleDeleteApiKey = () => {
        localStorage.removeItem('gemini_api_key');
        setGeminiApiKey('');
        setGeminiStatus('inactive');
    };
    
    const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
        if (newTheme === 'system') {
            localStorage.removeItem('theme');
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        } else {
            localStorage.setItem('theme', newTheme);
            if (newTheme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value } as TallerInfo));
        setIsSaved(false);
    };

    const handleTemplateChange = (template: 'classic' | 'modern') => {
        setFormData(prev => ({ ...prev, pdfTemplate: template }));
        setIsSaved(false);
    };

    const handleNavStyleChange = (style: 'sidebar' | 'bottom_nav') => {
        setFormData(prev => ({ ...prev, mobileNavStyle: style }));
        setIsSaved(false);
    };

    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) {
            return;
        }

        const file = event.target.files[0];
        const filePath = `public/${Date.now()}-${file.name}`;
        
        setIsUploading(true);
        try {
            const { error: uploadError } = await supabase.storage
                .from('logos')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage
                .from('logos')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, logoUrl: data.publicUrl }));
            setIsSaved(false);

        } catch (error) {
            console.error('Error uploading logo:', error);
            alert('Error al subir el logo. Por favor, inténtelo de nuevo.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        await onUpdateTallerInfo(formData);
        setIsSubmitting(false);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000); 
    };
    
    const ThemeButton = ({ value, currentTheme, onClick, icon: Icon, label }: { value: Theme, currentTheme: Theme, onClick: (theme: Theme) => void, icon: React.ElementType, label: string }) => (
        <button
            type="button"
            onClick={() => onClick(value)}
            className={`w-full flex flex-col items-center gap-2 rounded-md py-3 text-sm font-medium transition-colors ${
                currentTheme === value
                    ? 'bg-taller-primary text-white shadow'
                    : 'text-taller-gray dark:text-gray-300 bg-taller-light dark:bg-gray-700 hover:bg-white dark:hover:bg-gray-600'
            }`}
        >
            <Icon className="h-6 w-6" />
            <span>{label}</span>
        </button>
    );

    // Filter Logic
    const shouldShow = (keywords: string[]) => {
        if (!searchQuery) return true;
        return keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
    };

    return (
        <>
            <div className="space-y-8 pb-16 max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-taller-dark dark:text-taller-light">Ajustes del Taller</h2>
                
                <form onSubmit={handleSubmit} className="space-y-8">
                    
                    {shouldShow(['datos', 'nombre', 'telefono', 'direccion', 'cuit', 'logo']) && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                            <h3 className="text-lg font-bold mb-6 flex items-center"><BuildingOffice2Icon className="h-6 w-6 mr-2 text-taller-primary"/>Datos del Taller</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-1 flex flex-col items-center">
                                        <label className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-2">Logo del Taller</label>
                                        <input
                                            type="file"
                                            accept="image/png, image/jpeg, image/webp"
                                            ref={fileInputRef}
                                            onChange={handleLogoUpload}
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="relative w-32 h-32 bg-taller-light dark:bg-gray-700 rounded-full flex items-center justify-center text-taller-gray dark:text-gray-400 border-2 border-dashed dark:border-gray-600 hover:border-taller-primary transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary"
                                        >
                                            {isUploading && (
                                                <div className="absolute inset-0 bg-white/70 dark:bg-gray-800/70 flex items-center justify-center rounded-full">
                                                    <svg className="animate-spin h-8 w-8 text-taller-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                </div>
                                            )}
                                            {formData.logoUrl ? (
                                                <img src={formData.logoUrl} alt="Logo del Taller" className="w-full h-full object-cover rounded-full"/>
                                            ) : (
                                                <PhotoIcon className="h-12 w-12"/>
                                            )}
                                            <div className="absolute -bottom-1 -right-1 p-1.5 bg-taller-primary rounded-full text-white shadow-md">
                                                <ArrowUpOnSquareIcon className="h-4 w-4"/>
                                            </div>
                                        </button>
                                    </div>
                                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div>
                                            <label htmlFor="nombre" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Nombre del Taller</label>
                                            <input type="text" id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                                        </div>
                                        <div>
                                            <label htmlFor="telefono" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Teléfono</label>
                                            <input type="tel" id="telefono" name="telefono" value={formData.telefono} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label htmlFor="direccion" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Dirección</label>
                                            <input type="text" id="direccion" name="direccion" value={formData.direccion} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label htmlFor="cuit" className="block text-sm font-medium text-taller-gray dark:text-gray-400">CUIT</label>
                                            <input type="text" id="cuit" name="cuit" value={formData.cuit} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {shouldShow(['ia', 'inteligencia', 'artificial', 'gemini', 'api']) && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                            <h3 className="text-lg font-bold mb-2 flex items-center"><SparklesIcon className="h-6 w-6 mr-2 text-taller-primary"/>Integración con IA (Gemini)</h3>
                            <p className="text-sm text-taller-gray dark:text-gray-400 mb-4">
                                Usa la cámara para escanear y rellenar datos del vehículo automáticamente. Ingresa tu API Key de Google AI Studio para activar esta función.
                                {geminiStatus !== 'active' && (
                                     <>
                                        {' '}
                                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-taller-primary hover:underline font-medium inline-flex items-center gap-1">
                                            Obtén tu API Key gratis aquí <ArrowTopRightOnSquareIcon className="h-3 w-3"/>
                                        </a>
                                    </>
                                )}
                            </p>
                            <div className="space-y-2">
                                <label htmlFor="gemini-api-key" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Tu API Key de Gemini</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="password"
                                        id="gemini-api-key"
                                        value={geminiApiKey}
                                        onChange={(e) => setGeminiApiKey(e.target.value)}
                                        onFocus={(e) => e.target.type = 'text'}
                                        onBlur={(e) => e.target.type = 'password'}
                                        placeholder="Ingresa tu API Key"
                                        className="flex-grow mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSaveApiKey}
                                        className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </div>
                            {geminiStatus === 'active' && (
                                <div className="mt-4 flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                        <CheckCircleIcon className="h-5 w-5"/>
                                        API Key activa.
                                    </span>
                                    <button type="button" onClick={handleDeleteApiKey} className="text-sm font-medium text-red-600 hover:underline">Eliminar Clave</button>
                                </div>
                            )}
                            {geminiStatus === 'inactive' && (
                                <div className="mt-4 flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                                    <ExclamationTriangleIcon className="h-5 w-5"/>
                                    API Key no configurada. La función de escaneo está desactivada.
                                </div>
                            )}
                        </div>
                    )}

                    {shouldShow(['apariencia', 'tema', 'oscuro', 'claro']) && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                            <h3 className="text-lg font-bold mb-4 flex items-center"><PaintBrushIcon className="h-6 w-6 mr-2 text-taller-primary"/>Apariencia</h3>
                            <div>
                                <label className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-2">Tema de la aplicación</label>
                                <div className="grid grid-cols-3 gap-2 rounded-lg bg-taller-light dark:bg-gray-900/50 p-1">
                                <ThemeButton value="light" currentTheme={theme} onClick={handleThemeChange} icon={SunIcon} label="Claro" />
                                <ThemeButton value="dark" currentTheme={theme} onClick={handleThemeChange} icon={MoonIcon} label="Oscuro" />
                                <ThemeButton value="system" currentTheme={theme} onClick={handleThemeChange} icon={ComputerDesktopIcon} label="Sistema" />
                                </div>
                            </div>
                        </div>
                    )}

                    {shouldShow(['documentos', 'pdf', 'plantilla', 'logo']) && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                            <h3 className="text-lg font-bold mb-6 flex items-center"><DocumentTextIcon className="h-6 w-6 mr-2 text-taller-primary"/>Plantillas de Documentos</h3>
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <label htmlFor="showLogoOnPdf" className="font-medium text-taller-dark dark:text-taller-light">
                                        Mostrar logo en PDF
                                    </label>
                                    <p className="text-sm text-taller-gray dark:text-gray-400">
                                        Incluye el logo de tu taller en los presupuestos y remitos.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    id="showLogoOnPdf"
                                    onClick={() => {
                                        setFormData(prev => ({ ...prev, showLogoOnPdf: !prev.showLogoOnPdf }));
                                        setIsSaved(false);
                                    }}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-taller-primary focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                                        formData.showLogoOnPdf ? 'bg-taller-primary' : 'bg-gray-200 dark:bg-gray-600'
                                    }`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                            formData.showLogoOnPdf ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    )}

                    {shouldShow(['movil', 'celular', 'navegacion', 'barra']) && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                            <h3 className="text-lg font-bold mb-4 flex items-center"><DevicePhoneMobileIcon className="h-6 w-6 mr-2 text-taller-primary"/>Interfaz Móvil</h3>
                            <div>
                                <label className="block text-sm font-medium text-taller-gray dark:text-gray-400 mb-2">Estilo de Navegación</label>
                                <div className="flex space-x-2 rounded-lg bg-taller-light dark:bg-gray-700/50 p-1">
                                    <button
                                        type="button"
                                        onClick={() => handleNavStyleChange('sidebar')}
                                        className={`w-full rounded-md py-2 text-sm font-medium transition-colors ${formData.mobileNavStyle === 'sidebar' ? 'bg-taller-primary text-white shadow' : 'text-taller-gray dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600'}`}
                                    >
                                        Menú Lateral
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleNavStyleChange('bottom_nav')}
                                        className={`w-full rounded-md py-2 text-sm font-medium transition-colors ${formData.mobileNavStyle === 'bottom_nav' ? 'bg-taller-primary text-white shadow' : 'text-taller-gray dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600'}`}
                                    >
                                        Barra Inferior
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex items-center justify-end">
                        {isSaved && <span className="text-sm text-green-600 mr-4">¡Guardado con éxito!</span>}
                        <button type="submit" disabled={isSubmitting || isUploading} className="flex justify-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary disabled:opacity-50">
                            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>

                {shouldShow(['cuenta', 'contraseña', 'salir', 'password']) && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md mt-8">
                        <h3 className="text-lg font-bold mb-4">Acciones de Cuenta</h3>
                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => setIsChangePasswordModalOpen(true)}
                                className="flex-1 justify-center flex items-center space-x-2 px-4 py-2 text-sm font-medium text-taller-secondary bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-secondary dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900"
                            >
                                <KeyIcon className="h-5 w-5" />
                                <span className="whitespace-nowrap">Cambiar Contraseña</span>
                            </button>
                            <button
                                onClick={onLogout}
                                className="flex-1 justify-center flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900"
                            >
                                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                                <span className="whitespace-nowrap">Salir de la Cuenta</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {isChangePasswordModalOpen && <ChangePasswordModal onClose={() => setIsChangePasswordModalOpen(false)} />}
        </>
    );
};

export default Ajustes;
