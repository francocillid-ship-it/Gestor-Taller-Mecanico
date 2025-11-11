import React, { useState, useMemo } from 'react';
import type { Cliente, Parte } from '../types';
import { JobStatus } from '../types';
import { supabase } from '../supabaseClient';
import { XMarkIcon, PlusCircleIcon, TrashIcon, UserPlusIcon } from '@heroicons/react/24/solid';
import CrearClienteModal from './CrearClienteModal';

interface CrearTrabajoModalProps {
    clientes: Cliente[];
    onClose: () => void;
    onSuccess: () => void;
    onDataRefresh: () => void;
}

const CrearTrabajoModal: React.FC<CrearTrabajoModalProps> = ({ clientes, onClose, onSuccess, onDataRefresh }) => {
    const [selectedClienteId, setSelectedClienteId] = useState('');
    const [selectedVehiculoId, setSelectedVehiculoId] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [partes, setPartes] = useState<Omit<Parte, 'id'>[]>([]);
    const [costoManoDeObra, setCostoManoDeObra] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);

    const vehiculos = useMemo(() => {
        if (!selectedClienteId) return [];
        return clientes.find(c => c.id === selectedClienteId)?.vehiculos || [];
    }, [selectedClienteId, clientes]);
    
    const handleAddParte = () => {
        setPartes([...partes, { nombre: '', cantidad: 1, precioUnitario: 0 }]);
    };
    
    const handleParteChange = (index: number, field: keyof Parte, value: string | number) => {
        const newPartes = [...partes];
        if (field === 'nombre') {
            newPartes[index][field] = value as string;
        } else {
            newPartes[index][field] = Number(value);
        }
        setPartes(newPartes);
    };

    const handleRemoveParte = (index: number) => {
        setPartes(partes.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClienteId || !selectedVehiculoId || !descripcion) {
            setError('Por favor complete todos los campos requeridos.');
            return;
        }
        setIsSubmitting(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const totalPartesCost = partes.reduce((acc, parte) => acc + (parte.cantidad * parte.precioUnitario), 0);
            const manoDeObraCost = parseFloat(costoManoDeObra) || 0;
            const calculatedCostoEstimado = totalPartesCost + manoDeObraCost;

            const newTrabajo = {
                taller_id: user.id,
                cliente_id: selectedClienteId,
                vehiculo_id: selectedVehiculoId,
                descripcion,
                partes,
                costo_mano_de_obra: manoDeObraCost,
                costo_estimado: calculatedCostoEstimado,
                status: JobStatus.Presupuesto,
                fecha_entrada: new Date().toISOString(),
            };

            const { error: insertError } = await supabase.from('trabajos').insert(newTrabajo);

            if (insertError) throw insertError;
            
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Error al crear el trabajo.');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-taller-dark">Crear Nuevo Trabajo / Presupuesto</h2>
                    <button onClick={onClose} className="text-taller-gray hover:text-taller-dark"><XMarkIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-end gap-2">
                             <div className="flex-grow">
                                <label htmlFor="cliente" className="block text-sm font-medium text-taller-gray">Cliente</label>
                                <select id="cliente" value={selectedClienteId} onChange={e => { setSelectedClienteId(e.target.value); setSelectedVehiculoId(''); }} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required>
                                    <option value="">Seleccione un cliente</option>
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>
                             <button 
                                type="button" 
                                onClick={() => setIsClientModalOpen(true)}
                                className="p-2 h-10 flex-shrink-0 bg-taller-secondary text-white rounded-md shadow-sm hover:bg-taller-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary"
                                title="Crear Nuevo Cliente"
                            >
                                <UserPlusIcon className="h-5 w-5"/>
                            </button>
                        </div>
                        <div>
                            <label htmlFor="vehiculo" className="block text-sm font-medium text-taller-gray">Vehículo</label>
                            <select id="vehiculo" value={selectedVehiculoId} onChange={e => setSelectedVehiculoId(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" disabled={!selectedClienteId} required>
                                <option value="">Seleccione un vehículo</option>
                                {vehiculos.map(v => <option key={v.id} value={v.id}>{`${v.marca} ${v.modelo} (${v.matricula})`}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="descripcion" className="block text-sm font-medium text-taller-gray">Descripción del Trabajo</label>
                        <textarea id="descripcion" value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required />
                    </div>
                     <div>
                        <h3 className="text-md font-semibold text-taller-dark mb-2">Partes y Repuestos</h3>
                        <div className="space-y-2">
                        {partes.map((parte, index) => (
                            <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                <input type="text" placeholder="Nombre parte" value={parte.nombre} onChange={e => handleParteChange(index, 'nombre', e.target.value)} className="col-span-5 mt-1 block w-full px-2 py-1.5 bg-white border border-gray-300 rounded-md text-sm" />
                                <input type="number" placeholder="Cant." value={parte.cantidad} onChange={e => handleParteChange(index, 'cantidad', e.target.value)} className="col-span-2 mt-1 block w-full px-2 py-1.5 bg-white border border-gray-300 rounded-md text-sm" />
                                <input type="number" placeholder="P/U" value={parte.precioUnitario} onChange={e => handleParteChange(index, 'precioUnitario', e.target.value)} className="col-span-3 mt-1 block w-full px-2 py-1.5 bg-white border border-gray-300 rounded-md text-sm" />
                                <div className="col-span-2 flex justify-end">
                                    <button type="button" onClick={() => handleRemoveParte(index)} className="text-red-500 hover:text-red-700"><TrashIcon className="h-5 w-5" /></button>
                                </div>
                            </div>
                        ))}
                        </div>
                        <button type="button" onClick={handleAddParte} className="mt-2 flex items-center text-sm font-medium text-taller-primary hover:underline">
                            <PlusCircleIcon className="h-5 w-5 mr-1"/> Añadir Parte
                        </button>
                    </div>

                    <div>
                        <label htmlFor="manoDeObra" className="block text-sm font-medium text-taller-gray">Costo Mano de Obra (€)</label>
                        <input type="number" step="0.01" placeholder="0.00" id="manoDeObra" value={costoManoDeObra} onChange={e => setCostoManoDeObra(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" />
                    </div>
                    
                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <div className="pt-4 flex justify-end space-x-3">
                         <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button type="submit" disabled={isSubmitting} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50">
                            {isSubmitting ? 'Creando...' : 'Crear Trabajo'}
                        </button>
                    </div>
                </form>
                {isClientModalOpen && (
                    <CrearClienteModal
                        onClose={() => setIsClientModalOpen(false)}
                        onSuccess={() => {
                            setIsClientModalOpen(false);
                            onDataRefresh();
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default CrearTrabajoModal;