import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Cliente, Trabajo, Gasto, JobStatus } from '../types';
import { JobStatus as JobStatusEnum } from '../types';
import Dashboard from './Dashboard';
import Trabajos from './Trabajos';
import Clientes from './Clientes';
import Ajustes from './Ajustes';
import Header from './Header';
import { ChartPieIcon, WrenchScrewdriverIcon, UsersIcon, Cog6ToothIcon, XMarkIcon } from '@heroicons/react/24/solid';

export interface TallerInfo {
    nombre: string;
    telefono: string;
    direccion: string;
    cuit: string;
    logoUrl?: string;
    pdfTemplate: 'classic' | 'modern';
    mobileNavStyle: 'sidebar' | 'bottom_nav';
    showLogoOnPdf: boolean;
}

interface TallerDashboardProps {
    onLogout: () => void;
}

type View = 'dashboard' | 'trabajos' | 'clientes' | 'ajustes';

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: ChartPieIcon },
    { id: 'trabajos', label: 'Trabajos', icon: WrenchScrewdriverIcon },
    { id: 'clientes', label: 'Clientes', icon: UsersIcon },
    { id: 'ajustes', label: 'Ajustes', icon: Cog6ToothIcon },
] as const;

const TallerDashboard: React.FC<TallerDashboardProps> = ({ onLogout }) => {
    const [view, setView] = useState<View>('dashboard');
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [tallerInfo, setTallerInfo] = useState<TallerInfo>({
        nombre: 'Mi Taller',
        telefono: '',
        direccion: '',
        cuit: '',
        pdfTemplate: 'classic',
        mobileNavStyle: 'sidebar',
        showLogoOnPdf: true,
    });
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const fetchData = useCallback(async () => {
        // Not setting loading to true here to avoid flicker on refetches
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");

            const metaTallerInfo = user.user_metadata?.taller_info;
            if (metaTallerInfo) {
                setTallerInfo(prev => ({...prev, ...metaTallerInfo}));
            }

            const { data: clientesData, error: clientesError } = await supabase
                .from('clientes')
                .select('*, vehiculos(*)')
                .eq('taller_id', user.id);
            if (clientesError) throw clientesError;
            setClientes(clientesData as any[] as Cliente[]);

            const { data: trabajosData, error: trabajosError } = await supabase
                .from('trabajos')
                .select('*')
                .eq('taller_id', user.id)
                .order('fecha_entrada', { ascending: false });
            if (trabajosError) throw trabajosError;
            const formattedTrabajos = (trabajosData || []).map(t => ({
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
            setTrabajos(formattedTrabajos as Trabajo[]);

            const { data: gastosData, error: gastosError } = await supabase
                .from('gastos')
                .select('*')
                .eq('taller_id', user.id)
                .order('fecha', { ascending: false });
            if (gastosError) throw gastosError;
            setGastos(gastosData as Gasto[]);

        } catch (error: any) {
            console.error("Error fetching data:", error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdateStatus = async (trabajoId: string, newStatus: JobStatus) => {
        const updateData: { status: JobStatus, fecha_salida?: string } = { status: newStatus };
        if (newStatus === JobStatusEnum.Finalizado) {
            updateData.fecha_salida = new Date().toISOString();
        }

        const { error } = await supabase
            .from('trabajos')
            .update(updateData)
            .eq('id', trabajoId);
        if (error) {
            console.error("Error updating status:", error);
        } else {
            fetchData();
        }
    };

    const handleUpdateTallerInfo = async (newInfo: TallerInfo) => {
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) return;

        const { error } = await supabase.auth.updateUser({
            data: { taller_info: newInfo }
        });

        if (error) {
            console.error('Error updating taller info:', error);
            alert('No se pudo actualizar la información del taller.');
        } else {
            setTallerInfo(newInfo);
        }
    };

    const renderView = () => {
        if (loading) {
            return <div className="flex-1 flex items-center justify-center p-4">Cargando datos del taller...</div>;
        }
        switch (view) {
            case 'dashboard':
                return <Dashboard clientes={clientes} trabajos={trabajos} gastos={gastos} onDataRefresh={fetchData} />;
            case 'trabajos':
                return <Trabajos trabajos={trabajos} clientes={clientes} onUpdateStatus={handleUpdateStatus} onDataRefresh={fetchData} tallerInfo={tallerInfo} />;
            case 'clientes':
                return <Clientes clientes={clientes} trabajos={trabajos} onDataRefresh={fetchData} />;
            case 'ajustes':
                return <Ajustes tallerInfo={tallerInfo} onUpdateTallerInfo={handleUpdateTallerInfo} onLogout={onLogout}/>;
            default:
                return null;
        }
    };

    const NavItem = ({ id, label, icon: Icon }: { id: View, label: string, icon: React.FC<{className: string}> }) => (
        <button
            onClick={() => { setView(id); setIsSidebarOpen(false); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors ${
                view === id
                    ? 'bg-taller-primary text-white shadow'
                    : 'text-taller-dark dark:text-taller-light hover:bg-taller-light dark:hover:bg-gray-700'
            }`}
        >
            <Icon className="h-6 w-6" />
            <span>{label}</span>
        </button>
    );
    
    const BottomNavItem = ({ id, label, icon: Icon }: { id: View, label: string, icon: React.FC<{className: string}> }) => (
         <button
            onClick={() => setView(id)}
            className={`flex flex-col items-center justify-center w-full pt-2 pb-1 text-xs font-medium transition-colors ${
                view === id
                    ? 'text-taller-primary'
                    : 'text-taller-gray dark:text-gray-400 hover:text-taller-primary dark:hover:text-white'
            }`}
        >
            <Icon className="h-6 w-6 mb-1" />
            <span>{label}</span>
        </button>
    );

    const BottomNav = () => (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 z-40 md:hidden shadow-[0_-2px_5px_rgba(0,0,0,0.1)]">
            <div className="flex justify-around pb-4">
                {/* FIX: Pass props explicitly to avoid spreading `key` prop and causing a TypeScript error. */}
                {navItems.map(item => <BottomNavItem key={item.id} id={item.id} label={item.label} icon={item.icon} />)}
            </div>
        </nav>
    );

    return (
        <div className="flex h-screen bg-taller-light dark:bg-gray-900 overflow-hidden">
            {/* Overlay for mobile */}
            {isSidebarOpen && tallerInfo.mobileNavStyle === 'sidebar' && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}
            
            {/* Sidebar */}
            <aside className={`absolute md:relative z-30 w-64 bg-white dark:bg-gray-800 h-full flex-shrink-0 flex flex-col p-4 transform ${isSidebarOpen && tallerInfo.mobileNavStyle === 'sidebar' ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out`}>
                <div className="flex items-center justify-between md:justify-center mb-8">
                     <h1 className="text-2xl font-bold text-taller-primary">Gestor Taller</h1>
                     <button className="md:hidden" onClick={() => setIsSidebarOpen(false)}>
                        <XMarkIcon className="h-6 w-6"/>
                     </button>
                </div>
                <nav className="flex-1 space-y-2">
                    {/* FIX: Pass props explicitly to avoid spreading `key` prop and causing a TypeScript error. */}
                    {navItems.map(item => <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} />)}
                </nav>
            </aside>
            
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header 
                    tallerName={tallerInfo.nombre} 
                    onMenuClick={() => setIsSidebarOpen(true)} 
                    showMenuButton={tallerInfo.mobileNavStyle === 'sidebar'} 
                />
                <main className={`flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 ${tallerInfo.mobileNavStyle === 'bottom_nav' ? 'pb-24' : ''}`}>
                    {renderView()}
                </main>
            </div>
            {tallerInfo.mobileNavStyle === 'bottom_nav' && <BottomNav />}
        </div>
    );
};

export default TallerDashboard;