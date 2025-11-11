import React, { useState, useEffect } from 'react';
import type { TallerInfo } from './TallerDashboard';
import { ArrowRightOnRectangleIcon, BuildingOffice2Icon } from '@heroicons/react/24/solid';

interface AjustesProps {
    tallerInfo: TallerInfo;
    onUpdateTallerInfo: (newInfo: TallerInfo) => Promise<void>;
    onLogout: () => void;
}

const Ajustes: React.FC<AjustesProps> = ({ tallerInfo, onUpdateTallerInfo, onLogout }) => {
    const [formData, setFormData] = useState<TallerInfo>(tallerInfo);
    const [isSaved, setIsSaved] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setFormData(tallerInfo);
    }, [tallerInfo]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setIsSaved(false);
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
            
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-bold mb-6 flex items-center"><BuildingOffice2Icon className="h-6 w-6 mr-2 text-taller-primary"/>Datos del Taller</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="nombre" className="block text-sm font-medium text-taller-gray">Nombre del Taller</label>
                            <input type="text" id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                        </div>
                        <div>
                            <label htmlFor="telefono" className="block text-sm font-medium text-taller-gray">Teléfono</label>
                            <input type="tel" id="telefono" name="telefono" value={formData.telefono} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                        </div>
                         <div>
                            <label htmlFor="direccion" className="block text-sm font-medium text-taller-gray">Dirección</label>
                            <input type="text" id="direccion" name="direccion" value={formData.direccion} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                        </div>
                        <div>
                            <label htmlFor="cuit" className="block text-sm font-medium text-taller-gray">CUIT</label>
                            <input type="text" id="cuit" name="cuit" value={formData.cuit} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="logoUrl" className="block text-sm font-medium text-taller-gray">URL del Logo</label>
                            <input type="url" id="logoUrl" name="logoUrl" value={formData.logoUrl} onChange={handleChange} placeholder="https://ejemplo.com/logo.png" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm"/>
                        </div>
                    </div>
                    <div className="pt-4 flex items-center justify-end">
                        {isSaved && <span className="text-sm text-green-600 mr-4">¡Guardado con éxito!</span>}
                        <button type="submit" disabled={isSubmitting} className="flex justify-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary disabled:opacity-50">
                            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>

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
