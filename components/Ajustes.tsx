import React, { useState, useEffect, useRef } from 'react';
import type { TallerInfo } from './TallerDashboard';
import { supabase } from '../supabaseClient';
import { ArrowRightOnRectangleIcon, BuildingOffice2Icon, PhotoIcon, ArrowUpOnSquareIcon, PaintBrushIcon } from '@heroicons/react/24/solid';

interface AjustesProps {
    tallerInfo: TallerInfo;
    onUpdateTallerInfo: (newInfo: TallerInfo) => Promise<void>;
    onLogout: () => void;
}

const Ajustes: React.FC<AjustesProps> = ({ tallerInfo, onUpdateTallerInfo, onLogout }) => {
    const [formData, setFormData] = useState<TallerInfo>(tallerInfo);
    const [isSaved, setIsSaved] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setFormData(tallerInfo);
    }, [tallerInfo]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value } as TallerInfo));
        setIsSaved(false);
    };

    const handleTemplateChange = (template: 'classic' | 'modern') => {
        setFormData(prev => ({ ...prev, pdfTemplate: template }));
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

    return (
        <div className="space-y-8 pb-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-taller-dark">Ajustes del Taller</h2>
            
            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-bold mb-6 flex items-center"><BuildingOffice2Icon className="h-6 w-6 mr-2 text-taller-primary"/>Datos del Taller</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-1 flex flex-col items-center">
                                <label className="block text-sm font-medium text-taller-gray mb-2">Logo del Taller</label>
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
                                    className="relative w-32 h-32 bg-taller-light rounded-full flex items-center justify-center text-taller-gray border-2 border-dashed hover:border-taller-primary transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary"
                                >
                                    {isUploading && (
                                        <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-full">
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
                                    <label htmlFor="nombre" className="block text-sm font-medium text-taller-gray">Nombre del Taller</label>
                                    <input type="text" id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                                </div>
                                <div>
                                    <label htmlFor="telefono" className="block text-sm font-medium text-taller-gray">Teléfono</label>
                                    <input type="tel" id="telefono" name="telefono" value={formData.telefono} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor="direccion" className="block text-sm font-medium text-taller-gray">Dirección</label>
                                    <input type="text" id="direccion" name="direccion" value={formData.direccion} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor="cuit" className="block text-sm font-medium text-taller-gray">CUIT</label>
                                    <input type="text" id="cuit" name="cuit" value={formData.cuit} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-bold mb-4 flex items-center"><PaintBrushIcon className="h-6 w-6 mr-2 text-taller-primary"/>Diseño de Documentos</h3>
                    <div>
                        <label className="block text-sm font-medium text-taller-gray mb-2">Plantilla de Presupuestos/Recibos</label>
                        <div className="flex space-x-2 rounded-lg bg-taller-light p-1">
                             <button
                                type="button"
                                onClick={() => handleTemplateChange('classic')}
                                className={`w-full rounded-md py-2 text-sm font-medium transition-colors ${formData.pdfTemplate === 'classic' ? 'bg-taller-primary text-white shadow' : 'text-taller-gray hover:bg-white'}`}
                            >
                                Clásico
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTemplateChange('modern')}
                                className={`w-full rounded-md py-2 text-sm font-medium transition-colors ${formData.pdfTemplate === 'modern' ? 'bg-taller-primary text-white shadow' : 'text-taller-gray hover:bg-white'}`}
                            >
                                Moderno
                            </button>
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex items-center justify-end">
                    {isSaved && <span className="text-sm text-green-600 mr-4">¡Guardado con éxito!</span>}
                    <button type="submit" disabled={isSubmitting || isUploading} className="flex justify-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary disabled:opacity-50">
                        {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </form>

            <div className="bg-white p-6 rounded-xl shadow-md">
                 <h3 className="text-lg font-bold mb-4">Acciones de Cuenta</h3>
                 <button
                    onClick={onLogout}
                    className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                    <span>Salir de la Cuenta</span>
                </button>
            </div>
        </div>
    );
};

export default Ajustes;