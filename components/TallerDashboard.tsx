import React, { useState } from 'react';
import type { Cliente, Gasto, Trabajo } from '../types';
import { JobStatus } from '../types';
import Header from './Header';
import Dashboard from './Dashboard';
import Trabajos from './Trabajos';
import Clientes from './Clientes';
import Ajustes from './Ajustes';
import { ChartBarIcon, WrenchScrewdriverIcon, UsersIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

export interface TallerInfo {
    id?: number;
    nombre: string;
    direccion: string;
    logoUrl: string;
    telefono: string;
    cuit: string;
}

type TallerDashboardProps = {
    clientes: Cliente[];
    trabajos: Trabajo[];
    gastos: Gasto[];
    onLogout: () => void;
    onAddGasto: (gasto: Omit<Gasto, 'id' | 'fecha'>) => Promise<void>;
    onUpdateTrabajoStatus: (trabajoId: string, newStatus: JobStatus) => Promise<void>;
    tallerInfo: TallerInfo;
    onUpdateTallerInfo: (newInfo: TallerInfo) => Promise<void>;
};

type View = 'dashboard' | 'trabajos' | 'clientes' | 'ajustes';

const TallerDashboard: React.FC<TallerDashboardProps> = ({
    clientes,
    trabajos,
    gastos,
    onLogout,
    onAddGasto,
    onUpdateTrabajoStatus,
    tallerInfo,
    onUpdateTallerInfo
}) => {
    const [activeView, setActiveView] = useState<View>('dashboard');
    
    const renderView = () => {
        switch (activeView) {
            case 'dashboard':
                return <Dashboard trabajos={trabajos} gastos={gastos} onAddGasto={onAddGasto} />;
            case 'trabajos':
                return <Trabajos trabajos={trabajos} clientes={clientes} onUpdateStatus={onUpdateTrabajoStatus} />;
            case 'clientes':
                return <Clientes clientes={clientes} trabajos={trabajos} />;
            case 'ajustes':
                return <Ajustes tallerInfo={tallerInfo} onUpdateTallerInfo={onUpdateTallerInfo} onLogout={onLogout} />;
            default:
                return <Dashboard trabajos={trabajos} gastos={gastos} onAddGasto={onAddGasto} />;
        }
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon },
        { id: 'trabajos', label: 'Trabajos', icon: WrenchScrewdriverIcon },
        { id: 'clientes', label: 'Clientes', icon: UsersIcon },
        { id: 'ajustes', label: 'Ajustes', icon: Cog6ToothIcon },
    ];

    return (
        <div className="flex h-screen bg-taller-light">
            {/* Sidebar for desktop */}
            <nav className="hidden md:flex flex-col w-64 bg-white shadow-lg">
                <div className="flex items-center justify-center h-20 shadow-md">
                    <WrenchScrewdriverIcon className="h-8 w-8 text-taller-primary" />
                    <h1 className="text-xl font-bold ml-2">Gestor Taller</h1>
                </div>
                <ul className="flex flex-col py-4 space-y-1">
                    {navItems.map(item => (
                         <li key={item.id}>
                            <button
                                onClick={() => setActiveView(item.id as View)}
                                className={`relative flex flex-row items-center h-11 focus:outline-none hover:bg-blue-50 text-taller-gray hover:text-taller-dark border-l-4 transition-colors duration-200 ${activeView === item.id ? 'border-taller-primary text-taller-dark bg-blue-50' : 'border-transparent'}`}
                            >
                                <span className="inline-flex justify-center items-center ml-4">
                                    <item.icon className="w-5 h-5" />
                                </span>
                                <span className="ml-2 text-sm tracking-wide truncate">{item.label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="flex-1 flex flex-col overflow-hidden">
                <Header tallerName={tallerInfo.nombre} />
                <main className="flex-1 flex flex-col overflow-y-auto bg-taller-light p-4 md:p-8">
                    {renderView()}
                </main>
            </div>

            {/* Bottom Nav for mobile */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white shadow-t-lg border-t z-10">
                <div className="flex justify-around">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id as View)}
                            className={`flex flex-col items-center justify-center w-full pt-2 pb-1 ${activeView === item.id ? 'text-taller-primary' : 'text-taller-gray'}`}
                        >
                            <item.icon className="h-6 w-6 mb-1" />
                            <span className="text-xs">{item.label}</span>
                        </button>
                    ))}
                </div>
            </nav>
        </div>
    );
};

export default TallerDashboard;
