import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Gasto, Trabajo, Cliente } from '../types';
import { JobStatus } from '../types';
import Header from './Header';
import Dashboard from './Dashboard';
import Trabajos from './Trabajos';
import Clientes from './Clientes';
import Ajustes from './Ajustes';
import { HomeIcon, WrenchScrewdriverIcon, UsersIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

type View = 'dashboard' | 'trabajos' | 'clientes' | 'ajustes';

export interface TallerInfo {
    nombre: string;
    telefono: string;
    direccion: string;
    cuit: string;
    logoUrl?: string;
    pdfTemplate: 'classic' | 'modern';
}

const TallerDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const [view, setView] = useState<View>('dashboard');
    const [loading, setLoading] = useState(true);
    const [tallerInfo, setTallerInfo] = useState<TallerInfo>({ nombre: 'Mi Taller', telefono: '', direccion: '', cuit: '', logoUrl: '', pdfTemplate: 'classic' });
    const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [gastos, setGastos] = useState<Gasto[]>([]);
    
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");

            // Fetch taller info, create if it doesn't exist
            let { data: tallerData, error: tallerError } = await supabase
                .from('talleres')
                .select('*')
                .eq('id', user.id)
                .single();

            if (tallerError && tallerError.code === 'PGRST116') {
                // No workshop profile exists for this user. Let's create one.
                const defaultName = user.email ? `${user.email.split('@')[0]}'s Taller` : 'Mi Taller';
                const { data: newTallerData, error: insertError } = await supabase
                    .from('talleres')
                    .insert({ id: user.id, nombre: defaultName, pdf_template: 'classic' })
                    .select()
                    .single();
                
                if (insertError) throw insertError;
                
                tallerData = newTallerData; // Use new data for the rest of the function
            } else if (tallerError) {
                // For any other error, we should throw it
                throw tallerError;
            }

            if (tallerData) {
                setTallerInfo({
                    nombre: tallerData.nombre || 'Mi Taller',
                    telefono: tallerData.telefono || '',
                    direccion: tallerData.direccion || '',
                    cuit: tallerData.cuit || '',
                    logoUrl: tallerData.logo_url || '',
                    pdfTemplate: tallerData.pdf_template || 'classic',
                });
            }


            // Fetch clientes and their vehiculos
            const { data: clientesData, error: clientesError } = await supabase
                .from('clientes')
                .select('*, vehiculos (*)')
                .eq('taller_id', user.id);
            if (clientesError) throw clientesError;
            setClientes(clientesData as any[] || []);
            
            // Fetch trabajos
            const { data: trabajosData, error: trabajosError } = await supabase
                .from('trabajos')
                .select('*')
                .eq('taller_id', user.id)
                .order('fecha_entrada', { ascending: false });

            if (trabajosError) throw trabajosError;
             const mappedTrabajos = trabajosData.map(t => ({
                id: t.id,
                clienteId: t.cliente_id,
                vehiculoId: t.vehiculo_id,
                descripcion: t.descripcion,
                partes: t.partes,
                costoManoDeObra: t.costo_mano_de_obra,
                costoEstimado: t.costo_estimado,
                status: t.status,
                fechaEntrada: t.fecha_entrada,
                fechaSalida: t.fecha_salida,
            }));
            setTrabajos(mappedTrabajos);
            
            // Fetch gastos
            const { data: gastosData, error: gastosError } = await supabase
                .from('gastos')
                .select('*')
                .eq('taller_id', user.id)
                .order('fecha', { ascending: false });
            if (gastosError) throw gastosError;
            setGastos(gastosData || []);

        } catch (error: any) {
            console.error('Error fetching data:', error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdateJobStatus = async (trabajoId: string, newStatus: JobStatus) => {
        try {
            const { data, error } = await supabase
                .from('trabajos')
                .update({ status: newStatus, ...(newStatus === JobStatus.Finalizado && { fecha_salida: new Date().toISOString() }) })
                .eq('id', trabajoId)
                .select()
                .single();
            if (error) throw error;

            const updatedTrabajo = {
                id: data.id,
                clienteId: data.cliente_id,
                vehiculoId: data.vehiculo_id,
                descripcion: data.descripcion,
                partes: data.partes,
                costoManoDeObra: data.costo_mano_de_obra,
                costoEstimado: data.costo_estimado,
                status: data.status,
                fechaEntrada: data.fecha_entrada,
                fechaSalida: data.fecha_salida,
            };

            setTrabajos(prev => prev.map(t => t.id === trabajoId ? updatedTrabajo : t));
        } catch (error: any) {
            console.error('Error updating job status:', error.message);
        }
    };

    const handleAddGasto = async (gasto: Omit<Gasto, 'id' | 'fecha'>) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");

            const newGasto = { ...gasto, taller_id: user.id, fecha: new Date().toISOString() };
            const { data, error } = await supabase
                .from('gastos')
                .insert(newGasto)
                .select()
                .single();
            if (error) throw error;
            setGastos(prev => [data, ...prev]);
        } catch (error: any) {
            console.error('Error adding gasto:', error.message);
        }
    };
    
    const handleUpdateTallerInfo = async (newInfo: TallerInfo) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");
            const updates = {
                nombre: newInfo.nombre,
                telefono: newInfo.telefono,
                direccion: newInfo.direccion,
                cuit: newInfo.cuit,
                logo_url: newInfo.logoUrl,
                pdf_template: newInfo.pdfTemplate,
            };
            const { data, error } = await supabase
                .from('talleres')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single();
            if (error) throw error;
            setTallerInfo({
                nombre: data.nombre,
                telefono: data.telefono,
                direccion: data.direccion,
                cuit: data.cuit,
                logoUrl: data.logo_url,
                pdfTemplate: data.pdf_template,
            });
        } catch (error: any) {
            console.error('Error updating taller info:', error.message);
        }
    }

    const renderContent = () => {
        if (loading) {
            return <div className="flex justify-center items-center h-full"><p>Cargando datos...</p></div>;
        }
        switch (view) {
            case 'dashboard':
                return <Dashboard trabajos={trabajos} gastos={gastos} onAddGasto={handleAddGasto}/>;
            case 'trabajos':
                return <Trabajos trabajos={trabajos} clientes={clientes} onUpdateStatus={handleUpdateJobStatus} onDataRefresh={fetchData} tallerInfo={tallerInfo} />;
            case 'clientes':
                return <Clientes clientes={clientes} trabajos={trabajos} />;
            case 'ajustes':
                return <Ajustes tallerInfo={tallerInfo} onUpdateTallerInfo={handleUpdateTallerInfo} onLogout={onLogout} />;
            default:
                return null;
        }
    };

    const NavItem: React.FC<{ icon: React.ReactNode; label: string; viewName: View; }> = ({ icon, label, viewName }) => (
        <button
            onClick={() => setView(viewName)}
            className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                view === viewName
                    ? 'bg-taller-primary text-white shadow'
                    : 'text-taller-gray hover:bg-taller-light hover:text-taller-dark'
            }`}
        >
            {icon}
            <span className="ml-3">{label}</span>
        </button>
    );

    return (
        <div className="flex h-screen bg-taller-light font-sans">
            <aside className="w-64 flex-shrink-0 bg-white shadow-lg flex flex-col">
                <div className="h-20 flex items-center justify-center border-b">
                     <WrenchScrewdriverIcon className="h-8 w-8 text-taller-primary mr-2" />
                    <h1 className="text-xl font-bold text-taller-primary">Gestor Taller</h1>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <NavItem icon={<HomeIcon className="h-6 w-6"/>} label="Dashboard" viewName="dashboard" />
                    <NavItem icon={<WrenchScrewdriverIcon className="h-6 w-6"/>} label="Trabajos" viewName="trabajos" />
                    <NavItem icon={<UsersIcon className="h-6 w-6"/>} label="Clientes" viewName="clientes" />
                    <NavItem icon={<Cog6ToothIcon className="h-6 w-6"/>} label="Ajustes" viewName="ajustes" />
                </nav>
                <div className="p-4 border-t">
                     <button onClick={onLogout} className="flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg text-taller-gray hover:bg-red-50 hover:text-red-600 transition-colors">
                         <ArrowRightOnRectangleIcon className="h-6 w-6" />
                         <span className="ml-3">Cerrar Sesión</span>
                    </button>
                </div>
            </aside>
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header tallerName={tallerInfo.nombre} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 md:p-8">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
};

export default TallerDashboard;