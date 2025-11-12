
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Cliente, Trabajo, Gasto } from '../types';
import Header from './Header';
import Dashboard from './Dashboard';
import Trabajos from './Trabajos';
import Clientes from './Clientes';
import Ajustes from './Ajustes';
import { Bars3Icon, XMarkIcon, HomeIcon, WrenchScrewdriverIcon, UsersIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

export interface TallerInfo {
    nombre: string;
    direccion: string;
    telefono: string;
    cuit: string;
    logoUrl: string | null;
    pdfTemplate: 'classic' | 'modern';
    mobileNavStyle: 'sidebar' | 'bottom_nav';
}

type View = 'dashboard' | 'trabajos' | 'clientes' | 'ajustes';

interface TallerDashboardProps {
    onLogout: () => void;
}

const TallerDashboard: React.FC<TallerDashboardProps> = ({ onLogout }) => {
    const [view, setView] = useState<View>('dashboard');
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [tallerInfo, setTallerInfo] = useState<TallerInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");

            let currentTallerInfo = user.user_metadata?.taller_info as TallerInfo | undefined;

            if (!currentTallerInfo) {
                const defaultInfo: TallerInfo = {
                    nombre: 'Mi Taller',
                    direccion: '',
                    telefono: '',
                    cuit: '',
                    logoUrl: null,
                    pdfTemplate: 'classic',
                    mobileNavStyle: 'sidebar',
                };
                const { data: updatedUser, error: updateUserError } = await supabase.auth.updateUser({
                    data: { ...user.user_metadata, taller_info: defaultInfo }
                });
                if (updateUserError) throw updateUserError;
                currentTallerInfo = updatedUser.user?.user_metadata?.taller_info as TallerInfo;
            }
            setTallerInfo(currentTallerInfo!);


            const { data: clientesData, error: clientesError } = await supabase.from('clientes').select('*, vehiculos(*)');
            if (clientesError) throw clientesError;
            setClientes((clientesData as any) || []);

            const { data: trabajosData, error: trabajosError } = await supabase.from('trabajos').select('*').order('fecha_entrada', { ascending: false });
            if (trabajosError) throw trabajosError;
            setTrabajos(trabajosData || []);

            const { data: gastosData, error: gastosError } = await supabase.from('gastos').select('*').order('fecha', { ascending: false });
            if (gastosError) throw gastosError;
            setGastos(gastosData || []);

        } catch (error: any) {
            console.error("Error fetching data:", error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdateTallerInfo = async (newInfo: TallerInfo) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const oldName = (user.user_metadata?.taller_info as TallerInfo | undefined)?.nombre;

        const { data: updatedUser, error } = await supabase.auth.updateUser({
            data: { ...user.user_metadata, taller_info: newInfo }
        });
        
        if (error) {
            console.error("Error updating taller info:", error);
        } else {
            if(updatedUser.user) {
                setTallerInfo(updatedUser.user.user_metadata.taller_info);
                if (oldName !== newInfo.nombre) {
                    const { error: clientUpdateError } = await supabase
                        .from('clientes')
                        .update({ taller_nombre: newInfo.nombre })
                        .eq('taller_id', updatedUser.user.id);
                    if (clientUpdateError) {
                        console.error("Error cascading workshop name update:", clientUpdateError);
                    }
                }
            }
        }
    };
    
    const handleUpdateStatus = async (trabajoId: string, newStatus: string) => {
        const { error } = await supabase
            .from('trabajos')
            .update({ status: newStatus })
            .eq('id', trabajoId);
        
        if (error) {
            console.error('Error updating status:', error);
        } else {
            fetchData();
        }
    };

    const renderView = () => {
        switch (view) {
            case 'dashboard':
                return <Dashboard clientes={clientes} trabajos={trabajos} gastos={gastos} onDataRefresh={fetchData} />;
            case 'trabajos':
                return <Trabajos trabajos={trabajos} clientes={clientes} onUpdateStatus={handleUpdateStatus} onDataRefresh={fetchData} tallerInfo={tallerInfo!} />;
            case 'clientes':
                return <Clientes clientes={clientes} trabajos={trabajos} onDataRefresh={fetchData} />;
            case 'ajustes':
                return <Ajustes tallerInfo={tallerInfo!} onUpdateTallerInfo={handleUpdateTallerInfo} onLogout={onLogout} />;
            default:
                return <Dashboard clientes={clientes} trabajos={trabajos} gastos={gastos} onDataRefresh={fetchData} />;
        }
    };

    if (loading || !tallerInfo) {
        return <div className="flex h-screen items-center justify-center">Cargando Taller...</div>;
    }

    const navItems = [
        { name: 'Dashboard', icon: HomeIcon, view: 'dashboard' },
        { name: 'Trabajos', icon: WrenchScrewdriverIcon, view: 'trabajos' },
        { name: 'Clientes', icon: UsersIcon, view: 'clientes' },
        { name: 'Ajustes', icon: Cog6ToothIcon, view: 'ajustes' },
    ];

    const SidebarNav = () => (
        <nav className="mt-8">
            {navItems.map(item => (
                <button
                    key={item.name}
                    onClick={() => { setView(item.view as View); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center px-4 py-3 text-lg font-semibold rounded-lg transition-colors ${view === item.view ? 'bg-taller-secondary text-white' : 'text-gray-200 hover:bg-taller-secondary/50'}`}
                >
                    <item.icon className="h-6 w-6 mr-4" />
                    {item.name}
                </button>
            ))}
        </nav>
    );

    const BottomNavBar = () => (
         <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex justify-around items-center md:hidden z-20">
            {navItems.map(item => (
                <button
                    key={item.name}
                    onClick={() => setView(item.view as View)}
                    className={`flex flex-col items-center justify-center text-xs w-full h-full transition-colors ${view === item.view ? 'text-taller-primary' : 'text-taller-gray'}`}
                >
                    <item.icon className="h-6 w-6 mb-1" />
                    {item.name}
                </button>
            ))}
        </div>
    );

    return (
        <div className="flex h-screen bg-taller-light">
            <aside className="hidden md:flex flex-col w-64 bg-taller-dark text-white p-4">
                <div className="text-2xl font-bold text-center py-4">{tallerInfo.nombre}</div>
                <SidebarNav />
            </aside>

            <div className={`fixed inset-0 z-30 md:hidden transition-opacity ${isSidebarOpen ? 'bg-black bg-opacity-50' : 'pointer-events-none opacity-0'}`} onClick={() => setIsSidebarOpen(false)}></div>
            <aside className={`fixed top-0 left-0 h-full w-64 bg-taller-dark text-white p-4 z-40 transform transition-transform md:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                 <div className="flex justify-between items-center">
                    <div className="text-2xl font-bold">{tallerInfo.nombre}</div>
                    <button onClick={() => setIsSidebarOpen(false)} className="p-2">
                        <XMarkIcon className="h-6 w-6 text-white"/>
                    </button>
                 </div>
                <SidebarNav />
            </aside>
            
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header 
                    tallerName={tallerInfo.nombre} 
                    onMenuClick={() => setIsSidebarOpen(true)}
                    showMenuButton={tallerInfo.mobileNavStyle === 'sidebar'}
                />
                <main className={`flex-1 overflow-y-auto p-4 md:p-6 ${tallerInfo.mobileNavStyle === 'bottom_nav' ? 'pb-20' : ''}`}>
                    {renderView()}
                </main>
                 {tallerInfo.mobileNavStyle === 'bottom_nav' && <BottomNavBar />}
            </div>
        </div>
    );
};

export default TallerDashboard;
